-- Migration 043: Auditoria Sanitária Automatizada & Dossiê de Autoinspeção (ANVISA / VISA)

CREATE TABLE IF NOT EXISTS sanitary_audits (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  audit_date TEXT NOT NULL,
  responsible_pharmacist_crf TEXT NOT NULL,
  responsible_pharmacist_name TEXT NOT NULL,
  overall_score REAL NOT NULL,
  compliance_status TEXT NOT NULL CHECK (compliance_status IN ('EXCELLENT', 'WARNING', 'CRITICAL_RISK')),
  cold_chain_score REAL NOT NULL,
  sngpc_score REAL NOT NULL,
  pops_certificates_score REAL NOT NULL,
  pgrss_score REAL NOT NULL,
  injectables_score REAL NOT NULL,
  pharmacovigilance_score REAL NOT NULL,
  dossier_summary_json TEXT NOT NULL,
  action_plan_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sanitary_audit_items (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL REFERENCES sanitary_audits(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('COLD_CHAIN', 'SNGPC', 'POPS_CERTIFICATES', 'PGRSS', 'INJECTABLES', 'PHARMACOVIGILANCE')),
  item_description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('COMPLIANT', 'NON_COMPLIANT', 'WARNING_EXPIRING')),
  evidence_text TEXT,
  corrective_action TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sanitary_audits_store ON sanitary_audits(store_id);
CREATE INDEX IF NOT EXISTS idx_sanitary_audits_date ON sanitary_audits(audit_date);
CREATE INDEX IF NOT EXISTS idx_sanitary_audit_items_audit ON sanitary_audit_items(audit_id);
CREATE INDEX IF NOT EXISTS idx_sanitary_audit_items_cat ON sanitary_audit_items(category);
