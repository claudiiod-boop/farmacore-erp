-- Migration 048: Auditoria de Repasses do Farmácia Popular (MS / DataSUS), Prevenção de Glosas & Arquivo Digital de Comprovantes (5 Anos)
-- Regulamentado pela Portaria de Consolidação GM/MS nº 5/2017 e diretrizes do DENASUS

CREATE TABLE IF NOT EXISTS fp_settlement_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  batch_reference TEXT NOT NULL,
  competence_month TEXT NOT NULL,
  credit_date TEXT NOT NULL,
  total_authorized_amount REAL NOT NULL DEFAULT 0.0,
  total_credited_amount REAL NOT NULL DEFAULT 0.0,
  total_loss_amount REAL NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'IMPORTED' CHECK (status IN ('IMPORTED', 'RECONCILED', 'DISCREPANT', 'CONTESTED')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_fp_settlement_batches_store ON fp_settlement_batches(store_id);
CREATE INDEX IF NOT EXISTS idx_fp_settlement_batches_competence ON fp_settlement_batches(competence_month);

CREATE TABLE IF NOT EXISTS fp_audit_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_batch_id INTEGER REFERENCES fp_settlement_batches(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  authorization_code TEXT NOT NULL UNIQUE,
  sale_id INTEGER REFERENCES sales(id),
  patient_cpf TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  prescriber_crm TEXT NOT NULL,
  prescriber_uf TEXT NOT NULL,
  authorized_ms_amount REAL NOT NULL DEFAULT 0.0,
  patient_copay_amount REAL NOT NULL DEFAULT 0.0,
  credited_fns_amount REAL NOT NULL DEFAULT 0.0,
  gloss_amount REAL NOT NULL DEFAULT 0.0,
  gloss_reason TEXT,
  contest_protocol TEXT,
  contest_justification TEXT,
  contest_date TEXT,
  status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('APPROVED', 'PARTIALLY_GLOSSED', 'TOTALLY_GLOSSED', 'CONTESTED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_fp_audit_items_batch ON fp_audit_items(settlement_batch_id);
CREATE INDEX IF NOT EXISTS idx_fp_audit_items_auth ON fp_audit_items(authorization_code);
CREATE INDEX IF NOT EXISTS idx_fp_audit_items_status ON fp_audit_items(status);

CREATE TABLE IF NOT EXISTS fp_digital_receipt_dossiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  authorization_code TEXT NOT NULL UNIQUE,
  sale_id INTEGER REFERENCES sales(id),
  patient_cpf TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  dispensation_date TEXT NOT NULL,
  retention_deadline TEXT NOT NULL, -- dispensation_date + 5 anos
  signed_coupon_file_path TEXT,
  prescription_file_path TEXT,
  id_document_file_path TEXT,
  legal_representation_file_path TEXT,
  sha256_integrity_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_DOCS' CHECK (status IN ('PENDING_DOCS', 'ARCHIVED', 'EXPIRING_RETENTION', 'PURGED')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_fp_dossiers_store ON fp_digital_receipt_dossiers(store_id);
CREATE INDEX IF NOT EXISTS idx_fp_dossiers_auth ON fp_digital_receipt_dossiers(authorization_code);
CREATE INDEX IF NOT EXISTS idx_fp_dossiers_cpf ON fp_digital_receipt_dossiers(patient_cpf);
CREATE INDEX IF NOT EXISTS idx_fp_dossiers_status ON fp_digital_receipt_dossiers(status);
CREATE INDEX IF NOT EXISTS idx_fp_dossiers_deadline ON fp_digital_receipt_dossiers(retention_deadline);
