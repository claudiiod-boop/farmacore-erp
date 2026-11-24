import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Reposição Inteligente de Estoque Schema (Migration 030)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required replenishment tables cleanly', () => {
    const tables = [
      'replenishment_parameters',
      'replenishment_orders',
      'replenishment_order_items',
    ];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }
  });

  it('should insert replenishment parameters and order items with foreign keys', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };

    // Inserir produto
    const prodRes = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7891234567891', 'Losartana Potássica 50mg 30 comp', 'Losartana Potássica', '1004300099', 'VERMELHA', 'NONE', 18.0, 5.0, 9.9)
    `).run();
    const prodId = Number(prodRes.lastInsertRowid);

    // Inserir parâmetros de reposição
    const paramRes = db.prepare(`
      INSERT INTO replenishment_parameters (
        product_id, store_id, lead_time_days, safety_stock_days, review_cycle_days, abc_class
      ) VALUES (?, ?, 2, 4, 7, 'A')
    `).run(prodId, store.id);
    const paramId = Number(paramRes.lastInsertRowid);
    expect(paramId).toBeGreaterThan(0);

    // Inserir pedido de reposição
    const orderRes = db.prepare(`
      INSERT INTO replenishment_orders (
        store_id, distributor_name, status, total_items, estimated_total, notes
      ) VALUES (?, 'Distribuidora Santa Cruz', 'DRAFT', 1, 250.0, 'Pedido Semanal Curva A')
    `).run(store.id);
    const orderId = Number(orderRes.lastInsertRowid);
    expect(orderId).toBeGreaterThan(0);

    // Inserir item do pedido
    const itemRes = db.prepare(`
      INSERT INTO replenishment_order_items (
        order_id, product_id, suggested_quantity, order_quantity, unit_cost, subtotal, current_stock, reorder_point
      ) VALUES (?, ?, 50, 50, 5.0, 250.0, 8, 30)
    `).run(orderId, prodId);
    expect(Number(itemRes.lastInsertRowid)).toBeGreaterThan(0);

    // Valida constraint UNIQUE (product_id, store_id)
    expect(() => {
      db.prepare(`
        INSERT INTO replenishment_parameters (
          product_id, store_id, lead_time_days, safety_stock_days
        ) VALUES (?, ?, 3, 5)
      `).run(prodId, store.id);
    }).toThrow();
  });
});
