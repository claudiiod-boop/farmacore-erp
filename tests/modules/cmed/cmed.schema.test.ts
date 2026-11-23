import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Schema 019 - CMED / ANVISA Tabela de Preços e Trava Sanitária', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all tables of migration 019 cleanly', () => {
    const tables = [
      'cmed_table_versions',
      'cmed_products',
      'cmed_pricing_rules',
      'cmed_price_audit_logs',
    ];

    for (const table of tables) {
      const row = db
        .prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table);
      expect(row, `Tabela ${table} deveria existir`).toBeDefined();
    }
  });

  it('should register a CMED table version and insert a product with ICMS rates', () => {
    const versionRes = db.prepare(`
      INSERT INTO cmed_table_versions (version_code, release_date, total_records, file_hash)
      VALUES (?, ?, ?, ?)
    `).run('CMED-2026-11', '2026-11-01', 25000, 'hash123456');

    const versionId = Number(versionRes.lastInsertRowid);
    expect(versionId).toBeGreaterThan(0);

    // Insere produto CMED
    db.prepare(`
      INSERT INTO cmed_products (
        version_id, ean, ms_registration, product_name, substance_name, laboratory_name,
        product_type, list_type, pf_18, pmc_18, pf_20, pmc_20
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      versionId,
      '7891234567890',
      '1000000000001',
      'Amoxicilina 500mg 21 caps',
      'Amoxicilina',
      'EMS S/A',
      'GENERICO',
      'NEGATIVA',
      22.50,
      35.00,
      23.20,
      36.10
    );

    const prod = db.prepare<any>('SELECT * FROM cmed_products WHERE ean = ?').get('7891234567890');
    expect(prod).toBeDefined();
    expect(prod.product_type).toBe('GENERICO');
    expect(prod.list_type).toBe('NEGATIVA');
    expect(prod.pmc_18).toBe(35.00);

    // Deleção da versão deve remover os produtos em cascata
    db.prepare('DELETE FROM cmed_table_versions WHERE id = ?').run(versionId);
    const prodAfter = db.prepare<any>('SELECT * FROM cmed_products WHERE ean = ?').get('7891234567890');
    expect(prodAfter).toBeUndefined();
  });

  it('should enforce unique constraint on cmed_pricing_rules per store and category', () => {
    db.prepare(`
      INSERT INTO cmed_pricing_rules (store_id, category_type, discount_percent_pmc, min_gross_margin_percent)
      VALUES (?, ?, ?, ?)
    `).run(1, 'GENERICO', 35.0, 20.0);

    expect(() => {
      db.prepare(`
        INSERT INTO cmed_pricing_rules (store_id, category_type, discount_percent_pmc, min_gross_margin_percent)
        VALUES (?, ?, ?, ?)
      `).run(1, 'GENERICO', 40.0, 25.0);
    }).toThrow();
  });
});
