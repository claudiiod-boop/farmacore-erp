import { Database } from '../../database/connection';
import type {
  B2bReplenishmentRule,
  ReplenishmentSuggestion,
  AbcClassification,
  RuptureRisk,
} from './b2b.types';

export class ReplenishmentService {
  constructor(private db: Database) {}

  /**
   * Salva ou atualiza uma regra de reposição por produto e loja.
   */
  saveReplenishmentRule(rule: B2bReplenishmentRule): B2bReplenishmentRule {
    const existing = this.db
      .prepare<any>(
        'SELECT id FROM b2b_replenishment_rules WHERE store_id = ? AND product_id = ?'
      )
      .get(rule.storeId, rule.productId);

    if (existing) {
      this.db
        .prepare(
          `UPDATE b2b_replenishment_rules
           SET min_stock = ?, safety_stock = ?, lead_time_days = ?, coverage_days = ?, target_stock = ?, abc_class = ?
           WHERE id = ?`
        )
        .run(
          rule.minStock,
          rule.safetyStock,
          rule.leadTimeDays,
          rule.coverageDays,
          rule.targetStock,
          rule.abcClass || 'B',
          existing.id
        );
      return { ...rule, id: existing.id };
    }

    const info = this.db
      .prepare(
        `INSERT INTO b2b_replenishment_rules (store_id, product_id, min_stock, safety_stock, lead_time_days, coverage_days, target_stock, abc_class)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        rule.storeId,
        rule.productId,
        rule.minStock,
        rule.safetyStock,
        rule.leadTimeDays,
        rule.coverageDays,
        rule.targetStock,
        rule.abcClass || 'B'
      );

    return { ...rule, id: Number(info.lastInsertRowid) };
  }

  /**
   * Obtém a regra de reposição de um produto.
   */
  getReplenishmentRule(storeId: number, productId: number): B2bReplenishmentRule | null {
    const row = this.db
      .prepare<any>(
        'SELECT * FROM b2b_replenishment_rules WHERE store_id = ? AND product_id = ?'
      )
      .get(storeId, productId);

    if (!row) return null;
    return {
      id: row.id,
      storeId: row.store_id,
      productId: row.product_id,
      minStock: row.min_stock,
      safetyStock: row.safety_stock,
      leadTimeDays: row.lead_time_days,
      coverageDays: row.coverage_days,
      targetStock: row.target_stock,
      abcClass: row.abc_class,
      createdAt: row.created_at,
    };
  }

  /**
   * Calcula o Consumo Médio Diário (CMD) de um produto nos últimos X dias.
   */
  calculateDailyConsumption(storeId: number, productId: number, days = 30): number {
    const row = this.db
      .prepare<any>(
        `SELECT COALESCE(SUM(psi.quantity), 0) AS total_sold
         FROM pre_sale_items psi
         JOIN sales s ON s.pre_sale_id = psi.pre_sale_id
         WHERE psi.product_id = ?
           AND s.status = 'COMPLETED'
           AND s.created_at >= date('now', '-' || ? || ' days')`
      )
      .get(productId, days);

    const totalSold = row?.total_sold || 0;
    return Math.round((totalSold / days) * 100) / 100;
  }

  /**
   * Calcula o Ponto de Pedido: PP = (CMD * LeadTime) + EstoqueSegurança
   */
  calculateReorderPoint(cmd: number, leadTimeDays: number, safetyStock: number): number {
    return Math.ceil(cmd * leadTimeDays + safetyStock);
  }

  /**
   * Determina a classificação Curva ABC para os produtos da loja com base no faturamento.
   * Top 70% = A, 70-90% = B, 90-100% = C.
   */
  determineAbcClassification(storeId: number, days = 90): Map<number, AbcClassification> {
    const rows = this.db
      .prepare<any>(
        `SELECT psi.product_id, SUM(psi.total_price) AS total_revenue
         FROM pre_sale_items psi
         JOIN sales s ON s.pre_sale_id = psi.pre_sale_id
         WHERE s.status = 'COMPLETED'
           AND s.created_at >= date('now', '-' || ? || ' days')
         GROUP BY psi.product_id
         ORDER BY total_revenue DESC`
      )
      .all(days);

    const totalRevenueSum = rows.reduce((acc, r) => acc + (r.total_revenue || 0), 0);
    const result = new Map<number, AbcClassification>();

    if (totalRevenueSum === 0) {
      return result;
    }

    let accumulated = 0;
    for (const r of rows) {
      accumulated += r.total_revenue;
      const pct = (accumulated / totalRevenueSum) * 100;
      if (pct <= 70) {
        result.set(r.product_id, 'A');
      } else if (pct <= 90) {
        result.set(r.product_id, 'B');
      } else {
        result.set(r.product_id, 'C');
      }
    }

    return result;
  }

  /**
   * Gera a lista completa de sugestões de reposição para a loja.
   */
  getReplenishmentSuggestions(
    storeId: number,
    options?: { abcFilter?: AbcClassification[]; minRuptureRiskOnly?: boolean }
  ): ReplenishmentSuggestion[] {
    const products = this.db
      .prepare<any>(
        `SELECT p.id, p.ean, p.name, p.stripe, p.pf, p.pmc, p.price,
                COALESCE((SELECT SUM(quantity - reserved_quantity) FROM batches WHERE product_id = p.id), 0) AS current_stock
         FROM products p
         WHERE p.is_active = 1
         ORDER BY p.name ASC`
      )
      .all();

    const abcMap = this.determineAbcClassification(storeId);
    const suggestions: ReplenishmentSuggestion[] = [];

    for (const prod of products) {
      const rule = this.getReplenishmentRule(storeId, prod.id);
      const leadTime = rule?.leadTimeDays ?? 2;
      const safetyStock = rule?.safetyStock ?? 3;
      const coverageDays = rule?.coverageDays ?? 15;
      const abcClass = rule?.abcClass || abcMap.get(prod.id) || 'B';

      if (options?.abcFilter && !options.abcFilter.includes(abcClass)) {
        continue;
      }

      const cmd = this.calculateDailyConsumption(storeId, prod.id, 30);
      const reorderPoint = this.calculateReorderPoint(cmd, leadTime, safetyStock);
      const currentStock = prod.current_stock || 0;
      const inTransitStock = 0; // Pode integrar com transfers em trânsito se aplicável
      const totalAvailable = currentStock + inTransitStock;

      // Classificação do risco de ruptura
      let ruptureRisk: RuptureRisk = 'NONE';
      if (totalAvailable <= 0) {
        ruptureRisk = 'HIGH';
      } else if (totalAvailable <= reorderPoint) {
        ruptureRisk = 'MEDIUM';
      } else if (totalAvailable <= reorderPoint * 1.5) {
        ruptureRisk = 'LOW';
      }

      if (options?.minRuptureRiskOnly && (ruptureRisk === 'NONE' || ruptureRisk === 'LOW')) {
        continue;
      }

      // Cálculo da quantidade sugerida
      let suggestedQuantity = 0;
      if (totalAvailable <= reorderPoint) {
        // Alvo = (CMD * Dias Cobertura) ou targetStock da regra
        const target = rule?.targetStock || Math.ceil(cmd * coverageDays);
        suggestedQuantity = Math.max(1, target - totalAvailable);
      }

      const estimatedDaysUntilRupture =
        cmd > 0 ? Math.floor(totalAvailable / cmd) : totalAvailable > 0 ? 999 : 0;

      suggestions.push({
        productId: prod.id,
        ean: prod.ean,
        productName: prod.name,
        stripe: prod.stripe,
        currentStock,
        inTransitStock,
        averageDailySales: cmd,
        leadTimeDays: leadTime,
        safetyStock,
        reorderPoint,
        suggestedQuantity,
        ruptureRisk,
        estimatedDaysUntilRupture,
        lastPurchasePrice: prod.pf,
        currentCost: prod.pf,
        abcClass,
      });
    }

    return suggestions;
  }
}
