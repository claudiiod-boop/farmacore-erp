-- Migration 017: Consultório Farmacêutico & Serviços Clínicos Avançados (RDC 777/2023 & RDC 44/2009)

CREATE TABLE IF NOT EXISTS clinical_pharmacists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  crf_number TEXT NOT NULL,
  crf_uf TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(crf_number, crf_uf)
);

CREATE TABLE IF NOT EXISTS clinical_services_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('TLR', 'PROCEDURE', 'ASSESSMENT', 'PRESCRIPTION')),
  price REAL NOT NULL DEFAULT 0.0,
  description TEXT,
  reference_values_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, code)
);

CREATE TABLE IF NOT EXISTS clinical_attendances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attendance_code TEXT UNIQUE NOT NULL,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  pharmacist_id INTEGER NOT NULL REFERENCES clinical_pharmacists(id),
  patient_name TEXT NOT NULL,
  patient_cpf TEXT,
  patient_birth_date TEXT,
  patient_gender TEXT,
  patient_phone TEXT,
  patient_address TEXT,
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  heart_rate INTEGER,
  temperature REAL,
  oxygen_saturation REAL,
  anamnesis_notes TEXT,
  allergies TEXT,
  continuous_medications TEXT,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  dsf_number TEXT UNIQUE,
  total_amount REAL NOT NULL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS clinical_procedures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attendance_id INTEGER NOT NULL REFERENCES clinical_attendances(id) ON DELETE CASCADE,
  service_catalog_id INTEGER REFERENCES clinical_services_catalog(id),
  procedure_type TEXT NOT NULL CHECK (procedure_type IN ('INJECTABLE', 'BP_MEASUREMENT', 'TEMPERATURE', 'INHALATION', 'EAR_PIERCING')),
  medication_name TEXT,
  medication_batch TEXT,
  application_site TEXT CHECK (application_site IS NULL OR application_site IN ('DELTOIDE_D', 'DELTOIDE_E', 'GLUTEUS_D', 'GLUTEUS_E', 'VASTO_LATERAL')),
  prescriber_name TEXT,
  prescriber_crm TEXT,
  details_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clinical_rapid_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attendance_id INTEGER NOT NULL REFERENCES clinical_attendances(id) ON DELETE CASCADE,
  service_catalog_id INTEGER REFERENCES clinical_services_catalog(id),
  test_type TEXT NOT NULL CHECK (test_type IN ('GLUCOSE', 'HBA1C', 'CHOLESTEROL', 'COVID19', 'DENGUE', 'BETA_HCG')),
  reagent_name TEXT NOT NULL,
  reagent_batch TEXT NOT NULL,
  reagent_expiration TEXT NOT NULL,
  reagent_ms_registration TEXT NOT NULL,
  result_value TEXT NOT NULL,
  result_interpretation TEXT NOT NULL CHECK (result_interpretation IN ('REAGENTE', 'NAO_REAGENTE', 'INDETERMINADO', 'NORMAL', 'ALTERADO', 'CRITICO')),
  reference_range TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pharmacovigilance_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  pharmacist_id INTEGER NOT NULL REFERENCES clinical_pharmacists(id),
  attendance_id INTEGER REFERENCES clinical_attendances(id),
  patient_name TEXT NOT NULL,
  patient_cpf TEXT,
  suspected_medication TEXT NOT NULL,
  manufacturer TEXT,
  batch_number TEXT,
  adverse_reaction_description TEXT NOT NULL,
  reaction_date TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LEVE', 'MODERADA', 'GRAVE', 'FATAL')),
  notivisa_notification_number TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_NOTIVISA' CHECK (status IN ('PENDING_NOTIVISA', 'REPORTED')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendances_store_patient ON clinical_attendances(store_id, patient_name);
CREATE INDEX IF NOT EXISTS idx_attendances_status ON clinical_attendances(status);
CREATE INDEX IF NOT EXISTS idx_rapid_tests_type ON clinical_rapid_tests(test_type);
CREATE INDEX IF NOT EXISTS idx_pharmacovigilance_med ON pharmacovigilance_reports(suspected_medication);
