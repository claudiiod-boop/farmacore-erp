-- Migration 047: Balança de Precisão & Checkout com Código de Barras Pesável (Portaria INMETRO 236/1994 e RDC 67/2007)

CREATE TABLE IF NOT EXISTS scale_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  name TEXT NOT NULL,
  serial_port TEXT NOT NULL,
  baud_rate INTEGER NOT NULL DEFAULT 9600,
  protocol TEXT NOT NULL DEFAULT 'TOLEDO_PR4', -- 'TOLEDO_PR4', 'FILIZOLA', 'URANO', 'BALMAK', 'GENERICA_CONTINUA'
  inmetro_seal_number TEXT NOT NULL,
  capacity_kg REAL NOT NULL DEFAULT 15.0,
  precision_grams REAL NOT NULL DEFAULT 5.0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weighted_barcode_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  prefix TEXT NOT NULL DEFAULT '2',
  product_code_length INTEGER NOT NULL DEFAULT 5, -- 4 ou 5 dígitos (padrão GS1 Brasil: 5 dígitos)
  payload_type TEXT NOT NULL DEFAULT 'TOTAL_VALUE', -- 'TOTAL_VALUE' (centavos) ou 'NET_WEIGHT' (gramas)
  decimal_places INTEGER NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scale_weighing_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scale_device_id INTEGER REFERENCES scale_devices(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  batch_id INTEGER REFERENCES batches(id),
  gross_weight_grams REAL NOT NULL,
  tare_grams REAL NOT NULL DEFAULT 0.0,
  net_weight_grams REAL NOT NULL,
  price_per_kg REAL NOT NULL,
  total_price REAL NOT NULL,
  generated_barcode TEXT NOT NULL,
  operator_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scale_devices_store ON scale_devices(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_weighted_configs_store ON weighted_barcode_configs(store_id);
CREATE INDEX IF NOT EXISTS idx_scale_logs_product ON scale_weighing_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_scale_logs_created ON scale_weighing_logs(created_at);
