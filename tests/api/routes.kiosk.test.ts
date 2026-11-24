import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Totem de Autoatendimento & Fila (Fase 28)', () => {
  let app: FastifyInstance;
  let db: Database;
  let storeId: number;
  let prodId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    // Criar produto e lote
    const pRes = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, category)
      VALUES ('Paracetamol 750mg', '7891234999999', 'Paracetamol', '100000003', 'SEM_TARJA', 'NONE', 18.0, 6.0, 12.0, 'GENERICO')
    `).run();
    prodId = Number(pRes.lastInsertRowid);

    db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (?, 'L-PARA-01', '2024-01-01', '2027-01-01', 100, ?)
    `).run(prodId, storeId);

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/kiosk/price-check', async () => {
    const checkRes = await app.inject({
      method: 'GET',
      url: `/api/kiosk/price-check?ean=7891234999999&customerCpf=11122233344`,
    });
    expect(checkRes.statusCode).toBe(200);
    const data = JSON.parse(checkRes.body);
    expect(data.name).toContain('Paracetamol');
    expect(data.club_member).toBe(true);
    expect(data.final_price).toBeLessThan(12.0);
  });

  it('POST /api/kiosk/queue/ticket, GET /api/kiosk/queue/tickets and PATCH call/complete', async () => {
    // 1. Emitir senha
    const issueRes = await app.inject({
      method: 'POST',
      url: '/api/kiosk/queue/ticket',
      payload: {
        storeId,
        serviceType: 'NORMAL',
        customerName: 'Lucas Cliente',
      },
    });
    expect(issueRes.statusCode).toBe(201);
    const { ticket, receipt } = JSON.parse(issueRes.body);
    expect(ticket.ticket_number).toBe('N-001');
    expect(receipt).toContain('N-001');

    // 2. Listar senhas da fila
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/kiosk/queue/tickets?storeId=${storeId}&status=WAITING`,
    });
    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.body);
    expect(list.length).toBe(1);

    // 3. Chamar senha
    const callRes = await app.inject({
      method: 'PATCH',
      url: `/api/kiosk/queue/tickets/${ticket.id}/call`,
      payload: { operatorName: 'Camila Balcão' },
    });
    expect(callRes.statusCode).toBe(200);
    const called = JSON.parse(callRes.body);
    expect(called.status).toBe('CALLED');

    // 4. Concluir senha
    const compRes = await app.inject({
      method: 'PATCH',
      url: `/api/kiosk/queue/tickets/${ticket.id}/complete`,
    });
    expect(compRes.statusCode).toBe(200);
    const completed = JSON.parse(compRes.body);
    expect(completed.status).toBe('COMPLETED');
  });

  it('POST /api/kiosk/pre-sale and GET /api/kiosk/kpis', async () => {
    const preSaleRes = await app.inject({
      method: 'POST',
      url: '/api/kiosk/pre-sale',
      payload: {
        storeId,
        customerCpf: '11122233344',
        items: [{ productId: prodId, quantity: 2 }],
      },
    });
    expect(preSaleRes.statusCode).toBe(201);
    const preSale = JSON.parse(preSaleRes.body);
    expect(preSale.code).toContain('PV-EXP-');
    expect(preSale.final_amount).toBeGreaterThan(0);

    const kpisRes = await app.inject({
      method: 'GET',
      url: `/api/kiosk/kpis?storeId=${storeId}`,
    });
    expect(kpisRes.statusCode).toBe(200);
    const kpis = JSON.parse(kpisRes.body);
    expect(kpis.total_express_presales_today).toBe(1);
  });
});
