export type DepartmentType =
  | 'BALCAO'
  | 'MANIPULACAO'
  | 'PERFUMARIA'
  | 'DELIVERY'
  | 'CLINICO'
  | 'ADMINISTRATIVO';

export type ExpenseType =
  | 'PESSOAL'
  | 'ADMINISTRATIVA'
  | 'VENDAS_LOGISTICA'
  | 'TRIBUTARIA'
  | 'FINANCEIRA'
  | 'OPERACIONAL_OUTRAS';

export type ExpenseStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export type DreRegime = 'COMPETENCIA' | 'CAIXA';

export interface CostCenter {
  id: number;
  store_id?: number | null;
  code: string;
  name: string;
  department_type: DepartmentType;
  is_active: number;
  created_at: string;
}

export interface OperationalExpense {
  id: number;
  store_id: number;
  cost_center_id: number;
  expense_type: ExpenseType;
  description: string;
  amount: number;
  due_date: string;
  payment_date?: string | null;
  status: ExpenseStatus;
  created_at: string;
  cost_center_name?: string;
  cost_center_code?: string;
  department_type?: DepartmentType;
}

export interface CreateExpenseDTO {
  storeId: number;
  costCenterId: number;
  expenseType: ExpenseType;
  description: string;
  amount: number;
  dueDate: string;
  paymentDate?: string;
  status?: ExpenseStatus;
}

export interface DreRevenueBreakdown {
  medicamentos_balcao: number;
  perfumaria_conveniencia: number;
  manipulacao_magistral: number;
  servicos_clinicos: number;
  taxas_tele_entrega: number;
  outras_receitas: number;
  total_bruto: number;
}

export interface DreDeductionsBreakdown {
  descontos_concedidos: number;
  cancelamentos_devolucoes: number;
  impostos_vendas: number;
  total_deducoes: number;
}

export interface DreCostCenterExpenseSummary {
  cost_center_id: number;
  code: string;
  name: string;
  department_type: DepartmentType;
  amount: number;
  percentage_of_expenses: number;
}

export interface DreReport {
  period_month: string;
  store_id?: number | null;
  store_name?: string;
  regime: DreRegime;
  gross_revenue: number;
  revenue_breakdown: DreRevenueBreakdown;
  deductions_amount: number;
  deductions_breakdown: DreDeductionsBreakdown;
  net_revenue: number;
  cmv_amount: number;
  gross_profit: number;
  gross_margin_percent: number;
  operating_expenses_amount: number;
  commissions_amount: number;
  total_operating_expenses: number;
  expenses_by_cost_center: DreCostCenterExpenseSummary[];
  ebitda_amount: number;
  ebitda_margin_percent: number;
  financial_expenses_amount: number;
  net_profit: number;
  net_margin_percent: number;
  break_even_point: number;
  contribution_margin_percent: number;
}

export interface DreSnapshot {
  id: number;
  store_id?: number | null;
  period_month: string;
  regime: DreRegime;
  gross_revenue: number;
  deductions_amount: number;
  net_revenue: number;
  cmv_amount: number;
  gross_profit: number;
  gross_margin_percent: number;
  operating_expenses_amount: number;
  ebitda_amount: number;
  ebitda_margin_percent: number;
  financial_expenses_amount: number;
  net_profit: number;
  net_margin_percent: number;
  break_even_point: number;
  closed_at: string;
}

export interface BranchProfitabilityRankingItem {
  store_id: number;
  store_name: string;
  gross_revenue: number;
  net_revenue: number;
  cmv_amount: number;
  operating_expenses: number;
  ebitda: number;
  ebitda_margin_percent: number;
  net_profit: number;
  net_margin_percent: number;
}
