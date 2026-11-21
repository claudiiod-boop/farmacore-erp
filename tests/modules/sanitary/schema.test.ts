import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import type {
  AnvisaRecallStatus,
  AnvisaRecallActionTaken,
  InventoryLossReason,
  InventoryLossStatus,
  AnvisaRecall,
  AnvisaRecallItem,
  AnvisaRecallWithItems,
  InventoryLoss,
  InventoryLossItem,
  InventoryLossWithItems,
  RegisterRecallInput,
  CreateLossDraftInput,
  ApproveLossParams,
  DisposalCertificateParams,
  ExpiryRiskCategory,
  ExpiryRiskMatrix,
  ExpiringBatchItem,
  ExpiryFilters,
  BatchActionSuggestion,
  AffectedPatientItem,
} from '../../../src/modules/sanitary/types';

describe('Schema 013 - Validades Preditivas, Recall Anvisa e Baixa Regulatória de Perdas', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('should run all migrations including 013 cleanly and create all 4 sanitary tables', () => {
    runMigrations(db);

    const tables = db
      .prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('anvisa_recalls', 'anvisa_recall_items', 'inventory_losses', 'inventory_loss_items')"
      )
      .all();

    const tableNames = tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([
      'anvisa_recall_items',
      'anvisa_recalls',
      'inventory_loss_items',
      'inventory_losses',
    ]);
  });

  it('should create the 6 sanitary performance indexes and alter batches table', () => {
    runMigrations(db);

    const indexes = db
      .prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_batches_expiry_qty', 'idx_batches_blocked', 'idx_anvisa_recalls_status', 'idx_anvisa_recall_items_batch', 'idx_inventory_losses_store_status', 'idx_inventory_loss_items_batch')"
      )
      .all();

    const indexNames = indexes.map((i) => i.name).sort();
    expect(indexNames).toEqual([
      'idx_anvisa_recall_items_batch',
      'idx_anvisa_recalls_status',
      'idx_batches_blocked',
      'idx_batches_expiry_qty',
      'idx_inventory_loss_items_batch',
      'idx_inventory_losses_store_status',
    ]);
  });

  it('should enforce anvisa_recalls constraints (resolution_number unique, status check)', () => {
    runMigrations(db);

    const stmt = db.prepare(`
      INSERT INTO anvisa_recalls (resolution_number, resolution_date, publication_date, reason, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run('RE 1.234/2026', '2026-11-20', '2026-11-21', 'Desvio de qualidade teor de princípio ativo', 'ACTIVE');

    // Duplicate resolution_number should fail
    expect(() => {
      stmt.run('RE 1.234/2026', '2026-11-20', '2026-11-21', 'Outro motivo', 'ACTIVE');
    }).toThrow();

    // Invalid status should fail
    expect(() => {
      stmt.run('RE 5.678/2026', '2026-11-20', '2026-11-21', 'Motivo', 'INVALID_STATUS');
    }).toThrow();
  });

  it('should enforce anvisa_recall_items constraints and cascade deletion', () => {
    runMigrations(db);

    // Store 1 is already seeded by migration 008
    const prodRes = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7891234567890', 'Amoxicilina 500mg', 'Amoxicilina', '1234567890123', 'TARJA_VERMELHA', 'ANTIBIOTICO', 40.0, 20.0, 30.0)
    `).run();

    const recallRes = db.prepare(`
      INSERT INTO anvisa_recalls (resolution_number, resolution_date, publication_date, reason)
      VALUES ('RE 9.999/2026', '2026-11-21', '2026-11-21', 'Contaminação microbiológica')
    `).run();

    const insertItem = db.prepare(`
      INSERT INTO anvisa_recall_items (recall_id, product_id, batch_number, action_taken, total_stock_blocked)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertItem.run(recallRes.lastInsertRowid, prodRes.lastInsertRowid, 'LOTE-AMO-001', 'BLOCKED', 20);

    // Duplicate (recall_id, product_id, batch_number) should fail
    expect(() => {
      insertItem.run(recallRes.lastInsertRowid, prodRes.lastInsertRowid, 'LOTE-AMO-001', 'BLOCKED', 10);
    }).toThrow();

    // Invalid action_taken should fail
    expect(() => {
      insertItem.run(recallRes.lastInsertRowid, prodRes.lastInsertRowid, 'LOTE-AMO-002', 'INVALID_ACTION', 10);
    }).toThrow();

    // Deleting recall should cascade delete recall_items
    db.prepare('DELETE FROM anvisa_recalls WHERE id = ?').run(recallRes.lastInsertRowid);
    const count = db.prepare<{ cnt: number }>('SELECT count(*) as cnt FROM anvisa_recall_items').get();
    expect(count?.cnt).toBe(0);
  });

  it('should enforce inventory_losses and inventory_loss_items constraints', () => {
    runMigrations(db);

    const prodRes = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7890001112223', 'Dipirona 500mg', 'Dipirona Monoidratada', '1000000000000', 'SEM_TARJA', 'ISENTO', 15.0, 5.0, 10.0)
    `).run();

    const insertLoss = db.prepare(`
      INSERT INTO inventory_losses (
        loss_number, store_id, reason, status, total_cost_amount, total_sale_amount,
        responsible_pharmacist_name, pharmacist_crf, pharmacist_crf_uf
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const lossRes = insertLoss.run(
      'PER-202611-0001',
      1,
      'EXPIRED',
      'DRAFT',
      40.0,
      100.0,
      'Dra. Farmacêutica Responsável',
      '12345',
      'SP'
    );

    // Unique loss_number constraint
    expect(() => {
      insertLoss.run(
        'PER-202611-0001',
        1,
        'BROKEN_DAMAGED',
        'DRAFT',
        10.0,
        20.0,
        'Dr. Farmacêutico',
        '54321',
        'RJ'
      );
    }).toThrow();

    // Check invalid reason
    expect(() => {
      insertLoss.run(
        'PER-202611-0002',
        1,
        'INVALID_REASON',
        'DRAFT',
        10.0,
        20.0,
        'Dr. Farmacêutico',
        '54321',
        'RJ'
      );
    }).toThrow();

    // Insert loss items
    const insertLossItem = db.prepare(`
      INSERT INTO inventory_loss_items (
        loss_id, product_id, product_name, batch_number, expiration_date,
        quantity, unit_cost, total_cost, unit_sale_price, total_sale_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertLossItem.run(
      lossRes.lastInsertRowid,
      prodRes.lastInsertRowid,
      'Dipirona 500mg',
      'LOTE-DIP-99',
      '2026-10-31',
      10,
      4.0,
      40.0,
      10.0,
      100.0
    );

    // Cascade delete loss
    db.prepare('DELETE FROM inventory_losses WHERE id = ?').run(lossRes.lastInsertRowid);
    const countItems = db.prepare<{ cnt: number }>('SELECT count(*) as cnt FROM inventory_loss_items').get();
    expect(countItems?.cnt).toBe(0);
  });
});
