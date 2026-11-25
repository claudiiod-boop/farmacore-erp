import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Self-Checkout Autonomous Kiosk Schema (Migration 041)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);

    // Kiosk terminal para chave estrangeira
    db.prepare(`
      INSERT OR IGNORE INTO kiosk_terminals (id, store_id, terminal_code, name, mode, is_active)
      VALUES (1, 1, 'TOTEM-01', 'Totem Entrada', 'SELF_PRE_SALE', 1)
    `).run();

    // Produto OTC
    db.prepare(`
      INSERT OR IGNORE INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
      VALUES (1, '7891234567890', 'Vitamina C 1g Efervescente', 'Acido Ascorbico', '1004300010011', 'SEM_TARJA', 'NAO_CONTROLADO', 25.0, 15.0, 18.0, 1)
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('should create self_checkout_sessions and self_checkout_items tables cleanly', () => {
    const tables = ['self_checkout_sessions', 'self_checkout_items'];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }
  });

  it('should insert session and items enforcing constraints and foreign keys', () => {
    const sessionRes = db.prepare(`
      INSERT INTO self_checkout_sessions (
        kiosk_id, store_id, session_code, status, customer_cpf, subtotal, total_amount
      ) VALUES (
        1, 1, 'SC-20261125-0001', 'OPEN', '123.456.789-00', 18.0, 18.0
      )
    `).run();
    const sessionId = Number(sessionRes.lastInsertRowid);
    expect(sessionId).toBeGreaterThan(0);

    const itemRes = db.prepare(`
      INSERT INTO self_checkout_items (
        session_id, product_id, quantity, unit_price, total_price
      ) VALUES (
        ?, 1, 1, 18.0, 18.0
      )
    `).run(sessionId);
    expect(Number(itemRes.lastInsertRowid)).toBeGreaterThan(0);

    const items = db.prepare('SELECT * FROM self_checkout_items WHERE session_id = ?').all(sessionId);
    expect(items.length).toBe(1);
  });
});
