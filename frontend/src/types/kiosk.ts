export type KioskMode =
  | 'PRICE_CHECKER'
  | 'SELF_PRE_SALE'
  | 'QUEUE_TICKET'
  | 'HYBRID';

export type ServiceType =
  | 'NORMAL'
  | 'PREFERENCIAL'
  | 'RAPIDO'
  | 'CONSULTORIO';

export type QueueStatus =
  | 'WAITING'
  | 'CALLED'
  | 'ATTENDING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface KioskTerminal {
  id: number;
  store_id: number;
  terminal_code: string;
  name: string;
  ip_address?: string | null;
  mode: KioskMode;
  is_active: number;
  created_at: string;
  store_name?: string;
}

export interface QueueTicket {
  id: number;
  store_id: number;
  kiosk_id?: number | null;
  ticket_number: string;
  service_type: ServiceType;
  customer_name?: string | null;
  customer_cpf?: string | null;
  status: QueueStatus;
  called_at?: string | null;
  completed_at?: string | null;
  counter_operator?: string | null;
  created_at: string;
  kiosk_name?: string;
}

export interface PriceCheckResult {
  product_id: number;
  name: string;
  ean: string;
  active_ingredient: string;
  category: string;
  stripe: string;
  control_type: string;
  original_price: number;
  final_price: number;
  discount_amount: number;
  discount_percentage: number;
  pmc: number;
  club_member: boolean;
  requires_prescription: boolean;
  generic_alternatives: Array<{
    id: number;
    name: string;
    ean: string;
    price: number;
    savings_amount: number;
    savings_percentage: number;
  }>;
}

export interface ExpressPreSaleResult {
  pre_sale_id: number;
  code: string;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  items_count: number;
  ticket_receipt: string;
}

export interface KioskKpis {
  total_price_queries_today: number;
  total_queue_tickets_today: number;
  waiting_tickets_count: number;
  completed_tickets_count: number;
  total_express_presales_today: number;
  express_presales_revenue_today: number;
}
