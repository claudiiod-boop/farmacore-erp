-- Migration 051: Magnos Farma Analytics (BI em Tempo Real) & Orçamentos via WhatsApp

CREATE TABLE IF NOT EXISTS analytics_sales_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    year_month TEXT NOT NULL, -- YYYY-MM
    target_amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id),
    UNIQUE(store_id, year_month)
);

CREATE TABLE IF NOT EXISTS analytics_employee_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    employee_name TEXT NOT NULL,
    year_month TEXT NOT NULL, -- YYYY-MM
    target_amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id),
    UNIQUE(store_id, employee_id, year_month)
);

CREATE TABLE IF NOT EXISTS whatsapp_quotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    attendant_name TEXT NOT NULL,
    subtotal_brl REAL NOT NULL,
    discount_brl REAL NOT NULL DEFAULT 0,
    total_brl REAL NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'SENT', 'CONVERTED', 'EXPIRED', 'CANCELLED')),
    valid_until TEXT NOT NULL,
    whatsapp_message_payload TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_quotations_store ON whatsapp_quotations(store_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_quotations_phone ON whatsapp_quotations(customer_phone);

CREATE TABLE IF NOT EXISTS whatsapp_quotation_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price_brl REAL NOT NULL,
    total_price_brl REAL NOT NULL,
    FOREIGN KEY (quotation_id) REFERENCES whatsapp_quotations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_quotation_items_quot ON whatsapp_quotation_items(quotation_id);
