// ============================================================================
// Tipos de Domínio: Central de Cotação B2B, Reposição Inteligente & EDI Farma
// Padrão InovaFarma / Linx Farma Big / Trier
// ============================================================================

export type AbcClassification = 'A' | 'B' | 'C';

export type QuotationCampaignStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'AWAITING_RESPONSES'
  | 'ANALYZED'
  | 'CLOSED';

export type ProposalStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'REJECTED'
  | 'AWARDED'
  | 'PARTIAL_AWARDED';

export type RuptureRisk = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface B2bSupplier {
  id?: number;
  code: string;
  name: string;
  tradeName?: string;
  cnpj: string;
  ediCode?: string;
  ediLayout?: string;
  minOrderValue?: number;
  leadTimeDays?: number;
  paymentTerms?: string;
  email?: string;
  phone?: string;
  active?: boolean;
  createdAt?: string;
}

export interface B2bReplenishmentRule {
  id?: number;
  storeId: number;
  productId: number;
  minStock: number;
  safetyStock: number;
  leadTimeDays: number;
  coverageDays: number;
  targetStock: number;
  abcClass?: AbcClassification;
  createdAt?: string;
}

export interface ReplenishmentSuggestion {
  productId: number;
  ean: string;
  productName: string;
  stripe?: string;
  currentStock: number;
  inTransitStock: number;
  averageDailySales: number; // Consumo Médio Diário (CMD)
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number; // Ponto de Pedido (PP)
  suggestedQuantity: number;
  ruptureRisk: RuptureRisk;
  estimatedDaysUntilRupture: number;
  lastPurchasePrice?: number;
  currentCost?: number;
  abcClass: AbcClassification;
}

export interface B2bQuotationItem {
  id?: number;
  campaignId?: number;
  productId: number;
  productName?: string;
  ean?: string;
  currentStock: number;
  suggestedQuantity: number;
  requestedQuantity: number;
  targetPrice?: number;
  createdAt?: string;
}

export interface B2bQuotationProposalItem {
  id?: number;
  proposalId?: number;
  quotationItemId: number;
  productId: number;
  productName?: string;
  ean?: string;
  offeredPrice: number;
  discountPercent: number;
  netUnitPrice: number;
  availableQuantity: number;
  stIcmsIncluded?: boolean;
  isWinner?: boolean;
  createdAt?: string;
}

export interface B2bQuotationProposal {
  id?: number;
  campaignId: number;
  supplierId: number;
  supplierName?: string;
  supplierCnpj?: string;
  proposalCode: string;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  paymentTerms?: string;
  deliveryDays?: number;
  status: ProposalStatus;
  ediFileRef?: string;
  items?: B2bQuotationProposalItem[];
  createdAt?: string;
}

export interface B2bQuotationCampaign {
  id?: number;
  campaignCode: string;
  storeId: number;
  title: string;
  status: QuotationCampaignStatus;
  notes?: string;
  createdAt?: string;
  closedAt?: string;
  items?: B2bQuotationItem[];
  proposals?: B2bQuotationProposal[];
}

export interface ItemSplitWinner {
  quotationItemId: number;
  productId: number;
  productName: string;
  ean: string;
  requestedQuantity: number;
  winningSupplierId: number;
  winningSupplierName: string;
  unitPrice: number;
  netUnitPrice: number;
  totalItemAmount: number;
  savingsVsHighest: number;
}

export interface SupplierOrderSummary {
  supplierId: number;
  supplierName: string;
  supplierCnpj: string;
  minOrderValue: number;
  itemsCount: number;
  totalOrderAmount: number;
  meetsMinOrder: boolean;
  paymentTerms?: string;
  items: Array<{
    productId: number;
    productName: string;
    ean: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }>;
}

export interface QuotationOptimizationResult {
  campaignId: number;
  optimizationMode: 'SPLIT_ORDER' | 'SINGLE_SUPPLIER_BEST_TOTAL';
  totalCampaignSavings: number;
  awardedOrders: SupplierOrderSummary[];
  unattendedItems: Array<{
    productId: number;
    productName: string;
    requestedQuantity: number;
    reason: string;
  }>;
}

export interface EdiQuotationLine {
  ean: string;
  supplierItemCode?: string;
  description: string;
  quantityRequested: number;
  targetPrice?: number;
}

export interface EdiProposalLine {
  ean: string;
  offeredPrice: number;
  discountPercent?: number;
  availableQuantity: number;
  stIcmsIncluded?: boolean;
}
