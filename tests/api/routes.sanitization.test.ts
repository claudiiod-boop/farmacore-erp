import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Sanitização, Dedetização & POPs (Fase 37)', () => {
  let app: FastifyInstance;
  let db: Database;
  let storeId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. POST /api/sanitization/logs deve registrar higienização e permitir homologação pelo RT', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/sanitization/logs',
      payload: {
        storeId,
        sectorName: 'SALA_INJETAIS',
        cleaningType: 'TERMINAL',
        chemicalProduct: 'Quaternário de Amônio',
        performedBy: 'Joana Auxiliar',
        notes: 'Limpeza minuciosa de bancadas e piso',
      },
    });

    expect(postRes.statusCode).toBe(201);
    const log = JSON.parse(postRes.body);
    expect(log.id).toBeGreaterThan(0);
    expect(log.sector_name).toBe('SALA_INJETAIS');
    expect(log.status).toBe('COMPLETED');

    // RT homologa
    const verifyRes = await app.inject({
      method: 'POST',
      url: `/api/sanitization/logs/${log.id}/verify`,
      payload: {
        pharmacistCrf: 'CRF-SP 98765',
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verified = JSON.parse(verifyRes.body);
    expect(verified.verified_by_pharmacist).toBe('CRF-SP 98765');
  });

  it('2. GET /api/sanitization/logs deve listar com filtros', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/sanitization/logs',
      payload: {
        storeId,
        sectorName: 'ESTOQUE_CENTRAL',
        cleaningType: 'ROUTINE',
        chemicalProduct: 'Álcool 70%',
        performedBy: 'Carlos',
      },
    });

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/sanitization/logs?storeId=${storeId}&sectorName=ESTOQUE_CENTRAL`,
    });

    expect(getRes.statusCode).toBe(200);
    const logs = JSON.parse(getRes.body);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].sector_name).toBe('ESTOQUE_CENTRAL');
  });

  it('3. POST /api/sanitization/pest-control e GET active', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/sanitization/pest-control',
      payload: {
        storeId,
        serviceProviderName: 'PragaZero Dedetizações',
        serviceProviderCnpj: '44.555.666/0001-77',
        sanitaryLicenseNumber: 'VISA-SP-9988',
        certificateNumber: 'CERT-2026-009',
        applicationDate: '2026-11-24',
        targetPests: 'Baratas e Roedores',
        chemicalAgentsUsed: 'Deltametrina 2.5%',
        technicalResponsiblePest: 'Eng. Agrônomo CREA 12345',
        pharmacistApprovalCrf: 'CRF-SP 98765',
      },
    });

    expect(postRes.statusCode).toBe(201);
    const cert = JSON.parse(postRes.body);
    expect(cert.status).toBe('VALID');

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/sanitization/pest-control/active?storeId=${storeId}`,
    });

    expect(getRes.statusCode).toBe(200);
    const active = JSON.parse(getRes.body);
    expect(active.certificate_number).toBe('CERT-2026-009');
  });

  it('4. POST /api/sanitization/water-tank e GET active', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/sanitization/water-tank',
      payload: {
        storeId,
        serviceProvider: 'AquaClean Engenharia',
        cleaningDate: '2026-11-24',
        potabilityReportNumber: 'LAUDO-MICRO-991',
        potabilityStatus: 'POTABLE_COMPLIANT',
        responsibleCleaner: 'Severino',
        pharmacistCrf: 'CRF-SP 98765',
      },
    });

    expect(postRes.statusCode).toBe(201);
    const tank = JSON.parse(postRes.body);
    expect(tank.status).toBe('VALID');

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/sanitization/water-tank/active?storeId=${storeId}`,
    });

    expect(getRes.statusCode).toBe(200);
    const active = JSON.parse(getRes.body);
    expect(active.service_provider).toBe('AquaClean Engenharia');
  });

  it('5. POST & GET /api/sanitization/sops e /api/sanitization/compliance-overview', async () => {
    // Cadastrar POP
    const sopRes = await app.inject({
      method: 'POST',
      url: '/api/sanitization/sops',
      payload: {
        storeId,
        sopCode: 'POP-AMB-001',
        title: 'Higienização e Assepsia Geral',
        category: 'HIGIENE_AMBIENTAL',
        version: '1.0',
        effectiveDate: '2026-11-24',
        authorName: 'Farm. Lívia',
        reviewerPharmacistCrf: 'CRF-SP 98765',
        contentSummary: 'Procedimentos e saneantes aprovados',
      },
    });

    expect(sopRes.statusCode).toBe(201);
    const sop = JSON.parse(sopRes.body);
    expect(sop.status).toBe('ACTIVE');

    // Listar POPs
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/sanitization/sops?storeId=${storeId}`,
    });
    expect(listRes.statusCode).toBe(200);
    const sops = JSON.parse(listRes.body);
    expect(sops.length).toBeGreaterThanOrEqual(1);

    // Compliance Overview
    const compRes = await app.inject({
      method: 'GET',
      url: `/api/sanitization/compliance-overview?storeId=${storeId}`,
    });
    expect(compRes.statusCode).toBe(200);
    const overview = JSON.parse(compRes.body);
    expect(overview).toHaveProperty('score');
    expect(overview).toHaveProperty('overallCompliant');
    expect(overview.sops.totalActive).toBeGreaterThanOrEqual(1);
  });
});
