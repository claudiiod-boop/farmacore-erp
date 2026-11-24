export type DigitalPrescriptionType =
  | 'ANTIMICROBIAL'
  | 'CONTROLLED_B1'
  | 'CONTROLLED_C1'
  | 'REGULAR';

export type DigitalPrescriptionStatus =
  | 'VALID'
  | 'DISPENSED'
  | 'EXPIRED'
  | 'REVOKED';

export interface DigitalPrescriptionItem {
  id?: number;
  prescription_id?: number;
  medication_name: string;
  product_id?: number | null;
  dosage?: string | null;
  quantity_prescribed: number;
  quantity_dispensed?: number;
  instructions?: string | null;
}

export interface DigitalPrescription {
  id: number;
  prescription_code: string;
  access_token?: string | null;
  prescriber_name: string;
  prescriber_crm: string;
  prescriber_uf: string;
  prescriber_cpf?: string | null;
  patient_name: string;
  patient_cpf?: string | null;
  patient_birth_date?: string | null;
  icp_signature_valid: boolean;
  icp_cert_issuer: string;
  icp_signed_at: string;
  prescription_type: DigitalPrescriptionType;
  issued_at: string;
  expires_at: string;
  status: DigitalPrescriptionStatus;
  dispensed_at?: string | null;
  dispensed_store_id?: number | null;
  dispensed_pharmacist_crf?: string | null;
  dispensed_pre_sale_id?: number | null;
  created_at: string;
  updated_at: string;
  items?: DigitalPrescriptionItem[];
}

export interface ValidatePrescriptionResult {
  isValid: boolean;
  canDispense: boolean;
  status: DigitalPrescriptionStatus;
  message: string;
  prescription?: DigitalPrescription;
}

export interface DispensePrescriptionInput {
  storeId: number;
  pharmacistName: string;
  pharmacistCrf: string;
  preSaleId?: number;
}
