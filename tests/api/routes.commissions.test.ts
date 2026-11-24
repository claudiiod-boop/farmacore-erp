import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Comissões, Campanhas & Metas (Fase 25)', () => {
  let app: FastifyInstance;
  let db: Database;
  let storeId: number;
  let sellerId: number;
  let productId: number;
  let saleId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    // Cadastra vendedor
    const sRes = db.prepare(`
      INSERT INTO sellers (store_id, name, cpf, role)
      VALUES (?, 'Lucas Atendente', '111.222.333-01', 'BALCONISTA')
    `).run(storeId);
    sellerId = Number(sRes.lastInsertRowid);

    // Cadastra produto genérico
    const pRes = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('Omeprazol 20mg Genérico Neo Química', '789123450099', 'Omeprazol', '100000088', 'RED', 'NONE', 25.0, 10.0, 18.0)
    `).run();
    productId = Number(pRes.lastInsertRowid);

    // Cadastra venda com item
    const saleRes = db.prepare("INSERT INTO sales (total_amount) VALUES (36.0)").run();
    saleId = Number(saleRes.lastInsertRowid);

    const bRes = db.prepare("INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity) VALUES (?, 'L1', '2026-01-01', '2028-01-01', 50)").run(productId);

    db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, 2, 18.0, 36.0)
    `).run(saleId, productId, bRes.lastInsertRowid);

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('should list sellers, manage rules, campaigns and sales goals', async () => {
    // 1. GET /api/commissions/sellers
    const sListRes = await app.inject({ method: 'GET', url: '/api/commissions/sellers' });
    expect(sListRes.statusCode).toBe(200);
    const sellers = JSON.parse(sListRes.payload);
    expect(sellers.length).toBeGreaterThanOrEqual(1);

    // 2. GET /api/commissions/rules & PUT /api/commissions/rules
    const rListRes = await app.inject({ method: 'GET', url: '/api/commissions/rules' });
    expect(rListRes.statusCode).toBe(200);

    const rPutRes = await app.inject({
      method: 'PUT',
      url: '/api/commissions/rules',
      payload: { categoryType: 'GENERICO', percentage: 7.5, description: 'Super Genéricos' },
    });
    expect(rPutRes.statusCode).toBe(200);
    expect(JSON.parse(rPutRes.payload).percentage).toBe(7.5);

    // 3. POST /api/commissions/campaigns
    const campRes = await app.inject({
      method: 'POST',
      url: '/api/commissions/campaigns',
      payload: {
        name: 'Campanha Neo Química',
        manufacturer: 'Neo Química',
        bonus_per_unit: 1.5,
        start_date: '2026-11-01',
        end_date: '2026-11-30',
      },
    });
    expect(campRes.statusCode).toBe(201);
    expect(JSON.parse(campRes.payload).bonus_per_unit).toBe(1.5);

    // 4. POST /api/commissions/goals
    const goalRes = await app.inject({
      method: 'POST',
      url: '/api/commissions/goals',
      payload: {
        seller_id: sellerId,
        store_id: storeId,
        period_month: '2026-11',
        target_amount: 15000.0,
      },
    });
    expect(goalRes.statusCode).toBe(201);
    expect(JSON.parse(goalRes.payload).target_amount).toBe(15000.0);
  });

  it('should calculate sale commissions, fetch statement and close period', async () => {
    // 1. POST /api/commissions/calculate-sale
    const calcRes = await app.inject({
      method: 'POST',
      url: '/api/commissions/calculate-sale',
      payload: {
        seller_id: sellerId,
        sale_id: saleId,
        sale_date: '2026-11-23',
      },
    });
    expect(calcRes.statusCode).toBe(201);
    const statements = JSON.parse(calcRes.payload);
    expect(statements).toHaveLength(1);
    expect(statements[0].category_type).toBe('GENERICO');
    expect(statements[0].final_commission_amount).toBeGreaterThan(0);

    // 2. GET /api/commissions/statements
    const stmtRes = await app.inject({
      method: 'GET',
      url: `/api/commissions/statements?sellerId=${sellerId}&periodMonth=2026-11`,
    });
    expect(stmtRes.statusCode).toBe(200);
    const stmts = JSON.parse(stmtRes.payload);
    expect(stmts.length).toBe(1);

    // 3. POST /api/commissions/close-period
    const closeRes = await app.inject({
      method: 'POST',
      url: '/api/commissions/close-period',
      payload: {
        seller_id: sellerId,
        periodMonth: '2026-11',
        status: 'PAID',
      },
    });
    expect(closeRes.statusCode).toBe(200);
    expect(JSON.parse(closeRes.payload).updatedCount).toBe(1);

    // 4. GET /api/commissions/kpis
    const kpiRes = await app.inject({
      method: 'GET',
      url: '/api/commissions/kpis?periodMonth=2026-11',
    });
    expect(kpiRes.statusCode).toBe(200);
    const kpis = JSON.parse(kpiRes.payload);
    expect(kpis.totalCommissionsCurrentMonth).toBeGreaterThan(0);
  });
});
