# Especificação Técnica — Fase 41: Backup em Nuvem Automatizado, Criptografia LGPD & Disaster Recovery

## 1. Contexto e Objetivos
A operação de uma farmácia envolve dados críticos de saúde, fiscais e sanitários (Portaria 344/98, RDC 44/2009 e Lei 13.709/2018 - LGPD).
Esta fase implementa:
1. **Disaster Recovery & Snapshots Seguros:**
   - Geração de snapshots atômicos de banco de dados SQLite com verificação de integridade hash SHA-256.
   - Criptografia simétrica em repouso AES-256-GCM.
   - Rotina de retenção automática (ex: manter últimos 30 dias).
2. **Conformidade LGPD (Lei Geral de Proteção de Dados):**
   - Atendimento aos Direitos do Titular (Art. 18 LGPD): exportação de dossiê completo de dados pessoais e de saúde vinculados ao CPF.
   - Anonimização irreversível a pedido do paciente (mantendo consistência fiscal e contábil conforme permitido pela legislação).
   - Log de auditoria de operações de segurança e privacidade.

---

## 2. Modelagem do Banco de Dados (Migration 040)
- `backup_logs`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `filename`: TEXT NOT NULL
  - `file_path`: TEXT NOT NULL
  - `file_size_bytes`: INTEGER NOT NULL
  - `sha256_hash`: TEXT NOT NULL
  - `backup_type`: TEXT NOT NULL CHECK(backup_type IN ('FULL', 'INCREMENTAL', 'LGPD_EXPORT'))
  - `storage_destination`: TEXT NOT NULL DEFAULT 'LOCAL' CHECK(storage_destination IN ('LOCAL', 'AWS_S3', 'GOOGLE_DRIVE', 'AZURE_BLOB'))
  - `is_encrypted`: INTEGER DEFAULT 1
  - `status`: TEXT NOT NULL CHECK(status IN ('SUCCESS', 'FAILED', 'VERIFIED'))
  - `duration_ms`: INTEGER
  - `error_message`: TEXT
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

- `backup_configs`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `auto_backup_enabled`: INTEGER DEFAULT 1
  - `cron_expression`: TEXT DEFAULT '0 2 * * *' (diariamente às 02h)
  - `retention_days`: INTEGER DEFAULT 30
  - `destination_type`: TEXT DEFAULT 'LOCAL'
  - `encryption_enabled`: INTEGER DEFAULT 1
  - `notify_email`: TEXT
  - `last_run_at`: DATETIME
  - `next_run_at`: DATETIME
  - `updated_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

- `lgpd_audit_logs`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `operator_name`: TEXT NOT NULL
  - `action`: TEXT NOT NULL CHECK(action IN ('EXPORT_CLIENT_DATA', 'ANONYMIZE_CLIENT', 'RESTORE_BACKUP', 'VERIFY_INTEGRITY'))
  - `target_document`: TEXT
  - `reason`: TEXT
  - `status`: TEXT NOT NULL DEFAULT 'COMPLETED'
  - `ip_address`: TEXT
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
