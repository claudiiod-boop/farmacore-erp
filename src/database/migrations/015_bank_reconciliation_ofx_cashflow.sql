-- Migration 015: Conciliação Bancária OFX, Extratos Multi-Banco e Fluxo de Caixa

-- 1. Contas Bancárias da Farmácia por Filial
CREATE TABLE IF NOT EXISTS bank_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  bank_code TEXT NOT NULL,          -- Código COMPE (001=BB, 237=Bradesco, 341=Itaú, 033=Santander, 104=Caixa, 756=Sicoob, 748=Sicredi, 077=Inter)
  bank_name TEXT NOT NULL,
  agency_number TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'CHECKING' CHECK (account_type IN ('CHECKING', 'SAVINGS', 'PAYMENT')),
  initial_balance REAL NOT NULL DEFAULT 0.0,
  current_balance REAL NOT NULL DEFAULT 0.0,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, bank_code, agency_number, account_number)
);

-- 2. Lotes de Extratos Bancários Importados (OFX / EDI)
CREATE TABLE IF NOT EXISTS bank_statement_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  batch_code TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  ledger_balance REAL NOT NULL DEFAULT 0.0,
  total_entries INTEGER NOT NULL DEFAULT 0,
  matched_entries INTEGER NOT NULL DEFAULT 0,
  unmatched_entries INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Entradas Individuais do Extrato Bancário
CREATE TABLE IF NOT EXISTS bank_statement_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES bank_statement_batches(id) ON DELETE CASCADE,
  bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  fitid TEXT NOT NULL,              -- Identificador único oficial do banco (Financial Transaction ID)
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('CREDIT', 'DEBIT', 'OTHER')),
  posted_date TEXT NOT NULL,        -- Data do lançamento (YYYY-MM-DD ou YYYY-MM-DD HH:MM:SS)
  amount REAL NOT NULL,             -- Positivo para crédito, negativo para débito
  document_number TEXT,
  memo TEXT NOT NULL,               -- Descrição bancária (ex: "DEP DINHEIRO", "LIQ CIELO", "TED 341.0057")
  reconciliation_status TEXT NOT NULL DEFAULT 'UNMATCHED' CHECK (reconciliation_status IN (
    'MATCHED',
    'UNMATCHED',
    'MANUAL_MATCH',
    'BANK_FEE',
    'IGNORED'
  )),
  reconciliation_type TEXT CHECK (reconciliation_type IN (
    'TEF_SETTLEMENT',
    'CASH_DRAWER',
    'PURCHASE_PAYMENT',
    'CUSTOMER_CREDIT',
    'MANUAL',
    'BANK_FEE'
  )),
  matched_entity_id INTEGER,        -- ID da entidade associada (ex: card_settlement_entries.id, cash_movements.id, etc.)
  matched_notes TEXT,
  reconciled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bank_account_id, fitid)
);

-- 4. Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_bank_accounts_store ON bank_accounts(store_id, bank_code);
CREATE INDEX IF NOT EXISTS idx_bank_statement_entries_fitid ON bank_statement_entries(bank_account_id, fitid);
CREATE INDEX IF NOT EXISTS idx_bank_statement_entries_date ON bank_statement_entries(posted_date);
CREATE INDEX IF NOT EXISTS idx_bank_statement_entries_status ON bank_statement_entries(reconciliation_status);
