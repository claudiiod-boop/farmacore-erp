-- ============================================================================
-- Migration 026: Descarte Sanitário & PGRSS (RDC 222/2018 ANVISA)
-- FarmaCore ERP - Gerenciamento de Resíduos Químicos, MTR e Destinação Final
-- ============================================================================

-- 1. Tabela de Registros de Descarte / Abrigo de Resíduos
CREATE TABLE IF NOT EXISTS pgrss_disposal_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  waste_group TEXT NOT NULL CHECK (waste_group IN ('GRUPO_B_QUIMICO', 'GRUPO_A_BIOLOGICO', 'GRUPO_E_PERFUROCORTANTE')),
  reason TEXT NOT NULL CHECK (reason IN ('VENCIDO', 'AVARIADO', 'RECALL_ANVISA', 'SOBRA_MANIPULACAO', 'CONTAMINADO')),
  quantity REAL NOT NULL CHECK (quantity > 0),
  weight_kg REAL NOT NULL CHECK (weight_kg > 0),
  pharmacist_name TEXT NOT NULL,
  pharmacist_crf TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'STORED' CHECK (status IN ('STORED', 'DISPATCHED', 'INCINERATED')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Manifestos de Transporte de Resíduos (MTR)
CREATE TABLE IF NOT EXISTS pgrss_manifests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  manifest_number TEXT NOT NULL UNIQUE,
  collector_name TEXT NOT NULL,
  collector_cnpj TEXT NOT NULL,
  environmental_license TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  total_weight_kg REAL NOT NULL CHECK (total_weight_kg > 0),
  total_items INTEGER NOT NULL CHECK (total_items > 0),
  dispatch_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DISPATCHED' CHECK (status IN ('DISPATCHED', 'DESTINED', 'CANCELLED')),
  cdf_number TEXT,
  certificate_date TEXT,
  incineration_plant TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Itens do Manifesto MTR
CREATE TABLE IF NOT EXISTS pgrss_manifest_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manifest_id INTEGER NOT NULL REFERENCES pgrss_manifests(id) ON DELETE CASCADE,
  disposal_record_id INTEGER NOT NULL REFERENCES pgrss_disposal_records(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(manifest_id, disposal_record_id)
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_pgrss_disposal_store_status ON pgrss_disposal_records(store_id, status);
CREATE INDEX IF NOT EXISTS idx_pgrss_disposal_batch ON pgrss_disposal_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_pgrss_manifests_store ON pgrss_manifests(store_id, dispatch_date);
