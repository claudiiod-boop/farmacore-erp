import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Devoluções de Clientes & Estorno Fiscal (Fase 32)', () => {
  let app: FastifyInstance;
  let db: Database;
  let storeId: number;
  let customerId: number;
  let prodId: number;
  let batchId: number;
  let saleId: number;
  let saleItemId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    const custRes = db.prepare(`
      INSERT INTO customers (store_id, name, cpf, phone)
      VALUES (?, 'Joao Pereira', '11122233344', '11987654321')
    `).run(storeId);
    customerId = Number(custRes.lastInsertRowid);

    const pRes = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('Ibuprofeno 600mg 20 comp', '7891234567000', 'Ibuprofeno', '1004300099', 'SEM_TARJA', 'NONE', 18.0, 6.0, 12.0)
    `).run();
    prodId = Number(pRes.lastInsertRowid);

    const bRes = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'L-IBU-10', '2026-01-01', '2028-01-01', 30)
    `).run(prodId);
    batchId = Number(bRes.lastInsertRowid);

    const pvRes = db.prepare(`
      INSERT INTO pre_sales (code, status, customer_name, customer_cpf, total_amount)
      VALUES ('#PV-8888', 'CONVERTED_TO_SALE', 'Joao Pereira', '11122233344', 24.0)
    `).run();
    const preSaleId = Number(pvRes.lastInsertRowid);

    const sRes = db.prepare(`
      INSERT INTO sales (pre_sale_id, status, total_amount)
      VALUES (?, 'COMPLETED', 24.0)
    `).run(preSaleId);
    saleId = Number(sRes.lastInsertRowid);

    const siRes = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, 2, 12.0, 24.0)
    `).run(saleId, prodId, batchId);
    saleItemId = Number(siRes.lastInsertRowid);

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. GET /api/returns/sale/:saleId/eligible-items deve retornar itens elegíveis da venda', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/returns/sale/${saleId}/eligible-items`,
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.saleId).toBe(saleId);
    expect(data.customerName).toBe('Joao Pereira');
    expect(data.items.length).toBe(1);
    expect(data.items[0].availableQuantity).toBe(2);
    expect(data.items[0].productName).toContain('Ibuprofeno');
  });

  it('2. POST /api/returns deve criar solicitação de devolução com sucesso', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/returns',
      payload: {
        storeId,
        saleId,
        customerId,
        returnType: 'RETURN',
        refundMethod: 'STORE_CREDIT',
        reason: 'WRONG_ITEM',
        notes: 'Cliente comprou dosagem errada',
        items: [
          {
            saleItemId,
            productId: prodId,
            quantity: 1,
            condition: 'INTACT',
            destination: 'RETURN_TO_STOCK',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.body);
    expect(data.returnId).toBeGreaterThan(0);
    expect(data.code).toContain('DEV-');
    expect(data.totalAmount).toBe(12.0);
    expect(data.status).toBe('DRAFT');
  });

  it('3. POST /api/returns/:id/approve deve aprovar, restaurar estoque e emitir vale-compras', async () => {
    // 1. Criar devolução
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/returns',
      payload: {
        storeId,
        saleId,
        customerId,
        returnType: 'RETURN',
        refundMethod: 'STORE_CREDIT',
        reason: 'WRONG_ITEM',
        items: [
          {
            saleItemId,
            productId: prodId,
            batchId,
            quantity: 1,
            condition: 'INTACT',
            destination: 'RETURN_TO_STOCK',
          },
        ],
      },
    });
    const { returnId } = JSON.parse(createRes.body);

    // 2. Aprovar devolução
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/returns/${returnId}/approve`,
      payload: {},
    });

    expect(approveRes.statusCode).toBe(200);
    const approved = JSON.parse(approveRes.body);
    expect(approved.status).toBe('COMPLETED');
    expect(approved.fiscal_nfe_key).toBeDefined();
    expect(approved.store_credit).toBeDefined();
    expect(approved.store_credit.initial_balance).toBe(12.0);

    // 3. Validar saldo do vale-compras gerado
    const creditCode = approved.store_credit.code;
    const valRes = await app.inject({
      method: 'GET',
      url: `/api/returns/store-credits/validate/${creditCode}`,
    });
    expect(valRes.statusCode).toBe(200);
    const valData = JSON.parse(valRes.body);
    expect(valData.valid).toBe(true);
    expect(valData.balance).toBe(12.0);

    // 4. Utilizar vale-compras
    const useRes = await app.inject({
      method: 'POST',
      url: '/api/returns/store-credits/use',
      payload: {
        code: creditCode,
        amount: 12.0,
      },
    });
    expect(useRes.statusCode).toBe(200);
    const useData = JSON.parse(useRes.body);
    expect(useData.success).toBe(true);
    expect(useData.newBalance).toBe(0.0);
  });

  it('4. GET /api/returns/:id/fiscal e /api/returns/kpis devem retornar espelho fiscal e KPIs', async () => {
    // 1. Criar e aprovar devolução
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/returns',
      payload: {
        storeId,
        saleId,
        customerId,
        returnType: 'RETURN',
        refundMethod: 'CASH_REFUND',
        reason: 'CUSTOMER_DISSATISFACTION',
        items: [
          {
            saleItemId,
            productId: prodId,
            quantity: 1,
            unitPrice: 12.0,
            condition: 'INTACT',
            destination: 'RETURN_TO_STOCK',
          },
        ],
      },
    });
    const { returnId } = JSON.parse(createRes.body);

    await app.inject({
      method: 'POST',
      url: `/api/returns/${returnId}/approve`,
    });

    // 2. Espelho fiscal
    const fiscalRes = await app.inject({
      method: 'GET',
      url: `/api/returns/${returnId}/fiscal`,
    });
    expect(fiscalRes.statusCode).toBe(200);
    const fiscalData = JSON.parse(fiscalRes.body);
    expect(fiscalData.cfop).toBe('1.202');
    expect(fiscalData.totalReturnAmount).toBe(12.0);
    expect(fiscalData.icmsReversal).toBe(2.16);

    // 3. KPIs
    const kpiRes = await app.inject({
      method: 'GET',
      url: `/api/returns/kpis?storeId=${storeId}`,
    });
    expect(kpiRes.statusCode).toBe(200);
    const kpiData = JSON.parse(kpiRes.body);
    expect(kpiData.total_returns_month).toBe(1);
    expect(kpiData.total_amount_returned_month).toBe(12.0);
  });
});
