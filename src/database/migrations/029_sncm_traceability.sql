-- Migration 029: Rastreabilidade SNCM & DataMatrix Bidimensional (Lei 13.410/2016 e RDC 157/2017 ANVISA)

CREATE TABLE IF NOT EXISTS sncm_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    batch_id INTEGER REFERENCES batches(id),
    store_id INTEGER NOT NULL DEFAULT 1,
    gtin TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    expiration_date TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'IN_STOCK' CHECK(status IN ('IN_STOCK', 'DISPENSED', 'RETURNED', 'LOST', 'QUARANTINE')),
    sale_id INTEGER REFERENCES sales(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(gtin, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_sncm_items_gtin_serial ON sncm_items(gtin, serial_number);
CREATE INDEX IF NOT EXISTS idx_sncm_items_store_status ON sncm_items(store_id, status);
CREATE INDEX IF NOT EXISTS idx_sncm_items_batch ON sncm_items(batch_id);

CREATE TABLE IF NOT EXISTS sncm_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    sncm_item_id INTEGER NOT NULL REFERENCES sncm_items(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK(event_type IN ('RECEBIMENTO', 'DISPENSACAO', 'DEVOLUCAO', 'PERDA_INUTILIZACAO', 'QUARENTENA')),
    event_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nfe_access_key TEXT,
    fiscal_doc_number TEXT,
    transmission_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(transmission_status IN ('PENDING', 'SENT', 'CONFIRMED', 'REJECTED')),
    anvisa_protocol TEXT,
    anvisa_message TEXT,
    operator_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sncm_events_item ON sncm_events(sncm_item_id);
CREATE INDEX IF NOT EXISTS idx_sncm_events_status ON sncm_events(transmission_status);
CREATE INDEX IF NOT EXISTS idx_sncm_events_type ON sncm_events(event_type);
