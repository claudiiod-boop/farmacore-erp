import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CardReconciliationService } from '../../../src/modules/financial/card-reconciliation.service';
import {
  CreateAcquirerContractInput,
  CreateFeeRuleInput,
  ImportStatementInput
} from '../../../src/modules/financial/card-reconciliation.types';

describe('CardReconciliationService', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);

    // A loja 1 (Matriz) já é inserida pela migration 008
    // Insere dados básicos de TEF para cruzar transações

    db.prepare(`
      INSERT INTO tef_configs (provider_id, provider_name, environment, terminal_id, is_active)
      VALUES ('SITEF', 'Software Express SiTef', 'MOCK', 'SE000001', 1)
    `).run();

    // Insere transação TEF existente no ERP
    db.prepare(`
      INSERT INTO tef_transactions (
        id, transaction_uuid, provider_id, terminal_id, operation_type, status,
        amount, installments, brand_name, brand_code_sefaz, acquirer_name, acquirer_cnpj,
        authorization_code, nsu, host_nsu, created_at
      ) VALUES (
        1, 'uuid-tef-001', 'SITEF', 'SE000001', 'DEBITO', 'CONFIRMED',
        100.00, 1, 'VISA', '01', 'STONE', '16501555000157',
        'AUTH123', 'NSU99901', 'HOST001', '2026-05-15 10:00:00'
      )
    `).run();

    db.prepare(`
      INSERT INTO tef_transactions (
        id, transaction_uuid, provider_id, terminal_id, operation_type, status,
        amount, installments, brand_name, brand_code_sefaz, acquirer_name, acquirer_cnpj,
        authorization_code, nsu, host_nsu, created_at
      ) VALUES (
        2, 'uuid-tef-002', 'SITEF', 'SE000001', 'CREDITO', 'CONFIRMED',
        200.00, 1, 'MASTERCARD', '02', 'STONE', '16501555000157',
        'AUTH456', 'NSU99902', 'HOST002', '2026-05-15 11:00:00'
      )
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  describe('Contract and Fee Rules Management', () => {
    it('should create an acquirer contract and fetch it', async () => {
      const contractInput: CreateAcquirerContractInput = {
        storeId: 1,
        acquirerName: 'STONE',
        acquirerCnpj: '16501555000157',
        merchantCode: 'STONE_MAGNOS_01',
        defaultBankName: 'Banco Itaú',
        defaultBankAgency: '0057',
        defaultBankAccount: '12345-6',
        debitSettlementDays: 1,
        creditSettlementDays: 30,
        pixSettlementDays: 0,
        notes: 'Contrato negociado balcão 2026'
      };

      const contract = await CardReconciliationService.createAcquirerContract(db, contractInput);
      expect(contract.id).toBeGreaterThan(0);
      expect(contract.acquirerName).toBe('STONE');
      expect(contract.isActive).toBe(true);

      const contracts = await CardReconciliationService.listContracts(db, 1);
      expect(contracts).toHaveLength(1);
      expect(contracts[0].acquirerName).toBe('STONE');
    });

    it('should add fee rules to a contract and return them with listContracts', async () => {
      const contract = await CardReconciliationService.createAcquirerContract(db, {
        storeId: 1,
        acquirerName: 'CIELO',
        acquirerCnpj: '01027058000191',
        defaultBankName: 'Banco Bradesco',
        defaultBankAgency: '1234',
        defaultBankAccount: '98765-4'
      });

      const debitRuleInput: CreateFeeRuleInput = {
        contractId: contract.id,
        brandName: 'VISA',
        operationType: 'DEBIT',
        installmentMin: 1,
        installmentMax: 1,
        mdrRate: 1.20,
        fixedFee: 0.10,
        settlementDays: 1
      };

      const rule = await CardReconciliationService.addFeeRule(db, debitRuleInput);
      expect(rule.id).toBeGreaterThan(0);
      expect(rule.contractId).toBe(contract.id);
      expect(rule.mdrRate).toBe(1.20);

      const contracts = await CardReconciliationService.listContracts(db, 1);
      expect(contracts[0].rules).toHaveLength(1);
      expect(contracts[0].rules[0].brandName).toBe('VISA');
    });
  });

  describe('importStatement and Automated Reconciliation', () => {
    it('should import statement and accurately categorize CONCILIATED, DIVERGENT_FEE, NOT_FOUND_IN_ERP, CHARGEBACK', async () => {
      // 1. Cria contrato Stone com regras
      const contract = await CardReconciliationService.createAcquirerContract(db, {
        storeId: 1,
        acquirerName: 'STONE',
        acquirerCnpj: '16501555000157',
        defaultBankName: 'Banco Itaú',
        defaultBankAgency: '0057',
        defaultBankAccount: '12345-6'
      });

      // Regra Débito VISA: 1.25% + 0.10
      await CardReconciliationService.addFeeRule(db, {
        contractId: contract.id,
        brandName: 'VISA',
        operationType: 'DEBIT',
        installmentMin: 1,
        installmentMax: 1,
        mdrRate: 1.25,
        fixedFee: 0.10
      });

      // Regra Crédito Master 1x: 2.00% + 0.15 -> para R$ 200: taxa esperada = 200 * 2% (4.00) + 0.15 = 4.15
      await CardReconciliationService.addFeeRule(db, {
        contractId: contract.id,
        brandName: 'MASTERCARD',
        operationType: 'CREDIT',
        installmentMin: 1,
        installmentMax: 1,
        mdrRate: 2.00,
        fixedFee: 0.15
      });

      // 2. Prepara lote com 4 itens:
      // Item 1: NSU99901 (Débito Visa R$ 100) -> cobrado 1.35 (1.25% + 0.10) => CONCILIATED
      // Item 2: NSU99902 (Crédito Master R$ 200) -> cobrado 5.50 (ao invés de 4.15) => DIVERGENT_FEE (cobrado a mais R$ 1.35)
      // Item 3: NSU88888 (Não existe no ERP) => NOT_FOUND_IN_ERP
      // Item 4: NSU99999 (Chargeback) => CHARGEBACK
      const importInput: ImportStatementInput = {
        storeId: 1,
        acquirerContractId: contract.id,
        fileName: 'EXTRATO_STONE_202605.csv',
        fileType: 'EXTRATO_CSV',
        items: [
          {
            nsu: 'NSU99901',
            authorizationCode: 'AUTH123',
            transactionDate: '2026-05-15 10:00:00',
            settlementDate: '2026-05-18',
            brandName: 'VISA',
            operationType: 'DEBIT',
            installmentNumber: 1,
            totalInstallments: 1,
            grossAmount: 100.00,
            chargedMdrRate: 1.25,
            chargedFeeAmount: 1.35,
            netAmount: 98.65
          },
          {
            nsu: 'NSU99902',
            authorizationCode: 'AUTH456',
            transactionDate: '2026-05-15 11:00:00',
            settlementDate: '2026-06-15',
            brandName: 'MASTERCARD',
            operationType: 'CREDIT',
            installmentNumber: 1,
            totalInstallments: 1,
            grossAmount: 200.00,
            chargedMdrRate: 2.675,
            chargedFeeAmount: 5.50, // Esperado 4.15 (divergência de +1.35)
            netAmount: 194.50
          },
          {
            nsu: 'NSU88888',
            authorizationCode: 'AUTH888',
            transactionDate: '2026-05-15 12:00:00',
            settlementDate: '2026-05-18',
            brandName: 'VISA',
            operationType: 'DEBIT',
            installmentNumber: 1,
            totalInstallments: 1,
            grossAmount: 50.00,
            chargedMdrRate: 1.25,
            chargedFeeAmount: 0.72,
            netAmount: 49.28
          },
          {
            nsu: 'NSU99999',
            authorizationCode: 'AUTH999',
            transactionDate: '2026-05-15 13:00:00',
            settlementDate: '2026-05-18',
            brandName: 'VISA',
            operationType: 'DEBIT',
            installmentNumber: 1,
            totalInstallments: 1,
            grossAmount: -80.00,
            chargedMdrRate: 0,
            chargedFeeAmount: 0,
            netAmount: -80.00,
            notes: 'CHARGEBACK / CONTESTACAO DO TITULAR'
          }
        ]
      };

      const batch = await CardReconciliationService.importStatement(db, importInput);

      expect(batch.id).toBeGreaterThan(0);
      expect(batch.batchCode).toContain('CONC-');
      expect(batch.totalRecords).toBe(4);
      expect(batch.conciliatedCount).toBe(1);
      expect(batch.divergentCount).toBe(1);
      expect(batch.notFoundCount).toBe(1);
      expect(batch.chargebackCount).toBe(1);

      // 3. Verifica os detalhes das entradas
      const details = await CardReconciliationService.getBatchDetails(db, batch.id);
      expect(details.entries).toHaveLength(4);

      const entry1 = details.entries.find(e => e.nsu === 'NSU99901');
      expect(entry1?.reconciliationStatus).toBe('CONCILIATED');
      expect(entry1?.divergenceAmount).toBe(0);
      expect(entry1?.tefTransactionId).toBe(1);

      const entry2 = details.entries.find(e => e.nsu === 'NSU99902');
      expect(entry2?.reconciliationStatus).toBe('DIVERGENT_FEE');
      expect(entry2?.divergenceAmount).toBe(1.35); // 5.50 cobrado - 4.15 contratual
      expect(entry2?.expectedFeeAmount).toBe(4.15);

      const entry3 = details.entries.find(e => e.nsu === 'NSU88888');
      expect(entry3?.reconciliationStatus).toBe('NOT_FOUND_IN_ERP');

      const entry4 = details.entries.find(e => e.nsu === 'NSU99999');
      expect(entry4?.reconciliationStatus).toBe('CHARGEBACK');
    });
  });
});
