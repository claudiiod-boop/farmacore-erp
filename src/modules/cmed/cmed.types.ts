// ============================================================================
// Tipos de Domínio: Tabela Oficial CMED / ANVISA & Precificação Farmacêutica
// Lei Federal 10.742/2003, Resoluções CMED e Lei 10.147/2000 (PIS/COFINS)
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
  productName: string;
  presentation?: string;
  substanceName: string;
  laboratoryName: string;
  therapeuticClass?: string;
  productType: CmedProductType;
  listType: CmedListType;
  hasStIcms?: boolean;
  pf0?: number;
  pf12?: number;
  pf17?: number;
  pf175?: number;
  pf18?: number;
  pf19?: number;
  pf20?: number;
  pf21?: number;
  pf22?: number;
  pmc0?: number;
  pmc12?: number;
  pmc17?: number;
  pmc175?: number;
  pmc18?: number;
  pmc19?: number;
  pmc20?: number;
  pmc21?: number;
  pmc22?: number;
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
