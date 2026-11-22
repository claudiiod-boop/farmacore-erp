-- Migration 014: Contratos de Adquirentes, Taxas MDR e Conciliação de Cartões/TEF

-- 1. Contratos de Adquirentes Cadastradas
CREATE TABLE IF NOT EXISTS acquirer_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  acquirer_name TEXT NOT NULL, -- Ex: CIELO, REDE, STONE, PAGBANK, GETNET
  acquirer_cnpj TEXT NOT NULL,
  merchant_code TEXT, -- Código do estabelecimento na adquirente
  default_bank_name TEXT NOT NULL,
  default_bank_agency TEXT NOT NULL,
  default_bank_account TEXT NOT NULL,
  debit_settlement_days INTEGER NOT NULL DEFAULT 1, -- D+1
  credit_settlement_days INTEGER NOT NULL DEFAULT 30, -- D+30
  pix_settlement_days INTEGER NOT NULL DEFAULT 0, -- D+0 ou D+1
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, acquirer_name)
);

-- 2. Tabela de Regras de Taxas MDR por Adquirente, Bandeira e Modalidade
CREATE TABLE IF NOT EXISTS acquirer_fee_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL REFERENCES acquirer_contracts(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL, -- VISA, MASTERCARD, ELO, HIPERCARD, AMEX, PIX, OUTROS
  operation_type TEXT NOT NULL CHECK (operation_type IN ('DEBIT', 'CREDIT', 'PIX', 'VOUCHER')),
  installment_min INTEGER NOT NULL DEFAULT 1,
  installment_max INTEGER NOT NULL DEFAULT 1,
  mdr_rate REAL NOT NULL CHECK (mdr_rate >= 0.0 AND mdr_rate <= 100.0), -- Percentual acordado (ex: 1.25)
  fixed_fee REAL NOT NULL DEFAULT 0.0 CHECK (fixed_fee >= 0.0), -- Custo fixo por transação
  settlement_days INTEGER, -- Sobrescreve prazo padrão se preenchido
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contract_id, brand_name, operation_type, installment_min, installment_max)
);

-- 3. Lotes de Importação de Extratos de Adquirentes (EDI / Conciliação)
CREATE TABLE IF NOT EXISTS card_reconciliation_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  acquirer_contract_id INTEGER REFERENCES acquirer_contracts(id) ON DELETE SET NULL,
  batch_code TEXT NOT NULL UNIQUE, -- CONC-YYYYMM-XXXX
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('EDI_CONCIL', 'EXTRATO_CSV', 'API_ONLINE')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  total_gross_amount REAL NOT NULL DEFAULT 0.0,
  total_net_amount REAL NOT NULL DEFAULT 0.0,
  total_fee_amount REAL NOT NULL DEFAULT 0.0,
  conciliated_count INTEGER NOT NULL DEFAULT 0,
  divergent_count INTEGER NOT NULL DEFAULT 0,
  chargeback_count INTEGER NOT NULL DEFAULT 0,
  not_found_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PROCESSED' CHECK (status IN ('PROCESSING', 'PROCESSED', 'REVERTED')),
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Itens / Lançamentos do Extrato e Auditoria de Batimento
CREATE TABLE IF NOT EXISTS card_settlement_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES card_reconciliation_batches(id) ON DELETE CASCADE,
  tef_transaction_id INTEGER REFERENCES tef_transactions(id) ON DELETE SET NULL,
  nsu TEXT NOT NULL,
  authorization_code TEXT,
  transaction_date TEXT NOT NULL,
  settlement_date TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  installment_number INTEGER NOT NULL DEFAULT 1,
  total_installments INTEGER NOT NULL DEFAULT 1,
  gross_amount REAL NOT NULL,
  charged_mdr_rate REAL NOT NULL,
  charged_fee_amount REAL NOT NULL,
  net_amount REAL NOT NULL,
  contract_mdr_rate REAL,
  expected_fee_amount REAL,
  expected_net_amount REAL,
  divergence_amount REAL NOT NULL DEFAULT 0.0, -- charged_fee - expected_fee
  reconciliation_status TEXT NOT NULL CHECK (reconciliation_status IN (
    'CONCILIATED',
    'DIVERGENT_FEE',
    'CHARGEBACK',
    'NOT_FOUND_IN_ERP',
    'CANCELLED'
  )),
  bank_account TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_acquirer_contracts_store ON acquirer_contracts(store_id, acquirer_name);
CREATE INDEX IF NOT EXISTS idx_acquirer_fee_rules_lookup ON acquirer_fee_rules(contract_id, brand_name, operation_type);
CREATE INDEX IF NOT EXISTS idx_card_settlement_nsu ON card_settlement_entries(nsu, authorization_code);
CREATE INDEX IF NOT EXISTS idx_card_settlement_status ON card_settlement_entries(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_card_settlement_date ON card_settlement_entries(settlement_date);
