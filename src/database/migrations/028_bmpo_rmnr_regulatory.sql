-- Migration 028: Balanços Oficiais BMPO, RMNRA & RMNRB (Portaria 344/98 ANVISA)

CREATE TABLE IF NOT EXISTS regulatory_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    report_type TEXT NOT NULL CHECK(report_type IN ('BMPO_TRIMESTRAL', 'BMPO_ANUAL', 'RMNRA', 'RMNRB', 'BSPO')),
    period_year INTEGER NOT NULL,
    period_quarter INTEGER CHECK(period_quarter BETWEEN 1 AND 4),
    period_month INTEGER CHECK(period_month BETWEEN 1 AND 12),
    pharmacist_name TEXT NOT NULL,
    pharmacist_crf TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'CONCLUDED', 'FILED_WITH_VISA')),
    visa_protocol_number TEXT,
    visa_filing_date TEXT,
    observations TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reg_reports_store_type ON regulatory_reports(store_id, report_type);
CREATE INDEX IF NOT EXISTS idx_reg_reports_period ON regulatory_reports(period_year, period_quarter, period_month);

CREATE TABLE IF NOT EXISTS regulatory_report_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES regulatory_reports(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    active_ingredient TEXT NOT NULL,
    dcb_code TEXT,
    therapeutic_class TEXT NOT NULL,
    control_list TEXT NOT NULL,
    presentation TEXT NOT NULL,
    unit_measure TEXT NOT NULL DEFAULT 'CX',
    initial_stock REAL NOT NULL DEFAULT 0,
    acquisitions REAL NOT NULL DEFAULT 0,
    sales REAL NOT NULL DEFAULT 0,
    losses REAL NOT NULL DEFAULT 0,
    final_stock REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_reg_items_report ON regulatory_report_items(report_id);
CREATE INDEX IF NOT EXISTS idx_reg_items_product ON regulatory_report_items(product_id);

CREATE TABLE IF NOT EXISTS regulatory_prescriptions_rel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES regulatory_reports(id) ON DELETE CASCADE,
    sale_id INTEGER,
    product_id INTEGER NOT NULL,
    prescription_notification_number TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK(notification_type IN ('A', 'B', 'B2', 'C1', 'C5', 'OUTROS')),
    dispensation_date TEXT NOT NULL,
    prescriber_name TEXT NOT NULL,
    prescriber_register_number TEXT NOT NULL,
    prescriber_uf TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    patient_document TEXT,
    buyer_name TEXT NOT NULL,
    buyer_document TEXT NOT NULL,
    quantity_dispensed REAL NOT NULL,
    batch_number TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reg_presc_report ON regulatory_prescriptions_rel(report_id);
CREATE INDEX IF NOT EXISTS idx_reg_presc_notif ON regulatory_prescriptions_rel(prescription_notification_number);
