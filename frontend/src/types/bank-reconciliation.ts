export type BankAccountType = 'CHECKING' | 'SAVINGS' | 'PAYMENT';

export type BankTransactionType = 'CREDIT' | 'DEBIT' | 'OTHER';

export type BankReconciliationStatus =
  | 'MATCHED'
  | 'UNMATCHED'
  | 'MANUAL_MATCH'
  | 'BANK_FEE'
  | 'IGNORED';

export type BankReconciliationType =
  | 'TEF_SETTLEMENT'
  | 'CASH_DRAWER'
  | 'PURCHASE_PAYMENT'
  | 'CUSTOMER_CREDIT'
  | 'MANUAL'
  | 'BANK_FEE';

export interface BankAccount {
  id: number;
  storeId: number;
  bankCode: string;
  bankName: string;
  agencyNumber: string;
  accountNumber: string;
  accountType: BankAccountType;
  initialBalance: number;
  currentBalance: number;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BankStatementBatch {
  id: number;
  bankAccountId: number;
  batchCode: string;
  fileName: string;
  periodStart: string;
  periodEnd: string;
  ledgerBalance: number;
  totalEntries: number;
  matchedEntries: number;
  unmatchedEntries: number;
  importedAt: string;
  account?: BankAccount;
}

export interface BankStatementEntry {
  id: number;
  batchId: number;
  bankAccountId: number;
  fitid: string;
  transactionType: BankTransactionType;
  postedDate: string;
  amount: number;
  documentNumber?: string | null;
  memo: string;
  reconciliationStatus: BankReconciliationStatus;
  reconciliationType?: BankReconciliationType | null;
  matchedEntityId?: number | null;
  matchedNotes?: string | null;
  reconciledAt?: string | null;
  createdAt: string;
}

export interface CashFlowDailySummary {
  date: string;
  openingBalance: number;
  realizedInflow: number;
  realizedOutflow: number;
  realizedNet: number;
  closingBalance: number;
  projectedInflow: number;
  projectedOutflow: number;
  projectedClosingBalance: number;
  status: 'SURPLUS' | 'WARNING' | 'DEFICIT';
}

export interface CashFlowOverview {
  currentBankBalances: {
    accountId: number;
    bankName: string;
    accountNumber: string;
    balance: number;
  }[];
  totalLiquidBankBalance: number;
  totalCashDrawerBalance: number;
  totalCurrentAssets: number;
  projections30Days: CashFlowDailySummary[];
}
