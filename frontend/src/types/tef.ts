export type TefOperationType = 'DEBITO' | 'CREDITO' | 'VOUCHER' | 'PIX_TEF';

export type TefInstallmentType = 'A_VISTA' | 'PARCELADO_LOJA' | 'PARCELADO_ADM';

export type TefTransactionStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CONFIRMED'
  | 'REVERSED'
  | 'CANCELLED'
  | 'FAILED';

export type TefMockScenario =
  | 'SUCCESS'
  | 'WRONG_PIN'
  | 'INSUFFICIENT_FUNDS'
  | 'TIMEOUT'
  | 'USER_CANCELLED';

export interface TefPayParams {
  amount: number;
  operationType: TefOperationType;
  installments?: number;
  installmentType?: TefInstallmentType;
  terminalId?: string;
  providerId?: string;
  saleId?: number;
  brandName?: string;
  mockScenario?: TefMockScenario;
}

export interface TefPayResult {
  success: boolean;
  transactionUuid: string;
  nsu: string;
  hostNsu: string;
  authorizationCode: string;
  brandName: string;
  brandCodeSefaz: string; // '01'=Visa, '02'=Master, '06'=Elo, etc.
  acquirerName: string;
  acquirerCnpj: string;   // 14 dígitos sem formatação
  cardLastFour: string;
  amount: number;
  installments: number;
  customerReceipt: string;
  merchantReceipt: string;
  mdrRate?: number;
  netAmount?: number;
  expectedSettlementDate?: string;
  errorMessage?: string;
  operationType?: TefOperationType;
}

export interface TefConfirmParams {
  nsu: string;
  saleId: number;
  fiscalKeyNfce?: string;
}

export interface TefConfirmResult {
  success: boolean;
  nsu: string;
  confirmedAt: string;
  errorMessage?: string;
}

export interface TefUndoParams {
  nsu: string;
  reason: string;
}

export interface TefUndoResult {
  success: boolean;
  nsu: string;
  reversedAt: string;
  reversalReason: string;
  errorMessage?: string;
}

export interface TefCancelParams {
  nsu: string;
  reason: string;
}

export interface TefCancelResult {
  success: boolean;
  nsu: string;
  cancellationNsu: string;
  cancelledAt: string;
  cancellationReceipt: string;
  errorMessage?: string;
}

export interface TefConfig {
  id: number;
  providerId: string;
  providerName: string;
  environment: 'PRODUCAO' | 'HOMOLOGACAO' | 'MOCK';
  terminalId?: string;
  merchantId?: string | null;
  ipAddress?: string;
  port?: number;
  isActive: boolean | number;
  credentialsJson?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TefTransaction {
  id: number;
  transactionUuid: string;
  providerId: string;
  terminalId: string;
  saleId?: number | null;
  paymentId?: number | null;
  operationType: TefOperationType;
  status: TefTransactionStatus;
  amount: number;
  installments: number;
  installmentType?: TefInstallmentType;
  brandName: string;
  brandCodeSefaz: string;
  acquirerName: string;
  acquirerCnpj: string;
  authorizationCode: string;
  nsu: string;
  hostNsu: string;
  cardLastFour?: string | null;
  customerReceipt?: string | null;
  merchantReceipt?: string | null;
  cancellationReceipt?: string | null;
  failureReason?: string | null;
  reversalReason?: string | null;
  cancellationNsu?: string | null;
  cancellationReason?: string | null;
  mdrRate?: number;
  netAmount?: number | null;
  expectedSettlementDate?: string | null;
  batchNumber?: string | null;
  createdAt: string;
  confirmedAt?: string | null;
  reversedAt?: string | null;
  cancelledAt?: string | null;
}

export interface TefReceiptResult {
  customerReceipt: string;
  merchantReceipt: string;
  fullEscPos: string;
}

export interface TefListFilters {
  startDate?: string;
  endDate?: string;
  status?: TefTransactionStatus | string;
  operationType?: TefOperationType | string;
  brandName?: string;
  acquirerName?: string;
  saleId?: number;
  terminalId?: string;
  nsu?: string;
  limit?: number;
  offset?: number;
}
