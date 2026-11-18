-- Migration 008: Multi-Store & Inter-Store Transfers

-- 1. Table stores
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  ie TEXT NOT NULL,
  is_headquarters INTEGER NOT NULL DEFAULT 0,
  phone TEXT,
  email TEXT,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  ibge_code TEXT NOT NULL,
  tax_regime TEXT NOT NULL DEFAULT 'SIMPLES_NACIONAL',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Seed initial default headquarters store into stores if not exists
INSERT OR IGNORE INTO stores (id, code, name, company_name, cnpj, ie, is_headquarters, phone, email, street, number, neighborhood, city, state, zip_code, ibge_code, tax_regime, is_active)
VALUES (1, 'LJ01', 'FarmaCore Matriz Centro', 'Drogaria FarmaCore Ltda', '12.345.678/0001-90', '123456789', 1, '11999990001', 'matriz@farmacore.com.br', 'Av. Central', '1000', 'Centro', 'São Paulo', 'SP', '01001-000', '3550308', 'SIMPLES_NACIONAL', 1);

-- 3. Add column store_id to batches, pre_sales, sales, cash_sessions
ALTER TABLE batches ADD COLUMN store_id INTEGER NOT NULL DEFAULT 1 REFERENCES stores(id) ON DELETE RESTRICT;
ALTER TABLE pre_sales ADD COLUMN store_id INTEGER NOT NULL DEFAULT 1 REFERENCES stores(id) ON DELETE RESTRICT;
ALTER TABLE sales ADD COLUMN store_id INTEGER NOT NULL DEFAULT 1 REFERENCES stores(id) ON DELETE RESTRICT;
ALTER TABLE cash_sessions ADD COLUMN store_id INTEGER NOT NULL DEFAULT 1 REFERENCES stores(id) ON DELETE RESTRICT;

-- 4. Table transfers
CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_number TEXT UNIQUE NOT NULL,
  source_store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  target_store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'REQUESTED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'
  requested_by TEXT NOT NULL,
  dispatched_by TEXT,
  received_by TEXT,
  carrier_name TEXT,
  tracking_code TEXT,
  notes TEXT,
  nfe_key TEXT,
  nfe_protocol TEXT,
  cfop TEXT NOT NULL DEFAULT '5152',
  dispatched_at TEXT,
  received_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (source_store_id <> target_store_id)
);

-- 5. Table transfer_items
CREATE TABLE IF NOT EXISTS transfer_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_id INTEGER NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  source_batch_id INTEGER REFERENCES batches(id) ON DELETE RESTRICT,
  batch_number TEXT NOT NULL,
  expiration_date TEXT NOT NULL,
  manufacturing_date TEXT NOT NULL,
  requested_quantity INTEGER NOT NULL,
  shipped_quantity INTEGER NOT NULL DEFAULT 0,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL DEFAULT 0.0,
  total_cost REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_batches_store_product ON batches(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_sales_store_date ON sales(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pre_sales_store_status ON pre_sales(store_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_source_status ON transfers(source_store_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_target_status ON transfers(target_store_id, status);
CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_items(transfer_id);
