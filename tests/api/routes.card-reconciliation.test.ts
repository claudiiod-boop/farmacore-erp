import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Card Reconciliation REST API Routes (/api/card-reconciliation/*)', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO tef_configs (provider_id, provider_name, environment, terminal_id, is_active)
      VALUES ('SITEF', 'Software Express SiTef', 'MOCK', 'SE000001', 1)
    `).run();

    // Transação TEF base
    db.prepare(`
      INSERT INTO tef_transactions (
        id, transaction_uuid, provider_id, terminal_id, operation_type, status,
        amount, installments, brand_name, brand_code_sefaz, acquirer_name, acquirer_cnpj,
        authorization_code, nsu, host_nsu, created_at
      ) VALUES (
        1, 'uuid-tef-100', 'SITEF', 'SE000001', 'DEBITO', 'CONFIRMED',
        100.00, 1, 'VISA', '01', 'STONE', '16501555000157',
        'AUTH777', 'NSU777', 'HOST777', '2026-06-01 10:00:00'
      )
    `).run();

    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('Contract and Fee Rules Endpoints', () => {
    it('POST /api/card-reconciliation/contracts should create a new acquirer contract', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/card-reconciliation/contracts',
        payload: {
          storeId: 1,
          acquirerName: 'STONE',
          acquirerCnpj: '16501555000157',
          merchantCode: 'STONE_001',
          defaultBankName: 'Banco Itaú',
          defaultBankAgency: '0057',
          defaultBankAccount: '12345-6',
          debitSettlementDays: 1,
          creditSettlementDays: 30,
          pixSettlementDays: 0
        }
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.id).toBeGreaterThan(0);
      expect(data.acquirerName).toBe('STONE');
      expect(data.isActive).toBe(true);
    });

    it('GET /api/card-reconciliation/contracts should return list of contracts with rules', async () => {
      // 1. Cria contrato
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/card-reconciliation/contracts',
        payload: {
          storeId: 1,
          acquirerName: 'CIELO',
          acquirerCnpj: '01027058000191',
          defaultBankName: 'Bradesco',
          defaultBankAgency: '1234',
          defaultBankAccount: '99999-0'
        }
      });
      const contract = JSON.parse(createRes.body);

      // 2. Adiciona regra
      const ruleRes = await app.inject({
        method: 'POST',
        url: `/api/card-reconciliation/contracts/${contract.id}/rules`,
        payload: {
          brandName: 'VISA',
          operationType: 'DEBIT',
          installmentMin: 1,
          installmentMax: 1,
          mdrRate: 1.25,
          fixedFee: 0.10
        }
      });
      expect(ruleRes.statusCode).toBe(201);

      // 3. Consulta lista
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/card-reconciliation/contracts?storeId=1'
      });
      expect(listRes.statusCode).toBe(200);
      const list = JSON.parse(listRes.body);
      expect(list).toHaveLength(1);
      expect(list[0].acquirerName).toBe('CIELO');
      expect(list[0].rules).toHaveLength(1);
      expect(list[0].rules[0].brandName).toBe('VISA');
    });
  });

  describe('Import, Batches, Calendar and Divergences Endpoints', () => {
    it('should complete full statement reconciliation workflow via API', async () => {
      // 1. Cria contrato Stone
      const contractRes = await app.inject({
        method: 'POST',
        url: '/api/card-reconciliation/contracts',
        payload: {
          storeId: 1,
          acquirerName: 'STONE',
          acquirerCnpj: '16501555000157',
          defaultBankName: 'Banco Itaú',
          defaultBankAgency: '0057',
          defaultBankAccount: '12345-6'
        }
      });
      const contract = JSON.parse(contractRes.body);

      // 2. Adiciona regra Débito Visa: 1.25% + 0.10 = 1.35
      await app.inject({
        method: 'POST',
        url: `/api/card-reconciliation/contracts/${contract.id}/rules`,
        payload: {
          brandName: 'VISA',
          operationType: 'DEBIT',
          installmentMin: 1,
          installmentMax: 1,
          mdrRate: 1.25,
          fixedFee: 0.10
        }
      });

      // 3. Importa extrato com item conciliado e item divergente
      const importRes = await app.inject({
        method: 'POST',
        url: '/api/card-reconciliation/import',
        payload: {
          storeId: 1,
          acquirerContractId: contract.id,
          fileName: 'EXTRATO_JUNHO.csv',
          fileType: 'EXTRATO_CSV',
          items: [
            {
              nsu: 'NSU777',
              authorizationCode: 'AUTH777',
              transactionDate: '2026-06-01 10:00:00',
              settlementDate: '2026-06-02',
              brandName: 'VISA',
              operationType: 'DEBIT',
              grossAmount: 100.00,
              chargedMdrRate: 1.25,
              chargedFeeAmount: 1.35, // Bate com 1.25 + 0.10
              netAmount: 98.65
            },
            {
              nsu: 'NSU999_DIV',
              authorizationCode: 'AUTH999',
              transactionDate: '2026-06-01 11:00:00',
              settlementDate: '2026-06-02',
              brandName: 'VISA',
              operationType: 'DEBIT',
              grossAmount: 200.00,
              chargedMdrRate: 3.00,
              chargedFeeAmount: 6.00,
              netAmount: 194.00
            }
          ]
        }
      });

      expect(importRes.statusCode).toBe(201);
      const batch = JSON.parse(importRes.body);
      expect(batch.id).toBeGreaterThan(0);
      expect(batch.totalRecords).toBe(2);

      // 4. Consulta detalhes do lote
      const batchDetailsRes = await app.inject({
        method: 'GET',
        url: `/api/card-reconciliation/batches/${batch.id}`
      });
      expect(batchDetailsRes.statusCode).toBe(200);
      const batchDetails = JSON.parse(batchDetailsRes.body);
      expect(batchDetails.entries).toHaveLength(2);

      // 5. Consulta calendário de recebíveis
      const calRes = await app.inject({
        method: 'GET',
        url: '/api/card-reconciliation/calendar?storeId=1&startDate=2026-06-01&endDate=2026-06-10'
      });
      expect(calRes.statusCode).toBe(200);
      const cal = JSON.parse(calRes.body);
      expect(cal.length).toBeGreaterThan(0);
      expect(cal[0].date).toBe('2026-06-02');

      // 6. Consulta comprovante térmico diário
      const printCalRes = await app.inject({
        method: 'GET',
        url: '/api/card-reconciliation/calendar/print?storeId=1&date=2026-06-02'
      });
      expect(printCalRes.statusCode).toBe(200);
      const printCalData = JSON.parse(printCalRes.body);
      expect(printCalData.slipText).toContain('EXTRATO DE LIQUIDACAO DE CARTOES');

      // 7. Consulta relatório de divergências
      const divRes = await app.inject({
        method: 'GET',
        url: '/api/card-reconciliation/divergences?storeId=1'
      });
      expect(divRes.statusCode).toBe(200);
      const divData = JSON.parse(divRes.body);
      expect(divData.items).toBeDefined();

      // 8. Consulta impressão térmica de divergências
      const printDivRes = await app.inject({
        method: 'GET',
        url: '/api/card-reconciliation/divergences/print?storeId=1'
      });
      expect(printDivRes.statusCode).toBe(200);
      const printDivData = JSON.parse(printDivRes.body);
      expect(printDivData.slipText).toContain('AUDITORIA DE DIVERGENCIAS DE TAXA MDR');
    });
  });
});
