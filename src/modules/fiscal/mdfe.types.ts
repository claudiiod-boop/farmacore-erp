export type MdfeStatus = 'DRAFT' | 'AUTHORIZED' | 'CLOSED' | 'CANCELLED';

export type MdfeEmissionType = 'NORMAL' | 'CONTINGENCY';

export interface MdfeDocument {
  id: number;
  store_id: number;
  mdfe_number: number;
  series: number;
  access_key: string;
  emission_type: MdfeEmissionType;
  uf_start: string;
  uf_end: string;
  driver_name: string;
  driver_cpf: string;
  vehicle_plate: string;
  vehicle_rntrc?: string | null;
  insurance_company_name?: string | null;
  insurance_policy_number?: string | null;
  total_nfe_count: number;
  total_cargo_value_brl: number;
  total_weight_kg: number;
  sefaz_status_code: string;
  sefaz_protocol?: string | null;
  status: MdfeStatus;
  xml_content?: string | null;
  damdfe_content?: string | null;
  closure_reason?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  closed_at?: string | null;
  cancelled_at?: string | null;
}

export interface MdfeNfeItem {
  id: number;
  mdfe_id: number;
  nfe_access_key: string;
  nfe_number?: number | null;
  transfer_id?: number | null;
  destination_store_id?: number | null;
  cargo_value_brl: number;
  weight_kg: number;
  created_at: string;
}

export interface CreateMdfeNfeItemDTO {
  nfe_access_key: string;
  nfe_number?: number;
  transfer_id?: number;
  destination_store_id?: number;
  cargo_value_brl: number;
  weight_kg: number;
}

export interface CreateMdfeDraftInput {
  store_id: number;
  series?: number;
  emission_type?: MdfeEmissionType;
  uf_start: string;
  uf_end: string;
  driver_name: string;
  driver_cpf: string;
  vehicle_plate: string;
  vehicle_rntrc?: string;
  insurance_company_name?: string;
  insurance_policy_number?: string;
  items: CreateMdfeNfeItemDTO[];
}

export interface CloseMdfeInput {
  closure_reason?: string;
  closure_uf?: string;
}

export interface CancelMdfeInput {
  justification: string;
}

export interface MdfeKpis {
  total_manifests: number;
  authorized_in_transit: number;
  closed_count: number;
  cancelled_count: number;
  total_transported_cargo_brl: number;
  total_transported_weight_kg: number;
}
