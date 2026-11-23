export type RawMaterialBatchStatus = 'QUARANTINE' | 'APPROVED' | 'REJECTED';

export type CompoundingOrderStatus =
  | 'QUOTATION'
  | 'AWAITING_WEIGHING'
  | 'IN_MANIPULATION'
  | 'QUALITY_CONTROL'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface RawMaterial {
  id: number;
  dcb?: string | null;
  cas_number?: string | null;
  name: string;
  apparent_density: number;
  default_unit: string;
  cost_per_unit: number;
  is_active: number | boolean;
}

export interface RawMaterialBatch {
  id: number;
  raw_material_id: number;
  raw_material_name?: string;
  batch_number: string;
  supplier: string;
  manufacturer?: string | null;
  potency_percent: number;
  moisture_percent: number;
  molecular_weight_salt?: number | null;
  molecular_weight_base?: number | null;
  report_number: string;
  expiration_date: string;
  status: RawMaterialBatchStatus;
  rejection_reason?: string | null;
  released_by?: string | null;
  released_at?: string | null;
  current_stock: number;
}

export interface CompoundingOrderItem {
  id: number;
  order_id: number;
  raw_material_id: number;
  raw_material_name?: string;
  batch_number?: string;
  batch_id?: number | null;
  prescribed_dose: number;
  unit: string;
  factor_correction: number;
  factor_equivalence: number;
  corrected_dose_per_unit: number;
  total_dose_to_weigh: number;
  weighed_amount?: number | null;
  weighed_by?: string | null;
  weighed_at?: string | null;
  status: 'PENDING' | 'WEIGHED';
}

export interface CompoundingOrder {
  id: number;
  store_id: number;
  order_number: string;
  patient_name: string;
  patient_document?: string | null;
  prescriber_name: string;
  prescriber_crm: string;
  prescriber_uf: string;
  pharmaceutical_form: string;
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
  created_at: string;
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
