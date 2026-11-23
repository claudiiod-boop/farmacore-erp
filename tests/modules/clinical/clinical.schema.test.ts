import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Schema 017 - Consultório Farmacêutico & Serviços Clínicos Avançados (RDC 777/2023)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all tables of migration 017 cleanly', () => {
    const tables = db
      .prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('clinical_pharmacists', 'clinical_services_catalog', 'clinical_attendances', 'clinical_procedures', 'clinical_rapid_tests', 'pharmacovigilance_reports')"
      )
      .all();

    const tableNames = tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([
      'clinical_attendances',
      'clinical_pharmacists',
      'clinical_procedures',
      'clinical_rapid_tests',
      'clinical_services_catalog',
      'pharmacovigilance_reports',
    ]);
  });

  it('should enforce unique constraint on clinical_pharmacists (crf_number, crf_uf)', () => {
    const insertPharm = db.prepare(`
      INSERT INTO clinical_pharmacists (
        store_id, name, cpf, crf_number, crf_uf
      ) VALUES (?, ?, ?, ?, ?)
    `);

    insertPharm.run(1, 'Dra. Maria Farmacêutica', '12345678901', '54321', 'SP');

    expect(() => {
      insertPharm.run(1, 'Dra. Maria Clone', '99988877766', '54321', 'SP');
    }).toThrow();
  });

  it('should insert attendance, cascade procedures, rapid tests and pharmacovigilance', () => {
    // 1. Cadastrar farmacêutico
    const pharmResult = db.prepare(`
      INSERT INTO clinical_pharmacists (store_id, name, cpf, crf_number, crf_uf)
      VALUES (1, 'Dr. Lucas Farmacêutico', '12345678901', '98765', 'SP')
    `).run();
    const pharmId = Number(pharmResult.lastInsertRowid);

    // 2. Criar atendimento
    const attResult = db.prepare(`
      INSERT INTO clinical_attendances (
        attendance_code, store_id, pharmacist_id, patient_name, patient_cpf,
        blood_pressure_systolic, blood_pressure_diastolic, temperature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('AT-2026-0001', 1, pharmId, 'Carlos Paciente', '11122233344', 120, 80, 36.5);
    const attId = Number(attResult.lastInsertRowid);

    // 3. Adicionar Teste Rápido TLR (Glicemia)
    db.prepare(`
      INSERT INTO clinical_rapid_tests (
        attendance_id, test_type, reagent_name, reagent_batch,
        reagent_expiration, reagent_ms_registration, result_value, result_interpretation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(attId, 'GLUCOSE', 'Accu-Chek Active', 'GLU-99', '2027-12-31', '10287410055', '98 mg/dL', 'NORMAL');

    // 4. Adicionar Procedimento (Aplicação de Injetável)
    db.prepare(`
      INSERT INTO clinical_procedures (
        attendance_id, procedure_type, medication_name, medication_batch,
        application_site, prescriber_name, prescriber_crm
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(attId, 'INJECTABLE', 'Dipirona 500mg/ml', 'LOTE-DIP-01', 'GLUTEUS_D', 'Dr. Médico', 'CRM-SP 12345');

    // 5. Adicionar Notificação Notivisa
    db.prepare(`
      INSERT INTO pharmacovigilance_reports (
        store_id, pharmacist_id, attendance_id, patient_name,
        suspected_medication, adverse_reaction_description, reaction_date, severity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(1, pharmId, attId, 'Carlos Paciente', 'Dipirona 500mg/ml', 'Prurido cutâneo leve após aplicação', '2026-11-23', 'LEVE');

    // Validar consultas
    const tests = db.prepare('SELECT * FROM clinical_rapid_tests WHERE attendance_id = ?').all(attId);
    expect(tests).toHaveLength(1);

    const procs = db.prepare('SELECT * FROM clinical_procedures WHERE attendance_id = ?').all(attId);
    expect(procs).toHaveLength(1);

    const notif = db.prepare('SELECT * FROM pharmacovigilance_reports WHERE attendance_id = ?').all(attId);
    expect(notif).toHaveLength(1);
  });
});
