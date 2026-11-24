-- Migration 032: Quarentena Sanitária de Medicamentos, Lotes Vencidos & Alertas de Recall Notivisa (RDC 44/2009 ANVISA)

CREATE TABLE IF NOT EXISTS quarantine_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    batch_id INTEGER NOT NULL REFERENCES batches(id),
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    reason TEXT NOT NULL CHECK(reason IN ('EXPIRED', 'DAMAGED', 'RECALL_ANVISA', 'CUSTOMER_RETURN', 'SUSPECTED_ADULTERATION', 'TEMPERATURE_EXCURSION', 'OTHER')),
    origin TEXT NOT NULL CHECK(origin IN ('INVENTORY_SWEEP', 'CUSTOMER_RETURN', 'INBOUND_INSPECTION', 'MANUAL')),
    status TEXT NOT NULL DEFAULT 'QUARANTINED' CHECK(status IN ('QUARANTINED', 'DISPOSED_PGRSS', 'RETURNED_TO_SUPPLIER', 'RELEASED')),
    notes TEXT,
    quarantined_by TEXT NOT NULL,
    quarantined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_by TEXT,
    resolved_at DATETIME,
    resolution_notes TEXT,
    pgrss_disposal_id INTEGER REFERENCES pgrss_disposal_records(id),
    fiscal_nfe_key TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recall_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anvisa_re_number TEXT NOT NULL,
    publication_date TEXT NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    batch_number TEXT NOT NULL,
    reason TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    affected_units_blocked INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quarantine_store_status ON quarantine_records(store_id, status);
CREATE INDEX IF NOT EXISTS idx_quarantine_product_batch ON quarantine_records(product_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_recall_alerts_batch ON recall_alerts(batch_number);
CREATE INDEX IF NOT EXISTS idx_recall_alerts_active ON recall_alerts(is_active);
