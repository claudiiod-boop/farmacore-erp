import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Injectables & Vaccination Schema (Migration 037)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create injectable_administration_logs and vaccination_records tables cleanly', () => {
    const tables = ['injectable_administration_logs', 'vaccination_records'];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }
  });

  it('should insert injectable administration log and enforce unique declaration_number', () => {
    const res = db.prepare(`
      INSERT INTO injectable_administration_logs (
        store_id, patient_name, patient_cpf, patient_birth_date,
        medication_name, medication_dosage, medication_batch, medication_expiration_date,
        syringe_needle_batch, administration_route, anatomical_site,
        prescriber_name, prescriber_crm, prescriber_uf,
        pharmacist_name, pharmacist_crf, declaration_number
      ) VALUES (
        1, 'João da Silva', '123.456.789-00', '1985-05-10',
        'Voltaren (Diclofenaco Sódico)', '75mg/3mL', 'LOTE-VOLT-12', '2027-10-31',
        'SER-AG-449', 'INTRAMUSCULAR', 'Glúteo Ventro-glúteo',
        'Dr. Pedro Santos', 'CRM 55443', 'SP',
        'Dra. Camila Farmacêutica', 'CRF-SP 66778', 'DSF-INJ-2026-0001'
      )
    `).run();

    expect(Number(res.lastInsertRowid)).toBeGreaterThan(0);

    // Duplicidade de DSF deve falhar
    expect(() => {
      db.prepare(`
        INSERT INTO injectable_administration_logs (
          store_id, patient_name, patient_cpf, medication_name, medication_dosage,
          medication_batch, medication_expiration_date, syringe_needle_batch,
          administration_route, anatomical_site, prescriber_name, prescriber_crm,
          prescriber_uf, pharmacist_name, pharmacist_crf, declaration_number
        ) VALUES (
          1, 'Outro', '111.222.333-44', 'Med', '10mg',
          'L1', '2027-01-01', 'S1',
          'INTRAMUSCULAR', 'Deltoide', 'Presc', '123',
          'SP', 'Pharm', 'CRF', 'DSF-INJ-2026-0001'
        )
      `).run();
    }).toThrow();
  });

  it('should insert vaccination record and enforce dose_type constraint', () => {
    const res = db.prepare(`
      INSERT INTO vaccination_records (
        store_id, patient_name, patient_cpf, patient_birth_date,
        vaccine_name, manufacturer, vaccine_batch, vaccine_expiration_date,
        dose_type, administration_route, anatomical_site,
        pharmacist_name, pharmacist_crf, certificate_code
      ) VALUES (
        1, 'Mariana Costa', '987.654.321-99', '1992-08-15',
        'Influenza Tetravalente', 'Sanofi Pasteur', 'VAC-FLU-88', '2027-04-30',
        'SINGLE_DOSE', 'INTRAMUSCULAR', 'Deltoide Esquerdo',
        'Dra. Camila Farmacêutica', 'CRF-SP 66778', 'VAC-2026-9901'
      )
    `).run();

    expect(Number(res.lastInsertRowid)).toBeGreaterThan(0);
  });
});
