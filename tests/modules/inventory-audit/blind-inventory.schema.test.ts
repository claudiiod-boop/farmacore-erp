import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Migration 045: Balanço Patrimonial & Inventário Rotativo Cego', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('deve criar com sucesso as tabelas stock_inventories, stock_inventory_items e stock_inventory_adjustments', () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('stock_inventories', 'stock_inventory_items', 'stock_inventory_adjustments')"
      )
      .all() as Array<{ name: string }>;

    expect(tables.map((t) => t.name)).toContain('stock_inventories');
    expect(tables.map((t) => t.name)).toContain('stock_inventory_items');
    expect(tables.map((t) => t.name)).toContain('stock_inventory_adjustments');
  });

  it('deve inserir e recuperar sessão de inventário e itens com travas e chaves estrangeiras', () => {
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj) VALUES (1, 'Farma Matriz', '11.111.111/0001-11')
    `).run();

    db.prepare(`
      INSERT INTO products (
        id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price
      ) VALUES (
        1, '7891234567890', 'Clonazepam 2mg 30 comp', 'Clonazepam', '1.0000.0000', 'PRETA', 'PORTARIA_344', 30.0, 20.0, 25.0
      )
    `).run();

    const inv = db.prepare(`
      INSERT INTO stock_inventories (
        code, store_id, type, status
      ) VALUES ('INV-202611-0001', 1, 'CONTROLADOS_SNGPC', 'OPEN')
    `).run();

    const invId = Number(inv.lastInsertRowid);

    db.prepare(`
      INSERT INTO stock_inventory_items (
        inventory_id, product_id, system_quantity, counted_quantity, is_controlled
      ) VALUES (?, 1, 10, 8, 1)
    `).run(invId);

    const saved = db.prepare(`SELECT * FROM stock_inventory_items WHERE inventory_id = ?`).get(invId) as any;
    expect(saved.is_controlled).toBe(1);
    expect(saved.system_quantity).toBe(10);
    expect(saved.counted_quantity).toBe(8);
  });
});
