-- Migration 006: TEF Card Gateway & Adquirer Integration

-- 1. Configurações dos Provedores TEF
CREATE TABLE IF NOT EXISTS tef_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT UNIQUE NOT NULL, -- 'SITEF', 'PAYGO', 'MOCK'
  provider_name TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'MOCK' CHECK (environment IN ('PRODUCAO', 'HOMOLOGACAO', 'MOCK')),
  terminal_id TEXT DEFAULT 'SE000001', -- Código padrão do PinPad
  merchant_id TEXT, -- Código do estabelecimento na adquirente
  ip_address TEXT DEFAULT '127.0.0.1',  -- IP do servidor TEF Dedicado
  port INTEGER DEFAULT 4096,     -- Porta (ex: 4096 para SiTef)
  is_active INTEGER NOT NULL DEFAULT 1,
  credentials_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Transações de Cartão TEF
CREATE TABLE IF NOT EXISTS tef_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_uuid TEXT UNIQUE NOT NULL,
  provider_id TEXT NOT NULL REFERENCES tef_configs(provider_id),
  terminal_id TEXT NOT NULL DEFAULT 'SE000001',
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  payment_id INTEGER REFERENCES sale_payments(id) ON DELETE SET NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('DEBITO', 'CREDITO', 'VOUCHER', 'PIX_TEF')),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'AUTHORIZED', 'CONFIRMED', 'REVERSED', 'CANCELLED', 'FAILED')),
  amount REAL NOT NULL CHECK (amount > 0),
  installments INTEGER NOT NULL DEFAULT 1,
  installment_type TEXT DEFAULT 'A_VISTA' CHECK (installment_type IN ('A_VISTA', 'PARCELADO_LOJA', 'PARCELADO_ADM')),
  brand_name TEXT NOT NULL,          -- 'VISA', 'MASTERCARD', 'ELO', 'AMEX', 'ALELO', etc.
  brand_code_sefaz TEXT NOT NULL,    -- '01' (Visa), '02' (Master), '06' (Elo), etc.
  acquirer_name TEXT NOT NULL,       -- 'CIELO', 'REDE', 'STONE', 'PAGBANK', etc.
  acquirer_cnpj TEXT NOT NULL,       -- 14 dígitos sem máscara para tag <CNPJ> da NFC-e
  authorization_code TEXT NOT NULL,  -- Código de autorização retornado pela rede
  nsu TEXT NOT NULL,                 -- Número Sequencial Único gerado pelo TEF local
  host_nsu TEXT NOT NULL,            -- NSU da rede adquirente/banco
  card_last_four TEXT,               -- '1234' (apenas 4 dígitos finais)
  customer_receipt TEXT,             -- Texto formatado da Via do Cliente
  merchant_receipt TEXT,             -- Texto formatado da Via da Loja
  cancellation_receipt TEXT,         -- Texto formatado do comprovante de cancelamento/estorno
  failure_reason TEXT,
  reversal_reason TEXT,              -- Justificativa do desfazimento técnico
  cancellation_nsu TEXT,             -- NSU do cancelamento administrativo
  cancellation_reason TEXT,
  mdr_rate REAL DEFAULT 0.0,         -- Taxa da adquirente em % para conciliação financeira
  net_amount REAL,                   -- Valor líquido estimado a receber
  expected_settlement_date TEXT,     -- Data prevista de repasse bancário (YYYY-MM-DD)
  batch_number TEXT,                 -- Lote do TEF para conciliação bancária
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT,
  reversed_at TEXT,
  cancelled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tef_trans_nsu ON tef_transactions(nsu);
CREATE INDEX IF NOT EXISTS idx_tef_trans_uuid ON tef_transactions(transaction_uuid);
CREATE INDEX IF NOT EXISTS idx_tef_trans_sale ON tef_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_tef_trans_status ON tef_transactions(status);
CREATE INDEX IF NOT EXISTS idx_tef_trans_created ON tef_transactions(created_at);

-- 3. Extensão de sale_payments para vínculo direto com TEF
ALTER TABLE sale_payments ADD COLUMN tef_transaction_id INTEGER REFERENCES tef_transactions(id);
ALTER TABLE sale_payments ADD COLUMN tef_nsu TEXT;
