import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Clube de Assinatura & Reposição Recorrente (Fase 23)', () => {
  let app: FastifyInstance;
  let db: Database;
  let storeId: number;
  let customerId: number;
  let productId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    const custRes = db.prepare(`
      INSERT INTO customers (store_id, name, cpf, phone)
      VALUES (?, 'Carlos Eduardo Assinante', '999.888.777-66', '(11) 91234-5678')
    `).run(storeId);
    customerId = Number(custRes.lastInsertRowid);

    const prodRes = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('Atorvastatina Cálcica 20mg 30 comp', '7899999990001', 'Atorvastatina', '100000003', 'RED', 'NONE', 45.0, 25.0, 35.0)
    `).run();
    productId = Number(prodRes.lastInsertRowid);

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('should create subscription, retrieve details, update status, and fetch KPIs', async () => {
    // 1. POST /api/subscriptions
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      payload: {
        customer_id: customerId,
        store_id: storeId,
        plan_name: 'Clube Colesterol Sob Controle',
        interval_days: 30,
        preferred_delivery_day: 15,
        delivery_mode: 'DELIVERY',
        delivery_address: 'Av. Paulista, 1000',
        payment_method: 'PIX_RECURRING',
        discount_percentage: 12.0,
        items: [
          {
            product_id: productId,
            quantity: 1,
            unit_price: 35.0,
          },
        ],
      },
    });

    expect(createRes.statusCode).toBe(201);
    const sub = JSON.parse(createRes.payload);
    expect(sub.id).toBeDefined();
    expect(sub.plan_name).toBe('Clube Colesterol Sob Controle');
    expect(sub.items).toHaveLength(1);

    // 2. GET /api/subscriptions
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/subscriptions',
    });
    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.payload);
    expect(list.length).toBeGreaterThanOrEqual(1);

    // 3. GET /api/subscriptions/:id
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/subscriptions/${sub.id}`,
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = JSON.parse(detailRes.payload);
    expect(detail.customer_name).toBe('Carlos Eduardo Assinante');

    // 4. PATCH /api/subscriptions/:id/status
    const pauseRes = await app.inject({
      method: 'PATCH',
      url: `/api/subscriptions/${sub.id}/status`,
      payload: { status: 'PAUSED' },
    });
    expect(pauseRes.statusCode).toBe(200);
    expect(JSON.parse(pauseRes.payload).status).toBe('PAUSED');

    // Reativa
    await app.inject({
      method: 'PATCH',
      url: `/api/subscriptions/${sub.id}/status`,
      payload: { status: 'ACTIVE' },
    });

    // 5. GET /api/subscriptions/kpis
    const kpisRes = await app.inject({
      method: 'GET',
      url: '/api/subscriptions/kpis',
    });
    expect(kpisRes.statusCode).toBe(200);
    const kpis = JSON.parse(kpisRes.payload);
    expect(kpis.activeSubscriptions).toBe(1);
    expect(kpis.totalMonthlyRecurringRevenue).toBeGreaterThan(0);
  });

  it('should process scheduled refills and manage prescription renewals', async () => {
    // 1. Cadastra item controlado com receita vencendo amanhã
    const today = new Date().toISOString().split('T')[0];
    const subRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      payload: {
        customer_id: customerId,
        store_id: storeId,
        plan_name: 'Plano Uso Diário',
        interval_days: 30,
        preferred_delivery_day: parseInt(today.split('-')[2], 10),
        startDate: today,
        items: [
          {
            product_id: productId,
            quantity: 1,
            unit_price: 35.0,
            requires_prescription: true,
            prescription_doctor_crm: '554433',
            prescription_doctor_uf: 'SP',
            prescription_expiry_date: today, // válida hoje
          },
        ],
      },
    });
    const sub = JSON.parse(subRes.payload);
    const itemId = sub.items[0].id;

    // 2. GET /api/subscriptions/expiring-prescriptions
    const expRes = await app.inject({
      method: 'GET',
      url: '/api/subscriptions/expiring-prescriptions?daysAhead=5',
    });
    expect(expRes.statusCode).toBe(200);
    const expiring = JSON.parse(expRes.payload);
    expect(expiring.length).toBeGreaterThanOrEqual(1);

    // 3. PATCH /api/subscriptions/items/:itemId/prescription
    const renewRes = await app.inject({
      method: 'PATCH',
      url: `/api/subscriptions/items/${itemId}/prescription`,
      payload: {
        prescription_doctor_crm: '998877',
        prescription_doctor_uf: 'MG',
        prescription_expiry_date: '2027-12-31',
      },
    });
    expect(renewRes.statusCode).toBe(200);
    expect(JSON.parse(renewRes.payload).prescription_doctor_uf).toBe('MG');

    // 4. POST /api/subscriptions/process-refills
    const refillRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions/process-refills',
      payload: {
        currentDate: today,
        storeId,
      },
    });
    expect(refillRes.statusCode).toBe(200);
    const refillData = JSON.parse(refillRes.payload);
    expect(refillData.successCount).toBe(1);
    expect(refillData.details[0].status).toBe('PROCESSED');
  });
});
