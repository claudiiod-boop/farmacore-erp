export type PharmaceuticalRole = 'RT_TITULAR' | 'RT_SUBSTITUTO' | 'FARMACEUTICO_ASSISTENTE';

export type LogbookEntryType =
  | 'INSPECTION_CRF'
  | 'INSPECTION_VISA'
  | 'TEMPERATURE_EXCURSION'
  | 'RECALL_ALERT'
  | 'TECHNICAL_COMPLAINT'
  | 'DISPENSATION_INCIDENT'
  | 'GENERAL_OCCURRENCE';

export interface PharmaceuticalStaff {
  id: number;
  store_id: number;
  name: string;
  cpf: string;
  crf_number: string;
  crf_uf: string;
  role: PharmaceuticalRole;
  phone?: string | null;
  email?: string | null;
  crt_certificate_number?: string | null;
  crt_validity_date?: string | null;
  is_active: number;
  created_at: string;
}

export interface PharmaceuticalShift {
  id: number;
  store_id: number;
  staff_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: number;
  created_at: string;
  staff_name?: string;
  crf?: string;
}

export interface PharmaceuticalLogbookEntry {
  id: number;
  store_id: number;
  staff_id: number;
  entry_type: LogbookEntryType;
  title: string;
  description: string;
  crf_inspector_name?: string | null;
  crf_inspection_term_number?: string | null;
  action_taken?: string | null;
  entry_date: string;
  sha256_hash: string;
  created_at: string;
  staff_name?: string;
  crf?: string;
}

export interface RegisterStaffDTO {
  store_id: number;
  name: string;
  cpf: string;
  crf_number: string;
  crf_uf: string;
  role: PharmaceuticalRole;
  phone?: string;
  email?: string;
  crt_certificate_number?: string;
  crt_validity_date?: string;
}

export interface CreateLogbookEntryDTO {
  store_id: number;
  staff_id: number;
  entry_type: LogbookEntryType;
  title: string;
  description: string;
  crf_inspector_name?: string;
  crf_inspection_term_number?: string;
  action_taken?: string;
  entry_date?: string;
}

export interface AssistanceKpis {
  totalActivePharmacists: number;
  hasActiveRT: boolean;
  activeRtName?: string;
  crtCertificateNumber?: string;
  crtValidityDate?: string;
  crtDaysRemaining?: number;
  totalWeeklyHoursCovered: number;
  totalLogbookEntries: number;
  recentInspectionsCount: number;
}
