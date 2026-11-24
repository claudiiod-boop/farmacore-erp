-- Migration 034: Setorização Física & Ronda Térmica Multissetorial (RDC 44/2009 e RDC 430/2020 ANVISA)

-- 1. Colunas adicionais em temperature_sensors para setorização física detalhada
ALTER TABLE temperature_sensors ADD COLUMN sector_code TEXT DEFAULT 'HALL_MEDICAMENTOS';
ALTER TABLE temperature_sensors ADD COLUMN floor_location TEXT DEFAULT 'TÉRREO';

-- 2. Tabela de Rondas Sanitárias Diárias (Checklist de aferição matutina/vespertina/noturna)
CREATE TABLE IF NOT EXISTS temperature_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    shift TEXT NOT NULL CHECK(shift IN ('MORNING', 'AFTERNOON', 'NIGHT', 'SPECIAL')),
    conducted_by TEXT NOT NULL,
    readings_count INTEGER NOT NULL DEFAULT 0,
    excursions_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK(status IN ('COMPLETED', 'EXCURSION_DETECTED')),
    notes TEXT,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Associação da leitura com a ronda executada
ALTER TABLE temperature_readings ADD COLUMN round_id INTEGER REFERENCES temperature_rounds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_temp_sensors_sector ON temperature_sensors(store_id, sector_code);
CREATE INDEX IF NOT EXISTS idx_temp_rounds_store ON temperature_rounds(store_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_temp_readings_round ON temperature_readings(round_id);
