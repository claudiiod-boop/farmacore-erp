export type RawMaterialBatchStatus = 'QUARANTINE' | 'APPROVED' | 'REJECTED';

export type CompoundingOrderStatus =
  | 'QUOTATION'
  | 'AWAITING_WEIGHING'
  | 'IN_MANIPULATION'
  | 'QUALITY_CONTROL'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PharmaceuticalForm =
  | 'CAPSULA'
  | 'XAROPE'
  | 'POMADA'
  | 'GEL'
  | 'LOCAO'
  | 'SOLUCAO';

export interface RawMaterial {
  id?: number;
  dcb?: string | null;
  cas_number?: string | null;
  name: string;
  apparent_density: number; // g/mL
  default_unit: string;
  cost_per_unit: number;
  is_active: number | boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RawMaterialBatch {
  id?: number;
  raw_material_id: number;
  batch_number: string;
  supplier: string;
  manufacturer?: string | null;
  potency_percent: number; // Teor (%)
  moisture_percent: number; // Umidade (%)
  molecular_weight_salt?: number | null;
  molecular_weight_base?: number | null;
  report_number: string;
  expiration_date: string;
  status: RawMaterialBatchStatus;
  rejection_reason?: string | null;
  released_by?: string | null;
  released_at?: string | null;
  current_stock: number;
  created_at?: string;
  updated_at?: string;
  raw_material_name?: string;
}

export interface CompoundingOrderItem {
  id?: number;
  order_id?: number;
  raw_material_id: number;
  batch_id?: number | null;
  prescribed_dose: number;
  unit: string;
  factor_correction: number;
  factor_equivalence: number;
  corrected_dose_per_unit: number; // mg
  total_dose_to_weigh: number; // mg ou g
  weighed_amount?: number | null;
  weighed_by?: string | null;
  weighed_at?: string | null;
  status: 'PENDING' | 'WEIGHED';
  raw_material_name?: string;
  batch_number?: string;
}

export interface CompoundingOrder {
  id?: number;
  store_id: number;
  order_number: string;
  patient_name: string;
  patient_document?: string | null;
  prescriber_name: string;
  prescriber_crm: string;
  prescriber_uf: string;
  pharmaceutical_form: PharmaceuticalForm;
  total_units: number;
  capsule_size?: string | null;
  target_weight_per_unit?: number | null;
  actual_average_weight?: number | null;
  quality_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  status: CompoundingOrderStatus;
  subtotal: number;
  packaging_cost: number;
  pharmaceutical_fee: number;
  total_amount: number;
  directions: string;
  warnings?: string | null;
  pharmacist_responsible?: string | null;
  manipulated_at?: string | null;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
  items?: CompoundingOrderItem[];
}

export interface CapsuleCalculationResult {
  totalMassPerCapsuleMg: number;
  totalVolumePerCapsuleMl: number;
  selectedCapsuleSize: string;
  capsuleCapacityMl: number;
  excipientVolumePerCapsuleMl: number;
  excipientMassPerCapsuleMg: number;
  totalExcipientToWeighG: number;
  targetCapsuleWeightMg: number;
}
