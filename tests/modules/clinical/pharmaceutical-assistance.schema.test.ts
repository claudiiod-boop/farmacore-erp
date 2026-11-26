import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Pharmaceutical Assistance Database Schema (Migration 050)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    if (db) db.close();
  });

  it('should successfully create pharmaceutical staff and enforce constraints', () => {
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj)
      VALUES (1, 'Magnos Farma Matriz', '12345678000199')
    `).run();

    const insertStaff = db.prepare(`
      INSERT INTO pharmaceutical_staff (store_id, name, cpf, crf_number, crf_uf, role, crt_certificate_number, crt_validity_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStaff.run(
      1,
      'Dra. Claudia Santos',
      '123.456.789-00',
      '12345',
      'SP',
      'RT_TITULAR',
      'CRT-2026-SP-9988',
      '2026-12-31'
    );

    expect(result.changes).toBe(1);

    const row = db.prepare('SELECT * FROM pharmaceutical_staff WHERE id = ?').get(result.lastInsertRowid) as any;
    expect(row.name).toBe('Dra. Claudia Santos');
    expect(row.role).toBe('RT_TITULAR');
    expect(row.is_active).toBe(1);

    // Duplicate CPF should fail
    expect(() => {
      insertStaff.run(1, 'Outro Farmacêutico', '123.456.789-00', '54321', 'SP', 'RT_SUBSTITUTO', null, null);
    }).toThrow();
  });

  it('should create shifts and logbook entries with integrity hash', () => {
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj)
      VALUES (1, 'Magnos Farma Matriz', '12345678000199')
    `).run();

    const staffRes = db.prepare(`
      INSERT INTO pharmaceutical_staff (store_id, name, cpf, crf_number, crf_uf, role)
      VALUES (1, 'Dr. Roberto Farmacêutico', '987.654.321-99', '9876', 'RJ', 'RT_TITULAR')
    `).run();
    const staffId = staffRes.lastInsertRowid;

    // Shift
    const insertShift = db.prepare(`
      INSERT INTO pharmaceutical_shifts (store_id, staff_id, day_of_week, start_time, end_time)
      VALUES (1, ?, 1, '08:00', '17:00')
    `);
    const shiftResult = insertShift.run(staffId);
    expect(shiftResult.changes).toBe(1);

    // Logbook entry
    const insertLog = db.prepare(`
      INSERT INTO pharmaceutical_logbook_entries (
        store_id, staff_id, entry_type, title, description, entry_date, sha256_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const logResult = insertLog.run(
      1,
      staffId,
      'INSPECTION_CRF',
      'Fiscalização de Rotina CRF/RJ',
      'Fiscalização realizada sem não conformidades.',
      '2026-11-26 14:00:00',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
    expect(logResult.changes).toBe(1);
  });
});
