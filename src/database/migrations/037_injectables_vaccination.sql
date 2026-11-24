-- Migration 037: Livro Oficial de Injetáveis & Sala de Vacinas (RDC 197/2017 & RDC 44/2009 ANVISA)

-- 1. Livro Oficial de Administração de Medicamentos Injetáveis (RDC 44/2009)
CREATE TABLE IF NOT EXISTS injectable_administration_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER REFERENCES stores(id),
    patient_name TEXT NOT NULL,
    patient_cpf TEXT NOT NULL,
    patient_birth_date TEXT,
    patient_phone TEXT,
    medication_name TEXT NOT NULL,
    medication_dosage TEXT NOT NULL,
    medication_batch TEXT NOT NULL,
    medication_expiration_date TEXT NOT NULL,
    syringe_needle_batch TEXT NOT NULL,
    administration_route TEXT NOT NULL CHECK(administration_route IN ('INTRAMUSCULAR', 'INTRAVENOSA', 'SUBCUTANEA', 'INTRADERMICA')),
    anatomical_site TEXT NOT NULL,
    prescriber_name TEXT NOT NULL,
    prescriber_crm TEXT NOT NULL,
    prescriber_uf TEXT NOT NULL,
    pharmacist_name TEXT NOT NULL,
    pharmacist_crf TEXT NOT NULL,
    declaration_number TEXT NOT NULL UNIQUE,
    adverse_reaction_observed INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    administered_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_injectables_patient_cpf ON injectable_administration_logs(patient_cpf);
CREATE INDEX IF NOT EXISTS idx_injectables_date ON injectable_administration_logs(administered_at);
CREATE INDEX IF NOT EXISTS idx_injectables_declaration ON injectable_administration_logs(declaration_number);

-- 2. Sala de Vacinas & Registro Imunobiológico SI-PNI (RDC 197/2017)
CREATE TABLE IF NOT EXISTS vaccination_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER REFERENCES stores(id),
    patient_name TEXT NOT NULL,
    patient_cpf TEXT NOT NULL,
    patient_birth_date TEXT NOT NULL,
    patient_phone TEXT,
    vaccine_name TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    vaccine_batch TEXT NOT NULL,
    diluent_batch TEXT,
    vaccine_expiration_date TEXT NOT NULL,
    dose_type TEXT NOT NULL CHECK(dose_type IN ('DOSE_1', 'DOSE_2', 'DOSE_3', 'REFRACTORY_BOOSTER', 'SINGLE_DOSE')),
    administration_route TEXT NOT NULL DEFAULT 'INTRAMUSCULAR',
    anatomical_site TEXT NOT NULL,
    pre_triage_fever INTEGER NOT NULL DEFAULT 0,
    pre_triage_allergies TEXT,
    pharmacist_name TEXT NOT NULL,
    pharmacist_crf TEXT NOT NULL,
    certificate_code TEXT NOT NULL UNIQUE,
    sipni_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(sipni_status IN ('PENDING', 'EXPORTED', 'ACCEPTED', 'REJECTED')),
    sipni_exported_at TEXT,
    eapv_adverse_event INTEGER NOT NULL DEFAULT 0,
    eapv_description TEXT,
    administered_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_vaccination_patient_cpf ON vaccination_records(patient_cpf);
CREATE INDEX IF NOT EXISTS idx_vaccination_sipni_status ON vaccination_records(sipni_status);
CREATE INDEX IF NOT EXISTS idx_vaccination_certificate ON vaccination_records(certificate_code);
