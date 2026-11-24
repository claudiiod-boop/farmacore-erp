import { Database } from '../../database/connection';
import {
  CostCenter,
  CreateCostCenterDTO,
  OperationalExpense,
  CreateExpenseDTO,
  ExpenseFilter,
  DreRegime,
  DreReport,
  DreSnapshot,
  BranchProfitabilityRankingItem,
  DreRevenueBreakdown,
  DreDeductionsBreakdown,
  DreCostCenterExpenseSummary,
} from './dre.types';

export class DreService {
  constructor(private db: Database) {}

  /**
   * Lista centros de custo cadastrados (globais e da filial)
   */
  listCostCenters(storeId?: number): CostCenter[] {
    let sql = 'SELECT * FROM cost_centers WHERE is_active = 1';
    const params: any[] = [];

    if (storeId !== undefined) {
      sql += ' AND (store_id IS NULL OR store_id = ?)';
      params.push(storeId);
    }

    sql += ' ORDER BY code ASC';
    return this.db.prepare(sql).all(...params) as CostCenter[];
  }

  /**
   * Cadastra novo centro de custo
   */
  createCostCenter(input: CreateCostCenterDTO): CostCenter {
    const stmt = this.db.prepare(`
      INSERT INTO cost_centers (store_id, code, name, department_type, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);

    const result = stmt.run(
      input.store_id || null,
      input.code.trim().toUpperCase(),
      input.name.trim(),
      input.department_type
    );

    return this.db.prepare('SELECT * FROM cost_centers WHERE id = ?').get(result.lastInsertRowid) as CostCenter;
  }

  /**
   * Lista despesas operacionais com filtros opcionais
   */
  listExpenses(filters?: ExpenseFilter): OperationalExpense[] {
    let sql = `
      SELECT 
        e.*,
        c.name as cost_center_name,
        c.code as cost_center_code,
        c.department_type
      FROM operational_expenses e
      JOIN cost_centers c ON c.id = e.cost_center_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.store_id) {
      sql += ' AND e.store_id = ?';
      params.push(filters.store_id);
    }
    if (filters?.cost_center_id) {
      sql += ' AND e.cost_center_id = ?';
      params.push(filters.cost_center_id);
    }
    if (filters?.expense_type) {
      sql += ' AND e.expense_type = ?';
      params.push(filters.expense_type);
    }
    if (filters?.status) {
      sql += ' AND e.status = ?';
      params.push(filters.status);
    }
    if (filters?.start_date) {
      sql += ' AND e.due_date >= ?';
      params.push(filters.start_date);
    }
    if (filters?.end_date) {
      sql += ' AND e.due_date <= ?';
      params.push(filters.end_date);
    }

    sql += ' ORDER BY e.due_date DESC, e.id DESC';
    return this.db.prepare(sql).all(...params) as OperationalExpense[];
  }

  /**
   * Lança uma nova despesa operacional
   */
  createExpense(input: CreateExpenseDTO): OperationalExpense {
    const stmt = this.db.prepare(`
      INSERT INTO operational_expenses (
        store_id, cost_center_id, expense_type, description, amount, due_date, payment_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const status = input.status || (input.payment_date ? 'PAID' : 'PENDING');

    const result = stmt.run(
      input.store_id,
      input.cost_center_id,
      input.expense_type,
      input.description.trim(),
      input.amount,
      input.due_date,
      input.payment_date || null,
      status
    );

    return this.db.prepare(`
      SELECT 
        e.*,
        c.name as cost_center_name,
        c.code as cost_center_code,
        c.department_type
      FROM operational_expenses e
      JOIN cost_centers c ON c.id = e.cost_center_id
      WHERE e.id = ?
    `).get(result.lastInsertRowid) as OperationalExpense;
  }

  /**
   * Realiza a baixa / liquidação financeira de uma despesa
   */
  payExpense(id: number, paymentDate?: string): OperationalExpense {
    const date = paymentDate || new Date().toISOString().split('T')[0];
    this.db.prepare(`
      UPDATE operational_expenses
      SET status = 'PAID', payment_date = ?
      WHERE id = ?
    `).run(date, id);

    const expense = this.db.prepare(`
      SELECT 
        e.*,
        c.name as cost_center_name,
        c.code as cost_center_code,
        c.department_type
      FROM operational_expenses e
      JOIN cost_centers c ON c.id = e.cost_center_id
      WHERE e.id = ?
    `).get(id) as OperationalExpense | undefined;

    if (!expense) {
      throw new Error(`Despesa com ID ${id} não encontrada.`);
    }

    return expense;
  }

  /**
   * Gera o DRE Gerencial Consolidado do período especificado
   */
  generateDreReport(periodMonth: string, storeId?: number, regime: DreRegime = 'COMPETENCIA'): DreReport {
    // Validação de formato YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
      throw new Error('Formato de mês inválido. Use YYYY-MM (ex: 2026-11).');
    }

    let storeName: string | undefined;
    if (storeId) {
      const store = this.db.prepare('SELECT name FROM stores WHERE id = ?').get(storeId) as { name: string } | undefined;
      storeName = store?.name;
    }

    // 1. Apuração de Vendas & Faturamento de Produtos
    let salesQuery = `
      SELECT 
        s.id as sale_id,
        s.store_id,
        s.total_amount,
        s.discount_amount,
        s.created_at,
        si.quantity,
        si.unit_price,
        si.total_price,
        p.id as product_id,
        p.name as product_name,
        p.category as product_category,
        p.pf as cost_pf
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      JOIN products p ON p.id = si.product_id
      WHERE strftime('%Y-%m', s.created_at) = ?
        AND s.status = 'COMPLETED'
    `;
    const salesParams: any[] = [periodMonth];

    if (storeId) {
      salesQuery += ' AND s.store_id = ?';
      salesParams.push(storeId);
    }

    const saleItems = this.db.prepare(salesQuery).all(...salesParams) as Array<{
      sale_id: number;
      store_id: number;
      total_amount: number;
      discount_amount: number;
      created_at: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      product_id: number;
      product_name: string;
      product_category: string;
      cost_pf: number;
    }>;

    // Agrupamento por Centro de Receita
    let medBalcao = 0;
    let perfumaria = 0;
    let cmvTotal = 0;

    for (const item of saleItems) {
      const itemSubtotal = item.total_price;
      const itemCost = (item.cost_pf || 0) * item.quantity;
      cmvTotal += itemCost;

      if (item.product_category === 'PERFUMARIA') {
        perfumaria += itemSubtotal;
      } else {
        medBalcao += itemSubtotal;
      }
    }

    // 2. Outras Receitas Farmacêuticas (Manipulação, Atendimentos Clínicos, Tele-Entrega)
    let manipulacaoReceita = 0;
    try {
      let compSql = `
        SELECT COALESCE(SUM(total_price), 0) as total
        FROM compounding_orders
        WHERE strftime('%Y-%m', created_at) = ?
          AND status IN ('PRODUCED', 'DELIVERED')
      `;
      const compParams: any[] = [periodMonth];
      if (storeId) {
        compSql += ' AND store_id = ?';
        compParams.push(storeId);
      }
      const compRow = this.db.prepare(compSql).get(...compParams) as { total: number } | undefined;
      manipulacaoReceita = compRow?.total || 0;
    } catch {
      manipulacaoReceita = 0;
    }

    let clinicosReceita = 0;
    try {
      let clinSql = `
        SELECT COALESCE(SUM(price), 0) as total
        FROM clinical_attendances
        WHERE strftime('%Y-%m', performed_at) = ?
          AND status = 'COMPLETED'
      `;
      const clinParams: any[] = [periodMonth];
      if (storeId) {
        clinSql += ' AND store_id = ?';
        clinParams.push(storeId);
      }
      const clinRow = this.db.prepare(clinSql).get(...clinParams) as { total: number } | undefined;
      clinicosReceita = clinRow?.total || 0;
    } catch {
      clinicosReceita = 0;
    }

    let teleEntregaReceita = 0;
    try {
      let delivSql = `
        SELECT COALESCE(SUM(delivery_fee), 0) as total
        FROM delivery_orders
        WHERE strftime('%Y-%m', created_at) = ?
          AND status = 'DELIVERED'
      `;
      const delivParams: any[] = [periodMonth];
      if (storeId) {
        delivSql += ' AND store_id = ?';
        delivParams.push(storeId);
      }
      const delivRow = this.db.prepare(delivSql).get(...delivParams) as { total: number } | undefined;
      teleEntregaReceita = delivRow?.total || 0;
    } catch {
      teleEntregaReceita = 0;
    }

    const revenueBreakdown: DreRevenueBreakdown = {
      medicamentos_balcao: Number(medBalcao.toFixed(2)),
      perfumaria_conveniencia: Number(perfumaria.toFixed(2)),
      manipulacao_magistral: Number(manipulacaoReceita.toFixed(2)),
      servicos_clinicos: Number(clinicosReceita.toFixed(2)),
      taxas_tele_entrega: Number(teleEntregaReceita.toFixed(2)),
      outras_receitas: 0,
      total_bruto: Number((medBalcao + perfumaria + manipulacaoReceita + clinicosReceita + teleEntregaReceita).toFixed(2)),
    };

    const grossRevenue = revenueBreakdown.total_bruto;

    // 3. Deduções da Receita Bruta (Descontos e Impostos Estimados)
    let totalDiscountsQuery = `
      SELECT COALESCE(SUM(discount_amount), 0) as total_discount
      FROM sales
      WHERE strftime('%Y-%m', created_at) = ?
        AND status = 'COMPLETED'
    `;
    const discParams: any[] = [periodMonth];
    if (storeId) {
      totalDiscountsQuery += ' AND store_id = ?';
      discParams.push(storeId);
    }
    const discRow = this.db.prepare(totalDiscountsQuery).get(...discParams) as { total_discount: number } | undefined;
    const totalDiscounts = discRow?.total_discount || 0;

    // Impostos médios estimados do setor farmacêutico (Simples/Presumido ~ 5.5% sobre faturamento)
    const baseTributavel = Math.max(0, grossRevenue - totalDiscounts);
    const impostosVendas = Number((baseTributavel * 0.055).toFixed(2));

    const deductionsBreakdown: DreDeductionsBreakdown = {
      descontos_concedidos: Number(totalDiscounts.toFixed(2)),
      cancelamentos_devolucoes: 0,
      impostos_vendas: impostosVendas,
      total_deducoes: Number((totalDiscounts + impostosVendas).toFixed(2)),
    };

    const deductionsAmount = deductionsBreakdown.total_deducoes;
    const netRevenue = Number((grossRevenue - deductionsAmount).toFixed(2));

    // 4. Lucro Bruto e Margem Bruta
    cmvTotal = Number(cmvTotal.toFixed(2));
    const grossProfit = Number((netRevenue - cmvTotal).toFixed(2));
    const grossMarginPercent = netRevenue > 0 ? Number(((grossProfit / netRevenue) * 100).toFixed(2)) : 0;

    // 5. Apuração de Despesas Operacionais por Centro de Custo
    let expenseSql = `
      SELECT 
        e.*,
        c.id as cc_id,
        c.code as cc_code,
        c.name as cc_name,
        c.department_type as cc_department
      FROM operational_expenses e
      JOIN cost_centers c ON c.id = e.cost_center_id
      WHERE e.status != 'CANCELLED'
    `;
    const expParams: any[] = [];

    if (regime === 'CAIXA') {
      expenseSql += ` AND e.status = 'PAID' AND strftime('%Y-%m', e.payment_date) = ?`;
      expParams.push(periodMonth);
    } else {
      expenseSql += ` AND strftime('%Y-%m', e.due_date) = ?`;
      expParams.push(periodMonth);
    }

    if (storeId) {
      expenseSql += ' AND e.store_id = ?';
      expParams.push(storeId);
    }

    const expensesList = this.db.prepare(expenseSql).all(...expParams) as Array<{
      id: number;
      store_id: number;
      amount: number;
      expense_type: string;
      cc_id: number;
      cc_code: string;
      cc_name: string;
      cc_department: string;
    }>;

    // Agrupar despesas por centro de custo e financeiras
    const ccMap = new Map<number, DreCostCenterExpenseSummary>();
    let totalGeneralExpenses = 0;
    let financialExpenses = 0;

    for (const exp of expensesList) {
      if (exp.expense_type === 'FINANCEIRA') {
        financialExpenses += exp.amount;
      } else {
        totalGeneralExpenses += exp.amount;
      }

      const existing = ccMap.get(exp.cc_id) || {
        cost_center_id: exp.cc_id,
        code: exp.cc_code,
        name: exp.cc_name,
        department_type: exp.cc_department as any,
        amount: 0,
        percentage_of_expenses: 0,
      };
      existing.amount += exp.amount;
      ccMap.set(exp.cc_id, existing);
    }

    // 6. Integração com Folha de Comissões de Balcão (da Fase 25)
    let commissionsAmount = 0;
    try {
      let commSql = `
        SELECT COALESCE(SUM(total_commission), 0) as total_comm
        FROM commission_statements
        WHERE period_month = ?
      `;
      const commParams: any[] = [periodMonth];
      if (storeId) {
        commSql += ' AND store_id = ?';
        commParams.push(storeId);
      }
      const commRow = this.db.prepare(commSql).get(...commParams) as { total_comm: number } | undefined;
      commissionsAmount = commRow?.total_comm || 0;
    } catch {
      commissionsAmount = 0;
    }

    totalGeneralExpenses = Number((totalGeneralExpenses + commissionsAmount).toFixed(2));
    financialExpenses = Number(financialExpenses.toFixed(2));

    const totalAllExpenses = totalGeneralExpenses + financialExpenses;
    const expensesByCostCenter: DreCostCenterExpenseSummary[] = Array.from(ccMap.values()).map((cc) => ({
      ...cc,
      amount: Number(cc.amount.toFixed(2)),
      percentage_of_expenses:
        totalAllExpenses > 0 ? Number(((cc.amount / totalAllExpenses) * 100).toFixed(2)) : 0,
    }));

    // 7. EBITDA / LAJIDA
    const ebitdaAmount = Number((grossProfit - totalGeneralExpenses).toFixed(2));
    const ebitdaMarginPercent = netRevenue > 0 ? Number(((ebitdaAmount / netRevenue) * 100).toFixed(2)) : 0;

    // 8. Lucro Líquido
    const netProfit = Number((ebitdaAmount - financialExpenses).toFixed(2));
    const netMarginPercent = netRevenue > 0 ? Number(((netProfit / netRevenue) * 100).toFixed(2)) : 0;

    // 9. Ponto de Equilíbrio (Break-Even)
    // Margem de Contribuição = Receita Líquida - CMV - Comissões
    const contributionMargin = netRevenue - cmvTotal - commissionsAmount;
    const contributionMarginPercent = netRevenue > 0 ? (contributionMargin / netRevenue) : 0;
    const fixedExpenses = Math.max(0, totalGeneralExpenses - commissionsAmount);
    const breakEvenPoint =
      contributionMarginPercent > 0
        ? Number((fixedExpenses / contributionMarginPercent).toFixed(2))
        : 0;

    return {
      period_month: periodMonth,
      store_id: storeId || null,
      store_name: storeName,
      regime,
      gross_revenue: grossRevenue,
      revenue_breakdown: revenueBreakdown,
      deductions_amount: deductionsAmount,
      deductions_breakdown: deductionsBreakdown,
      net_revenue: netRevenue,
      cmv_amount: cmvTotal,
      gross_profit: grossProfit,
      gross_margin_percent: grossMarginPercent,
      operating_expenses_amount: Number((totalGeneralExpenses - commissionsAmount).toFixed(2)),
      commissions_amount: Number(commissionsAmount.toFixed(2)),
      total_operating_expenses: totalGeneralExpenses,
      expenses_by_cost_center: expensesByCostCenter,
      ebitda_amount: ebitdaAmount,
      ebitda_margin_percent: ebitdaMarginPercent,
      financial_expenses_amount: financialExpenses,
      net_profit: netProfit,
      net_margin_percent: netMarginPercent,
      break_even_point: breakEvenPoint,
      contribution_margin_percent: Number((contributionMarginPercent * 100).toFixed(2)),
    };
  }

  /**
   * Salva ou atualiza um snapshot oficial de fechamento de DRE
   */
  saveDreSnapshot(periodMonth: string, storeId?: number, regime: DreRegime = 'COMPETENCIA'): DreSnapshot {
    const report = this.generateDreReport(periodMonth, storeId, regime);

    const stmt = this.db.prepare(`
      INSERT INTO dre_snapshots (
        store_id, period_month, regime, gross_revenue, deductions_amount,
        net_revenue, cmv_amount, gross_profit, gross_margin_percent,
        operating_expenses_amount, ebitda_amount, ebitda_margin_percent,
        financial_expenses_amount, net_profit, net_margin_percent, break_even_point, closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(store_id, period_month, regime) DO UPDATE SET
        gross_revenue = excluded.gross_revenue,
        deductions_amount = excluded.deductions_amount,
        net_revenue = excluded.net_revenue,
        cmv_amount = excluded.cmv_amount,
        gross_profit = excluded.gross_profit,
        gross_margin_percent = excluded.gross_margin_percent,
        operating_expenses_amount = excluded.operating_expenses_amount,
        ebitda_amount = excluded.ebitda_amount,
        ebitda_margin_percent = excluded.ebitda_margin_percent,
        financial_expenses_amount = excluded.financial_expenses_amount,
        net_profit = excluded.net_profit,
        net_margin_percent = excluded.net_margin_percent,
        break_even_point = excluded.break_even_point,
        closed_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      report.store_id,
      report.period_month,
      report.regime,
      report.gross_revenue,
      report.deductions_amount,
      report.net_revenue,
      report.cmv_amount,
      report.gross_profit,
      report.gross_margin_percent,
      report.total_operating_expenses,
      report.ebitda_amount,
      report.ebitda_margin_percent,
      report.financial_expenses_amount,
      report.net_profit,
      report.net_margin_percent,
      report.break_even_point
    );

    return this.db.prepare(`
      SELECT * FROM dre_snapshots 
      WHERE (store_id = ? OR (store_id IS NULL AND ? IS NULL))
        AND period_month = ?
        AND regime = ?
    `).get(report.store_id, report.store_id, report.period_month, report.regime) as DreSnapshot;
  }

  /**
   * Lista snapshots de DRE gravados
   */
  listDreSnapshots(storeId?: number, periodMonth?: string): DreSnapshot[] {
    let sql = 'SELECT * FROM dre_snapshots WHERE 1=1';
    const params: any[] = [];

    if (storeId !== undefined) {
      sql += ' AND store_id = ?';
      params.push(storeId);
    }
    if (periodMonth) {
      sql += ' AND period_month = ?';
      params.push(periodMonth);
    }

    sql += ' ORDER BY period_month DESC, closed_at DESC';
    return this.db.prepare(sql).all(...params) as DreSnapshot[];
  }

  /**
   * Gera o ranking comparativo de lucratividade e margem EBITDA entre filiais da rede
   */
  getBranchProfitabilityRanking(periodMonth: string): BranchProfitabilityRankingItem[] {
    const stores = this.db.prepare('SELECT id, name FROM stores WHERE is_active = 1').all() as Array<{
      id: number;
      name: string;
    }>;

    const ranking: BranchProfitabilityRankingItem[] = [];

    for (const store of stores) {
      const report = this.generateDreReport(periodMonth, store.id, 'COMPETENCIA');
      ranking.push({
        store_id: store.id,
        store_name: store.name,
        gross_revenue: report.gross_revenue,
        net_revenue: report.net_revenue,
        cmv_amount: report.cmv_amount,
        operating_expenses: report.total_operating_expenses,
        ebitda: report.ebitda_amount,
        ebitda_margin_percent: report.ebitda_margin_percent,
        net_profit: report.net_profit,
        net_margin_percent: report.net_margin_percent,
      });
    }

    // Ordena pelo maior EBITDA gerado
    ranking.sort((a, b) => b.ebitda - a.ebitda);
    return ranking;
  }
}
