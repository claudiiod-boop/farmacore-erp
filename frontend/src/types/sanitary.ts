export type AnvisaRecallStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export type AnvisaRecallActionTaken = 'BLOCKED' | 'RETURNED_TO_SUPPLIER' | 'DESTROYED';

export type InventoryLossReason =
  | 'EXPIRED'
  | 'BROKEN_DAMAGED'
  | 'RECALL_ANVISA'
  | 'TEMPERATURE_EXCURSION'
  | 'THEFT_STOLEN'
  | 'OTHER';

export type InventoryLossStatus = 'DRAFT' | 'APPROVED' | 'DISPOSED';

export type ExpiryRiskCategory =
  | 'EXPIRED'
  | 'RISK_30_DAYS'
  | 'RISK_60_DAYS'
  | 'RISK_90_DAYS'
  | 'SAFE';

export type BatchActionSuggestion =
  | 'DISPOSE'
  | 'PROMOTION'
  | 'RETURN_TO_SUPPLIER'
  | 'NORMAL';

export interface AnvisaRecallItem {
  id: number;
  recallId: number;
  productId: number;
  productName?: string;
  ean?: string;
  batchNumber: string;
  actionTaken: AnvisaRecallActionTaken;
  totalStockBlocked: number;
  blockedAt: string;
}

export interface AnvisaRecallWithItems {
  id: number;
  resolutionNumber: string;
  resolutionDate: string;
  publicationDate: string;
  reason: string;
  status: AnvisaRecallStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items: AnvisaRecallItem[];
}

export interface InventoryLossItem {
  id: number;
  lossId: number;
  productId: number;
  productName: string;
  batchId?: number | null;
  batchNumber: string;
  expirationDate: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  unitSalePrice: number;
  totalSalePrice: number;
  createdAt: string;
}

export interface InventoryLossWithItems {
  id: number;
  lossNumber: string;
  storeId: number;
  reason: InventoryLossReason;
  status: InventoryLossStatus;
  totalCostAmount: number;
  totalSaleAmount: number;
  responsiblePharmacistName: string;
  pharmacistCrf: string;
  pharmacistCrfUf: string;
  laudoNumber?: string | null;
  disposalCompanyName?: string | null;
  disposalCertificateNumber?: string | null;
  mtrNumber?: string | null;
  disposedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items: InventoryLossItem[];
}

export interface AffectedPatientItem {
  customerId?: number | null;
  customerName: string;
  cpf?: string | null;
  phone?: string | null;
  saleId: number;
  saleFiscalNumber?: string | null;
  saleDate: string;
  quantity: number;
  hasPrescription: boolean;
  prescriptionDoctor?: string | null;
}

export interface ExpiryRiskTierSummary {
  category: ExpiryRiskCategory;
  label: string;
  minDays: number;
  maxDays: number;
  batchCount: number;
  unitCount: number;
  totalCost: number;
  totalSale: number;
}

export interface ExpiryRiskMatrix {
  referenceDate: string;
  storeId?: number;
  tiers: Record<ExpiryRiskCategory, ExpiryRiskTierSummary>;
  totalBatches: number;
  totalUnits: number;
  totalCostAmount: number;
  totalSaleAmount: number;
}

export interface ExpiringBatchItem {
  batchId: number;
  batchNumber: string;
  productId: number;
  productName: string;
  ean: string;
  manufacturer?: string | null;
  expirationDate: string;
  daysUntilExpiration: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
  unitSalePrice: number;
  totalSalePrice: number;
  category: ExpiryRiskCategory;
  suggestedAction: BatchActionSuggestion;
  isBlocked: boolean;
}

export interface ExpiryFilters {
  storeId?: number;
  category?: ExpiryRiskCategory;
  maxDays?: number;
  search?: string;
  page?: number;
  limit?: number;
  referenceDate?: string;
}

export interface RegisterRecallInput {
  resolutionNumber: string;
  resolutionDate: string;
  publicationDate: string;
  reason: string;
  notes?: string;
  items: Array<{ productId: number; batchNumber: string }>;
}

export interface CreateLossItemInput {
  productId: number;
  batchId?: number | null;
  batchNumber: string;
  expirationDate: string;
  quantity: number;
  unitCost: number;
  unitSalePrice: number;
}

export interface CreateLossDraftInput {
  storeId: number;
  reason: InventoryLossReason;
  responsiblePharmacistName: string;
  pharmacistCrf: string;
  pharmacistCrfUf: string;
  notes?: string;
  items: CreateLossItemInput[];
}

export interface ApproveLossParams {
  approvedByPharmacistName?: string;
  pharmacistCrf?: string;
  pharmacistCrfUf?: string;
  notes?: string;
}

export interface DisposalCertificateParams {
  disposalCompanyName: string;
  disposalCertificateNumber: string;
  mtrNumber?: string;
  laudoNumber?: string;
  disposedAt?: string;
  notes?: string;
}
