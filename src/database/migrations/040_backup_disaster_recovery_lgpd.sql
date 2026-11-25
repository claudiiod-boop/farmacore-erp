-- Migration 040: Backup em Nuvem Automatizado, Criptografia LGPD & Disaster Recovery

-- Histórico de Backups e Snapshots
CREATE TABLE IF NOT EXISTS backup_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    sha256_hash TEXT NOT NULL,
    backup_type TEXT NOT NULL CHECK(backup_type IN ('FULL', 'INCREMENTAL', 'LGPD_EXPORT')),
    storage_destination TEXT NOT NULL DEFAULT 'LOCAL' CHECK(storage_destination IN ('LOCAL', 'AWS_S3', 'GOOGLE_DRIVE', 'AZURE_BLOB')),
    is_encrypted INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK(status IN ('SUCCESS', 'FAILED', 'VERIFIED')),
    duration_ms INTEGER DEFAULT 0,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Configurações de Rotina de Backup e Recuperação de Desastres
CREATE TABLE IF NOT EXISTS backup_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    auto_backup_enabled INTEGER DEFAULT 1,
    cron_expression TEXT DEFAULT '0 2 * * *',
    retention_days INTEGER DEFAULT 30,
    destination_type TEXT DEFAULT 'LOCAL',
    encryption_enabled INTEGER DEFAULT 1,
    notify_email TEXT,
    last_run_at DATETIME,
    next_run_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Auditoria e Direitos do Titular LGPD
CREATE TABLE IF NOT EXISTS lgpd_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operator_name TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('EXPORT_CLIENT_DATA', 'ANONYMIZE_CLIENT', 'RESTORE_BACKUP', 'VERIFY_INTEGRITY')),
    target_document TEXT,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inserir configuração padrão inicial caso não exista
INSERT OR IGNORE INTO backup_configs (id, auto_backup_enabled, cron_expression, retention_days, destination_type, encryption_enabled)
VALUES (1, 1, '0 2 * * *', 30, 'LOCAL', 1);

CREATE INDEX IF NOT EXISTS idx_backup_logs_created ON backup_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_lgpd_audit_document ON lgpd_audit_logs(target_document);
