export type ClinicalServiceCategory = 'TLR' | 'PROCEDURE' | 'ASSESSMENT' | 'PRESCRIPTION';
export type AttendanceStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ProcedureType = 'INJECTABLE' | 'BP_MEASUREMENT' | 'TEMPERATURE' | 'INHALATION' | 'EAR_PIERCING';
export type InjectableSite = 'DELTOIDE_D' | 'DELTOIDE_E' | 'GLUTEUS_D' | 'GLUTEUS_E' | 'VASTO_LATERAL';
export type RapidTestType = 'GLUCOSE' | 'HBA1C' | 'CHOLESTEROL' | 'COVID19' | 'DENGUE' | 'BETA_HCG';
export type TestInterpretation = 'REAGENTE' | 'NAO_REAGENTE' | 'INDETERMINADO' | 'NORMAL' | 'ALTERADO' | 'CRITICO';
export type PharmacovigilanceSeverity = 'LEVE' | 'MODERADA' | 'GRAVE' | 'FATAL';
export type PharmacovigilanceStatus = 'PENDING_NOTIVISA' | 'REPORTED';

export interface ClinicalPharmacist {
  id?: number;
  storeId: number;
  name: string;
  cpf: string;
  crfNumber: string;
  crfUf: string;
  email?: string | null;
  phone?: string | null;
  isActive?: boolean;
  createdAt?: string;
}

export interface ClinicalServiceItem {
  id?: number;
  storeId: number;
  code: string;
  name: string;
  category: ClinicalServiceCategory;
  price: number;
  description?: string | null;
  referenceValuesJson?: string | null;
  isActive?: boolean;
  createdAt?: string;
}

export interface ClinicalProcedureRecord {
  id?: number;
  attendanceId?: number;
  serviceCatalogId?: number | null;
  procedureType: ProcedureType;
  medicationName?: string | null;
  medicationBatch?: string | null;
  applicationSite?: InjectableSite | null;
  prescriberName?: string | null;
  prescriberCrm?: string | null;
  detailsJson?: string | null;
  createdAt?: string;
}

export interface ClinicalRapidTestRecord {
  id?: number;
  attendanceId?: number;
  serviceCatalogId?: number | null;
  testType: RapidTestType;
  reagentName: string;
  reagentBatch: string;
  reagentExpiration: string; // YYYY-MM-DD
  reagentMsRegistration: string;
  resultValue: string;
  resultInterpretation: TestInterpretation;
  referenceRange?: string | null;
  createdAt?: string;
}

export interface PharmacovigilanceReport {
  id?: number;
  storeId: number;
  pharmacistId: number;
  attendanceId?: number | null;
  patientName: string;
  patientCpf?: string | null;
  suspectedMedication: string;
  manufacturer?: string | null;
  batchNumber?: string | null;
  adverseReactionDescription: string;
  reactionDate: string; // YYYY-MM-DD
  severity: PharmacovigilanceSeverity;
  notivisaNotificationNumber?: string | null;
  status?: PharmacovigilanceStatus;
  createdAt?: string;
}

export interface ClinicalAttendance {
  id: number;
  attendanceCode: string;
  storeId: number;
  pharmacistId: number;
  patientName: string;
  patientCpf?: string | null;
  patientBirthDate?: string | null;
  patientGender?: string | null;
  patientPhone?: string | null;
  patientAddress?: string | null;
  bloodPressureSystolic?: number | null;
  bloodPressureDiastolic?: number | null;
  heartRate?: number | null;
  temperature?: number | null;
  oxygenSaturation?: number | null;
  anamnesisNotes?: string | null;
  allergies?: string | null;
  continuousMedications?: string | null;
  status: AttendanceStatus;
  dsfNumber?: string | null;
  totalAmount: number;
  createdAt: string;
  completedAt?: string | null;
  pharmacist?: ClinicalPharmacist;
  procedures?: ClinicalProcedureRecord[];
  rapidTests?: ClinicalRapidTestRecord[];
}

export interface CreateAttendanceDTO {
  storeId: number;
  pharmacistId: number;
  patientName: string;
  patientCpf?: string;
  patientBirthDate?: string;
  patientGender?: string;
  patientPhone?: string;
  patientAddress?: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  anamnesisNotes?: string;
  allergies?: string;
  continuousMedications?: string;
}
