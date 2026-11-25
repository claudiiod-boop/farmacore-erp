import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerFarmaciaPopularAuditRoutes } from '../../src/modules/pbm/farmacia-popular-audit.routes';

describe('Farmácia Popular Audit & Dossier REST API Routes', () => {
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

    app = fastify();
    registerFarmaciaPopularAuditRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    if (app) await app.close();
    if (db) db.close();
  });

  it('POST /api/v1/farmacia-popular/settlements/import - importa lote FNS com identificação de glosa', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/farmacia-popular/settlements/import',
      payload: {
        store_id: 1,
        batch_reference: 'FNS-LOTE-2026-10',
        competence_month: '2026-10',
        credit_date: '2026-11-15',
        items: [
          {
            authorization_code: 'AUTH-API-001',
            patient_cpf: '123.456.789-00',
            patient_name: 'Mariana Rios',
            prescriber_crm: '88776',
            prescriber_uf: 'SP',
            authorized_ms_amount: 150.0,
            credited_fns_amount: 120.0,
            gloss_reason: 'Divergência de posologia diária'
          }
        ]
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.batch_reference).toBe('FNS-LOTE-2026-10');
    expect(body.data.total_loss_amount).toBe(30.0);
    expect(body.data.status).toBe('DISCREPANT');
  });

  it('GET /api/v1/farmacia-popular/settlements/items - lista itens de auditoria', async () => {
    // Importa lote primeiro
    await app.inject({
      method: 'POST',
      url: '/api/v1/farmacia-popular/settlements/import',
      payload: {
        store_id: 1,
        batch_reference: 'FNS-LOTE-LIST',
        competence_month: '2026-10',
        credit_date: '2026-11-15',
        items: [
          {
            authorization_code: 'AUTH-API-002',
            patient_cpf: '987.654.321-99',
            patient_name: 'Felipe Melo',
            prescriber_crm: '11223',
            prescriber_uf: 'RJ',
            authorized_ms_amount: 80.0,
            credited_fns_amount: 80.0
          }
        ]
      }
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/farmacia-popular/settlements/items?store_id=1'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].authorization_code).toBe('AUTH-API-002');
  });

  it('POST /api/v1/farmacia-popular/glosas/:id/contest - contesta glosa administrativa', async () => {
    const importRes = await app.inject({
      method: 'POST',
      url: '/api/v1/farmacia-popular/settlements/import',
      payload: {
        store_id: 1,
        batch_reference: 'FNS-LOTE-GLOSS',
        competence_month: '2026-10',
        credit_date: '2026-11-15',
        items: [
          {
            authorization_code: 'AUTH-CONTEST-99',
            patient_cpf: '555.444.333-22',
            patient_name: 'Tatiana Moura',
            prescriber_crm: '44556',
            prescriber_uf: 'MG',
            authorized_ms_amount: 100.0,
            credited_fns_amount: 0.0,
            gloss_reason: 'Receita médica vencida'
          }
        ]
      }
    });

    const itemsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/farmacia-popular/settlements/items?store_id=1'
    });
    const itemId = JSON.parse(itemsRes.payload).data.find((i: any) => i.authorization_code === 'AUTH-CONTEST-99').id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/farmacia-popular/glosas/${itemId}/contest`,
      payload: {
        justification: 'Receita médica emitida no dia anterior à dispensação, válida conforme Portaria 5/2017'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('CONTESTED');
    expect(body.data.contest_protocol).toMatch(/^CONTEST-MS-\d+$/);
  });

  it('POST /api/v1/farmacia-popular/dossiers - arquiva comprovante digital de 5 anos', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/farmacia-popular/dossiers',
      payload: {
        store_id: 1,
        authorization_code: 'AUTH-DOSSIER-100',
        patient_cpf: '777.888.999-00',
        patient_name: 'Lucas Paiva',
        dispensation_date: '2026-11-25',
        signed_coupon_file_path: '/docs/cupom_100.pdf',
        prescription_file_path: '/docs/receita_100.pdf'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.retention_deadline).toBe('2031-11-25');
    expect(body.data.status).toBe('ARCHIVED');
    expect(body.data.sha256_integrity_hash).toBeDefined();
  });

  it('GET /api/v1/farmacia-popular/kpis - métricas consolidadas', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/farmacia-popular/kpis?store_id=1'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.total_batches).toBeDefined();
    expect(body.data.total_credited_amount).toBeDefined();
    expect(body.data.gloss_rate_percentage).toBeDefined();
  });
});
