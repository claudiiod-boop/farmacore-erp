-- Migration 010: Convênios Corporativos, Crediário Próprio & Limite de Crédito

-- 1. Tabela corporate_agreements (Empresas Conveniadas)
CREATE TABLE IF NOT EXISTS corporate_agreements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  trade_name TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  ie TEXT,
  phone TEXT,
  email TEXT,
  contact_name TEXT,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  closing_day INTEGER NOT NULL DEFAULT 20,
  due_day INTEGER NOT NULL DEFAULT 5,
  credit_limit REAL NOT NULL DEFAULT 0.0,
  discount_percent REAL NOT NULL DEFAULT 0.0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela customers (Clientes Titulares de Crédito e Convênio)
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  agreement_id INTEGER REFERENCES corporate_agreements(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  rg TEXT,
  birth_date TEXT,
  phone TEXT,
  email TEXT,
  street TEXT,
  number TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  registration_number TEXT,
  department TEXT,
  credit_limit REAL NOT NULL DEFAULT 0.0,
  current_debt REAL NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'BLOCKED_OVERDUE', 'INACTIVE'
  allow_dependents INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela customer_dependents (Dependentes Autorizados)
CREATE TABLE IF NOT EXISTS customer_dependents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'OUTRO', -- 'CONJUGE', 'FILHO(A)', 'PAI/MAE', 'OUTRO'
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabela agreement_invoices (Faturas Globais de Convênio)
CREATE TABLE IF NOT EXISTS agreement_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  agreement_id INTEGER NOT NULL REFERENCES corporate_agreements(id) ON DELETE RESTRICT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  due_date TEXT NOT NULL,
  total_amount REAL NOT NULL,
  total_sales_count INTEGER NOT NULL DEFAULT 0,
  total_employees_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'PAID', 'CANCELLED'
  paid_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabela customer_receivables (Parcelas / Carnê a Receber)
CREATE TABLE IF NOT EXISTS customer_receivables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sale_id INTEGER REFERENCES sales(id) ON DELETE RESTRICT,
  agreement_id INTEGER REFERENCES corporate_agreements(id) ON DELETE RESTRICT,
  invoice_id INTEGER REFERENCES agreement_invoices(id) ON DELETE SET NULL,
  installment_number INTEGER NOT NULL DEFAULT 1,
  total_installments INTEGER NOT NULL DEFAULT 1,
  due_date TEXT NOT NULL,
  original_amount REAL NOT NULL,
  paid_amount REAL NOT NULL DEFAULT 0.0,
  discount_amount REAL NOT NULL DEFAULT 0.0,
  interest_amount REAL NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'PAID', 'CANCELLED', 'RENEGOTIATED'
  paid_at TEXT,
  cash_session_id INTEGER REFERENCES cash_sessions(id) ON DELETE SET NULL,
  payment_method TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_customers_cpf ON customers(cpf);
CREATE INDEX IF NOT EXISTS idx_customers_agreement ON customers(agreement_id);
CREATE INDEX IF NOT EXISTS idx_customer_receivables_customer ON customer_receivables(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_receivables_due ON customer_receivables(due_date, status);
CREATE INDEX IF NOT EXISTS idx_agreement_invoices_agreement ON agreement_invoices(agreement_id);
