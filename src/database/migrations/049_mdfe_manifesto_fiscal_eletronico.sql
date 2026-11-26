-- Migration 049: Manifesto Eletrônico de Documentos Fiscais (MDF-e Modelo 58)
-- Regulamentado pelo Ajuste SINIEF 21/2010 para transporte de cargas e transferências inter-lojas

CREATE TABLE IF NOT EXISTS mdfe_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  mdfe_number INTEGER NOT NULL,
  series INTEGER NOT NULL DEFAULT 1,
  access_key TEXT NOT NULL UNIQUE,
  emission_type TEXT NOT NULL DEFAULT 'NORMAL' CHECK (emission_type IN ('NORMAL', 'CONTINGENCY')),
  uf_start TEXT NOT NULL,
  uf_end TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  driver_cpf TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL,
  vehicle_rntrc TEXT,
  insurance_company_name TEXT,
  insurance_policy_number TEXT,
  total_nfe_count INTEGER NOT NULL DEFAULT 0,
  total_cargo_value_brl REAL NOT NULL DEFAULT 0.0,
  total_weight_kg REAL NOT NULL DEFAULT 0.0,
  sefaz_status_code TEXT NOT NULL DEFAULT '100',
  sefaz_protocol TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'AUTHORIZED', 'CLOSED', 'CANCELLED')),
  xml_content TEXT,
  damdfe_content TEXT,
  closure_reason TEXT,
  cancellation_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  closed_at TEXT,
  cancelled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_mdfe_store ON mdfe_documents(store_id);
CREATE INDEX IF NOT EXISTS idx_mdfe_access_key ON mdfe_documents(access_key);
CREATE INDEX IF NOT EXISTS idx_mdfe_status ON mdfe_documents(status);
CREATE INDEX IF NOT EXISTS idx_mdfe_number ON mdfe_documents(store_id, series, mdfe_number);

CREATE TABLE IF NOT EXISTS mdfe_nfe_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mdfe_id INTEGER NOT NULL REFERENCES mdfe_documents(id) ON DELETE CASCADE,
  nfe_access_key TEXT NOT NULL,
  nfe_number INTEGER,
  transfer_id INTEGER REFERENCES transfers(id),
  destination_store_id INTEGER REFERENCES stores(id),
  cargo_value_brl REAL NOT NULL DEFAULT 0.0,
  weight_kg REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_mdfe_items_mdfe ON mdfe_nfe_items(mdfe_id);
CREATE INDEX IF NOT EXISTS idx_mdfe_items_nfe ON mdfe_nfe_items(nfe_access_key);
