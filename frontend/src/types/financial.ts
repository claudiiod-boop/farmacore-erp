export type CashClosureStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export type CashClosureDifferenceStatus = 'EXACT' | 'SURPLUS' | 'SHORTAGE';
export type TefSettlementStatus = 'PENDING' | 'SETTLED' | 'DIVERGENT';

export interface BlindCashClosure {
  id: number;
  cashSessionId: number;
  operatorName: string;
  closedAt: string;
  // Totais apurados pelo sistema
  systemCash: number;
  systemCredit: number;
  systemDebit: number;
  systemPix: number;
  systemPbm: number;
  systemTotal: number;
  // Totais declarados as cegas pelo operador
  declaredCash: number;
  declaredCredit: number;
  declaredDebit: number;
  declaredPix: number;
  declaredPbm: number;
  declaredTotal: number;
  // Diferenca apurada
  cashDifference: number;
  totalDifference: number;
  differenceStatus: CashClosureDifferenceStatus;
  // Auditoria e homologacao
  status: CashClosureStatus;
  operatorNotes?: string | null;
  managerName?: string | null;
  managerNotes?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface DeclareBlindClosureInput {
  sessionId: number;
  operatorName: string;
  declaredCash: number;
  declaredCredit: number;
  declaredDebit: number;
  declaredPix: number;
  declaredPbm: number;
  operatorNotes?: string | null;
}

export interface ReviewClosureInput {
  managerName: string;
  approved: boolean;
  managerNotes?: string | null;
}

export interface CashClosureFilters {
  status?: CashClosureStatus;
  differenceStatus?: CashClosureDifferenceStatus;
  startDate?: string;
  endDate?: string;
  operatorName?: string;
  limit?: number;
  offset?: number;
}

// --- TEF & Conciliacao ---

export interface TefReceivablesForecastItem {
  expectedSettlementDate: string;
  acquirerName: string;
  operationType: string;
  transactionCount: number;
  grossAmount: number;
  estimatedFee: number;
  netAmount: number;
}

export interface TefReceivablesForecastSummary {
  items: TefReceivablesForecastItem[];
  totalGross: number;
  totalEstimatedFee: number;
  totalNet: number;
  totalTransactions: number;
}

export interface TefReconciliationTransaction {
  id: number;
  transactionUuid: string;
  terminalId: string;
  operationType: 'CREDITO' | 'DEBITO' | 'PIX_TEF';
  status: 'PENDING' | 'CONFIRMED' | 'REVERSED' | 'CANCELLED';
  amount: number;
  brandName?: string | null;
  acquirerName?: string | null;
  nsu: string;
  hostNsu?: string | null;
  mdrRate?: number | null;
  netAmount?: number | null;
  expectedSettlementDate?: string | null;
  settlementStatus: TefSettlementStatus;
  settledAmount?: number | null;
  settledFee?: number | null;
  settledAt?: string | null;
  bankAccount?: string | null;
  createdAt: string;
  confirmedAt?: string | null;
}

export interface TefSettlementInput {
  nsu: string;
  settledAmount: number;
  settledFee?: number;
  bankAccount?: string;
  settledAt?: string;
}

export interface TefReconciliationSummary {
  totalPending: number;
  totalSettled: number;
  totalDivergent: number;
  pendingCount: number;
  settledCount: number;
  divergentCount: number;
}

// --- DRE & Curva ABC ---

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
  operatingResult: number;
  operatingMarginPercent: number;
}

export interface AbcCurveItem {
  rank: number;
  productId: number;
  ean: string;
  productName: string;
  category: 'REFERENCIA' | 'GENERICO' | 'SIMILAR' | 'PERFUMARIA' | 'CORRELATOS_OUTROS';
  quantitySold: number;
  grossRevenue: number;
  revenueSharePercent: number;
  cumulativeSharePercent: number;
  abcClass: 'A' | 'B' | 'C';
}

export interface AbcCategorySummary {
  category: 'REFERENCIA' | 'GENERICO' | 'SIMILAR' | 'PERFUMARIA' | 'CORRELATOS_OUTROS';
  itemCount: number;
  totalRevenue: number;
  revenueSharePercent: number;
}

export interface AbcCurveReport {
  startDate: string;
  endDate: string;
  categoryFilter?: string | null;
  totalRevenue: number;
  totalItemsSold: number;
  items: AbcCurveItem[];
  classCounts: {
    A: number;
    B: number;
    C: number;
  };
  classRevenues: {
    A: number;
    B: number;
    C: number;
  };
  categoriesSummary: AbcCategorySummary[];
}
