import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Reposição Inteligente de Estoque & Ponto de Pedido (Fase 31)', () => {
  let app: FastifyInstance;
  let db: Database;
  let storeId: number;
  let prodId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    // Criar produto de teste
    const pRes = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, category)
      VALUES ('Losartana 50mg 30 comp', '7891234999777', 'Losartana', '1004300055', 'VERMELHA', 'NONE', 22.0, 7.0, 14.0, 'GENERICO')
    `).run();
    prodId = Number(pRes.lastInsertRowid);

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. GET /api/replenishment/suggestions deve retornar itens com risco de ruptura ou reposição', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/replenishment/suggestions?storeId=${storeId}&days=30`,
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].status).toBe('OUT_OF_STOCK');
  });

  it('2. GET /api/replenishment/analysis/:productId deve retornar análise detalhada', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/replenishment/analysis/${prodId}?storeId=${storeId}`,
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.productId).toBe(prodId);
    expect(data.productName).toContain('Losartana');
    expect(data.currentStock).toBe(0);
    expect(data.reorderPoint).toBeGreaterThanOrEqual(0);
  });

  it('3. POST /api/replenishment/orders, GET /api/replenishment/orders/:id e PATCH status', async () => {
    // 1. Criar pedido
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/replenishment/orders',
      payload: {
        storeId,
        distributorName: 'Distribuidora Panpharma',
        notes: 'Pedido Semanal',
        items: [
          {
            productId: prodId,
            orderQuantity: 40,
            unitCost: 7.0,
            suggestedQuantity: 40,
            currentStock: 0,
            reorderPoint: 10,
          },
        ],
      },
    });

    expect(postRes.statusCode).toBe(201);
    const order = JSON.parse(postRes.body);
    expect(order.id).toBeDefined();
    expect(order.status).toBe('DRAFT');
    expect(order.total_items).toBe(1);
    expect(order.estimated_total).toBe(280.0);

    // 2. Detalhes
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/replenishment/orders/${order.id}`,
    });
    expect(getRes.statusCode).toBe(200);
    const orderDetails = JSON.parse(getRes.body);
    expect(orderDetails.items.length).toBe(1);

    // 3. Atualizar status
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/replenishment/orders/${order.id}/status`,
      payload: { status: 'SUBMITTED' },
    });
    expect(patchRes.statusCode).toBe(200);
    const updated = JSON.parse(patchRes.body);
    expect(updated.status).toBe('SUBMITTED');
  });

  it('4. GET /api/replenishment/kpis deve retornar métricas de ruptura', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/replenishment/kpis?storeId=${storeId}`,
    });

    expect(res.statusCode).toBe(200);
    const kpis = JSON.parse(res.body);
    expect(kpis.out_of_stock_count).toBeGreaterThanOrEqual(1);
    expect(kpis.total_suggestions).toBeGreaterThanOrEqual(1);
  });
});
