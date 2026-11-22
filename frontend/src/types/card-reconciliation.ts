export type CardOperationType = 'DEBIT' | 'CREDIT' | 'PIX' | 'VOUCHER';

export type ReconciliationStatus =
  | 'CONCILIATED'
  | 'DIVERGENT_FEE'
  | 'CHARGEBACK'
  | 'NOT_FOUND_IN_ERP'
  | 'CANCELLED';

export type StatementFileType = 'EDI_CONCIL' | 'EXTRATO_CSV' | 'API_ONLINE';

export interface AcquirerFeeRule {
  id: number;
  contractId: number;
  brandName: string;
  operationType: CardOperationType;
  installmentMin: number;
  installmentMax: number;
  mdrRate: number;
  fixedFee: number;
  settlementDays?: number | null;
  isActive: boolean;
  createdAt?: string;
}

export interface AcquirerContract {
  id: number;
  storeId: number;
  acquirerName: string;
  acquirerCnpj: string;
  merchantCode?: string | null;
  defaultBankName: string;
  defaultBankAgency: string;
  defaultBankAccount: string;
  debitSettlementDays: number;
  creditSettlementDays: number;
  pixSettlementDays: number;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  rules?: AcquirerFeeRule[];
}

export interface CardSettlementEntry {
  id: number;
  batchId: number;
  tefTransactionId?: number | null;
  nsu: string;
  authorizationCode?: string | null;
  transactionDate: string;
  settlementDate: string;
  brandName: string;
  operationType: CardOperationType;
  installmentNumber: number;
  totalInstallments: number;
  grossAmount: number;
  chargedMdrRate: number;
  chargedFeeAmount: number;
  netAmount: number;
  contractMdrRate?: number | null;
  expectedFeeAmount?: number | null;
  expectedNetAmount?: number | null;
  divergenceAmount: number;
  reconciliationStatus: ReconciliationStatus;
  bankAccount?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface CardReconciliationBatch {
  id: number;
  storeId: number;
  acquirerContractId?: number | null;
  acquirerName?: string;
  batchCode: string;
  fileName: string;
  fileType: StatementFileType;
  periodStart: string;
  periodEnd: string;
  totalRecords: number;
  totalGrossAmount: number;
  totalNetAmount: number;
  totalFeeAmount: number;
  conciliatedCount: number;
  divergentCount: number;
  chargebackCount: number;
  notFoundCount: number;
  status: 'PROCESSING' | 'PROCESSED' | 'REVERTED';
  processedAt: string;
}

export interface ReceivablesCalendarDay {
  date: string;
  totalGross: number;
  totalFee: number;
  totalNet: number;
  transactionCount: number;
  byAcquirer: Record<string, { gross: number; net: number; count: number }>;
}

export interface DivergenceItem {
  id: number;
  batchId: number;
  batchCode: string;
  nsu: string;
  authorizationCode?: string | null;
  transactionDate: string;
  settlementDate: string;
  acquirerName: string;
  brandName: string;
  grossAmount: number;
  chargedMdrRate: number;
  contractMdrRate: number;
  chargedFeeAmount: number;
  expectedFeeAmount: number;
  divergenceAmount: number;
}

export interface DivergenceReport {
  totalDivergentCount: number;
  totalOverchargedAmount: number;
  items: DivergenceItem[];
}
