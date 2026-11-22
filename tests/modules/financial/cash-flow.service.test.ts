import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CashFlowService } from '../../../src/modules/financial/cash-flow.service';
import { BankReconciliationService } from '../../../src/modules/financial/bank-reconciliation.service';
import { CardReconciliationService } from '../../../src/modules/financial/card-reconciliation.service';

describe('CashFlowService - Fluxo de Caixa Realizado vs Projetado', () => {
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    // 1. Cadastra contas bancárias com saldos
    await BankReconciliationService.createBankAccount(db, {
      storeId: 1,
      bankCode: '341',
      bankName: 'Banco Itaú',
      agencyNumber: '0057',
      accountNumber: '12345-6',
      initialBalance: 15000.00
    });

    await BankReconciliationService.createBankAccount(db, {
      storeId: 1,
      bankCode: '001',
      bankName: 'Banco do Brasil',
      agencyNumber: '1234',
      accountNumber: '99999-0',
      initialBalance: 5000.00
    });

    // 2. Registra sessão de caixa PDV aberta com R$ 1.250,00 em gaveta
    db.prepare(`
      INSERT INTO cash_sessions (id, operator_name, initial_cash, current_cash, status, opened_at)
      VALUES (1, 'Operador Balcão', 250.00, 1250.00, 'OPEN', '2026-06-01 08:00:00')
    `).run();

    // 3. Cadastra contrato e liquidações futuras de cartões (D+1 / D+30)
    const contract = await CardReconciliationService.createAcquirerContract(db, {
      storeId: 1,
      acquirerName: 'STONE',
      acquirerCnpj: '16501555000157',
      defaultBankName: 'Banco Itaú',
      defaultBankAgency: '0057',
      defaultBankAccount: '12345-6'
    });

    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const dayAfter = new Date(Date.now() + 172800000).toISOString().slice(0, 10);

    await CardReconciliationService.importStatement(db, {
      storeId: 1,
      acquirerContractId: contract.id,
      fileName: 'RECEBIVEIS_FUTUROS.csv',
      fileType: 'EXTRATO_CSV',
      items: [
        {
          nsu: 'FUT-01',
          transactionDate: new Date().toISOString(),
          settlementDate: tomorrow,
          brandName: 'VISA',
          operationType: 'DEBIT',
          grossAmount: 3000.00,
          chargedMdrRate: 1.50,
          chargedFeeAmount: 45.00,
          netAmount: 2955.00
        },
        {
          nsu: 'FUT-02',
          transactionDate: new Date().toISOString(),
          settlementDate: dayAfter,
          brandName: 'MASTERCARD',
          operationType: 'CREDIT',
          grossAmount: 5000.00,
          chargedMdrRate: 2.00,
          chargedFeeAmount: 100.00,
          netAmount: 4900.00
        }
      ]
    });
  });

  afterEach(() => {
    db.close();
  });

  describe('getCashFlowOverview', () => {
    it('should aggregate bank balances, cash drawer balances and total current assets', async () => {
      const overview = await CashFlowService.getCashFlowOverview(db, 1, 15);

      expect(overview.totalLiquidBankBalance).toBe(20000.00); // 15000 + 5000
      expect(overview.totalCashDrawerBalance).toBe(1250.00);
      expect(overview.totalCurrentAssets).toBe(21250.00); // 20000 + 1250
      expect(overview.currentBankBalances).toHaveLength(2);
    });

    it('should project cash flow timeline for future days with accurate balance progression', async () => {
      const overview = await CashFlowService.getCashFlowOverview(db, 1, 7);

      expect(overview.projections30Days.length).toBeGreaterThanOrEqual(7);

      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const tomorrowProj = overview.projections30Days.find(p => p.date === tomorrow);
      expect(tomorrowProj).toBeDefined();
      expect(tomorrowProj?.projectedInflow).toBe(2955.00);
      expect(tomorrowProj?.projectedClosingBalance).toBeGreaterThan(21250.00);
      expect(tomorrowProj?.status).toBe('SURPLUS');
    });

    it('should flag deficit when projected balance falls below zero', async () => {
      // Simula título alto a pagar que supera o saldo
      const dayAfter = new Date(Date.now() + 172800000).toISOString().slice(0, 10);

      db.prepare(`
        INSERT INTO purchase_invoices (
          id, access_key, invoice_number, invoice_series, issue_date,
          supplier_cnpj, supplier_name, total_invoice_amount, total_products_amount, xml_content
        ) VALUES (
          99, '35260600000000000000550010000099991000099999', 9999, 1, ?,
          '11222333000144', 'MEGA DISTRIBUIDORA DE MEDICAMENTOS', 50000.00, 50000.00, '<nfeProc/>'
        )
      `).run(dayAfter);

      const overview = await CashFlowService.getCashFlowOverview(db, 1, 7);
      const deficitDay = overview.projections30Days.find(p => p.date === dayAfter);
      expect(deficitDay).toBeDefined();
      expect(deficitDay?.projectedOutflow).toBe(50000.00);
      expect(deficitDay?.status).toBe('DEFICIT');
    });
  });
});
