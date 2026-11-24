import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Devoluções e Estorno Fiscal Schema (Migration 031)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required customer returns tables cleanly', () => {
    const tables = [
      'customer_returns',
      'customer_return_items',
      'store_credits',
    ];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }
  });

  it('should insert customer return, items and store credit with foreign keys', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };

    // Inserir cliente
    const custRes = db.prepare(`
      INSERT INTO customers (store_id, name, cpf, phone, email)
      VALUES (?, 'Carlos Silva', '12345678901', '11999998888', 'carlos@example.com')
    `).run(store.id);
    const customerId = Number(custRes.lastInsertRowid);

    // Inserir produto
    const prodRes = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7891234567891', 'Dipirona 500mg 20 comp', 'Dipirona Monoidratada', '1004300099', 'SEM_TARJA', 'NONE', 10.0, 3.0, 7.5)
    `).run();
    const productId = Number(prodRes.lastInsertRowid);

    // Inserir venda fictícia
    const saleRes = db.prepare(`
      INSERT INTO sales (total_amount, status)
      VALUES (15.0, 'COMPLETED')
    `).run();
    const saleId = Number(saleRes.lastInsertRowid);

    // Inserir devolução
    const returnRes = db.prepare(`
      INSERT INTO customer_returns (
        store_id, sale_id, customer_id, code, return_type, refund_method,
        total_amount, reason, notes, status, cfop, created_by
      ) VALUES (?, ?, ?, 'DEV-2026-0001', 'RETURN', 'STORE_CREDIT', 15.0, 'WRONG_ITEM', 'Cliente comprou errado', 'APPROVED', '1.202', 'Operador Balcão')
    `).run(store.id, saleId, customerId);
    const returnId = Number(returnRes.lastInsertRowid);
    expect(returnId).toBeGreaterThan(0);

    // Inserir item da devolução
    const itemRes = db.prepare(`
      INSERT INTO customer_return_items (
        return_id, product_id, quantity, unit_price, total_price, condition, destination, is_thermolabile, requires_pharmacist_auth
      ) VALUES (?, ?, 2, 7.5, 15.0, 'INTACT', 'RETURN_TO_STOCK', 0, 0)
    `).run(returnId, productId);
    expect(Number(itemRes.lastInsertRowid)).toBeGreaterThan(0);

    // Inserir vale-compras
    const creditRes = db.prepare(`
      INSERT INTO store_credits (
        store_id, customer_id, return_id, code, initial_balance, current_balance, expires_at
      ) VALUES (?, ?, ?, 'CRED-2026-XYZ123', 15.0, 15.0, datetime('now', '+90 days'))
    `).run(store.id, customerId, returnId);
    expect(Number(creditRes.lastInsertRowid)).toBeGreaterThan(0);

    // Consulta integrada
    const checkReturn = db.prepare(`
      SELECT cr.*, sc.code AS credit_code
      FROM customer_returns cr
      LEFT JOIN store_credits sc ON sc.return_id = cr.id
      WHERE cr.id = ?
    `).get(returnId) as any;

    expect(checkReturn.code).toBe('DEV-2026-0001');
    expect(checkReturn.total_amount).toBe(15.0);
    expect(checkReturn.credit_code).toBe('CRED-2026-XYZ123');
  });
});
