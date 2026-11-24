-- Migration 035: Validador de Receitas Digitais ICP-Brasil, CFM & Invalidação de Reutilização (Lei 14.063/2020 e Portaria 344/98)

CREATE TABLE IF NOT EXISTS digital_prescriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prescription_code TEXT NOT NULL UNIQUE,
    access_token TEXT,
    prescriber_name TEXT NOT NULL,
    prescriber_crm TEXT NOT NULL,
    prescriber_uf TEXT NOT NULL,
    prescriber_cpf TEXT,
    patient_name TEXT NOT NULL,
    patient_cpf TEXT,
    patient_birth_date TEXT,
    icp_signature_valid INTEGER NOT NULL DEFAULT 1 CHECK(icp_signature_valid IN (0, 1)),
    icp_cert_issuer TEXT DEFAULT 'AC Syngular / ITI ICP-Brasil',
    icp_signed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    prescription_type TEXT NOT NULL CHECK(prescription_type IN ('ANTIMICROBIAL', 'CONTROLLED_B1', 'CONTROLLED_C1', 'REGULAR')),
    issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'VALID' CHECK(status IN ('VALID', 'DISPENSED', 'EXPIRED', 'REVOKED')),
    dispensed_at DATETIME,
    dispensed_store_id INTEGER REFERENCES stores(id),
    dispensed_pharmacist_crf TEXT,
    dispensed_pre_sale_id INTEGER REFERENCES pre_sales(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS digital_prescription_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prescription_id INTEGER NOT NULL REFERENCES digital_prescriptions(id) ON DELETE CASCADE,
    medication_name TEXT NOT NULL,
    product_id INTEGER REFERENCES products(id),
    dosage TEXT,
    quantity_prescribed INTEGER NOT NULL,
    quantity_dispensed INTEGER NOT NULL DEFAULT 0,
    instructions TEXT
);

CREATE TABLE IF NOT EXISTS digital_prescription_dispensations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prescription_id INTEGER NOT NULL REFERENCES digital_prescriptions(id) ON DELETE CASCADE,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    pre_sale_id INTEGER REFERENCES pre_sales(id),
    pharmacist_name TEXT NOT NULL,
    pharmacist_crf TEXT NOT NULL,
    digital_stamp TEXT NOT NULL,
    dispensed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dig_presc_code ON digital_prescriptions(prescription_code);
CREATE INDEX IF NOT EXISTS idx_dig_presc_patient ON digital_prescriptions(patient_cpf);
CREATE INDEX IF NOT EXISTS idx_dig_presc_status ON digital_prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_dig_presc_items ON digital_prescription_items(prescription_id);
