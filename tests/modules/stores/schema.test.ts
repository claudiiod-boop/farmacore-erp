import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import type { Store, CreateStoreInput, UpdateStoreInput, NetworkStockItem } from '../../../src/modules/stores/types';
import type {
  TransferStatus,
  Transfer,
  TransferItem,
  CreateTransferInput,
  CreateTransferItemInput,
  TransferWithItems,
  CarrierInfo,
  ReceiveItemInput,
} from '../../../src/modules/transfers/types';

describe('Schema 008 - Multi-Store & Transfers Migration', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('should run migration 008 cleanly and seed default headquarters store (id=1)', () => {
    runMigrations(db);

    const store = db.prepare('SELECT * FROM stores WHERE id = 1').get() as any;
    expect(store).toBeDefined();
    expect(store.id).toBe(1);
    expect(store.code).toBe('LJ01');
    expect(store.name).toBe('FarmaCore Matriz Centro');
    expect(store.company_name).toBe('Drogaria FarmaCore Ltda');
    expect(store.cnpj).toBe('12.345.678/0001-90');
    expect(store.is_headquarters).toBe(1);
    expect(store.is_active).toBe(1);
  });

  it('should add store_id column with default 1 to batches, sales, pre_sales, cash_sessions', () => {
    runMigrations(db);

    // Verify batches table has store_id
    const batchColumns = db.prepare("PRAGMA table_info('batches')").all() as any[];
    const batchStoreIdCol = batchColumns.find((c) => c.name === 'store_id');
    expect(batchStoreIdCol).toBeDefined();
    expect(batchStoreIdCol.dflt_value).toBe('1');

    // Verify sales table has store_id
    const salesColumns = db.prepare("PRAGMA table_info('sales')").all() as any[];
    const salesStoreIdCol = salesColumns.find((c) => c.name === 'store_id');
    expect(salesStoreIdCol).toBeDefined();
    expect(salesStoreIdCol.dflt_value).toBe('1');

    // Verify pre_sales table has store_id
    const preSalesColumns = db.prepare("PRAGMA table_info('pre_sales')").all() as any[];
    const preSalesStoreIdCol = preSalesColumns.find((c) => c.name === 'store_id');
    expect(preSalesStoreIdCol).toBeDefined();
    expect(preSalesStoreIdCol.dflt_value).toBe('1');

    // Verify cash_sessions table has store_id
    const cashSessionsColumns = db.prepare("PRAGMA table_info('cash_sessions')").all() as any[];
    const cashSessionsStoreIdCol = cashSessionsColumns.find((c) => c.name === 'store_id');
    expect(cashSessionsStoreIdCol).toBeDefined();
    expect(cashSessionsStoreIdCol.dflt_value).toBe('1');
  });

  it('should insert records into existing tables without specifying store_id and default to 1', () => {
    runMigrations(db);

    // Insert product
    const productInfo = db
      .prepare(
        `INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
         VALUES ('7890000000001', 'Dipirona 500mg', 'Dipirona', '1000000000001', 'SEM_TARJA', 'LIBERADO', 10.0, 7.0, 8.5)`,
      )
      .run();
    const productId = Number(productInfo.lastInsertRowid);

    // Insert batch without store_id
    const batchInfo = db
      .prepare(
        `INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
         VALUES (?, 'LOTE001', '2026-01-01', '2027-12-31', 100)`,
      )
      .run(productId);
    const batchId = Number(batchInfo.lastInsertRowid);

    const insertedBatch = db.prepare('SELECT store_id FROM batches WHERE id = ?').get(batchId) as any;
    expect(insertedBatch.store_id).toBe(1);

    // Insert pre_sale without store_id
    const preSaleInfo = db
      .prepare(`INSERT INTO pre_sales (code, total_amount) VALUES ('PRV-001', 50.0)`)
      .run();
    const preSaleId = Number(preSaleInfo.lastInsertRowid);
    const insertedPreSale = db.prepare('SELECT store_id FROM pre_sales WHERE id = ?').get(preSaleId) as any;
    expect(insertedPreSale.store_id).toBe(1);

    // Insert cash_session without store_id
    const sessionInfo = db
      .prepare(`INSERT INTO cash_sessions (operator_name, initial_cash, current_cash) VALUES ('Operador', 100, 100)`)
      .run();
    const sessionId = Number(sessionInfo.lastInsertRowid);
    const insertedSession = db.prepare('SELECT store_id FROM cash_sessions WHERE id = ?').get(sessionId) as any;
    expect(insertedSession.store_id).toBe(1);

    // Insert sale without store_id
    const saleInfo = db
      .prepare(`INSERT INTO sales (total_amount) VALUES (50.0)`)
      .run();
    const saleId = Number(saleInfo.lastInsertRowid);
    const insertedSale = db.prepare('SELECT store_id FROM sales WHERE id = ?').get(saleId) as any;
    expect(insertedSale.store_id).toBe(1);
  });

  it('should enforce CHECK constraint (source_store_id <> target_store_id) on transfers', () => {
    runMigrations(db);

    expect(() => {
      db.prepare(
        `INSERT INTO transfers (transfer_number, source_store_id, target_store_id, requested_by)
         VALUES ('TRF-TEST-001', 1, 1, 'Operador Teste')`,
      ).run();
    }).toThrow();
  });

  it('should cascade delete transfer_items when a transfer is deleted', () => {
    runMigrations(db);

    // Create target store (id=2)
    db.prepare(
      `INSERT INTO stores (id, code, name, company_name, cnpj, ie, is_headquarters, street, number, neighborhood, city, state, zip_code, ibge_code)
       VALUES (2, 'LJ02', 'Filial Jardins', 'Drogaria FarmaCore Ltda', '12.345.678/0002-71', '123456780', 0, 'Rua Augusta', '200', 'Cerqueira Cesar', 'São Paulo', 'SP', '01412-000', '3550308')`,
    ).run();

    // Create product
    const productInfo = db
      .prepare(
        `INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
         VALUES ('7890000000002', 'Paracetamol 750mg', 'Paracetamol', '1000000000002', 'SEM_TARJA', 'LIBERADO', 12.0, 8.0, 9.5)`,
      )
      .run();
    const productId = Number(productInfo.lastInsertRowid);

    // Insert transfer
    const trfInfo = db
      .prepare(
        `INSERT INTO transfers (transfer_number, source_store_id, target_store_id, requested_by)
         VALUES ('TRF-TEST-002', 1, 2, 'Operador Matriz')`,
      )
      .run();
    const transferId = Number(trfInfo.lastInsertRowid);

    // Insert transfer item
    db.prepare(
      `INSERT INTO transfer_items (transfer_id, product_id, batch_number, expiration_date, manufacturing_date, requested_quantity, unit_cost, total_cost)
       VALUES (?, ?, 'LOTE002', '2027-12-31', '2026-01-01', 10, 5.0, 50.0)`,
    ).run(transferId, productId);

    const itemsBefore = db.prepare('SELECT COUNT(*) as count FROM transfer_items WHERE transfer_id = ?').get(transferId) as any;
    expect(itemsBefore.count).toBe(1);

    // Delete transfer
    db.prepare('DELETE FROM transfers WHERE id = ?').run(transferId);

    const itemsAfter = db.prepare('SELECT COUNT(*) as count FROM transfer_items WHERE transfer_id = ?').get(transferId) as any;
    expect(itemsAfter.count).toBe(0);
  });

  it('should compile and check domain types for Store and Transfers', () => {
    const store: Store = {
      id: 1,
      code: 'LJ01',
      name: 'FarmaCore Matriz Centro',
      companyName: 'Drogaria FarmaCore Ltda',
      cnpj: '12.345.678/0001-90',
      ie: '123456789',
      isHeadquarters: true,
      street: 'Av. Central',
      number: '1000',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01001-000',
      ibgeCode: '3550308',
      taxRegime: 'SIMPLES_NACIONAL',
      isActive: true,
    };
    expect(store.id).toBe(1);

    const networkItem: NetworkStockItem = {
      storeId: 1,
      storeName: 'FarmaCore Matriz',
      storeCity: 'São Paulo',
      totalQuantity: 100,
      reservedQuantity: 10,
      availableQuantity: 90,
      earliestExpiry: '2027-12-31',
    };
    expect(networkItem.availableQuantity).toBe(90);

    const transferStatus: TransferStatus = 'IN_TRANSIT';
    expect(transferStatus).toBe('IN_TRANSIT');

    const transfer: Transfer = {
      id: 1,
      transferNumber: 'TRF-20261118-0001',
      sourceStoreId: 1,
      targetStoreId: 2,
      status: 'REQUESTED',
      requestedBy: 'Operador',
      cfop: '5152',
      createdAt: '2026-11-18 10:00:00',
      updatedAt: '2026-11-18 10:00:00',
    };
    expect(transfer.status).toBe('REQUESTED');
  });
});
