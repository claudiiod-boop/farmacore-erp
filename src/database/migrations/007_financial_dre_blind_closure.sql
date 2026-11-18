-- Migration 007: Fechamento de Caixa Cego, Conciliacao Financeira TEF & DRE / Curva ABC

-- 1. Tabela cash_closures (Fechamento Cego e Conferencia)
CREATE TABLE IF NOT EXISTS cash_closures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cash_session_id INTEGER NOT NULL UNIQUE REFERENCES cash_sessions(id) ON DELETE RESTRICT,
  operator_name TEXT NOT NULL,
  declared_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Valores declarados pelo operador (contagem cega)
  declared_cash REAL NOT NULL DEFAULT 0.0,
  declared_credit REAL NOT NULL DEFAULT 0.0,
  declared_debit REAL NOT NULL DEFAULT 0.0,
  declared_pix REAL NOT NULL DEFAULT 0.0,
  declared_pbm REAL NOT NULL DEFAULT 0.0,
  total_declared REAL NOT NULL DEFAULT 0.0,
  operator_notes TEXT,
  
  -- Valores apurados pelo sistema no momento do fechamento
  system_cash REAL NOT NULL DEFAULT 0.0,
  system_credit REAL NOT NULL DEFAULT 0.0,
  system_debit REAL NOT NULL DEFAULT 0.0,
  system_pix REAL NOT NULL DEFAULT 0.0,
  system_pbm REAL NOT NULL DEFAULT 0.0,
  system_supplies REAL NOT NULL DEFAULT 0.0,
  system_sangrias REAL NOT NULL DEFAULT 0.0,
  total_system REAL NOT NULL DEFAULT 0.0,
  
  -- Quebra / Sobra
  cash_difference REAL NOT NULL DEFAULT 0.0,
  total_difference REAL NOT NULL DEFAULT 0.0,
  difference_status TEXT NOT NULL CHECK (difference_status IN ('EXACT', 'SURPLUS', 'SHORTAGE')),
  
  -- Homologacao Gerencial
  manager_name TEXT,
  manager_notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  reviewed_at TEXT,
  
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_closures_session ON cash_closures(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_status ON cash_closures(status);
CREATE INDEX IF NOT EXISTS idx_cash_closures_created ON cash_closures(created_at);

-- 2. Extensao da Tabela tef_transactions para Conciliacao
ALTER TABLE tef_transactions ADD COLUMN settlement_status TEXT DEFAULT 'PENDING' CHECK (settlement_status IN ('PENDING', 'SETTLED', 'DIVERGENT'));
ALTER TABLE tef_transactions ADD COLUMN settled_amount REAL;
ALTER TABLE tef_transactions ADD COLUMN settled_fee REAL;
ALTER TABLE tef_transactions ADD COLUMN settled_at TEXT;
ALTER TABLE tef_transactions ADD COLUMN bank_account TEXT;

-- 3. Extensao da Tabela products para Classificacao Farmaceutica
ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'CORRELATOS_OUTROS' CHECK (category IN ('REFERENCIA', 'GENERICO', 'SIMILAR', 'PERFUMARIA', 'CORRELATOS_OUTROS'));
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
