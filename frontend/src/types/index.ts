export type StationMode =
  | 'COUNTER'
  | 'POS'
  | 'PURCHASES'
  | 'SNGPC'
  | 'FINANCIAL'
  | 'STORES'
  | 'INVENTORY'
  | 'CREDIT'
  | 'CRM'
  | 'DELIVERY'
  | 'SANITARY'
  | 'CARD_RECONCILIATION'
  | 'BANK_RECONCILIATION'
  | 'SPED_FISCAL'
  | 'CLINICAL_CONSULTING'
  | 'B2B_QUOTATIONS'
  | 'CMED_PRICING'
  | 'OMNICHANNEL_PICK_PACK'
  | 'COMPOUNDING_MAGISTRAL'
  | 'SUBSCRIPTION_CLUB'
  | 'FRACTIONATION_RDC80'
  | 'SALES_COMMISSIONS'
  | 'FINANCIAL_DRE'
  | 'PGRSS_DISPOSAL'
  | 'KIOSK_TERMINAL'
  | 'BMPO_REGULATORY'
  | 'SNCM_TRACEABILITY'
  | 'SMART_REPLENISHMENT'
  | 'CUSTOMER_RETURNS'
  | 'QUARANTINE_REGULATORY'
  | 'TEMPERATURE_MONITORING'
  | 'SANITIZATION_COMPLIANCE'
  | 'INJECTABLES_VACCINATION'
  | 'PHARMACOVIGILANCE_NOTIVISA'
  | 'MARKETPLACE_HUB'
  | 'BACKUP_DISASTER_RECOVERY'
  | 'SELF_CHECKOUT_TOUCH'
  | 'DDA_RECONCILIATION'
  | 'SANITARY_AUDIT_DOSSIER'
  | 'CORPORATE_AGREEMENTS_BILLING';
export type PaymentMethod =
  | 'DINHEIRO'
  | 'CARTAO_CREDITO'
  | 'CARTAO_DEBITO'
  | 'PIX'
  | 'CONVENIO_PBM'
  | 'CONVENIO'
  | 'CREDIARIO';

export * from './financial';
export * from './stores';
export * from './transfers';
export * from './inventory';
export * from './credit';
export * from './crm';
export * from './delivery';
export * from './sped';
export * from './clinical';
export * from './b2b';
export * from './cmed';
export * from './omnichannel';
export * from './compounding';
export * from './dda';
export * from './sanitary-audit';

// ===================== PRODUCT & CATALOG TYPES =====================
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

// ===================== PURCHASES & NF-e TYPES =====================
export interface PurchaseInvoice {
  id: number;
  accessKey: string;
  invoiceNumber: number;
  invoiceSeries: number;
  issueDate: string;
  supplierCnpj: string;
  supplierName: string;
  supplierIe?: string | null;
  totalInvoiceAmount: number;
  totalProductsAmount: number;
  totalIcmsSt: number;
  xmlContent: string;
  createdAt?: string;
}

export interface PurchaseInvoiceItem {
  id: number;
  purchaseInvoiceId: number;
  productId: number;
  batchId?: number | null;
  itemIndex: number;
  supplierProductCode: string;
  ean: string;
  productName: string;
  ncm: string;
  cfop: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  batchNumber?: string | null;
  expirationDate?: string | null;
  manufacturingDate?: string | null;
  anvisaRegistration?: string | null;
  pmc?: number | null;
  createdAt?: string;
}

export interface ParsedNfeItem {
  itemIndex: number;
  supplierProductCode: string;
  ean: string;
  productName: string;
  ncm: string;
  cfop: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  batchNumber?: string | null;
  expirationDate?: string | null;
  manufacturingDate?: string | null;
  anvisaRegistration?: string | null;
  pmc?: number | null;
}

export interface ParsedNfeInvoice {
  accessKey: string;
  invoiceNumber: number;
  invoiceSeries: number;
  issueDate: string;
  supplierCnpj: string;
  supplierName: string;
  supplierIe?: string | null;
  totalInvoiceAmount: number;
  totalProductsAmount: number;
  totalIcmsSt: number;
  items: ParsedNfeItem[];
}

export interface PurchasePreviewItem extends ParsedNfeItem {
  productId?: number | null;
  isExistingProduct: boolean;
  cmedWarning?: string | null;
  suggestedPrice?: number | null;
}

export interface PurchasePreviewResult {
  accessKey: string;
  invoiceNumber: number;
  invoiceSeries: number;
  issueDate: string;
  supplierCnpj: string;
  supplierName: string;
  totalInvoiceAmount: number;
  totalProductsAmount: number;
  totalIcmsSt: number;
  items: PurchasePreviewItem[];
  newProductsCount: number;
  existingProductsCount: number;
  hasCmedAlerts: boolean;
}

export interface PurchaseImportOptions {
  autoRegisterProducts?: boolean;
  itemClassifications?: Record<string, { stripe: string; controlType: string }>;
}

export interface PurchaseImportResult {
  invoiceId: number;
  accessKey: string;
  batchesCreatedCount: number;
  productsRegisteredCount: number;
  totalItems: number;
}

export interface PurchaseInvoiceSummary {
  id: number;
  accessKey: string;
  invoiceNumber: number;
  invoiceSeries: number;
  issueDate: string;
  supplierCnpj: string;
  supplierName: string;
  supplierIe?: string | null;
  totalInvoiceAmount: number;
  totalProductsAmount: number;
  totalIcmsSt: number;
  itemsCount: number;
  createdAt: string;
}

export interface PurchaseInvoiceDetails extends PurchaseInvoice {
  items: (PurchaseInvoiceItem & {
    batch?: {
      id: number;
      batchNumber: string;
      manufacturingDate: string;
      expirationDate: string;
      quantity: number;
    } | null;
  })[];
}

// ===================== SNGPC & REGULATORY TYPES =====================
export type SngpcMovementType = 'ENTRADA' | 'SAIDA_VENDA' | 'PERDA';
export type SngpcReferenceType = 'PURCHASE_INVOICE' | 'SALE' | 'INVENTORY_ADJUSTMENT';
export type SngpcTransmissionStatus = 'GERADO' | 'TRANSMITIDO' | 'CONFIRMADO' | 'REJEITADO';

export interface SngpcMovement {
  id: number;
  movementType: SngpcMovementType;
  productId: number;
  batchId: number;
  quantity: number;
  referenceType: SngpcReferenceType;
  referenceId: number;
  movementDate: string;
  msRegistration: string;
  prescriptionId?: number | null;
  isTransmitted: number; // 0 = Não transmitido, 1 = Transmitido
  transmissionId?: number | null;
  createdAt?: string;
  productName?: string;
  batchNumber?: string;
}

export interface SngpcTransmission {
  id: number;
  startDate: string;
  endDate: string;
  pharmacistName: string;
  pharmacistCpf: string;
  pharmacistCrf: string;
  pharmacistCrfUf: string;
  xmlContent: string;
  status: SngpcTransmissionStatus;
  hashXml: string;
  createdAt?: string;
}

export interface SngpcTransmissionParams {
  startDate: string;
  endDate: string;
  pharmacistName: string;
  pharmacistCpf: string;
  pharmacistCrf: string;
  pharmacistCrfUf: string;
}

export interface SngpcLivroItem {
  date: string;
  movementType: SngpcMovementType;
  documentNumber: string;
  productName: string;
  msRegistration: string;
  batchNumber: string;
  initialBalance: number;
  entryQuantity: number;
  exitQuantity: number;
  finalBalance: number;
  doctorName?: string | null;
  doctorCrm?: string | null;
  doctorUf?: string | null;
  buyerName?: string | null;
  buyerCpf?: string | null;
}

export interface SngpcLivroRegistro {
  pharmacyCnpj: string;
  pharmacyName: string;
  pharmacistName: string;
  pharmacistCrf: string;
  pharmacistCrfUf: string;
  startDate: string;
  endDate: string;
  openingTerm?: string;
  closingTerm?: string;
  items: SngpcLivroItem[];
}

// ===================== PBM & CONVÊNIOS TYPES =====================
export * from './pbm';

// ===================== TEF & CARD GATEWAY TYPES =====================
export * from './tef';

// ===================== COMPOUNDING & SUBSCRIPTIONS TYPES =====================
export * from './compounding';
export * from './dda';
export * from './sanitary-audit';
export * from './subscription';
export * from './fractionation';
export * from './commission';
export * from './dre';
export * from './pgrss';
export * from './kiosk';
export * from './bmpo';
export * from './sncm';
export * from './replenishment';
export * from './returns';
export * from './quarantine';
export * from './temperature';
export * from './digital-prescription';
export * from './sanitization';
export * from './injectables';
export * from './pharmacovigilance';
export * from './marketplace';
export * from './backup';
export * from './self-checkout';
export * from './agreements';

