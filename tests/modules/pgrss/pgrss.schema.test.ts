import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('PGRSS & Descarte Sanitário Schema (Migration 026)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required PGRSS tables cleanly', () => {
    const tables = [
      'pgrss_disposal_records',
      'pgrss_manifests',
      'pgrss_manifest_items',
    ];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }
  });

  it('should insert disposal record and manifest with foreign keys', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };

    // Inserir produto e lote
    const prodRes = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7891234567001', 'Dipirona Gotas 500mg/ml', 'Dipirona', '1.0000.0001', 'SEM_TARJA', 'NONE', 12.0, 5.0, 9.90)
    `).run();
    const prodId = Number(prodRes.lastInsertRowid);

    const batchRes = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (?, 'L-VENC-01', '2024-01-01', '2025-01-01', 5, ?)
    `).run(prodId, store.id);
    const batchId = Number(batchRes.lastInsertRowid);

    // Registro de resíduo
    const dispRes = db.prepare(`
      INSERT INTO pgrss_disposal_records (
        store_id, product_id, batch_id, waste_group, reason, quantity, weight_kg,
        pharmacist_name, pharmacist_crf, status
      ) VALUES (?, ?, ?, 'GRUPO_B_QUIMICO', 'VENCIDO', 5, 0.45, 'Dra. Camila', 'CRF-SP 44321', 'STORED')
    `).run(store.id, prodId, batchId);
    expect(dispRes.changes).toBe(1);

    // Manifesto MTR
    const mtrRes = db.prepare(`
      INSERT INTO pgrss_manifests (
        store_id, manifest_number, collector_name, collector_cnpj, environmental_license,
        vehicle_plate, driver_name, total_weight_kg, total_items, dispatch_date, status
      ) VALUES (
        ?, 'MTR-202611-001', 'Biotrat Ambiental Ltda', '12.345.678/0001-90', 'LO-IBAMA-9988/2025',
        'ABC-1D23', 'Carlos Motorista', 0.45, 1, '2026-11-23', 'DISPATCHED'
      )
    `).run(store.id);
    const manifestId = Number(mtrRes.lastInsertRowid);

    // Item do manifesto
    const itemRes = db.prepare(`
      INSERT INTO pgrss_manifest_items (manifest_id, disposal_record_id)
      VALUES (?, ?)
    `).run(manifestId, dispRes.lastInsertRowid);
    expect(itemRes.changes).toBe(1);
  });
});
