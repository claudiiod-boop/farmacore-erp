/**
 * Tipos e interfaces de domínio do Gateway de Convênios Farmacêuticos (PBM)
 * e Farmácia Popular do Brasil (Portaria MS nº 184/2011 / Denasus).
 */

export type PbmProviderId = 'FARMACIA_POPULAR' | 'VIDALINK' | 'EPHARMA' | 'FUNCIONAL' | 'MOCK';

export type PbmEnvironment = 'PRODUCAO' | 'HOMOLOGACAO' | 'MOCK';

export type PbmTransactionStatus = 'AUTHORIZED' | 'CONFIRMED' | 'CANCELLED' | 'REJECTED';

export type PbmProgramType = 'GRATUITO' | 'CO_PAGAMENTO' | 'DESCONTO_CONVENIO';

export type PbmItemStatus = 'APROVADO' | 'REJEITADO';

export interface PbmConfig {
  id: number;
  providerId: string;
  providerName: string;
  environment: PbmEnvironment;
  isActive: number;
  credentialsJson?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PbmTransaction {
  id: number;
  transactionUuid: string;
  providerId: string;
  saleId?: number | null;
  authorizationProtocol: string;
  receiptNumber?: string | null;
  status: PbmTransactionStatus;
  patientCpf: string;
  patientName: string;
  patientBirthDate?: string | null;
  doctorCrm: string;
  doctorUf: string;
  doctorName?: string | null;
  prescriptionDate: string;
  proxyName?: string | null;
  proxyCpf?: string | null;
  fiscalKeyNfce?: string | null;
  nfceNumber?: number | null;
  totalGrossAmount: number;
  subsidyAmount: number;
  patientCopayAmount: number;
  rejectionReason?: string | null;
  cancellationProtocol?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  confirmedAt?: string | null;
}

export interface PbmTransactionItem {
  id: number;
  pbmTransactionId: number;
  productId: number;
  batchId?: number | null;
  ean: string;
  msRegistration: string;
  productName: string;
  dailyDose: number;
  authorizedQuantity: number;
  unitGrossPrice: number;
  totalGrossPrice: number;
  referenceUnitPrice: number;
  subsidyUnitPrice: number;
  subsidyTotalPrice: number;
  patientUnitPrice: number;
  patientTotalPrice: number;
  programType: PbmProgramType;
  createdAt: string;
}

export interface PbmItemRequest {
  productId: number;
  ean: string;
  msRegistration: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  dailyDose?: number; // Posologia diária (ex: 1 comprimido ao dia)
  batchId?: number;
}

export interface PbmAuthorizeParams {
  providerId: PbmProviderId | string;
  patientCpf: string;
  patientName: string;
  patientBirthDate?: string; // YYYY-MM-DD
  doctorCrm: string;
  doctorUf: string;
  doctorName?: string;
  prescriptionDate: string; // YYYY-MM-DD
  proxyName?: string;
  proxyCpf?: string;
  isBolsaFamilia?: boolean;
  cidLaudo?: string;
  items: PbmItemRequest[];
}

export interface PbmItemResult {
  productId: number;
  ean: string;
  msRegistration: string;
  productName: string;
  batchId?: number;
  dailyDose: number;
  authorizedQuantity: number;
  unitGrossPrice: number;
  totalGrossPrice: number;
  referenceUnitPrice: number;
  subsidyUnitPrice: number;
  subsidyTotalPrice: number;
  patientUnitPrice: number;
  patientTotalPrice: number;
  programType: PbmProgramType;
  status: PbmItemStatus;
  rejectReason?: string;
}

export interface PbmAuthorizationResult {
  success: boolean;
  transactionUuid: string;
  authorizationProtocol: string;
  providerId: string;
  patientCpf: string;
  patientName: string;
  totalGrossAmount: number;
  subsidyAmount: number;
  patientCopayAmount: number;
  items: PbmItemResult[];
  errorMessage?: string;
}

export interface PbmConfirmParams {
  authorizationProtocol: string;
  saleId: number;
  fiscalKeyNfce?: string;
  nfceNumber?: number;
}

export interface PbmConfirmResult {
  success: boolean;
  authorizationProtocol: string;
  receiptNumber: string;
  confirmedAt: string;
  errorMessage?: string;
}

export interface PbmCancelParams {
  protocol: string;
  reason: string;
}

export interface PbmCancelResult {
  success: boolean;
  cancellationProtocol?: string;
  message?: string;
  errorMessage?: string;
}

export interface PbmProvider {
  providerId: string;
  providerName: string;
  authorize(params: PbmAuthorizeParams): Promise<PbmAuthorizationResult>;
  confirm(params: PbmConfirmParams): Promise<PbmConfirmResult>;
  cancel(protocol: string, reason: string): Promise<PbmCancelResult>;
}

export interface StoreInfo {
  name: string;
  cnpj: string;
  ie?: string;
  address: string;
  pharmacistName?: string;
  pharmacistCrf?: string;
  pharmacistUf?: string;
}
