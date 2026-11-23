export type OmnichannelOrderStatus =
  | 'NEW'
  | 'IN_SEPARATION'
  | 'CHECKED'
  | 'DISPATCHED'
  | 'CANCELLED';

export interface OmnichannelOrderItem {
  id?: number;
  order_id?: number;
  product_id: number;
  ean: string;
  product_name: string;
  quantity_ordered: number;
  quantity_picked: number;
  unit_price: number;
  total_price: number;
  batch_number?: string | null;
  status: 'PENDING' | 'PICKED';
}

export interface OmnichannelOrder {
  id: number;
  store_id: number;
  channel_id: number;
  conversation_id?: number | null;
  channel_order_code: string;
  customer_name: string;
  customer_phone: string;
  delivery_type: 'DELIVERY' | 'BALCAO_RETIRADA';
  delivery_address?: string | null;
  notes?: string | null;
  status: OmnichannelOrderStatus;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  payment_method: string;
  pre_sale_id?: number | null;
  delivery_order_id?: number | null;
  picker_operator_id?: number | null;
  separated_at?: string | null;
  checked_at?: string | null;
  dispatched_at?: string | null;
  created_at: string;
  items?: OmnichannelOrderItem[];
}

export interface OmnichannelChannel {
  id?: number;
  store_id: number;
  channel_type: string;
  name: string;
  base_url: string;
  api_key?: string | null;
  session_id: string;
  phone_number?: string | null;
  is_active: number | boolean;
  bot_enabled: number | boolean;
  auto_reply_message?: string | null;
}

export interface OmnichannelConversation {
  id: number;
  channel_id: number;
  contact_phone: string;
  contact_name?: string | null;
  state: string;
  last_message_at: string;
  is_open: number | boolean;
}

export interface OmnichannelMessage {
  id: number;
  conversation_id: number;
  direction: 'INBOUND' | 'OUTBOUND';
  message_type: string;
  content: string;
  status: string;
  created_at: string;
}
