-- ============================================================================
-- Migration 023: Fracionamento de Medicamentos em Blíster (RDC 80/2006 ANVISA)
-- FarmaCore ERP - Dispensação Individualizada, Rastreabilidade de Sublotes e Bula
-- ============================================================================

-- 1. Parametrização de Fracionabilidade na Tabela de Produtos
ALTER TABLE products ADD COLUMN is_fractionable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN units_per_package INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN fractional_unit TEXT DEFAULT 'COMPRIMIDO';

-- 2. Tabela de Registros de Fracionamento (Desmembramento de Lote Fechado)
CREATE TABLE IF NOT EXISTS fractionation_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  original_batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  pharmacist_name TEXT NOT NULL,
  pharmacist_crf TEXT NOT NULL,
  pharmacist_crf_uf TEXT NOT NULL,
  original_packages_opened INTEGER NOT NULL CHECK (original_packages_opened > 0),
  units_generated INTEGER NOT NULL CHECK (units_generated > 0),
  units_available INTEGER NOT NULL CHECK (units_available >= 0),
  sub_batch_code TEXT NOT NULL UNIQUE,
  fractionation_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiry_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Dispensações Fracionadas ao Paciente
CREATE TABLE IF NOT EXISTS fractionation_dispensations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fractionation_record_id INTEGER NOT NULL REFERENCES fractionation_records(id) ON DELETE CASCADE,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  pre_sale_id INTEGER REFERENCES pre_sales(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_cpf TEXT,
  doctor_name TEXT NOT NULL,
  doctor_crm TEXT NOT NULL,
  doctor_uf TEXT NOT NULL,
  units_dispensed INTEGER NOT NULL CHECK (units_dispensed > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  total_price REAL NOT NULL CHECK (total_price >= 0),
  leaflet_supplied INTEGER NOT NULL DEFAULT 1 CHECK (leaflet_supplied IN (0, 1)),
  posology TEXT NOT NULL,
  dispensed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_fractionation_records_product ON fractionation_records(product_id);
CREATE INDEX IF NOT EXISTS idx_fractionation_records_subbatch ON fractionation_records(sub_batch_code);
CREATE INDEX IF NOT EXISTS idx_fractionation_dispensations_record ON fractionation_dispensations(fractionation_record_id);
CREATE INDEX IF NOT EXISTS idx_products_fractionable ON products(is_fractionable);
