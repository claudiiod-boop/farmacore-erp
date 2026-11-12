-- Migration 004: Purchases & SNGPC Regulatory Module

-- 1. Cabeçalho das Notas Fiscais de Entrada (Compras)
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  access_key TEXT UNIQUE NOT NULL, -- 44 dígitos da NF-e
  invoice_number INTEGER NOT NULL,
  invoice_series INTEGER NOT NULL,
  issue_date TEXT NOT NULL,
  supplier_cnpj TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_ie TEXT,
  total_invoice_amount REAL NOT NULL,
  total_products_amount REAL NOT NULL,
  total_icms_st REAL NOT NULL DEFAULT 0,
  xml_content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_key ON purchase_invoices(access_key);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON purchase_invoices(supplier_cnpj);

-- 2. Itens das Notas Fiscais de Entrada
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_invoice_id INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  item_index INTEGER NOT NULL,
  supplier_product_code TEXT NOT NULL,
  ean TEXT NOT NULL,
  product_name TEXT NOT NULL,
  ncm TEXT NOT NULL,
  cfop TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost REAL NOT NULL,
  total_cost REAL NOT NULL,
  batch_number TEXT,
  expiration_date TEXT,
  manufacturing_date TEXT,
  anvisa_registration TEXT,
  pmc REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_invoice ON purchase_invoice_items(purchase_invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_invoice_items(product_id);

-- 3. Transmissões Semanais SNGPC (crie antes de sngpc_movements para permitir FK)
CREATE TABLE IF NOT EXISTS sngpc_transmissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  pharmacist_name TEXT NOT NULL,
  pharmacist_cpf TEXT NOT NULL,
  pharmacist_crf TEXT NOT NULL,
  pharmacist_crf_uf TEXT NOT NULL,
  xml_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'GERADO' CHECK (status IN ('GERADO', 'TRANSMITIDO', 'CONFIRMADO', 'REJEITADO')),
  hash_xml TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Livro e Movimentações Sanitárias do SNGPC
CREATE TABLE IF NOT EXISTS sngpc_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('ENTRADA', 'SAIDA_VENDA', 'PERDA')),
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reference_type TEXT NOT NULL CHECK (reference_type IN ('PURCHASE_INVOICE', 'SALE', 'INVENTORY_ADJUSTMENT')),
  reference_id INTEGER NOT NULL,
  movement_date TEXT NOT NULL,
  ms_registration TEXT NOT NULL,
  prescription_id INTEGER REFERENCES prescriptions(id) ON DELETE SET NULL,
  is_transmitted INTEGER NOT NULL DEFAULT 0,
  transmission_id INTEGER REFERENCES sngpc_transmissions(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sngpc_movements_prod_batch ON sngpc_movements(product_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_sngpc_movements_transmitted ON sngpc_movements(is_transmitted);
CREATE INDEX IF NOT EXISTS idx_sngpc_movements_date ON sngpc_movements(movement_date);

-- 5. Extensão de Prescrições para Notificação SNGPC
ALTER TABLE prescriptions ADD COLUMN notification_number TEXT;
ALTER TABLE prescriptions ADD COLUMN buyer_doc_type TEXT DEFAULT '1';
