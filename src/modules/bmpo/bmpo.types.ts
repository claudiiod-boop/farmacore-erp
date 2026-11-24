export type RegulatoryReportType = 'BMPO_TRIMESTRAL' | 'BMPO_ANUAL' | 'RMNRA' | 'RMNRB' | 'BSPO';

export type RegulatoryReportStatus = 'DRAFT' | 'CONCLUDED' | 'FILED_WITH_VISA';

export type RegulatoryNotificationType = 'A' | 'B' | 'B2' | 'C1' | 'C5' | 'OUTROS';

export interface RegulatoryReport {
  id: number;
  store_id: number;
  report_type: RegulatoryReportType;
  period_year: number;
  period_quarter?: number | null;
  period_month?: number | null;
  pharmacist_name: string;
  pharmacist_crf: string;
  status: RegulatoryReportStatus;
  visa_protocol_number?: string | null;
  visa_filing_date?: string | null;
  observations?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegulatoryReportItem {
  id?: number;
  report_id: number;
  product_id: number;
  product_name?: string;
  active_ingredient: string;
  dcb_code?: string | null;
  therapeutic_class: string;
  control_list: string;
  presentation: string;
  unit_measure: string;
  initial_stock: number;
  acquisitions: number;
  sales: number;
  losses: number;
  final_stock: number;
}

export interface RegulatoryPrescriptionRel {
  id?: number;
  report_id: number;
  sale_id?: number | null;
  product_id: number;
  product_name?: string;
  prescription_notification_number: string;
  notification_type: RegulatoryNotificationType;
  dispensation_date: string;
  prescriber_name: string;
  prescriber_register_number: string;
  prescriber_uf: string;
  patient_name: string;
  patient_document?: string | null;
  buyer_name: string;
  buyer_document: string;
  quantity_dispensed: number;
  batch_number: string;
}

export interface RegulatoryReportDetails extends RegulatoryReport {
  items: RegulatoryReportItem[];
  prescriptions: RegulatoryPrescriptionRel[];
}

export interface GenerateBmpoInput {
  store_id?: number;
  report_type: 'BMPO_TRIMESTRAL' | 'BMPO_ANUAL';
  period_year: number;
  period_quarter?: number;
  pharmacist_name: string;
  pharmacist_crf: string;
  observations?: string;
}

export interface GenerateRmnrInput {
  store_id?: number;
  report_type: 'RMNRA' | 'RMNRB';
  period_year: number;
  period_month: number;
  pharmacist_name: string;
  pharmacist_crf: string;
  observations?: string;
}

export interface FileWithVisaInput {
  report_id: number;
  visa_protocol_number: string;
  visa_filing_date: string;
  observations?: string;
}

export interface RegulatoryKpis {
  total_reports: number;
  filed_reports: number;
  pending_filings: number;
  rmnra_count: number;
  rmnrb_count: number;
}
