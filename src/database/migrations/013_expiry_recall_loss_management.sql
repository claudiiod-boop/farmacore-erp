-- Migration 013: Central de Validades Preditiva, Recall Sanitário Anvisa e Baixa Regulatória de Perdas/Avarias (Laudo VISA)

-- 1. Extensão da tabela batches para bloqueio cautelar sanitário
ALTER TABLE batches ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE batches ADD COLUMN block_reason TEXT;

-- 2. Resoluções de Recall Sanitário Anvisa
CREATE TABLE IF NOT EXISTS anvisa_recalls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resolution_number TEXT NOT NULL UNIQUE, -- Ex: RE 1.234/2026
  resolution_date TEXT NOT NULL,
  publication_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Lotes e Produtos Afetados pelo Recall
CREATE TABLE IF NOT EXISTS anvisa_recall_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recall_id INTEGER NOT NULL REFERENCES anvisa_recalls(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_number TEXT NOT NULL,
  action_taken TEXT NOT NULL DEFAULT 'BLOCKED' CHECK (action_taken IN ('BLOCKED', 'RETURNED_TO_SUPPLIER', 'DESTROYED')),
  total_stock_blocked INTEGER NOT NULL DEFAULT 0 CHECK (total_stock_blocked >= 0),
  blocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(recall_id, product_id, batch_number)
);

-- 4. Baixas Formais por Perdas, Avarias e Vencimento
CREATE TABLE IF NOT EXISTS inventory_losses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loss_number TEXT NOT NULL UNIQUE, -- PER-YYYYMM-XXXX
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (reason IN (
    'EXPIRED',
    'BROKEN_DAMAGED',
    'RECALL_ANVISA',
    'TEMPERATURE_EXCURSION',
    'THEFT_STOLEN',
    'OTHER'
  )),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'DISPOSED')),
  total_cost_amount REAL NOT NULL DEFAULT 0.0 CHECK (total_cost_amount >= 0),
  total_sale_amount REAL NOT NULL DEFAULT 0.0 CHECK (total_sale_amount >= 0),
  responsible_pharmacist_name TEXT NOT NULL,
  pharmacist_crf TEXT NOT NULL,
  pharmacist_crf_uf TEXT NOT NULL,
  laudo_number TEXT,
  disposal_company_name TEXT,
  disposal_certificate_number TEXT,
  mtr_number TEXT, -- Manifesto de Transporte de Resíduos
  disposed_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Itens da Baixa de Perdas
CREATE TABLE IF NOT EXISTS inventory_loss_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loss_id INTEGER NOT NULL REFERENCES inventory_losses(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  batch_number TEXT NOT NULL,
  expiration_date TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
  total_cost REAL NOT NULL CHECK (total_cost >= 0),
  unit_sale_price REAL NOT NULL CHECK (unit_sale_price >= 0),
  total_sale_price REAL NOT NULL CHECK (total_sale_price >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_batches_expiry_qty ON batches(expiration_date, quantity);
CREATE INDEX IF NOT EXISTS idx_batches_blocked ON batches(is_blocked);
CREATE INDEX IF NOT EXISTS idx_anvisa_recalls_status ON anvisa_recalls(status);
CREATE INDEX IF NOT EXISTS idx_anvisa_recall_items_batch ON anvisa_recall_items(batch_number, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_losses_store_status ON inventory_losses(store_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_loss_items_batch ON inventory_loss_items(batch_id);
