-- ============================================================================
-- Migration 024: Gestão de Comissões Multinível, Metas de Balcão & Campanhas de Venda
-- FarmaCore ERP - Remuneração Comercial, Bônus por Caixa e Aceleradores de Metas
-- ============================================================================

-- 1. Equipe Comercial (Balconistas, Farmacêuticos e Operadores)
CREATE TABLE IF NOT EXISTS sellers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cpf TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'BALCONISTA' CHECK (role IN ('BALCONISTA', 'FARMACEUTICO', 'CAIXA', 'GERENTE')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Regras de Comissionamento por Categoria Farmacêutica
CREATE TABLE IF NOT EXISTS commission_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_type TEXT NOT NULL UNIQUE CHECK (category_type IN ('GENERICO', 'SIMILAR', 'ETICO', 'OTC', 'PERFUMARIA', 'MANIPULADO')),
  percentage REAL NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed Padrão de Comissões por Categoria Farmacêutica
INSERT OR IGNORE INTO commission_rules (category_type, percentage, description) VALUES
  ('GENERICO', 6.0, 'Medicamentos Genéricos (alta margem e incentivo à intercambialidade)'),
  ('SIMILAR', 7.0, 'Medicamentos Similares e Bonificados'),
  ('ETICO', 1.5, 'Medicamentos Éticos / Referência'),
  ('OTC', 4.0, 'MIPs / Medicamentos Isentos de Prescrição'),
  ('PERFUMARIA', 3.0, 'Higiene, Cosméticos e Cuidados Pessoais'),
  ('MANIPULADO', 5.0, 'Fórmulas e Medicamentos Magistrais');

-- 3. Campanhas de Incentivo por Fabricante / Caixa
CREATE TABLE IF NOT EXISTS commission_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  manufacturer TEXT,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  bonus_per_unit REAL NOT NULL DEFAULT 0.0 CHECK (bonus_per_unit >= 0),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Metas Mensais de Venda e Aceleradores
CREATE TABLE IF NOT EXISTS sales_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL, -- YYYY-MM
  target_amount REAL NOT NULL CHECK (target_amount > 0),
  achieved_amount REAL NOT NULL DEFAULT 0.0 CHECK (achieved_amount >= 0),
  accelerator_multiplier REAL NOT NULL DEFAULT 1.0 CHECK (accelerator_multiplier >= 1.0),
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'ACHIEVED', 'NOT_ACHIEVED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(seller_id, period_month)
);

-- 5. Extrato de Comissões por Venda e Item
CREATE TABLE IF NOT EXISTS commission_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  sale_item_id INTEGER REFERENCES sale_items(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_type TEXT NOT NULL,
  item_total REAL NOT NULL,
  base_commission_percent REAL NOT NULL,
  base_commission_amount REAL NOT NULL,
  campaign_bonus_amount REAL NOT NULL DEFAULT 0.0,
  accelerator_multiplier REAL NOT NULL DEFAULT 1.0,
  final_commission_amount REAL NOT NULL,
  period_month TEXT NOT NULL, -- YYYY-MM
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PAID')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_commission_statements_seller ON commission_statements(seller_id, period_month);
CREATE INDEX IF NOT EXISTS idx_commission_statements_status ON commission_statements(status);
CREATE INDEX IF NOT EXISTS idx_sales_goals_period ON sales_goals(period_month, store_id);
CREATE INDEX IF NOT EXISTS idx_commission_campaigns_dates ON commission_campaigns(start_date, end_date, is_active);
