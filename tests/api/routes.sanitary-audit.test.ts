import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerSanitaryAuditRoutes } from '../../src/modules/sanitary-audit/sanitary-audit.routes';

describe('Fastify REST API: Sanitary Audit & Auto-inspection Dossier Routes', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    // Loja padrão
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj)
      VALUES (1, 'Drogaria Matriz FarmaCore', '98.765.432/0001-88')
    `).run();

    app = fastify();
    registerSanitaryAuditRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('POST /api/v1/sanitary-audit/scan executa varredura e GET /history lista', async () => {
    const scanRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sanitary-audit/scan',
      payload: {
        store_id: '1',
        responsible_pharmacist_crf: 'CRF-SP 99999',
        responsible_pharmacist_name: 'Dr. Leonardo Farmacêutico'
      }
    });

    expect(scanRes.statusCode).toBe(200);
    const scanBody = JSON.parse(scanRes.body);
    expect(scanBody.success).toBe(true);
    expect(scanBody.data.id).toBeDefined();
    expect(scanBody.data.responsible_pharmacist_crf).toBe('CRF-SP 99999');

    // Listar histórico
    const histRes = await app.inject({
      method: 'GET',
      url: '/api/v1/sanitary-audit/history?store_id=1'
    });

    expect(histRes.statusCode).toBe(200);
    const histBody = JSON.parse(histRes.body);
    expect(histBody.success).toBe(true);
    expect(histBody.data).toHaveLength(1);
  });

  it('GET /api/v1/sanitary-audit/:id/dossier gera dossiê oficial e dashboard traz KPIs', async () => {
    // 1. Cria scan
    const scanRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sanitary-audit/scan',
      payload: {
        store_id: '1',
        responsible_pharmacist_crf: 'CRF-SP 99999',
        responsible_pharmacist_name: 'Dr. Leonardo Farmacêutico'
      }
    });
    const auditId = JSON.parse(scanRes.body).data.id;

    // 2. Consulta dossiê
    const dossierRes = await app.inject({
      method: 'GET',
      url: `/api/v1/sanitary-audit/${auditId}/dossier`
    });

    expect(dossierRes.statusCode).toBe(200);
    const dossierBody = JSON.parse(dossierRes.body);
    expect(dossierBody.success).toBe(true);
    expect(dossierBody.data.officialReportText).toContain('DOSSIÊ OFICIAL DE AUTOINSPEÇÃO SANITÁRIA');
    expect(dossierBody.data.dossierSummary.pillars).toHaveLength(6);

    // 3. Consulta dashboard
    const dashRes = await app.inject({
      method: 'GET',
      url: '/api/v1/sanitary-audit/dashboard?store_id=1'
    });

    expect(dashRes.statusCode).toBe(200);
    const dashBody = JSON.parse(dashRes.body);
    expect(dashBody.success).toBe(true);
    expect(dashBody.data.total_audits_performed).toBe(1);
    expect(dashBody.data.last_audit_score).toBeDefined();
  });
});
