-- ============================================================================
-- Migration 022: Clube de Assinatura & Reposição Recorrente de Medicamentos
-- Farmacore ERP - Automação de Tratamentos Crônicos & Autoship Recorrente
-- ============================================================================

-- 1. Tabela de Assinaturas (Contratos de Recorrência)
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 30 CHECK (interval_days IN (15, 30, 45, 60, 90)),
  preferred_delivery_day INTEGER NOT NULL DEFAULT 5 CHECK (preferred_delivery_day BETWEEN 1 AND 31),
  delivery_mode TEXT NOT NULL DEFAULT 'DELIVERY' CHECK (delivery_mode IN ('DELIVERY', 'STORE_PICKUP')),
  delivery_address TEXT,
  delivery_neighborhood TEXT,
  delivery_city TEXT,
  payment_method TEXT NOT NULL DEFAULT 'PIX_RECURRING' CHECK (payment_method IN ('PIX_RECURRING', 'CREDIT_CARD_TOKEN', 'CONVENIO_CREDIARIO', 'CASH_ON_DELIVERY')),
  payment_card_token TEXT,
  discount_percentage REAL NOT NULL DEFAULT 5.0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'CANCELLED')),
  next_billing_date TEXT NOT NULL,
  last_billing_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Itens da Assinatura (Cesta de Medicamentos e Produtos Recorrentes)
CREATE TABLE IF NOT EXISTS subscription_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity REAL NOT NULL DEFAULT 1.0 CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  discount_percentage REAL NOT NULL DEFAULT 0.0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  requires_prescription INTEGER NOT NULL DEFAULT 0 CHECK (requires_prescription IN (0, 1)),
  prescription_doctor_crm TEXT,
  prescription_doctor_uf TEXT,
  prescription_expiry_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Ciclos de Reposição & Faturamento
CREATE TABLE IF NOT EXISTS subscription_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  scheduled_date TEXT NOT NULL,
  processed_at TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'PRESCRIPTION_PENDING', 'FAILED', 'CANCELLED', 'SKIPPED')),
  pre_sale_id INTEGER REFERENCES pre_sales(id) ON DELETE SET NULL,
  delivery_order_id INTEGER REFERENCES delivery_orders(id) ON DELETE SET NULL,
  total_amount REAL NOT NULL DEFAULT 0.0,
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Alta Performance para Busca e Motor Diário de Reposições
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_billing ON subscriptions(status, next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscription_items_subscription ON subscription_items(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_items_prescription ON subscription_items(requires_prescription, prescription_expiry_date);
CREATE INDEX IF NOT EXISTS idx_subscription_cycles_subscription ON subscription_cycles(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_cycles_status_date ON subscription_cycles(status, scheduled_date);
