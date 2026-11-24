export type CleaningType = 'ROUTINE' | 'TERMINAL' | 'IMMEDIATE';
export type SanitizationStatus = 'PENDING' | 'COMPLETED' | 'NON_CONFORMING';

export interface SanitizationLog {
  id: number;
  store_id: number | null;
  sector_name: string;
  cleaning_type: CleaningType;
  scheduled_date: string;
  execution_timestamp: string;
  chemical_product: string;
  dilution_or_batch?: string | null;
  performed_by: string;
  verified_by_pharmacist?: string | null;
  verified_at?: string | null;
  status: SanitizationStatus;
  notes?: string | null;
  created_at: string;
}

export interface CreateSanitizationLogInput {
  storeId?: number;
  sectorName: string;
  cleaningType: CleaningType;
  scheduledDate: string;
  executionTimestamp?: string;
  chemicalProduct: string;
  dilutionOrBatch?: string;
  performedBy: string;
  verifiedByPharmacist?: string;
  status?: SanitizationStatus;
  notes?: string;
}

export type ComplianceValidityStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';

export interface PestControlCertificate {
  id: number;
  store_id: number | null;
  service_provider_name: string;
  service_provider_cnpj: string;
  sanitary_license_number: string;
  certificate_number: string;
  application_date: string;
  expiration_date: string;
  target_pests: string;
  chemical_agents_used: string;
  antidote_information?: string | null;
  technical_responsible_pest: string;
  pharmacist_approval_crf: string;
  status: ComplianceValidityStatus;
  notes?: string | null;
  created_at: string;
}

export interface CreatePestControlInput {
  storeId?: number;
  serviceProviderName: string;
  serviceProviderCnpj: string;
  sanitaryLicenseNumber: string;
  certificateNumber: string;
  applicationDate: string;
  expirationDate?: string; // se omitido, calcula 180 dias
  targetPests: string;
  chemicalAgentsUsed: string;
  antidoteInformation?: string;
  technicalResponsiblePest: string;
  pharmacistApprovalCrf: string;
  notes?: string;
}

export type PotabilityStatus = 'POTABLE_COMPLIANT' | 'NON_POTABLE_CONTAMINATED' | 'PENDING_LAB';

export interface WaterTankCleaningLog {
  id: number;
  store_id: number | null;
  service_provider: string;
  cleaning_date: string;
  expiration_date: string;
  potability_report_number?: string | null;
  potability_status: PotabilityStatus;
  responsible_cleaner: string;
  pharmacist_crf: string;
  status: ComplianceValidityStatus;
  notes?: string | null;
  created_at: string;
}

export interface CreateWaterTankCleaningInput {
  storeId?: number;
  serviceProvider: string;
  cleaningDate: string;
  expirationDate?: string; // se omitido, calcula 180 dias
  potabilityReportNumber?: string;
  potabilityStatus?: PotabilityStatus;
  responsibleCleaner: string;
  pharmacistCrf: string;
  notes?: string;
}

export type SopCategory =
  | 'HIGIENE_AMBIENTAL'
  | 'SERVICOS_FARMACEUTICOS'
  | 'TERMOLABEIS'
  | 'DESCARTE_RESIDUOS'
  | 'DISPENSACAO'
  | 'GERAL';

export type SopStatus = 'ACTIVE' | 'NEEDS_REVISION' | 'ARCHIVED';

export interface StandardOperatingProcedure {
  id: number;
  store_id: number | null;
  sop_code: string;
  title: string;
  category: SopCategory;
  version: string;
  effective_date: string;
  next_review_date: string;
  author_name: string;
  reviewer_pharmacist_crf: string;
  content_summary: string;
  status: SopStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateSopInput {
  storeId?: number;
  sopCode: string;
  title: string;
  category: SopCategory;
  version?: string;
  effectiveDate: string;
  nextReviewDate?: string; // se omitido, calcula 365 dias
  authorName: string;
  reviewerPharmacistCrf: string;
  contentSummary: string;
  notes?: string;
}

export interface SanitaryComplianceOverview {
  overallCompliant: boolean;
  score: number; // 0 a 100%
  pestControl: {
    activeCertificate: PestControlCertificate | null;
    status: ComplianceValidityStatus;
    daysRemaining: number;
  };
  waterTank: {
    activeLog: WaterTankCleaningLog | null;
    status: ComplianceValidityStatus;
    daysRemaining: number;
  };
  sanitizationsMonth: {
    totalCompleted: number;
    pendingOrNonConforming: number;
  };
  sops: {
    totalActive: number;
    needsRevisionCount: number;
  };
}
