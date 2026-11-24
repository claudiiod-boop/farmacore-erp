-- Migration 031: Devoluções de Clientes, Trocas & Estorno Fiscal / Logística Reversa (RDC 44/2009 ANVISA & SEFAZ)

CREATE TABLE IF NOT EXISTS customer_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    customer_id INTEGER REFERENCES customers(id),
    code TEXT NOT NULL UNIQUE,
    return_type TEXT NOT NULL CHECK(return_type IN ('RETURN', 'EXCHANGE')),
    refund_method TEXT NOT NULL CHECK(refund_method IN ('STORE_CREDIT', 'CASH_REFUND', 'CARD_REVERSAL', 'EXCHANGE')),
    total_amount REAL NOT NULL CHECK(total_amount >= 0),
    reason TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'APPROVED', 'REJECTED', 'COMPLETED')),
    fiscal_nfe_key TEXT,
    cfop TEXT NOT NULL DEFAULT '1.202',
    created_by TEXT NOT NULL,
    authorized_by_pharmacist TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL REFERENCES customer_returns(id) ON DELETE CASCADE,
    sale_item_id INTEGER REFERENCES sale_items(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    batch_id INTEGER REFERENCES batches(id),
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL CHECK(unit_price >= 0),
    total_price REAL NOT NULL CHECK(total_price >= 0),
    condition TEXT NOT NULL CHECK(condition IN ('INTACT', 'DEFECTIVE', 'EXPIRED', 'UNSEALED')),
    destination TEXT NOT NULL CHECK(destination IN ('RETURN_TO_STOCK', 'QUARANTINE', 'DISPOSAL_PGRSS')),
    is_thermolabile INTEGER NOT NULL DEFAULT 0,
    requires_pharmacist_auth INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS store_credits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    return_id INTEGER REFERENCES customer_returns(id),
    code TEXT NOT NULL UNIQUE,
    initial_balance REAL NOT NULL CHECK(initial_balance >= 0),
    current_balance REAL NOT NULL CHECK(current_balance >= 0),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CANCELLED')),
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_returns_store_status ON customer_returns(store_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_returns_sale_id ON customer_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_customer_return_items_return_id ON customer_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_customer_return_items_product_id ON customer_return_items(product_id);
CREATE INDEX IF NOT EXISTS idx_store_credits_code ON store_credits(code);
CREATE INDEX IF NOT EXISTS idx_store_credits_customer_id ON store_credits(customer_id);
