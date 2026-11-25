export type MarketplaceChannelName =
  | 'IFOOD'
  | 'RAPPI'
  | 'FARMACIAS_APP'
  | 'CONSULTA_REMEDIOS'
  | 'MERCADO_LIVRE';

export type MarketplaceOrderStatus =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface MarketplaceChannel {
  id: number;
  store_id: number;
  channel_name: MarketplaceChannelName;
  merchant_id: string | null;
  api_key: string | null;
  api_secret: string | null;
  webhook_secret: string | null;
  commission_rate: number;
  stock_buffer_percent: number;
  auto_confirm_orders: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceCatalogMapping {
  id: number;
  channel_id: number;
  product_id: number;
  external_sku: string;
  markup_percent: number;
  custom_price: number | null;
  is_synced: number;
  last_stock_synced: number;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  product_name?: string;
  ean?: string;
  current_price?: number;
  calculated_price?: number;
  available_stock?: number;
}

export interface MarketplaceOrderItem {
  id?: number;
  order_id?: number;
  product_id: number;
  external_sku?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  batch_number?: string | null;
}

export interface MarketplaceOrder {
  id: number;
  store_id: number;
  channel_id: number;
  external_order_id: string;
  display_order_id: string | null;
  customer_name: string;
  customer_document: string | null;
  customer_phone: string | null;
  delivery_address: string;
  status: MarketplaceOrderStatus;
  subtotal: number;
  delivery_fee: number;
  platform_fee: number;
  total_amount: number;
  placed_at: string;
  confirmed_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  channel_name?: MarketplaceChannelName;
  items?: MarketplaceOrderItem[];
}

export interface RegisterChannelInput {
  storeId: number;
  channelName: MarketplaceChannelName;
  merchantId?: string;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  commissionRate?: number;
  stockBufferPercent?: number;
  autoConfirmOrders?: boolean;
}

export interface MapCatalogProductInput {
  channelId: number;
  productId: number;
  externalSku: string;
  markupPercent?: number;
  customPrice?: number;
}

export interface IngestOrderInput {
  storeId: number;
  channelId: number;
  externalOrderId: string;
  displayOrderId?: string;
  customerName: string;
  customerDocument?: string;
  customerPhone?: string;
  deliveryAddress: string;
  subtotal: number;
  deliveryFee?: number;
  platformFee?: number;
  totalAmount: number;
  placedAt?: string;
  items: {
    productId: number;
    externalSku?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    batchNumber?: string;
  }[];
}

export interface MarketplaceKpis {
  totalOrders: number;
  pendingOrders: number;
  dispatchedOrders: number;
  totalRevenue: number;
  activeChannelsCount: number;
  ordersByChannel: {
    channel: MarketplaceChannelName;
    count: number;
    total: number;
  }[];
}
