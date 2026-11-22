import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CardReconciliationService } from '../../../src/modules/financial/card-reconciliation.service';
import { ImportStatementInput } from '../../../src/modules/financial/card-reconciliation.types';

describe('CardReconciliationService - Calendar and Divergence Reporting', () => {
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO tef_configs (provider_id, provider_name, environment, terminal_id, is_active)
      VALUES ('SITEF', 'Software Express SiTef', 'MOCK', 'SE000001', 1)
    `).run();

    // Cria contrato Stone
    const stone = await CardReconciliationService.createAcquirerContract(db, {
      storeId: 1,
      acquirerName: 'STONE',
      acquirerCnpj: '16501555000157',
      defaultBankName: 'Banco Itaú',
      defaultBankAgency: '0057',
      defaultBankAccount: '12345-6'
    });

    await CardReconciliationService.addFeeRule(db, {
      contractId: stone.id,
      brandName: 'VISA',
      operationType: 'DEBIT',
      installmentMin: 1,
      installmentMax: 1,
      mdrRate: 1.25,
      fixedFee: 0.10
    });

    await CardReconciliationService.addFeeRule(db, {
      contractId: stone.id,
      brandName: 'MASTERCARD',
      operationType: 'CREDIT',
      installmentMin: 1,
      installmentMax: 1,
      mdrRate: 2.00,
      fixedFee: 0.15
    });

    // Insere transações TEF no ERP para cruzamento
    db.prepare(`
      INSERT INTO tef_transactions (
        id, transaction_uuid, provider_id, terminal_id, operation_type, status,
        amount, installments, brand_name, brand_code_sefaz, acquirer_name, acquirer_cnpj,
        authorization_code, nsu, host_nsu, created_at
      ) VALUES
      (1, 'uuid-001', 'SITEF', 'SE000001', 'DEBITO', 'CONFIRMED', 100.0, 1, 'VISA', '01', 'STONE', '16501555000157', 'A1', 'NSU1', 'H1', '2026-06-01 10:00:00'),
      (2, 'uuid-002', 'SITEF', 'SE000001', 'CREDITO', 'CONFIRMED', 200.0, 1, 'MASTERCARD', '02', 'STONE', '16501555000157', 'A2', 'NSU2', 'H2', '2026-06-01 11:00:00'),
      (3, 'uuid-003', 'SITEF', 'SE000001', 'DEBITO', 'CONFIRMED', 300.0, 1, 'VISA', '01', 'STONE', '16501555000157', 'A3', 'NSU3', 'H3', '2026-06-02 10:00:00')
    `).run();

    // Importa lote com 3 transações distribuídas em 2 dias:
    // Dia 2026-06-02:
    //   - NSU1: R$ 100 (taxa 1.35) -> CONCILIATED
    //   - NSU2: R$ 200 (taxa 5.50 em vez de 4.15) -> DIVERGENT_FEE (+1.35 cobrado a mais)
    // Dia 2026-06-03:
    //   - NSU3: R$ 300 (taxa 3.85) -> CONCILIATED
    const importInput: ImportStatementInput = {
      storeId: 1,
      acquirerContractId: stone.id,
      fileName: 'EXTRATO_TEST.csv',
      fileType: 'EXTRATO_CSV',
      items: [
        {
          nsu: 'NSU1',
          authorizationCode: 'A1',
          transactionDate: '2026-06-01 10:00:00',
          settlementDate: '2026-06-02',
          brandName: 'VISA',
          operationType: 'DEBIT',
          grossAmount: 100.00,
          chargedMdrRate: 1.25,
          chargedFeeAmount: 1.35,
          netAmount: 98.65
        },
        {
          nsu: 'NSU2',
          authorizationCode: 'A2',
          transactionDate: '2026-06-01 11:00:00',
          settlementDate: '2026-06-02',
          brandName: 'MASTERCARD',
          operationType: 'CREDIT',
          grossAmount: 200.00,
          chargedMdrRate: 2.675,
          chargedFeeAmount: 5.50, // Esperado 4.15
          netAmount: 194.50
        },
        {
          nsu: 'NSU3',
          authorizationCode: 'A3',
          transactionDate: '2026-06-02 10:00:00',
          settlementDate: '2026-06-03',
          brandName: 'VISA',
          operationType: 'DEBIT',
          grossAmount: 300.00,
          chargedMdrRate: 1.25,
          chargedFeeAmount: 3.85,
          netAmount: 296.15
        }
      ]
    };

    await CardReconciliationService.importStatement(db, importInput);
  });

  afterEach(() => {
    db.close();
  });

  describe('getReceivablesCalendar', () => {
    it('should aggregate settlement entries by date and acquirer across period', async () => {
      const calendar = await CardReconciliationService.getReceivablesCalendar(
        db,
        1,
        '2026-06-01',
        '2026-06-05'
      );

      expect(calendar).toHaveLength(2); // 2026-06-02 e 2026-06-03

      // Dia 1: 2026-06-02 (R$ 100 + R$ 200 = R$ 300)
      const day1 = calendar.find(d => d.date === '2026-06-02');
      expect(day1).toBeDefined();
      expect(day1?.totalGross).toBe(300.00);
      expect(day1?.totalFee).toBe(6.85); // 1.35 + 5.50
      expect(day1?.totalNet).toBe(293.15); // 98.65 + 194.50
      expect(day1?.transactionCount).toBe(2);
      expect(day1?.byAcquirer['STONE']).toBeDefined();
      expect(day1?.byAcquirer['STONE'].gross).toBe(300.00);
      expect(day1?.byAcquirer['STONE'].count).toBe(2);

      // Dia 2: 2026-06-03 (R$ 300)
      const day2 = calendar.find(d => d.date === '2026-06-03');
      expect(day2).toBeDefined();
      expect(day2?.totalGross).toBe(300.00);
      expect(day2?.totalFee).toBe(3.85);
      expect(day2?.totalNet).toBe(296.15);
      expect(day2?.transactionCount).toBe(1);
    });

    it('should return empty array if no settlements in the requested period', async () => {
      const calendar = await CardReconciliationService.getReceivablesCalendar(
        db,
        1,
        '2026-07-01',
        '2026-07-10'
      );
      expect(calendar).toHaveLength(0);
    });
  });

  describe('getDivergenceReport', () => {
    it('should list only divergent transactions with exact overcharged amount', async () => {
      const report = await CardReconciliationService.getDivergenceReport(db, 1);

      expect(report.totalDivergentCount).toBe(1);
      expect(report.totalOverchargedAmount).toBe(1.35); // 5.50 - 4.15
      expect(report.items).toHaveLength(1);

      const divItem = report.items[0];
      expect(divItem.nsu).toBe('NSU2');
      expect(divItem.authorizationCode).toBe('A2');
      expect(divItem.acquirerName).toBe('STONE');
      expect(divItem.brandName).toBe('MASTERCARD');
      expect(divItem.grossAmount).toBe(200.00);
      expect(divItem.chargedFeeAmount).toBe(5.50);
      expect(divItem.expectedFeeAmount).toBe(4.15);
      expect(divItem.divergenceAmount).toBe(1.35);
    });
  });
});
