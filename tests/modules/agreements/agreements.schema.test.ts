import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Migration 044: Corporate Agreements & Payroll Billing Schema', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create agreement_invoice_items and agreement_payroll_exports tables with proper schema', () => {
    const itemsInfo = db.prepare(`PRAGMA table_info(agreement_invoice_items)`).all() as any[];
    const itemCols = itemsInfo.map((c) => c.name);

    expect(itemCols).toContain('id');
    expect(itemCols).toContain('invoice_id');
    expect(itemCols).toContain('sale_id');
    expect(itemCols).toContain('customer_id');
    expect(itemCols).toContain('employee_code');
    expect(itemCols).toContain('customer_name');
    expect(itemCols).toContain('customer_cpf');
    expect(itemCols).toContain('sale_date');
    expect(itemCols).toContain('sale_amount');

    const exportsInfo = db.prepare(`PRAGMA table_info(agreement_payroll_exports)`).all() as any[];
    const exportCols = exportsInfo.map((c) => c.name);

    expect(exportCols).toContain('id');
    expect(exportCols).toContain('invoice_id');
    expect(exportCols).toContain('agreement_id');
    expect(exportCols).toContain('export_date');
    expect(exportCols).toContain('total_employees');
    expect(exportCols).toContain('total_amount');
    expect(exportCols).toContain('file_content_csv');
  });
});
