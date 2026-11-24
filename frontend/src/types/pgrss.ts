export type WasteGroup =
  | 'GRUPO_B_QUIMICO'
  | 'GRUPO_A_BIOLOGICO'
  | 'GRUPO_E_PERFUROCORTANTE';

export type DisposalReason =
  | 'VENCIDO'
  | 'AVARIADO'
  | 'RECALL_ANVISA'
  | 'SOBRA_MANIPULACAO'
  | 'CONTAMINADO';

export type DisposalStatus = 'STORED' | 'DISPATCHED' | 'INCINERATED';

export type ManifestStatus = 'DISPATCHED' | 'DESTINED' | 'CANCELLED';

export interface PgrssDisposalRecord {
  id: number;
  store_id: number;
  product_id: number;
  batch_id?: number | null;
  waste_group: WasteGroup;
  reason: DisposalReason;
  quantity: number;
  weight_kg: number;
  pharmacist_name: string;
  pharmacist_crf: string;
  status: DisposalStatus;
  notes?: string | null;
  created_at: string;
  product_name?: string;
  product_ean?: string;
  batch_number?: string;
  store_name?: string;
}

export interface PgrssManifest {
  id: number;
  store_id: number;
  manifest_number: string;
  collector_name: string;
  collector_cnpj: string;
  environmental_license: string;
  vehicle_plate: string;
  driver_name: string;
  total_weight_kg: number;
  total_items: number;
  dispatch_date: string;
  status: ManifestStatus;
  cdf_number?: string | null;
  certificate_date?: string | null;
  incineration_plant?: string | null;
  created_at: string;
  items?: PgrssDisposalRecord[];
  store_name?: string;
}

export interface PgrssKpis {
  stored_records_count: number;
  stored_weight_kg: number;
  dispatched_records_count: number;
  dispatched_weight_kg: number;
  incinerated_records_count: number;
  incinerated_weight_kg: number;
  active_manifests_count: number;
  finalized_manifests_count: number;
}
