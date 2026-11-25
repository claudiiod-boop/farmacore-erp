export type SanitaryComplianceStatus = 'EXCELLENT' | 'WARNING' | 'CRITICAL_RISK';

export type SanitaryItemCategory =
  | 'COLD_CHAIN'
  | 'SNGPC'
  | 'POPS_CERTIFICATES'
  | 'PGRSS'
  | 'INJECTABLES'
  | 'PHARMACOVIGILANCE';

export type SanitaryItemStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'WARNING_EXPIRING';

export interface SanitaryAuditItem {
  id: string;
  audit_id: string;
  category: SanitaryItemCategory;
  item_description: string;
  status: SanitaryItemStatus;
  evidence_text?: string | null;
  corrective_action?: string | null;
  created_at: string;
}

export interface SanitaryAudit {
  id: string;
  store_id: string;
  audit_date: string;
  responsible_pharmacist_crf: string;
  responsible_pharmacist_name: string;
  overall_score: number; // 0 a 100
  compliance_status: SanitaryComplianceStatus;
  cold_chain_score: number;
  sngpc_score: number;
  pops_certificates_score: number;
  pgrss_score: number;
  injectables_score: number;
  pharmacovigilance_score: number;
  dossier_summary_json: string;
  action_plan_notes?: string | null;
  created_at: string;
  updated_at: string;
  items?: SanitaryAuditItem[];
}

export interface RunSanitaryScanInput {
  store_id: string;
  responsible_pharmacist_crf: string;
  responsible_pharmacist_name: string;
}

export interface SanitaryInspectionDossier {
  audit: SanitaryAudit;
  dossierSummary: {
    storeName: string;
    cnpj: string;
    crf: string;
    auditDate: string;
    score: number;
    status: SanitaryComplianceStatus;
    totalItems: number;
    compliantItems: number;
    nonCompliantItems: number;
    warningItems: number;
    pillars: Array<{
      category: SanitaryItemCategory;
      name: string;
      score: number;
      maxScore: number;
      percentage: number;
      itemsCount: number;
      nonCompliantCount: number;
    }>;
  };
  items: SanitaryAuditItem[];
  officialReportText: string;
}

export interface SanitaryDashboardKpis {
  last_audit_score: number;
  last_audit_status: SanitaryComplianceStatus;
  last_audit_date: string | null;
  total_audits_performed: number;
  pending_corrective_actions: number;
  category_health: {
    cold_chain: number;
    sngpc: number;
    pops_certificates: number;
    pgrss: number;
    injectables: number;
    pharmacovigilance: number;
  };
}
