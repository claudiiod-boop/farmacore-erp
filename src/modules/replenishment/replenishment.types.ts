export type AbcClass = 'A' | 'B' | 'C';

export type StockRuptureStatus = 'OUT_OF_STOCK' | 'CRITICAL' | 'REORDER_NEEDED' | 'OK';

export type ReplenishmentOrderStatus = 'DRAFT' | 'SUBMITTED' | 'RECEIVED' | 'CANCELLED';

export interface ReplenishmentParameter {
  id: number;
  product_id: number;
  store_id: number;
  lead_time_days: number;
  safety_stock_days: number;
  review_cycle_days: number;
  min_order_quantity: number;
  preferred_distributor_id?: number | null;
  abc_class: AbcClass;
  created_at: string;
  updated_at: string;
}

export interface ProductStockAnalysis {
  productId: number;
  productName: string;
  ean: string;
  category?: string;
  currentStock: number;
  dailyDemand: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  maxStock: number;
  daysOfCover: number;
  suggestedQuantity: number;
  unitCost: number;
  estimatedCost: number;
  abcClass: AbcClass;
  status: StockRuptureStatus;
}

export interface ReplenishmentOrder {
  id: number;
  store_id: number;
  distributor_name?: string | null;
  status: ReplenishmentOrderStatus;
  total_items: number;
  estimated_total: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReplenishmentOrderItem {
  id?: number;
  order_id: number;
  product_id: number;
  product_name?: string;
  suggested_quantity: number;
  order_quantity: number;
  unit_cost: number;
  subtotal: number;
  current_stock: number;
  reorder_point: number;
}

export interface ReplenishmentOrderDetails extends ReplenishmentOrder {
  items: ReplenishmentOrderItem[];
}

export interface CreateReplenishmentOrderInput {
  storeId?: number;
  distributorName?: string;
  notes?: string;
  items: Array<{
    productId: number;
    orderQuantity: number;
    unitCost?: number;
    suggestedQuantity?: number;
    currentStock?: number;
    reorderPoint?: number;
  }>;
}

export interface ReplenishmentKpis {
  out_of_stock_count: number;
  critical_count: number;
  reorder_needed_count: number;
  total_suggestions: number;
  total_estimated_cost: number;
  active_orders_count: number;
}
