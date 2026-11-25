import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerBackupRoutes } from '../../src/modules/backup/backup.routes';

describe('Backup & LGPD REST Routes', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO pre_sales (id, code, customer_name, customer_cpf, total_amount)
      VALUES (1, 'PV-100', 'Maria Souza', '987.654.321-00', 40.0)
    `).run();

    app = fastify();
    await registerBackupRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. POST /api/backup/create - cria snapshot e GET /api/backup/list lista', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/backup/create',
      payload: { backupType: 'FULL', encrypt: true, operatorName: 'Admin' },
    });
    expect(postRes.statusCode).toBe(201);
    const backup = JSON.parse(postRes.payload);
    expect(backup.id).toBeGreaterThan(0);
    expect(backup.is_encrypted).toBe(1);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/backup/list',
    });
    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.payload);
    expect(list.length).toBe(1);
  });

  it('2. POST /api/backup/:id/verify e restore', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/backup/create',
    });
    const backup = JSON.parse(postRes.payload);

    const verifyRes = await app.inject({
      method: 'POST',
      url: `/api/backup/${backup.id}/verify`,
      payload: { operatorName: 'Auditor' },
    });
    expect(verifyRes.statusCode).toBe(200);
    const verifyData = JSON.parse(verifyRes.payload);
    expect(verifyData.overallStatus).toBe('VALID');

    const restoreRes = await app.inject({
      method: 'POST',
      url: `/api/backup/${backup.id}/restore`,
      payload: { operatorName: 'Admin' },
    });
    expect(restoreRes.statusCode).toBe(200);
    const restoreData = JSON.parse(restoreRes.payload);
    expect(restoreData.success).toBe(true);
  });

  it('3. GET /api/lgpd/dossier/:cpf e POST /api/lgpd/anonymize', async () => {
    const dossierRes = await app.inject({
      method: 'GET',
      url: '/api/lgpd/dossier/987.654.321-00',
    });
    expect(dossierRes.statusCode).toBe(200);
    const dossier = JSON.parse(dossierRes.payload);
    expect(dossier.name).toBe('Maria Souza');
    expect(dossier.salesCount).toBe(1);

    const anonRes = await app.inject({
      method: 'POST',
      url: '/api/lgpd/anonymize',
      payload: { cpf: '987.654.321-00', operatorName: 'DPO', reason: 'Solicitado pelo titular' },
    });
    expect(anonRes.statusCode).toBe(200);
    const anonData = JSON.parse(anonRes.payload);
    expect(anonData.anonymized).toBe(true);
  });

  it('4. GET /api/backup/kpis e GET /api/backup/config', async () => {
    const kpiRes = await app.inject({
      method: 'GET',
      url: '/api/backup/kpis',
    });
    expect(kpiRes.statusCode).toBe(200);
    const kpis = JSON.parse(kpiRes.payload);
    expect(kpis.retentionDays).toBeDefined();

    const configRes = await app.inject({
      method: 'GET',
      url: '/api/backup/config',
    });
    expect(configRes.statusCode).toBe(200);
  });
});
