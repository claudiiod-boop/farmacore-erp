export type SubscriptionInterval = 15 | 30 | 45 | 60 | 90;

export type SubscriptionDeliveryMode = 'DELIVERY' | 'STORE_PICKUP';

export type SubscriptionPaymentMethod =
  | 'PIX_RECURRING'
  | 'CREDIT_CARD_TOKEN'
  | 'CONVENIO_CREDIARIO'
  | 'CASH_ON_DELIVERY';

export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export type SubscriptionCycleStatus =
  | 'PENDING'
  | 'PROCESSED'
  | 'PRESCRIPTION_PENDING'
  | 'FAILED'
  | 'CANCELLED'
  | 'SKIPPED';

export interface Subscription {
  id: number;
  customer_id: number;
  store_id: number;
  plan_name: string;
  interval_days: SubscriptionInterval;
  preferred_delivery_day: number;
  delivery_mode: SubscriptionDeliveryMode;
  delivery_address?: string | null;
  delivery_neighborhood?: string | null;
  delivery_city?: string | null;
  payment_method: SubscriptionPaymentMethod;
  payment_card_token?: string | null;
  discount_percentage: number;
  status: SubscriptionStatus;
  next_billing_date: string;
  last_billing_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionItem {
  id: number;
  subscription_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  requires_prescription: number; // 0 ou 1
  prescription_doctor_crm?: string | null;
  prescription_doctor_uf?: string | null;
  prescription_expiry_date?: string | null;
  created_at: string;
  // Detalhes enriquecidos em joins
  product_name?: string;
  product_ean?: string;
}

export interface SubscriptionCycle {
  id: number;
  subscription_id: number;
  cycle_number: number;
  scheduled_date: string;
  processed_at?: string | null;
  status: SubscriptionCycleStatus;
  pre_sale_id?: number | null;
  delivery_order_id?: number | null;
  total_amount: number;
  failure_reason?: string | null;
  created_at: string;
  // Enriquecidos
  pre_sale_code?: string | null;
}

export interface CreateSubscriptionInput {
  customer_id: number;
  store_id: number;
  plan_name: string;
  interval_days?: SubscriptionInterval;
  preferred_delivery_day?: number;
  delivery_mode?: SubscriptionDeliveryMode;
  delivery_address?: string;
  delivery_neighborhood?: string;
  delivery_city?: string;
  payment_method?: SubscriptionPaymentMethod;
  payment_card_token?: string;
  discount_percentage?: number;
  notes?: string;
  startDate?: string; // Se omitido, usa a data atual para calcular
  items: Array<{
    product_id: number;
    quantity: number;
    unit_price?: number; // Se omitido, busca o preço atual do produto
    discount_percentage?: number;
    requires_prescription?: boolean;
    prescription_doctor_crm?: string;
    prescription_doctor_uf?: string;
    prescription_expiry_date?: string;
  }>;
}

export interface CreateSubscriptionItemInput {
  product_id: number;
  quantity: number;
  unit_price?: number;
  discount_percentage?: number;
  requires_prescription?: boolean;
  prescription_doctor_crm?: string;
  prescription_doctor_uf?: string;
  prescription_expiry_date?: string;
}

export interface RenewPrescriptionInput {
  prescription_doctor_crm: string;
  prescription_doctor_uf: string;
  prescription_expiry_date: string;
}

export interface ProcessRefillsResult {
  currentDate: string;
  totalProcessed: number;
  successCount: number;
  prescriptionPendingCount: number;
  failedCount: number;
  details: Array<{
    subscriptionId: number;
    customerName: string;
    status: SubscriptionCycleStatus;
    preSaleId?: number;
    preSaleCode?: string;
    deliveryOrderId?: number;
    totalAmount: number;
    message?: string;
  }>;
}

export interface SubscriptionKpis {
  activeSubscriptions: number;
  pausedSubscriptions: number;
  cancelledSubscriptions: number;
  totalMonthlyRecurringRevenue: number;
  refillsProcessedThisMonth: number;
  expiringPrescriptionsNext15Days: number;
}
