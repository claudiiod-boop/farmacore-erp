-- Migration 045: Balanço Patrimonial & Inventário Rotativo Cego (RDC 44/2009 e Portaria 344/98)

CREATE TABLE IF NOT EXISTS stock_inventories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  type TEXT NOT NULL, -- 'ROTATIVO', 'GERAL_PATRIMONIAL', 'CONTROLADOS_SNGPC'
  status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'COUNTING', 'AUDITING', 'FINALIZED', 'CANCELLED'
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  responsible_user_id INTEGER,
  responsible_pharmacist_crf TEXT,
  total_items_counted INTEGER NOT NULL DEFAULT 0,
  total_divergences_count INTEGER NOT NULL DEFAULT 0,
  total_divergence_value REAL NOT NULL DEFAULT 0.0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_id INTEGER NOT NULL REFERENCES stock_inventories(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  batch_id INTEGER REFERENCES batches(id),
  system_quantity REAL NOT NULL, -- Oculto da visão do conferente durante contagem cega
  counted_quantity REAL NOT NULL DEFAULT 0.0,
  divergence_quantity REAL NOT NULL DEFAULT 0.0,
  unit_cost REAL NOT NULL DEFAULT 0.0,
  divergence_value REAL NOT NULL DEFAULT 0.0,
  is_controlled INTEGER NOT NULL DEFAULT 0, -- 1 se Portaria 344/98
  requires_pharmacist_approval INTEGER NOT NULL DEFAULT 0,
  pharmacist_approved INTEGER NOT NULL DEFAULT 0,
  justification TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_inventory_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_id INTEGER NOT NULL REFERENCES stock_inventories(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES stock_inventory_items(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  batch_id INTEGER REFERENCES batches(id),
  adjustment_type TEXT NOT NULL, -- 'SOBRA' (entrada) ou 'FALTA' (saída/perda)
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL,
  total_cost REAL NOT NULL,
  dre_reason TEXT NOT NULL, -- 'QUEBRA', 'FURTO', 'VALIDADE_EXPIRADA', 'AJUSTE_CONTAGEM'
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_inv_store ON stock_inventories(store_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_inv_items_inv ON stock_inventory_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stock_inv_items_prod ON stock_inventory_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_inv_adj_inv ON stock_inventory_adjustments(inventory_id);
