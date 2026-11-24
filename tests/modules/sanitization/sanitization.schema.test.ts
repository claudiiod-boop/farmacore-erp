import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Sanitization & Regulatory SOPs Schema (Migration 036)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required sanitization and SOPs tables cleanly', () => {
    const tables = [
      'sanitization_logs',
      'pest_control_certificates',
      'water_tank_cleaning_logs',
      'standard_operating_procedures',
    ];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }
  });

  it('should insert sanitization log and verify with pharmacist', () => {
    const res = db.prepare(`
      INSERT INTO sanitization_logs (
        store_id, sector_name, cleaning_type, scheduled_date,
        execution_timestamp, chemical_product, performed_by, status
      ) VALUES (1, 'SALA_INJETAIS', 'TERMINAL', '2026-11-24', '2026-11-24T08:00:00Z', 'Álcool 70%', 'Maria Auxiliar', 'COMPLETED')
    `).run();

    const logId = Number(res.lastInsertRowid);
    expect(logId).toBeGreaterThan(0);

    // Farmacêutico RT assina a verificação
    db.prepare(`
      UPDATE sanitization_logs
      SET verified_by_pharmacist = 'CRF-SP 45678', verified_at = '2026-11-24T09:00:00Z'
      WHERE id = ?
    `).run(logId);

    const log = db.prepare('SELECT * FROM sanitization_logs WHERE id = ?').get(logId) as any;
    expect(log.verified_by_pharmacist).toBe('CRF-SP 45678');
    expect(log.cleaning_type).toBe('TERMINAL');
  });

  it('should insert pest control certificate and validate expiration constraint', () => {
    const res = db.prepare(`
      INSERT INTO pest_control_certificates (
        store_id, service_provider_name, service_provider_cnpj, sanitary_license_number,
        certificate_number, application_date, expiration_date, target_pests,
        chemical_agents_used, technical_responsible_pest, pharmacist_approval_crf, status
      ) VALUES (
        1, 'Dedetizadora BioClean', '12.345.678/0001-99', 'CEVS-12345/2026',
        'CERT-2026-88', '2026-11-24', '2027-05-23', 'Baratas e Roedores',
        'Deltametrina 2.5%, Bromadiolona', 'Biólogo CRBio 9988', 'CRF-SP 45678', 'VALID'
      )
    `).run();

    expect(Number(res.lastInsertRowid)).toBeGreaterThan(0);

    const cert = db.prepare('SELECT * FROM pest_control_certificates WHERE certificate_number = ?').get('CERT-2026-88') as any;
    expect(cert.status).toBe('VALID');
    expect(cert.target_pests).toContain('Baratas');
  });

  it('should insert water tank cleaning log and SOP', () => {
    const wtRes = db.prepare(`
      INSERT INTO water_tank_cleaning_logs (
        store_id, service_provider, cleaning_date, expiration_date,
        potability_report_number, potability_status, responsible_cleaner, pharmacist_crf, status
      ) VALUES (
        1, 'AquaPura Saneamento', '2026-11-24', '2027-05-24',
        'LAUDO-AGUA-2026-01', 'POTABLE_COMPLIANT', 'João Técnico', 'CRF-SP 45678', 'VALID'
      )
    `).run();
    expect(Number(wtRes.lastInsertRowid)).toBeGreaterThan(0);

    const sopRes = db.prepare(`
      INSERT INTO standard_operating_procedures (
        store_id, sop_code, title, category, version,
        effective_date, next_review_date, author_name, reviewer_pharmacist_crf, content_summary, status
      ) VALUES (
        1, 'POP-AMB-001', 'Higienização e Desinfecção das Instalações', 'HIGIENE_AMBIENTAL', '1.0',
        '2026-11-24', '2027-11-24', 'Farm. Lívia', 'CRF-SP 45678', 'Instruções para limpeza de bancadas e piso', 'ACTIVE'
      )
    `).run();
    expect(Number(sopRes.lastInsertRowid)).toBeGreaterThan(0);
  });
});
