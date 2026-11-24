import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Gestão de Comissões, Metas & Campanhas Schema (Migration 024)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required commission tables and seed default rules cleanly', () => {
    const tables = [
      'sellers',
      'commission_rules',
      'commission_campaigns',
      'sales_goals',
      'commission_statements',
    ];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }

    // Valida seed padrão de regras
    const rules = db.prepare('SELECT category_type, percentage FROM commission_rules').all() as Array<{
      category_type: string;
      percentage: number;
    }>;
    expect(rules.length).toBe(6);
    const genericoRule = rules.find((r) => r.category_type === 'GENERICO');
    expect(genericoRule?.percentage).toBe(6.0);
  });

  it('should insert seller, campaign, goal and statement with foreign keys', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };

    // Vendedor
    const sellerRes = db.prepare(`
      INSERT INTO sellers (store_id, name, cpf, role)
      VALUES (?, 'João Balconista', '111.333.555-77', 'BALCONISTA')
    `).run(store.id);
    const sellerId = Number(sellerRes.lastInsertRowid);
    expect(sellerId).toBeGreaterThan(0);

    // Campanha
    const campRes = db.prepare(`
      INSERT INTO commission_campaigns (name, manufacturer, bonus_per_unit, start_date, end_date)
      VALUES ('Campanha Eurofarma Inverno', 'Eurofarma', 1.50, '2026-06-01', '2026-08-31')
    `).run();
    expect(campRes.lastInsertRowid).toBeGreaterThan(0);

    // Meta Mensal
    const goalRes = db.prepare(`
      INSERT INTO sales_goals (seller_id, store_id, period_month, target_amount)
      VALUES (?, ?, '2026-11', 50000.0)
    `).run(sellerId, store.id);
    expect(goalRes.lastInsertRowid).toBeGreaterThan(0);

    // Produto
    const prodRes = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('Dipirona 500mg', '7891234567890', 'Dipirona', '100000001', 'RED', 'NONE', 15.0, 7.0, 10.0)
    `).run();
    const productId = Number(prodRes.lastInsertRowid);

    // Venda
    const saleRes = db.prepare(`
      INSERT INTO sales (total_amount, discount_amount, change_amount)
      VALUES (20.0, 0.0, 0.0)
    `).run();
    const saleId = Number(saleRes.lastInsertRowid);

    // Extrato de Comissão
    const stmtRes = db.prepare(`
      INSERT INTO commission_statements (
        seller_id, sale_id, product_id, category_type, item_total, base_commission_percent,
        base_commission_amount, campaign_bonus_amount, accelerator_multiplier, final_commission_amount,
        period_month, status
      ) VALUES (?, ?, ?, 'GENERICO', 20.0, 6.0, 1.20, 1.50, 1.0, 2.70, '2026-11', 'PENDING')
    `).run(sellerId, saleId, productId);

    expect(stmtRes.lastInsertRowid).toBeGreaterThan(0);
  });
});
