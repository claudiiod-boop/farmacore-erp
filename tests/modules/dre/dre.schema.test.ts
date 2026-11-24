import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('DRE Gerencial & Centros de Custos Schema (Migration 025)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required financial DRE tables and seed default cost centers', () => {
    const tables = [
      'cost_centers',
      'operational_expenses',
      'dre_snapshots',
    ];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }

    // Valida seed padrão de centros de custo
    const costCenters = db.prepare('SELECT code, department_type FROM cost_centers').all() as Array<{
      code: string;
      department_type: string;
    }>;
    expect(costCenters.length).toBeGreaterThanOrEqual(6);

    const balcao = costCenters.find((c) => c.code === 'CC-BALCAO');
    expect(balcao?.department_type).toBe('BALCAO');

    const admin = costCenters.find((c) => c.code === 'CC-ADMIN');
    expect(admin?.department_type).toBe('ADMINISTRATIVO');
  });

  it('should insert operational expenses with valid relations and checks', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    const costCenter = db.prepare('SELECT id FROM cost_centers WHERE code = ?').get('CC-BALCAO') as { id: number };

    const insertExp = db.prepare(`
      INSERT INTO operational_expenses (store_id, cost_center_id, expense_type, description, amount, due_date, status)
      VALUES (?, ?, 'PESSOAL', 'Salários Balconistas', 12500.50, '2026-11-05', 'PAID')
    `).run(store.id, costCenter.id);

    expect(insertExp.changes).toBe(1);

    const exp = db.prepare('SELECT * FROM operational_expenses WHERE id = ?').get(insertExp.lastInsertRowid) as any;
    expect(exp.description).toBe('Salários Balconistas');
    expect(exp.amount).toBe(12500.50);
    expect(exp.expense_type).toBe('PESSOAL');
  });

  it('should enforce dre_snapshots unique constraint per store, period and regime', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };

    db.prepare(`
      INSERT INTO dre_snapshots (
        store_id, period_month, regime, gross_revenue, deductions_amount,
        net_revenue, cmv_amount, gross_profit, gross_margin_percent,
        operating_expenses_amount, ebitda_amount, ebitda_margin_percent,
        financial_expenses_amount, net_profit, net_margin_percent, break_even_point
      ) VALUES (
        ?, '2026-11', 'COMPETENCIA', 100000, 10000,
        90000, 50000, 40000, 44.44,
        20000, 20000, 22.22,
        2000, 18000, 20.0, 45000
      )
    `).run(store.id);

    // Tentar inserir duplicado para a mesma filial, mês e regime deve falhar
    expect(() => {
      db.prepare(`
        INSERT INTO dre_snapshots (
          store_id, period_month, regime, gross_revenue, deductions_amount,
          net_revenue, cmv_amount, gross_profit, gross_margin_percent,
          operating_expenses_amount, ebitda_amount, ebitda_margin_percent,
          financial_expenses_amount, net_profit, net_margin_percent, break_even_point
        ) VALUES (
          ?, '2026-11', 'COMPETENCIA', 100000, 10000,
          90000, 50000, 40000, 44.44,
          20000, 20000, 22.22,
          2000, 18000, 20.0, 45000
        )
      `).run(store.id);
    }).toThrow();
  });
});
