// FarmaCore ERP — Tipos de Domínio de Convênios Corporativos e Crediário Próprio (Fase 11)

export type CustomerStatus = 'ACTIVE' | 'BLOCKED_OVERDUE' | 'INACTIVE';
export type DependentRelationship = 'CONJUGE' | 'FILHO(A)' | 'PAI/MAE' | 'OUTRO';
export type ReceivableStatus = 'OPEN' | 'PAID' | 'CANCELLED' | 'RENEGOTIATED';
export type AgreementInvoiceStatus = 'OPEN' | 'PAID' | 'CANCELLED';

// -------------------------------------------------------------
// 1. Convênios Corporativos (corporate_agreements)
// -------------------------------------------------------------

export interface CorporateAgreement {
  id: number;
  code: string;
  companyName: string;
  tradeName: string;
  cnpj: string;
  ie?: string | null;
  phone?: string | null;
  email?: string | null;
  contactName?: string | null;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  closingDay: number;
  dueDay: number;
  creditLimit: number;
  discountPercent: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;

  // DB compatibility aliases
  company_name?: string;
  trade_name?: string;
  contact_name?: string;
  zip_code?: string;
  closing_day?: number;
  due_day?: number;
  credit_limit?: number;
  discount_percent?: number;
  is_active?: number | boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateAgreementInput {
  code: string;
  companyName: string;
  tradeName: string;
  cnpj: string;
  ie?: string | null;
  phone?: string | null;
  email?: string | null;
  contactName?: string | null;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  closingDay?: number;
  dueDay?: number;
  creditLimit?: number;
  discountPercent?: number;
  isActive?: boolean;

  // DB compatibility aliases
  company_name?: string;
  trade_name?: string;
  contact_name?: string;
  zip_code?: string;
  closing_day?: number;
  due_day?: number;
  credit_limit?: number;
  discount_percent?: number;
  is_active?: number | boolean;
}

export interface UpdateAgreementInput {
  code?: string;
  companyName?: string;
  tradeName?: string;
  cnpj?: string;
  ie?: string | null;
  phone?: string | null;
  email?: string | null;
  contactName?: string | null;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  closingDay?: number;
  dueDay?: number;
  creditLimit?: number;
  discountPercent?: number;
  isActive?: boolean;

  // DB compatibility aliases
  company_name?: string;
  trade_name?: string;
  contact_name?: string;
  zip_code?: string;
  closing_day?: number;
  due_day?: number;
  credit_limit?: number;
  discount_percent?: number;
  is_active?: number | boolean;
}

// -------------------------------------------------------------
// 2. Clientes e Dependentes (customers & customer_dependents)
// -------------------------------------------------------------

export interface Customer {
  id: number;
  storeId: number;
  agreementId?: number | null;
  name: string;
  cpf: string;
  rg?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  registrationNumber?: string | null;
  department?: string | null;
  creditLimit: number;
  currentDebt: number;
  status: CustomerStatus;
  allowDependents: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;

  // DB compatibility aliases
  store_id?: number;
  agreement_id?: number | null;
  birth_date?: string | null;
  zip_code?: string | null;
  registration_number?: string | null;
  credit_limit?: number;
  current_debt?: number;
  allow_dependents?: number | boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCustomerInput {
  storeId?: number;
  agreementId?: number | null;
  name: string;
  cpf: string;
  rg?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  registrationNumber?: string | null;
  department?: string | null;
  creditLimit?: number;
  currentDebt?: number;
  status?: CustomerStatus;
  allowDependents?: boolean;
  notes?: string | null;

  // DB compatibility aliases
  store_id?: number;
  agreement_id?: number | null;
  birth_date?: string | null;
  zip_code?: string | null;
  registration_number?: string | null;
  credit_limit?: number;
  current_debt?: number;
  allow_dependents?: number | boolean;
}

export interface UpdateCustomerInput {
  storeId?: number;
  agreementId?: number | null;
  name?: string;
  cpf?: string;
  rg?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  registrationNumber?: string | null;
  department?: string | null;
  creditLimit?: number;
  currentDebt?: number;
  status?: CustomerStatus;
  allowDependents?: boolean;
  notes?: string | null;

  // DB compatibility aliases
  store_id?: number;
  agreement_id?: number | null;
  birth_date?: string | null;
  zip_code?: string | null;
  registration_number?: string | null;
  credit_limit?: number;
  current_debt?: number;
  allow_dependents?: number | boolean;
}

export interface CustomerDependent {
  id: number;
  customerId: number;
  name: string;
  cpf: string;
  relationship: DependentRelationship;
  isActive: boolean;
  createdAt?: string;

  // DB compatibility aliases
  customer_id?: number;
  is_active?: number | boolean;
  created_at?: string;
}

export interface CreateDependentInput {
  customerId?: number;
  name: string;
  cpf: string;
  relationship?: DependentRelationship;
  isActive?: boolean;

  // DB compatibility aliases
  customer_id?: number;
  is_active?: number | boolean;
}

export interface CustomerWithDependents extends Customer {
  dependents: CustomerDependent[];
  agreement?: CorporateAgreement | null;
}

export interface CustomerFilters {
  search?: string;
  agreementId?: number;
  status?: CustomerStatus;
  storeId?: number;
  page?: number;
  limit?: number;
}

export interface CreditEligibilityResult {
  isEligible: boolean;
  customer: Customer;
  availableLimit: number;
  reason?: string;
  errorCode?: string;
}

// -------------------------------------------------------------
// 3. Faturas de Convênio (agreement_invoices)
// -------------------------------------------------------------

export interface AgreementInvoice {
  id: number;
  invoiceNumber: string;
  agreementId: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  totalAmount: number;
  totalSalesCount: number;
  totalEmployeesCount: number;
  status: AgreementInvoiceStatus;
  paidAt?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;

  // DB compatibility aliases
  invoice_number?: string;
  agreement_id?: number;
  period_start?: string;
  period_end?: string;
  due_date?: string;
  total_amount?: number;
  total_sales_count?: number;
  total_employees_count?: number;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GenerateInvoiceParams {
  startDate: string;
  endDate: string;
  dueDate: string;
  notes?: string;
}

export interface EmployeePayrollItem {
  customerId: number;
  customerName: string;
  cpf: string;
  registrationNumber?: string | null;
  department?: string | null;
  salesCount: number;
  totalAmount: number;
  receivables: CustomerReceivable[];
}

export interface AgreementInvoiceWithDetails extends AgreementInvoice {
  agreement: CorporateAgreement;
  items: EmployeePayrollItem[];
}

// -------------------------------------------------------------
// 4. Contas a Receber / Crediário (customer_receivables)
// -------------------------------------------------------------

export interface CustomerReceivable {
  id: number;
  customerId: number;
  saleId?: number | null;
  agreementId?: number | null;
  invoiceId?: number | null;
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string;
  originalAmount: number;
  paidAmount: number;
  discountAmount: number;
  interestAmount: number;
  status: ReceivableStatus;
  paidAt?: string | null;
  cashSessionId?: number | null;
  paymentMethod?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;

  // DB compatibility aliases
  customer_id?: number;
  sale_id?: number | null;
  agreement_id?: number | null;
  invoice_id?: number | null;
  installment_number?: number;
  total_installments?: number;
  due_date?: string;
  original_amount?: number;
  paid_amount?: number;
  discount_amount?: number;
  interest_amount?: number;
  paid_at?: string | null;
  cash_session_id?: number | null;
  payment_method?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateReceivableInput {
  customerId: number;
  saleId?: number | null;
  agreementId?: number | null;
  invoiceId?: number | null;
  installmentNumber?: number;
  totalInstallments?: number;
  dueDate: string;
  originalAmount: number;
  paidAmount?: number;
  discountAmount?: number;
  interestAmount?: number;
  status?: ReceivableStatus;
  paidAt?: string | null;
  cashSessionId?: number | null;
  paymentMethod?: string | null;
  notes?: string | null;

  // DB compatibility aliases
  customer_id?: number;
  sale_id?: number | null;
  agreement_id?: number | null;
  invoice_id?: number | null;
  installment_number?: number;
  total_installments?: number;
  due_date?: string;
  original_amount?: number;
  paid_amount?: number;
  discount_amount?: number;
  interest_amount?: number;
  paid_at?: string | null;
  cash_session_id?: number | null;
  payment_method?: string | null;
}

export interface ReceivePaymentParams {
  receivableIds: number[];
  cashSessionId?: number | null;
  paymentMethod: string;
  notes?: string;
  operatorName?: string;
}

export interface PaymentReceiptResult {
  paidReceivables: CustomerReceivable[];
  totalPaid: number;
  remainingDebt: number;
  availableLimit: number;
  customer: Customer;
  receiptText: string;
  escposPayload?: string;
}
