import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import type {
  InventoryType,
  InventoryStatus,
  DifferenceStatus,
  AdjustmentReason,
  InventorySession,
  InventoryItem,
  InventorySessionWithItems,
  CreateInventorySessionInput,
  AddCountInput,
  ApplyAdjustmentsParams,
  InventorySessionFilters,
  InventoryBalanceReport,
} from '../../../src/modules/inventory/audit-types';

describe('Inventory Audit Schema & Domain Types (Migration 009)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create inventory_sessions and inventory_items tables and their indexes', () => {
    const tables = db
      .prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((r) => r.name);

    expect(tables).toContain('inventory_sessions');
    expect(tables).toContain('inventory_items');

    const indexes = db
      .prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type='index'")
      .all()
      .map((r) => r.name);

    expect(indexes).toContain('idx_inventory_sessions_store_status');
    expect(indexes).toContain('idx_inventory_items_session');
    expect(indexes).toContain('idx_inventory_items_product_batch');
  });

  it('should be idempotent and not fail when run multiple times', () => {
    expect(() => runMigrations(db)).not.toThrow();

    const migrations = db
      .prepare<{ name: string }>('SELECT name FROM _migrations')
      .all()
      .map((m) => m.name);

    expect(migrations).toContain('009_inventory_audit_sngpc.sql');
    const count = migrations.filter((m) => m === '009_inventory_audit_sngpc.sql').length;
    expect(count).toBe(1);
  });

  it('should enforce unique constraint on session_code in inventory_sessions', () => {
    // store_id 1 is seeded by migration 008
    db.prepare(`
      INSERT INTO inventory_sessions (
        session_code, store_id, inventory_type, opened_by
      ) VALUES (?, ?, ?, ?)
    `).run('INV-20261119-0001', 1, 'GERAL', 'Carlos Almoxarife');

    // Attempting duplicate session_code must throw
    expect(() => {
      db.prepare(`
        INSERT INTO inventory_sessions (
          session_code, store_id, inventory_type, opened_by
        ) VALUES (?, ?, ?, ?)
      `).run('INV-20261119-0001', 1, 'ROTATIVO', 'Maria Farmaceutica');
    }).toThrow();
  });

  it('should enforce foreign key constraint to stores on inventory_sessions', () => {
    expect(() => {
      db.prepare(`
        INSERT INTO inventory_sessions (
          session_code, store_id, inventory_type, opened_by
        ) VALUES (?, ?, ?, ?)
      `).run('INV-20261119-0002', 9999, 'GERAL', 'Carlos Almoxarife');
    }).toThrow();
  });

  it('should set appropriate default values in inventory_sessions', () => {
    const info = db.prepare(`
      INSERT INTO inventory_sessions (
        session_code, store_id, inventory_type, opened_by
      ) VALUES (?, ?, ?, ?)
    `).run('INV-20261119-0003', 1, 'CONTROLADOS_SNGPC', 'Dra. Roberta CRF/SP 45678');

    const session = db
      .prepare<unknown[], Record<string, any>>('SELECT * FROM inventory_sessions WHERE id = ?')
      .get(info.lastInsertRowid);

    expect(session).toBeDefined();
    expect(session?.status).toBe('OPEN');
    expect(session?.total_products_expected).toBe(0);
    expect(session?.total_products_counted).toBe(0);
    expect(session?.total_batches_expected).toBe(0);
    expect(session?.total_batches_counted).toBe(0);
    expect(session?.accuracy_rate).toBe(100.0);
    expect(session?.total_surplus_cost).toBe(0.0);
    expect(session?.total_shortage_cost).toBe(0.0);
    expect(session?.net_financial_difference).toBe(0.0);
    expect(session?.started_at).toBeDefined();
    expect(session?.created_at).toBeDefined();
    expect(session?.updated_at).toBeDefined();
    expect(session?.closed_at).toBeNull();
  });

  it('should enforce cascade deletion on inventory_items when session is deleted', () => {
    // 1. Insert product
    const prodResult = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('7891234560011', 'Dipirona 500mg', 'Dipirona Sódica', '1.0000.0000.001-1', 'SEM_TARJA', 'NAO_CONTROLADO', 12.0, 8.0, 10.0);
    const productId = Number(prodResult.lastInsertRowid);

    // 2. Insert batch
    const batchResult = db.prepare(`
      INSERT INTO batches (store_id, product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(1, productId, 'LOTE100', '2026-01-01', '2027-01-01', 50);
    const batchId = Number(batchResult.lastInsertRowid);

    // 3. Insert session
    const sessResult = db.prepare(`
      INSERT INTO inventory_sessions (session_code, store_id, inventory_type, opened_by)
      VALUES (?, ?, ?, ?)
    `).run('INV-20261119-0004', 1, 'GERAL', 'Carlos Almoxarife');
    const sessionId = Number(sessResult.lastInsertRowid);

    // 4. Insert item
    db.prepare(`
      INSERT INTO inventory_items (
        session_id, product_id, batch_id, batch_number, expiration_date, manufacturing_date,
        expected_quantity, counted_quantity, difference_quantity, difference_status, unit_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, productId, batchId, 'LOTE100', '2027-01-01', '2026-01-01', 50, 48, -2, 'SHORTAGE', 5.5);

    // Check item exists
    const itemsBefore = db
      .prepare<unknown[], Record<string, any>>('SELECT * FROM inventory_items WHERE session_id = ?')
      .all(sessionId);
    expect(itemsBefore.length).toBe(1);

    // Delete session
    db.prepare('DELETE FROM inventory_sessions WHERE id = ?').run(sessionId);

    // Check item was cascaded
    const itemsAfter = db
      .prepare<unknown[], Record<string, any>>('SELECT * FROM inventory_items WHERE session_id = ?')
      .all(sessionId);
    expect(itemsAfter.length).toBe(0);
  });

  it('should enforce foreign keys on inventory_items for session and product', () => {
    // Non-existent session must fail
    expect(() => {
      db.prepare(`
        INSERT INTO inventory_items (
          session_id, product_id, batch_number, expiration_date, manufacturing_date
        ) VALUES (?, ?, ?, ?, ?)
      `).run(9999, 1, 'LOTE001', '2027-01-01', '2026-01-01');
    }).toThrow();

    // Non-existent product must fail
    const sessResult = db.prepare(`
      INSERT INTO inventory_sessions (session_code, store_id, inventory_type, opened_by)
      VALUES (?, ?, ?, ?)
    `).run('INV-20261119-0005', 1, 'GERAL', 'Carlos Almoxarife');
    const sessionId = Number(sessResult.lastInsertRowid);

    expect(() => {
      db.prepare(`
        INSERT INTO inventory_items (
          session_id, product_id, batch_number, expiration_date, manufacturing_date
        ) VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, 9999, 'LOTE001', '2027-01-01', '2026-01-01');
    }).toThrow();
  });

  it('should allow nullable batch_id on inventory_items for newly discovered batches (sobras)', () => {
    const prodResult = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('7891234560022', 'Paracetamol 500mg', 'Paracetamol', '1.0000.0000.002-2', 'SEM_TARJA', 'NAO_CONTROLADO', 10.0, 6.0, 8.0);
    const productId = Number(prodResult.lastInsertRowid);

    const sessResult = db.prepare(`
      INSERT INTO inventory_sessions (session_code, store_id, inventory_type, opened_by)
      VALUES (?, ?, ?, ?)
    `).run('INV-20261119-0006', 1, 'GERAL', 'Carlos Almoxarife');
    const sessionId = Number(sessResult.lastInsertRowid);

    const itemResult = db.prepare(`
      INSERT INTO inventory_items (
        session_id, product_id, batch_id, batch_number, expiration_date, manufacturing_date,
        expected_quantity, counted_quantity, difference_quantity, difference_status,
        adjustment_reason, notes, unit_cost, total_cost_difference, sngpc_adjusted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      productId,
      null,
      'LOTE_NOVO_01',
      '2028-05-01',
      '2026-05-01',
      0,
      15,
      15,
      'SURPLUS',
      'SOBRA_NAO_IDENTIFICADA',
      'Lote encontrado em prateleira superior sem cadastro prévio',
      4.5,
      67.5,
      0
    );

    const item = db
      .prepare<unknown[], Record<string, any>>('SELECT * FROM inventory_items WHERE id = ?')
      .get(itemResult.lastInsertRowid);

    expect(item).toBeDefined();
    expect(item?.batch_id).toBeNull();
    expect(item?.batch_number).toBe('LOTE_NOVO_01');
    expect(item?.difference_status).toBe('SURPLUS');
    expect(item?.adjustment_reason).toBe('SOBRA_NAO_IDENTIFICADA');
    expect(item?.difference_quantity).toBe(15);
    expect(item?.total_cost_difference).toBe(67.5);
    expect(item?.sngpc_adjusted).toBe(0);
  });

  it('should validate domain types contracts via TypeScript definitions', () => {
    const sessionType: InventoryType = 'CONTROLADOS_SNGPC';
    const status: InventoryStatus = 'COUNTED';
    const diffStatus: DifferenceStatus = 'SHORTAGE';
    const reason: AdjustmentReason = 'AVARIA';

    const session: InventorySession = {
      id: 1,
      sessionCode: 'INV-20261119-0001',
      storeId: 1,
      inventoryType: sessionType,
      categoryFilter: null,
      status,
      openedBy: 'Farmacêutico RT',
      appliedBy: null,
      responsiblePharmacistCrf: '12345',
      responsiblePharmacistUf: 'SP',
      notes: 'Balanço mensal',
      totalProductsExpected: 10,
      totalProductsCounted: 10,
      totalBatchesExpected: 15,
      totalBatchesCounted: 15,
      accuracyRate: 93.33,
      totalSurplusCost: 0,
      totalShortageCost: 120.5,
      netFinancialDifference: -120.5,
      startedAt: '2026-11-19T10:00:00Z',
      closedAt: null,
      createdAt: '2026-11-19T10:00:00Z',
      updatedAt: '2026-11-19T11:00:00Z',
    };

    const item: InventoryItem = {
      id: 1,
      sessionId: 1,
      productId: 10,
      productName: 'Clonazepam 2mg',
      productEan: '7891234567890',
      batchId: 5,
      batchNumber: 'LOTECZ1',
      expirationDate: '2027-12-31',
      manufacturingDate: '2025-12-01',
      expectedQuantity: 20,
      countedQuantity: 18,
      recountQuantity: 18,
      differenceQuantity: -2,
      differenceStatus: diffStatus,
      unitCost: 15.0,
      totalCostDifference: -30.0,
      adjustmentReason: reason,
      notes: 'Frasco quebrado na gaveta',
      sngpcAdjusted: 1,
      createdAt: '2026-11-19T10:15:00Z',
      updatedAt: '2026-11-19T10:30:00Z',
    };

    const sessionWithItems: InventorySessionWithItems = {
      ...session,
      items: [item],
    };

    const createInput: CreateInventorySessionInput = {
      storeId: 1,
      inventoryType: 'ROTATIVO',
      categoryFilter: 'GENERICO',
      openedBy: 'Operador',
      notes: 'Contagem diária',
    };

    const addCountInput: AddCountInput = {
      productId: 10,
      batchNumber: 'LOTECZ1',
      expirationDate: '2027-12-31',
      quantity: 5,
      isIncremental: true,
    };

    const applyParams: ApplyAdjustmentsParams = {
      appliedBy: 'Dra. Roberta',
      responsiblePharmacistCrf: '45678',
      responsiblePharmacistUf: 'SP',
      itemReasons: {
        1: { reason: 'AVARIA', notes: 'Frasco quebrado' },
      },
    };

    const filters: InventorySessionFilters = {
      storeId: 1,
      status: 'OPEN',
      limit: 20,
    };

    const report: InventoryBalanceReport = {
      sessionId: 1,
      sessionCode: 'INV-20261119-0001',
      storeId: 1,
      storeName: 'FarmaCore Matriz',
      inventoryType: 'GERAL',
      status: 'APPLIED',
      openedBy: 'Carlos',
      appliedBy: 'Dra. Roberta',
      responsiblePharmacistCrf: '45678',
      responsiblePharmacistUf: 'SP',
      startedAt: '2026-11-19T10:00:00Z',
      closedAt: '2026-11-19T12:00:00Z',
      totalProductsExpected: 1,
      totalProductsCounted: 1,
      totalBatchesExpected: 1,
      totalBatchesCounted: 1,
      accuracyRate: 100,
      totalSurplusCost: 0,
      totalShortageCost: 0,
      netFinancialDifference: 0,
      totalItemsExact: 1,
      totalItemsSurplus: 0,
      totalItemsShortage: 0,
      items: [item],
      divergentItems: [],
    };

    expect(sessionWithItems.items.length).toBe(1);
    expect(createInput.inventoryType).toBe('ROTATIVO');
    expect(addCountInput.quantity).toBe(5);
    expect(applyParams.itemReasons?.[1]?.reason).toBe('AVARIA');
    expect(filters.limit).toBe(20);
    expect(report.accuracyRate).toBe(100);
  });
});
