import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Digital Prescriptions Schema (Migration 035)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required digital prescriptions tables cleanly', () => {
    const tables = ['digital_prescriptions', 'digital_prescription_items', 'digital_prescription_dispensations'];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }
  });

  it('should insert digital prescription with items and dispensation audit', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };

    // Inserir receita digital
    const pRes = db.prepare(`
      INSERT INTO digital_prescriptions (
        prescription_code, prescriber_name, prescriber_crm, prescriber_uf,
        patient_name, patient_cpf, prescription_type, expires_at, status
      ) VALUES ('MEM-2026-9999', 'Dr. Roberto Cardoso', 'CRM-SP 123456', 'SP', 'Carlos Eduardo', '123.456.789-00', 'CONTROLLED_C1', '2026-12-24', 'VALID')
    `).run();
    const prescriptionId = Number(pRes.lastInsertRowid);
    expect(prescriptionId).toBeGreaterThan(0);

    // Inserir item
    const iRes = db.prepare(`
      INSERT INTO digital_prescription_items (
        prescription_id, medication_name, dosage, quantity_prescribed, instructions
      ) VALUES (?, 'Clonazepam 2mg', '2mg', 2, 'Tomar 1 comp à noite')
    `).run(prescriptionId);
    expect(Number(iRes.lastInsertRowid)).toBeGreaterThan(0);

    // Inserir carimbo de dispensação
    const dRes = db.prepare(`
      INSERT INTO digital_prescription_dispensations (
        prescription_id, store_id, pharmacist_name, pharmacist_crf, digital_stamp
      ) VALUES (?, ?, 'Dra. Vanessa', 'CRF-SP 99887', 'STAMP-HASH-2026')
    `).run(prescriptionId, store.id);
    expect(Number(dRes.lastInsertRowid)).toBeGreaterThan(0);

    // Validar constraint de código único
    expect(() => {
      db.prepare(`
        INSERT INTO digital_prescriptions (
          prescription_code, prescriber_name, prescriber_crm, prescriber_uf,
          patient_name, prescription_type, expires_at
        ) VALUES ('MEM-2026-9999', 'Outro Médico', 'CRM 00', 'SP', 'Outro', 'REGULAR', '2026-12-24')
      `).run();
    }).toThrow();
  });
});
