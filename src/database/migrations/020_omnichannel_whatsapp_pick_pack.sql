-- Migration 020: Hub Omnichannel de Vendas, Atendimento WhatsApp (OpenWA Gateway) e Esteira de Pick-and-Pack Assistido

CREATE TABLE IF NOT EXISTS omnichannel_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    channel_type TEXT NOT NULL, -- 'WHATSAPP_OPENWA', 'ECOMMERCE_API', 'IFOOD_FARMA', 'RAPPI'
    name TEXT NOT NULL,
    base_url TEXT NOT NULL, -- e.g. 'http://localhost:8080' (OpenWA Server)
    api_key TEXT,
    session_id TEXT NOT NULL DEFAULT 'default',
    phone_number TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    bot_enabled INTEGER NOT NULL DEFAULT 1,
    auto_reply_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS omnichannel_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    contact_phone TEXT NOT NULL,
    contact_name TEXT,
    state TEXT NOT NULL DEFAULT 'IDLE', -- 'IDLE', 'SEARCHING_PRODUCT', 'SENDING_PRESCRIPTION', 'TRACKING_DELIVERY', 'HUMAN_ESCALATION'
    context_data TEXT, -- JSON com histórico de contexto ou carrinho temporário
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_open INTEGER NOT NULL DEFAULT 1,
    assigned_operator_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES omnichannel_channels(id)
);

CREATE TABLE IF NOT EXISTS omnichannel_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    external_message_id TEXT,
    direction TEXT NOT NULL, -- 'INBOUND', 'OUTBOUND'
    message_type TEXT NOT NULL DEFAULT 'TEXT', -- 'TEXT', 'IMAGE', 'DOCUMENT', 'BUTTONS_RESPONSE'
    content TEXT NOT NULL,
    media_url TEXT,
    status TEXT NOT NULL DEFAULT 'SENT', -- 'RECEIVED', 'SENT', 'DELIVERED', 'READ', 'FAILED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES omnichannel_conversations(id)
);

CREATE TABLE IF NOT EXISTS omnichannel_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    channel_id INTEGER NOT NULL,
    conversation_id INTEGER,
    channel_order_code TEXT NOT NULL UNIQUE, -- e.g. 'WPP-202611-0001'
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_type TEXT NOT NULL DEFAULT 'DELIVERY', -- 'DELIVERY', 'BALCAO_RETIRADA'
    delivery_address TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'NEW', -- 'NEW', 'IN_SEPARATION', 'CHECKED', 'DISPATCHED', 'CANCELLED'
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'PIX_ENTREGA', -- 'PIX_ENTREGA', 'CARTAO_ENTREGA', 'DINHEIRO_ENTREGA', 'PAGO_ONLINE'
    pre_sale_id INTEGER,
    delivery_order_id INTEGER,
    picker_operator_id INTEGER,
    separated_at DATETIME,
    checked_at DATETIME,
    dispatched_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES omnichannel_channels(id),
    FOREIGN KEY (conversation_id) REFERENCES omnichannel_conversations(id)
);

CREATE TABLE IF NOT EXISTS omnichannel_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    ean TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity_ordered INTEGER NOT NULL,
    quantity_picked INTEGER NOT NULL DEFAULT 0,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    batch_number TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PICKED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES omnichannel_orders(id)
);

CREATE TABLE IF NOT EXISTS omnichannel_order_audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    event_type TEXT NOT NULL, -- 'STATUS_CHANGE', 'ITEM_SCANNED', 'WRONG_ITEM_ATTEMPT', 'DISPATCHED'
    description TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES omnichannel_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_omnichannel_conversations_phone ON omnichannel_conversations(contact_phone);
CREATE INDEX IF NOT EXISTS idx_omnichannel_orders_status ON omnichannel_orders(status);
CREATE INDEX IF NOT EXISTS idx_omnichannel_order_items_order ON omnichannel_order_items(order_id);
