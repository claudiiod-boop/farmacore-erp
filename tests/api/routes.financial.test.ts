import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Financial REST API Routes (/api/financial/*)', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  const createSession = (operatorName = 'Operador 1', initialCash = 100.0) => {
    const info = db
      .prepare(`
        INSERT INTO cash_sessions (operator_name, initial_cash, current_cash, status)
        VALUES (?, ?, ?, 'OPEN')
      `)
      .run(operatorName, initialCash, initialCash);
    return Number(info.lastInsertRowid);
  };

  describe('POST /api/financial/cash-closure/declare & GET /api/financial/cash-closure/*', () => {
    it('should declare a blind cash closure, retrieve it and get thermal receipt', async () => {
      const sessionId = createSession('Operador Teste', 150.0);

      // Declare blind closure
      const declareRes = await app.inject({
        method: 'POST',
        url: '/api/financial/cash-closure/declare',
        payload: {
          sessionId,
          operatorName: 'Operador Teste',
          declaredCash: 150.0,
          declaredCredit: 0.0,
          declaredDebit: 0.0,
          declaredPix: 0.0,
          declaredPbm: 0.0,
          operatorNotes: 'Fechamento perfeito',
        },
      });

      expect(declareRes.statusCode).toBe(201);
      const closure = JSON.parse(declareRes.body);
      expect(closure.id).toBeGreaterThan(0);
      expect(closure.cashSessionId).toBe(sessionId);
      expect(closure.differenceStatus).toBe('EXACT');
      expect(closure.status).toBe('PENDING_REVIEW');

      // Retrieve by sessionId
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/financial/cash-closure/session/${sessionId}`,
      });
      expect(getRes.statusCode).toBe(200);
      const fetched = JSON.parse(getRes.body);
      expect(fetched.id).toBe(closure.id);

      // Review closure (homologacao gerencial)
      const reviewRes = await app.inject({
        method: 'POST',
        url: `/api/financial/cash-closure/${closure.id}/review`,
        payload: {
          managerName: 'Gerente Roberto',
          approved: true,
          managerNotes: 'Homologado com sucesso',
        },
      });
      expect(reviewRes.statusCode).toBe(200);
      const reviewed = JSON.parse(reviewRes.body);
      expect(reviewed.status).toBe('APPROVED');
      expect(reviewed.managerName).toBe('Gerente Roberto');

      // Get receipt
      const receiptRes = await app.inject({
        method: 'GET',
        url: `/api/financial/cash-closure/${closure.id}/receipt`,
      });
      expect(receiptRes.statusCode).toBe(200);
      const receipt = JSON.parse(receiptRes.body);
      expect(receipt.textReceipt).toContain('COMPROVANTE DE FECHAMENTO DE CAIXA');
      expect(receipt.fullEscPos).toContain('\x1b\x40');

      // List closures
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/financial/cash-closures?status=APPROVED',
      });
      expect(listRes.statusCode).toBe(200);
      const listData = JSON.parse(listRes.body);
      expect(listData.total).toBe(1);
      expect(listData.closures[0].id).toBe(closure.id);
    });

    it('should return 404 when closure not found', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/financial/cash-closure/session/99999',
      });
      expect(getRes.statusCode).toBe(404);
    });
  });

  describe('TEF Reconciliation Endpoints', () => {
    beforeEach(() => {
      db.prepare(`
        INSERT OR IGNORE INTO tef_configs (provider_id, provider_name, environment)
        VALUES ('MOCK', 'Mock Gateway', 'MOCK')
      `).run();

      db.prepare(`
        INSERT INTO tef_transactions (
          transaction_uuid, provider_id, terminal_id, operation_type,
          status, amount, brand_name, brand_code_sefaz, acquirer_name, acquirer_cnpj,
          authorization_code, nsu, host_nsu, mdr_rate, net_amount, expected_settlement_date,
          settlement_status, created_at
        ) VALUES (
          'uuid-rec-1', 'MOCK', 'SE000001', 'DEBITO',
          'CONFIRMED', 100.0, 'VISA', '01', 'CIELO', '12345678000199',
          'AUTH1', 'NSU_REC_1', 'H1', 1.5, 98.5, '2026-11-20',
          'PENDING', '2026-11-19 10:00:00'
        )
      `).run();
    });

    it('GET /api/financial/reconciliation/forecast should return forecast summary', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/financial/reconciliation/forecast',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.totalGross).toBe(100.0);
      expect(body.totalNet).toBe(98.5);
      expect(body.totalTransactions).toBe(1);
      expect(body.items.length).toBe(1);
    });

    it('POST /api/financial/reconciliation/settle should settle transaction', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/financial/reconciliation/settle',
        payload: {
          nsu: 'NSU_REC_1',
          settledAmount: 98.5,
          settledFee: 1.5,
          bankAccount: 'BANCO BRADESCO',
        },
      });
      expect(res.statusCode).toBe(200);
      const tx = JSON.parse(res.body);
      expect(tx.settlementStatus).toBe('SETTLED');
      expect(tx.settledAmount).toBe(98.5);
    });

    it('GET /api/financial/reconciliation/transactions should list reconciliation summary', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/financial/reconciliation/transactions',
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.transactions.length).toBe(1);
      expect(data.summary.pendingCount).toBe(1);
      expect(data.summary.totalPending).toBe(98.5);
    });
  });

  describe('Financial Reports Endpoints', () => {
    it('GET /api/financial/reports/dre & /api/financial/reports/abc-curve should return reports', async () => {
      const dreRes = await app.inject({
        method: 'GET',
        url: '/api/financial/reports/dre?startDate=2026-11-01&endDate=2026-11-30',
      });
      expect(dreRes.statusCode).toBe(200);
      const dre = JSON.parse(dreRes.body);
      expect(dre.startDate).toBe('2026-11-01');
      expect(dre.endDate).toBe('2026-11-30');
      expect(dre.grossRevenue).toBeDefined();

      const abcRes = await app.inject({
        method: 'GET',
        url: '/api/financial/reports/abc-curve?startDate=2026-11-01&endDate=2026-11-30',
      });
      expect(abcRes.statusCode).toBe(200);
      const abc = JSON.parse(abcRes.body);
      expect(abc.totalRevenue).toBeDefined();
      expect(abc.items).toBeInstanceOf(Array);
      expect(abc.categoriesSummary).toBeInstanceOf(Array);
    });
  });
});
