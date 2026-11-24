-- ============================================================================
-- Migration 027: Totem de Autoatendimento, Terminal de Preços & Fila
-- FarmaCore ERP - Busca-Preço, Senhas de Balcão e Pré-Venda Express
-- ============================================================================

-- 1. Terminais e Totens de Autoatendimento
CREATE TABLE IF NOT EXISTS kiosk_terminals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  terminal_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  ip_address TEXT,
  mode TEXT NOT NULL DEFAULT 'HYBRID' CHECK (mode IN ('PRICE_CHECKER', 'SELF_PRE_SALE', 'QUEUE_TICKET', 'HYBRID')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed de Totem padrão
INSERT OR IGNORE INTO kiosk_terminals (store_id, terminal_code, name, mode)
VALUES (1, 'TTM-01', 'Totem Entrada Principal', 'HYBRID');

-- 2. Senhas de Atendimento e Fila Inteligente
CREATE TABLE IF NOT EXISTS queue_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  kiosk_id INTEGER REFERENCES kiosk_terminals(id) ON DELETE SET NULL,
  ticket_number TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('NORMAL', 'PREFERENCIAL', 'RAPIDO', 'CONSULTORIO')),
  customer_name TEXT,
  customer_cpf TEXT,
  status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'CALLED', 'ATTENDING', 'COMPLETED', 'CANCELLED')),
  called_at TEXT,
  completed_at TEXT,
  counter_operator TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Telemetria de Consultas de Preço no Totem
CREATE TABLE IF NOT EXISTS kiosk_price_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  kiosk_id INTEGER REFERENCES kiosk_terminals(id) ON DELETE SET NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_cpf TEXT,
  queried_price REAL NOT NULL,
  discount_applied REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_queue_tickets_store_status ON queue_tickets(store_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_tickets_created ON queue_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_kiosk_queries_store_prod ON kiosk_price_queries(store_id, product_id);
