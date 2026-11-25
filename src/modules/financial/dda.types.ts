export type DdaInvoiceStatus =
  | 'PENDING'
  | 'MATCHED'
  | 'MISMATCH_VALUE'
  | 'UNMATCHED'
  | 'PAID'
  | 'CANCELLED';

export interface DdaInvoice {
  id: string;
  store_id: string;
  bank_code: string;
  bank_name: string;
  barcode: string;
  digitable_line: string;
  beneficiary_cnpj: string;
  beneficiary_name: string;
  payer_cnpj: string;
  due_date: string;
  issue_date: string;
  nominal_amount: number;
  discount_amount: number;
  interest_amount: number;
  final_amount: number;
  status: DdaInvoiceStatus;
  matched_purchase_invoice_id?: number | null;
  matched_expense_id?: string | null;
  reconciled_at?: string | null;
  reconciled_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportDdaInvoiceInput {
  bank_code: string;
  bank_name: string;
  barcode: string;
  digitable_line: string;
  beneficiary_cnpj: string;
  beneficiary_name: string;
  payer_cnpj: string;
  due_date: string;
  issue_date: string;
  nominal_amount: number;
  discount_amount?: number;
  interest_amount?: number;
  final_amount?: number;
}

export interface DdaReconciliationResult {
  totalProcessed: number;
  matchedCount: number;
  mismatchValueCount: number;
  unmatchedCount: number;
  invoices: Array<{
    id: string;
    beneficiary_name: string;
    final_amount: number;
    status: DdaInvoiceStatus;
    matched_purchase_invoice_id?: number | null;
    matched_expense_id?: string | null;
    discrepancyNote?: string;
  }>;
}

export interface DdaKpis {
  total_invoices: number;
  pending_invoices: number;
  matched_invoices: number;
  paid_invoices: number;
  unmatched_invoices: number;
  total_amount_pending: number;
  total_amount_matched: number;
  reconciliation_rate_percent: number;
}
