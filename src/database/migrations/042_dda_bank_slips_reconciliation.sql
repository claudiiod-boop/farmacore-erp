-- Migration 042: Conciliação Automática de Boletos Bancários & Débito Direto Autorizado (DDA)

CREATE TABLE IF NOT EXISTS dda_invoices (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  barcode TEXT NOT NULL,
  digitable_line TEXT NOT NULL,
  beneficiary_cnpj TEXT NOT NULL,
  beneficiary_name TEXT NOT NULL,
  payer_cnpj TEXT NOT NULL,
  due_date TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  nominal_amount REAL NOT NULL,
  discount_amount REAL NOT NULL DEFAULT 0.0,
  interest_amount REAL NOT NULL DEFAULT 0.0,
  final_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'MATCHED', 'MISMATCH_VALUE', 'UNMATCHED', 'PAID', 'CANCELLED')),
  matched_purchase_invoice_id INTEGER REFERENCES purchase_invoices(id),
  matched_expense_id TEXT REFERENCES operational_expenses(id),
  reconciled_at TEXT,
  reconciled_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dda_invoices_store ON dda_invoices(store_id);
CREATE INDEX IF NOT EXISTS idx_dda_invoices_status ON dda_invoices(status);
CREATE INDEX IF NOT EXISTS idx_dda_invoices_due_date ON dda_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_dda_invoices_beneficiary ON dda_invoices(beneficiary_cnpj);
CREATE INDEX IF NOT EXISTS idx_dda_invoices_barcode ON dda_invoices(barcode);
