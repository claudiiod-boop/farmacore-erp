export type SngpcMovementType = 'ENTRADA' | 'SAIDA_VENDA' | 'PERDA';

export type SngpcReferenceType = 'PURCHASE_INVOICE' | 'SALE' | 'INVENTORY_ADJUSTMENT';

export type SngpcTransmissionStatus = 'GERADO' | 'TRANSMITIDO' | 'CONFIRMADO' | 'REJEITADO';

export interface SngpcMovement {
  id: number;
  movementType: SngpcMovementType;
  productId: number;
  batchId: number;
  quantity: number;
  referenceType: SngpcReferenceType;
  referenceId: number;
  movementDate: string;
  msRegistration: string;
  prescriptionId?: number | null;
  isTransmitted: number; // 0 = Não transmitido, 1 = Transmitido
  transmissionId?: number | null;
  createdAt?: string;
}

export interface SngpcTransmission {
  id: number;
  startDate: string;
  endDate: string;
  pharmacistName: string;
  pharmacistCpf: string;
  pharmacistCrf: string;
  pharmacistCrfUf: string;
  xmlContent: string;
  status: SngpcTransmissionStatus;
  hashXml: string;
  createdAt?: string;
}

export interface SngpcTransmissionParams {
  startDate: string;
  endDate: string;
  pharmacistName: string;
  pharmacistCpf: string;
  pharmacistCrf: string;
  pharmacistCrfUf: string;
}

export interface SngpcLivroItem {
  date: string;
  movementType: SngpcMovementType;
  documentNumber: string;
  productName: string;
  msRegistration: string;
  batchNumber: string;
  initialBalance: number;
  entryQuantity: number;
  exitQuantity: number;
  finalBalance: number;
  doctorName?: string | null;
  doctorCrm?: string | null;
  doctorUf?: string | null;
  buyerName?: string | null;
  buyerCpf?: string | null;
}

export interface SngpcLivroRegistro {
  pharmacyCnpj: string;
  pharmacyName: string;
  pharmacistName: string;
  pharmacistCrf: string;
  pharmacistCrfUf: string;
  startDate: string;
  endDate: string;
  openingTerm?: string;
  closingTerm?: string;
  items: SngpcLivroItem[];
}
