import { PrescriptionDetails } from '../counter/types';

export type PaymentMethod = 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'PIX';

export interface PaymentItem {
  method: PaymentMethod;
  amount: number;
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

export interface CashSessionSummary {
  session: CashSession;
  totalSalesCount: number;
  totalSalesAmount: number;
  totalsByMethod: Record<PaymentMethod, number>;
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
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PaymentItemDetails {
  id: number;
  saleId: number;
  method: PaymentMethod;
  amount: number;
  createdAt: string;
}

export interface SaleDetails {
  sale: Sale;
  items: SaleItemDetails[];
  payments: PaymentItemDetails[];
  preSaleCode?: string;
  prescription?: PrescriptionDetails | null;
}
