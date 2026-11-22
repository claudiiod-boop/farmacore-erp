import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Schema 015 - Conciliação Bancária OFX, Extratos e Fluxo de Caixa', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all tables of migration 015 cleanly', () => {
    const tables = db
      .prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('bank_accounts', 'bank_statement_batches', 'bank_statement_entries')"
      )
      .all();

    const tableNames = tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([
      'bank_accounts',
      'bank_statement_batches',
      'bank_statement_entries',
    ]);
  });

  it('should enforce unique constraint on bank_accounts (store_id, bank_code, agency_number, account_number)', () => {
    const insertAccount = db.prepare(`
      INSERT INTO bank_accounts (
        store_id, bank_code, bank_name, agency_number, account_number, account_type, initial_balance
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertAccount.run(1, '341', 'Banco Itaú', '0057', '12345-6', 'CHECKING', 1000.0);

    // Duplicado deve falhar
    expect(() => {
      insertAccount.run(1, '341', 'Banco Itaú', '0057', '12345-6', 'CHECKING', 5000.0);
    }).toThrow();
  });

  it('should enforce idempotency on bank_statement_entries by (bank_account_id, fitid)', () => {
    const accResult = db.prepare(`
      INSERT INTO bank_accounts (
        store_id, bank_code, bank_name, agency_number, account_number
      ) VALUES (1, '001', 'Banco do Brasil', '1234', '99999-0')
    `).run();
    const accountId = accResult.lastInsertRowid;

    const batchResult = db.prepare(`
      INSERT INTO bank_statement_batches (
        bank_account_id, batch_code, file_name, period_start, period_end, total_entries
      ) VALUES (?, 'OFX-001', 'extrato.ofx', '2026-06-01', '2026-06-30', 2)
    `).run(accountId);
    const batchId = batchResult.lastInsertRowid;

    const insertEntry = db.prepare(`
      INSERT INTO bank_statement_entries (
        batch_id, bank_account_id, fitid, transaction_type, posted_date, amount, memo
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertEntry.run(batchId, accountId, 'FITID-20260601-001', 'CREDIT', '2026-06-01', 500.0, 'DEP DINHEIRO');

    // Inserção com o mesmo fitid para a mesma conta bancária DEVE lançar exceção de constraint UNIQUE
    expect(() => {
      insertEntry.run(batchId, accountId, 'FITID-20260601-001', 'CREDIT', '2026-06-01', 500.0, 'DEP DINHEIRO');
    }).toThrow();
  });
});
