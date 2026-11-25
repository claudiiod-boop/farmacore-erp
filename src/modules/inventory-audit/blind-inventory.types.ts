export type InventoryType = 'ROTATIVO' | 'GERAL_PATRIMONIAL' | 'CONTROLADOS_SNGPC';

export type InventoryStatus = 'OPEN' | 'COUNTING' | 'AUDITING' | 'FINALIZED' | 'CANCELLED';

export interface StockInventory {
  id: number;
  code: string;
  store_id: number;
  type: InventoryType;
  status: InventoryStatus;
  started_at: string;
  finished_at?: string | null;
  responsible_user_id?: number | null;
  responsible_pharmacist_crf?: string | null;
  total_items_counted: number;
  total_divergences_count: number;
  total_divergence_value: number;
  notes?: string | null;
  items?: StockInventoryItem[];
  created_at: string;
  updated_at: string;
}

export interface StockInventoryItem {
  id: number;
  inventory_id: number;
  product_id: number;
  product_name?: string;
  product_ean?: string;
  batch_id?: number | null;
  batch_number?: string | null;
  system_quantity: number; // Visível apenas para gestores na etapa de auditoria
  counted_quantity: number;
  divergence_quantity: number;
  unit_cost: number;
  divergence_value: number;
  is_controlled: number;
  requires_pharmacist_approval: number;
  pharmacist_approved: number;
  justification?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockInventoryAdjustment {
  id: number;
  inventory_id: number;
  item_id: number;
  product_id: number;
  batch_id?: number | null;
  adjustment_type: 'SOBRA' | 'FALTA';
  quantity: number;
  unit_cost: number;
  total_cost: number;
  dre_reason: 'QUEBRA' | 'FURTO' | 'VALIDADE_EXPIRADA' | 'AJUSTE_CONTAGEM';
  created_at: string;
}

export interface CreateInventoryInput {
  store_id: number;
  type: InventoryType;
  responsible_user_id?: number;
  responsible_pharmacist_crf?: string;
  notes?: string;
  product_ids?: number[]; // Se fornecido, inventário focado apenas nesses produtos (ex: rotativo)
}

export interface ItemCountInput {
  inventory_id: number;
  product_id: number;
  batch_id?: number;
  counted_quantity: number;
}

export interface ApproveControlledInput {
  item_id: number;
  pharmacist_crf: string;
  justification: string;
}

export interface InventoryKpis {
  total_sessions: number;
  open_sessions: number;
  accuracy_rate_percent: number;
  total_divergence_value_month: number;
  pending_controlled_approvals: number;
}
