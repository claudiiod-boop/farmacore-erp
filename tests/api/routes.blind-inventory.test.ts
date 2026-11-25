import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerBlindInventoryRoutes } from '../../src/modules/inventory-audit/blind-inventory.routes';

describe('Blind Inventory & Patrimonial Balance REST API Routes', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj) VALUES (1, 'Farma Matriz', '11.111.111/0001-11')
    `).run();

    db.prepare(`
      INSERT INTO products (
        id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price
      ) VALUES (
        1, '7891234567890', 'Amoxicilina 500mg', 'Amoxicilina', '1.0000.0000', 'VERMELHA', 'ANTIMICROBIANO', 25.0, 15.0, 20.0
      ), (
        2, '7899876543210', 'Morfina 10mg', 'Morfina', '1.0000.0001', 'PRETA', 'PORTARIA_344', 80.0, 50.0, 70.0
      )
    `).run();

    db.prepare(`
      INSERT INTO batches (
        id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
      ) VALUES (
        1, 1, 'LOTE-AMOX', '2026-01-01', '2027-01-01', 30, 0
      ), (
        2, 2, 'LOTE-MORF', '2026-01-01', '2027-01-01', 10, 0
      )
    `).run();

    app = fastify();
    registerBlindInventoryRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('POST /api/v1/blind-inventory/sessions - cria sessão com sucesso', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/blind-inventory/sessions',
      payload: {
        store_id: 1,
        type: 'GERAL_PATRIMONIAL'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.code).toMatch(/^INV-202611-\d{4}$/);
    expect(body.data.status).toBe('COUNTING');
  });

  it('POST /api/v1/blind-inventory/sessions/:id/count - registra contagem cega de item', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/blind-inventory/sessions',
      payload: { store_id: 1, type: 'GERAL_PATRIMONIAL' }
    });
    const invId = JSON.parse(createRes.payload).data.id;

    const countRes = await app.inject({
      method: 'POST',
      url: `/api/v1/blind-inventory/sessions/${invId}/count`,
      payload: {
        product_id: 1,
        batch_id: 1,
        counted_quantity: 28
      }
    });

    expect(countRes.statusCode).toBe(200);
    const body = JSON.parse(countRes.payload);
    expect(body.success).toBe(true);
    expect(body.data.counted_quantity).toBe(28);
  });

  it('POST /api/v1/blind-inventory/sessions/:id/reconcile e aprovação de controlado com trava sanitária', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/blind-inventory/sessions',
      payload: { store_id: 1, type: 'CONTROLADOS_SNGPC' }
    });
    const invId = JSON.parse(createRes.payload).data.id;

    // Conta Morfina (tem 10, contou 9)
    await app.inject({
      method: 'POST',
      url: `/api/v1/blind-inventory/sessions/${invId}/count`,
      payload: { product_id: 2, batch_id: 2, counted_quantity: 9 }
    });

    // Reconcilia
    const recRes = await app.inject({
      method: 'POST',
      url: `/api/v1/blind-inventory/sessions/${invId}/reconcile`
    });
    expect(recRes.statusCode).toBe(200);
    const recBody = JSON.parse(recRes.payload);
    expect(recBody.data.status).toBe('AUDITING');
    const morfItem = recBody.data.items.find((i: any) => i.product_id === 2);
    expect(morfItem.requires_pharmacist_approval).toBe(1);

    // Tentativa de finalizar sem aprovação deve receber 422 Bloqueio Sanitário
    const failFinalize = await app.inject({
      method: 'POST',
      url: `/api/v1/blind-inventory/sessions/${invId}/finalize`
    });
    expect(failFinalize.statusCode).toBe(422);

    // Aprova formalmente
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/blind-inventory/items/${morfItem.id}/approve-controlled`,
      payload: {
        pharmacist_crf: 'CRF-SP 99.888',
        justification: 'Avaria constatada em inspeção e registrada em livro SNGPC'
      }
    });
    expect(approveRes.statusCode).toBe(200);

    // Agora finaliza com sucesso
    const finRes = await app.inject({
      method: 'POST',
      url: `/api/v1/blind-inventory/sessions/${invId}/finalize`
    });
    expect(finRes.statusCode).toBe(200);
    const finBody = JSON.parse(finRes.payload);
    expect(finBody.data.inventory.status).toBe('FINALIZED');
    expect(finBody.data.adjustments).toHaveLength(1);
  });

  it('GET /api/v1/blind-inventory/kpis - retorna indicadores de acurácia', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/blind-inventory/kpis?store_id=1'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.accuracy_rate_percent).toBeDefined();
  });
});
