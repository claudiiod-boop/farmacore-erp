-- Migration 005: PBM & Farmacia Popular Gateway (Portaria MS nº 184/2011 / Denasus)

-- 1. Provedores PBM
CREATE TABLE IF NOT EXISTS pbm_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT UNIQUE NOT NULL, -- 'FARMACIA_POPULAR', 'VIDALINK', 'EPHARMA', 'FUNCIONAL'
  provider_name TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'MOCK' CHECK (environment IN ('PRODUCAO', 'HOMOLOGACAO', 'MOCK')),
  is_active INTEGER NOT NULL DEFAULT 1,
  credentials_json TEXT, -- usuario, senha, cnpj, cert_pfx_base64, cert_password, endpoint
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Transações de Autorização PBM / Farmácia Popular
CREATE TABLE IF NOT EXISTS pbm_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_uuid TEXT UNIQUE NOT NULL,
  provider_id TEXT NOT NULL REFERENCES pbm_configs(provider_id),
  sale_id INTEGER REFERENCES sales(id) ON DELETE RESTRICT,
  authorization_protocol TEXT NOT NULL,
  receipt_number TEXT,
  status TEXT NOT NULL CHECK (status IN ('AUTHORIZED', 'CONFIRMED', 'CANCELLED', 'REJECTED')),
  patient_cpf TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  patient_birth_date TEXT,
  doctor_crm TEXT NOT NULL,
  doctor_uf TEXT NOT NULL,
  doctor_name TEXT,
  prescription_date TEXT NOT NULL,
  proxy_name TEXT,
  proxy_cpf TEXT,
  fiscal_key_nfce TEXT,
  nfce_number INTEGER,
  total_gross_amount REAL NOT NULL,
  subsidy_amount REAL NOT NULL,
  patient_copay_amount REAL NOT NULL,
  rejection_reason TEXT,
  cancellation_protocol TEXT,
  cancellation_reason TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pbm_trans_protocol ON pbm_transactions(authorization_protocol);
CREATE INDEX IF NOT EXISTS idx_pbm_trans_cpf ON pbm_transactions(patient_cpf);
CREATE INDEX IF NOT EXISTS idx_pbm_trans_sale ON pbm_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_pbm_trans_created ON pbm_transactions(created_at);

-- 3. Itens Autorizados na Transação PBM
CREATE TABLE IF NOT EXISTS pbm_transaction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pbm_transaction_id INTEGER NOT NULL REFERENCES pbm_transactions(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id INTEGER REFERENCES batches(id) ON DELETE RESTRICT,
  ean TEXT NOT NULL,
  ms_registration TEXT NOT NULL,
  product_name TEXT NOT NULL,
  daily_dose REAL NOT NULL DEFAULT 1.0,
  authorized_quantity INTEGER NOT NULL,
  unit_gross_price REAL NOT NULL,
  total_gross_price REAL NOT NULL,
  reference_unit_price REAL NOT NULL DEFAULT 0.0,
  subsidy_unit_price REAL NOT NULL,
  subsidy_total_price REAL NOT NULL,
  patient_unit_price REAL NOT NULL,
  patient_total_price REAL NOT NULL,
  program_type TEXT NOT NULL DEFAULT 'GRATUITO' CHECK (program_type IN ('GRATUITO', 'CO_PAGAMENTO', 'DESCONTO_CONVENIO')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pbm_items_transaction ON pbm_transaction_items(pbm_transaction_id);
CREATE INDEX IF NOT EXISTS idx_pbm_items_product ON pbm_transaction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_pbm_items_batch ON pbm_transaction_items(batch_id);

-- 4. Extensão da tabela de produtos com metadados Farmácia Popular / PBM
ALTER TABLE products ADD COLUMN fp_eligible INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN fp_code TEXT; -- Código do medicamento na tabela oficial do Datasus
ALTER TABLE products ADD COLUMN fp_reference_price REAL DEFAULT 0.0;
ALTER TABLE products ADD COLUMN fp_type TEXT CHECK (fp_type IS NULL OR fp_type IN ('GRATUITO', 'CO_PAGAMENTO'));
