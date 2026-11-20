// FarmaCore ERP — Tipos de Domínio de Auditoria, Inventário Rotativo / Balanço & SNGPC (Fase 10)

import type { Store } from '../stores/types';

export type InventoryType = 'GERAL' | 'ROTATIVO' | 'CONTROLADOS_SNGPC';

export type InventoryStatus = 'OPEN' | 'COUNTED' | 'APPLIED' | 'CANCELLED';

export type DifferenceStatus = 'EXACT' | 'SURPLUS' | 'SHORTAGE';

export type AdjustmentReason =
  | 'AVARIA'
  | 'VENCIMENTO'
  | 'FURTO_EXTRAVIO'
  | 'ERRO_OPERACIONAL'
  | 'QUEBRA_ARMAZENAMENTO'
  | 'AJUSTE_INVENTARIO'
  | 'SOBRA_NAO_IDENTIFICADA';

export interface InventorySession {
  id: number;
  sessionCode: string;
  storeId: number;
  inventoryType: InventoryType;
  categoryFilter?: string | null;
  status: InventoryStatus;
  openedBy: string;
  appliedBy?: string | null;
  responsiblePharmacistCrf?: string | null;
  responsiblePharmacistUf?: string | null;
  notes?: string | null;
  totalProductsExpected: number;
  totalProductsCounted: number;
  totalBatchesExpected: number;
  totalBatchesCounted: number;
  accuracyRate: number;
  totalSurplusCost: number;
  totalShortageCost: number;
  netFinancialDifference: number;
  startedAt: string;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;

  // DB compatibility aliases
  session_code?: string;
  store_id?: number;
  inventory_type?: InventoryType;
  category_filter?: string | null;
  opened_by?: string;
  applied_by?: string | null;
  responsible_pharmacist_crf?: string | null;
  responsible_pharmacist_uf?: string | null;
  total_products_expected?: number;
  total_products_counted?: number;
  total_batches_expected?: number;
  total_batches_counted?: number;
  accuracy_rate?: number;
  total_surplus_cost?: number;
  total_shortage_cost?: number;
  net_financial_difference?: number;
  started_at?: string;
  closed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryItem {
  id: number;
  sessionId: number;
  productId: number;
  productName?: string;
  productEan?: string;
  batchId?: number | null;
  batchNumber: string;
  expirationDate: string;
  manufacturingDate: string;
  expectedQuantity: number;
  countedQuantity: number;
  recountQuantity?: number | null;
  differenceQuantity: number;
  differenceStatus: DifferenceStatus;
  unitCost: number;
  totalCostDifference: number;
  adjustmentReason?: AdjustmentReason | null;
  notes?: string | null;
  sngpcAdjusted: boolean | number;
  createdAt: string;
  updatedAt: string;

  // DB compatibility aliases
  session_id?: number;
  product_id?: number;
  product_name?: string;
  product_ean?: string;
  batch_id?: number | null;
  batch_number?: string;
  expiration_date?: string;
  manufacturing_date?: string;
  expected_quantity?: number;
  counted_quantity?: number;
  recount_quantity?: number | null;
  difference_quantity?: number;
  difference_status?: DifferenceStatus;
  unit_cost?: number;
  total_cost_difference?: number;
  adjustment_reason?: AdjustmentReason | null;
  sngpc_adjusted?: number;
  created_at?: string;
  updated_at?: string;
}

export interface InventorySessionWithItems extends InventorySession {
  items: InventoryItem[];
  store?: Store;
}

export interface CreateInventorySessionInput {
  storeId: number;
  inventoryType: InventoryType;
  categoryFilter?: string | null;
  openedBy: string;
  notes?: string | null;

  // DB compatibility aliases
  store_id?: number;
  inventory_type?: InventoryType;
  category_filter?: string | null;
  opened_by?: string;
}

export interface AddCountInput {
  productId?: number;
  ean?: string;
  batchNumber: string;
  expirationDate: string;
  manufacturingDate?: string;
  quantity: number;
  unitCost?: number;
  isIncremental?: boolean;

  // DB compatibility aliases
  product_id?: number;
  batch_number?: string;
  expiration_date?: string;
  manufacturing_date?: string;
  unit_cost?: number;
  is_incremental?: boolean;
}

export interface ApplyAdjustmentsParams {
  appliedBy: string;
  responsiblePharmacistCrf?: string;
  responsiblePharmacistUf?: string;
  itemReasons?: Record<number, { reason: AdjustmentReason; notes?: string }>;

  // DB compatibility aliases
  applied_by?: string;
  responsible_pharmacist_crf?: string;
  responsible_pharmacist_uf?: string;
  item_reasons?: Record<number, { reason: AdjustmentReason; notes?: string }>;
}

export interface InventorySessionFilters {
  storeId?: number;
  status?: InventoryStatus;
  inventoryType?: InventoryType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;

  // DB compatibility aliases
  store_id?: number;
  inventory_type?: InventoryType;
  start_date?: string;
  end_date?: string;
}

export interface InventoryBalanceReport {
  sessionId: number;
  sessionCode: string;
  storeId: number;
  storeName: string;
  inventoryType: InventoryType;
  status: InventoryStatus;
  openedBy: string;
  appliedBy?: string | null;
  responsiblePharmacistCrf?: string | null;
  responsiblePharmacistUf?: string | null;
  startedAt: string;
  closedAt?: string | null;
  totalProductsExpected: number;
  totalProductsCounted: number;
  totalBatchesExpected: number;
  totalBatchesCounted: number;
  accuracyRate: number;
  totalSurplusCost: number;
  totalShortageCost: number;
  netFinancialDifference: number;
  totalItemsExact: number;
  totalItemsSurplus: number;
  totalItemsShortage: number;
  items: InventoryItem[];
  divergentItems: InventoryItem[];
}
