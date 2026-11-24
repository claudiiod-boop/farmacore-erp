import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CustomerReturnService } from '../../../src/modules/returns/returns.service';

describe('CustomerReturnService (Trocas, Devoluções & Estorno Fiscal RDC 44/2009)', () => {
  let db: Database;
  let service: CustomerReturnService;
  let storeId: number;
  let customerId: number;
  let normalProdId: number;
  let thermolabileProdId: number;
  let controlledProdId: number;
  let normalBatchId: number;
  let saleId: number;
  let normalSaleItemId: number;
  let thermoSaleItemId: number;
  let controlledSaleItemId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new CustomerReturnService(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    // Cliente
    const custRes = db.prepare(`
      INSERT INTO customers (store_id, name, cpf, phone)
      VALUES (?, 'Maria Oliveira', '98765432100', '11988887777')
    `).run(storeId);
    customerId = Number(custRes.lastInsertRowid);

    // Produto Normal
    const p1 = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7890001', 'Paracetamol 750mg 20 comp', 'Paracetamol', '10001', 'SEM_TARJA', 'NONE', 15.0, 5.0, 10.0)
    `).run();
    normalProdId = Number(p1.lastInsertRowid);

    // Produto Termolábil (Insulina)
    const p2 = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7890002', 'Insulina NPH 100UI 10ml Termolábil', 'Insulina Humana', '10002', 'VERMELHA', 'NONE', 60.0, 25.0, 45.0)
    `).run();
    thermolabileProdId = Number(p2.lastInsertRowid);

    // Produto Controlado (Portaria 344/98)
    const p3 = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7890003', 'Clonazepam 2mg 30 comp', 'Clonazepam', '10003', 'PRETA', 'B1', 25.0, 10.0, 18.0)
    `).run();
    controlledProdId = Number(p3.lastInsertRowid);

    // Lotes
    const b1 = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'L-PAR-01', '2026-01-01', '2028-01-01', 50)
    `).run(normalProdId);
    normalBatchId = Number(b1.lastInsertRowid);

    const b2 = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'L-INS-01', '2026-01-01', '2027-01-01', 20)
    `).run(thermolabileProdId);
    const thermoBatchId = Number(b2.lastInsertRowid);

    const b3 = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'L-CLO-01', '2026-01-01', '2028-01-01', 30)
    `).run(controlledProdId);
    const controlledBatchId = Number(b3.lastInsertRowid);

    // Pré-Venda
    const pv = db.prepare(`
      INSERT INTO pre_sales (code, status, customer_name, customer_cpf, total_amount)
      VALUES ('#PV-9999', 'CONVERTED_TO_SALE', 'Maria Oliveira', '98765432100', 91.0)
    `).run();
    const preSaleId = Number(pv.lastInsertRowid);

    // Venda Finalizada
    const s = db.prepare(`
      INSERT INTO sales (pre_sale_id, status, total_amount)
      VALUES (?, 'COMPLETED', 91.0)
    `).run(preSaleId);
    saleId = Number(s.lastInsertRowid);

    // Itens da Venda:
    // 2x Paracetamol @ 10.0 = 20.0
    // 1x Insulina @ 45.0 = 45.0
    // 1x Clonazepam @ 18.0 = 18.0 (com desconto total 91.0 - 8.0 = 83.0 etc, unit price exato)
    const si1 = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, 2, 10.0, 20.0)
    `).run(saleId, normalProdId, normalBatchId);
    normalSaleItemId = Number(si1.lastInsertRowid);

    const si2 = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, 1, 45.0, 45.0)
    `).run(saleId, thermolabileProdId, thermoBatchId);
    thermoSaleItemId = Number(si2.lastInsertRowid);

    const si3 = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, 1, 18.0, 18.0)
    `).run(saleId, controlledProdId, controlledBatchId);
    controlledSaleItemId = Number(si3.lastInsertRowid);
  });

  afterEach(() => {
    db.close();
  });

  it('getEligibleItemsForSale correctly identifies items, thermolabile and controlled flags', () => {
    const eligible = service.getEligibleItemsForSale(saleId);
    expect(eligible.saleId).toBe(saleId);
    expect(eligible.customerName).toBe('Maria Oliveira');
    expect(eligible.items.length).toBe(3);

    const normal = eligible.items.find((i) => i.productId === normalProdId)!;
    expect(normal.soldQuantity).toBe(2);
    expect(normal.availableQuantity).toBe(2);
    expect(normal.isThermolabile).toBe(false);
    expect(normal.requiresPharmacistAuth).toBe(false);

    const thermo = eligible.items.find((i) => i.productId === thermolabileProdId)!;
    expect(thermo.isThermolabile).toBe(true);

    const controlled = eligible.items.find((i) => i.productId === controlledProdId)!;
    expect(controlled.requiresPharmacistAuth).toBe(true);
  });

  it('createReturn validates quantity limit and rejects excessive items', () => {
    expect(() => {
      service.createReturn({
        storeId,
        saleId,
        customerId,
        returnType: 'RETURN',
        refundMethod: 'CASH_REFUND',
        reason: 'WRONG_ITEM',
        createdBy: 'Operador 1',
        items: [
          {
            saleItemId: normalSaleItemId,
            productId: normalProdId,
            quantity: 5, // Apenas 2 foram vendidos
            condition: 'INTACT',
            destination: 'RETURN_TO_STOCK',
          },
        ],
      });
    }).toThrow(/excede a quantidade disponível/);
  });

  it('RDC 44/2009: thermolabile products CANNOT return to stock (must be QUARANTINE or DISPOSAL_PGRSS)', () => {
    expect(() => {
      service.createReturn({
        storeId,
        saleId,
        customerId,
        returnType: 'RETURN',
        refundMethod: 'CASH_REFUND',
        reason: 'ADVERSE_REACTION',
        createdBy: 'Operador 1',
        items: [
          {
            saleItemId: thermoSaleItemId,
            productId: thermolabileProdId,
            quantity: 1,
            condition: 'INTACT',
            destination: 'RETURN_TO_STOCK', // Ilegal pela RDC 44/2009
          },
        ],
      });
    }).toThrow(/REGRA SANITÁRIA ANVISA \(RDC 44\/2009\)/);
  });

  it('successfully creates return in DRAFT status for intact normal item and thermolabile in quarantine', () => {
    const ret = service.createReturn({
      storeId,
      saleId,
      customerId,
      returnType: 'RETURN',
      refundMethod: 'STORE_CREDIT',
      reason: 'CUSTOMER_DISSATISFACTION',
      createdBy: 'Operador 1',
      items: [
        {
          saleItemId: normalSaleItemId,
          productId: normalProdId,
          quantity: 1,
          condition: 'INTACT',
          destination: 'RETURN_TO_STOCK',
        },
        {
          saleItemId: thermoSaleItemId,
          productId: thermolabileProdId,
          quantity: 1,
          condition: 'UNSEALED',
          destination: 'QUARANTINE',
        },
      ],
    });

    expect(ret.returnId).toBeGreaterThan(0);
    expect(ret.code).toMatch(/^DEV-\d{8}-\d{4}$/);
    expect(ret.totalAmount).toBe(55.0); // 10.0 + 45.0
    expect(ret.status).toBe('DRAFT');

    const details = service.getReturnById(ret.returnId);
    expect(details.items?.length).toBe(2);
  });

  it('approveReturn restores batch stock, generates store credit and fiscal nfe key', () => {
    // Estoque inicial do lote normal era 50
    const ret = service.createReturn({
      storeId,
      saleId,
      customerId,
      returnType: 'RETURN',
      refundMethod: 'STORE_CREDIT',
      reason: 'WRONG_ITEM',
      createdBy: 'Operador 1',
      items: [
        {
          saleItemId: normalSaleItemId,
          productId: normalProdId,
          batchId: normalBatchId,
          quantity: 2,
          condition: 'INTACT',
          destination: 'RETURN_TO_STOCK',
        },
      ],
    });

    const approved = service.approveReturn(ret.returnId);
    expect(approved.status).toBe('COMPLETED');
    expect(approved.fiscal_nfe_key).toBeDefined();

    // Estoque do lote deve ter sido incrementado de 50 para 52
    const batchAfter = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(normalBatchId) as { quantity: number };
    expect(batchAfter.quantity).toBe(52);

    // Vale-compras deve ter sido emitido
    expect(approved.store_credit).toBeDefined();
    expect(approved.store_credit?.initial_balance).toBe(20.0);
    expect(approved.store_credit?.current_balance).toBe(20.0);
    expect(approved.store_credit?.status).toBe('ACTIVE');

    // Validação e uso do vale-compras
    const creditCode = approved.store_credit!.code;
    const checkCredit = service.validateStoreCredit(creditCode);
    expect(checkCredit.valid).toBe(true);
    expect(checkCredit.balance).toBe(20.0);

    // Usar R$ 12.0 do crédito
    const useRes = service.useStoreCredit(creditCode, 12.0);
    expect(useRes.success).toBe(true);
    expect(useRes.newBalance).toBe(8.0);

    // Usar os R$ 8.0 restantes -> status vira EXHAUSTED
    const useRemaining = service.useStoreCredit(creditCode, 8.0);
    expect(useRemaining.newBalance).toBe(0.0);

    const exhaustedCredit = service.validateStoreCredit(creditCode);
    expect(exhaustedCredit.valid).toBe(false);
    expect(exhaustedCredit.status).toBe('EXHAUSTED');
  });

  it('Portaria 344/98: approving controlled drug return requires pharmacist authorization', () => {
    const ret = service.createReturn({
      storeId,
      saleId,
      customerId,
      returnType: 'RETURN',
      refundMethod: 'CASH_REFUND',
      reason: 'ADVERSE_REACTION',
      createdBy: 'Operador 1',
      items: [
        {
          saleItemId: controlledSaleItemId,
          productId: controlledProdId,
          quantity: 1,
          condition: 'INTACT',
          destination: 'QUARANTINE', // Medicamento controlado vai pra quarentena até liberação
        },
      ],
    });

    // Tentativa de aprovar sem CRF do farmacêutico
    expect(() => {
      service.approveReturn(ret.returnId);
    }).toThrow(/Portaria 344\/98 ANVISA/);

    // Aprovação com CRF do farmacêutico
    const approved = service.approveReturn(ret.returnId, {
      authorizedByPharmacist: 'Dra. Camila Santos - CRF/SP 98765',
    });
    expect(approved.status).toBe('COMPLETED');
    expect(approved.authorized_by_pharmacist).toBe('Dra. Camila Santos - CRF/SP 98765');
  });

  it('rejectReturn marks status as REJECTED with notes', () => {
    const ret = service.createReturn({
      storeId,
      saleId,
      customerId,
      returnType: 'RETURN',
      refundMethod: 'CASH_REFUND',
      reason: 'OTHER',
      createdBy: 'Operador 1',
      items: [
        {
          saleItemId: normalSaleItemId,
          productId: normalProdId,
          quantity: 1,
          condition: 'INTACT',
          destination: 'RETURN_TO_STOCK',
        },
      ],
    });

    const rejected = service.rejectReturn(ret.returnId, 'Produto com sinais de mau uso ou violação');
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.notes).toContain('mau uso ou violação');
  });

  it('generates fiscal return summary (estorno tributário) and KPIs correctly', () => {
    const ret = service.createReturn({
      storeId,
      saleId,
      customerId,
      returnType: 'RETURN',
      refundMethod: 'STORE_CREDIT',
      reason: 'WRONG_ITEM',
      createdBy: 'Operador 1',
      items: [
        {
          saleItemId: normalSaleItemId,
          productId: normalProdId,
          quantity: 2,
          unitPrice: 10.0,
          condition: 'INTACT',
          destination: 'RETURN_TO_STOCK',
        },
      ],
    });
    service.approveReturn(ret.returnId);

    const fiscalSummary = service.generateFiscalReturnSummary(ret.returnId);
    expect(fiscalSummary.cfop).toBe('1.202');
    expect(fiscalSummary.totalReturnAmount).toBe(20.0);
    expect(fiscalSummary.icmsReversal).toBe(3.60); // 18% de 20.0
    expect(fiscalSummary.pisReversal).toBe(0.33); // 1.65% de 20.0
    expect(fiscalSummary.cofinsReversal).toBe(1.52); // 7.6% de 20.0
    expect(fiscalSummary.items.length).toBe(1);

    const kpis = service.getKpis(storeId);
    expect(kpis.total_returns_month).toBe(1);
    expect(kpis.total_amount_returned_month).toBe(20.0);
    expect(kpis.active_store_credits_balance).toBe(20.0);
  });
});
