import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerScaleRoutes } from '../../src/modules/scales/scale.routes';

describe('Precision Scale & Weighted Barcode Checkout REST API Routes', () => {
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
      INSERT INTO products (
        id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price
      ) VALUES (
        42, '7890000000042', 'Composto Antioxidante Manipulado 100g', 'Antioxidante', 'ISENTO', 'SEM_TARJA', 'NONE', 20.0, 10.0, 16.0
      )
    `).run();

    app = fastify();
    registerScaleRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    if (app) await app.close();
    if (db) db.close();
  });

  it('POST /api/v1/scales/devices - cadastra balança serial com selo INMETRO', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/scales/devices',
      payload: {
        store_id: 1,
        pos_station_id: 'CHECKOUT_01',
        name: 'Toledo Prix 3 Fit',
        model: 'Prix 3 Fit',
        manufacturer: 'Toledo',
        protocol: 'TOLEDO_PRIIX3',
        serial_port: 'COM1',
        baud_rate: 9600,
        inmetro_seal_number: 'INMETRO-BR-2026-9988',
        max_capacity_kg: 15.0,
        division_grams: 5.0
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.inmetro_seal_number).toBe('INMETRO-BR-2026-9988');
    expect(body.data.is_active).toBe(1);
  });

  it('GET /api/v1/scales/devices/:id/read - leitura serial simulada com tara e estabilidade', async () => {
    const devRes = await app.inject({
      method: 'POST',
      url: '/api/v1/scales/devices',
      payload: {
        store_id: 1,
        pos_station_id: 'MANIPULACAO_01',
        name: 'Urano Pop-Z',
        serial_port: 'COM3',
        inmetro_seal_number: 'INMETRO-URANO-7744'
      }
    });
    const deviceId = JSON.parse(devRes.payload).data.id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/scales/devices/${deviceId}/read?gross=350&tare=50`
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.gross_weight_grams).toBe(350);
    expect(body.data.tare_grams).toBe(50);
    expect(body.data.net_weight_grams).toBe(300);
    expect(body.data.is_stable).toBe(true);
  });

  it('POST /api/v1/scales/labels/generate - gera etiqueta térmica de pesagem ZPL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/scales/labels/generate',
      payload: {
        product_id: 42,
        batch_number: 'LOTE-MANIP-2026',
        gross_weight_grams: 250,
        tare_grams: 20
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.barcode).toMatch(/^200042\d{6}\d$/);
    expect(body.data.net_weight_grams).toBe(230);
    expect(body.data.thermal_label_zpl).toContain('^XA');
  });

  it('POST /api/v1/scales/barcodes/decode - decodifica código de barras pesável EAN-13 no checkout', async () => {
    // 2 (prefixo) + 00042 (5 dig produto) + 001600 (R$ 16,00) + DV 9 = 2000420016009
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/scales/barcodes/decode',
      payload: {
        barcode: '2000420016009',
        store_id: 1
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.is_weighted).toBe(true);
    expect(body.data.product_id).toBe(42);
    expect(body.data.total_price).toBe(16.0);
    expect(body.data.calculated_quantity).toBe(1.0);
  });

  it('GET /api/v1/scales/kpis - obtém métricas operacionais de pesagens e balanças', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scales/kpis?store_id=1'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.total_scales).toBeDefined();
    expect(body.data.active_scales).toBeDefined();
    expect(body.data.total_weighings_today).toBeDefined();
    expect(body.data.total_weighted_sales_amount_today).toBeDefined();
  });
});
