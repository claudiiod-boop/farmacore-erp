-- Migration 019: Tabela Oficial CMED / ANVISA, Trava Sanitária de Preço & Regras de Precificação
-- FarmaCore ERP - Padrão InovaFarma / Linx Farma Big

CREATE TABLE IF NOT EXISTS cmed_table_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_code TEXT NOT NULL UNIQUE,
  release_date TEXT NOT NULL,
  total_records INTEGER DEFAULT 0,
  file_hash TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cmed_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id INTEGER NOT NULL REFERENCES cmed_table_versions(id) ON DELETE CASCADE,
  ean TEXT NOT NULL,
  ms_registration TEXT NOT NULL,
  product_name TEXT NOT NULL,
  presentation TEXT,
  substance_name TEXT NOT NULL,
  laboratory_name TEXT NOT NULL,
  therapeutic_class TEXT,
  product_type TEXT DEFAULT 'NOVO',
  list_type TEXT DEFAULT 'POSITIVA',
  has_st_icms INTEGER DEFAULT 1,
  pf_0 REAL DEFAULT 0.0,
  pf_12 REAL DEFAULT 0.0,
  pf_17 REAL DEFAULT 0.0,
  pf_17_5 REAL DEFAULT 0.0,
  pf_18 REAL DEFAULT 0.0,
  pf_19 REAL DEFAULT 0.0,
  pf_20 REAL DEFAULT 0.0,
  pf_21 REAL DEFAULT 0.0,
  pf_22 REAL DEFAULT 0.0,
  pmc_0 REAL DEFAULT 0.0,
  pmc_12 REAL DEFAULT 0.0,
  pmc_17 REAL DEFAULT 0.0,
  pmc_17_5 REAL DEFAULT 0.0,
  pmc_18 REAL DEFAULT 0.0,
  pmc_19 REAL DEFAULT 0.0,
  pmc_20 REAL DEFAULT 0.0,
  pmc_21 REAL DEFAULT 0.0,
  pmc_22 REAL DEFAULT 0.0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cmed_pricing_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  category_type TEXT NOT NULL,
  discount_percent_pmc REAL DEFAULT 0.0,
  target_markup_pf REAL DEFAULT 0.0,
  min_gross_margin_percent REAL DEFAULT 15.0,
  enforce_pmc_cap INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, category_type)
);

CREATE TABLE IF NOT EXISTS cmed_price_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  old_price REAL NOT NULL,
  new_price REAL NOT NULL,
  current_pmc REAL NOT NULL,
  current_pf REAL NOT NULL,
  icms_rate REAL DEFAULT 18.0,
  reason TEXT,
  auditor_user TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cmed_products_version ON cmed_products(version_id);
CREATE INDEX IF NOT EXISTS idx_cmed_products_ean ON cmed_products(ean);
CREATE INDEX IF NOT EXISTS idx_cmed_products_ms ON cmed_products(ms_registration);
CREATE INDEX IF NOT EXISTS idx_cmed_products_substance ON cmed_products(substance_name);
CREATE INDEX IF NOT EXISTS idx_cmed_pricing_rules_store ON cmed_pricing_rules(store_id);
