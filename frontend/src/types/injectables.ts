export type AdministrationRoute = 'INTRAMUSCULAR' | 'INTRAVENOSA' | 'SUBCUTANEA' | 'INTRADERMICA';
export type VaccineDoseType = 'DOSE_1' | 'DOSE_2' | 'DOSE_3' | 'REFRACTORY_BOOSTER' | 'SINGLE_DOSE';
export type SipniStatus = 'PENDING' | 'EXPORTED' | 'ACCEPTED' | 'REJECTED';

export interface InjectableAdministrationLog {
  id: number;
  store_id: number | null;
  patient_name: string;
  patient_cpf: string;
  patient_birth_date?: string | null;
  patient_phone?: string | null;
  medication_name: string;
  medication_dosage: string;
  medication_batch: string;
  medication_expiration_date: string;
  syringe_needle_batch: string;
  administration_route: AdministrationRoute;
  anatomical_site: string;
  prescriber_name: string;
  prescriber_crm: string;
  prescriber_uf: string;
  pharmacist_name: string;
  pharmacist_crf: string;
  declaration_number: string;
  adverse_reaction_observed: number;
  notes?: string | null;
  administered_at: string;
  created_at: string;
}

export interface VaccinationRecord {
  id: number;
  store_id: number | null;
  patient_name: string;
  patient_cpf: string;
  patient_birth_date: string;
  patient_phone?: string | null;
  vaccine_name: string;
  manufacturer: string;
  vaccine_batch: string;
  diluent_batch?: string | null;
  vaccine_expiration_date: string;
  dose_type: VaccineDoseType;
  administration_route: AdministrationRoute;
  anatomical_site: string;
  pre_triage_fever: number;
  pre_triage_allergies?: string | null;
  pharmacist_name: string;
  pharmacist_crf: string;
  certificate_code: string;
  sipni_status: SipniStatus;
  sipni_exported_at?: string | null;
  eapv_adverse_event: number;
  eapv_description?: string | null;
  administered_at: string;
  created_at: string;
}

export interface InjectablesVaccinationSummary {
  totalInjectablesMonth: number;
  totalVaccinesMonth: number;
  sipniPendingCount: number;
  recentInjectables: InjectableAdministrationLog[];
  recentVaccinations: VaccinationRecord[];
}
