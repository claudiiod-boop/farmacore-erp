import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerMdfeRoutes } from '../../src/modules/fiscal/mdfe.routes';

describe('MDF-e Fiscal REST API Routes', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT OR IGNORE INTO stores (
        id, name, cnpj, ie, street, number, neighborhood, city, state, zip_code
      ) VALUES (
        1, 'CD Central FarmaCore SP', '11.222.333/0001-44', '123.456.789.000',
        'Rodovia Anhanguera', 'Km 25', 'Jardim CD', 'São Paulo', 'SP', '05000-000'
      )
    `).run();

    app = fastify();
    registerMdfeRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    if (app) await app.close();
    if (db) db.close();
  });

  it('POST /api/v1/fiscal/mdfe/drafts - cria rascunho de MDF-e', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/fiscal/mdfe/drafts',
      payload: {
        store_id: 1,
        uf_start: 'SP',
        uf_end: 'RJ',
        driver_name: 'Antônio Carlos',
        driver_cpf: '123.456.789-00',
        vehicle_plate: 'BRA-2E19',
        items: [
          {
            nfe_access_key: '35261111222333000144550010000000011000000019',
            cargo_value_brl: 50000.0,
            weight_kg: 250.0
          }
        ]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe('DRAFT');
    expect(body.data.total_cargo_value_brl).toBe(50000.0);
  });

  it('POST /api/v1/fiscal/mdfe/:id/authorize - autoriza MDF-e na SEFAZ', async () => {
    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/v1/fiscal/mdfe/drafts',
      payload: {
        store_id: 1,
        uf_start: 'SP',
        uf_end: 'MG',
        driver_name: 'Marcos Souza',
        driver_cpf: '222.333.444-55',
        vehicle_plate: 'LOG-5544',
        items: [
          {
            nfe_access_key: '35261111222333000144550010000000021000000024',
            cargo_value_brl: 30000.0,
            weight_kg: 120.0
          }
        ]
      }
    });
    const mdfeId = JSON.parse(draftRes.payload).data.id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/fiscal/mdfe/${mdfeId}/authorize`
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('AUTHORIZED');
    expect(body.data.sefaz_protocol).toBeDefined();
  });

  it('GET /api/v1/fiscal/mdfe/:id/damdfe - emite DAMDFE formatado', async () => {
    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/v1/fiscal/mdfe/drafts',
      payload: {
        store_id: 1,
        uf_start: 'SP',
        uf_end: 'PR',
        driver_name: 'Lucas Pereira',
        driver_cpf: '333.444.555-66',
        vehicle_plate: 'FAR-9090',
        items: [
          {
            nfe_access_key: '35261111222333000144550010000000031000000030',
            cargo_value_brl: 18000.0,
            weight_kg: 80.0
          }
        ]
      }
    });
    const mdfeId = JSON.parse(draftRes.payload).data.id;
    await app.inject({ method: 'POST', url: `/api/v1/fiscal/mdfe/${mdfeId}/authorize` });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/fiscal/mdfe/${mdfeId}/damdfe`
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.damdfe_text).toContain('DAMDFE');
    expect(body.data.damdfe_text).toContain('FAR-9090');
  });

  it('POST /api/v1/fiscal/mdfe/:id/close - encerra manifesto no destino', async () => {
    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/v1/fiscal/mdfe/drafts',
      payload: {
        store_id: 1,
        uf_start: 'SP',
        uf_end: 'RJ',
        driver_name: 'Antônio Carlos',
        driver_cpf: '123.456.789-00',
        vehicle_plate: 'BRA-2E19',
        items: [
          {
            nfe_access_key: '35261111222333000144550010000000041000000045',
            cargo_value_brl: 22000.0,
            weight_kg: 95.0
          }
        ]
      }
    });
    const mdfeId = JSON.parse(draftRes.payload).data.id;
    await app.inject({ method: 'POST', url: `/api/v1/fiscal/mdfe/${mdfeId}/authorize` });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/fiscal/mdfe/${mdfeId}/close`,
      payload: {
        closure_reason: 'Carga recebida na filial RJ'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('CLOSED');
  });

  it('GET /api/v1/fiscal/mdfe/kpis - métricas consolidadas de manifesto', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/fiscal/mdfe/kpis?store_id=1'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.total_manifests).toBeDefined();
    expect(body.data.authorized_in_transit).toBeDefined();
    expect(body.data.total_transported_cargo_brl).toBeDefined();
  });
});
