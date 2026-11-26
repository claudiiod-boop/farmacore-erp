-- Migration 050: Gestão de Assistência Farmacêutica Integral (Lei 13.021/2014) & Livro Eletrônico de Ocorrências do Farmacêutico RT (CRF/CFF)

CREATE TABLE IF NOT EXISTS pharmaceutical_staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    crf_number TEXT NOT NULL,
    crf_uf TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('RT_TITULAR', 'RT_SUBSTITUTO', 'FARMACEUTICO_ASSISTENTE')),
    phone TEXT,
    email TEXT,
    crt_certificate_number TEXT,
    crt_validity_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE INDEX IF NOT EXISTS idx_pharm_staff_store ON pharmaceutical_staff(store_id);
CREATE INDEX IF NOT EXISTS idx_pharm_staff_cpf ON pharmaceutical_staff(cpf);

CREATE TABLE IF NOT EXISTS pharmaceutical_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (staff_id) REFERENCES pharmaceutical_staff(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pharm_shifts_staff ON pharmaceutical_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_pharm_shifts_store ON pharmaceutical_shifts(store_id);

CREATE TABLE IF NOT EXISTS pharmaceutical_logbook_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('INSPECTION_CRF', 'INSPECTION_VISA', 'TEMPERATURE_EXCURSION', 'RECALL_ALERT', 'TECHNICAL_COMPLAINT', 'DISPENSATION_INCIDENT', 'GENERAL_OCCURRENCE')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    crf_inspector_name TEXT,
    crf_inspection_term_number TEXT,
    action_taken TEXT,
    entry_date TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (staff_id) REFERENCES pharmaceutical_staff(id)
);

CREATE INDEX IF NOT EXISTS idx_pharm_logbook_store ON pharmaceutical_logbook_entries(store_id);
CREATE INDEX IF NOT EXISTS idx_pharm_logbook_staff ON pharmaceutical_logbook_entries(staff_id);
CREATE INDEX IF NOT EXISTS idx_pharm_logbook_date ON pharmaceutical_logbook_entries(entry_date);
