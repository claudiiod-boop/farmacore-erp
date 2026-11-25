import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerCorporateAgreementsRoutes } from '../../src/modules/agreements/agreements.routes';

describe('Corporate Agreements & Payroll Billing REST API Routes', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    // Seed dados base
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj) VALUES (1, 'Matriz Farma', '11.111.111/0001-11')
    `).run();

    db.prepare(`
      INSERT INTO corporate_agreements (
        id, code, company_name, trade_name, cnpj, street, number, neighborhood, city, state, zip_code, closing_day, due_day, credit_limit, is_active
      ) VALUES (
        1, 'CONV-IND-01', 'Metalúrgica Paulista LTDA', 'MetalPaulista', '12.345.678/0001-99',
        'Av Industrial', '100', 'Centro', 'São Paulo', 'SP', '01000-000', 20, 5, 50000.0, 1
      )
    `).run();

    db.prepare(`
      INSERT INTO customers (
        id, store_id, name, cpf, agreement_id, registration_number, credit_limit, current_debt, status
      ) VALUES
        (1, 1, 'Carlos Eduardo Souza', '111.222.333-44', 1, 'MATR-1001', 500.0, 0.0, 'ACTIVE')
    `).run();

    db.prepare(`
      INSERT INTO sales (
        id, total_amount, created_at
      ) VALUES
        (1, 150.0, '2026-11-10 14:30:00')
    `).run();

    db.prepare(`
      INSERT INTO customer_receivables (
        id, customer_id, sale_id, agreement_id, installment_number, total_installments, due_date, original_amount, paid_amount, status, created_at
      ) VALUES
        (1, 1, 1, 1, 1, 1, '2026-12-05', 150.0, 0.0, 'OPEN', '2026-11-10 14:30:00')
    `).run();

    app = fastify();
    registerCorporateAgreementsRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('POST /api/v1/agreements/invoices/generate - gera fatura com sucesso', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agreements/invoices/generate',
      payload: {
        agreement_id: 1,
        period_start: '2026-11-01',
        period_end: '2026-11-20',
        due_date: '2026-12-05'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.invoice_number).toMatch(/^FAT-202611-\d{4}$/);
    expect(body.data.total_amount).toBe(150.0);
  });

  it('POST /api/v1/agreements/invoices/batch-billing - processa faturamento em lote', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agreements/invoices/batch-billing',
      payload: {
        period_start: '2026-11-01',
        period_end: '2026-11-20',
        due_date: '2026-12-05'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].agreement_id).toBe(1);
  });

  it('GET /api/v1/agreements/invoices/:id/payroll-export - exporta espelho para RH em JSON e CSV', async () => {
    // Primeiro gera a fatura
    const genRes = await app.inject({
      method: 'POST',
      url: '/api/v1/agreements/invoices/generate',
      payload: {
        agreement_id: 1,
        period_start: '2026-11-01',
        period_end: '2026-11-20',
        due_date: '2026-12-05'
      }
    });
    const invId = JSON.parse(genRes.payload).data.id;

    // Exporta JSON
    const jsonRes = await app.inject({
      method: 'GET',
      url: `/api/v1/agreements/invoices/${invId}/payroll-export`
    });
    expect(jsonRes.statusCode).toBe(200);
    const jsonBody = JSON.parse(jsonRes.payload);
    expect(jsonBody.data.totalEmployees).toBe(1);
    expect(jsonBody.data.totalAmount).toBe(150.0);

    // Exporta CSV
    const csvRes = await app.inject({
      method: 'GET',
      url: `/api/v1/agreements/invoices/${invId}/payroll-export?format=csv`
    });
    expect(csvRes.statusCode).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.payload).toContain('MATRICULA;CPF;NOME_COLABORADOR');
    expect(csvRes.payload).toContain('MATR-1001;111.222.333-44;Carlos Eduardo Souza');
  });

  it('POST /api/v1/agreements/invoices/:id/settle - liquida fatura corporativa', async () => {
    const genRes = await app.inject({
      method: 'POST',
      url: '/api/v1/agreements/invoices/generate',
      payload: {
        agreement_id: 1,
        period_start: '2026-11-01',
        period_end: '2026-11-20',
        due_date: '2026-12-05'
      }
    });
    const invId = JSON.parse(genRes.payload).data.id;

    const settleRes = await app.inject({
      method: 'POST',
      url: `/api/v1/agreements/invoices/${invId}/settle`,
      payload: {
        paid_date: '2026-12-04',
        notes: 'Pago via PIX PJ'
      }
    });

    expect(settleRes.statusCode).toBe(200);
    const body = JSON.parse(settleRes.payload);
    expect(body.data.status).toBe('PAID');
    expect(body.data.paid_at).toBe('2026-12-04');
  });

  it('GET /api/v1/agreements/eligibility/:customerId - checa limite e inadimplência', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/agreements/eligibility/1?sale_amount=100'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.eligible).toBe(true);
    expect(body.data.remainingCreditLimit).toBe(500.0);
  });

  it('GET /api/v1/agreements/kpis - retorna indicadores de convênios', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/agreements/kpis'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.total_agreements_active).toBe(1);
    expect(body.data.active_employees_count).toBe(1);
  });
});
