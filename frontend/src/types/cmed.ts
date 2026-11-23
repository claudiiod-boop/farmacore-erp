// ============================================================================
// Tipos de Domínio: CMED / ANVISA & Gestão de Precificação Farmacêutica
// Lei Federal 10.742/2003, Resoluções CMED e Lei 10.147/2000
// ============================================================================

export type CmedProductType =
  | 'GENERICO'
  | 'SIMILAR'
  | 'NOVO'
  | 'BIOLOGICO'
  | 'ESPECIFICO'
  | 'OUTRO';

export type CmedListType = 'POSITIVA' | 'NEGATIVA' | 'NEUTRA';

export type CmedCategoryType =
  | 'GENERICO'
  | 'SIMILAR'
  | 'REFERENCIA'
  | 'MIP'
  | 'PERFUMARIA';

export type AuditStatus = 'ABOVE_PMC' | 'MARGIN_TOO_LOW' | 'COMPLIANT';

export interface CmedTableVersion {
  id?: number;
  versionCode: string;
  releaseDate: string;
  totalRecords?: number;
  fileHash?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface CmedProduct {
  id?: number;
  versionId: number;
  ean: string;
  msRegistration: string;
  product_name: string;
  presentation?: string;
  substance_name: string;
  laboratory_name: string;
  therapeutic_class?: string;
  product_type: CmedProductType;
  list_type: CmedListType;
  has_st_icms?: boolean;
  pf_18?: number;
  pmc_18?: number;
  pf_20?: number;
  pmc_20?: number;
  createdAt?: string;
}

export interface CmedPricingRule {
  id?: number;
  storeId: number;
  categoryType: CmedCategoryType;
  discountPercentPmc: number;
  targetMarkupPf?: number;
  minGrossMarginPercent: number;
  enforcePmcCap: boolean;
  createdAt?: string;
}

export interface CmedPriceAuditItem {
  productId: number;
  ean: string;
  productName: string;
  currentSalePrice: number;
  pmcAllowed: number;
  pfReference: number;
  productType?: CmedProductType;
  listType?: CmedListType;
  status: AuditStatus;
  priceExcessAmount: number;
  currentMarginPercent: number;
  suggestedSalePrice: number;
}

export interface CmedPricingAuditReport {
  storeId: number;
  icmsRate: number;
  totalProductsAudited: number;
  nonCompliantAbovePmcCount: number;
  lowMarginCount: number;
  compliantCount: number;
  items: CmedPriceAuditItem[];
}

export interface PmcValidationResult {
  isValid: boolean;
  ean: string;
  price: number;
  maxAllowedPmc: number;
  icmsRate: number;
  productName?: string;
  infractionWarning?: string;
}
