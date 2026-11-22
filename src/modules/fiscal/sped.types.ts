export type SpedGenerationType = 'SPED_EFD' | 'SINTEGRA';
export type SpedProfile = 'A' | 'B' | 'C';
export type SpedPurpose = 0 | 1; // 0 = Remessa de arquivo original, 1 = Remessa de arquivo substituto (retificador)
export type SpedStatus = 'GENERATED' | 'VALIDATED' | 'TRANSMITTED';

export type AuditSeverity = 'ERROR' | 'WARNING' | 'INFO';
export type AuditEntityType = 'PRODUCT' | 'INVOICE' | 'INVENTORY' | 'ACCOUNTING';

export interface AccountingParameters {
  id?: number;
  storeId: number;
  accountantName: string;
  accountantCpf: string;
  accountantCrc: string;
  accountantCnpj?: string | null;
  accountantEmail?: string | null;
  accountantPhone?: string | null;
  accountantCep?: string | null;
  accountantAddress?: string | null;
  accountantCityCode?: number | null;
  spedProfile: SpedProfile;
  spedVersion: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SpedGenerationParams {
  storeId: number;
  generationType: SpedGenerationType;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  purpose?: SpedPurpose;
  includeInventory?: boolean;
  inventoryDate?: string; // YYYY-MM-DD (ex: 2026-12-31)
  notes?: string;
}

export interface SpedAuditDivergence {
  id?: number;
  generationId?: number;
  severity: AuditSeverity;
  entityType: AuditEntityType;
  entityId?: string;
  fieldName?: string;
  description: string;
  recommendation?: string;
  createdAt?: string;
}

export interface SpedGenerationRecord {
  id: number;
  storeId: number;
  generationType: SpedGenerationType;
  periodStart: string;
  periodEnd: string;
  purpose: SpedPurpose;
  fileName: string;
  fileContent: string;
  totalLines: number;
  totalDocuments: number;
  totalIcmsDebit: number;
  totalIcmsCredit: number;
  totalIcmsSt: number;
  inventoryDate?: string | null;
  totalInventoryValue: number;
  status: SpedStatus;
  notes?: string | null;
  createdAt: string;
  divergences?: SpedAuditDivergence[];
}

export interface InventoryItemBlockH {
  productId: number;
  internalCode: string;
  description: string;
  ean: string;
  unit: string;
  quantity: number;
  averageCost: number;
  totalValue: number;
  possessionIndicator: '0' | '1' | '2'; // 0 = Do informante em seu poder
  ncm: string;
  cest?: string;
}

export interface SpedValidationResult {
  isValid: boolean;
  totalErrors: number;
  totalWarnings: number;
  divergences: SpedAuditDivergence[];
}
