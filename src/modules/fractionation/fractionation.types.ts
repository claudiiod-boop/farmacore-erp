export interface FractionableProduct {
  id: number;
  ean: string;
  name: string;
  active_ingredient?: string | null;
  ms_registration?: string | null;
  stripe?: string | null;
  price: number;
  is_fractionable: number; // 0 ou 1
  units_per_package: number;
  fractional_unit: string;
}

export interface FractionationRecord {
  id: number;
  store_id: number;
  product_id: number;
  original_batch_id: number;
  pharmacist_name: string;
  pharmacist_crf: string;
  pharmacist_crf_uf: string;
  original_packages_opened: number;
  units_generated: number;
  units_available: number;
  sub_batch_code: string;
  fractionation_date: string;
  expiry_date: string;
  notes?: string | null;
  created_at: string;
  // Detalhes enriquecidos
  product_name?: string;
  product_ean?: string;
  ms_registration?: string;
  original_batch_number?: string;
}

export interface FractionationDispensation {
  id: number;
  fractionation_record_id: number;
  sale_id?: number | null;
  pre_sale_id?: number | null;
  patient_name: string;
  patient_cpf?: string | null;
  doctor_name: string;
  doctor_crm: string;
  doctor_uf: string;
  units_dispensed: number;
  unit_price: number;
  total_price: number;
  leaflet_supplied: number; // 0 ou 1
  posology: string;
  dispensed_at: string;
  // Enriquecidos
  product_name?: string;
  sub_batch_code?: string;
  original_batch_number?: string;
  expiry_date?: string;
}

export interface FractionateMedicineInput {
  store_id: number;
  product_id: number;
  original_batch_id: number;
  pharmacist_name: string;
  pharmacist_crf: string;
  pharmacist_crf_uf: string;
  original_packages_opened: number;
  notes?: string;
}

export interface DispenseFractionedInput {
  fractionation_record_id: number;
  patient_name: string;
  patient_cpf?: string;
  doctor_name: string;
  doctor_crm: string;
  doctor_uf: string;
  units_dispensed: number;
  posology: string;
  leaflet_supplied?: boolean;
  sale_id?: number;
  pre_sale_id?: number;
}

export interface FractionationKpis {
  totalFractionations: number;
  activeSubBatches: number;
  totalUnitsAvailable: number;
  totalDispensations: number;
  fractionableProductsCount: number;
  estimatedConsumerSavings: number; // Economia estimada gerada
}
