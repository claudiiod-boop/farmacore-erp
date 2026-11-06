-- Migration 003: Fiscal Engine Schema (NFC-e Modelo 65)

-- Fiscal profiles: Store tax profile and SEFAZ credentials
CREATE TABLE IF NOT EXISTS fiscal_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cnpj TEXT NOT NULL,
  ie TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  crt INTEGER NOT NULL DEFAULT 1 CHECK (crt IN (1, 2, 3)),
  c_uf INTEGER NOT NULL DEFAULT 35,
  municipio TEXT NOT NULL DEFAULT 'São Paulo',
  c_mun INTEGER NOT NULL DEFAULT 3550308,
  logradouro TEXT NOT NULL,
  numero TEXT NOT NULL,
  bairro TEXT NOT NULL,
  cep TEXT NOT NULL,
  serie INTEGER NOT NULL DEFAULT 1,
  next_nnf INTEGER NOT NULL DEFAULT 1,
  csc_token TEXT NOT NULL,
  csc_id TEXT NOT NULL DEFAULT '000001',
  environment TEXT NOT NULL DEFAULT 'HOMOLOGACAO' CHECK (environment IN ('HOMOLOGACAO', 'PRODUCAO', 'SIMULADOR')),
  cert_pfx_base64 TEXT,
  cert_password TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Alter products to include pharmaceutical fiscal & tax data
ALTER TABLE products ADD COLUMN ncm TEXT DEFAULT '30049099';
ALTER TABLE products ADD COLUMN cest TEXT DEFAULT '1300100';
ALTER TABLE products ADD COLUMN cfop TEXT DEFAULT '5405';
ALTER TABLE products ADD COLUMN csosn_icms TEXT DEFAULT '500';
ALTER TABLE products ADD COLUMN cst_pis TEXT DEFAULT '04';
ALTER TABLE products ADD COLUMN cst_cofins TEXT DEFAULT '04';
ALTER TABLE products ADD COLUMN origin INTEGER DEFAULT 0;

-- NFC-e invoices: Store emitted/authorized/contingency/cancelled documents
CREATE TABLE IF NOT EXISTS nfce_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL UNIQUE REFERENCES sales(id) ON DELETE RESTRICT,
  ch_nfe TEXT NOT NULL UNIQUE,
  n_nf INTEGER NOT NULL,
  serie INTEGER NOT NULL,
  tp_amb INTEGER NOT NULL, -- 1=Producao, 2=Homologacao
  tp_emis INTEGER NOT NULL, -- 1=Normal, 9=Contingencia Offline
  status TEXT NOT NULL CHECK (status IN ('AUTORIZADA', 'CONTINGENCIA', 'CANCELADA', 'REJEITADA')),
  protocol_number TEXT,
  protocol_date TEXT,
  xml_signed TEXT NOT NULL,
  xml_authorized TEXT,
  qr_code_url TEXT NOT NULL,
  digest_value TEXT,
  c_stat INTEGER,
  x_motivo TEXT,
  cancellation_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance and lookup
CREATE INDEX IF NOT EXISTS idx_nfce_invoices_ch_nfe ON nfce_invoices(ch_nfe);
CREATE INDEX IF NOT EXISTS idx_nfce_invoices_sale_id ON nfce_invoices(sale_id);
