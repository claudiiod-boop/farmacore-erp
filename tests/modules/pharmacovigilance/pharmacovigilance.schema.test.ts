import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Pharmacovigilance & NOTIVISA Schema (Migration 038)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create adverse_drug_reactions and technical_complaints tables cleanly', () => {
    const tables = ['adverse_drug_reactions', 'technical_complaints'];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }
  });

  it('should insert an adverse drug reaction (RAM) and enforce unique protocol_code', () => {
    const res = db.prepare(`
      INSERT INTO adverse_drug_reactions (
        store_id, protocol_code, patient_initials, patient_age, patient_gender,
        suspected_drug_name, suspected_drug_batch, daily_dose,
        treatment_start_date, reaction_description, reaction_onset_date,
        severity_level, dechallenge_status, rechallenge_status, outcome,
        notifier_pharmacist_name, notifier_pharmacist_crf
      ) VALUES (
        1, 'RAM-2026-0001', 'M.A.S.', 45, 'F',
        'Amoxicilina + Clavulanato 875mg', 'L-AMOX-88', '1 comp a cada 12h',
        '2026-11-20', 'Erupção cutânea com prurido intenso e edema labial', '2026-11-22',
        'MODERATE', 'IMPROVED', 'NOT_REEXPOSED', 'RECOVERED',
        'Dra. Lívia RT', 'CRF-SP 45678'
      )
    `).run();

    expect(Number(res.lastInsertRowid)).toBeGreaterThan(0);

    // Duplicidade de protocolo deve falhar
    expect(() => {
      db.prepare(`
        INSERT INTO adverse_drug_reactions (
          store_id, protocol_code, patient_initials, patient_gender,
          suspected_drug_name, suspected_drug_batch, daily_dose,
          treatment_start_date, reaction_description, reaction_onset_date,
          severity_level, dechallenge_status, rechallenge_status, outcome,
          notifier_pharmacist_name, notifier_pharmacist_crf
        ) VALUES (
          1, 'RAM-2026-0001', 'X.Y.Z.', 'M',
          'Outro', 'L1', '1x',
          '2026-11-20', 'Desc', '2026-11-20',
          'MILD', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN',
          'Nome', 'CRF'
        )
      `).run();
    }).toThrow();
  });

  it('should insert a technical complaint (QT) and validate complaint_type constraint', () => {
    const res = db.prepare(`
      INSERT INTO technical_complaints (
        store_id, protocol_code, product_name, batch_number, manufacturer,
        expiration_date, complaint_type, description, reporter_type,
        notifier_pharmacist_crf
      ) VALUES (
        1, 'QT-2026-0001', 'Dipirona Gotas 500mg/mL', 'L-DIP-99', 'Laboratório FarmaBrasil',
        '2027-12-31', 'FOREIGN_MATTER', 'Presença de precipitado escuro e corpo estranho em suspensão', 'CUSTOMER',
        'CRF-SP 45678'
      )
    `).run();

    expect(Number(res.lastInsertRowid)).toBeGreaterThan(0);

    const row = db.prepare('SELECT * FROM technical_complaints WHERE protocol_code = ?').get('QT-2026-0001') as any;
    expect(row.complaint_type).toBe('FOREIGN_MATTER');
    expect(row.notivisa_submission_status).toBe('DRAFT');
  });
});
