import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Backup Disaster Recovery & LGPD Schema (Migration 040)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create backup_logs, backup_configs and lgpd_audit_logs tables cleanly', () => {
    const tables = ['backup_logs', 'backup_configs', 'lgpd_audit_logs'];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }
  });

  it('should have initial default backup_configs row', () => {
    const config = db.prepare('SELECT * FROM backup_configs WHERE id = 1').get() as any;
    expect(config).toBeDefined();
    expect(config.retention_days).toBe(30);
    expect(config.auto_backup_enabled).toBe(1);
    expect(config.encryption_enabled).toBe(1);
  });

  it('should insert a backup log and LGPD audit log with valid constraints', () => {
    const logRes = db.prepare(`
      INSERT INTO backup_logs (
        filename, file_path, file_size_bytes, sha256_hash, backup_type, storage_destination, is_encrypted, status, duration_ms
      ) VALUES (
        'backup-20261125.sqlite.enc', 'C:/backups/backup-20261125.sqlite.enc',
        1048576, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'FULL', 'LOCAL', 1, 'SUCCESS', 250
      )
    `).run();

    expect(Number(logRes.lastInsertRowid)).toBeGreaterThan(0);

    const auditRes = db.prepare(`
      INSERT INTO lgpd_audit_logs (
        operator_name, action, target_document, reason, status
      ) VALUES (
        'Farmacêutico RT', 'EXPORT_CLIENT_DATA', '123.456.789-00', 'Solicitação do titular Art. 18 LGPD', 'COMPLETED'
      )
    `).run();

    expect(Number(auditRes.lastInsertRowid)).toBeGreaterThan(0);
  });
});
