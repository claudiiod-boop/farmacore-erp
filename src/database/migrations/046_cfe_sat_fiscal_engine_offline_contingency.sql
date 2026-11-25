-- Migration 046: Emissor e Validador de Cupom Fiscal SAT (CF-e-SAT SP / MF-e CE) com Contingência Off-line Automática

CREATE TABLE IF NOT EXISTS sat_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  pos_station_id TEXT NOT NULL,
  serial_number TEXT UNIQUE NOT NULL,
  model TEXT NOT NULL DEFAULT 'BEMATECH_RB2000',
  sign_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'BLOCKED', 'MAINTENANCE', 'UNLINKED'
  last_status_check TEXT,
  firmware_version TEXT,
  memory_percent_used REAL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cfe_sat_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  store_id INTEGER NOT NULL REFERENCES stores(id),
  sat_device_id INTEGER NOT NULL REFERENCES sat_devices(id),
  access_key TEXT UNIQUE NOT NULL,
  cfe_number INTEGER NOT NULL,
  session_random_number INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  discount_amount REAL NOT NULL DEFAULT 0.0,
  net_amount REAL NOT NULL,
  xml_sent TEXT NOT NULL,
  xml_signed TEXT NOT NULL,
  qr_code_payload TEXT NOT NULL,
  sefaz_status_code TEXT NOT NULL DEFAULT '06000',
  sefaz_status_message TEXT NOT NULL DEFAULT 'Emitido com sucesso',
  status TEXT NOT NULL DEFAULT 'AUTHORIZED', -- 'AUTHORIZED', 'CANCELLED', 'SYNC_PENDING'
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TEXT,
  cancel_xml TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cfe_sat_contingency_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cfe_id INTEGER NOT NULL REFERENCES cfe_sat_documents(id) ON DELETE CASCADE,
  sat_device_id INTEGER NOT NULL REFERENCES sat_devices(id),
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'TRANSMITTED', 'ERROR'
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_attempt_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sat_devices_store ON sat_devices(store_id, pos_station_id);
CREATE INDEX IF NOT EXISTS idx_cfe_sat_sale ON cfe_sat_documents(sale_id);
CREATE INDEX IF NOT EXISTS idx_cfe_sat_key ON cfe_sat_documents(access_key);
CREATE INDEX IF NOT EXISTS idx_cfe_contingency_status ON cfe_sat_contingency_queue(status);
