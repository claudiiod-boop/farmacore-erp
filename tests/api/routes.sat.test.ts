import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerSatFiscalRoutes } from '../../src/modules/fiscal/sat.routes';

describe('SAT Fiscal & Contingency REST API Routes', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT OR IGNORE INTO stores (
        id, name, cnpj, ie, street, number, neighborhood, city, state, zip_code
      ) VALUES (
        1, 'Drogarias FarmaCore SP', '12.345.678/0001-99', '123.456.789.111',
        'Av. Paulista', '1500', 'Bela Vista', 'São Paulo', 'SP', '01310-100'
      )
    `).run();

    db.prepare(`
      INSERT INTO sales (id, total_amount, created_at) VALUES (1, 50.0, '2026-11-25 10:00:00')
    `).run();

    app = fastify();
    registerSatFiscalRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('POST /api/v1/fiscal/sat/devices - cadastra dispositivo SAT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/fiscal/sat/devices',
      payload: {
        store_id: 1,
        pos_station_id: 'CAIXA_01',
        serial_number: '900001234',
        sign_code: 'SIGNAUTH12345'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.serial_number).toBe('900001234');
  });

  it('GET /api/v1/fiscal/sat/devices/:id/status - consulta status do SAT', async () => {
    const devRes = await app.inject({
      method: 'POST',
      url: '/api/v1/fiscal/sat/devices',
      payload: {
        store_id: 1,
        pos_station_id: 'CAIXA_01',
        serial_number: '900001234',
        sign_code: 'SIGNAUTH12345'
      }
    });
    const devId = JSON.parse(devRes.payload).data.id;

    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/v1/fiscal/sat/devices/${devId}/status`
    });

    expect(statusRes.statusCode).toBe(200);
    const body = JSON.parse(statusRes.payload);
    expect(body.data.status).toBe('OPERACIONAL');
  });

  it('POST /api/v1/fiscal/sat/cfe/issue e GET /extrato - emite e gera extrato 80mm', async () => {
    const devRes = await app.inject({
      method: 'POST',
      url: '/api/v1/fiscal/sat/devices',
      payload: {
        store_id: 1,
        pos_station_id: 'CAIXA_01',
        serial_number: '900001234',
        sign_code: 'SIGNAUTH12345'
      }
    });
    const devId = JSON.parse(devRes.payload).data.id;

    const issueRes = await app.inject({
      method: 'POST',
      url: '/api/v1/fiscal/sat/cfe/issue',
      payload: {
        sale_id: 1,
        sat_device_id: devId,
        customer_cpf: '123.456.789-00'
      }
    });

    expect(issueRes.statusCode).toBe(200);
    const issueBody = JSON.parse(issueRes.payload);
    expect(issueBody.data.access_key).toHaveLength(44);
    expect(issueBody.data.status).toBe('AUTHORIZED');

    // Extrato térmico
    const extratoRes = await app.inject({
      method: 'GET',
      url: `/api/v1/fiscal/sat/cfe/${issueBody.data.id}/extrato`
    });
    expect(extratoRes.statusCode).toBe(200);
    const extratoBody = JSON.parse(extratoRes.payload);
    expect(extratoBody.data.extrato).toContain('CUPOM FISCAL ELETRONICO - SAT');
  });

  it('POST /api/v1/fiscal/sat/cfe/:id/cancel - cancela no prazo de 30 minutos', async () => {
    const devRes = await app.inject({
      method: 'POST',
      url: '/api/v1/fiscal/sat/devices',
      payload: {
        store_id: 1,
        pos_station_id: 'CAIXA_01',
        serial_number: '900001234',
        sign_code: 'SIGNAUTH12345'
      }
    });
    const devId = JSON.parse(devRes.payload).data.id;

    const issueRes = await app.inject({
      method: 'POST',
      url: '/api/v1/fiscal/sat/cfe/issue',
      payload: {
        sale_id: 1,
        sat_device_id: devId
      }
    });
    const cfeId = JSON.parse(issueRes.payload).data.id;

    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/v1/fiscal/sat/cfe/${cfeId}/cancel`,
      payload: {
        justification: 'Venda lançada com forma de pagamento incorreta'
      }
    });

    expect(cancelRes.statusCode).toBe(200);
    const cancelBody = JSON.parse(cancelRes.payload);
    expect(cancelBody.data.status).toBe('CANCELLED');
  });

  it('GET /api/v1/fiscal/sat/kpis - retorna KPIs fiscais', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/fiscal/sat/kpis?store_id=1'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.active_devices_count).toBeDefined();
  });
});
