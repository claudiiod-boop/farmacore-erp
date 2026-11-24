export type SncmItemStatus = 'IN_STOCK' | 'DISPENSED' | 'RETURNED' | 'LOST' | 'QUARANTINE';

export type SncmEventType = 'RECEBIMENTO' | 'DISPENSACAO' | 'DEVOLUCAO' | 'PERDA_INUTILIZACAO' | 'QUARENTENA';

export type SncmTransmissionStatus = 'PENDING' | 'SENT' | 'CONFIRMED' | 'REJECTED';

export interface ParsedDataMatrix {
  gtin: string;
  serialNumber: string;
  expirationDate: string; // YYYY-MM-DD
  batchNumber: string;
  raw: string;
}

export interface SncmItem {
  id: number;
  product_id: number;
  product_name?: string;
  batch_id?: number | null;
  store_id: number;
  gtin: string;
  serial_number: string;
  expiration_date: string;
  batch_number: string;
  status: SncmItemStatus;
  sale_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface SncmEvent {
  id: number;
  store_id: number;
  sncm_item_id: number;
  event_type: SncmEventType;
  event_date: string;
  nfe_access_key?: string | null;
  fiscal_doc_number?: string | null;
  transmission_status: SncmTransmissionStatus;
  anvisa_protocol?: string | null;
  anvisa_message?: string | null;
  operator_name?: string | null;
  created_at: string;
}

export interface SncmItemWithHistory extends SncmItem {
  events: SncmEvent[];
  is_expired?: boolean;
}

export interface RegisterReceiptItemInput {
  rawDataMatrix?: string;
  gtin?: string;
  serialNumber?: string;
  expirationDate?: string;
  batchNumber?: string;
  productId?: number;
}

export interface RegisterReceiptInput {
  storeId?: number;
  nfeAccessKey?: string;
  operatorName?: string;
  items: RegisterReceiptItemInput[];
}

export interface DispenseItemInput {
  storeId?: number;
  rawDataMatrix?: string;
  gtin?: string;
  serialNumber?: string;
  saleId?: number;
  fiscalDocNumber?: string;
  operatorName?: string;
}

export interface SncmKpis {
  total_in_stock: number;
  dispensed_today: number;
  pending_transmission: number;
  quarantined_items: number;
}
