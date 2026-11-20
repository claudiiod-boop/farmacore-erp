import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Inventory REST API Routes (/api/inventory/*)', () => {
  let app: FastifyInstance;
  let db: Database;
  let normalProductId: number;
  let controlledProductId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();

    // Normal Product
    const p1 = db.prepare(`
      INSERT INTO products (name, ean, ncm, pmc, pf, control_type, active_ingredient, ms_registration, stripe, price, is_active)
      VALUES ('Dipirona 500mg', '7891000000010', '30049099', 15.0, 10.0, 'LIBERADO', 'Dipirona', '100000001', 'SEM_TARJA', 12.0, 1)
    `).run();
    normalProductId = Number(p1.lastInsertRowid);

    // Controlled Product
    const p2 = db.prepare(`
      INSERT INTO products (name, ean, ncm, pmc, pf, control_type, active_ingredient, ms_registration, stripe, price, is_active)
      VALUES ('Clonazepam 2mg', '7891000000027', '30049099', 35.0, 25.0, 'B1', 'Clonazepam', '100000002', 'TARJA_PRETA', 30.0, 1)
    `).run();
    controlledProductId = Number(p2.lastInsertRowid);

    // Batch for normal product (store 1)
    db.prepare(`
      INSERT INTO batches (store_id, product_id, batch_number, expiration_date, manufacturing_date, quantity, reserved_quantity)
      VALUES (1, ?, 'LOT-DIPI-01', '2028-12-31', '2024-01-01', 50, 0)
    `).run(normalProductId);

    // Batch for controlled product (store 1)
    db.prepare(`
      INSERT INTO batches (store_id, product_id, batch_number, expiration_date, manufacturing_date, quantity, reserved_quantity)
      VALUES (1, ?, 'LOT-CLONA-01', '2027-06-30', '2024-01-01', 20, 0)
    `).run(controlledProductId);
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('POST /api/inventory/sessions - creates a session (201), validates input (400) and prevents duplicates (409)', async () => {
    // 1. Validation failure: missing openedBy
    const badRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/sessions',
      payload: {
        storeId: 1,
        inventoryType: 'GERAL',
      },
    });
    expect(badRes.statusCode).toBe(400);

    // 2. Successful creation
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/inventory/sessions',
      payload: {
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador Carlos',
        notes: 'Balanço geral de rotina',
      },
    });
    expect(res1.statusCode).toBe(201);
    const body1 = JSON.parse(res1.body);
    expect(body1).toHaveProperty('id');
    expect(body1.sessionCode).toMatch(/^INV-\d{8}-\d{4}$/);
    expect(body1.status).toBe('OPEN');
    expect(body1.items).toBeDefined();

    // 3. Duplicate open session for same store & type (409 Conflict)
    const dupRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/sessions',
      payload: {
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador Carlos',
      },
    });
    expect(dupRes.statusCode).toBe(409);
    const dupBody = JSON.parse(dupRes.body);
    expect(dupBody.error).toBe('INVENTORY_SESSION_CONFLICT');
  });

  it('GET /api/inventory/sessions & GET /api/inventory/sessions/:id - lists and retrieves sessions', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/sessions',
      payload: {
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador Carlos',
      },
    });
    const created = JSON.parse(createRes.body);

    // List sessions
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/inventory/sessions?storeId=1&status=OPEN',
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    expect(listBody.total).toBe(1);
    expect(listBody.sessions[0].id).toBe(created.id);

    // Get session by ID
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/sessions/${created.id}`,
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.id).toBe(created.id);
    expect(getBody.sessionCode).toBe(created.sessionCode);

    // Get non-existent session
    const notFoundRes = await app.inject({
      method: 'GET',
      url: '/api/inventory/sessions/99999',
    });
    expect(notFoundRes.statusCode).toBe(404);
  });

  it('POST /api/inventory/sessions/:id/count & PUT /api/inventory/sessions/:id/items/:itemId/recount - records count and recount', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/sessions',
      payload: {
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador Carlos',
      },
    });
    const session = JSON.parse(createRes.body);

    // 1. Invalid count: no product or ean
    const invalidCount = await app.inject({
      method: 'POST',
      url: `/api/inventory/sessions/${session.id}/count`,
      payload: {
        batchNumber: 'LOT-DIPI-01',
        expirationDate: '2028-12-31',
        quantity: 10,
      },
    });
    expect(invalidCount.statusCode).toBe(400);

    // 2. Add valid count
    const countRes = await app.inject({
      method: 'POST',
      url: `/api/inventory/sessions/${session.id}/count`,
      payload: {
        productId: normalProductId,
        batchNumber: 'LOT-DIPI-01',
        expirationDate: '2028-12-31',
        quantity: 48, // 2 shortage
      },
    });
    expect(countRes.statusCode).toBe(200);
    const item = JSON.parse(countRes.body);
    expect(item.countedQuantity).toBe(48);

    // 3. Recount item
    const recountRes = await app.inject({
      method: 'PUT',
      url: `/api/inventory/sessions/${session.id}/items/${item.id}/recount`,
      payload: {
        recountQuantity: 49,
      },
    });
    expect(recountRes.statusCode).toBe(200);
    const recountedItem = JSON.parse(recountRes.body);
    expect(recountedItem.countedQuantity).toBe(49);
    expect(recountedItem.recountQuantity).toBe(49);
  });

  it('POST /api/inventory/sessions/:id/finish-count & POST /api/inventory/sessions/:id/apply - lifecycle and CRF validation', async () => {
    // Create CONTROLADOS_SNGPC session
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/sessions',
      payload: {
        storeId: 1,
        inventoryType: 'CONTROLADOS_SNGPC',
        openedBy: 'Operador Carlos',
      },
    });
    const session = JSON.parse(createRes.body);

    // Count with divergence (expected 20, counted 18 -> shortage of 2)
    await app.inject({
      method: 'POST',
      url: `/api/inventory/sessions/${session.id}/count`,
      payload: {
        productId: controlledProductId,
        batchNumber: 'LOT-CLONA-01',
        expirationDate: '2027-06-30',
        quantity: 18,
      },
    });

    // Finish counting (OPEN -> COUNTED)
    const finishRes = await app.inject({
      method: 'POST',
      url: `/api/inventory/sessions/${session.id}/finish-count`,
    });
    expect(finishRes.statusCode).toBe(200);
    const finishedSession = JSON.parse(finishRes.body);
    expect(finishedSession.status).toBe('COUNTED');

    // Try to apply without CRF -> should fail (400) because controlled item has divergence
    const applyWithoutCrf = await app.inject({
      method: 'POST',
      url: `/api/inventory/sessions/${session.id}/apply`,
      payload: {
        appliedBy: 'Dra. Beatriz Farmacêutica',
      },
    });
    expect(applyWithoutCrf.statusCode).toBe(400);

    // Apply with CRF -> should succeed (200)
    const itemId = finishedSession.items[0].id;
    const applyWithCrf = await app.inject({
      method: 'POST',
      url: `/api/inventory/sessions/${session.id}/apply`,
      payload: {
        appliedBy: 'Dra. Beatriz Farmacêutica',
        responsiblePharmacistCrf: '54321',
        responsiblePharmacistUf: 'SP',
        itemReasons: {
          [itemId]: {
            reason: 'AVARIA',
            notes: '2 caixas danificadas',
          },
        },
      },
    });
    expect(applyWithCrf.statusCode).toBe(200);
    const appliedSession = JSON.parse(applyWithCrf.body);
    expect(appliedSession.status).toBe('APPLIED');
    expect(appliedSession.responsiblePharmacistCrf).toBe('54321');
  });

  it('POST /api/inventory/sessions/:id/cancel - cancels an open session', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/sessions',
      payload: {
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador Carlos',
      },
    });
    const session = JSON.parse(createRes.body);

    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/inventory/sessions/${session.id}/cancel`,
      payload: {
        reason: 'Erro de agendamento',
      },
    });
    expect(cancelRes.statusCode).toBe(200);
    const cancelled = JSON.parse(cancelRes.body);
    expect(cancelled.status).toBe('CANCELLED');

    // Cannot cancel again
    const cancelAgain = await app.inject({
      method: 'POST',
      url: `/api/inventory/sessions/${session.id}/cancel`,
      payload: {
        reason: 'Tentativa redundante',
      },
    });
    expect(cancelAgain.statusCode).toBe(400);
  });

  it('GET /api/inventory/sessions/:id/report - returns report with textSlip and fullEscPos', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/inventory/sessions',
      payload: {
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador Carlos',
      },
    });
    const session = JSON.parse(createRes.body);

    const reportRes = await app.inject({
      method: 'GET',
      url: `/api/inventory/sessions/${session.id}/report`,
    });
    expect(reportRes.statusCode).toBe(200);
    const report = JSON.parse(reportRes.body);
    expect(report).toHaveProperty('textSlip');
    expect(report).toHaveProperty('fullEscPos');
    expect(report).toHaveProperty('session');
    expect(report).toHaveProperty('store');
    expect(report.textSlip).toContain('FARMACORE ERP - TERMO DE BALANÇO E AUDITORIA DE ESTOQUE');

    // 404 for non-existent session
    const notFoundRes = await app.inject({
      method: 'GET',
      url: '/api/inventory/sessions/99999/report',
    });
    expect(notFoundRes.statusCode).toBe(404);
  });
});
