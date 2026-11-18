import type {
  PurchasePreviewResult,
  PurchaseImportOptions,
  PurchaseImportResult,
  PurchaseInvoiceSummary,
  PurchaseInvoiceDetails,
  SngpcMovement,
  SngpcLivroRegistro,
  SngpcTransmission,
  SngpcTransmissionParams,
  PbmConfig,
  PbmAuthorizeParams,
  PbmAuthorizationResult,
  PbmConfirmResult,
  PbmCancelResult,
  PbmTransaction,
  PbmReceiptResult,
  TefPayParams,
  TefPayResult,
  TefConfirmParams,
  TefConfirmResult,
  TefUndoParams,
  TefUndoResult,
  TefCancelParams,
  TefCancelResult,
  TefConfig,
  TefTransaction,
  TefReceiptResult,
  TefListFilters,
  BlindCashClosure,
  DeclareBlindClosureInput,
  ReviewClosureInput,
  CashClosureFilters,
  TefReceivablesForecastSummary,
  TefReconciliationTransaction,
  TefSettlementInput,
  TefReconciliationSummary,
  DreReport,
  AbcCurveReport,
} from '../types';

export * from '../types/financial';

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

export type FiscalEnvironment = 'HOMOLOGACAO' | 'PRODUCAO' | 'SIMULADOR';
export type NfceInvoiceStatus = 'AUTORIZADA' | 'CONTINGENCIA' | 'CANCELADA' | 'REJEITADA';

export interface FiscalProfile {
  id?: number;
  cnpj: string;
  ie: string;
  razaoSocial: string;
  nomeFantasia: string;
  crt: number;
  cUf: number;
  municipio: string;
  cMun: number;
  logradouro: string;
  numero: string;
  bairro: string;
  cep: string;
  serie: number;
  nextNnf: number;
  cscToken: string;
  cscId: string;
  environment: FiscalEnvironment;
  certPfxBase64?: string | null;
  certPassword?: string | null;
  updatedAt?: string;
}

export interface NfceInvoice {
  id: number;
  saleId: number;
  chNFe: string;
  nNF: number;
  serie: number;
  tpAmb: number;
  tpEmis: number;
  status: NfceInvoiceStatus;
  protocolNumber: string | null;
  protocolDate: string | null;
  xmlSigned: string;
  xmlAuthorized: string | null;
  qrCodeUrl: string;
  digestValue: string | null;
  cStat: number | null;
  xMotivo: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

export interface NfceInvoiceItemDetail {
  name: string;
  ean: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface NfceInvoicePaymentDetail {
  method: string;
  amount: number;
}

export interface CalculatedItemTax {
  vBC: number;
  pICMS: number;
  vICMS: number;
  vBCST: number;
  pICMSST: number;
  vICMSST: number;
  csosn: string;
  cfop: string;
  cstPis: string;
  vBCPis: number;
  pPis: number;
  vPis: number;
  cstCofins: string;
  vBCCofins: number;
  pCofins: number;
  vCofins: number;
  vTotTrib: number;
}

export interface CalculatedSaleTaxes {
  vTotTrib: number;
  vICMS: number;
  vICMSST: number;
  vPIS: number;
  vCOFINS: number;
  items: CalculatedItemTax[];
}

export interface NfceInvoiceDetails {
  invoice: NfceInvoice;
  profile: FiscalProfile;
  items: NfceInvoiceItemDetail[];
  payments: NfceInvoicePaymentDetail[];
  taxes: CalculatedSaleTaxes;
  customerCpf?: string | null;
  changeAmount?: number;
  danfeText?: string;
}

export type PaymentMethod = 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'PIX' | 'CONVENIO_PBM';

export interface PaymentItem {
  method: PaymentMethod;
  amount: number;
  tefTransactionUuid?: string;
  tefNsu?: string;
  cardFiscalData?: {
    tpIntegra: 1 | 2;
    cnpjCredenciadora: string;
    tBand: string;
    cAut: string;
  };
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
  controlType?: ControlType;
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
  operatorName?: string;
  cashierName?: string;
  prescription?: PrescriptionDetails | null;
  preSaleCode?: string;
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
  pbmProtocol?: string;
  tefNsuList?: string[];
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

export async function issueNfce(
  saleId: number,
  options?: { offlineContingency?: boolean }
): Promise<NfceInvoiceDetails> {
  const base = getBaseUrl();
  const url = `${base}/api/fiscal/nfce/issue`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      saleId,
      offlineContingency: options?.offlineContingency,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao emitir NFC-e: ${response.statusText}`
    );
  }
  return response.json();
}

export async function getNfceBySaleId(saleId: number): Promise<NfceInvoiceDetails> {
  const base = getBaseUrl();
  const url = `${base}/api/fiscal/nfce/${saleId}`;
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao buscar NFC-e: ${response.statusText}`
    );
  }
  return response.json();
}

export async function getFiscalProfile(): Promise<FiscalProfile | null> {
  const base = getBaseUrl();
  const url = `${base}/api/fiscal/profile`;
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao buscar perfil fiscal: ${response.statusText}`
    );
  }
  const data = await response.json();
  if (!data || data.profile === null) return null;
  return data;
}

export async function updateFiscalProfile(
  profile: Partial<FiscalProfile>
): Promise<FiscalProfile> {
  const base = getBaseUrl();
  const url = `${base}/api/fiscal/profile`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao atualizar perfil fiscal: ${response.statusText}`
    );
  }
  return response.json();
}

export async function cancelNfce(
  saleId: number,
  reason: string
): Promise<{ success: boolean; cStat: number; cancellationProtocol?: string }> {
  const base = getBaseUrl();
  const url = `${base}/api/fiscal/nfce/${saleId}/cancel`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Falha ao cancelar NFC-e: ${response.statusText}`
    );
  }
  return response.json();
}

export const purchasesApi = {
  previewXml: async (xmlContent: string): Promise<PurchasePreviewResult> => {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/purchases/preview-xml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xmlContent }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.error || body?.message || `Falha na pré-visualização da NF-e: ${response.statusText}`
      );
    }
    return response.json();
  },

  importXml: async (
    xmlOrPayload:
      | string
      | {
          xmlContent: string;
          autoRegisterProducts?: boolean;
          itemClassifications?: Record<string, { stripe: string; controlType: string }>;
        },
    options?: PurchaseImportOptions
  ): Promise<PurchaseImportResult> => {
    const base = getBaseUrl();
    const xmlContent =
      typeof xmlOrPayload === 'string' ? xmlOrPayload : xmlOrPayload.xmlContent;
    const autoRegisterProducts =
      typeof xmlOrPayload === 'string'
        ? options?.autoRegisterProducts
        : xmlOrPayload.autoRegisterProducts;
    const itemClassifications =
      typeof xmlOrPayload === 'string'
        ? options?.itemClassifications
        : xmlOrPayload.itemClassifications;

    const response = await fetch(`${base}/api/purchases/import-xml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        xmlContent,
        autoRegisterProducts,
        itemClassifications,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.error || body?.message || `Falha ao importar NF-e: ${response.statusText}`
      );
    }
    return response.json();
  },

  getInvoices: async (): Promise<PurchaseInvoiceSummary[]> => {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/purchases/invoices`);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.error || body?.message || `Falha ao buscar notas fiscais: ${response.statusText}`
      );
    }
    return response.json();
  },

  getInvoiceById: async (id: number): Promise<PurchaseInvoiceDetails> => {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/purchases/invoices/${id}`);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.error || body?.message || `Falha ao buscar nota fiscal #${id}: ${response.statusText}`
      );
    }
    return response.json();
  },
};

export const sngpcApi = {
  getMovements: async (params?: {
    startDate?: string;
    endDate?: string;
    movementType?: string;
    isTransmitted?: number;
    productId?: number;
  }): Promise<SngpcMovement[]> => {
    const base = getBaseUrl();
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.movementType && params.movementType !== 'TODAS') {
      searchParams.append('movementType', params.movementType);
    }
    if (params?.isTransmitted !== undefined) {
      searchParams.append('isTransmitted', String(params.isTransmitted));
    }
    if (params?.productId) searchParams.append('productId', String(params.productId));

    const qs = searchParams.toString();
    const url = `${base}/api/sngpc/movements${qs ? `?${qs}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.error || body?.message || `Falha ao buscar movimentações SNGPC: ${response.statusText}`
      );
    }
    return response.json();
  },

  getLivroRegistro: async (params: {
    startDate: string;
    endDate: string;
    productId?: number;
  }): Promise<SngpcLivroRegistro> => {
    const base = getBaseUrl();
    const searchParams = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
    });
    if (params.productId) {
      searchParams.append('productId', String(params.productId));
    }

    const response = await fetch(`${base}/api/sngpc/livro?${searchParams.toString()}`);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.error || body?.message || `Falha ao carregar Livro de Registro: ${response.statusText}`
      );
    }
    return response.json();
  },

  generateWeeklyXml: async (
    params: SngpcTransmissionParams
  ): Promise<{
    transmission?: SngpcTransmission;
    transmissionId: number;
    movementsCount: number;
    hashXml: string;
    xmlContent: string;
  }> => {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/sngpc/generate-xml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.error || body?.message || `Falha ao gerar XML semanal SNGPC: ${response.statusText}`
      );
    }
    const data = await response.json();
    return {
      transmission: data.transmission,
      transmissionId: data.transmission?.id ?? data.transmissionId,
      movementsCount: data.movementsCount,
      hashXml: data.transmission?.hashXml ?? data.hashXml ?? '',
      xmlContent: data.transmission?.xmlContent ?? data.xmlContent ?? '',
    };
  },

  getTransmissions: async (): Promise<SngpcTransmission[]> => {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/sngpc/transmissions`);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.error || body?.message || `Falha ao listar transmissões SNGPC: ${response.statusText}`
      );
    }
    return response.json();
  },

  downloadTransmissionXml: async (id: number): Promise<string> => {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/sngpc/transmissions/${id}/xml`);
    if (!response.ok) {
      throw new Error(`Falha ao baixar XML da transmissão #${id}: ${response.statusText}`);
    }
    return response.text();
  },
};

export const pbmApi = {
  getProviders: async (onlyActive = true): Promise<PbmConfig[]> => {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/pbm/providers?onlyActive=${onlyActive}`);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.message || body?.error || `Falha ao listar provedores PBM: ${response.statusText}`
      );
    }
    return response.json();
  },

  authorize: async (params: PbmAuthorizeParams): Promise<PbmAuthorizationResult> => {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/pbm/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || `Falha na autorização PBM: ${response.statusText}`
      );
    }
    return data;
  },

  confirm: async (params: {
    authorizationProtocol: string;
    saleId: number;
    fiscalKeyNfce?: string;
    nfceNumber?: number;
  }): Promise<PbmConfirmResult> => {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/pbm/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || `Falha na confirmação PBM: ${response.statusText}`
      );
    }
    return data;
  },

  cancel: async (protocol: string, reason: string): Promise<PbmCancelResult> => {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/pbm/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol, reason }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || `Falha no cancelamento PBM: ${response.statusText}`
      );
    }
    return data;
  },

  getTransactions: async (filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    patientCpf?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: PbmTransaction[]; total: number }> => {
    const base = getBaseUrl();
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.patientCpf) params.append('patientCpf', filters.patientCpf);
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
    if (filters?.offset !== undefined) params.append('offset', String(filters.offset));

    const queryStr = params.toString();
    const url = `${base}/api/pbm/transactions${queryStr ? `?${queryStr}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.message || body?.error || `Falha ao listar transações PBM: ${response.statusText}`
      );
    }
    return response.json();
  },

  getCoupon: async (protocol: string): Promise<PbmReceiptResult> => {
    const base = getBaseUrl();
    const response = await fetch(
      `${base}/api/pbm/transactions/${encodeURIComponent(protocol)}/coupon`
    );
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.message || body?.error || `Falha ao obter cupom PBM: ${response.statusText}`
      );
    }
    return response.json();
  },
};

export const tefApi = {
  getProviders: async (onlyActive?: boolean): Promise<TefConfig[]> => {
    const base = getBaseUrl();
    const query = onlyActive ? '?onlyActive=true' : '';
    const response = await fetch(`${base}/api/tef/providers${query}`);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(
        data?.message || data?.error || `Falha ao listar provedores TEF: ${response.statusText}`
      );
    }
    return response.json();
  },

  pay: async (params: TefPayParams): Promise<TefPayResult> => {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/tef/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || `Falha no processamento TEF: ${response.statusText}`
      );
    }
    return data;
  },

  confirm: async (params: TefConfirmParams): Promise<TefConfirmResult> => {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/tef/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || `Falha na confirmação TEF: ${response.statusText}`
      );
    }
    return data;
  },

  undo: async (params: TefUndoParams): Promise<TefUndoResult> => {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/tef/undo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || `Falha no desfazimento TEF: ${response.statusText}`
      );
    }
    return data;
  },

  cancel: async (params: TefCancelParams): Promise<TefCancelResult> => {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/tef/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || `Falha no cancelamento TEF: ${response.statusText}`
      );
    }
    return data;
  },

  getTransactions: async (
    filters?: TefListFilters
  ): Promise<{ transactions: TefTransaction[]; total: number }> => {
    const base = getBaseUrl();
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.operationType) params.append('operationType', filters.operationType);
    if (filters?.brandName) params.append('brandName', filters.brandName);
    if (filters?.acquirerName) params.append('acquirerName', filters.acquirerName);
    if (filters?.saleId !== undefined) params.append('saleId', String(filters.saleId));
    if (filters?.terminalId) params.append('terminalId', filters.terminalId);
    if (filters?.nsu) params.append('nsu', filters.nsu);
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
    if (filters?.offset !== undefined) params.append('offset', String(filters.offset));

    const queryStr = params.toString();
    const url = `${base}/api/tef/transactions${queryStr ? `?${queryStr}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.message || body?.error || `Falha ao listar transações TEF: ${response.statusText}`
      );
    }
    return response.json();
  },

  getReceipt: async (nsu: string): Promise<TefReceiptResult> => {
    const base = getBaseUrl();
    const response = await fetch(
      `${base}/api/tef/transactions/${encodeURIComponent(nsu)}/receipt`
    );
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.message || body?.error || `Falha ao obter comprovante TEF: ${response.statusText}`
      );
    }
    return response.json();
  },

  getConfig: async (providerId?: string): Promise<TefConfig> => {
    const base = getBaseUrl();
    const url = providerId
      ? `${base}/api/tef/config/${encodeURIComponent(providerId)}`
      : `${base}/api/tef/config`;
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.message || body?.error || `Falha ao consultar configuração TEF: ${response.statusText}`
      );
    }
    return response.json();
  },

  updateConfig: async (providerId: string, data: Partial<TefConfig>): Promise<TefConfig> => {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/tef/config/${encodeURIComponent(providerId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const resBody = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        resBody?.message || resBody?.error || `Falha ao atualizar configuração TEF: ${response.statusText}`
      );
    }
    return resBody;
  },
};

// ===================== FINANCIAL & BLIND CASH CLOSURE API =====================

export async function declareBlindClosure(input: DeclareBlindClosureInput): Promise<BlindCashClosure> {
  const base = getBaseUrl();
  const url = `${base}/api/financial/cash-closures`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao declarar fechamento cego de caixa: ${response.statusText}`);
  }
  return response.json();
}

export async function getClosureBySession(sessionId: number): Promise<BlindCashClosure> {
  const base = getBaseUrl();
  const url = `${base}/api/financial/cash-closures/by-session/${sessionId}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Fechamento de caixa não encontrado: ${response.statusText}`);
  }
  return response.json();
}

export async function getClosureById(closureId: number): Promise<BlindCashClosure> {
  const base = getBaseUrl();
  const url = `${base}/api/financial/cash-closures/${closureId}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Fechamento de caixa não encontrado: ${response.statusText}`);
  }
  return response.json();
}

export async function reviewClosure(closureId: number, input: ReviewClosureInput): Promise<BlindCashClosure> {
  const base = getBaseUrl();
  const url = `${base}/api/financial/cash-closures/${closureId}/review`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao homologar fechamento: ${response.statusText}`);
  }
  return response.json();
}

export async function getClosureReceipt(closureId: number): Promise<{ textReceipt: string; fullEscPos: string }> {
  const base = getBaseUrl();
  const url = `${base}/api/financial/cash-closures/${closureId}/receipt`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao emitir comprovante térmico: ${response.statusText}`);
  }
  return response.json();
}

export async function listClosures(filters?: CashClosureFilters): Promise<{ closures: BlindCashClosure[]; total: number }> {
  const base = getBaseUrl();
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.differenceStatus) params.append('differenceStatus', filters.differenceStatus);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.operatorName) params.append('operatorName', filters.operatorName);
  if (filters?.limit) params.append('limit', String(filters.limit));
  if (filters?.offset) params.append('offset', String(filters.offset));

  const qs = params.toString();
  const url = `${base}/api/financial/cash-closures${qs ? `?${qs}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao listar fechamentos de caixa: ${response.statusText}`);
  }
  return response.json();
}

export async function getTefForecast(filters?: {
  startDate?: string;
  endDate?: string;
  acquirerName?: string;
  operationType?: string;
}): Promise<TefReceivablesForecastSummary> {
  const base = getBaseUrl();
  const params = new URLSearchParams();
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.acquirerName) params.append('acquirerName', filters.acquirerName);
  if (filters?.operationType) params.append('operationType', filters.operationType);

  const qs = params.toString();
  const url = `${base}/api/financial/tef/forecast${qs ? `?${qs}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao buscar previsão TEF: ${response.statusText}`);
  }
  return response.json();
}

export async function settleTefTransaction(input: TefSettlementInput): Promise<TefReconciliationTransaction> {
  const base = getBaseUrl();
  const url = `${base}/api/financial/tef/settle`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao liquidar transação TEF: ${response.statusText}`);
  }
  return response.json();
}

export async function listTefReconciliation(filters?: {
  settlementStatus?: string;
  acquirerName?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{ transactions: TefReconciliationTransaction[]; summary: TefReconciliationSummary }> {
  const base = getBaseUrl();
  const params = new URLSearchParams();
  if (filters?.settlementStatus) params.append('settlementStatus', filters.settlementStatus);
  if (filters?.acquirerName) params.append('acquirerName', filters.acquirerName);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.limit) params.append('limit', String(filters.limit));
  if (filters?.offset) params.append('offset', String(filters.offset));

  const qs = params.toString();
  const url = `${base}/api/financial/tef/transactions${qs ? `?${qs}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao listar conciliações TEF: ${response.statusText}`);
  }
  return response.json();
}

export async function getDreReport(startDate?: string, endDate?: string): Promise<DreReport> {
  const base = getBaseUrl();
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const qs = params.toString();
  const url = `${base}/api/financial/dre${qs ? `?${qs}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao carregar DRE: ${response.statusText}`);
  }
  return response.json();
}

export async function getAbcCurveReport(
  startDate?: string,
  endDate?: string,
  category?: string
): Promise<AbcCurveReport> {
  const base = getBaseUrl();
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (category) params.append('category', category);
  const qs = params.toString();
  const url = `${base}/api/financial/abc-curve${qs ? `?${qs}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao carregar Curva ABC: ${response.statusText}`);
  }
  return response.json();
}

export const financialApi = {
  declareBlindClosure,
  getClosureBySession,
  getClosureById,
  reviewClosure,
  getClosureReceipt,
  listClosures,
  getTefForecast,
  settleTefTransaction,
  listTefReconciliation,
  getDreReport,
  getAbcCurveReport,
};

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
  issueNfce,
  getNfceBySaleId,
  getFiscalProfile,
  updateFiscalProfile,
  cancelNfce,
  declareBlindClosure,
  getClosureBySession,
  getClosureById,
  reviewClosure,
  getClosureReceipt,
  listClosures,
  getTefForecast,
  settleTefTransaction,
  listTefReconciliation,
  getDreReport,
  getAbcCurveReport,
  purchases: purchasesApi,
  sngpc: sngpcApi,
  pbm: pbmApi,
  tef: tefApi,
  financial: financialApi,
  purchasesApi,
  sngpcApi,
  pbmApi,
  tefApi,
  financialApi,
};

export default api;
