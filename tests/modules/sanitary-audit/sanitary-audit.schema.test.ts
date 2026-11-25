import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Migration 043: Sanitary Audit Auto-inspection Dossier Schema', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create sanitary_audits and sanitary_audit_items tables with proper schema', () => {
    const auditsInfo = db.prepare(`PRAGMA table_info(sanitary_audits)`).all() as any[];
    const auditCols = auditsInfo.map((c) => c.name);

    expect(auditCols).toContain('id');
    expect(auditCols).toContain('store_id');
    expect(auditCols).toContain('audit_date');
    expect(auditCols).toContain('responsible_pharmacist_crf');
    expect(auditCols).toContain('overall_score');
    expect(auditCols).toContain('compliance_status');
    expect(auditCols).toContain('cold_chain_score');
    expect(auditCols).toContain('sngpc_score');
    expect(auditCols).toContain('pops_certificates_score');
    expect(auditCols).toContain('pgrss_score');
    expect(auditCols).toContain('injectables_score');
    expect(auditCols).toContain('pharmacovigilance_score');

    const itemsInfo = db.prepare(`PRAGMA table_info(sanitary_audit_items)`).all() as any[];
    const itemCols = itemsInfo.map((c) => c.name);

    expect(itemCols).toContain('id');
    expect(itemCols).toContain('audit_id');
    expect(itemCols).toContain('category');
    expect(itemCols).toContain('item_description');
    expect(itemCols).toContain('status');
    expect(itemCols).toContain('evidence_text');
  });

  it('should enforce compliance_status check constraint on sanitary_audits', () => {
    const insert = db.prepare(`
      INSERT INTO sanitary_audits (
        id, store_id, audit_date, responsible_pharmacist_crf, responsible_pharmacist_name,
        overall_score, compliance_status, cold_chain_score, sngpc_score, pops_certificates_score,
        pgrss_score, injectables_score, pharmacovigilance_score, dossier_summary_json,
        created_at, updated_at
      ) VALUES (
        'audit-1', '1', '2026-11-25', 'CRF-SP 12345', 'Dra. Ana Farmacêutica',
        95.0, 'INVALID_STATUS', 20, 25, 15, 15, 15, 10, '{}',
        '2026-11-25T10:00:00Z', '2026-11-25T10:00:00Z'
      )
    `);

    expect(() => insert.run()).toThrow();
  });
});
