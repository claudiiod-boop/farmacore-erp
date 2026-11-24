-- Migration 036: Sanitização, Higienização de Ambientes, Dedetização & POPs Regulatórios (RDC 44/2009 ANVISA)

-- 1. Tabela de Registros de Higienização e Sanitização de Ambientes
CREATE TABLE IF NOT EXISTS sanitization_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER REFERENCES stores(id),
    sector_name TEXT NOT NULL,
    cleaning_type TEXT NOT NULL CHECK(cleaning_type IN ('ROUTINE', 'TERMINAL', 'IMMEDIATE')),
    scheduled_date TEXT NOT NULL,
    execution_timestamp TEXT NOT NULL,
    chemical_product TEXT NOT NULL,
    dilution_or_batch TEXT,
    performed_by TEXT NOT NULL,
    verified_by_pharmacist TEXT,
    verified_at TEXT,
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK(status IN ('PENDING', 'COMPLETED', 'NON_CONFORMING')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_sanitization_logs_sector_date ON sanitization_logs(sector_name, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_sanitization_logs_store ON sanitization_logs(store_id);

-- 2. Tabela de Certificados de Controle de Pragas e Vetores (Dedetização / Desratização)
CREATE TABLE IF NOT EXISTS pest_control_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER REFERENCES stores(id),
    service_provider_name TEXT NOT NULL,
    service_provider_cnpj TEXT NOT NULL,
    sanitary_license_number TEXT NOT NULL,
    certificate_number TEXT NOT NULL UNIQUE,
    application_date TEXT NOT NULL,
    expiration_date TEXT NOT NULL,
    target_pests TEXT NOT NULL,
    chemical_agents_used TEXT NOT NULL,
    antidote_information TEXT,
    technical_responsible_pest TEXT NOT NULL,
    pharmacist_approval_crf TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'VALID' CHECK(status IN ('VALID', 'EXPIRING_SOON', 'EXPIRED')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_pest_control_expiration ON pest_control_certificates(expiration_date, status);

-- 3. Tabela de Higienização de Reservatórios de Água (Caixas d'Água)
CREATE TABLE IF NOT EXISTS water_tank_cleaning_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER REFERENCES stores(id),
    service_provider TEXT NOT NULL,
    cleaning_date TEXT NOT NULL,
    expiration_date TEXT NOT NULL,
    potability_report_number TEXT,
    potability_status TEXT NOT NULL DEFAULT 'POTABLE_COMPLIANT' CHECK(potability_status IN ('POTABLE_COMPLIANT', 'NON_POTABLE_CONTAMINATED', 'PENDING_LAB')),
    responsible_cleaner TEXT NOT NULL,
    pharmacist_crf TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'VALID' CHECK(status IN ('VALID', 'EXPIRING_SOON', 'EXPIRED')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_water_tank_expiration ON water_tank_cleaning_logs(expiration_date, status);

-- 4. Tabela de Procedimentos Operacionais Padrão (POPs)
CREATE TABLE IF NOT EXISTS standard_operating_procedures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER REFERENCES stores(id),
    sop_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('HIGIENE_AMBIENTAL', 'SERVICOS_FARMACEUTICOS', 'TERMOLABEIS', 'DESCARTE_RESIDUOS', 'DISPENSACAO', 'GERAL')),
    version TEXT NOT NULL DEFAULT '1.0',
    effective_date TEXT NOT NULL,
    next_review_date TEXT NOT NULL,
    author_name TEXT NOT NULL,
    reviewer_pharmacist_crf TEXT NOT NULL,
    content_summary TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'NEEDS_REVISION', 'ARCHIVED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_sop_code ON standard_operating_procedures(sop_code);
CREATE INDEX IF NOT EXISTS idx_sop_next_review ON standard_operating_procedures(next_review_date, status);
