export interface CreatePreSaleItemDTO {
  productId: number;
  batchId: number;
  quantity: number;
}

export interface PrescriptionDTO {
  doctorName: string;
  doctorCrm: string;
  doctorUf: string;
  prescriptionType: string; // ex: 'B1_AZUL', 'C1_BRANCA_2VIAS', 'ANTIMICROBIANO'
  prescriptionDate: string; // YYYY-MM-DD
  patientName: string;
  buyerName?: string;
  buyerCpf?: string;
}

export interface CreatePreSaleDTO {
  customerName?: string;
  customerCpf?: string;
  items: CreatePreSaleItemDTO[];
  prescription?: PrescriptionDTO;
}

export type PreSaleStatus = 'OPEN' | 'CONVERTED_TO_SALE' | 'CANCELLED';

export interface PreSale {
  id: number;
  code: string;
  status: PreSaleStatus;
  customerName: string | null;
  customerCpf: string | null;
  totalAmount: number;
  createdAt: string;
}

export interface PreSaleItemDetails {
  id: number;
  preSaleId: number;
  productId: number;
  productName: string;
  batchId: number;
  batchNumber: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PrescriptionDetails {
  id: number;
  preSaleId: number;
  doctorName: string;
  doctorCrm: string;
  doctorUf: string;
  prescriptionType: string;
  prescriptionDate: string;
  patientName: string;
  buyerName: string | null;
  buyerCpf: string | null;
  createdAt: string;
}

export interface PreSaleDetails {
  preSale: PreSale;
  items: PreSaleItemDetails[];
  prescription: PrescriptionDetails | null;
}
