import { Database } from '../../database/connection';
import {
  PharmaceuticalCategory,
  Seller,
  CommissionRule,
  CommissionCampaign,
  SalesGoal,
  CommissionStatement,
  CreateSellerInput,
  CreateCampaignInput,
  SetSalesGoalInput,
  CalculateSaleCommissionsInput,
  StatementStatus,
  CommissionKpis,
} from './commission.types';

export class CommissionService {
  constructor(private db: Database) {}

  /**
   * Identifica a categoria farmacêutica do produto para fins de comissão
   */
  public resolveProductCategory(product: {
    name?: string;
    product_name?: string;
    stripe?: string | null;
    control_type?: string | null;
    active_ingredient?: string | null;
  }): PharmaceuticalCategory {
    const rawName = product.name || product.product_name || '';
    const nameUpper = rawName.toUpperCase();

    if (nameUpper.includes('GENÉRICO') || nameUpper.includes('GENERICO')) {
      return 'GENERICO';
    }
    if (nameUpper.includes('SIMILAR') || nameUpper.includes('BONIFICADO')) {
      return 'SIMILAR';
    }
    if (nameUpper.includes('SHAMPOO') || nameUpper.includes('SABONETE') || nameUpper.includes('CREME') || nameUpper.includes('DESODORANTE')) {
      return 'PERFUMARIA';
    }
    if (nameUpper.includes('MAGISTRAL') || nameUpper.includes('MANIPULADO') || nameUpper.includes('CÁPSULA')) {
      return 'MANIPULADO';
    }
    if (product.stripe === 'NONE' || product.stripe === null) {
      return 'OTC';
    }
    return 'ETICO';
  }

  /**
   * Lista vendedores com totais acumulados no mês corrente
   */
  public listSellers(storeId?: number, activeOnly = true): Seller[] {
    const currentMonth = new Date().toISOString().slice(0, 7);
    let sql = `
      SELECT 
        s.*, 
        st.name as store_name,
        COALESCE(g.achieved_amount, 0) as current_month_sales,
        COALESCE(SUM(cs.final_commission_amount), 0) as current_month_commission
      FROM sellers s
      JOIN stores st ON st.id = s.store_id
      LEFT JOIN sales_goals g ON g.seller_id = s.id AND g.period_month = ?
      LEFT JOIN commission_statements cs ON cs.seller_id = s.id AND cs.period_month = ?
      WHERE 1=1
    `;
    const params: any[] = [currentMonth, currentMonth];

    if (activeOnly) {
      sql += ' AND s.is_active = 1';
    }
    if (storeId) {
      sql += ' AND s.store_id = ?';
      params.push(storeId);
    }

    sql += ' GROUP BY s.id ORDER BY current_month_sales DESC, s.name ASC';
    return this.db.prepare(sql).all(...params) as Seller[];
  }

  /**
   * Cadastra novo vendedor/atendente
   */
  public createSeller(input: CreateSellerInput): Seller {
    if (!input.name?.trim()) {
      throw new Error('SELLER_NAME_REQUIRED');
    }

    const store = this.db.prepare('SELECT id FROM stores WHERE id = ?').get(input.store_id);
    if (!store) {
      throw new Error('STORE_NOT_FOUND');
    }

    const stmt = this.db.prepare(`
      INSERT INTO sellers (store_id, name, cpf, role, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);

    const res = stmt.run(
      input.store_id,
      input.name.trim(),
      input.cpf?.trim() || null,
      input.role || 'BALCONISTA'
    );

    return this.db
      .prepare('SELECT * FROM sellers WHERE id = ?')
      .get(Number(res.lastInsertRowid)) as Seller;
  }

  /**
   * Lista regras de comissão por categoria
   */
  public listRules(): CommissionRule[] {
    return this.db
      .prepare('SELECT * FROM commission_rules ORDER BY percentage DESC')
      .all() as CommissionRule[];
  }

  /**
   * Atualiza percentual de comissão de uma categoria
   */
  public updateRule(
    category: PharmaceuticalCategory,
    percentage: number,
    description?: string
  ): CommissionRule {
    if (percentage < 0 || percentage > 100) {
      throw new Error('INVALID_PERCENTAGE');
    }

    this.db
      .prepare(`
        UPDATE commission_rules
        SET percentage = ?, description = COALESCE(?, description), updated_at = CURRENT_TIMESTAMP
        WHERE category_type = ?
      `)
      .run(percentage, description || null, category);

    return this.db
      .prepare('SELECT * FROM commission_rules WHERE category_type = ?')
      .get(category) as CommissionRule;
  }

  /**
   * Lista campanhas de premiação por caixa
   */
  public listCampaigns(activeOnly = false): CommissionCampaign[] {
    let sql = `
      SELECT c.*, p.name as product_name
      FROM commission_campaigns c
      LEFT JOIN products p ON p.id = c.product_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (activeOnly) {
      const today = new Date().toISOString().split('T')[0];
      sql += ' AND c.is_active = 1 AND c.start_date <= ? AND c.end_date >= ?';
      params.push(today, today);
    }
    sql += ' ORDER BY c.id DESC';
    return this.db.prepare(sql).all(...params) as CommissionCampaign[];
  }

  /**
   * Cadastra nova campanha de premiação por fabricante ou produto
   */
  public createCampaign(input: CreateCampaignInput): CommissionCampaign {
    if (!input.name?.trim()) {
      throw new Error('CAMPAIGN_NAME_REQUIRED');
    }
    if (input.bonus_per_unit < 0) {
      throw new Error('INVALID_BONUS_AMOUNT');
    }

    const stmt = this.db.prepare(`
      INSERT INTO commission_campaigns (
        name, manufacturer, product_id, bonus_per_unit, start_date, end_date, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    const res = stmt.run(
      input.name.trim(),
      input.manufacturer?.trim() || null,
      input.product_id || null,
      input.bonus_per_unit,
      input.start_date,
      input.end_date
    );

    return this.db
      .prepare(`
        SELECT c.*, p.name as product_name
        FROM commission_campaigns c
        LEFT JOIN products p ON p.id = c.product_id
        WHERE c.id = ?
      `)
      .get(Number(res.lastInsertRowid)) as CommissionCampaign;
  }

  /**
   * Define meta de venda mensal para o vendedor
   */
  public setSalesGoal(input: SetSalesGoalInput): SalesGoal {
    if (input.target_amount <= 0) {
      throw new Error('INVALID_TARGET_AMOUNT');
    }

    const seller = this.db.prepare('SELECT id FROM sellers WHERE id = ?').get(input.seller_id);
    if (!seller) {
      throw new Error('SELLER_NOT_FOUND');
    }

    const existing = this.db
      .prepare('SELECT id FROM sales_goals WHERE seller_id = ? AND period_month = ?')
      .get(input.seller_id, input.period_month) as { id: number } | undefined;

    if (existing) {
      this.db
        .prepare('UPDATE sales_goals SET target_amount = ? WHERE id = ?')
        .run(input.target_amount, existing.id);
    } else {
      this.db
        .prepare(`
          INSERT INTO sales_goals (seller_id, store_id, period_month, target_amount, achieved_amount, accelerator_multiplier, status)
          VALUES (?, ?, ?, ?, 0.0, 1.0, 'IN_PROGRESS')
        `)
        .run(input.seller_id, input.store_id, input.period_month, input.target_amount);
    }

    return this.getSalesGoal(input.seller_id, input.period_month);
  }

  /**
   * Obtém meta mensal do vendedor com progresso calculado
   */
  public getSalesGoal(sellerId: number, periodMonth: string): SalesGoal {
    const row = this.db
      .prepare(`
        SELECT g.*, s.name as seller_name
        FROM sales_goals g
        JOIN sellers s ON s.id = g.seller_id
        WHERE g.seller_id = ? AND g.period_month = ?
      `)
      .get(sellerId, periodMonth) as any;

    if (!row) {
      throw new Error('GOAL_NOT_FOUND');
    }

    const progress = row.target_amount > 0
      ? parseFloat(((row.achieved_amount / row.target_amount) * 100).toFixed(1))
      : 0;

    return {
      ...row,
      progress_percentage: progress,
    };
  }

  /**
   * Lista metas de um período
   */
  public listGoals(periodMonth: string, storeId?: number): SalesGoal[] {
    let sql = `
      SELECT g.*, s.name as seller_name
      FROM sales_goals g
      JOIN sellers s ON s.id = g.seller_id
      WHERE g.period_month = ?
    `;
    const params: any[] = [periodMonth];
    if (storeId) {
      sql += ' AND g.store_id = ?';
      params.push(storeId);
    }
    sql += ' ORDER BY g.achieved_amount DESC';
    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map((r) => ({
      ...r,
      progress_percentage: r.target_amount > 0
        ? parseFloat(((r.achieved_amount / r.target_amount) * 100).toFixed(1))
        : 0,
    }));
  }

  /**
   * Apura as comissões de uma venda finalizada
   */
  public calculateSaleCommissions(input: CalculateSaleCommissionsInput): CommissionStatement[] {
    const seller = this.db.prepare('SELECT id, store_id, name FROM sellers WHERE id = ?').get(input.seller_id) as any;
    if (!seller) {
      throw new Error('SELLER_NOT_FOUND');
    }

    const sale = this.db.prepare('SELECT id, total_amount, created_at FROM sales WHERE id = ?').get(input.sale_id) as any;
    if (!sale) {
      throw new Error('SALE_NOT_FOUND');
    }

    const saleDate = input.sale_date || sale.created_at?.split(' ')[0] || new Date().toISOString().split('T')[0];
    const periodMonth = saleDate.slice(0, 7);

    // Itens da venda
    const items = this.db
      .prepare(`
        SELECT si.*, p.name as product_name, p.stripe, p.control_type, p.active_ingredient
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        WHERE si.sale_id = ?
      `)
      .all(input.sale_id) as any[];

    if (items.length === 0) {
      return [];
    }

    // Regras de comissão
    const rules = this.listRules();
    const rulesMap = new Map<PharmaceuticalCategory, number>();
    for (const r of rules) {
      rulesMap.set(r.category_type, r.percentage);
    }

    // Campanhas ativas para a data
    const campaigns = this.db
      .prepare(`
        SELECT * FROM commission_campaigns
        WHERE is_active = 1 AND start_date <= ? AND end_date >= ?
      `)
      .all(saleDate, saleDate) as CommissionCampaign[];

    // Busca ou cria meta mensal do vendedor
    let goal = this.db
      .prepare('SELECT * FROM sales_goals WHERE seller_id = ? AND period_month = ?')
      .get(input.seller_id, periodMonth) as SalesGoal | undefined;

    if (!goal) {
      this.setSalesGoal({
        seller_id: input.seller_id,
        store_id: seller.store_id,
        period_month: periodMonth,
        target_amount: 10000.0, // Meta base padrão
      });
      goal = this.getSalesGoal(input.seller_id, periodMonth);
    }

    // Determina acelerador de meta baseado no atingimento atual
    let accelerator = 1.0;
    const projectedAchieved = (goal.achieved_amount || 0) + sale.total_amount;
    const achievementRatio = goal.target_amount > 0 ? projectedAchieved / goal.target_amount : 0;

    if (achievementRatio >= 1.0) {
      accelerator = 1.25; // +25% de bônus em cima de toda a comissão
    } else if (achievementRatio >= 0.8) {
      accelerator = 1.10; // +10% de acelerador intermediário
    }

    const transaction = this.db.transaction(() => {
      const statements: CommissionStatement[] = [];
      const insertStmt = this.db.prepare(`
        INSERT INTO commission_statements (
          seller_id, sale_id, sale_item_id, product_id, category_type,
          item_total, base_commission_percent, base_commission_amount,
          campaign_bonus_amount, accelerator_multiplier, final_commission_amount,
          period_month, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `);

      for (const item of items) {
        const category = this.resolveProductCategory(item);
        const percent = rulesMap.get(category) ?? 3.0;

        const baseAmount = parseFloat(((item.total_price * percent) / 100.0).toFixed(2));

        // Checa campanhas aplicáveis
        let campaignBonus = 0.0;
        for (const camp of campaigns) {
          if (camp.product_id && camp.product_id === item.product_id) {
            campaignBonus += camp.bonus_per_unit * item.quantity;
          } else if (camp.manufacturer && item.product_name.toUpperCase().includes(camp.manufacturer.toUpperCase())) {
            campaignBonus += camp.bonus_per_unit * item.quantity;
          }
        }
        campaignBonus = parseFloat(campaignBonus.toFixed(2));

        const finalAmount = parseFloat(((baseAmount + campaignBonus) * accelerator).toFixed(2));

        const res = insertStmt.run(
          input.seller_id,
          input.sale_id,
          item.id,
          item.product_id,
          category,
          item.total_price,
          percent,
          baseAmount,
          campaignBonus,
          accelerator,
          finalAmount,
          periodMonth
        );

        statements.push({
          id: Number(res.lastInsertRowid),
          seller_id: input.seller_id,
          sale_id: input.sale_id,
          sale_item_id: item.id,
          product_id: item.product_id,
          category_type: category,
          item_total: item.total_price,
          base_commission_percent: percent,
          base_commission_amount: baseAmount,
          campaign_bonus_amount: campaignBonus,
          accelerator_multiplier: accelerator,
          final_commission_amount: finalAmount,
          period_month: periodMonth,
          status: 'PENDING',
          created_at: new Date().toISOString(),
          product_name: item.product_name,
        });
      }

      // Atualiza a meta mensal do vendedor
      const newStatus = achievementRatio >= 1.0 ? 'ACHIEVED' : 'IN_PROGRESS';
      this.db
        .prepare(`
          UPDATE sales_goals
          SET achieved_amount = ?, accelerator_multiplier = ?, status = ?
          WHERE id = ?
        `)
        .run(projectedAchieved, accelerator, newStatus, goal!.id);

      return statements;
    });

    return transaction();
  }

  /**
   * Extrato detalhado de comissões por vendedor e período
   */
  public getSellerStatement(
    sellerId: number,
    periodMonth?: string,
    status?: StatementStatus
  ): CommissionStatement[] {
    let sql = `
      SELECT cs.*, p.name as product_name, s.name as seller_name
      FROM commission_statements cs
      JOIN products p ON p.id = cs.product_id
      JOIN sellers s ON s.id = cs.seller_id
      WHERE cs.seller_id = ?
    `;
    const params: any[] = [sellerId];

    if (periodMonth) {
      sql += ' AND cs.period_month = ?';
      params.push(periodMonth);
    }
    if (status) {
      sql += ' AND cs.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY cs.id DESC';
    return this.db.prepare(sql).all(...params) as CommissionStatement[];
  }

  /**
   * Fechamento mensal de comissões (Aprovação / Pagamento em Folha)
   */
  public closeMonthlyCommissions(
    sellerId: number,
    periodMonth: string,
    newStatus: 'APPROVED' | 'PAID'
  ): { updatedCount: number; totalAmount: number } {
    const sumRow = this.db
      .prepare(`
        SELECT COUNT(id) as count, COALESCE(SUM(final_commission_amount), 0) as total
        FROM commission_statements
        WHERE seller_id = ? AND period_month = ? AND status != ?
      `)
      .get(sellerId, periodMonth, newStatus) as { count: number; total: number };

    this.db
      .prepare(`
        UPDATE commission_statements
        SET status = ?
        WHERE seller_id = ? AND period_month = ?
      `)
      .run(newStatus, sellerId, periodMonth);

    return {
      updatedCount: sumRow.count,
      totalAmount: parseFloat(sumRow.total.toFixed(2)),
    };
  }

  /**
   * Indicadores e KPIs Comerciais de Comissões e Metas
   */
  public getCommissionKpis(periodMonth?: string): CommissionKpis {
    const month = periodMonth || new Date().toISOString().slice(0, 7);

    const commRow = this.db
      .prepare(`
        SELECT COALESCE(SUM(final_commission_amount), 0) as total_comm
        FROM commission_statements
        WHERE period_month = ?
      `)
      .get(month) as { total_comm: number };

    const goalRow = this.db
      .prepare(`
        SELECT 
          COALESCE(SUM(target_amount), 0) as total_target,
          COALESCE(SUM(achieved_amount), 0) as total_achieved
        FROM sales_goals
        WHERE period_month = ?
      `)
      .get(month) as { total_target: number; total_achieved: number };

    const topSellerRow = this.db
      .prepare(`
        SELECT s.name, SUM(cs.final_commission_amount) as comm
        FROM commission_statements cs
        JOIN sellers s ON s.id = cs.seller_id
        WHERE cs.period_month = ?
        GROUP BY s.id
        ORDER BY comm DESC
        LIMIT 1
      `)
      .get(month) as { name: string; comm: number } | undefined;

    const campCount = this.db
      .prepare('SELECT COUNT(id) as count FROM commission_campaigns WHERE is_active = 1')
      .get() as { count: number };

    const progress = goalRow.total_target > 0
      ? parseFloat(((goalRow.total_achieved / goalRow.total_target) * 100).toFixed(1))
      : 0;

    return {
      totalCommissionsCurrentMonth: parseFloat(commRow.total_comm.toFixed(2)),
      totalSalesAchievedCurrentMonth: parseFloat(goalRow.total_achieved.toFixed(2)),
      globalGoalProgressPercent: progress,
      topSellerName: topSellerRow?.name || 'Nenhum',
      topSellerCommission: parseFloat((topSellerRow?.comm || 0).toFixed(2)),
      activeCampaignsCount: campCount.count,
    };
  }
}
