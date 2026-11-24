import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Fracionamento de Medicamentos em Blíster (RDC 80/2006)', () => {
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

    const prodRes = db.prepare(`
      INSERT INTO products (
        name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price,
        is_fractionable, units_per_package, fractional_unit
      ) VALUES (
        'Ciprofloxacino 500mg 14 comp', '7891234567899', 'Cloridrato de Ciprofloxacino', '100000077', 'RED', 'NONE',
        50.0, 25.0, 35.0, 1, 14, 'COMPRIMIDO'
      )
    `).run();
    productId = Number(prodRes.lastInsertRowid);

    const batchRes = db.prepare(`
      INSERT INTO batches (
        product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
      ) VALUES (
        ?, 'LOTE-CIPRO-10', '2026-02-01', '2028-02-01', 20, 0
      )
    `).run(productId);
    batchId = Number(batchRes.lastInsertRowid);

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('should list products, toggle fractionable, fractionate medicine and fetch details', async () => {
    // 1. GET /api/fractionation/products
    const prodRes = await app.inject({
      method: 'GET',
      url: '/api/fractionation/products',
    });
    expect(prodRes.statusCode).toBe(200);
    const prods = JSON.parse(prodRes.payload);
    expect(prods.length).toBeGreaterThanOrEqual(1);

    // 2. PATCH /api/fractionation/products/:id/toggle
    const toggleRes = await app.inject({
      method: 'PATCH',
      url: `/api/fractionation/products/${productId}/toggle`,
      payload: { isFractionable: false },
    });
    expect(toggleRes.statusCode).toBe(200);
    expect(JSON.parse(toggleRes.payload).is_fractionable).toBe(0);

    // Reativa
    await app.inject({
      method: 'PATCH',
      url: `/api/fractionation/products/${productId}/toggle`,
      payload: { isFractionable: true, unitsPerPackage: 14, fractionalUnit: 'COMPRIMIDO' },
    });

    // 3. POST /api/fractionation/records
    const fracRes = await app.inject({
      method: 'POST',
      url: '/api/fractionation/records',
      payload: {
        store_id: storeId,
        product_id: productId,
        original_batch_id: batchId,
        pharmacist_name: 'Dr. Fernando Farmacêutico',
        pharmacist_crf: '54321',
        pharmacist_crf_uf: 'SP',
        original_packages_opened: 2, // 2 caixas x 14 comp = 28 comprimidos
      },
    });
    expect(fracRes.statusCode).toBe(201);
    const frac = JSON.parse(fracRes.payload);
    expect(frac.units_generated).toBe(28);
    expect(frac.sub_batch_code).toMatch(/^FRAC-LOTE-CIPRO-10-/);

    // 4. GET /api/fractionation/records/:id
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/fractionation/records/${frac.id}`,
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = JSON.parse(detailRes.payload);
    expect(detail.units_available).toBe(28);

    // 5. GET /api/fractionation/kpis
    const kpiRes = await app.inject({
      method: 'GET',
      url: '/api/fractionation/kpis',
    });
    expect(kpiRes.statusCode).toBe(200);
    const kpis = JSON.parse(kpiRes.payload);
    expect(kpis.totalFractionations).toBe(1);
    expect(kpis.totalUnitsAvailable).toBe(28);
  });

  it('should dispense fractioned medicine and generate official label', async () => {
    // Fraciona 1 caixa (14 comp)
    const fracRes = await app.inject({
      method: 'POST',
      url: '/api/fractionation/records',
      payload: {
        store_id: storeId,
        product_id: productId,
        original_batch_id: batchId,
        pharmacist_name: 'Dra. Vanessa',
        pharmacist_crf: '99881',
        pharmacist_crf_uf: 'SP',
        original_packages_opened: 1,
      },
    });
    const frac = JSON.parse(fracRes.payload);

    // POST /api/fractionation/dispense (dispensa 7 comprimidos)
    const dispRes = await app.inject({
      method: 'POST',
      url: '/api/fractionation/dispense',
      payload: {
        fractionation_record_id: frac.id,
        patient_name: 'Mariana Duarte',
        patient_cpf: '444.555.666-77',
        doctor_name: 'Dr. Carlos Médico',
        doctor_crm: '66554',
        doctor_uf: 'SP',
        units_dispensed: 7,
        posology: 'Tomar 1 comp a cada 12 horas por 3.5 dias',
        leaflet_supplied: true,
      },
    });
    expect(dispRes.statusCode).toBe(201);
    const disp = JSON.parse(dispRes.payload);
    expect(disp.units_dispensed).toBe(7);
    expect(disp.leaflet_supplied).toBe(1);

    // GET /api/fractionation/label/:dispensationId
    const labelRes = await app.inject({
      method: 'GET',
      url: `/api/fractionation/label/${disp.id}`,
    });
    expect(labelRes.statusCode).toBe(200);
    const labelData = JSON.parse(labelRes.payload);
    expect(labelData.labelText).toContain('ROTULO DE DISPENSACAO FRACIONADA (RDC 80/2006 ANVISA)');
    expect(labelData.labelText).toContain('MARIANA DUARTE');
    expect(labelData.labelText).toContain('QTD DISPENSADA: 7 COMPRIMIDO');
  });
});
