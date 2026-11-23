import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — FarmaCore Magistral & RDC 67/2007 (Fase 22)', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('should create raw material, batch in quarantine, and release it with pharmacist', async () => {
    // 1. Criar Matéria-prima
    const matRes = await app.inject({
      method: 'POST',
      url: '/api/compounding/raw-materials',
      payload: {
        name: 'Vitamina D3 (Colecalciferol) 100.000 UI/g',
        dcb: '02570',
        apparent_density: 0.50,
        default_unit: 'UI',
        cost_per_unit: 0.001,
      },
    });

    expect(matRes.statusCode).toBe(201);
    const mat = JSON.parse(matRes.body);
    expect(mat.id).toBeDefined();

    // 2. Registrar Lote em Quarentena
    const batchRes = await app.inject({
      method: 'POST',
      url: '/api/compounding/batches',
      payload: {
        raw_material_id: mat.id,
        batch_number: 'LOTE-D3-2026',
        supplier: 'DSM Nutritional',
        potency_percent: 100.0,
        moisture_percent: 0.0,
        report_number: 'LAUDO-D3-889',
        expiration_date: '2028-12-31',
        current_stock: 1000.0,
      },
    });

    expect(batchRes.statusCode).toBe(201);
    const batch = JSON.parse(batchRes.body);
    expect(batch.status).toBe('QUARANTINE');

    // 3. Liberar Lote
    const releaseRes = await app.inject({
      method: 'POST',
      url: `/api/compounding/batches/${batch.id}/release`,
      payload: { pharmacistName: 'DRA_MARIANA_CRF_12345' },
    });

    expect(releaseRes.statusCode).toBe(200);
    const released = JSON.parse(releaseRes.body);
    expect(released.status).toBe('APPROVED');
    expect(released.released_by).toBe('DRA_MARIANA_CRF_12345');
  });

  it('should calculate capsule size and execute full compounding order lifecycle', async () => {
    // 1. Matéria Prima + Lote Aprovado
    const matRes = await app.inject({
      method: 'POST',
      url: '/api/compounding/raw-materials',
      payload: {
        name: 'Resveratrol 98%',
        apparent_density: 0.60,
        cost_per_unit: 0.05,
      },
    });
    const mat = JSON.parse(matRes.body);

    const batchRes = await app.inject({
      method: 'POST',
      url: '/api/compounding/batches',
      payload: {
        raw_material_id: mat.id,
        batch_number: 'LOTE-RESV-01',
        supplier: 'Fagron',
        potency_percent: 98.0,
        moisture_percent: 1.0,
        report_number: 'LAUDO-RESV',
        expiration_date: '2028-06-30',
        current_stock: 500.0,
      },
    });
    const batch = JSON.parse(batchRes.body);

    await app.inject({
      method: 'POST',
      url: `/api/compounding/batches/${batch.id}/release`,
      payload: { pharmacistName: 'DRA_MARIANA' },
    });

    // 2. Testar Calculadora de Cápsulas
    const calcRes = await app.inject({
      method: 'POST',
      url: '/api/compounding/calculate-capsule',
      payload: {
        components: [{ massMg: 150, apparentDensity: 0.60 }],
        totalUnits: 30,
      },
    });
    expect(calcRes.statusCode).toBe(200);
    const calcData = JSON.parse(calcRes.body);
    expect(calcData.selectedCapsuleSize).toBeDefined();

    // 3. Criar Ordem de Manipulação
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/compounding/orders',
      payload: {
        orderData: {
          patient_name: 'Guilherme Santos',
          prescriber_name: 'Dr. Leonardo Meireles',
          prescriber_crm: '67890',
          prescriber_uf: 'SP',
          pharmaceutical_form: 'CAPSULA',
          total_units: 30,
          directions: 'Tomar 1 cápsula à noite',
        },
        components: [{ rawMaterialId: mat.id, prescribedDose: 150 }],
      },
    });

    expect(orderRes.statusCode).toBe(201);
    const order = JSON.parse(orderRes.body);
    expect(order.status).toBe('AWAITING_WEIGHING');
    expect(order.items.length).toBe(1);

    // 4. Pesar Item
    const itemId = order.items[0].id;
    const weighRes = await app.inject({
      method: 'POST',
      url: `/api/compounding/orders/${order.id}/weigh-item`,
      payload: {
        itemId,
        weighedAmount: order.items[0].total_dose_to_weigh,
        operatorName: 'MANIPULADOR_PEDRO',
      },
    });
    expect(weighRes.statusCode).toBe(200);
    const weighed = JSON.parse(weighRes.body);
    expect(weighed.status).toBe('QUALITY_CONTROL');

    // 5. Controle de Qualidade
    const targetWeight = weighed.target_weight_per_unit || 300.0;
    const qcRes = await app.inject({
      method: 'POST',
      url: `/api/compounding/orders/${order.id}/quality-control`,
      payload: {
        actualAverageWeightMg: targetWeight,
        pharmacistName: 'DRA_MARIANA',
      },
    });
    expect(qcRes.statusCode).toBe(200);
    const qcApproved = JSON.parse(qcRes.body);
    expect(qcApproved.status).toBe('READY');
    expect(qcApproved.quality_status).toBe('APPROVED');

    // 6. Obter Rótulo Magistral Oficial RDC 67
    const labelRes = await app.inject({
      method: 'GET',
      url: `/api/compounding/orders/${order.id}/label`,
    });
    expect(labelRes.statusCode).toBe(200);
    const labelData = JSON.parse(labelRes.body);
    expect(labelData.labelText).toContain('FARMACORE FARMACIA MAGISTRAL');
    expect(labelData.labelText).toContain('PACIENTE: GUILHERME SANTOS');
    expect(labelData.labelText).toContain('Tomar 1 cápsula à noite');
  });
});
