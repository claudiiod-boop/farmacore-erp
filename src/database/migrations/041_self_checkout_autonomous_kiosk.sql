-- Migration 041: Totem de Autoatendimento Avançado & Pagamento Autônomo com TEF/PIX Touch (Self-Checkout Farmacêutico)

-- Sessões de Autoatendimento do Totem
CREATE TABLE IF NOT EXISTS self_checkout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kiosk_id INTEGER NOT NULL REFERENCES kiosk_terminals(id),
    store_id INTEGER NOT NULL REFERENCES stores(id),
    session_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN (
        'OPEN',
        'PAYING',
        'PAID',
        'BLOCKED_REQUIRES_PHARMACIST',
        'CANCELLED',
        'TIMEOUT'
    )),
    customer_cpf TEXT,
    customer_name TEXT,
    subtotal REAL DEFAULT 0.0,
    discount_amount REAL DEFAULT 0.0,
    total_amount REAL DEFAULT 0.0,
    payment_method TEXT CHECK(payment_method IN ('PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', NULL)),
    sale_id INTEGER REFERENCES sales(id),
    nfce_key TEXT,
    blocked_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- Itens Bipados no Self-Checkout
CREATE TABLE IF NOT EXISTS self_checkout_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES self_checkout_sessions(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL CHECK(unit_price >= 0),
    total_price REAL NOT NULL CHECK(total_price >= 0),
    batch_id INTEGER REFERENCES batches(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sc_sessions_store_status ON self_checkout_sessions(store_id, status);
CREATE INDEX IF NOT EXISTS idx_sc_sessions_kiosk ON self_checkout_sessions(kiosk_id);
CREATE INDEX IF NOT EXISTS idx_sc_items_session ON self_checkout_items(session_id);
