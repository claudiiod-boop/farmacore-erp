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
  Store,
  CreateStoreInput,
  UpdateStoreInput,
  NetworkStockItem,
  Transfer,
  TransferStatus,
  TransferItem,
  TransferWithItems,
  CreateTransferInput,
  CarrierInfo,
  ReceiveItemInput,
  TransferFilters,
  FiscalTransferResult,
  TransferSlipResult,
  InventorySession,
  InventoryItem,
  InventorySessionWithItems,
  CreateInventorySessionInput,
  AddCountInput,
  ApplyAdjustmentsParams,
  InventorySessionFilters,
  InventoryBalanceReport,
  InventoryReportResult,
  CorporateAgreement,
  CreateAgreementInput,
  UpdateAgreementInput,
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerDependent,
  CreateDependentInput,
  CustomerListResponse,
  CreditEligibilityResult,
  CustomerReceivable,
  AgreementInvoice,
  GenerateInvoiceParams,
  ReceivePaymentParams,
  PaymentReceiptResult,
  PromissoryNoteResponse,
  LoyaltyProgram,
  UpdateLoyaltyProgramInput,
  LoyaltyWallet,
  LoyaltyTransaction,
  CashbackRedeemInput,
  ExpireCashbackResult,
  PromotionType,
  PromotionWithProducts,
  CreatePromotionInput,
  UpdatePromotionInput,
  CartItemInput,
  CartEvaluationResult,
  PatientTreatment,
  UpcomingRefillItem,
  CashbackStatementReceiptResult,
  TreatmentSlipReceiptResult,
  DeliveryOrder,
  CreateDeliveryOrderInput,
  UpdateOrderStatusInput,
  DeliveryOrderFilters,
  Courier,
  CreateCourierInput,
  UpdateCourierInput,
  CourierFilters,
  CourierStatus,
  DeliveryZone,
  CreateDeliveryZoneInput,
  UpdateDeliveryZoneInput,
  CalculateFeeInput,
  CalculateFeeResult,
  DeliveryDispatch,
  DeliveryDispatchWithOrders,
  CreateDispatchInput,
  SettleDispatchParams,
  SettlementResult,
  OrderSlipResponse,
  DispatchSlipResponse,
  DispatchStatus,
} from '../types';

export * from '../types/financial';
export * from '../types/credit';
export * from '../types/crm';
export * from '../types/delivery';

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

export type PaymentMethod =
  | 'DINHEIRO'
  | 'CARTAO_CREDITO'
  | 'CARTAO_DEBITO'
  | 'PIX'
  | 'CONVENIO_PBM'
  | 'CONVENIO'
  | 'CREDIARIO';

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
  customerId?: number;
  installments?: number;
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

function normalizeClosure(raw: any): BlindCashClosure {
  if (!raw) return raw;
  return {
    ...raw,
    systemTotal: raw.systemTotal ?? raw.totalSystem ?? 0,
    declaredTotal: raw.declaredTotal ?? raw.totalDeclared ?? 0,
    closedAt: raw.closedAt ?? raw.declaredAt ?? raw.createdAt,
  };
}

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
  const raw = await response.json();
  return normalizeClosure(raw);
}

export async function getClosureBySession(sessionId: number): Promise<BlindCashClosure> {
  const base = getBaseUrl();
  const url = `${base}/api/financial/cash-closures/by-session/${sessionId}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Fechamento de caixa não encontrado: ${response.statusText}`);
  }
  const raw = await response.json();
  return normalizeClosure(raw);
}

export async function getClosureById(closureId: number): Promise<BlindCashClosure> {
  const base = getBaseUrl();
  const url = `${base}/api/financial/cash-closures/${closureId}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Fechamento de caixa não encontrado: ${response.statusText}`);
  }
  const raw = await response.json();
  return normalizeClosure(raw);
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
  const raw = await response.json();
  return normalizeClosure(raw);
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
  const raw = await response.json();
  return {
    closures: (raw.closures || []).map(normalizeClosure),
    total: raw.total ?? (raw.closures || []).length,
  };
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
  const raw = await response.json();
  return {
    ...raw,
    operatingResult: raw.operatingResult ?? raw.netOperatingProfit ?? 0,
    operatingMarginPercent: raw.operatingMarginPercent ?? raw.netMarginPercent ?? 0,
  };
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
  const raw = await response.json();
  const items = (raw.items || []).map((item: any, idx: number) => ({
    ...item,
    rank: item.rank ?? idx + 1,
    cumulativeSharePercent: item.cumulativeSharePercent ?? item.cumulativeRevenuePercent ?? 0,
  }));
  return {
    ...raw,
    totalItemsSold: raw.totalItemsSold ?? items.reduce((acc: number, i: any) => acc + (i.quantitySold || 0), 0),
    classCounts: raw.classCounts ?? {
      A: raw.classACount ?? items.filter((i: any) => i.abcClass === 'A').length,
      B: raw.classBCount ?? items.filter((i: any) => i.abcClass === 'B').length,
      C: raw.classCCount ?? items.filter((i: any) => i.abcClass === 'C').length,
    },
    classRevenues: raw.classRevenues ?? {
      A: items.filter((i: any) => i.abcClass === 'A').reduce((acc: number, i: any) => acc + (i.grossRevenue || 0), 0),
      B: items.filter((i: any) => i.abcClass === 'B').reduce((acc: number, i: any) => acc + (i.grossRevenue || 0), 0),
      C: items.filter((i: any) => i.abcClass === 'C').reduce((acc: number, i: any) => acc + (i.grossRevenue || 0), 0),
    },
    items,
  };
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

// ===================== MULTI-STORE & TRANSFERS API =====================

export type {
  Store,
  CreateStoreInput,
  UpdateStoreInput,
  NetworkStockItem,
  Transfer,
  TransferStatus,
  TransferItem,
  TransferWithItems,
  CreateTransferInput,
  CarrierInfo,
  ReceiveItemInput,
  TransferFilters,
  FiscalTransferResult,
  TransferSlipResult,
};

export async function getStores(activeOnly?: boolean): Promise<Store[]> {
  const base = getBaseUrl();
  const url = `${base}/api/stores${activeOnly ? '?activeOnly=true' : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao listar lojas: ${response.statusText}`);
  }
  return response.json();
}

export async function getStoreById(id: number): Promise<Store> {
  const base = getBaseUrl();
  const url = `${base}/api/stores/${id}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao buscar loja #${id}: ${response.statusText}`);
  }
  return response.json();
}

export async function createStore(data: CreateStoreInput): Promise<Store> {
  const base = getBaseUrl();
  const url = `${base}/api/stores`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao criar loja: ${response.statusText}`);
  }
  return response.json();
}

export async function updateStore(id: number, data: UpdateStoreInput): Promise<Store> {
  const base = getBaseUrl();
  const url = `${base}/api/stores/${id}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao atualizar loja #${id}: ${response.statusText}`);
  }
  return response.json();
}

export async function getNetworkProductStock(productId: number): Promise<NetworkStockItem[]> {
  const base = getBaseUrl();
  const url = `${base}/api/stores/network-stock/${productId}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao consultar estoque em rede: ${response.statusText}`);
  }
  return response.json();
}

export async function getTransfers(filters?: TransferFilters): Promise<{ transfers: TransferWithItems[]; total: number }> {
  const base = getBaseUrl();
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  const src = filters?.sourceStoreId ?? (filters as any)?.source_store_id;
  if (src !== undefined && src !== null) params.append('sourceStoreId', String(src));
  const tgt = filters?.targetStoreId ?? (filters as any)?.target_store_id;
  if (tgt !== undefined && tgt !== null) params.append('targetStoreId', String(tgt));
  const sDate = filters?.startDate ?? (filters as any)?.start_date;
  if (sDate) params.append('startDate', sDate);
  const eDate = filters?.endDate ?? (filters as any)?.end_date;
  if (eDate) params.append('endDate', eDate);
  if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
  if (filters?.offset !== undefined) params.append('offset', String(filters.offset));

  const qs = params.toString();
  const url = `${base}/api/transfers${qs ? `?${qs}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao listar transferências: ${response.statusText}`);
  }
  return response.json();
}

export async function getTransferById(id: number): Promise<TransferWithItems> {
  const base = getBaseUrl();
  const url = `${base}/api/transfers/${id}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao buscar transferência #${id}: ${response.statusText}`);
  }
  return response.json();
}

export async function createTransfer(data: CreateTransferInput): Promise<TransferWithItems> {
  const base = getBaseUrl();
  const url = `${base}/api/transfers`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao criar transferência: ${response.statusText}`);
  }
  return response.json();
}

export async function dispatchTransfer(
  id: number,
  data: { dispatchedBy: string; carrierName?: string; trackingCode?: string }
): Promise<TransferWithItems> {
  const base = getBaseUrl();
  const url = `${base}/api/transfers/${id}/dispatch`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao despachar transferência #${id}: ${response.statusText}`);
  }
  return response.json();
}

export async function receiveTransfer(
  id: number,
  data: { receivedBy: string; itemsConfirmed?: ReceiveItemInput[] }
): Promise<TransferWithItems> {
  const base = getBaseUrl();
  const url = `${base}/api/transfers/${id}/receive`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao receber transferência #${id}: ${response.statusText}`);
  }
  return response.json();
}

export async function cancelTransfer(
  id: number,
  data: { reason: string }
): Promise<TransferWithItems> {
  const base = getBaseUrl();
  const url = `${base}/api/transfers/${id}/cancel`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao cancelar transferência #${id}: ${response.statusText}`);
  }
  return response.json();
}

export async function getTransferSlip(id: number): Promise<TransferSlipResult> {
  const base = getBaseUrl();
  const url = `${base}/api/transfers/${id}/slip`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao buscar romaneio da transferência #${id}: ${response.statusText}`);
  }
  return response.json();
}

export async function emitTransferNfe(id: number): Promise<FiscalTransferResult> {
  const base = getBaseUrl();
  const url = `${base}/api/transfers/${id}/emit-nfe`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao emitir NF-e da transferência #${id}: ${response.statusText}`);
  }
  return response.json();
}

// ===================== INVENTORY & BALANCE AUDIT API (FASE 10) =====================

export async function getInventorySessions(
  filters?: InventorySessionFilters
): Promise<{ sessions: InventorySessionWithItems[]; total: number }> {
  const base = getBaseUrl();
  const params = new URLSearchParams();
  const sId = filters?.storeId ?? filters?.store_id;
  if (sId !== undefined) params.append('storeId', String(sId));
  if (filters?.status) params.append('status', filters.status);
  const iType = filters?.inventoryType ?? filters?.inventory_type;
  if (iType) params.append('inventoryType', iType);
  const sDate = filters?.startDate ?? filters?.start_date;
  if (sDate) params.append('startDate', sDate);
  const eDate = filters?.endDate ?? filters?.end_date;
  if (eDate) params.append('endDate', eDate);
  if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
  if (filters?.offset !== undefined) params.append('offset', String(filters.offset));

  const qs = params.toString();
  const url = `${base}/api/inventory/sessions${qs ? `?${qs}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao listar sessões de inventário: ${response.statusText}`);
  }
  return response.json();
}

export async function getInventorySessionById(id: number): Promise<InventorySessionWithItems> {
  const base = getBaseUrl();
  const url = `${base}/api/inventory/sessions/${id}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao buscar sessão de inventário #${id}: ${response.statusText}`);
  }
  return response.json();
}

export async function createInventorySession(data: CreateInventorySessionInput): Promise<InventorySessionWithItems> {
  const base = getBaseUrl();
  const url = `${base}/api/inventory/sessions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao criar sessão de inventário: ${response.statusText}`);
  }
  return response.json();
}

export async function addInventoryCount(sessionId: number, data: AddCountInput): Promise<InventoryItem> {
  const base = getBaseUrl();
  const url = `${base}/api/inventory/sessions/${sessionId}/count`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao registrar contagem: ${response.statusText}`);
  }
  return response.json();
}

export async function recountInventoryItem(
  sessionId: number,
  itemId: number,
  recountQuantity: number
): Promise<InventoryItem> {
  const base = getBaseUrl();
  const url = `${base}/api/inventory/sessions/${sessionId}/items/${itemId}/recount`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recountQuantity }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao registrar recontagem do item #${itemId}: ${response.statusText}`);
  }
  return response.json();
}

export async function finishInventoryCount(sessionId: number): Promise<InventorySessionWithItems> {
  const base = getBaseUrl();
  const url = `${base}/api/inventory/sessions/${sessionId}/finish-count`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao finalizar contagens da sessão #${sessionId}: ${response.statusText}`);
  }
  return response.json();
}

export async function applyInventoryAdjustments(
  sessionId: number,
  data: ApplyAdjustmentsParams
): Promise<InventorySessionWithItems> {
  const base = getBaseUrl();
  const url = `${base}/api/inventory/sessions/${sessionId}/apply`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao homologar inventário #${sessionId}: ${response.statusText}`);
  }
  return response.json();
}

export async function cancelInventorySession(
  sessionId: number,
  reason: string
): Promise<InventorySessionWithItems> {
  const base = getBaseUrl();
  const url = `${base}/api/inventory/sessions/${sessionId}/cancel`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao cancelar sessão #${sessionId}: ${response.statusText}`);
  }
  return response.json();
}

export async function getInventoryReport(
  sessionId: number
): Promise<InventoryReportResult> {
  const base = getBaseUrl();
  const url = `${base}/api/inventory/sessions/${sessionId}/report`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Falha ao buscar relatório de inventário #${sessionId}: ${response.statusText}`);
  }
  return response.json();
}

export type { InventorySession, InventoryBalanceReport };

export const inventoryApi = {
  getInventorySessions,
  getInventorySessionById,
  createInventorySession,
  addInventoryCount,
  recountInventoryItem,
  finishInventoryCount,
  applyInventoryAdjustments,
  cancelInventorySession,
  getInventoryReport,
};

export const storesApi = {
  getStores,
  getStoreById,
  createStore,
  updateStore,
  getNetworkProductStock,
};

export const transfersApi = {
  getTransfers,
  getTransferById,
  createTransfer,
  dispatchTransfer,
  receiveTransfer,
  cancelTransfer,
  getTransferSlip,
  emitTransferNfe,
};

export const creditApi = {
  // Convênios Corporativos
  getAgreements: async (activeOnly?: boolean): Promise<CorporateAgreement[]> => {
    const base = getBaseUrl();
    const query = activeOnly ? '?activeOnly=true' : '';
    const res = await fetch(`${base}/api/credit/agreements${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao buscar convênios');
    }
    return res.json();
  },

  getAgreementById: async (id: number): Promise<CorporateAgreement> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/credit/agreements/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Convênio #${id} não encontrado`);
    }
    return res.json();
  },

  createAgreement: async (data: CreateAgreementInput): Promise<CorporateAgreement> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/credit/agreements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao cadastrar convênio');
    }
    return res.json();
  },

  updateAgreement: async (id: number, data: UpdateAgreementInput): Promise<CorporateAgreement> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/credit/agreements/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao atualizar convênio #${id}`);
    }
    return res.json();
  },

  // Faturas de Convênio
  generateInvoice: async (agreementId: number, params: GenerateInvoiceParams): Promise<AgreementInvoice> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/credit/agreements/${agreementId}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao fechar fatura de convênio');
    }
    return res.json();
  },

  getAgreementInvoices: async (agreementId: number): Promise<AgreementInvoice[]> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/credit/agreements/${agreementId}/invoices`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao listar faturas');
    }
    return res.json();
  },

  getInvoiceById: async (id: number): Promise<AgreementInvoice> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/credit/invoices/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Fatura #${id} não encontrada`);
    }
    return res.json();
  },

  getPayrollReport: async (invoiceId: number): Promise<{ invoiceId: number; textReport: string; fullEscPos?: string }> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/credit/invoices/${invoiceId}/payroll-report`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao emitir extrato de folha de pagamento');
    }
    return res.json();
  },

  // Clientes & Dependentes
  getCustomers: async (params?: { search?: string; agreementId?: number; status?: string; page?: number; limit?: number }): Promise<CustomerListResponse> => {
    const base = getBaseUrl();
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.agreementId) query.append('agreementId', String(params.agreementId));
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${base}/api/credit/customers${qs}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao listar clientes');
    }
    return res.json();
  },

  getCustomerById: async (id: number): Promise<Customer> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/credit/customers/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Cliente #${id} não encontrado`);
    }
    return res.json();
  },

  getCustomerByCpf: async (cpf: string): Promise<Customer> => {
    const base = getBaseUrl();
    const cleanCpf = cpf.replace(/\D/g, '');
    const res = await fetch(`${base}/api/credit/customers/by-cpf/${cleanCpf}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Cliente com CPF ${cpf} não encontrado`);
    }
    return res.json();
  },

  createCustomer: async (data: CreateCustomerInput): Promise<Customer> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/credit/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao cadastrar cliente');
    }
    return res.json();
  },

  updateCustomer: async (id: number, data: UpdateCustomerInput): Promise<Customer> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/credit/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao atualizar cliente #${id}`);
    }
    return res.json();
  },

  addDependent: async (customerId: number, data: CreateDependentInput): Promise<CustomerDependent> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/credit/customers/${customerId}/dependents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao adicionar dependente');
    }
    return res.json();
  },

  removeDependent: async (dependentId: number): Promise<{ success: boolean }> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/credit/customers/dependents/${dependentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao remover dependente');
    }
    return res.json();
  },

  checkCreditEligibility: async (customerId: number, purchaseAmount: number): Promise<CreditEligibilityResult> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/credit/customers/${customerId}/check-eligibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchaseAmount }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao consultar elegibilidade');
    }
    return res.json();
  },

  // Recebíveis & Quitação de Carnê
  getReceivables: async (params?: { customerId?: number; agreementId?: number; status?: string; overdueOnly?: boolean; startDate?: string; endDate?: string }): Promise<CustomerReceivable[]> => {
    const base = getBaseUrl();
    const query = new URLSearchParams();
    if (params?.customerId) query.append('customerId', String(params.customerId));
    if (params?.agreementId) query.append('agreementId', String(params.agreementId));
    if (params?.status) query.append('status', params.status);
    if (params?.overdueOnly) query.append('overdueOnly', 'true');
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${base}/api/credit/receivables${qs}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao listar parcelas de crediário');
    }
    return res.json();
  },

  settleReceivables: async (data: ReceivePaymentParams): Promise<PaymentReceiptResult> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/credit/receivables/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao quitar parcelas');
    }
    return res.json();
  },

  getPromissoryNote: async (saleId: number, dependentId?: number): Promise<PromissoryNoteResponse> => {
    const base = getBaseUrl();
    const query = dependentId ? `?dependentId=${dependentId}` : '';
    const res = await fetch(`${base}/api/credit/receivables/sale/${saleId}/promissory${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao emitir nota promissória da venda #${saleId}`);
    }
    return res.json();
  },
};

export const crmApi = {
  // Fidelidade & Cashback
  getLoyaltyProgram: async (storeId?: number): Promise<LoyaltyProgram> => {
    const base = getBaseUrl();
    const query = storeId ? `?storeId=${storeId}` : '';
    const res = await fetch(`${base}/api/crm/loyalty/program${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao obter programa de fidelidade');
    }
    return res.json();
  },

  updateLoyaltyProgram: async (data: UpdateLoyaltyProgramInput): Promise<LoyaltyProgram> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/crm/loyalty/program`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao atualizar programa de fidelidade');
    }
    return res.json();
  },

  getWallet: async (customerId: number): Promise<LoyaltyWallet> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/crm/loyalty/wallet/${customerId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Carteira de fidelidade do cliente #${customerId} não encontrada`);
    }
    return res.json();
  },

  getWalletStatement: async (customerId: number): Promise<CashbackStatementReceiptResult> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/crm/loyalty/wallet/${customerId}/statement`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao obter extrato da carteira do cliente #${customerId}`);
    }
    return res.json();
  },

  redeemCashback: async (data: CashbackRedeemInput): Promise<LoyaltyTransaction> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/crm/loyalty/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao resgatar cashback');
    }
    return res.json();
  },

  expireOverdueCashback: async (referenceDate?: string): Promise<ExpireCashbackResult> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/crm/loyalty/expire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(referenceDate ? { referenceDate } : {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao expirar cashback vencido');
    }
    return res.json();
  },

  // Promoções Combinadas
  getPromotions: async (params?: {
    activeOnly?: boolean;
    type?: PromotionType;
    search?: string;
    storeId?: number;
  }): Promise<PromotionWithProducts[]> => {
    const base = getBaseUrl();
    const query = new URLSearchParams();
    if (params?.activeOnly) query.append('activeOnly', 'true');
    if (params?.type) query.append('type', params.type);
    if (params?.search) query.append('search', params.search);
    if (params?.storeId) query.append('storeId', String(params.storeId));
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${base}/api/crm/promotions${qs}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao listar promoções');
    }
    return res.json();
  },

  getPromotionById: async (id: number): Promise<PromotionWithProducts> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/crm/promotions/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Promoção #${id} não encontrada`);
    }
    return res.json();
  },

  createPromotion: async (data: CreatePromotionInput): Promise<PromotionWithProducts> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/crm/promotions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao criar promoção');
    }
    return res.json();
  },

  updatePromotion: async (id: number, data: UpdatePromotionInput): Promise<PromotionWithProducts> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/crm/promotions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao atualizar promoção #${id}`);
    }
    return res.json();
  },

  deletePromotion: async (id: number): Promise<{ message: string; id: number }> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/crm/promotions/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao excluir promoção #${id}`);
    }
    return res.json();
  },

  evaluateCart: async (data: {
    items: CartItemInput[];
    customerId?: number;
    storeId?: number;
    referenceDate?: string;
  }): Promise<CartEvaluationResult> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/crm/promotions/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao avaliar carrinho com regras promocionais');
    }
    return res.json();
  },

  // Adesão a Tratamento Contínuo
  getUpcomingRefills: async (params?: {
    daysAhead?: number;
    storeId?: number;
    status?: string;
  }): Promise<UpcomingRefillItem[]> => {
    const base = getBaseUrl();
    const query = new URLSearchParams();
    if (params?.daysAhead !== undefined) query.append('daysAhead', String(params.daysAhead));
    if (params?.storeId !== undefined) query.append('storeId', String(params.storeId));
    if (params?.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${base}/api/crm/treatments/upcoming${qs}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao buscar tratamentos com recompra próxima');
    }
    return res.json();
  },

  getCustomerTreatments: async (customerId: number): Promise<PatientTreatment[]> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/crm/treatments/customer/${customerId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao buscar tratamentos do cliente #${customerId}`);
    }
    return res.json();
  },

  markTreatmentContacted: async (treatmentId: number, notes?: string): Promise<PatientTreatment> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/crm/treatments/${treatmentId}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao registrar contato do tratamento #${treatmentId}`);
    }
    return res.json();
  },

  discontinueTreatment: async (treatmentId: number, reason?: string): Promise<PatientTreatment> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/crm/treatments/${treatmentId}/discontinue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao descontinuar tratamento #${treatmentId}`);
    }
    return res.json();
  },

  getTreatmentSlip: async (treatmentId: number): Promise<TreatmentSlipReceiptResult> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/crm/treatments/${treatmentId}/slip`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao gerar filipeta térmica do tratamento #${treatmentId}`);
    }
    return res.json();
  },
};

export const deliveryApi = {
  // Pedidos
  getOrders: async (filters?: DeliveryOrderFilters): Promise<DeliveryOrder[]> => {
    const base = getBaseUrl();
    const params = new URLSearchParams();
    if (filters?.storeId) params.append('storeId', String(filters.storeId));
    if (filters?.courierId) params.append('courierId', String(filters.courierId));
    if (filters?.customerId) params.append('customerId', String(filters.customerId));
    if (filters?.paymentMethod) params.append('paymentMethod', filters.paymentMethod);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        filters.status.forEach((s) => params.append('status', s));
      } else {
        params.append('status', filters.status);
      }
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${base}/api/delivery/orders${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao buscar pedidos de tele-entrega');
    }
    return res.json();
  },

  getOrderById: async (id: number): Promise<DeliveryOrder> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/orders/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao buscar pedido #${id}`);
    }
    return res.json();
  },

  createOrder: async (data: CreateDeliveryOrderInput): Promise<DeliveryOrder> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao criar pedido de tele-entrega');
    }
    return res.json();
  },

  updateOrderStatus: async (id: number, data: UpdateOrderStatusInput): Promise<DeliveryOrder> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao atualizar status do pedido #${id}`);
    }
    return res.json();
  },

  cancelOrder: async (id: number, reason?: string): Promise<DeliveryOrder> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/orders/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao cancelar pedido #${id}`);
    }
    return res.json();
  },

  getOrderSlip: async (id: number): Promise<OrderSlipResponse> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/orders/${id}/slip`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao obter etiqueta do pedido #${id}`);
    }
    return res.json();
  },

  // Entregadores
  getCouriers: async (filters?: CourierFilters): Promise<Courier[]> => {
    const base = getBaseUrl();
    const params = new URLSearchParams();
    if (filters?.storeId) params.append('storeId', String(filters.storeId));
    if (filters?.activeOnly !== undefined) params.append('activeOnly', String(filters.activeOnly));
    if (filters?.status) params.append('status', filters.status);
    if (filters?.vehicleType) params.append('vehicleType', filters.vehicleType);
    if (filters?.search) params.append('search', filters.search);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${base}/api/delivery/couriers${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao buscar entregadores');
    }
    return res.json();
  },

  getCourierById: async (id: number): Promise<Courier> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/couriers/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao buscar entregador #${id}`);
    }
    return res.json();
  },

  createCourier: async (data: CreateCourierInput): Promise<Courier> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/couriers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao cadastrar entregador');
    }
    return res.json();
  },

  updateCourier: async (id: number, data: UpdateCourierInput): Promise<Courier> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/couriers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao atualizar entregador #${id}`);
    }
    return res.json();
  },

  updateCourierStatus: async (id: number, status: CourierStatus): Promise<Courier> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/couriers/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao atualizar status do entregador #${id}`);
    }
    return res.json();
  },

  // Zonas
  getZones: async (storeId?: number, activeOnly?: boolean): Promise<DeliveryZone[]> => {
    const base = getBaseUrl();
    const params = new URLSearchParams();
    if (storeId) params.append('storeId', String(storeId));
    if (activeOnly !== undefined) params.append('activeOnly', String(activeOnly));
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${base}/api/delivery/zones${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao buscar zonas de entrega');
    }
    return res.json();
  },

  createZone: async (data: CreateDeliveryZoneInput): Promise<DeliveryZone> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/zones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao cadastrar zona de entrega');
    }
    return res.json();
  },

  updateZone: async (id: number, data: UpdateDeliveryZoneInput): Promise<DeliveryZone> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/zones/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao atualizar zona de entrega #${id}`);
    }
    return res.json();
  },

  deleteZone: async (id: number): Promise<{ success: boolean; message: string }> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/zones/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao excluir zona de entrega #${id}`);
    }
    return res.json();
  },

  calculateDeliveryFee: async (data: CalculateFeeInput): Promise<CalculateFeeResult> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/zones/calculate-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao calcular taxa de entrega');
    }
    return res.json();
  },

  // Despachos & Acertos
  getDispatches: async (filters?: { storeId?: number; courierId?: number; status?: DispatchStatus }): Promise<DeliveryDispatch[]> => {
    const base = getBaseUrl();
    const params = new URLSearchParams();
    if (filters?.storeId) params.append('storeId', String(filters.storeId));
    if (filters?.courierId) params.append('courierId', String(filters.courierId));
    if (filters?.status) params.append('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${base}/api/delivery/dispatches${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao buscar romaneios de despacho');
    }
    return res.json();
  },

  getDispatchById: async (id: number): Promise<DeliveryDispatchWithOrders> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/dispatches/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao buscar romaneio #${id}`);
    }
    return res.json();
  },

  createDispatch: async (data: CreateDispatchInput): Promise<DeliveryDispatchWithOrders> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/dispatches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || 'Falha ao criar romaneio de despacho');
    }
    return res.json();
  },

  getDispatchSlip: async (id: number): Promise<DispatchSlipResponse> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/dispatches/${id}/slip`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao obter comprovante do romaneio #${id}`);
    }
    return res.json();
  },

  settleDispatch: async (id: number, data: SettleDispatchParams): Promise<SettlementResult> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/delivery/dispatches/${id}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || err?.error || `Falha ao liquidar romaneio #${id}`);
    }
    return res.json();
  },
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
  getStores,
  getStoreById,
  createStore,
  updateStore,
  getNetworkProductStock,
  getTransfers,
  getTransferById,
  createTransfer,
  dispatchTransfer,
  receiveTransfer,
  cancelTransfer,
  getTransferSlip,
  emitTransferNfe,
  getInventorySessions,
  getInventorySessionById,
  createInventorySession,
  addInventoryCount,
  recountInventoryItem,
  finishInventoryCount,
  applyInventoryAdjustments,
  cancelInventorySession,
  getInventoryReport,
  stores: storesApi,
  transfers: transfersApi,
  inventory: inventoryApi,
  storesApi,
  transfersApi,
  inventoryApi,
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
  credit: creditApi,
  creditApi,
  crm: crmApi,
  crmApi,
  delivery: deliveryApi,
  deliveryApi,
};

export default api;
