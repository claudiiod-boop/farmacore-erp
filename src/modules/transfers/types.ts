// FarmaCore ERP — Tipos de Domínio de Transferência entre Filiais (Fase 9)

import type { Store } from '../stores/types';

export type TransferStatus = 'DRAFT' | 'REQUESTED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';

export interface Transfer {
  id: number;
  transferNumber: string;
  sourceStoreId: number;
  targetStoreId: number;
  status: TransferStatus;
  requestedBy: string;
  dispatchedBy?: string | null;
  receivedBy?: string | null;
  carrierName?: string | null;
  trackingCode?: string | null;
  notes?: string | null;
  nfeKey?: string | null;
  nfeProtocol?: string | null;
  cfop: string;
  dispatchedAt?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  updatedAt: string;

  // DB compatibility aliases
  transfer_number?: string;
  source_store_id?: number;
  target_store_id?: number;
  requested_by?: string;
  dispatched_by?: string | null;
  received_by?: string | null;
  carrier_name?: string | null;
  tracking_code?: string | null;
  nfe_key?: string | null;
  nfe_protocol?: string | null;
  dispatched_at?: string | null;
  received_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TransferItem {
  id: number;
  transferId: number;
  productId: number;
  productName?: string;
  sourceBatchId?: number | null;
  batchNumber: string;
  expirationDate: string;
  manufacturingDate: string;
  requestedQuantity: number;
  shippedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
  totalCost: number;
  createdAt: string;

  // DB compatibility aliases
  transfer_id?: number;
  product_id?: number;
  product_name?: string;
  source_batch_id?: number | null;
  batch_number?: string;
  expiration_date?: string;
  manufacturing_date?: string;
  requested_quantity?: number;
  shipped_quantity?: number;
  received_quantity?: number;
  unit_cost?: number;
  total_cost?: number;
  created_at?: string;
}

export interface CreateTransferItemInput {
  productId: number;
  sourceBatchId?: number | null;
  batchNumber?: string;
  expirationDate?: string;
  manufacturingDate?: string;
  requestedQuantity: number;
  unitCost?: number;

  product_id?: number;
  source_batch_id?: number | null;
  batch_number?: string;
  expiration_date?: string;
  manufacturing_date?: string;
  requested_quantity?: number;
  unit_cost?: number;
}

export interface CreateTransferInput {
  sourceStoreId: number;
  targetStoreId: number;
  requestedBy: string;
  notes?: string | null;
  items: CreateTransferItemInput[];
  status?: TransferStatus;
  cfop?: string;

  source_store_id?: number;
  target_store_id?: number;
  requested_by?: string;
}

export interface TransferWithItems extends Transfer {
  items: TransferItem[];
  sourceStore?: Store;
  targetStore?: Store;
}

export interface CarrierInfo {
  carrierName?: string | null;
  trackingCode?: string | null;
  carrier_name?: string | null;
  tracking_code?: string | null;
}

export interface ReceiveItemInput {
  itemId: number;
  receivedQuantity: number;
  item_id?: number;
  received_quantity?: number;
}

export interface TransferFilters {
  status?: TransferStatus;
  sourceStoreId?: number;
  targetStoreId?: number;
  startDate?: string;
  endDate?: string;
}
