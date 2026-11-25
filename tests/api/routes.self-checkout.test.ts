import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerSelfCheckoutRoutes } from '../../src/modules/self-checkout/self-checkout.routes';

describe('Self-Checkout REST Routes', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT OR IGNORE INTO kiosk_terminals (id, store_id, terminal_code, name, mode, is_active)
      VALUES (1, 1, 'TOTEM-01', 'Totem Entrada', 'SELF_PRE_SALE', 1)
    `).run();

    // OTC livre
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
      VALUES (1, '7891234567890', 'Protetor Solar FPS 50', 'Filtro Solar', '1004300010011', 'SEM_TARJA', 'NAO_CONTROLADO', 60.0, 35.0, 49.90, 1)
    `).run();

    // Lote
    db.prepare(`
      INSERT INTO batches (id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity)
      VALUES (1, 1, 'L-FPS-01', '2026-01-01', '2027-12-31', 25, 0)
    `).run();

    app = fastify();
    await registerSelfCheckoutRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. POST /api/self-checkout/sessions - inicia sessão de totem', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/self-checkout/sessions',
      payload: { kioskId: 1, customerCpf: '111.222.333-44' },
    });

    expect(res.statusCode).toBe(201);
    const session = JSON.parse(res.payload);
    expect(session.id).toBeGreaterThan(0);
    expect(session.session_code).toContain('SC-');
    expect(session.status).toBe('OPEN');
  });

  it('2. POST /api/self-checkout/sessions/:id/scan e payment PIX', async () => {
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/self-checkout/sessions',
      payload: { kioskId: 1 },
    });
    const session = JSON.parse(sessionRes.payload);

    // Bipe
    const scanRes = await app.inject({
      method: 'POST',
      url: `/api/self-checkout/sessions/${session.id}/scan`,
      payload: { eanOrCode: '7891234567890', quantity: 1 },
    });
    expect(scanRes.statusCode).toBe(200);
    const scanData = JSON.parse(scanRes.payload);
    expect(scanData.allowed).toBe(true);
    expect(scanData.session.total_amount).toBe(49.9);

    // Pagamento PIX
    const payRes = await app.inject({
      method: 'POST',
      url: `/api/self-checkout/sessions/${session.id}/payment`,
      payload: { paymentMethod: 'PIX' },
    });
    expect(payRes.statusCode).toBe(200);
    const payData = JSON.parse(payRes.payload);
    expect(payData.pixQrCodePayload).toContain('BR.GOV.BCB.PIX');

    // Finalizar
    const finalRes = await app.inject({
      method: 'POST',
      url: `/api/self-checkout/sessions/${session.id}/finalize`,
    });
    expect(finalRes.statusCode).toBe(200);
    const finalData = JSON.parse(finalRes.payload);
    expect(finalData.status).toBe('PAID');
    expect(finalData.nfceKey.length).toBe(44);
  });

  it('3. GET /api/self-checkout/kpis - métricas do autoatendimento', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/self-checkout/kpis?storeId=1',
    });
    expect(res.statusCode).toBe(200);
    const kpis = JSON.parse(res.payload);
    expect(kpis.totalSessionsToday).toBeDefined();
  });
});
