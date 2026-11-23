-- Migration 021: Farmácia Magistral, Manipulação de Fórmulas e Controle de Quarentena (RDC 67/2007)

CREATE TABLE IF NOT EXISTS raw_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dcb TEXT, -- Denominação Comum Brasileira
    cas_number TEXT,
    name TEXT NOT NULL UNIQUE,
    apparent_density REAL NOT NULL DEFAULT 0.60, -- g/mL para cálculo de cubagem
    default_unit TEXT NOT NULL DEFAULT 'mg', -- 'mg', 'g', 'mcg', 'UI', 'mL'
    cost_per_unit DECIMAL(10, 4) NOT NULL DEFAULT 0.05,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS raw_material_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_material_id INTEGER NOT NULL,
    batch_number TEXT NOT NULL,
    supplier TEXT NOT NULL,
    manufacturer TEXT,
    potency_percent REAL NOT NULL DEFAULT 100.0, -- Teor do laudo analítico (%)
    moisture_percent REAL NOT NULL DEFAULT 0.0, -- Umidade do laudo (%)
    molecular_weight_salt REAL, -- Peso molecular da forma salina/hidratada
    molecular_weight_base REAL, -- Peso molecular da base ativa pura
    report_number TEXT NOT NULL, -- Número do Laudo do fornecedor/controle interno
    expiration_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUARANTINE', -- 'QUARANTINE', 'APPROVED', 'REJECTED'
    rejection_reason TEXT,
    released_by TEXT,
    released_at DATETIME,
    current_stock REAL NOT NULL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id)
);

CREATE TABLE IF NOT EXISTS compounding_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    order_number TEXT NOT NULL UNIQUE, -- OM-YYYYMM-XXXX
    patient_name TEXT NOT NULL,
    patient_document TEXT,
    prescriber_name TEXT NOT NULL,
    prescriber_crm TEXT NOT NULL,
    prescriber_uf TEXT NOT NULL DEFAULT 'SP',
    pharmaceutical_form TEXT NOT NULL DEFAULT 'CAPSULA', -- 'CAPSULA', 'XAROPE', 'POMADA', 'GEL', 'LOCAO', 'SOLUCAO'
    total_units INTEGER NOT NULL DEFAULT 30, -- Ex: 30 cápsulas, 100 mL
    capsule_size TEXT, -- '4', '3', '2', '1', '0', '00'
    target_weight_per_unit REAL, -- mg por cápsula teórico
    actual_average_weight REAL, -- mg por cápsula medido no controle de qualidade
    quality_status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    status TEXT NOT NULL DEFAULT 'QUOTATION', -- 'QUOTATION', 'AWAITING_WEIGHING', 'IN_MANIPULATION', 'QUALITY_CONTROL', 'READY', 'DELIVERED', 'CANCELLED'
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    packaging_cost DECIMAL(10, 2) NOT NULL DEFAULT 5.00,
    pharmaceutical_fee DECIMAL(10, 2) NOT NULL DEFAULT 15.00,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 20.00,
    directions TEXT NOT NULL, -- Posologia: 'Tomar 1 cápsula 1x ao dia pela manhã'
    warnings TEXT, -- 'Uso interno', 'Conservar em geladeira', etc.
    pharmacist_responsible TEXT,
    manipulated_at DATETIME,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compounding_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    raw_material_id INTEGER NOT NULL,
    batch_id INTEGER,
    prescribed_dose REAL NOT NULL, -- dose por unidade (ex: 500)
    unit TEXT NOT NULL DEFAULT 'mg',
    factor_correction REAL NOT NULL DEFAULT 1.0, -- FC baseado no teor e umidade
    factor_equivalence REAL NOT NULL DEFAULT 1.0, -- FEq sal/base
    corrected_dose_per_unit REAL NOT NULL, -- dose corrigida por unidade (mg)
    total_dose_to_weigh REAL NOT NULL, -- dose corrigida * total_units (g ou mg)
    weighed_amount REAL, -- quantidade efetivamente pesada na balança
    weighed_by TEXT,
    weighed_at DATETIME,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'WEIGHED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES compounding_orders(id),
    FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id),
    FOREIGN KEY (batch_id) REFERENCES raw_material_batches(id)
);

CREATE INDEX IF NOT EXISTS idx_compounding_orders_num ON compounding_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_raw_material_batches_status ON raw_material_batches(status);
