export type ReturnType = 'RETURN' | 'EXCHANGE';
export type RefundMethod = 'STORE_CREDIT' | 'CASH_REFUND' | 'CARD_REVERSAL' | 'EXCHANGE';
export type ReturnStatus = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
export type ItemCondition = 'INTACT' | 'DEFECTIVE' | 'EXPIRED' | 'UNSEALED';
export type ItemDestination = 'RETURN_TO_STOCK' | 'QUARANTINE' | 'DISPOSAL_PGRSS';
export type StoreCreditStatus = 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'CANCELLED';

export interface CustomerReturnItem {
  id: number;
  return_id: number;
  sale_item_id?: number | null;
  product_id: number;
  batch_id?: number | null;
  product_name?: string;
  ean?: string;
  batch_number?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  condition: ItemCondition;
  destination: ItemDestination;
  is_thermolabile: boolean;
  requires_pharmacist_auth: boolean;
  reason?: string | null;
  created_at: string;
}

export interface CustomerReturn {
  id: number;
  store_id: number;
  sale_id: number;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_cpf?: string | null;
  code: string;
  return_type: ReturnType;
  refund_method: RefundMethod;
  total_amount: number;
  reason: string;
  notes?: string | null;
  status: ReturnStatus;
  fiscal_nfe_key?: string | null;
  cfop: string;
  created_by: string;
  authorized_by_pharmacist?: string | null;
  created_at: string;
  updated_at: string;
  items?: CustomerReturnItem[];
  store_credit?: StoreCredit | null;
}

export interface StoreCredit {
  id: number;
  store_id: number;
  customer_id: number;
  return_id?: number | null;
  code: string;
  initial_balance: number;
  current_balance: number;
  status: StoreCreditStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReturnItemInput {
  saleItemId?: number;
  productId: number;
  batchId?: number;
  quantity: number;
  unitPrice?: number;
  condition: ItemCondition;
  destination: ItemDestination;
  reason?: string;
}

export interface CreateReturnInput {
  storeId: number;
  saleId: number;
  customerId?: number;
  returnType: ReturnType;
  refundMethod: RefundMethod;
  reason: string;
  notes?: string;
  createdBy: string;
  pharmacistCrf?: string;
  items: CreateReturnItemInput[];
}

export interface ApproveReturnInput {
  returnId: number;
  authorizedByPharmacist?: string;
  fiscalNfeKey?: string;
}

export interface FiscalReturnSummary {
  originalNfceKey?: string;
  returnNfeKey: string;
  cfop: string;
  natureOfOperation: string;
  totalReturnAmount: number;
  icmsReversal: number;
  pisReversal: number;
  cofinsReversal: number;
  items: Array<{
    productId: number;
    cfop: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    icmsBase: number;
    icmsAmount: number;
  }>;
}

export interface ReturnKpis {
  total_returns_month: number;
  total_amount_returned_month: number;
  active_store_credits_balance: number;
  quarantined_items_count: number;
  disposal_pgrss_items_count: number;
}
