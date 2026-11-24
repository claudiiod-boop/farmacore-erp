export type QuarantineReason =
  | 'EXPIRED'
  | 'DAMAGED'
  | 'RECALL_ANVISA'
  | 'CUSTOMER_RETURN'
  | 'SUSPECTED_ADULTERATION'
  | 'TEMPERATURE_EXCURSION'
  | 'OTHER';

export type QuarantineOrigin =
  | 'INVENTORY_SWEEP'
  | 'CUSTOMER_RETURN'
  | 'INBOUND_INSPECTION'
  | 'MANUAL';

export type QuarantineStatus =
  | 'QUARANTINED'
  | 'DISPOSED_PGRSS'
  | 'RETURNED_TO_SUPPLIER'
  | 'RELEASED';

export type RecallSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface QuarantineRecord {
  id: number;
  store_id: number;
  product_id: number;
  batch_id: number;
  product_name?: string;
  ean?: string;
  batch_number?: string;
  expiration_date?: string;
  pmc?: number;
  quantity: number;
  reason: QuarantineReason;
  origin: QuarantineOrigin;
  status: QuarantineStatus;
  notes?: string | null;
  quarantined_by: string;
  quarantined_at: string;
  resolved_by?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  pgrss_disposal_id?: number | null;
  fiscal_nfe_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecallAlert {
  id: number;
  anvisa_re_number: string;
  publication_date: string;
  product_id: number;
  product_name?: string;
  ean?: string;
  batch_number: string;
  reason: string;
  severity: RecallSeverity;
  is_active: boolean;
  affected_units_blocked: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TransferToQuarantineInput {
  storeId: number;
  productId: number;
  batchId: number;
  quantity: number;
  reason: QuarantineReason;
  origin: QuarantineOrigin;
  notes?: string;
  quarantinedBy: string;
}

export interface ResolveQuarantineInput {
  resolution: 'DISPOSED_PGRSS' | 'RETURNED_TO_SUPPLIER' | 'RELEASED';
  resolvedBy: string;
  resolutionNotes?: string;
  pharmacistCrf?: string;
  fiscalNfeKey?: string;
  pgrssHazardGroup?: string;
}

export interface RegisterRecallAlertInput {
  anvisaReNumber: string;
  publicationDate: string;
  productId: number;
  batchNumber: string;
  reason: string;
  severity: RecallSeverity;
  createdBy: string;
  autoBlockStock?: boolean;
}

export interface QuarantineKpis {
  total_quarantined_items: number;
  total_quarantined_value: number;
  active_recalls_count: number;
  expired_items_in_quarantine: number;
  disposed_pgrss_items: number;
}
