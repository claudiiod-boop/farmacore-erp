import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Migration 049 - MDF-e Modelo 58 Schema Tests', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('deve criar a tabela mdfe_documents e permitir rascunho de manifesto', () => {
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj) VALUES (1, 'CD FarmaCore SP', '11.222.333/0001-44')
    `).run();

    const ins = db.prepare(`
      INSERT INTO mdfe_documents (
        store_id, mdfe_number, series, access_key, emission_type, uf_start, uf_end,
        driver_name, driver_cpf, vehicle_plate, total_nfe_count, total_cargo_value_brl,
        total_weight_kg, status
      ) VALUES (
        1, 1, 1, '35261111222333000144580010000000011000000010', 'NORMAL', 'SP', 'RJ',
        'José Almeida', '123.456.789-00', 'ABC-1234', 2, 45000.0, 350.0, 'DRAFT'
      )
    `).run();

    expect(ins.changes).toBe(1);
    const row = db.prepare('SELECT * FROM mdfe_documents WHERE id = ?').get(ins.lastInsertRowid) as any;
    expect(row.driver_name).toBe('José Almeida');
    expect(row.status).toBe('DRAFT');
  });

  it('deve criar a tabela mdfe_nfe_items vinculando as NF-e agrupadas', () => {
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj) VALUES (1, 'CD FarmaCore SP', '11.222.333/0001-44')
    `).run();

    const mdfe = db.prepare(`
      INSERT INTO mdfe_documents (
        store_id, mdfe_number, access_key, uf_start, uf_end, driver_name, driver_cpf, vehicle_plate, status
      ) VALUES (
        1, 1, '35261111222333000144580010000000011000000010', 'SP', 'RJ', 'José Almeida', '123.456.789-00', 'ABC-1234', 'DRAFT'
      )
    `).run();

    const insItem = db.prepare(`
      INSERT INTO mdfe_nfe_items (
        mdfe_id, nfe_access_key, nfe_number, cargo_value_brl, weight_kg
      ) VALUES (
        ?, '35261111222333000144550010000000011000000019', 1, 25000.0, 200.0
      )
    `).run(mdfe.lastInsertRowid);

    expect(insItem.changes).toBe(1);
    const item = db.prepare('SELECT * FROM mdfe_nfe_items WHERE id = ?').get(insItem.lastInsertRowid) as any;
    expect(item.cargo_value_brl).toBe(25000.0);
  });
});
