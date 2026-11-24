export type PharmaceuticalCategory =
  | 'GENERICO'
  | 'SIMILAR'
  | 'ETICO'
  | 'OTC'
  | 'PERFUMARIA'
  | 'MANIPULADO';

export type SellerRole = 'BALCONISTA' | 'FARMACEUTICO' | 'CAIXA' | 'GERENTE';

export type GoalStatus = 'IN_PROGRESS' | 'ACHIEVED' | 'NOT_ACHIEVED';

export type StatementStatus = 'PENDING' | 'APPROVED' | 'PAID';

export interface Seller {
  id: number;
  store_id: number;
  name: string;
  cpf?: string | null;
  role: SellerRole;
  is_active: number;
  created_at: string;
  // Enriquecidos
  store_name?: string;
  current_month_sales?: number;
  current_month_commission?: number;
}

export interface CommissionRule {
  id: number;
  category_type: PharmaceuticalCategory;
  percentage: number;
  description?: string | null;
  is_active: number;
  updated_at: string;
}

export interface CommissionCampaign {
  id: number;
  name: string;
  manufacturer?: string | null;
  product_id?: number | null;
  bonus_per_unit: number;
  start_date: string;
  end_date: string;
  is_active: number;
  created_at: string;
  // Enriquecidos
  product_name?: string;
}

export interface SalesGoal {
  id: number;
  seller_id: number;
  store_id: number;
  period_month: string;
  target_amount: number;
  achieved_amount: number;
  accelerator_multiplier: number;
  status: GoalStatus;
  created_at: string;
  // Enriquecidos
  seller_name?: string;
  progress_percentage?: number;
}

export interface CommissionStatement {
  id: number;
  seller_id: number;
  sale_id: number;
  sale_item_id?: number | null;
  product_id: number;
  category_type: PharmaceuticalCategory;
  item_total: number;
  base_commission_percent: number;
  base_commission_amount: number;
  campaign_bonus_amount: number;
  accelerator_multiplier: number;
  final_commission_amount: number;
  period_month: string;
  status: StatementStatus;
  created_at: string;
  // Enriquecidos
  seller_name?: string;
  product_name?: string;
}

export interface CreateSellerInput {
  store_id: number;
  name: string;
  cpf?: string;
  role?: SellerRole;
}

export interface CreateCampaignInput {
  name: string;
  manufacturer?: string;
  product_id?: number;
  bonus_per_unit: number;
  start_date: string;
  end_date: string;
}

export interface SetSalesGoalInput {
  seller_id: number;
  store_id: number;
  period_month: string;
  target_amount: number;
}

export interface CalculateSaleCommissionsInput {
  seller_id: number;
  sale_id: number;
  sale_date?: string; // YYYY-MM-DD
}

export interface CommissionKpis {
  totalCommissionsCurrentMonth: number;
  totalSalesAchievedCurrentMonth: number;
  globalGoalProgressPercent: number;
  topSellerName: string;
  topSellerCommission: number;
  activeCampaignsCount: number;
}
