// FarmaCore ERP — Tipos de Dominio Financeiro & Gerencial (Fase 8)

export type PharmaceuticalCategory =
  | 'REFERENCIA'
  | 'GENERICO'
  | 'SIMILAR'
  | 'PERFUMARIA'
  | 'CORRELATOS_OUTROS';

export type DifferenceStatus = 'EXACT' | 'SURPLUS' | 'SHORTAGE';

export type ClosureReviewStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export type TefSettlementStatus = 'PENDING' | 'SETTLED' | 'DIVERGENT';

export type AbcClass = 'A' | 'B' | 'C';

// --- 1. Fechamento Cego de Caixa ---

export interface CashClosure {
  id: number;
  cashSessionId: number;
  operatorName: string;
  declaredAt: string;

  // Valores declarados pelo operador (contagem cega)
  declaredCash: number;
  declaredCredit: number;
  declaredDebit: number;
  declaredPix: number;
  declaredPbm: number;
  totalDeclared: number;
  operatorNotes?: string | null;

  // Valores apurados pelo sistema no momento do fechamento
  systemCash: number;
  systemCredit: number;
  systemDebit: number;
  systemPix: number;
  systemPbm: number;
  systemSupplies: number;
  systemSangrias: number;
  totalSystem: number;

  // Quebra / Sobra
  cashDifference: number; // declaredCash - systemCash
  totalDifference: number; // totalDeclared - totalSystem
  differenceStatus: DifferenceStatus;

  // Homologacao Gerencial
  managerName?: string | null;
  managerNotes?: string | null;
  status: ClosureReviewStatus;
  reviewedAt?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface DeclareBlindClosureParams {
  sessionId: number;
  operatorName: string;
  declaredCash: number;
  declaredCredit: number;
  declaredDebit: number;
  declaredPix: number;
  declaredPbm: number;
  operatorNotes?: string | null;
}

export interface ReviewClosureParams {
  managerName: string;
  approved: boolean;
  managerNotes?: string | null;
}

export interface CashClosureFilters {
  status?: ClosureReviewStatus;
  differenceStatus?: DifferenceStatus;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface StoreInfo {
  storeName?: string;
  name?: string;
  cnpj?: string;
  address?: string;
  city?: string;
  phone?: string;
}

// --- 2. Conciliacao Financeira TEF ---

export interface ForecastFilters {
  startDate?: string;
  endDate?: string;
  acquirerName?: string;
  operationType?: string;
}

export interface ReceivablesForecastItem {
  expectedSettlementDate: string;
  acquirerName: string;
  operationType: string;
  transactionCount: number;
  grossAmount: number;
  estimatedFee: number;
  netAmount: number;
}

export interface ReceivablesForecastSummary {
  items: ReceivablesForecastItem[];
  totalGross: number;
  totalEstimatedFee: number;
  totalNet: number;
  totalTransactions: number;
}

export interface SettleTransactionParams {
  settledAmount: number;
  settledFee?: number;
  bankAccount?: string;
  settledAt?: string;
}

export interface ReconciliationFilters {
  settlementStatus?: TefSettlementStatus;
  acquirerName?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ReconciliationSummary {
  totalPending: number;
  totalSettled: number;
  totalDivergent: number;
  pendingCount: number;
  settledCount: number;
  divergentCount: number;
}

// --- 3. DRE Gerencial & Curva ABC ---

export interface DreReport {
  startDate: string;
  endDate: string;
  grossRevenue: number;
  discounts: number;
  cancellations: number;
  tefFees: number;
  netRevenue: number;
  cmv: number;
  grossProfit: number;
  grossMarginPercent: number;
  operatingExpenses: number;
  netOperatingProfit: number;
  netMarginPercent: number;
  salesCount: number;
  itemsSold: number;
}

export interface AbcCurveItem {
  productId: number;
  ean: string;
  productName: string;
  category: PharmaceuticalCategory;
  quantitySold: number;
  grossRevenue: number;
  revenueSharePercent: number;
  cumulativeRevenuePercent: number;
  abcClass: AbcClass;
  unitCostAverage: number;
  totalCost: number;
  grossProfit: number;
  marginPercent: number;
}

export interface AbcCategorySummary {
  category: PharmaceuticalCategory;
  grossRevenue: number;
  revenueSharePercent: number;
  quantitySold: number;
  grossProfit: number;
  marginPercent: number;
}

export interface AbcCurveReport {
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  overallMarginPercent: number;
  totalProductsCount: number;
  classACount: number;
  classBCount: number;
  classCCount: number;
  items: AbcCurveItem[];
  categoriesSummary: AbcCategorySummary[];
}
