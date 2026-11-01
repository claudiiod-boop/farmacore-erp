-- Migration 001: Initial Schema for FarmaCore ERP & PDV

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ean TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  active_ingredient TEXT NOT NULL,
  ms_registration TEXT NOT NULL,
  stripe TEXT NOT NULL,
  control_type TEXT NOT NULL,
  pmc REAL NOT NULL,
  pf REAL NOT NULL,
  price REAL NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_number TEXT NOT NULL,
  manufacturing_date TEXT NOT NULL,
  expiration_date TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pre_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  customer_name TEXT,
  customer_cpf TEXT,
  total_amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pre_sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pre_sale_id INTEGER NOT NULL REFERENCES pre_sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pre_sale_id INTEGER NOT NULL REFERENCES pre_sales(id) ON DELETE CASCADE,
  doctor_name TEXT NOT NULL,
  doctor_crm TEXT NOT NULL,
  doctor_uf TEXT NOT NULL,
  prescription_type TEXT NOT NULL,
  prescription_date TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  buyer_name TEXT,
  buyer_cpf TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cash_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator_name TEXT NOT NULL,
  initial_cash REAL NOT NULL,
  current_cash REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pre_sale_id INTEGER REFERENCES pre_sales(id),
  cash_session_id INTEGER REFERENCES cash_sessions(id),
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  total_amount REAL NOT NULL,
  discount_amount REAL NOT NULL DEFAULT 0,
  change_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance and constraints
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean);
CREATE INDEX IF NOT EXISTS idx_batches_product_id ON batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiration ON batches(expiration_date);
CREATE INDEX IF NOT EXISTS idx_pre_sales_code ON pre_sales(code);
CREATE INDEX IF NOT EXISTS idx_pre_sale_items_pre_sale_id ON pre_sale_items(pre_sale_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_pre_sale_id ON prescriptions(pre_sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_pre_sale_id ON sales(pre_sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_cash_session_id ON sales(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id);
