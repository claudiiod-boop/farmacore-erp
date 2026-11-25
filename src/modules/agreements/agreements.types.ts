export type AgreementInvoiceStatus = 'OPEN' | 'PAID' | 'CANCELLED';

export interface AgreementInvoiceItem {
  id: number;
  invoice_id: number;
  sale_id: number;
  customer_id: number;
  employee_code: string;
  customer_name: string;
  customer_cpf: string;
  sale_date: string;
  sale_amount: number;
  created_at: string;
}

export interface AgreementInvoice {
  id: number;
  invoice_number: string;
  agreement_id: number;
  period_start: string;
  period_end: string;
  due_date: string;
  total_amount: number;
  total_sales_count: number;
  total_employees_count: number;
  status: AgreementInvoiceStatus;
  paid_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  company_name?: string;
  cnpj?: string;
  items?: AgreementInvoiceItem[];
}

export interface PayrollDiscountRow {
  employee_code: string;
  customer_name: string;
  customer_cpf: string;
  sales_count: number;
  total_discount_amount: number;
}

export interface PayrollExportResult {
  exportId: string;
  invoiceId: number;
  companyName: string;
  cnpj: string;
  period: string;
  totalEmployees: number;
  totalAmount: number;
  csvContent: string;
  rows: PayrollDiscountRow[];
}

export interface AgreementBillingKpis {
  total_agreements_active: number;
  open_invoices_count: number;
  total_open_amount: number;
  paid_invoices_month_count: number;
  total_paid_month_amount: number;
  active_employees_count: number;
}
