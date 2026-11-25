import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Migration 042: DDA Bank Slips Reconciliation Schema', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create dda_invoices table with proper columns and constraints', () => {
    const tableInfo = db.prepare(`PRAGMA table_info(dda_invoices)`).all() as any[];
    const columnNames = tableInfo.map((col) => col.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('store_id');
    expect(columnNames).toContain('bank_code');
    expect(columnNames).toContain('bank_name');
    expect(columnNames).toContain('barcode');
    expect(columnNames).toContain('digitable_line');
    expect(columnNames).toContain('beneficiary_cnpj');
    expect(columnNames).toContain('beneficiary_name');
    expect(columnNames).toContain('payer_cnpj');
    expect(columnNames).toContain('due_date');
    expect(columnNames).toContain('issue_date');
    expect(columnNames).toContain('nominal_amount');
    expect(columnNames).toContain('final_amount');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('matched_purchase_invoice_id');
    expect(columnNames).toContain('matched_expense_id');
  });

  it('should enforce status check constraint on dda_invoices', () => {
    const insert = db.prepare(`
      INSERT INTO dda_invoices (
        id, store_id, bank_code, bank_name, barcode, digitable_line,
        beneficiary_cnpj, beneficiary_name, payer_cnpj, due_date, issue_date,
        nominal_amount, discount_amount, interest_amount, final_amount,
        status, created_at, updated_at
      ) VALUES (
        'dda-1', 'STORE-01', '001', 'Banco do Brasil', '00191234567890123456789012345678901234567890',
        '00190.00009 01234.567890 12345.678901 2 89012345678901', '12345678000199', 'Distribuidora Panpharma',
        '98765432000188', '2026-12-15', '2026-11-25', 1500.00, 0, 0, 1500.00,
        'INVALID_STATUS', '2026-11-25T10:00:00Z', '2026-11-25T10:00:00Z'
      )
    `);

    expect(() => insert.run()).toThrow();
  });
});
