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

  describe('Blind Cash Closure Endpoints (Canonical & Aliases)', () => {
    it('should declare a blind cash closure using canonical route POST /api/financial/cash-closures', async () => {
      const sessionId = createSession('Operador Canônico', 150.0);

      const declareRes = await app.inject({
        method: 'POST',
        url: '/api/financial/cash-closures',
        payload: {
          sessionId,
          operatorName: 'Operador Canônico',
          declaredCash: 150.0,
          declaredCredit: 0.0,
          declaredDebit: 0.0,
          declaredPix: 0.0,
          declaredPbm: 0.0,
          operatorNotes: 'Fechamento canônico',
        },
      });

      expect(declareRes.statusCode).toBe(201);
      const closure = JSON.parse(declareRes.body);
      expect(closure.id).toBeGreaterThan(0);
      expect(closure.cashSessionId).toBe(sessionId);
      expect(closure.differenceStatus).toBe('EXACT');

      // Canonical GET /by-session/:sessionId
      const bySessionRes = await app.inject({
        method: 'GET',
        url: `/api/financial/cash-closures/by-session/${sessionId}`,
      });
      expect(bySessionRes.statusCode).toBe(200);
      const bySessionData = JSON.parse(bySessionRes.body);
      expect(bySessionData.id).toBe(closure.id);

      // Canonical POST /:closureId/review
      const reviewRes = await app.inject({
        method: 'POST',
        url: `/api/financial/cash-closures/${closure.id}/review`,
        payload: {
          managerName: 'Gerente Roberto',
          approved: true,
          managerNotes: 'Aprovado via rota canônica',
        },
      });
      expect(reviewRes.statusCode).toBe(200);
      const reviewed = JSON.parse(reviewRes.body);
      expect(reviewed.status).toBe('APPROVED');

      // Canonical GET /:closureId/receipt
      const receiptRes = await app.inject({
        method: 'GET',
        url: `/api/financial/cash-closures/${closure.id}/receipt`,
      });
      expect(receiptRes.statusCode).toBe(200);
      const receipt = JSON.parse(receiptRes.body);
      expect(receipt.textReceipt).toContain('COMPROVANTE DE FECHAMENTO DE CAIXA');
      expect(receipt.fullEscPos).toContain('\x1b\x40');
    });

    it('should support legacy/alias endpoints /cash-closure/declare and /cash-closure/session/:id', async () => {
      const sessionId = createSession('Operador Legado', 200.0);

      const declareRes = await app.inject({
        method: 'POST',
        url: '/api/financial/cash-closure/declare',
        payload: {
          sessionId,
          operatorName: 'Operador Legado',
          declaredCash: 200.0,
          declaredCredit: 0.0,
          declaredDebit: 0.0,
          declaredPix: 0.0,
          declaredPbm: 0.0,
        },
      });
      expect(declareRes.statusCode).toBe(201);

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/financial/cash-closure/session/${sessionId}`,
      });
      expect(getRes.statusCode).toBe(200);
    });

    it('should reject invalid declare payload with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/financial/cash-closures',
        payload: {
          sessionId: -1, // Inválido
          operatorName: '', // Vazio
          declaredCash: -50, // Negativo
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('INVALID_PARAMETERS');
    });

    it('should return 400 for non-numeric session or closure ID', async () => {
      const resSession = await app.inject({
        method: 'GET',
        url: '/api/financial/cash-closures/by-session/abc',
      });
      expect(resSession.statusCode).toBe(400);

      const resClosure = await app.inject({
        method: 'GET',
        url: '/api/financial/cash-closures/xyz',
      });
      expect(resClosure.statusCode).toBe(400);
    });

    it('should return 404 when declaring on nonexistent session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/financial/cash-closures',
        payload: {
          sessionId: 99999,
          operatorName: 'Operador Inexistente',
          declaredCash: 100,
          declaredCredit: 0,
          declaredDebit: 0,
          declaredPix: 0,
          declaredPbm: 0,
        },
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('SESSION_NOT_FOUND');
    });

    it('should return 409 Conflict when declaring closure twice on same session', async () => {
      const sessionId = createSession('Operador Duplicado', 100.0);

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/financial/cash-closures',
        payload: {
          sessionId,
          operatorName: 'Operador Duplicado',
          declaredCash: 100,
          declaredCredit: 0,
          declaredDebit: 0,
          declaredPix: 0,
          declaredPbm: 0,
        },
      });
      expect(res1.statusCode).toBe(201);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/financial/cash-closures',
        payload: {
          sessionId,
          operatorName: 'Operador Duplicado',
          declaredCash: 100,
          declaredCredit: 0,
          declaredDebit: 0,
          declaredPix: 0,
          declaredPbm: 0,
        },
      });
      expect(res2.statusCode).toBe(409);
      const body = JSON.parse(res2.body);
      expect(['SESSION_ALREADY_CLOSED', 'CLOSURE_ALREADY_EXISTS']).toContain(body.error);
    });

    it('should return 409 Conflict when re-reviewing already reviewed closure', async () => {
      const sessionId = createSession('Operador Review', 100.0);

      const res = await app.inject({
        method: 'POST',
        url: '/api/financial/cash-closures',
        payload: {
          sessionId,
          operatorName: 'Operador Review',
          declaredCash: 100,
          declaredCredit: 0,
          declaredDebit: 0,
          declaredPix: 0,
          declaredPbm: 0,
        },
      });
      const closure = JSON.parse(res.body);

      // Review 1
      const rev1 = await app.inject({
        method: 'POST',
        url: `/api/financial/cash-closures/${closure.id}/review`,
        payload: { managerName: 'Gerente 1', approved: true },
      });
      expect(rev1.statusCode).toBe(200);

      // Review 2
      const rev2 = await app.inject({
        method: 'POST',
        url: `/api/financial/cash-closures/${closure.id}/review`,
        payload: { managerName: 'Gerente 2', approved: false },
      });
      expect(rev2.statusCode).toBe(409);
      const body = JSON.parse(rev2.body);
      expect(body.error).toBe('CLOSURE_ALREADY_REVIEWED');
    });
  });

  describe('TEF Reconciliation Endpoints (Canonical & Aliases)', () => {
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

    it('GET /api/financial/tef/forecast and alias /api/financial/reconciliation/forecast', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/financial/tef/forecast',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.totalGross).toBe(100.0);
      expect(body.totalNet).toBe(98.5);
      expect(body.totalTransactions).toBe(1);

      // Alias
      const aliasRes = await app.inject({
        method: 'GET',
        url: '/api/financial/reconciliation/forecast',
      });
      expect(aliasRes.statusCode).toBe(200);
    });

    it('POST /api/financial/tef/settle should settle transaction and prevent double settlement', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/financial/tef/settle',
        payload: {
          nsu: 'NSU_REC_1',
          settledAmount: 98.5,
          settledFee: 1.5,
          bankAccount: 'BANCO DO BRASIL',
        },
      });
      expect(res.statusCode).toBe(200);
      const tx = JSON.parse(res.body);
      expect(tx.settlementStatus).toBe('SETTLED');
      expect(tx.settledAmount).toBe(98.5);

      // Tentativa de liquidar novamente -> 409 Conflict
      const dupRes = await app.inject({
        method: 'POST',
        url: '/api/financial/tef/settle',
        payload: {
          nsu: 'NSU_REC_1',
          settledAmount: 98.5,
        },
      });
      expect(dupRes.statusCode).toBe(409);
      const body = JSON.parse(dupRes.body);
      expect(body.error).toBe('TRANSACTION_ALREADY_SETTLED');
    });

    it('POST /api/financial/tef/settle should return 404 for unknown NSU and 400 for invalid payload', async () => {
      const notFoundRes = await app.inject({
        method: 'POST',
        url: '/api/financial/tef/settle',
        payload: {
          nsu: 'INEXISTENTE_NSU',
          settledAmount: 50.0,
        },
      });
      expect(notFoundRes.statusCode).toBe(404);

      const invalidPayloadRes = await app.inject({
        method: 'POST',
        url: '/api/financial/tef/settle',
        payload: {
          nsu: '',
          settledAmount: -10,
        },
      });
      expect(invalidPayloadRes.statusCode).toBe(400);
    });

    it('GET /api/financial/tef/transactions and alias /api/financial/reconciliation/transactions', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/financial/tef/transactions',
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.transactions.length).toBe(1);
      expect(data.summary.pendingCount).toBe(1);
    });
  });

  describe('Financial Reports Endpoints (Canonical & Aliases)', () => {
    it('GET /api/financial/dre and alias /api/financial/reports/dre', async () => {
      const dreRes = await app.inject({
        method: 'GET',
        url: '/api/financial/dre?startDate=2026-11-01&endDate=2026-11-30',
      });
      expect(dreRes.statusCode).toBe(200);
      const dre = JSON.parse(dreRes.body);
      expect(dre.startDate).toBe('2026-11-01');
      expect(dre.endDate).toBe('2026-11-30');
      expect(dre.grossRevenue).toBeDefined();

      const aliasRes = await app.inject({
        method: 'GET',
        url: '/api/financial/reports/dre?startDate=2026-11-01&endDate=2026-11-30',
      });
      expect(aliasRes.statusCode).toBe(200);
    });

    it('GET /api/financial/abc-curve and alias /api/financial/reports/abc-curve', async () => {
      const abcRes = await app.inject({
        method: 'GET',
        url: '/api/financial/abc-curve?startDate=2026-11-01&endDate=2026-11-30',
      });
      expect(abcRes.statusCode).toBe(200);
      const abc = JSON.parse(abcRes.body);
      expect(abc.totalRevenue).toBeDefined();
      expect(abc.items).toBeInstanceOf(Array);
      expect(abc.categoriesSummary).toBeInstanceOf(Array);

      const aliasRes = await app.inject({
        method: 'GET',
        url: '/api/financial/reports/abc-curve?startDate=2026-11-01&endDate=2026-11-30',
      });
      expect(aliasRes.statusCode).toBe(200);
    });
  });
});
