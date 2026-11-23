-- Migration 018: Central de Cotação B2B, Reposição Inteligente & EDI Farma (Distribuidoras)
-- FarmaCore ERP - Padrão InovaFarma / Linx Farma Big

CREATE TABLE IF NOT EXISTS b2b_suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  trade_name TEXT,
  cnpj TEXT NOT NULL,
  edi_code TEXT,
  edi_layout TEXT DEFAULT 'STANDARD_EDI',
  min_order_value REAL DEFAULT 0.0,
  lead_time_days INTEGER DEFAULT 1,
  payment_terms TEXT,
  email TEXT,
  phone TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS b2b_replenishment_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  min_stock INTEGER DEFAULT 5,
  safety_stock INTEGER DEFAULT 3,
  lead_time_days INTEGER DEFAULT 2,
  coverage_days INTEGER DEFAULT 15,
  target_stock INTEGER DEFAULT 20,
  abc_class TEXT DEFAULT 'B',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, product_id)
);

CREATE TABLE IF NOT EXISTS b2b_quotation_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_code TEXT NOT NULL UNIQUE,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  title TEXT NOT NULL,
  status TEXT DEFAULT 'DRAFT',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS b2b_quotation_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES b2b_quotation_campaigns(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  current_stock INTEGER DEFAULT 0,
  suggested_quantity INTEGER NOT NULL,
  requested_quantity INTEGER NOT NULL,
  target_price REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS b2b_quotation_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES b2b_quotation_campaigns(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES b2b_suppliers(id),
  proposal_code TEXT NOT NULL,
  total_amount REAL DEFAULT 0.0,
  discount_amount REAL DEFAULT 0.0,
  net_amount REAL DEFAULT 0.0,
  payment_terms TEXT,
  delivery_days INTEGER DEFAULT 1,
  status TEXT DEFAULT 'SUBMITTED',
  edi_file_ref TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS b2b_quotation_proposal_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL REFERENCES b2b_quotation_proposals(id) ON DELETE CASCADE,
  quotation_item_id INTEGER NOT NULL REFERENCES b2b_quotation_items(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  offered_price REAL NOT NULL,
  discount_percent REAL DEFAULT 0.0,
  net_unit_price REAL NOT NULL,
  available_quantity INTEGER NOT NULL,
  st_icms_included INTEGER DEFAULT 1,
  is_winner INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS b2b_edi_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES b2b_quotation_campaigns(id),
  supplier_id INTEGER REFERENCES b2b_suppliers(id),
  direction TEXT NOT NULL,
  file_name TEXT NOT NULL,
  records_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'SUCCESS',
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_b2b_replenishment_store_prod ON b2b_replenishment_rules(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_b2b_quotation_items_campaign ON b2b_quotation_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_b2b_proposals_campaign ON b2b_quotation_proposals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_b2b_proposal_items_proposal ON b2b_quotation_proposal_items(proposal_id);
