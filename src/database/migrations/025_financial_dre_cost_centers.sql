-- ============================================================================
-- Migration 025: DRE Gerencial, Centros de Custos & Lucratividade Analítica
-- FarmaCore ERP - Estrutura Contábil, Rateio de Despesas e Regime Caixa/Competência
-- ============================================================================

-- 1. Centros de Custos Farmacêuticos
CREATE TABLE IF NOT EXISTS cost_centers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department_type TEXT NOT NULL CHECK (department_type IN ('BALCAO', 'MANIPULACAO', 'PERFUMARIA', 'DELIVERY', 'CLINICO', 'ADMINISTRATIVO')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Centros de Custo Padrão
INSERT OR IGNORE INTO cost_centers (code, name, department_type) VALUES
  ('CC-BALCAO', 'Balcão de Medicamentos', 'BALCAO'),
  ('CC-MANIP', 'Manipulação Magistral', 'MANIPULACAO'),
  ('CC-PERF', 'Perfumaria, Higiene e Cosméticos', 'PERFUMARIA'),
  ('CC-DELIV', 'Tele-Entrega e Logística Farmacêutica', 'DELIVERY'),
  ('CC-CLINIC', 'Consultório Farmacêutico Clínico', 'CLINICO'),
  ('CC-ADMIN', 'Administração Geral e Retaguarda', 'ADMINISTRATIVO');

-- 2. Despesas Operacionais e Financeiras
CREATE TABLE IF NOT EXISTS operational_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  cost_center_id INTEGER NOT NULL REFERENCES cost_centers(id) ON DELETE RESTRICT,
  expense_type TEXT NOT NULL CHECK (expense_type IN ('PESSOAL', 'ADMINISTRATIVA', 'VENDAS_LOGISTICA', 'TRIBUTARIA', 'FINANCEIRA', 'OPERACIONAL_OUTRAS')),
  description TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  due_date TEXT NOT NULL,
  payment_date TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'CANCELLED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Snapshots Oficiais de Fechamento de DRE
CREATE TABLE IF NOT EXISTS dre_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL, -- Formato YYYY-MM
  regime TEXT NOT NULL DEFAULT 'COMPETENCIA' CHECK (regime IN ('COMPETENCIA', 'CAIXA')),
  gross_revenue REAL NOT NULL,
  deductions_amount REAL NOT NULL,
  net_revenue REAL NOT NULL,
  cmv_amount REAL NOT NULL,
  gross_profit REAL NOT NULL,
  gross_margin_percent REAL NOT NULL,
  operating_expenses_amount REAL NOT NULL,
  ebitda_amount REAL NOT NULL,
  ebitda_margin_percent REAL NOT NULL,
  financial_expenses_amount REAL NOT NULL,
  net_profit REAL NOT NULL,
  net_margin_percent REAL NOT NULL,
  break_even_point REAL NOT NULL,
  closed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, period_month, regime)
);
