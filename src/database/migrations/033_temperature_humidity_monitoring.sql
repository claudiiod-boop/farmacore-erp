-- Migration 033: Termômetro & Higrômetro Digital — Monitoramento Contínuo de Temperatura e Umidade (RDC 44/2009 e RDC 430/2020 ANVISA)

CREATE TABLE IF NOT EXISTS temperature_sensors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    name TEXT NOT NULL,
    location_type TEXT NOT NULL CHECK(location_type IN ('REFRIGERATOR_COLD_CHAIN', 'SALES_FLOOR', 'STORAGE_ROOM')),
    min_allowed_temp REAL NOT NULL,
    max_allowed_temp REAL NOT NULL,
    min_allowed_humidity REAL NOT NULL DEFAULT 40.0,
    max_allowed_humidity REAL NOT NULL DEFAULT 70.0,
    serial_number TEXT,
    calibration_cert_number TEXT,
    calibration_due_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS temperature_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_id INTEGER NOT NULL REFERENCES temperature_sensors(id) ON DELETE CASCADE,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    temperature REAL NOT NULL,
    humidity REAL,
    max_temp_recorded REAL,
    min_temp_recorded REAL,
    is_excursion INTEGER NOT NULL DEFAULT 0 CHECK(is_excursion IN (0, 1)),
    recorded_by TEXT NOT NULL,
    notes TEXT,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS temperature_excursions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_id INTEGER NOT NULL REFERENCES temperature_sensors(id) ON DELETE CASCADE,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    reading_id INTEGER NOT NULL REFERENCES temperature_readings(id) ON DELETE CASCADE,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    severity TEXT NOT NULL CHECK(severity IN ('CRITICAL', 'MILD')),
    peak_temp REAL NOT NULL,
    min_temp REAL NOT NULL,
    action_taken TEXT,
    pharmacist_crf TEXT,
    quarantine_record_id INTEGER REFERENCES quarantine_records(id),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'RESOLVED')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_temp_sensors_store ON temperature_sensors(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_temp_readings_sensor ON temperature_readings(sensor_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_temp_excursions_store ON temperature_excursions(store_id, status);
