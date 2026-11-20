-- Migration 009: Inventory Audit, Cyclic Counting & SNGPC Regulatory Adjustments

-- 1. Table inventory_sessions
CREATE TABLE IF NOT EXISTS inventory_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_code TEXT UNIQUE NOT NULL,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  inventory_type TEXT NOT NULL,       -- 'GERAL', 'ROTATIVO', 'CONTROLADOS_SNGPC'
  category_filter TEXT,              -- 'REFERENCIA', 'GENERICO', 'SIMILAR', 'PERFUMARIA', 'CORRELATOS_OUTROS', etc.
  status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'COUNTED', 'APPLIED', 'CANCELLED'
  opened_by TEXT NOT NULL,
  applied_by TEXT,
  responsible_pharmacist_crf TEXT,
  responsible_pharmacist_uf TEXT,
  notes TEXT,
  total_products_expected INTEGER NOT NULL DEFAULT 0,
  total_products_counted INTEGER NOT NULL DEFAULT 0,
  total_batches_expected INTEGER NOT NULL DEFAULT 0,
  total_batches_counted INTEGER NOT NULL DEFAULT 0,
  accuracy_rate REAL NOT NULL DEFAULT 100.0,
  total_surplus_cost REAL NOT NULL DEFAULT 0.0,
  total_shortage_cost REAL NOT NULL DEFAULT 0.0,
  net_financial_difference REAL NOT NULL DEFAULT 0.0,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table inventory_items
CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id INTEGER REFERENCES batches(id) ON DELETE RESTRICT,
  batch_number TEXT NOT NULL,
  expiration_date TEXT NOT NULL,
  manufacturing_date TEXT NOT NULL,
  expected_quantity INTEGER NOT NULL DEFAULT 0,
  counted_quantity INTEGER NOT NULL DEFAULT 0,
  recount_quantity INTEGER,
  difference_quantity INTEGER NOT NULL DEFAULT 0,
  difference_status TEXT NOT NULL DEFAULT 'EXACT', -- 'EXACT', 'SURPLUS', 'SHORTAGE'
  unit_cost REAL NOT NULL DEFAULT 0.0,
  total_cost_difference REAL NOT NULL DEFAULT 0.0,
  adjustment_reason TEXT, -- 'AVARIA', 'VENCIMENTO', 'FURTO_EXTRAVIO', 'ERRO_OPERACIONAL', 'QUEBRA_ARMAZENAMENTO', 'AJUSTE_INVENTARIO', 'SOBRA_NAO_IDENTIFICADA'
  notes TEXT,
  sngpc_adjusted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_sessions_store_status ON inventory_sessions(store_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_session ON inventory_items(session_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_product_batch ON inventory_items(product_id, batch_number);
