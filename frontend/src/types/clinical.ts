// ============================================================================
// Tipos de Domínio do Consultório Farmacêutico & Serviços Clínicos Avançados
// RDC ANVISA 777/2023, RDC 44/2009 e Resoluções CFF 585 e 586/2013
// ============================================================================

export type ClinicalProcedureType =
  | 'INJECTABLE'
  | 'BLOOD_PRESSURE'
  | 'CAPILLARY_GLUCOSE'
  | 'BODY_TEMPERATURE'
  | 'NEBULIZATION'
  | 'EAR_PIERCING'
  | 'WOUND_DRESSING';

export type RapidTestType =
  | 'GLUCOSE'
  | 'CHOLESTEROL'
  | 'TRIGLYCERIDES'
  | 'HEMOGLOBIN_GLYCATED'
  | 'COVID19_ANTIGEN'
  | 'COVID19_ANTIBODY'
  | 'INFLUENZA_AB'
  | 'DENGUE_NS1'
  | 'BETA_HCG'
  | 'STREP_A';

export type AttendanceStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ClinicalPharmacist {
  id?: number;
  storeId: number;
  name: string;
  cpf: string;
  crfNumber: string;
  crfUf: string;
  active?: boolean;
  createdAt?: string;
}

export interface ClinicalServiceCatalogItem {
  id?: number;
  storeId: number;
  serviceCode: string;
  serviceName: string;
  category: 'PROCEDURE' | 'RAPID_TEST' | 'CONSULTATION' | 'MONITORING';
  defaultPrice: number;
  active?: boolean;
}

export interface ClinicalProcedure {
  id?: number;
  attendanceId?: number;
  procedureType: ClinicalProcedureType;
  medicationName?: string;
  medicationBatch?: string;
  applicationSite?: string;
  prescriberName?: string;
  prescriberCrm?: string;
  notes?: string;
  price?: number;
}

export interface ClinicalRapidTest {
  id?: number;
  attendanceId?: number;
  testType: RapidTestType;
  reagentName: string;
  reagentBatch: string;
  reagentExpiration: string;
  reagentMsRegistration: string;
  resultValue: string;
  resultInterpretation: 'REACTIVE' | 'NON_REACTIVE' | 'INDETERMINATE' | 'NORMAL' | 'ALTERED';
  referenceRange?: string;
  notes?: string;
  price?: number;
}

export interface ClinicalAttendance {
  id?: number;
  attendanceCode?: string;
  storeId: number;
  pharmacistId: number;
  patientName: string;
  patientCpf: string;
  patientBirthDate?: string;
  patientPhone?: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  temperature?: number;
  bloodGlucose?: number;
  oxygenSaturation?: number;
  anamnesisNotes?: string;
  pharmacotherapeuticOrientation?: string;
  status?: AttendanceStatus;
  dsfNumber?: string;
  totalAmount?: number;
  createdAt?: string;
  completedAt?: string;
  pharmacist?: ClinicalPharmacist;
  procedures?: ClinicalProcedure[];
  rapidTests?: ClinicalRapidTest[];
}

export interface PharmacovigilanceReport {
  id?: number;
  storeId: number;
  pharmacistId: number;
  patientName: string;
  patientCpf?: string;
  suspectMedication: string;
  medicationBatch?: string;
  manufacturer?: string;
  adverseEventDescription: string;
  severityLevel: 'MILD' | 'MODERATE' | 'SEVERE' | 'FATAL';
  eventOutcome: 'RECOVERED' | 'RECOVERING' | 'PERSISTING' | 'UNKNOWN';
  notivisaProtocolNumber?: string;
  reportedToAnvisa?: boolean;
  reportedAt?: string;
  createdAt?: string;
  pharmacist?: ClinicalPharmacist;
}

export interface DsfSlipResponse {
  patientCopy: string;
  pharmacyCopy: string;
  dsfNumber: string;
  attendanceCode: string;
}
