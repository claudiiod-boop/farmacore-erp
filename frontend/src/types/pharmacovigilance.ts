export type PatientGender = 'M' | 'F' | 'OTHER';
export type SeverityLevel = 'MILD' | 'MODERATE' | 'SEVERE';
export type SeriousCriteria = 'HOSPITALIZATION' | 'LIFE_THREATENING' | 'DEATH' | 'CONGENITAL_ANOMALY' | 'NONE';
export type DechallengeStatus = 'IMPROVED' | 'NOT_IMPROVED' | 'NOT_APPLICABLE' | 'UNKNOWN';
export type RechallengeStatus = 'RECURRED' | 'NOT_RECURRED' | 'NOT_REEXPOSED' | 'UNKNOWN';
export type ReactionOutcome = 'RECOVERED' | 'RECOVERING' | 'NOT_RECOVERED' | 'FATAL' | 'UNKNOWN';
export type NotivisaStatus = 'DRAFT' | 'SUBMITTED' | 'ACKNOWLEDGED';

export interface AdverseDrugReaction {
  id: number;
  store_id: number | null;
  protocol_code: string;
  patient_initials: string;
  patient_age?: number | null;
  patient_gender: PatientGender;
  is_pregnant: number;
  suspected_drug_name: string;
  suspected_drug_batch: string;
  suspected_drug_manufacturer?: string | null;
  daily_dose: string;
  treatment_start_date: string;
  treatment_end_date?: string | null;
  therapeutic_indication?: string | null;
  concomitant_drugs?: string | null;
  reaction_description: string;
  reaction_onset_date: string;
  severity_level: SeverityLevel;
  serious_criteria?: string | null;
  dechallenge_status: DechallengeStatus;
  rechallenge_status: RechallengeStatus;
  outcome: ReactionOutcome;
  notifier_pharmacist_name: string;
  notifier_pharmacist_crf: string;
  notivisa_submission_status: NotivisaStatus;
  notivisa_protocol?: string | null;
  created_at: string;
}

export type ComplaintType =
  | 'PHYSICAL_CHEMICAL_ALTERATION'
  | 'FOREIGN_MATTER'
  | 'COLOR_OR_ODOR_CHANGE'
  | 'PACKAGING_OR_SEAL_DEFECT'
  | 'LABELING_INACCURACY'
  | 'LACK_OF_THERAPEUTIC_EFFICACY'
  | 'SUSPECTED_COUNTERFEIT';

export type ReporterType = 'CUSTOMER' | 'EMPLOYEE' | 'PRESCRIBER';

export interface TechnicalComplaint {
  id: number;
  store_id: number | null;
  protocol_code: string;
  product_name: string;
  product_ean?: string | null;
  batch_number: string;
  manufacturer: string;
  expiration_date: string;
  complaint_type: ComplaintType;
  description: string;
  sample_available_for_pickup: number;
  quarantine_auto_blocked: number;
  reporter_type: ReporterType;
  reporter_name?: string | null;
  notifier_pharmacist_crf: string;
  notivisa_submission_status: NotivisaStatus;
  notivisa_protocol?: string | null;
  created_at: string;
}

export interface PharmacovigilanceSummary {
  totalRams: number;
  severeRams: number;
  totalComplaints: number;
  pendingSubmissionCount: number;
  recentRams: AdverseDrugReaction[];
  recentComplaints: TechnicalComplaint[];
}
