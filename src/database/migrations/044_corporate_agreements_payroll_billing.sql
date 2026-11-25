-- Migration 044: Gestão de Convênios Empresariais & Faturamento em Lote para Empresas (B2B Desconto em Folha)

CREATE TABLE IF NOT EXISTS agreement_invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES agreement_invoices(id) ON DELETE CASCADE,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  employee_code TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_cpf TEXT NOT NULL,
  sale_date TEXT NOT NULL,
  sale_amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agreement_payroll_exports (
  id TEXT PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES agreement_invoices(id) ON DELETE CASCADE,
  agreement_id INTEGER NOT NULL REFERENCES corporate_agreements(id),
  export_date TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_employees INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  file_content_csv TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agr_inv_items_invoice ON agreement_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_agr_inv_items_customer ON agreement_invoice_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_agr_payroll_invoice ON agreement_payroll_exports(invoice_id);
