import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Balanços Oficiais BMPO, RMNRA & RMNRB (Fase 29)', () => {
  let app: FastifyInstance;
  let db: Database;
  let storeId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    // Criar produto controlado
    const pRes = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, category)
      VALUES ('Diazepam 10mg 30 comp', '7891234999111', 'Diazepam', '100000004', 'PRETA', 'B1', 20.0, 8.0, 15.0, 'GENERICO')
    `).run();
    const prodId = Number(pRes.lastInsertRowid);

    db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (?, 'L-DIAZ-01', '2024-01-01', '2027-01-01', 50, ?)
    `).run(prodId, storeId);

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. POST /api/regulatory/bmpo e GET /api/regulatory/reports/:id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/regulatory/bmpo',
      payload: {
        storeId,
        reportType: 'BMPO_TRIMESTRAL',
        periodYear: 2026,
        periodQuarter: 4,
        pharmacistName: 'Dra. Vanessa',
        pharmacistCrf: 'CRF-SP 55443',
        observations: 'Fechamento do 4º Tri',
      },
    });

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.body);
    expect(data.id).toBeDefined();
    expect(data.report_type).toBe('BMPO_TRIMESTRAL');
    expect(data.items.length).toBeGreaterThanOrEqual(1);

    // GET por ID
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/regulatory/reports/${data.id}`,
    });
    expect(getRes.statusCode).toBe(200);
    const getData = JSON.parse(getRes.body);
    expect(getData.id).toBe(data.id);
  });

  it('2. PATCH /api/regulatory/reports/:id/file-visa e GET /api/regulatory/reports/:id/print', async () => {
    // 1. Criar relatório
    const res = await app.inject({
      method: 'POST',
      url: '/api/regulatory/bmpo',
      payload: {
        storeId,
        reportType: 'BMPO_ANUAL',
        periodYear: 2026,
        pharmacistName: 'Dr. Paulo',
        pharmacistCrf: 'CRF-MG 22331',
      },
    });
    const data = JSON.parse(res.body);

    // 2. Protocolar na VISA
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/regulatory/reports/${data.id}/file-visa`,
      payload: {
        visaProtocolNumber: 'PROTO-VISA-2026-0099',
        visaFilingDate: '2026-11-23',
        observations: 'Entregue fisicamente em 2 vias',
      },
    });
    expect(patchRes.statusCode).toBe(200);
    const filed = JSON.parse(patchRes.body);
    expect(filed.status).toBe('FILED_WITH_VISA');
    expect(filed.visa_protocol_number).toBe('PROTO-VISA-2026-0099');

    // 3. Documento de Impressão
    const printRes = await app.inject({
      method: 'GET',
      url: `/api/regulatory/reports/${data.id}/print`,
    });
    expect(printRes.statusCode).toBe(200);
    const printData = JSON.parse(printRes.body);
    expect(printData.document).toContain('PORTARIA SVS/MS Nº 344/1998');
    expect(printData.document).toContain('PROTO-VISA-2026-0099');
  });

  it('3. GET /api/regulatory/kpis e DELETE /api/regulatory/reports/:id', async () => {
    // Criar relatório rascunho
    const res = await app.inject({
      method: 'POST',
      url: '/api/regulatory/bmpo',
      payload: {
        storeId,
        reportType: 'BMPO_TRIMESTRAL',
        periodYear: 2026,
        periodQuarter: 1,
        pharmacistName: 'Dra. Camila',
        pharmacistCrf: 'CRF-SP 12345',
      },
    });
    const report = JSON.parse(res.body);

    // KPIs
    const kpiRes = await app.inject({
      method: 'GET',
      url: `/api/regulatory/kpis?storeId=${storeId}`,
    });
    expect(kpiRes.statusCode).toBe(200);
    const kpis = JSON.parse(kpiRes.body);
    expect(kpis.total_reports).toBeGreaterThanOrEqual(1);

    // Delete rascunho
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/regulatory/reports/${report.id}`,
    });
    expect(delRes.statusCode).toBe(204);
  });
});
