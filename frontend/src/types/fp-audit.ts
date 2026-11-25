export type FpSettlementStatus = 'IMPORTED' | 'RECONCILED' | 'DISCREPANT' | 'CONTESTED';

export type FpAuditItemStatus = 'APPROVED' | 'PARTIALLY_GLOSSED' | 'TOTALLY_GLOSSED' | 'CONTESTED';

export type FpDossierStatus = 'PENDING_DOCS' | 'ARCHIVED' | 'EXPIRING_RETENTION' | 'PURGED';

export interface FpSettlementBatch {
  id: number;
  store_id: number;
  batch_reference: string;
  competence_month: string;
  credit_date: string;
  total_authorized_amount: number;
  total_credited_amount: number;
  total_loss_amount: number;
  status: FpSettlementStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FpAuditItem {
  id: number;
  settlement_batch_id?: number | null;
  store_id: number;
  authorization_code: string;
  sale_id?: number | null;
  patient_cpf: string;
  patient_name: string;
  prescriber_crm: string;
  prescriber_uf: string;
  authorized_ms_amount: number;
  patient_copay_amount: number;
  credited_fns_amount: number;
  gloss_amount: number;
  gloss_reason?: string | null;
  contest_protocol?: string | null;
  contest_justification?: string | null;
  contest_date?: string | null;
  status: FpAuditItemStatus;
  created_at: string;
  updated_at: string;
}

export interface FpDigitalReceiptDossier {
  id: number;
  store_id: number;
  authorization_code: string;
  sale_id?: number | null;
  patient_cpf: string;
  patient_name: string;
  dispensation_date: string;
  retention_deadline: string;
  signed_coupon_file_path?: string | null;
  prescription_file_path?: string | null;
  id_document_file_path?: string | null;
  legal_representation_file_path?: string | null;
  sha256_integrity_hash: string;
  status: FpDossierStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportSettlementItemDTO {
  authorization_code: string;
  patient_cpf: string;
  patient_name: string;
  prescriber_crm: string;
  prescriber_uf: string;
  authorized_ms_amount: number;
  patient_copay_amount?: number;
  credited_fns_amount: number;
  gloss_reason?: string;
  sale_id?: number;
}

export interface ImportSettlementBatchInput {
  store_id: number;
  batch_reference: string;
  competence_month: string;
  credit_date: string;
  items: ImportSettlementItemDTO[];
  notes?: string;
}

export interface RegisterDossierInput {
  store_id: number;
  authorization_code: string;
  sale_id?: number;
  patient_cpf: string;
  patient_name: string;
  dispensation_date: string;
  signed_coupon_file_path?: string;
  prescription_file_path?: string;
  id_document_file_path?: string;
  legal_representation_file_path?: string;
  notes?: string;
}

export interface ContestGlossInput {
  justification: string;
  proof_file_reference?: string;
}

export interface FpAuditKpis {
  total_batches: number;
  total_reconciled_items: number;
  total_credited_amount: number;
  total_gloss_amount: number;
  gloss_rate_percentage: number;
  pending_dossiers_count: number;
  archived_dossiers_count: number;
}
