import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { Database, getDatabase } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify POS Routes (Movements, Session Summary & Hybrid Checkout)', () => {
  let app: FastifyInstance;
  let db: Database;

  let sessionId: number;
  let otcProductId: number;
  let otcBatchId: number;
  let controlledProductId: number;
  let controlledBatchId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);
    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();

    // 1. Create OTC Product (Dipirona 500mg, R$ 15.00)
    const p1Res = await app.inject({
      method: 'POST',
      url: '/api/products',
      payload: {
        ean: '7891234560001',
        name: 'Dipirona 500mg Gotas',
        activeIngredient: 'Dipirona Sódica',
        msRegistration: '100000000050',
        stripe: 'SEM_TARJA',
        controlType: 'ISENTO',
        pmc: 20.0,
        pf: 12.0,
        price: 15.0,
      },
    });
    otcProductId = JSON.parse(p1Res.body).id;

    const b1Res = await app.inject({
      method: 'POST',
      url: '/api/batches',
      payload: {
        productId: otcProductId,
        batchNumber: 'LOTE-OTC-01',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 50,
      },
    });
    otcBatchId = JSON.parse(b1Res.body).id;

    // 2. Create Controlled Product (Rivotril 2mg, R$ 35.00 - Tarja Preta B1)
    const p2Res = await app.inject({
      method: 'POST',
      url: '/api/products',
      payload: {
        ean: '7891234560002',
        name: 'Rivotril 2mg 30 Comprimidos',
        activeIngredient: 'Clonazepam',
        msRegistration: '100000000051',
        stripe: 'PRETA',
        controlType: 'B1',
        pmc: 45.0,
        pf: 28.0,
        price: 35.0,
      },
    });
    controlledProductId = JSON.parse(p2Res.body).id;

    const b2Res = await app.inject({
      method: 'POST',
      url: '/api/batches',
      payload: {
        productId: controlledProductId,
        batchNumber: 'LOTE-RIV-01',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 30,
      },
    });
    controlledBatchId = JSON.parse(b2Res.body).id;

    // 3. Open Cash Session with R$ 100.00 initial drawer cash
    const sessRes = await app.inject({
      method: 'POST',
      url: '/api/pos/sessions',
      payload: {
        operatorName: 'Operador Caixa 1',
        initialCash: 100.0,
      },
    });
    sessionId = JSON.parse(sessRes.body).id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Cash Movements Endpoints', () => {
    it('should register SUPPLY movement (POST /api/pos/sessions/:id/movements)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/pos/sessions/${sessionId}/movements`,
        payload: {
          type: 'SUPPLY',
          amount: 50.0,
          reason: 'Troco inicial suplementar',
          operatorName: 'Operador Caixa 1',
        },
      });

      expect(res.statusCode).toBe(201);
      const movement = JSON.parse(res.body);
      expect(movement.id).toBeDefined();
      expect(movement.cashSessionId).toBe(sessionId);
      expect(movement.type).toBe('SUPPLY');
      expect(movement.amount).toBe(50.0);
      expect(movement.reason).toBe('Troco inicial suplementar');
      expect(movement.operatorName).toBe('Operador Caixa 1');

      // Check current session balance
      const currentRes = await app.inject({
        method: 'GET',
        url: '/api/pos/sessions/current',
      });
      const currentSession = JSON.parse(currentRes.body);
      expect(currentSession.currentCash).toBe(150.0);
    });

    it('should register SANGRIA movement (POST /api/pos/sessions/:id/movements)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/pos/sessions/${sessionId}/movements`,
        payload: {
          type: 'SANGRIA',
          amount: 40.0,
          reason: 'Recolhimento para o cofre',
          operatorName: 'Operador Caixa 1',
        },
      });

      expect(res.statusCode).toBe(201);
      const movement = JSON.parse(res.body);
      expect(movement.type).toBe('SANGRIA');
      expect(movement.amount).toBe(40.0);

      // Check current session balance: 100 - 40 = 60
      const currentRes = await app.inject({
        method: 'GET',
        url: '/api/pos/sessions/current',
      });
      const currentSession = JSON.parse(currentRes.body);
      expect(currentSession.currentCash).toBe(60.0);
    });

    it('should reject SANGRIA if amount exceeds drawer balance (INSUFFICIENT_DRAWER_CASH)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/pos/sessions/${sessionId}/movements`,
        payload: {
          type: 'SANGRIA',
          amount: 150.0, // initial is 100.0
          reason: 'Sangria excessiva',
          operatorName: 'Operador Caixa 1',
        },
      });

      expect(res.statusCode).toBe(400);
      const error = JSON.parse(res.body);
      expect(error.error).toBe('INSUFFICIENT_DRAWER_CASH');
    });

    it('should reject movement on closed session (SESSION_NOT_OPEN)', async () => {
      // Close session
      await app.inject({
        method: 'POST',
        url: `/api/pos/sessions/${sessionId}/close`,
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/pos/sessions/${sessionId}/movements`,
        payload: {
          type: 'SUPPLY',
          amount: 20.0,
          reason: 'Aporte tardio',
          operatorName: 'Operador Caixa 1',
        },
      });

      expect(res.statusCode).toBe(400);
      const error = JSON.parse(res.body);
      expect(error.error).toBe('SESSION_NOT_OPEN');
    });

    it('should list all movements for a session (GET /api/pos/sessions/:id/movements)', async () => {
      // Register 1 supply and 1 sangria
      await app.inject({
        method: 'POST',
        url: `/api/pos/sessions/${sessionId}/movements`,
        payload: {
          type: 'SUPPLY',
          amount: 30.0,
          reason: 'Suprimento 1',
          operatorName: 'Operador Caixa 1',
        },
      });

      await app.inject({
        method: 'POST',
        url: `/api/pos/sessions/${sessionId}/movements`,
        payload: {
          type: 'SANGRIA',
          amount: 15.0,
          reason: 'Sangria 1',
          operatorName: 'Operador Caixa 1',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/pos/sessions/${sessionId}/movements`,
      });

      expect(res.statusCode).toBe(200);
      const list = JSON.parse(res.body);
      expect(Array.isArray(list)).toBe(true);
      expect(list).toHaveLength(2);
      expect(list[0].type).toBe('SUPPLY');
      expect(list[1].type).toBe('SANGRIA');
    });
  });

  describe('Session Summary Endpoint (GET /api/pos/sessions/:id/summary)', () => {
    it('should return session summary while keeping session OPEN', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/pos/sessions/${sessionId}/summary`,
      });

      expect(res.statusCode).toBe(200);
      const summary = JSON.parse(res.body);
      expect(summary.session.id).toBe(sessionId);
      expect(summary.session.status).toBe('OPEN');
      expect(summary.totalSalesCount).toBe(0);
      expect(summary.totalSalesAmount).toBe(0);
      expect(summary.expectedCash).toBe(100.0);
    });

    it('should return 400 SESSION_NOT_OPEN if session is not open', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/pos/sessions/99999/summary',
      });

      expect(res.statusCode).toBe(400);
      const error = JSON.parse(res.body);
      expect(error.error).toBe('SESSION_NOT_OPEN');
    });
  });

  describe('Unified Hybrid Checkout Endpoint (POST /api/pos/checkout)', () => {
    it('should checkout direct convenience items (OTC) without pre-sale and return receiptText', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pos/checkout',
        payload: {
          cashSessionId: sessionId,
          additionalItems: [
            { productId: otcProductId, batchId: otcBatchId, quantity: 2 }, // 2 x 15 = 30.0
          ],
          payments: [{ method: 'PIX', amount: 30.0 }],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.sale).toBeDefined();
      expect(body.sale.sale.totalAmount).toBe(30.0);
      expect(body.sale.items).toHaveLength(1);
      expect(body.sale.items[0].productName).toBe('Dipirona 500mg Gotas');
      expect(body.receiptText).toContain('FARMACORE DROGARIA & FARMACIA');
      expect(body.receiptText).toContain('Dipirona 500mg Gotas');
      expect(body.receiptText).toContain('PIX');
    });

    it('should block direct sale of controlled substance with 400 CONTROLLED_DRUG_DIRECT_SALE_FORBIDDEN', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pos/checkout',
        payload: {
          cashSessionId: sessionId,
          additionalItems: [
            { productId: controlledProductId, batchId: controlledBatchId, quantity: 1 },
          ],
          payments: [{ method: 'DINHEIRO', amount: 35.0 }],
        },
      });

      expect(res.statusCode).toBe(400);
      const error = JSON.parse(res.body);
      expect(error.error).toBe('CONTROLLED_DRUG_DIRECT_SALE_FORBIDDEN');
      expect(error.message).toBe(
        'Venda direta no caixa é permitida apenas para produtos isentos de retenção de receita.'
      );
    });

    it('should checkout hybrid combination (pre-sale + additional OTC items)', async () => {
      // 1. Create pre-sale at counter (1 x Dipirona = 15.0)
      const pvRes = await app.inject({
        method: 'POST',
        url: '/api/pre-sales',
        payload: {
          customerName: 'Cliente Balcao',
          items: [{ productId: otcProductId, batchId: otcBatchId, quantity: 1 }],
        },
      });
      const pv = JSON.parse(pvRes.body);

      // 2. Hybrid Checkout: pre-sale (15.0) + direct item (15.0) = 30.0. Pay 50.0 cash, change 20.0
      const checkoutRes = await app.inject({
        method: 'POST',
        url: '/api/pos/checkout',
        payload: {
          cashSessionId: sessionId,
          preSaleCode: pv.code,
          additionalItems: [
            { productId: otcProductId, batchId: otcBatchId, quantity: 1 },
          ],
          payments: [{ method: 'DINHEIRO', amount: 50.0 }],
        },
      });

      expect(checkoutRes.statusCode).toBe(200);
      const data = JSON.parse(checkoutRes.body);
      expect(data.sale.sale.totalAmount).toBe(30.0);
      expect(data.sale.sale.changeAmount).toBe(20.0);
      expect(data.sale.items).toHaveLength(2);
      expect(data.receiptText).toContain(`PRE-VENDA: ${pv.code}`);
      expect(data.receiptText).toContain('TROCO R$');
    });

    it('should return 400 EMPTY_CHECKOUT when neither preSaleCode nor additionalItems provided', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pos/checkout',
        payload: {
          cashSessionId: sessionId,
          payments: [{ method: 'DINHEIRO', amount: 10.0 }],
        },
      });

      expect(res.statusCode).toBe(400);
      const error = JSON.parse(res.body);
      expect(error.error).toBe('EMPTY_CHECKOUT');
    });

    it('should return 400 INSUFFICIENT_PAYMENT when payment is less than total', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pos/checkout',
        payload: {
          cashSessionId: sessionId,
          additionalItems: [
            { productId: otcProductId, batchId: otcBatchId, quantity: 1 }, // 15.0
          ],
          payments: [{ method: 'DINHEIRO', amount: 10.0 }],
        },
      });

      expect(res.statusCode).toBe(400);
      const error = JSON.parse(res.body);
      expect(error.error).toBe('INSUFFICIENT_PAYMENT');
    });

    it('should return 400 EXCESS_NON_CASH_PAYMENT when non-cash generates change', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pos/checkout',
        payload: {
          cashSessionId: sessionId,
          additionalItems: [
            { productId: otcProductId, batchId: otcBatchId, quantity: 1 }, // 15.0
          ],
          payments: [{ method: 'PIX', amount: 20.0 }],
        },
      });

      expect(res.statusCode).toBe(400);
      const error = JSON.parse(res.body);
      expect(error.error).toBe('EXCESS_NON_CASH_PAYMENT');
    });
  });
});
