import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Schema 016 - SPED Fiscal EFD ICMS/IPI, Sintegra & Bloco H Farmacêutico', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all tables of migration 016 cleanly', () => {
    const tables = db
      .prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('accounting_parameters', 'sped_generations', 'sped_audit_divergences')"
      )
      .all();

    const tableNames = tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([
      'accounting_parameters',
      'sped_audit_divergences',
      'sped_generations',
    ]);
  });

  it('should enforce unique constraint on accounting_parameters (store_id)', () => {
    const insertParam = db.prepare(`
      INSERT INTO accounting_parameters (
        store_id, accountant_name, accountant_cpf, accountant_crc, sped_profile, sped_version
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertParam.run(1, 'Contador Silva', '12345678901', 'CRC-SP 123456/O', 'A', '018');

    expect(() => {
      insertParam.run(1, 'Outro Contador', '98765432100', 'CRC-SP 654321/O', 'B', '018');
    }).toThrow();
  });

  it('should insert sped_generations and cascade audit divergences', () => {
    const insertGen = db.prepare(`
      INSERT INTO sped_generations (
        store_id, generation_type, period_start, period_end, purpose, file_name, file_content, total_lines
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertGen.run(
      1,
      'SPED_EFD',
      '2026-05-01',
      '2026-05-31',
      0,
      'SPED_202605.txt',
      '|0000|018|0|01052026|31052026|FARMA|...\n|9999|10|',
      10
    );

    const genId = Number(result.lastInsertRowid);
    expect(genId).toBeGreaterThan(0);

    const insertDiv = db.prepare(`
      INSERT INTO sped_audit_divergences (
        generation_id, severity, entity_type, entity_id, field_name, description, recommendation
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertDiv.run(
      genId,
      'WARNING',
      'PRODUCT',
      'PROD-101',
      'cest',
      'Produto sem CEST cadastrado',
      'Cadastrar o CEST correspondente ao NCM 3004.90.99'
    );

    const rows = db.prepare('SELECT * FROM sped_audit_divergences WHERE generation_id = ?').all(genId);
    expect(rows).toHaveLength(1);
  });
});
