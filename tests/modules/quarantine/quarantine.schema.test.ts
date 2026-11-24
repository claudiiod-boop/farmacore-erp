import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Quarentena Sanitária & Alertas Notivisa Schema (Migration 032)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required quarantine and recall tables cleanly', () => {
    const tables = ['quarantine_records', 'recall_alerts'];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }
  });

  it('should insert quarantine record and recall alert with foreign keys and constraints', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };

    // Inserir produto
    const prodRes = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7891234990011', 'Valsartana 160mg 30 comp', 'Valsartana', '1004300088', 'VERMELHA', 'NONE', 45.0, 15.0, 28.0)
    `).run();
    const productId = Number(prodRes.lastInsertRowid);

    // Inserir lote
    const batchRes = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'L-VAL-88', '2025-01-01', '2026-01-01', 40)
    `).run(productId);
    const batchId = Number(batchRes.lastInsertRowid);

    // Inserir quarentena
    const quarRes = db.prepare(`
      INSERT INTO quarantine_records (
        store_id, product_id, batch_id, quantity, reason, origin, status, notes, quarantined_by
      ) VALUES (?, ?, ?, 10, 'EXPIRED', 'INVENTORY_SWEEP', 'QUARANTINED', 'Lote expirado na gôndola', 'Farmacêutico RT')
    `).run(store.id, productId, batchId);
    const quarantineId = Number(quarRes.lastInsertRowid);
    expect(quarantineId).toBeGreaterThan(0);

    // Inserir alerta de recall
    const recallRes = db.prepare(`
      INSERT INTO recall_alerts (
        anvisa_re_number, publication_date, product_id, batch_number, reason, severity, is_active, affected_units_blocked, created_by
      ) VALUES ('RE 4.567/2026', '2026-11-24', ?, 'L-VAL-88', 'Presença de impureza nitrosamina acima do limite', 'CRITICAL', 1, 30, 'Vigilância Sanitária')
    `).run(productId);
    const recallId = Number(recallRes.lastInsertRowid);
    expect(recallId).toBeGreaterThan(0);

    // Consulta integrada
    const checkRow = db.prepare(`
      SELECT qr.*, p.name AS product_name, b.batch_number
      FROM quarantine_records qr
      JOIN products p ON p.id = qr.product_id
      JOIN batches b ON b.id = qr.batch_id
      WHERE qr.id = ?
    `).get(quarantineId) as any;

    expect(checkRow.product_name).toContain('Valsartana');
    expect(checkRow.batch_number).toBe('L-VAL-88');
    expect(checkRow.quantity).toBe(10);
    expect(checkRow.reason).toBe('EXPIRED');
  });
});
