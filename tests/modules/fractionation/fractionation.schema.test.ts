import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Fracionamento de Medicamentos em Blíster Schema (Migration 023 - RDC 80/2006)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should verify products columns and created fractionation tables', () => {
    const pragma = db.prepare('PRAGMA table_info(products)').all() as Array<{ name: string }>;
    const columnNames = pragma.map((c) => c.name);

    expect(columnNames).toContain('is_fractionable');
    expect(columnNames).toContain('units_per_package');
    expect(columnNames).toContain('fractional_unit');

    const tables = ['fractionation_records', 'fractionation_dispensations'];
    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }
  });

  it('should insert fractionation record and dispensation with foreign keys', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };

    // Insere produto fracionável
    const prodRes = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_fractionable, units_per_package, fractional_unit)
      VALUES ('Amoxicilina 500mg 21 caps', '7891234567895', 'Amoxicilina', '100000099', 'RED', 'NONE', 40.0, 20.0, 30.0, 1, 21, 'CAPSULA')
    `).run();
    const productId = Number(prodRes.lastInsertRowid);

    // Insere lote pai com 10 caixas
    const batchRes = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity)
      VALUES (?, 'LOTE-AMOX-01', '2026-01-01', '2028-01-01', 10, 0)
    `).run(productId);
    const batchId = Number(batchRes.lastInsertRowid);

    // Insere fracionamento de 2 caixas gerando 42 cápsulas
    const fracRes = db.prepare(`
      INSERT INTO fractionation_records (
        store_id, product_id, original_batch_id, pharmacist_name, pharmacist_crf,
        pharmacist_crf_uf, original_packages_opened, units_generated, units_available,
        sub_batch_code, expiry_date
      ) VALUES (?, ?, ?, 'Dra. Camila Farmacêutica', '99887', 'SP', 2, 42, 42, 'FRAC-AMOX-01', '2028-01-01')
    `).run(store.id, productId, batchId);
    const fracId = Number(fracRes.lastInsertRowid);

    expect(fracId).toBeGreaterThan(0);

    // Insere dispensação de 10 cápsulas ao paciente
    const dispRes = db.prepare(`
      INSERT INTO fractionation_dispensations (
        fractionation_record_id, patient_name, doctor_name, doctor_crm, doctor_uf,
        units_dispensed, unit_price, total_price, leaflet_supplied, posology
      ) VALUES (?, 'Sr. José Ferreira', 'Dr. Roberto', '11223', 'SP', 10, 1.43, 14.30, 1, 'Tomar 1 cápsula de 8 em 8 horas por 7 dias')
    `).run(fracId);

    expect(dispRes.lastInsertRowid).toBeGreaterThan(0);
  });
});
