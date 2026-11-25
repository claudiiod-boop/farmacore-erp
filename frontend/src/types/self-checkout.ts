export type SelfCheckoutStatus =
  | 'OPEN'
  | 'PAYING'
  | 'PAID'
  | 'BLOCKED_REQUIRES_PHARMACIST'
  | 'CANCELLED'
  | 'TIMEOUT';

export type SelfCheckoutPaymentMethod = 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO';

export interface SelfCheckoutSession {
  id: number;
  kiosk_id: number;
  store_id: number;
  session_code: string;
  status: SelfCheckoutStatus;
  customer_cpf: string | null;
  customer_name: string | null;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  payment_method: SelfCheckoutPaymentMethod | null;
  sale_id: number | null;
  nfce_key: string | null;
  blocked_reason: string | null;
  created_at: string;
  completed_at: string | null;
  items?: SelfCheckoutItem[];
}

export interface SelfCheckoutItem {
  id: number;
  session_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  batch_id: number | null;
  created_at: string;
  product_name?: string;
  ean?: string;
  stripe?: string;
}

export interface ScanItemResult {
  allowed: boolean;
  blocked: boolean;
  blockedReason?: string;
  queueTicketNumber?: string;
  session: SelfCheckoutSession;
  itemAdded?: SelfCheckoutItem;
}

export interface InitiatePaymentResult {
  sessionId: number;
  paymentMethod: SelfCheckoutPaymentMethod;
  totalAmount: number;
  pixQrCodePayload?: string;
  pixQrCodeBase64?: string;
  tefPinpadStatus?: string;
}

export interface FinalizeSaleResult {
  sessionId: number;
  status: SelfCheckoutStatus;
  saleId: number;
  nfceKey: string;
  totalAmount: number;
  thermalReceipt: string;
  completedAt: string;
}

export interface SelfCheckoutKpis {
  totalSessionsToday: number;
  completedSessionsToday: number;
  blockedSessionsToday: number;
  totalRevenueToday: number;
  averageSessionDurationSeconds: number;
}
