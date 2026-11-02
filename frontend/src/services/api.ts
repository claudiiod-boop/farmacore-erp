export type Stripe = 'SEM_TARJA' | 'VERMELHA' | 'PRETA';
export type ControlType =
  | 'ISENTO'
  | 'ANTIMICROBIANO'
  | 'C1'
  | 'C2'
  | 'B1'
  | 'B2'
  | 'A1'
  | 'A2'
  | 'A3';

export interface Product {
  id: number;
  ean: string;
  name: string;
  activeIngredient: string;
  msRegistration: string;
  stripe: Stripe;
  controlType: ControlType;
  pmc: number;
  pf: number;
  price: number;
  isActive: boolean;
  createdAt: string;
}

export interface Batch {
  id: number;
  productId: number;
  batchNumber: string;
  manufacturingDate: string;
  expirationDate: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  createdAt: string;
}

export interface CreatePreSaleItemDTO {
  productId: number;
  batchId: number;
  quantity: number;
}

export interface PrescriptionDTO {
  doctorName: string;
  doctorCrm: string;
  doctorUf: string;
  prescriptionType: string;
  prescriptionDate: string;
  patientName: string;
  buyerName?: string;
  buyerCpf?: string;
}

export interface CreatePreSaleDTO {
  customerName?: string;
  customerCpf?: string;
  items: CreatePreSaleItemDTO[];
  prescription?: PrescriptionDTO;
}

export type PreSaleStatus = 'OPEN' | 'CONVERTED_TO_SALE' | 'CANCELLED';

export interface PreSale {
  id: number;
  code: string;
  status: PreSaleStatus;
  customerName: string | null;
  customerCpf: string | null;
  totalAmount: number;
  createdAt: string;
}

export interface PreSaleItemDetails {
  id: number;
  preSaleId: number;
  productId: number;
  productName: string;
  batchId: number;
  batchNumber: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PrescriptionDetails {
  id: number;
  preSaleId: number;
  doctorName: string;
  doctorCrm: string;
  doctorUf: string;
  prescriptionType: string;
  prescriptionDate: string;
  patientName: string;
  buyerName: string | null;
  buyerCpf: string | null;
  createdAt: string;
}

export interface PreSaleDetails {
  preSale: PreSale;
  items: PreSaleItemDetails[];
  prescription: PrescriptionDetails | null;
}

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
  expectedCash?: number;
}

export interface SaleItem {
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

export interface SalePayment {
  id: number;
  saleId: number;
  method: PaymentMethod;
  amount: number;
  createdAt: string;
}

export interface Sale {
  id: number;
  preSaleId?: number | null;
  cashSessionId?: number | null;
  status: 'COMPLETED' | 'CANCELLED';
  totalAmount: number;
  discountAmount: number;
  changeAmount: number;
  createdAt: string;
  items?: SaleItem[];
  payments?: SalePayment[];
}

export interface AdditionalCheckoutItem {
  productId: number;
  batchId: number;
  quantity: number;
}

export interface CheckoutDTO {
  cashSessionId?: number;
  preSaleCode?: string;
  additionalItems?: AdditionalCheckoutItem[];
  payments: PaymentItem[];
}

export interface CheckoutResponse {
  sale: Sale;
  receiptText: string;
}

let customBaseUrl = '';

export function setBaseUrl(url: string): void {
  customBaseUrl = url.replace(/\/$/, '');
}

export function getBaseUrl(): string {
  if (customBaseUrl) return customBaseUrl;
  if (typeof window !== 'undefined' && (window as any).__API_BASE_URL__) {
    return (window as any).__API_BASE_URL__;
  }
  return '';
}

export async function searchProducts(query: string): Promise<Product[]> {
  const base = getBaseUrl();
  const url = `${base}/api/products/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao buscar produtos: ${response.statusText}`
    );
  }
  return response.json();
}

export async function getProductByEan(ean: string): Promise<Product | null> {
  const base = getBaseUrl();
  const url = `${base}/api/products/ean/${encodeURIComponent(ean)}`;
  const response = await fetch(url);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao buscar produto por EAN: ${response.statusText}`
    );
  }
  return response.json();
}

export async function getAvailableBatches(productId: number): Promise<Batch[]> {
  const base = getBaseUrl();
  const url = `${base}/api/inventory/${productId}/batches`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao buscar lotes: ${response.statusText}`
    );
  }
  return response.json();
}

export async function createPreSale(dto: CreatePreSaleDTO): Promise<PreSale> {
  const base = getBaseUrl();
  const url = `${base}/api/pre-sales`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao gerar pré-venda: ${response.statusText}`
    );
  }
  return response.json();
}

export async function getPreSaleByCode(code: string): Promise<PreSaleDetails> {
  const base = getBaseUrl();
  const url = `${base}/api/pre-sales/${encodeURIComponent(code)}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao buscar pré-venda: ${response.statusText}`
    );
  }
  return response.json();
}

export async function openCashSession(
  operatorName: string,
  initialCash: number
): Promise<CashSession> {
  const base = getBaseUrl();
  const url = `${base}/api/pos/sessions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ operatorName, initialCash }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao abrir sessão de caixa: ${response.statusText}`
    );
  }
  return response.json();
}

export async function closeCashSession(sessionId: number): Promise<CashSessionSummary> {
  const base = getBaseUrl();
  const url = `${base}/api/pos/sessions/${sessionId}/close`;
  const response = await fetch(url, {
    method: 'POST',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao fechar sessão de caixa: ${response.statusText}`
    );
  }
  return response.json();
}

export async function getCurrentSession(operatorName?: string): Promise<CashSession | null> {
  const base = getBaseUrl();
  const query = operatorName ? `?operatorName=${encodeURIComponent(operatorName)}` : '';
  const url = `${base}/api/pos/sessions/current${query}`;
  const response = await fetch(url);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao obter sessão atual: ${response.statusText}`
    );
  }
  return response.json();
}

export async function getSessionSummary(sessionId: number): Promise<CashSessionSummary> {
  const base = getBaseUrl();
  const url = `${base}/api/pos/sessions/${sessionId}/summary`;
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao obter resumo da sessão: ${response.statusText}`
    );
  }
  return response.json();
}

export async function registerCashMovement(
  sessionId: number,
  movement: {
    type: CashMovementType;
    amount: number;
    reason: string;
    operatorName: string;
  }
): Promise<CashMovement> {
  const base = getBaseUrl();
  const url = `${base}/api/pos/sessions/${sessionId}/movements`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(movement),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao registrar movimentação de caixa: ${response.statusText}`
    );
  }
  return response.json();
}

export async function getCashMovements(sessionId: number): Promise<CashMovement[]> {
  const base = getBaseUrl();
  const url = `${base}/api/pos/sessions/${sessionId}/movements`;
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao buscar movimentações de caixa: ${response.statusText}`
    );
  }
  return response.json();
}

export async function checkoutSale(dto: CheckoutDTO): Promise<CheckoutResponse> {
  const base = getBaseUrl();
  const url = `${base}/api/pos/checkout`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao finalizar venda: ${response.statusText}`
    );
  }
  return response.json();
}

export async function cancelPreSale(code: string): Promise<{ message: string }> {
  const base = getBaseUrl();
  const url = `${base}/api/pre-sales/${encodeURIComponent(code)}/cancel`;
  const response = await fetch(url, {
    method: 'POST',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao cancelar pré-venda: ${response.statusText}`
    );
  }
  return response.json();
}

export const api = {
  setBaseUrl,
  getBaseUrl,
  searchProducts,
  getProductByEan,
  getAvailableBatches,
  createPreSale,
  getPreSaleByCode,
  openCashSession,
  closeCashSession,
  getCurrentSession,
  getSessionSummary,
  registerCashMovement,
  getCashMovements,
  checkoutSale,
  cancelPreSale,
};

export default api;
