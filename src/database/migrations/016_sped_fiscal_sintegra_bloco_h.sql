-- Migration 016: SPED Fiscal EFD ICMS/IPI, Sintegra & Bloco H Farmacêutico

CREATE TABLE IF NOT EXISTS accounting_parameters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  accountant_name TEXT NOT NULL,
  accountant_cpf TEXT NOT NULL,
  accountant_crc TEXT NOT NULL,
  accountant_cnpj TEXT,
  accountant_email TEXT,
  accountant_phone TEXT,
  accountant_cep TEXT,
  accountant_address TEXT,
  accountant_city_code INTEGER,
  sped_profile TEXT NOT NULL DEFAULT 'A',
  sped_version TEXT NOT NULL DEFAULT '018',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id)
);

CREATE TABLE IF NOT EXISTS sped_generations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  generation_type TEXT NOT NULL, -- 'SPED_EFD' ou 'SINTEGRA'
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  purpose INTEGER NOT NULL DEFAULT 0, -- 0 = Original, 1 = Retificador
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL,
  total_lines INTEGER NOT NULL DEFAULT 0,
  total_documents INTEGER NOT NULL DEFAULT 0,
  total_icms_debit REAL NOT NULL DEFAULT 0,
  total_icms_credit REAL NOT NULL DEFAULT 0,
  total_icms_st REAL NOT NULL DEFAULT 0,
  inventory_date TEXT,
  total_inventory_value REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'GENERATED', -- 'GENERATED', 'VALIDATED', 'TRANSMITTED'
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sped_audit_divergences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generation_id INTEGER REFERENCES sped_generations(id),
  severity TEXT NOT NULL, -- 'ERROR', 'WARNING', 'INFO'
  entity_type TEXT NOT NULL, -- 'PRODUCT', 'INVOICE', 'INVENTORY', 'ACCOUNTING'
  entity_id TEXT,
  field_name TEXT,
  description TEXT NOT NULL,
  recommendation TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sped_generations_period ON sped_generations(store_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_sped_audit_generation ON sped_audit_divergences(generation_id);
