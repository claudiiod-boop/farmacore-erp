// FarmaCore ERP — Tipos de Domínio do Módulo de Delivery Farmacêutico, Entregadores e Romaneios (Fase 13)

// =============================================================
// 1. Enums e Tipos Literais
// =============================================================

export type CourierVehicleType = 'MOTO' | 'BIKE' | 'CAR' | 'WALK';

export type CourierStatus = 'AVAILABLE' | 'ON_DELIVERY' | 'INACTIVE';

export type DeliveryOrderStatus =
  | 'RECEIVED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'RETURNED'
  | 'CANCELLED';

export type DeliveryPaymentMethod =
  | 'DINHEIRO'
  | 'CARTAO_CREDITO'
  | 'CARTAO_DEBITO'
  | 'PIX'
  | 'CONVENIO'
  | 'CREDIARIO';

export type DispatchStatus = 'OPEN' | 'SETTLED' | 'CANCELLED';

// =============================================================
// 2. Zonas de Entrega (delivery_zones)
// =============================================================

export interface DeliveryZone {
  id: number;
  storeId?: number | null;
  name: string;
  neighborhood: string;
  city: string;
  state: string;
  deliveryFee: number;
  estimatedMinutes: number;
  freeShippingThreshold?: number | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;

  // DB compatibility aliases (snake_case)
  store_id?: number | null;
  delivery_fee?: number;
  estimated_minutes?: number;
  free_shipping_threshold?: number | null;
  is_active?: number | boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDeliveryZoneInput {
  storeId?: number | null;
  name: string;
  neighborhood: string;
  city: string;
  state?: string;
  deliveryFee: number;
  estimatedMinutes?: number;
  freeShippingThreshold?: number | null;
  isActive?: boolean;

  // DB compatibility aliases
  store_id?: number | null;
  delivery_fee?: number;
  estimated_minutes?: number;
  free_shipping_threshold?: number | null;
  is_active?: number | boolean;
}

export interface UpdateDeliveryZoneInput {
  name?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  deliveryFee?: number;
  estimatedMinutes?: number;
  freeShippingThreshold?: number | null;
  isActive?: boolean;

  // DB compatibility aliases
  delivery_fee?: number;
  estimated_minutes?: number;
  free_shipping_threshold?: number | null;
  is_active?: number | boolean;
}

// =============================================================
// 3. Entregadores / Motoboys (couriers)
// =============================================================

export interface Courier {
  id: number;
  storeId?: number | null;
  name: string;
  cpf: string;
  phone: string;
  vehicleType: CourierVehicleType;
  vehiclePlate?: string | null;
  cnh?: string | null;
  commissionPerDelivery: number;
  dailyAllowance: number;
  status: CourierStatus;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;

  // DB compatibility aliases (snake_case)
  store_id?: number | null;
  vehicle_type?: CourierVehicleType;
  vehicle_plate?: string | null;
  commission_per_delivery?: number;
  daily_allowance?: number;
  is_active?: number | boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCourierInput {
  storeId?: number | null;
  name: string;
  cpf: string;
  phone: string;
  vehicleType?: CourierVehicleType;
  vehiclePlate?: string | null;
  cnh?: string | null;
  commissionPerDelivery?: number;
  dailyAllowance?: number;
  status?: CourierStatus;
  isActive?: boolean;

  // DB compatibility aliases
  store_id?: number | null;
  vehicle_type?: CourierVehicleType;
  vehicle_plate?: string | null;
  commission_per_delivery?: number;
  daily_allowance?: number;
  is_active?: number | boolean;
}

export interface UpdateCourierInput {
  storeId?: number | null;
  name?: string;
  cpf?: string;
  phone?: string;
  vehicleType?: CourierVehicleType;
  vehiclePlate?: string | null;
  cnh?: string | null;
  commissionPerDelivery?: number;
  dailyAllowance?: number;
  status?: CourierStatus;
  isActive?: boolean;

  // DB compatibility aliases
  store_id?: number | null;
  vehicle_type?: CourierVehicleType;
  vehicle_plate?: string | null;
  commission_per_delivery?: number;
  daily_allowance?: number;
  is_active?: number | boolean;
}

export interface CourierFilters {
  storeId?: number;
  activeOnly?: boolean;
  status?: CourierStatus;
  vehicleType?: CourierVehicleType;
  search?: string;
}

// =============================================================
// 4. Itens do Pedido de Tele-Entrega (delivery_order_items)
// =============================================================

export interface DeliveryOrderItem {
  id: number;
  deliveryOrderId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  batchId?: number | null;
  batchNumber?: string | null;
  createdAt?: string;

  // DB compatibility aliases (snake_case)
  delivery_order_id?: number;
  product_id?: number;
  product_name?: string;
  unit_price?: number;
  total_price?: number;
  batch_id?: number | null;
  batch_number?: string | null;
  created_at?: string;
}

export interface CreateDeliveryOrderItemInput {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  batchId?: number | null;
  batchNumber?: string | null;

  // DB compatibility aliases
  product_id?: number;
  product_name?: string;
  unit_price?: number;
  total_price?: number;
  batch_id?: number | null;
  batch_number?: string | null;
}

// =============================================================
// 5. Pedidos de Tele-Entrega (delivery_orders)
// =============================================================

export interface DeliveryOrder {
  id: number;
  orderNumber: string;
  storeId: number;
  customerId?: number | null;
  customerName: string;
  customerPhone: string;
  customerCpf?: string | null;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode?: string | null;
  referencePoint?: string | null;
  subtotalAmount: number;
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: DeliveryPaymentMethod;
  changeFor?: number | null;
  status: DeliveryOrderStatus;
  courierId?: number | null;
  dispatchId?: number | null;
  preSaleId?: number | null;
  saleId?: number | null;
  cancellationReason?: string | null;
  notes?: string | null;
  receivedAt: string;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  returnedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;

  // Embedded / joined relations
  items?: DeliveryOrderItem[];
  courier?: Courier | null;

  // DB compatibility aliases (snake_case)
  order_number?: string;
  store_id?: number;
  customer_id?: number | null;
  customer_name?: string;
  customer_phone?: string;
  customer_cpf?: string | null;
  zip_code?: string | null;
  reference_point?: string | null;
  subtotal_amount?: number;
  delivery_fee?: number;
  discount_amount?: number;
  total_amount?: number;
  payment_method?: DeliveryPaymentMethod;
  change_for?: number | null;
  courier_id?: number | null;
  dispatch_id?: number | null;
  pre_sale_id?: number | null;
  sale_id?: number | null;
  cancellation_reason?: string | null;
  received_at?: string;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  returned_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDeliveryOrderInput {
  storeId: number;
  customerId?: number | null;
  customerName: string;
  customerPhone: string;
  customerCpf?: string | null;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state?: string;
  zipCode?: string | null;
  referencePoint?: string | null;
  subtotalAmount?: number;
  deliveryFee?: number;
  discountAmount?: number;
  totalAmount?: number;
  paymentMethod: DeliveryPaymentMethod;
  changeFor?: number | null;
  courierId?: number | null;
  preSaleId?: number | null;
  saleId?: number | null;
  notes?: string | null;
  items: CreateDeliveryOrderItemInput[];

  // DB compatibility aliases
  store_id?: number;
  customer_id?: number | null;
  customer_name?: string;
  customer_phone?: string;
  customer_cpf?: string | null;
  zip_code?: string | null;
  reference_point?: string | null;
  subtotal_amount?: number;
  delivery_fee?: number;
  discount_amount?: number;
  total_amount?: number;
  payment_method?: DeliveryPaymentMethod;
  change_for?: number | null;
  courier_id?: number | null;
  pre_sale_id?: number | null;
  sale_id?: number | null;
}

export interface UpdateDeliveryOrderInput {
  customerName?: string;
  customerPhone?: string;
  customerCpf?: string | null;
  street?: string;
  number?: string;
  complement?: string | null;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string | null;
  referencePoint?: string | null;
  subtotalAmount?: number;
  deliveryFee?: number;
  discountAmount?: number;
  totalAmount?: number;
  paymentMethod?: DeliveryPaymentMethod;
  changeFor?: number | null;
  courierId?: number | null;
  notes?: string | null;

  // DB compatibility aliases
  customer_name?: string;
  customer_phone?: string;
  customer_cpf?: string | null;
  zip_code?: string | null;
  reference_point?: string | null;
  subtotal_amount?: number;
  delivery_fee?: number;
  discount_amount?: number;
  total_amount?: number;
  payment_method?: DeliveryPaymentMethod;
  change_for?: number | null;
  courier_id?: number | null;
}

export interface UpdateOrderStatusInput {
  status: DeliveryOrderStatus;
  courierId?: number | null;
  cancellationReason?: string | null;

  // DB compatibility aliases
  courier_id?: number | null;
  cancellation_reason?: string | null;
}

export interface DeliveryOrderFilters {
  storeId?: number;
  status?: DeliveryOrderStatus | DeliveryOrderStatus[];
  courierId?: number;
  customerId?: number;
  paymentMethod?: DeliveryPaymentMethod;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// =============================================================
// 6. Romaneios de Despacho e Acerto de Caixa (delivery_dispatches)
// =============================================================

export interface DeliveryDispatch {
  id: number;
  dispatchNumber: string;
  storeId: number;
  courierId: number;
  cashSessionId?: number | null;
  totalOrders: number;
  totalAmount: number;
  totalChangeProvided: number;
  collectedCash: number;
  collectedCard: number;
  collectedPix: number;
  totalCommission: number;
  status: DispatchStatus;
  operatorName?: string | null;
  notes?: string | null;
  dispatchedAt: string;
  settledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;

  // DB compatibility aliases (snake_case)
  dispatch_number?: string;
  store_id?: number;
  courier_id?: number;
  cash_session_id?: number | null;
  total_orders?: number;
  total_amount?: number;
  total_change_provided?: number;
  collected_cash?: number;
  collected_card?: number;
  collected_pix?: number;
  total_commission?: number;
  operator_name?: string | null;
  dispatched_at?: string;
  settled_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryDispatchWithOrders extends DeliveryDispatch {
  orders: DeliveryOrder[];
  courier?: Courier | null;
}

export interface CreateDispatchInput {
  storeId: number;
  courierId: number;
  orderIds: number[];
  notes?: string | null;

  // DB compatibility aliases
  store_id?: number;
  courier_id?: number;
  order_ids?: number[];
}

export interface SettleOrderItemParam {
  orderId: number;
  delivered: boolean;
  returnedReason?: string;

  // DB compatibility aliases
  order_id?: number;
  returned_reason?: string;
}

export interface SettleDispatchParams {
  orders: SettleOrderItemParam[];
  collectedCash?: number;
  collectedCard?: number;
  collectedPix?: number;
  cashSessionId?: number | null;
  operatorName?: string;
  notes?: string;

  // DB compatibility aliases
  collected_cash?: number;
  collected_card?: number;
  collected_pix?: number;
  cash_session_id?: number | null;
  operator_name?: string;
}

export interface SettlementResult {
  dispatch: DeliveryDispatch;
  totalDelivered: number;
  totalReturned: number;
  collectedCash: number;
  collectedCard: number;
  collectedPix: number;
  commissionEarned: number;
  cashMovementId?: number | null;
  receiptText?: string;

  // DB compatibility aliases
  total_delivered?: number;
  total_returned?: number;
  collected_cash?: number;
  collected_card?: number;
  collected_pix?: number;
  commission_earned?: number;
  cash_movement_id?: number | null;
  receipt_text?: string;
}
