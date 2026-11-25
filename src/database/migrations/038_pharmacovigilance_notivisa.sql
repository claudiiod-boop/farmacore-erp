-- Migration 038: Farmacovigilância, Reações Adversas (RAM) & Queixas Técnicas (RDC 406/2020 ANVISA & NOTIVISA)

-- 1. Tabela de Notificação de Reações Adversas a Medicamentos (RAM)
CREATE TABLE IF NOT EXISTS adverse_drug_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER REFERENCES stores(id),
    protocol_code TEXT NOT NULL UNIQUE,
    patient_initials TEXT NOT NULL,
    patient_age INTEGER,
    patient_gender TEXT NOT NULL CHECK(patient_gender IN ('M', 'F', 'OTHER')),
    is_pregnant INTEGER NOT NULL DEFAULT 0,
    suspected_drug_name TEXT NOT NULL,
    suspected_drug_batch TEXT NOT NULL,
    suspected_drug_manufacturer TEXT,
    daily_dose TEXT NOT NULL,
    treatment_start_date TEXT NOT NULL,
    treatment_end_date TEXT,
    therapeutic_indication TEXT,
    concomitant_drugs TEXT,
    reaction_description TEXT NOT NULL,
    reaction_onset_date TEXT NOT NULL,
    severity_level TEXT NOT NULL CHECK(severity_level IN ('MILD', 'MODERATE', 'SEVERE')),
    serious_criteria TEXT,
    dechallenge_status TEXT NOT NULL CHECK(dechallenge_status IN ('IMPROVED', 'NOT_IMPROVED', 'NOT_APPLICABLE', 'UNKNOWN')),
    rechallenge_status TEXT NOT NULL CHECK(rechallenge_status IN ('RECURRED', 'NOT_RECURRED', 'NOT_REEXPOSED', 'UNKNOWN')),
    outcome TEXT NOT NULL CHECK(outcome IN ('RECOVERED', 'RECOVERING', 'NOT_RECOVERED', 'FATAL', 'UNKNOWN')),
    notifier_pharmacist_name TEXT NOT NULL,
    notifier_pharmacist_crf TEXT NOT NULL,
    notivisa_submission_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(notivisa_submission_status IN ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED')),
    notivisa_protocol TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_ram_protocol ON adverse_drug_reactions(protocol_code);
CREATE INDEX IF NOT EXISTS idx_ram_batch ON adverse_drug_reactions(suspected_drug_batch);
CREATE INDEX IF NOT EXISTS idx_ram_severity ON adverse_drug_reactions(severity_level);

-- 2. Tabela de Queixas Técnicas e Desvios de Qualidade (QT)
CREATE TABLE IF NOT EXISTS technical_complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER REFERENCES stores(id),
    protocol_code TEXT NOT NULL UNIQUE,
    product_name TEXT NOT NULL,
    product_ean TEXT,
    batch_number TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    expiration_date TEXT NOT NULL,
    complaint_type TEXT NOT NULL CHECK(complaint_type IN (
        'PHYSICAL_CHEMICAL_ALTERATION',
        'FOREIGN_MATTER',
        'COLOR_OR_ODOR_CHANGE',
        'PACKAGING_OR_SEAL_DEFECT',
        'LABELING_INACCURACY',
        'LACK_OF_THERAPEUTIC_EFFICACY',
        'SUSPECTED_COUNTERFEIT'
    )),
    description TEXT NOT NULL,
    sample_available_for_pickup INTEGER NOT NULL DEFAULT 1,
    quarantine_auto_blocked INTEGER NOT NULL DEFAULT 0,
    reporter_type TEXT NOT NULL CHECK(reporter_type IN ('CUSTOMER', 'EMPLOYEE', 'PRESCRIBER')),
    reporter_name TEXT,
    notifier_pharmacist_crf TEXT NOT NULL,
    notivisa_submission_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(notivisa_submission_status IN ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED')),
    notivisa_protocol TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_complaint_protocol ON technical_complaints(protocol_code);
CREATE INDEX IF NOT EXISTS idx_complaint_batch ON technical_complaints(batch_number);
CREATE INDEX IF NOT EXISTS idx_complaint_type ON technical_complaints(complaint_type);
