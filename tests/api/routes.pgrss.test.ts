import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Descarte Sanitário & PGRSS (Fase 27)', () => {
  let app: FastifyInstance;
  let db: Database;
  let storeId: number;
  let productId: number;
  let batchId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    // Criar produto e lote
    const pRes = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('Azitromicina 500mg', '7891112223334', 'Azitromicina', '100000002', 'RED', 'ANTIMICROBIANO', 40.0, 15.0, 29.90)
    `).run();
    productId = Number(pRes.lastInsertRowid);

    const bRes = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (?, 'L-AZITRO-99', '2024-01-01', '2025-05-01', 50, ?)
    `).run(productId, storeId);
    batchId = Number(bRes.lastInsertRowid);

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('POST /api/sanitary/pgrss/segregate and GET /api/sanitary/pgrss/records', async () => {
    const segRes = await app.inject({
      method: 'POST',
      url: '/api/sanitary/pgrss/segregate',
      payload: {
        storeId,
        productId,
        batchId,
        wasteGroup: 'GRUPO_B_QUIMICO',
        reason: 'VENCIDO',
        quantity: 10,
        weightKg: 0.8,
        pharmacistName: 'Dra. Beatriz',
        pharmacistCrf: 'CRF-RJ 9988',
        notes: 'Medicamento vencido retirado do estoque',
      },
    });

    expect(segRes.statusCode).toBe(201);
    const record = JSON.parse(segRes.body);
    expect(record.id).toBeDefined();
    expect(record.status).toBe('STORED');
    expect(record.quantity).toBe(10);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/sanitary/pgrss/records?storeId=${storeId}&status=STORED`,
    });
    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.body);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(record.id);
  });

  it('POST /api/sanitary/pgrss/manifests, GET document and PATCH cdf', async () => {
    // 1. Segregar item
    const segRes = await app.inject({
      method: 'POST',
      url: '/api/sanitary/pgrss/segregate',
      payload: {
        storeId,
        productId,
        batchId,
        wasteGroup: 'GRUPO_B_QUIMICO',
        reason: 'AVARIADO',
        quantity: 5,
        weightKg: 0.4,
        pharmacistName: 'Dra. Beatriz',
        pharmacistCrf: 'CRF-RJ 9988',
      },
    });
    const record = JSON.parse(segRes.body);

    // 2. Emitir MTR
    const mtrRes = await app.inject({
      method: 'POST',
      url: '/api/sanitary/pgrss/manifests',
      payload: {
        storeId,
        collectorName: 'BioLimp Tratamento de Resíduos',
        collectorCnpj: '22.333.444/0001-55',
        environmentalLicense: 'LO-INEA-2026/12',
        vehiclePlate: 'KLR-3322',
        driverName: 'Rogério Batista',
        disposalRecordIds: [record.id],
      },
    });
    expect(mtrRes.statusCode).toBe(201);
    const manifest = JSON.parse(mtrRes.body);
    expect(manifest.manifest_number).toContain('MTR-');
    expect(manifest.status).toBe('DISPATCHED');

    // 3. Obter espelho MTR para impressão
    const docRes = await app.inject({
      method: 'GET',
      url: `/api/sanitary/pgrss/manifests/${manifest.id}/document`,
    });
    expect(docRes.statusCode).toBe(200);
    const { document } = JSON.parse(docRes.body);
    expect(document).toContain('MANIFESTO DE TRANSPORTE DE RESÍDUOS (MTR)');
    expect(document).toContain('BioLimp Tratamento');

    // 4. Baixar com CDF
    const cdfRes = await app.inject({
      method: 'PATCH',
      url: `/api/sanitary/pgrss/manifests/${manifest.id}/cdf`,
      payload: {
        cdfNumber: 'CDF-2026-BR-001',
        certificateDate: '2026-11-25',
        incinerationPlant: 'Incinera Brasil Unidade Rio',
      },
    });
    expect(cdfRes.statusCode).toBe(200);
    const finalized = JSON.parse(cdfRes.body);
    expect(finalized.status).toBe('DESTINED');
    expect(finalized.cdf_number).toBe('CDF-2026-BR-001');
  });

  it('GET /api/sanitary/pgrss/kpis', async () => {
    const kpisRes = await app.inject({
      method: 'GET',
      url: `/api/sanitary/pgrss/kpis?storeId=${storeId}`,
    });
    expect(kpisRes.statusCode).toBe(200);
    const kpis = JSON.parse(kpisRes.body);
    expect(kpis.stored_records_count).toBeDefined();
    expect(kpis.stored_weight_kg).toBeDefined();
  });
});
