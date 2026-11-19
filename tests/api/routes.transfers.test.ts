import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Transfer REST API Routes (/api/transfers/*)', () => {
  let app: FastifyInstance;
  let db: Database;
  let productId: number;
  let branchStoreId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();

    // Create test product
    const prodRes = db.prepare(`
      INSERT INTO products (name, ean, ncm, pmc, pf, control_type, active_ingredient, ms_registration, stripe, price, is_active)
      VALUES ('Dipirona 500mg', '7891111111111', '30049099', 15.0, 10.0, 'LIBERADO', 'Dipirona Sódica', '100000002', 'SEM_TARJA', 12.0, 1)
    `).run();
    productId = Number(prodRes.lastInsertRowid);

    // Create Branch 2 (same state SP)
    const branchRes = await app.inject({
      method: 'POST',
      url: '/api/stores',
      payload: {
        code: 'LJ02',
        name: 'FarmaCore Filial Campinas',
        companyName: 'FarmaCore Drogarias Ltda',
        cnpj: '12.345.678/0002-71',
        ie: '244.555.666.777',
        isHeadquarters: false,
        street: 'Av. Francisco Glicério',
        number: '1234',
        neighborhood: 'Centro',
        city: 'Campinas',
        state: 'SP',
        zipCode: '13012-000',
        ibgeCode: '3509502',
        taxRegime: 'SIMPLES_NACIONAL',
      },
    });
    branchStoreId = JSON.parse(branchRes.body).id;

    // Seed batch in Store 1 (Matriz)
    db.prepare(`
      INSERT INTO batches (store_id, product_id, batch_number, expiration_date, manufacturing_date, quantity, reserved_quantity)
      VALUES (1, ?, 'LOT-MATRIZ-01', '2028-06-30', '2024-01-01', 100, 0)
    `).run(productId);
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('POST /api/transfers', () => {
    it('should create a new transfer in DRAFT status and return 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          sourceStoreId: 1,
          targetStoreId: branchStoreId,
          requestedBy: 'Farmacêutico João',
          notes: 'Reposição semanal de estoque',
          items: [
            {
              productId,
              requestedQuantity: 20,
              unitCost: 10.0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const transfer = JSON.parse(res.body);
      expect(transfer.id).toBeGreaterThan(0);
      expect(transfer.transferNumber).toMatch(/^TRF-\d{8}-\d{4}$/);
      expect(transfer.status).toBe('DRAFT');
      expect(transfer.sourceStoreId).toBe(1);
      expect(transfer.targetStoreId).toBe(branchStoreId);
      expect(transfer.cfop).toBe('5152'); // Internal state SP -> SP
      expect(transfer.items.length).toBe(1);
      expect(transfer.items[0].productId).toBe(productId);
      expect(transfer.items[0].requestedQuantity).toBe(20);
    });

    it('should reject creation when source and target stores are identical (400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          sourceStoreId: 1,
          targetStoreId: 1,
          requestedBy: 'Farmacêutico João',
          items: [{ productId, requestedQuantity: 10 }],
        },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.message || data.error).toContain('diferente');
    });

    it('should return 400 when required fields or items are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          sourceStoreId: 1,
          targetStoreId: branchStoreId,
          // missing requestedBy and items
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/transfers and GET /api/transfers/:id', () => {
    it('should list transfers with pagination and total count', async () => {
      // Create transfer
      await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          sourceStoreId: 1,
          targetStoreId: branchStoreId,
          requestedBy: 'Operador 1',
          items: [{ productId, requestedQuantity: 5 }],
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/transfers',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.transfers).toBeDefined();
      expect(data.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(data.transfers)).toBe(true);
    });

    it('should get transfer by ID including store details and items', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          sourceStoreId: 1,
          targetStoreId: branchStoreId,
          requestedBy: 'Operador 1',
          items: [{ productId, requestedQuantity: 5 }],
        },
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'GET',
        url: `/api/transfers/${created.id}`,
      });

      expect(res.statusCode).toBe(200);
      const transfer = JSON.parse(res.body);
      expect(transfer.id).toBe(created.id);
      expect(transfer.sourceStore).toBeDefined();
      expect(transfer.targetStore).toBeDefined();
      expect(transfer.items.length).toBe(1);
    });

    it('should return 404 for non-existent transfer ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/transfers/99999',
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/transfers/:id/dispatch', () => {
    it('should dispatch transfer, deduct stock by FEFO, and set status to IN_TRANSIT', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          sourceStoreId: 1,
          targetStoreId: branchStoreId,
          requestedBy: 'Solicitante',
          items: [{ productId, requestedQuantity: 25 }],
        },
      });
      const transferId = JSON.parse(createRes.body).id;

      const dispatchRes = await app.inject({
        method: 'POST',
        url: `/api/transfers/${transferId}/dispatch`,
        payload: {
          dispatchedBy: 'Expedidor Carlos',
          carrierName: 'Transportadora Rápida Ltda',
          trackingCode: 'TRK-987654',
        },
      });

      expect(dispatchRes.statusCode).toBe(200);
      const dispatched = JSON.parse(dispatchRes.body);
      expect(dispatched.status).toBe('IN_TRANSIT');
      expect(dispatched.dispatchedBy).toBe('Expedidor Carlos');
      expect(dispatched.carrierName).toBe('Transportadora Rápida Ltda');
      expect(dispatched.trackingCode).toBe('TRK-987654');

      // Verify stock deducted in store 1 (was 100, now 75)
      const batch = db.prepare('SELECT quantity FROM batches WHERE store_id = 1 AND product_id = ?').get(productId) as { quantity: number };
      expect(batch.quantity).toBe(75);
    });

    it('should return 400 when stock in source store is insufficient', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          sourceStoreId: 1,
          targetStoreId: branchStoreId,
          requestedBy: 'Solicitante',
          items: [{ productId, requestedQuantity: 9999 }], // More than 100 available
        },
      });
      const transferId = JSON.parse(createRes.body).id;

      const dispatchRes = await app.inject({
        method: 'POST',
        url: `/api/transfers/${transferId}/dispatch`,
        payload: {
          dispatchedBy: 'Expedidor Carlos',
        },
      });

      expect(dispatchRes.statusCode).toBe(400);
      const data = JSON.parse(dispatchRes.body);
      expect(data.message || data.error).toContain('insuficiente');
    });

    it('should return 404 when transfer does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/transfers/9999/dispatch',
        payload: {
          dispatchedBy: 'Expedidor Carlos',
        },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/transfers/:id/receive', () => {
    it('should receive transfer at target store, add batches, and set status to RECEIVED', async () => {
      // 1. Create
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          sourceStoreId: 1,
          targetStoreId: branchStoreId,
          requestedBy: 'Solicitante',
          items: [{ productId, requestedQuantity: 30 }],
        },
      });
      const transferId = JSON.parse(createRes.body).id;

      // 2. Dispatch
      await app.inject({
        method: 'POST',
        url: `/api/transfers/${transferId}/dispatch`,
        payload: { dispatchedBy: 'Expedidor Carlos' },
      });

      // 3. Receive
      const receiveRes = await app.inject({
        method: 'POST',
        url: `/api/transfers/${transferId}/receive`,
        payload: {
          receivedBy: 'Conferente Marcos',
        },
      });

      expect(receiveRes.statusCode).toBe(200);
      const received = JSON.parse(receiveRes.body);
      expect(received.status).toBe('RECEIVED');
      expect(received.receivedBy).toBe('Conferente Marcos');

      // Verify batch created/incremented in target store (branchStoreId)
      const targetBatch = db
        .prepare('SELECT quantity FROM batches WHERE store_id = ? AND product_id = ?')
        .get(branchStoreId, productId) as { quantity: number };
      expect(targetBatch).toBeDefined();
      expect(targetBatch.quantity).toBe(30);
    });

    it('should reject receiving a transfer that is not IN_TRANSIT (400)', async () => {
      // Create transfer in DRAFT
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          sourceStoreId: 1,
          targetStoreId: branchStoreId,
          requestedBy: 'Solicitante',
          items: [{ productId, requestedQuantity: 10 }],
        },
      });
      const transferId = JSON.parse(createRes.body).id;

      // Try to receive DRAFT directly
      const receiveRes = await app.inject({
        method: 'POST',
        url: `/api/transfers/${transferId}/receive`,
        payload: {
          receivedBy: 'Conferente Marcos',
        },
      });

      expect(receiveRes.statusCode).toBe(400);
    });
  });

  describe('POST /api/transfers/:id/cancel', () => {
    it('should cancel transfer in transit and rollback stock to source store', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          sourceStoreId: 1,
          targetStoreId: branchStoreId,
          requestedBy: 'Solicitante',
          items: [{ productId, requestedQuantity: 40 }],
        },
      });
      const transferId = JSON.parse(createRes.body).id;

      // Dispatch: stock in store 1 goes from 100 to 60
      await app.inject({
        method: 'POST',
        url: `/api/transfers/${transferId}/dispatch`,
        payload: { dispatchedBy: 'Expedidor Carlos' },
      });

      let batch = db.prepare('SELECT quantity FROM batches WHERE store_id = 1 AND product_id = ?').get(productId) as { quantity: number };
      expect(batch.quantity).toBe(60);

      // Cancel transfer
      const cancelRes = await app.inject({
        method: 'POST',
        url: `/api/transfers/${transferId}/cancel`,
        payload: {
          reason: 'Avaria no caminhão de entrega',
        },
      });

      expect(cancelRes.statusCode).toBe(200);
      const cancelled = JSON.parse(cancelRes.body);
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.notes).toContain('Avaria no caminhão');

      // Stock in store 1 restored back to 100
      batch = db.prepare('SELECT quantity FROM batches WHERE store_id = 1 AND product_id = ?').get(productId) as { quantity: number };
      expect(batch.quantity).toBe(100);
    });
  });

  describe('GET /api/transfers/:id/slip', () => {
    it('should generate formatted transfer slip with textSlip and fullEscPos', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          sourceStoreId: 1,
          targetStoreId: branchStoreId,
          requestedBy: 'Solicitante',
          items: [{ productId, requestedQuantity: 15, unitCost: 10.0 }],
        },
      });
      const transferId = JSON.parse(createRes.body).id;

      const slipRes = await app.inject({
        method: 'GET',
        url: `/api/transfers/${transferId}/slip`,
      });

      expect(slipRes.statusCode).toBe(200);
      const slip = JSON.parse(slipRes.body);
      expect(slip.textSlip).toBeDefined();
      expect(slip.textSlip).toContain('ROMANEIO DE TRANSFERÊNCIA');
      expect(slip.textSlip).toContain('FarmaCore Matriz Centro');
      expect(slip.textSlip).toContain('FarmaCore Filial Campinas');
      expect(slip.fullEscPos).toBeDefined();
    });

    it('should return 404 for non-existent transfer slip', async () => {
      const slipRes = await app.inject({
        method: 'GET',
        url: '/api/transfers/9999/slip',
      });

      expect(slipRes.statusCode).toBe(404);
    });
  });

  describe('POST /api/transfers/:id/emit-nfe', () => {
    it('should emit transfer NF-e Mod. 55 when transfer is IN_TRANSIT', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          sourceStoreId: 1,
          targetStoreId: branchStoreId,
          requestedBy: 'Solicitante',
          items: [{ productId, requestedQuantity: 10, unitCost: 10.0 }],
        },
      });
      const transferId = JSON.parse(createRes.body).id;

      // Dispatch first so it is IN_TRANSIT
      await app.inject({
        method: 'POST',
        url: `/api/transfers/${transferId}/dispatch`,
        payload: { dispatchedBy: 'Expedidor Carlos' },
      });

      const nfeRes = await app.inject({
        method: 'POST',
        url: `/api/transfers/${transferId}/emit-nfe`,
      });

      expect(nfeRes.statusCode).toBe(200);
      const nfe = JSON.parse(nfeRes.body);
      expect(nfe.transferId).toBe(transferId);
      expect(nfe.status).toBe('AUTORIZADA');
      expect(nfe.nfeKey).toBeDefined();
      expect(nfe.nfeKey.length).toBe(44);
      expect(nfe.protocol).toBeDefined();
      expect(nfe.cfop).toBe('5152');
      expect(nfe.xml).toContain('<infNFe');
    });

    it('should reject emitting NF-e for transfer in DRAFT status (400)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          sourceStoreId: 1,
          targetStoreId: branchStoreId,
          requestedBy: 'Solicitante',
          items: [{ productId, requestedQuantity: 10 }],
        },
      });
      const transferId = JSON.parse(createRes.body).id;

      const nfeRes = await app.inject({
        method: 'POST',
        url: `/api/transfers/${transferId}/emit-nfe`,
      });

      expect(nfeRes.statusCode).toBe(400);
      const data = JSON.parse(nfeRes.body);
      expect(data.message || data.error).toContain('status');
    });
  });
});
