import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — DRE Gerencial & Centros de Custo (Fase 26)', () => {
  let app: FastifyInstance;
  let db: Database;
  let storeId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    // Criar uma venda no mês 2026-11
    const pRes = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, category)
      VALUES ('Losartana 50mg', '7891234567890', 'Losartana Potássica', '100000001', 'RED', 'NONE', 20.0, 5.0, 15.0, 'GENERICO')
    `).run();
    const prodId = Number(pRes.lastInsertRowid);

    const bRes = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (?, 'L001', '2026-01-01', '2028-01-01', 100, ?)
    `).run(prodId, storeId);

    const saleRes = db.prepare(`
      INSERT INTO sales (store_id, total_amount, discount_amount, status, created_at)
      VALUES (?, 30.0, 0.0, 'COMPLETED', '2026-11-10 10:00:00')
    `).run(storeId);
    const saleId = Number(saleRes.lastInsertRowid);

    db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, 2, 15.0, 30.0)
    `).run(saleId, prodId, bRes.lastInsertRowid);

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/dre/cost-centers and POST /api/dre/cost-centers', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/dre/cost-centers',
    });
    expect(listRes.statusCode).toBe(200);
    const centers = JSON.parse(listRes.body);
    expect(centers.length).toBeGreaterThanOrEqual(6);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/dre/cost-centers',
      payload: {
        code: 'CC-MARKETING',
        name: 'Marketing Digital e Tráfego',
        departmentType: 'ADMINISTRATIVO',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    expect(created.code).toBe('CC-MARKETING');
  });

  it('POST /api/dre/expenses, GET /api/dre/expenses and PATCH /api/dre/expenses/:id/pay', async () => {
    const ccRes = await app.inject({
      method: 'GET',
      url: '/api/dre/cost-centers',
    });
    const cc = JSON.parse(ccRes.body)[0];

    const createExpRes = await app.inject({
      method: 'POST',
      url: '/api/dre/expenses',
      payload: {
        storeId,
        costCenterId: cc.id,
        expenseType: 'ADMINISTRATIVA',
        description: 'Material de Limpeza e Copa',
        amount: 250.75,
        dueDate: '2026-11-15',
      },
    });
    expect(createExpRes.statusCode).toBe(201);
    const exp = JSON.parse(createExpRes.body);
    expect(exp.status).toBe('PENDING');
    expect(exp.amount).toBe(250.75);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/dre/expenses?storeId=${storeId}&status=PENDING`,
    });
    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.body);
    expect(list.length).toBe(1);

    const payRes = await app.inject({
      method: 'PATCH',
      url: `/api/dre/expenses/${exp.id}/pay`,
      payload: { paymentDate: '2026-11-14' },
    });
    expect(payRes.statusCode).toBe(200);
    const paid = JSON.parse(payRes.body);
    expect(paid.status).toBe('PAID');
    expect(paid.payment_date).toBe('2026-11-14');
  });

  it('GET /api/dre/report and GET /api/dre/kpis', async () => {
    const reportRes = await app.inject({
      method: 'GET',
      url: `/api/dre/report?periodMonth=2026-11&storeId=${storeId}&regime=COMPETENCIA`,
    });
    expect(reportRes.statusCode).toBe(200);
    const report = JSON.parse(reportRes.body);

    expect(report.period_month).toBe('2026-11');
    expect(report.gross_revenue).toBe(30.0);
    expect(report.cmv_amount).toBe(10.0); // 2 x 5.0
    expect(report.gross_profit).toBeGreaterThan(0);
    expect(report.ebitda_amount).toBeDefined();

    const kpisRes = await app.inject({
      method: 'GET',
      url: `/api/dre/kpis?periodMonth=2026-11&storeId=${storeId}`,
    });
    expect(kpisRes.statusCode).toBe(200);
    const kpis = JSON.parse(kpisRes.body);
    expect(kpis.gross_revenue).toBe(30.0);
    expect(kpis.cmv_amount).toBe(10.0);
  });

  it('POST /api/dre/snapshot and GET /api/dre/snapshots', async () => {
    const snapRes = await app.inject({
      method: 'POST',
      url: '/api/dre/snapshot',
      payload: {
        periodMonth: '2026-11',
        storeId,
        regime: 'COMPETENCIA',
      },
    });
    expect(snapRes.statusCode).toBe(201);
    const snap = JSON.parse(snapRes.body);
    expect(snap.period_month).toBe('2026-11');
    expect(snap.gross_revenue).toBe(30.0);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/dre/snapshots?storeId=${storeId}&periodMonth=2026-11`,
    });
    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.body);
    expect(list.length).toBe(1);
  });

  it('GET /api/dre/branch-ranking', async () => {
    const rankRes = await app.inject({
      method: 'GET',
      url: '/api/dre/branch-ranking?periodMonth=2026-11',
    });
    expect(rankRes.statusCode).toBe(200);
    const ranking = JSON.parse(rankRes.body);
    expect(Array.isArray(ranking)).toBe(true);
    expect(ranking.length).toBeGreaterThanOrEqual(1);
  });
});
