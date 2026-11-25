import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Migration 048 - Farmácia Popular Audit & Digital Dossier Schema', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('deve criar a tabela fp_settlement_batches e permitir inserção de lotes FNS', () => {
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj) VALUES (1, 'FarmaCore Central', '12.345.678/0001-90')
    `).run();

    const insert = db.prepare(`
      INSERT INTO fp_settlement_batches (
        store_id, batch_reference, competence_month, credit_date, total_authorized_amount, total_credited_amount, total_loss_amount, status
      ) VALUES (
        1, 'FNS-2026-10-001', '2026-10', '2026-11-15', 5000.0, 4850.0, 150.0, 'DISCREPANT'
      )
    `).run();

    expect(insert.changes).toBe(1);
    const row = db.prepare('SELECT * FROM fp_settlement_batches WHERE id = ?').get(insert.lastInsertRowid) as any;
    expect(row.batch_reference).toBe('FNS-2026-10-001');
    expect(row.status).toBe('DISCREPANT');
  });

  it('deve criar as tabelas fp_audit_items e fp_digital_receipt_dossiers com integridade', () => {
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj) VALUES (1, 'FarmaCore Central', '12.345.678/0001-90')
    `).run();

    const insertItem = db.prepare(`
      INSERT INTO fp_audit_items (
        store_id, authorization_code, patient_cpf, patient_name, prescriber_crm, prescriber_uf,
        authorized_ms_amount, credited_fns_amount, gloss_amount, status
      ) VALUES (
        1, 'AUTH-FP-2026-9901', '123.456.789-00', 'Maria Silva', '54321', 'SP', 85.0, 0.0, 85.0, 'TOTALLY_GLOSSED'
      )
    `).run();

    expect(insertItem.changes).toBe(1);

    const insertDossier = db.prepare(`
      INSERT INTO fp_digital_receipt_dossiers (
        store_id, authorization_code, patient_cpf, patient_name, dispensation_date, retention_deadline,
        sha256_integrity_hash, status
      ) VALUES (
        1, 'AUTH-FP-2026-9901', '123.456.789-00', 'Maria Silva', '2026-11-20', '2031-11-20',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'ARCHIVED'
      )
    `).run();

    expect(insertDossier.changes).toBe(1);
    const dossier = db.prepare('SELECT * FROM fp_digital_receipt_dossiers WHERE id = ?').get(insertDossier.lastInsertRowid) as any;
    expect(dossier.retention_deadline).toBe('2031-11-20');
    expect(dossier.status).toBe('ARCHIVED');
  });
});
