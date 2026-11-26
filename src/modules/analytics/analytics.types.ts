export interface SalesHourlyDistribution {
  hour: number;
  customersCount: number;
  totalAmountBrl: number;
}

export interface CategorySalesDistribution {
  category: string;
  totalBrl: number;
  percentage: number;
}

export interface EmployeeSalesPerformance {
  employeeId: number;
  employeeName: string;
  customersServed: number;
  totalSalesBrl: number;
  averageTicketBrl: number;
  targetBrl: number;
  targetAchievementPct: number;
}

export interface TopProductMetric {
  productId: number;
  productName: string;
  category: string;
  quantitySold: number;
  totalBrl: number;
}

export interface LiveAnalyticsSummary {
  storeId: number;
  storeName: string;
  todaySalesBrl: number;
  todayReceiptsCount: number;
  todayAverageTicketBrl: number;
  monthSalesBrl: number;
  monthReceiptsCount: number;
  monthAverageTicketBrl: number;
  monthTotalDiscountBrl: number;
  monthAverageDiscountPct: number;
  monthTargetBrl: number;
  monthTargetAchievementPct: number;
  monthProjectedSalesBrl: number;
  hourlyDistribution: SalesHourlyDistribution[];
  categoryDistribution: CategorySalesDistribution[];
  employeePerformance: EmployeeSalesPerformance[];
  topProducts: TopProductMetric[];
}

export type QuotationStatus = 'OPEN' | 'SENT' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';

export interface WhatsAppQuotationItemDTO {
  productId: number;
  productName: string;
  quantity: number;
  unitPriceBrl: number;
}

export interface CreateWhatsAppQuotationDTO {
  storeId: number;
  customerName: string;
  customerPhone: string;
  attendantName: string;
  items: WhatsAppQuotationItemDTO[];
  discountBrl?: number;
  validDays?: number;
}

export interface WhatsAppQuotation {
  id: number;
  store_id: number;
  customer_name: string;
  customer_phone: string;
  attendant_name: string;
  subtotal_brl: number;
  discount_brl: number;
  total_brl: number;
  status: QuotationStatus;
  valid_until: string;
  whatsapp_message_payload: string;
  whatsapp_url?: string;
  created_at: string;
  items?: Array<{
    id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price_brl: number;
    total_price_brl: number;
  }>;
}
