-- Migration 039: Hub de Marketplaces & Delivery Externo (iFood, Rappi, Farmácias APP, Consulta Remédios)

-- Canais de Marketplace por Loja
CREATE TABLE IF NOT EXISTS marketplace_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    channel_name TEXT NOT NULL CHECK(channel_name IN ('IFOOD', 'RAPPI', 'FARMACIAS_APP', 'CONSULTA_REMEDIOS', 'MERCADO_LIVRE')),
    merchant_id TEXT,
    api_key TEXT,
    api_secret TEXT,
    webhook_secret TEXT,
    commission_rate REAL DEFAULT 0.0,
    stock_buffer_percent REAL DEFAULT 10.0,
    auto_confirm_orders INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, channel_name)
);

-- Mapeamento de Catálogo De-Para (Produto ERP <-> SKU Marketplace)
CREATE TABLE IF NOT EXISTS marketplace_catalog_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL REFERENCES marketplace_channels(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    external_sku TEXT NOT NULL,
    markup_percent REAL DEFAULT 0.0,
    custom_price REAL,
    is_synced INTEGER DEFAULT 1,
    last_stock_synced INTEGER DEFAULT 0,
    last_sync_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, product_id),
    UNIQUE(channel_id, external_sku)
);

-- Pedidos Recebidos de Marketplaces Externos
CREATE TABLE IF NOT EXISTS marketplace_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    channel_id INTEGER NOT NULL REFERENCES marketplace_channels(id),
    external_order_id TEXT NOT NULL,
    display_order_id TEXT,
    customer_name TEXT NOT NULL,
    customer_document TEXT,
    customer_phone TEXT,
    delivery_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION' CHECK(status IN (
        'PENDING_CONFIRMATION',
        'CONFIRMED',
        'PREPARING',
        'READY_FOR_PICKUP',
        'DISPATCHED',
        'DELIVERED',
        'CANCELLED'
    )),
    subtotal REAL NOT NULL,
    delivery_fee REAL DEFAULT 0.0,
    platform_fee REAL DEFAULT 0.0,
    total_amount REAL NOT NULL,
    placed_at DATETIME NOT NULL,
    confirmed_at DATETIME,
    dispatched_at DATETIME,
    delivered_at DATETIME,
    cancellation_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, external_order_id)
);

-- Itens do Pedido de Marketplace
CREATE TABLE IF NOT EXISTS marketplace_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    external_sku TEXT,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL CHECK(unit_price >= 0),
    total_price REAL NOT NULL CHECK(total_price >= 0),
    batch_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mp_orders_store_status ON marketplace_orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_mp_orders_channel ON marketplace_orders(channel_id);
CREATE INDEX IF NOT EXISTS idx_mp_catalog_channel ON marketplace_catalog_mappings(channel_id);
