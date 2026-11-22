import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import type {
  AcquirerContract,
  AcquirerFeeRule,
  CardReconciliationBatch,
  CardSettlementEntry,
  ReconciliationStatus,
  CardOperationType,
  StatementFileType,
} from '../../../src/modules/financial/card-reconciliation.types';

describe('Schema 014 - Contratos de Adquirentes, Taxas MDR e Conciliação de Cartões', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('should run all migrations including 014 cleanly and create all 4 card reconciliation tables', () => {
    runMigrations(db);

    const tables = db
      .prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('acquirer_contracts', 'acquirer_fee_rules', 'card_reconciliation_batches', 'card_settlement_entries')"
      )
      .all();

    const tableNames = tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([
      'acquirer_contracts',
      'acquirer_fee_rules',
      'card_reconciliation_batches',
      'card_settlement_entries',
    ]);
  });

  it('should create the 5 card reconciliation performance indexes', () => {
    runMigrations(db);

    const indexes = db
      .prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_acquirer_contracts_store', 'idx_acquirer_fee_rules_lookup', 'idx_card_settlement_nsu', 'idx_card_settlement_status', 'idx_card_settlement_date')"
      )
      .all();

    const indexNames = indexes.map((i) => i.name).sort();
    expect(indexNames).toEqual([
      'idx_acquirer_contracts_store',
      'idx_acquirer_fee_rules_lookup',
      'idx_card_settlement_date',
      'idx_card_settlement_nsu',
      'idx_card_settlement_status',
    ]);
  });

  it('should enforce acquirer_contracts constraints (unique store+acquirer, foreign keys)', () => {
    runMigrations(db);

    const insertContract = db.prepare(`
      INSERT INTO acquirer_contracts (
        store_id, acquirer_name, acquirer_cnpj, merchant_code,
        default_bank_name, default_bank_agency, default_bank_account
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertContract.run(1, 'CIELO', '01.027.058/0001-91', '10998877', 'Banco do Brasil', '1234-5', '98765-4');

    // Duplicate store_id + acquirer_name should fail
    expect(() => {
      insertContract.run(1, 'CIELO', '01.027.058/0001-91', '99999999', 'Itaú', '0001', '12345-6');
    }).toThrow();
  });

  it('should enforce acquirer_fee_rules constraints and cascade deletion', () => {
    runMigrations(db);

    const contractRes = db.prepare(`
      INSERT INTO acquirer_contracts (
        store_id, acquirer_name, acquirer_cnpj, merchant_code,
        default_bank_name, default_bank_agency, default_bank_account
      ) VALUES (1, 'REDE', '01.425.787/0001-04', 'RED888', 'Itaú', '0001', '55555-0')
    `).run();
    const contractId = contractRes.lastInsertRowid;

    const insertRule = db.prepare(`
      INSERT INTO acquirer_fee_rules (
        contract_id, brand_name, operation_type, installment_min, installment_max, mdr_rate, fixed_fee
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertRule.run(contractId, 'VISA', 'DEBIT', 1, 1, 1.25, 0.0);

    // Invalid operation_type should fail
    expect(() => {
      insertRule.run(contractId, 'VISA', 'INVALID_OP', 1, 1, 1.5, 0.0);
    }).toThrow();

    // Duplicate rule for same range should fail
    expect(() => {
      insertRule.run(contractId, 'VISA', 'DEBIT', 1, 1, 1.40, 0.0);
    }).toThrow();

    // Deleting contract should cascade delete fee rules
    db.prepare('DELETE FROM acquirer_contracts WHERE id = ?').run(contractId);
    const count = db.prepare<{ cnt: number }>('SELECT count(*) as cnt FROM acquirer_fee_rules').get();
    expect(count?.cnt).toBe(0);
  });

  it('should enforce card_reconciliation_batches and card_settlement_entries constraints and cascade', () => {
    runMigrations(db);

    const batchRes = db.prepare(`
      INSERT INTO card_reconciliation_batches (
        store_id, batch_code, file_name, file_type, period_start, period_end, total_records
      ) VALUES (1, 'CONC-202611-0001', 'extrato_cielo_nov2026.csv', 'EXTRATO_CSV', '2026-11-01', '2026-11-20', 10)
    `).run();
    const batchId = batchRes.lastInsertRowid;

    // Unique batch_code
    expect(() => {
      db.prepare(`
        INSERT INTO card_reconciliation_batches (
          store_id, batch_code, file_name, file_type, period_start, period_end
        ) VALUES (1, 'CONC-202611-0001', 'outro.csv', 'EXTRATO_CSV', '2026-11-01', '2026-11-20')
      `).run();
    }).toThrow();

    const insertEntry = db.prepare(`
      INSERT INTO card_settlement_entries (
        batch_id, nsu, authorization_code, transaction_date, settlement_date,
        brand_name, operation_type, gross_amount, charged_mdr_rate, charged_fee_amount,
        net_amount, contract_mdr_rate, expected_fee_amount, expected_net_amount,
        divergence_amount, reconciliation_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertEntry.run(
      batchId,
      '12345678',
      'AUT999',
      '2026-11-19 14:00',
      '2026-11-20',
      'MASTERCARD',
      'DEBIT',
      100.0,
      1.5,
      1.5,
      98.5,
      1.25,
      1.25,
      98.75,
      0.25,
      'DIVERGENT_FEE'
    );

    // Invalid reconciliation_status should fail
    expect(() => {
      insertEntry.run(
        batchId,
        '87654321',
        'AUT888',
        '2026-11-19 15:00',
        '2026-11-20',
        'VISA',
        'DEBIT',
        50.0,
        1.25,
        0.62,
        49.38,
        1.25,
        0.62,
        49.38,
        0.0,
        'INVALID_STATUS'
      );
    }).toThrow();

    // Cascade deletion
    db.prepare('DELETE FROM card_reconciliation_batches WHERE id = ?').run(batchId);
    const count = db.prepare<{ cnt: number }>('SELECT count(*) as cnt FROM card_settlement_entries').get();
    expect(count?.cnt).toBe(0);
  });
});
