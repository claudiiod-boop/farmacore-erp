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

export const api = {
  setBaseUrl,
  getBaseUrl,
  searchProducts,
  getProductByEan,
  getAvailableBatches,
  createPreSale,
};

export default api;
