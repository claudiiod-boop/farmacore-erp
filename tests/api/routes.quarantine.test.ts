import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Quarentena Sanitária & Alertas Notivisa (Fase 33)', () => {
  let app: FastifyInstance;
  let db: Database;
  let storeId: number;
  let prodId: number;
  let batchId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    const pRes = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('Ciprofloxacino 500mg 14 comp', '7891234999888', 'Ciprofloxacino', '1004300077', 'VERMELHA', 'NONE', 35.0, 12.0, 22.0)
    `).run();
    prodId = Number(pRes.lastInsertRowid);

    const bRes = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'L-CIPRO-01', '2026-01-01', '2028-01-01', 40)
    `).run(prodId);
    batchId = Number(bRes.lastInsertRowid);

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. POST /api/quarantine/transfer deve segregar lote e deduzir saldo vendável', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/quarantine/transfer',
      payload: {
        storeId,
        productId: prodId,
        batchId,
        quantity: 15,
        reason: 'DAMAGED',
        origin: 'MANUAL',
        notes: 'Avaria na embalagem secundária',
        quarantinedBy: 'Dra. Beatriz - Farmacêutica RT',
      },
    });

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.body);
    expect(data.quarantineId).toBeGreaterThan(0);
    expect(data.quantity).toBe(15);
    expect(data.status).toBe('QUARANTINED');

    // Verifica dedução no banco
    const batch = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(batchId) as { quantity: number };
    expect(batch.quantity).toBe(25); // 40 - 15
  });

  it('2. POST /api/quarantine/sweep-expired deve varrer lotes vencidos e mover para quarentena', async () => {
    // Inserir lote já vencido
    db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'L-CIPRO-EXP', '2024-01-01', '2025-01-01', 8)
    `).run(prodId);

    const res = await app.inject({
      method: 'POST',
      url: '/api/quarantine/sweep-expired',
      payload: {
        storeId,
        sweptBy: 'Auditoria Diária de Validades',
      },
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.sweptBatchesCount).toBeGreaterThanOrEqual(1);
    expect(data.totalUnitsQuarantined).toBeGreaterThanOrEqual(8);
  });

  it('3. POST /api/quarantine/recalls e GET /api/quarantine/recalls deve registrar recall e listar', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/quarantine/recalls',
      payload: {
        anvisaReNumber: 'RE 8.765/2026',
        publicationDate: '2026-11-24',
        productId: prodId,
        batchNumber: 'L-CIPRO-01',
        reason: 'Suspeita de contaminação por partículas',
        severity: 'CRITICAL',
        createdBy: 'Farmacovigilância ANVISA',
        autoBlockStock: true,
      },
    });

    expect(postRes.statusCode).toBe(201);
    const recall = JSON.parse(postRes.body);
    expect(recall.recallId).toBeGreaterThan(0);
    expect(recall.unitsBlocked).toBe(40);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/quarantine/recalls',
    });
    expect(getRes.statusCode).toBe(200);
    const list = JSON.parse(getRes.body);
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((r: any) => r.anvisa_re_number === 'RE 8.765/2026')).toBe(true);
  });

  it('4. POST /api/quarantine/:id/resolve deve encaminhar lote para descarte PGRSS e retornar KPIs', async () => {
    // 1. Transferir para quarentena
    const transferRes = await app.inject({
      method: 'POST',
      url: '/api/quarantine/transfer',
      payload: {
        storeId,
        productId: prodId,
        batchId,
        quantity: 10,
        reason: 'TEMPERATURE_EXCURSION',
        origin: 'INBOUND_INSPECTION',
        quarantinedBy: 'Fiscal RT',
      },
    });
    const { quarantineId } = JSON.parse(transferRes.body);

    // 2. Resolver com DISPOSED_PGRSS
    const resolveRes = await app.inject({
      method: 'POST',
      url: `/api/quarantine/${quarantineId}/resolve`,
      payload: {
        resolution: 'DISPOSED_PGRSS',
        resolvedBy: 'Dra. Clara - CRF/SP 12345',
        pharmacistCrf: 'CRF/SP 12345',
        resolutionNotes: 'Encaminhado ao abrigo de resíduos químicos Grupo B',
      },
    });

    expect(resolveRes.statusCode).toBe(200);
    const resolved = JSON.parse(resolveRes.body);
    expect(resolved.status).toBe('DISPOSED_PGRSS');
    expect(resolved.pgrss_disposal_id).toBeDefined();

    // 3. Consultar KPIs
    const kpiRes = await app.inject({
      method: 'GET',
      url: `/api/quarantine/kpis?storeId=${storeId}`,
    });
    expect(kpiRes.statusCode).toBe(200);
    const kpis = JSON.parse(kpiRes.body);
    expect(kpis.disposed_pgrss_items).toBe(10);
  });
});
