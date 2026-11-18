import { PrescriptionDetails } from '../counter/types';
import type { NfceCardInput } from '../fiscal/xml-builder';

export type PaymentMethod = 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'PIX' | 'CONVENIO_PBM';

export interface PaymentItem {
  method: PaymentMethod;
  amount: number;
  tefTransactionUuid?: string;
  tefNsu?: string;
  cardFiscalData?: NfceCardInput;
}

export interface CashSession {
  id: number;
  operatorName: string;
  initialCash: number;
  currentCash: number;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
}

export type CashMovementType = 'SANGRIA' | 'SUPPLY';

export interface CashMovement {
  id: number;
  cashSessionId: number;
  type: CashMovementType;
  amount: number;
  reason: string;
  operatorName: string;
  createdAt: string;
}

export interface CashSessionSummary {
  session: CashSession;
  totalSalesCount: number;
  totalSalesAmount: number;
  totalsByMethod: Record<PaymentMethod, number>;
  totalSupplies?: number;
  totalSangrias?: number;
  expectedCash?: number; // initialCash + supplies - sangrias + net cash sales
}

export interface Sale {
  id: number;
  preSaleId: number | null;
  cashSessionId: number | null;
  status: 'COMPLETED' | 'CANCELLED';
  totalAmount: number;
  discountAmount: number;
  changeAmount: number;
  createdAt: string;
}

export interface SaleItemDetails {
  id: number;
  saleId: number;
  productId: number;
  productName: string;
  batchId: number;
  batchNumber: string;
  expirationDate?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PaymentItemDetails {
  id: number;
  saleId: number;
  method: PaymentMethod;
  amount: number;
  tefTransactionId?: number | null;
  tefNsu?: string | null;
  createdAt: string;
}

export interface SaleDetails {
  sale: Sale;
  items: SaleItemDetails[];
  payments: PaymentItemDetails[];
  preSaleCode?: string;
  prescription?: PrescriptionDetails | null;
}

export interface AdditionalCheckoutItem {
  productId: number;
  batchId: number;
  quantity: number;
}

export interface CheckoutParams {
  cashSessionId?: number;
  preSaleCode?: string;
  additionalItems?: AdditionalCheckoutItem[];
  payments: PaymentItem[];
  pbmProtocol?: string;
  tefNsuList?: string[];
}

