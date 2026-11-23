export type OmnichannelChannelType =
  | 'WHATSAPP_OPENWA'
  | 'ECOMMERCE_API'
  | 'IFOOD_FARMA'
  | 'RAPPI';

export type OmnichannelBotState =
  | 'IDLE'
  | 'SEARCHING_PRODUCT'
  | 'SENDING_PRESCRIPTION'
  | 'TRACKING_DELIVERY'
  | 'HUMAN_ESCALATION';

export type OmnichannelMessageDirection = 'INBOUND' | 'OUTBOUND';

export type OmnichannelMessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'DOCUMENT'
  | 'BUTTONS_RESPONSE';

export type OmnichannelOrderStatus =
  | 'NEW'
  | 'IN_SEPARATION'
  | 'CHECKED'
  | 'DISPATCHED'
  | 'CANCELLED';

export interface OmnichannelChannel {
  id?: number;
  store_id: number;
  channel_type: OmnichannelChannelType;
  name: string;
  base_url: string;
  api_key?: string | null;
  session_id: string;
  phone_number?: string | null;
  is_active: number | boolean;
  bot_enabled: number | boolean;
  auto_reply_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OmnichannelConversation {
  id?: number;
  channel_id: number;
  contact_phone: string;
  contact_name?: string | null;
  state: OmnichannelBotState;
  context_data?: string | null; // JSON
  last_message_at?: string;
  is_open: number | boolean;
  assigned_operator_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface OmnichannelMessage {
  id?: number;
  conversation_id: number;
  external_message_id?: string | null;
  direction: OmnichannelMessageDirection;
  message_type: OmnichannelMessageType;
  content: string;
  media_url?: string | null;
  status: 'RECEIVED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  created_at?: string;
}

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
  created_at?: string;
}

export interface OmnichannelOrder {
  id?: number;
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
  payment_method: 'PIX_ENTREGA' | 'CARTAO_ENTREGA' | 'DINHEIRO_ENTREGA' | 'PAGO_ONLINE';
  pre_sale_id?: number | null;
  delivery_order_id?: number | null;
  picker_operator_id?: number | null;
  separated_at?: string | null;
  checked_at?: string | null;
  dispatched_at?: string | null;
  created_at?: string;
  updated_at?: string;
  items?: OmnichannelOrderItem[];
}

export interface OmnichannelOrderAudit {
  id?: number;
  order_id: number;
  event_type: 'STATUS_CHANGE' | 'ITEM_SCANNED' | 'WRONG_ITEM_ATTEMPT' | 'DISPATCHED';
  description: string;
  operator_name: string;
  created_at?: string;
}

export interface OpenWaWebhookPayload {
  event: string; // 'onMessage', 'onStateChanged', etc.
  session?: string;
  data: {
    id?: string;
    from?: string; // e.g. '5511999998888@c.us'
    to?: string;
    body?: string;
    type?: string;
    mimetype?: string;
    caption?: string;
    sender?: {
      pushname?: string;
      formattedName?: string;
      id?: string;
    };
  };
}
