-- Migration 011: CRM Farmacêutico, Clube de Fidelidade, Cashback & Motor de Promoções Combinadas

-- 1. Programas e Parâmetros de Fidelidade / Cashback
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  cashback_percent REAL NOT NULL DEFAULT 3.0 CHECK (cashback_percent >= 0 AND cashback_percent <= 100),
  validity_days INTEGER NOT NULL DEFAULT 90 CHECK (validity_days > 0),
  min_purchase_amount REAL NOT NULL DEFAULT 10.0 CHECK (min_purchase_amount >= 0),
  min_redeem_amount REAL NOT NULL DEFAULT 5.0 CHECK (min_redeem_amount >= 0),
  max_redeem_percent REAL NOT NULL DEFAULT 50.0 CHECK (max_redeem_percent > 0 AND max_redeem_percent <= 100),
  allow_with_promotions INTEGER NOT NULL DEFAULT 1 CHECK (allow_with_promotions IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed de Programa de Fidelidade Padrão FarmaCore
INSERT OR IGNORE INTO loyalty_programs (
  id, name, cashback_percent, validity_days, min_purchase_amount, min_redeem_amount, max_redeem_percent, allow_with_promotions, is_active
) VALUES (
  1, 'Programa Fidelidade FarmaCore', 3.0, 90, 10.0, 5.0, 50.0, 1, 1
);

-- 2. Carteira de Fidelidade do Paciente (Vinculada ao Customer)
CREATE TABLE IF NOT EXISTS loyalty_wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  current_balance REAL NOT NULL DEFAULT 0.0 CHECK (current_balance >= 0),
  total_earned REAL NOT NULL DEFAULT 0.0 CHECK (total_earned >= 0),
  total_redeemed REAL NOT NULL DEFAULT 0.0 CHECK (total_redeemed >= 0),
  total_expired REAL NOT NULL DEFAULT 0.0 CHECK (total_expired >= 0),
  last_activity_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Extrato / Movimentações de Cashback
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id INTEGER NOT NULL REFERENCES loyalty_wallets(id) ON DELETE CASCADE,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('EARN', 'REDEEM', 'EXPIRE', 'MANUAL_ADJUSTMENT')),
  amount REAL NOT NULL CHECK (amount > 0),
  balance_after REAL NOT NULL CHECK (balance_after >= 0),
  expires_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Motor de Campanhas e Promoções Combinadas
CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN (
    'TAKE_MORE_PAY_LESS',
    'PROGRESSIVE_DISCOUNT',
    'COMBO_CROSS_SELL',
    'CLUB_SPECIAL_PRICE',
    'BIRTHDAY_DISCOUNT'
  )),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  applies_to TEXT NOT NULL DEFAULT 'SPECIFIC_PRODUCTS' CHECK (applies_to IN ('ALL_PRODUCTS', 'SPECIFIC_PRODUCTS', 'CATEGORY')),
  target_category TEXT,
  conditions_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Vínculo de Produtos Específicos com a Promoção
CREATE TABLE IF NOT EXISTS promotion_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promotion_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'TRIGGER' CHECK (role IN ('TRIGGER', 'REWARD', 'BOTH')),
  special_price REAL CHECK (special_price >= 0),
  discount_percent REAL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(promotion_id, product_id, role)
);

-- 6. Adesão a Tratamento Contínuo (Aviso de Recompra Preditiva)
CREATE TABLE IF NOT EXISTS patient_treatments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  daily_dose REAL NOT NULL DEFAULT 1.0 CHECK (daily_dose > 0),
  units_per_box INTEGER NOT NULL DEFAULT 30 CHECK (units_per_box > 0),
  boxes_purchased INTEGER NOT NULL DEFAULT 1 CHECK (boxes_purchased > 0),
  total_days_supply INTEGER NOT NULL CHECK (total_days_supply > 0),
  start_date TEXT NOT NULL,
  expected_refill_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CONTACTED', 'REFILLED', 'DISCONTINUED')),
  last_contacted_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_wallet ON loyalty_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotion_products_product ON promotion_products(product_id);
CREATE INDEX IF NOT EXISTS idx_patient_treatments_refill ON patient_treatments(expected_refill_date, status);
CREATE INDEX IF NOT EXISTS idx_patient_treatments_customer ON patient_treatments(customer_id);
