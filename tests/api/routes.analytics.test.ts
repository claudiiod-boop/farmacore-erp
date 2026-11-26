import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerAnalyticsRoutes } from '../../src/modules/analytics/analytics.routes';

describe('Analytics & WhatsApp Quotation Routes (/api/analytics)', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj)
      VALUES (1, 'Magnos Farma Matriz', '11.222.333/0001-44')
    `).run();

    app = Fastify();
    registerAnalyticsRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    if (app) await app.close();
    if (db) db.close();
  });

  it('GET /api/analytics/live should return executive analytics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/live?store_id=1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.storeName).toContain('Matriz');
    expect(body.todaySalesBrl).toBeDefined();
    expect(body.hourlyDistribution).toBeInstanceOf(Array);
    expect(body.categoryDistribution).toBeInstanceOf(Array);
  });

  it('POST /api/analytics/target should update monthly sales goal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analytics/target',
      payload: {
        store_id: 1,
        year_month: '2026-11',
        target_amount: 180000.0,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });

  it('POST, GET, PATCH /api/analytics/whatsapp/quotations should manage WhatsApp quotes', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/analytics/whatsapp/quotations',
      payload: {
        store_id: 1,
        customer_name: 'Dona Helena',
        customer_phone: '11977778888',
        attendant_name: 'Carlos Balcão',
        items: [
          {
            product_id: 1,
            product_name: 'Paracetamol 750mg',
            quantity: 2,
            unit_price_brl: 12.5,
          },
        ],
        discount_brl: 2.5,
        valid_days: 3,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const quotation = JSON.parse(createRes.payload);
    expect(quotation.id).toBeDefined();
    expect(quotation.total_brl).toBe(22.5);
    expect(quotation.whatsapp_url).toContain('https://api.whatsapp.com/send?phone=5511977778888');

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/analytics/whatsapp/quotations/${quotation.id}`,
    });
    expect(getRes.statusCode).toBe(200);
    const fetched = JSON.parse(getRes.payload);
    expect(fetched.customer_name).toBe('Dona Helena');

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/analytics/whatsapp/quotations/${quotation.id}/status`,
      payload: { status: 'CONVERTED' },
    });
    expect(patchRes.statusCode).toBe(200);
    const updated = JSON.parse(patchRes.payload);
    expect(updated.status).toBe('CONVERTED');
  });
});
