-- Migration 030: Reposição Inteligente de Estoque, Ponto de Pedido & Sugestão de Compras

CREATE TABLE IF NOT EXISTS replenishment_parameters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    store_id INTEGER NOT NULL DEFAULT 1,
    lead_time_days INTEGER NOT NULL DEFAULT 2,
    safety_stock_days INTEGER NOT NULL DEFAULT 3,
    review_cycle_days INTEGER NOT NULL DEFAULT 7,
    min_order_quantity INTEGER NOT NULL DEFAULT 1,
    preferred_distributor_id INTEGER,
    abc_class TEXT NOT NULL DEFAULT 'B' CHECK(abc_class IN ('A', 'B', 'C')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_replenish_param_store ON replenishment_parameters(store_id);
CREATE INDEX IF NOT EXISTS idx_replenish_param_prod ON replenishment_parameters(product_id);

CREATE TABLE IF NOT EXISTS replenishment_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    distributor_name TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'SUBMITTED', 'RECEIVED', 'CANCELLED')),
    total_items INTEGER NOT NULL DEFAULT 0,
    estimated_total REAL NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_replenish_orders_store ON replenishment_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_replenish_orders_status ON replenishment_orders(status);

CREATE TABLE IF NOT EXISTS replenishment_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES replenishment_orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    suggested_quantity INTEGER NOT NULL,
    order_quantity INTEGER NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL DEFAULT 0,
    current_stock INTEGER NOT NULL DEFAULT 0,
    reorder_point INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_replenish_order_items_order ON replenishment_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_replenish_order_items_prod ON replenishment_order_items(product_id);
