import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerDdaRoutes } from '../../src/modules/financial/dda.routes';

describe('Fastify REST API: DDA Bank Slips Reconciliation Routes', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    // Loja padrão
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj)
      VALUES (1, 'Farmácia Matriz', '98.765.432/0001-88')
    `).run();

    // Compra para teste de conciliação
    db.prepare(`
      INSERT INTO purchase_invoices (
        id, access_key, invoice_number, invoice_series, issue_date,
        supplier_cnpj, supplier_name, total_invoice_amount, total_products_amount, xml_content
      ) VALUES (
        1, '35261111111111111111550010000012341001234567', 1234, 1, '2026-11-20',
        '12.345.678/0001-99', 'Distribuidora Panpharma', 3200.00, 3200.00, '<xml></xml>'
      )
    `).run();

    app = fastify();
    registerDdaRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('POST /api/v1/dda/import-file importa boletos e GET /api/v1/dda/invoices lista', async () => {
    const importRes = await app.inject({
      method: 'POST',
      url: '/api/v1/dda/import-file',
      payload: {
        store_id: '1',
        items: [
          {
            bank_code: '001',
            bank_name: 'Banco do Brasil',
            barcode: '00191234567890123456789012345678901234567890',
            digitable_line: '00190.00009 01234.567890 12345.678901 2 89012345678901',
            beneficiary_cnpj: '12.345.678/0001-99',
            beneficiary_name: 'Distribuidora Panpharma',
            payer_cnpj: '98765432000188',
            due_date: '2026-12-15',
            issue_date: '2026-11-20',
            nominal_amount: 3200.00
          }
        ]
      }
    });

    expect(importRes.statusCode).toBe(200);
    const importBody = JSON.parse(importRes.body);
    expect(importBody.success).toBe(true);
    expect(importBody.data).toHaveLength(1);

    // Listar
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/dda/invoices?store_id=1'
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    expect(listBody.success).toBe(true);
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0].beneficiary_name).toBe('Distribuidora Panpharma');
  });

  it('POST /api/v1/dda/reconcile-auto executa o motor e GET /api/v1/dda/kpis traz métricas', async () => {
    // Importa primeiro
    await app.inject({
      method: 'POST',
      url: '/api/v1/dda/import-file',
      payload: {
        store_id: '1',
        items: [
          {
            bank_code: '001',
            bank_name: 'Banco do Brasil',
            barcode: '00191234567890123456789012345678901234567890',
            digitable_line: '00190.00009 01234.567890 12345.678901 2 89012345678901',
            beneficiary_cnpj: '12.345.678/0001-99',
            beneficiary_name: 'Distribuidora Panpharma',
            payer_cnpj: '98765432000188',
            due_date: '2026-12-15',
            issue_date: '2026-11-20',
            nominal_amount: 3200.00
          }
        ]
      }
    });

    const reconcileRes = await app.inject({
      method: 'POST',
      url: '/api/v1/dda/reconcile-auto',
      payload: { store_id: '1' }
    });

    expect(reconcileRes.statusCode).toBe(200);
    const recBody = JSON.parse(reconcileRes.body);
    expect(recBody.success).toBe(true);
    expect(recBody.data.matchedCount).toBe(1);

    // KPIs
    const kpiRes = await app.inject({
      method: 'GET',
      url: '/api/v1/dda/kpis?store_id=1'
    });

    expect(kpiRes.statusCode).toBe(200);
    const kpiBody = JSON.parse(kpiRes.body);
    expect(kpiBody.success).toBe(true);
    expect(kpiBody.data.matched_invoices).toBe(1);
    expect(kpiBody.data.reconciliation_rate_percent).toBe(100);
  });
});
