-- Migration 012: FarmaCore ERP — Delivery Farmacêutico, Tele-Entrega, Entregadores e Romaneios de Despacho com Acerto no Caixa

-- 1. Zonas e Bairros de Entrega
CREATE TABLE IF NOT EXISTS delivery_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'SP',
  delivery_fee REAL NOT NULL DEFAULT 5.0 CHECK (delivery_fee >= 0),
  estimated_minutes INTEGER NOT NULL DEFAULT 40 CHECK (estimated_minutes > 0),
  free_shipping_threshold REAL CHECK (free_shipping_threshold >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed de Zonas Padrão de Entrega
INSERT OR IGNORE INTO delivery_zones (
  id, name, neighborhood, city, state, delivery_fee, estimated_minutes, free_shipping_threshold, is_active
) VALUES
  (1, 'Zona Central', 'Centro', 'São Paulo', 'SP', 5.0, 30, 50.0, 1),
  (2, 'Zona Sul - Jardins', 'Jardins', 'São Paulo', 'SP', 7.0, 40, 70.0, 1),
  (3, 'Zona Sul - Bela Vista', 'Bela Vista', 'São Paulo', 'SP', 6.0, 35, 60.0, 1),
  (4, 'Zona Oeste - Pinheiros', 'Pinheiros', 'São Paulo', 'SP', 8.0, 45, 80.0, 1);

-- 2. Entregadores / Motoboys
CREATE TABLE IF NOT EXISTS couriers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'MOTO' CHECK (vehicle_type IN ('MOTO', 'BIKE', 'CAR', 'WALK')),
  vehicle_plate TEXT,
  cnh TEXT,
  commission_per_delivery REAL NOT NULL DEFAULT 3.0 CHECK (commission_per_delivery >= 0),
  daily_allowance REAL NOT NULL DEFAULT 0.0 CHECK (daily_allowance >= 0),
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ON_DELIVERY', 'INACTIVE')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Romaneios de Despacho & Acertos de Contas no Caixa
CREATE TABLE IF NOT EXISTS delivery_dispatches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispatch_number TEXT NOT NULL UNIQUE, -- ROM-YYYYMM-XXXX
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  courier_id INTEGER NOT NULL REFERENCES couriers(id) ON DELETE RESTRICT,
  cash_session_id INTEGER REFERENCES cash_sessions(id) ON DELETE SET NULL,
  total_orders INTEGER NOT NULL DEFAULT 0 CHECK (total_orders >= 0),
  total_amount REAL NOT NULL DEFAULT 0.0 CHECK (total_amount >= 0),
  total_change_provided REAL NOT NULL DEFAULT 0.0 CHECK (total_change_provided >= 0),
  collected_cash REAL NOT NULL DEFAULT 0.0 CHECK (collected_cash >= 0),
  collected_card REAL NOT NULL DEFAULT 0.0 CHECK (collected_card >= 0),
  collected_pix REAL NOT NULL DEFAULT 0.0 CHECK (collected_pix >= 0),
  total_commission REAL NOT NULL DEFAULT 0.0 CHECK (total_commission >= 0),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'SETTLED', 'CANCELLED')),
  operator_name TEXT,
  notes TEXT,
  dispatched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Pedidos de Tele-Entrega / Delivery
CREATE TABLE IF NOT EXISTS delivery_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE, -- DEL-YYYYMM-XXXX
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_cpf TEXT,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'SP',
  zip_code TEXT,
  reference_point TEXT,
  subtotal_amount REAL NOT NULL CHECK (subtotal_amount >= 0),
  delivery_fee REAL NOT NULL DEFAULT 0.0 CHECK (delivery_fee >= 0),
  discount_amount REAL NOT NULL DEFAULT 0.0 CHECK (discount_amount >= 0),
  total_amount REAL NOT NULL CHECK (total_amount >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'CONVENIO', 'CREDIARIO')),
  change_for REAL CHECK (change_for >= 0),
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN (
    'RECEIVED',
    'PREPARING',
    'READY_FOR_PICKUP',
    'DISPATCHED',
    'DELIVERED',
    'RETURNED',
    'CANCELLED'
  )),
  courier_id INTEGER REFERENCES couriers(id) ON DELETE SET NULL,
  dispatch_id INTEGER REFERENCES delivery_dispatches(id) ON DELETE SET NULL,
  pre_sale_id INTEGER REFERENCES pre_sales(id) ON DELETE SET NULL,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  notes TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dispatched_at TEXT,
  delivered_at TEXT,
  returned_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Itens do Pedido de Tele-Entrega
CREATE TABLE IF NOT EXISTS delivery_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_order_id INTEGER NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  total_price REAL NOT NULL CHECK (total_price >= 0),
  batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  batch_number TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders(status, store_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_customer ON delivery_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_courier ON delivery_orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_dispatch ON delivery_orders(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_delivery_dispatches_courier ON delivery_dispatches(courier_id, status);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_neighborhood ON delivery_zones(neighborhood, city);
