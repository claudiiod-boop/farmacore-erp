import type { Database } from '../../database/connection';
import type {
  DreReport,
  AbcCurveReport,
  AbcCurveItem,
  AbcCategorySummary,
  AbcClass,
  PharmaceuticalCategory,
} from './types';

export class FinancialReportsService {
  constructor(private db: Database) {}

  /**
   * Gera o DRE (Demonstrativo do Resultado do Exercício) Gerencial do período,
   * apurando Receita Bruta, Deduções, CMV (via compras/PF), Lucro Bruto,
   * Despesas Operacionais (sangrias) e Lucro Operacional Líquido.
   */
  generateDre(startDate: string, endDate: string): DreReport {
    // 1. Vendas completadas no período
    interface SaleRow {
      id: number;
      total_amount: number;
      discount_amount: number;
    }

    const sales = this.db
      .prepare<SaleRow>(`
        SELECT id, total_amount, discount_amount
        FROM sales
        WHERE status = 'COMPLETED'
          AND date(created_at) >= date(?)
          AND date(created_at) <= date(?)
      `)
      .all(startDate, endDate);

    const salesCount = sales.length;
    const discounts = Number(
      sales.reduce((acc, s) => acc + Number(s.discount_amount || 0), 0).toFixed(2)
    );

    // 2. Itens das vendas completadas e CMV (Prioridade: Compra -> Fallback: PF -> Fallback 2: Preço * 0.6)
    interface SaleItemRow {
      quantity: number;
      unit_price: number;
      total_price: number;
      product_pf: number;
      product_price: number;
      purchase_unit_cost: number | null;
    }

    const items = this.db
      .prepare<SaleItemRow>(`
        SELECT
          si.quantity,
          si.unit_price,
          si.total_price,
          p.pf as product_pf,
          p.price as product_price,
          (
            SELECT pii.unit_cost
            FROM purchase_invoice_items pii
            JOIN purchase_invoices pi ON pi.id = pii.purchase_invoice_id
            WHERE pii.product_id = si.product_id
            ORDER BY pi.id DESC, pii.id DESC
            LIMIT 1
          ) as purchase_unit_cost
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE s.status = 'COMPLETED'
          AND date(s.created_at) >= date(?)
          AND date(s.created_at) <= date(?)
      `)
      .all(startDate, endDate);

    let grossRevenue = 0;
    let itemsSold = 0;
    let cmv = 0;

    for (const item of items) {
      const qty = Number(item.quantity);
      const totalItemPrice = Number(item.total_price);
      grossRevenue += totalItemPrice;
      itemsSold += qty;

      const unitCost = item.purchase_unit_cost !== null
        ? Number(item.purchase_unit_cost)
        : (item.product_pf ? Number(item.product_pf) : Number(item.product_price) * 0.6);

      cmv += qty * unitCost;
    }

    grossRevenue = Number(grossRevenue.toFixed(2));
    cmv = Number(cmv.toFixed(2));

    // 3. Vendas canceladas no período
    const cancellationRow = this.db
      .prepare<{ total: number | null }>(`
        SELECT SUM(total_amount) as total
        FROM sales
        WHERE status = 'CANCELLED'
          AND date(created_at) >= date(?)
          AND date(created_at) <= date(?)
      `)
      .get(startDate, endDate);

    const cancellations = Number(Number(cancellationRow?.total || 0).toFixed(2));

    // 4. Taxas de TEF / Cartões confirmadas no período
    const tefFeesRow = this.db
      .prepare<{ total: number | null }>(`
        SELECT SUM(amount - COALESCE(net_amount, amount)) as total
        FROM tef_transactions
        WHERE status = 'CONFIRMED'
          AND date(created_at) >= date(?)
          AND date(created_at) <= date(?)
      `)
      .get(startDate, endDate);

    const tefFees = Number(Number(tefFeesRow?.total || 0).toFixed(2));

    // 5. Receita Líquida
    const netRevenue = Number((grossRevenue - discounts - cancellations - tefFees).toFixed(2));

    // 6. Lucro Bruto e Margem Bruta
    const grossProfit = Number((netRevenue - cmv).toFixed(2));
    const grossMarginPercent = netRevenue > 0
      ? Number(((grossProfit / netRevenue) * 100).toFixed(2))
      : 0;

    // 7. Despesas Operacionais (Sangrias do período)
    const expenseRow = this.db
      .prepare<{ total: number | null }>(`
        SELECT SUM(amount) as total
        FROM cash_movements
        WHERE type = 'SANGRIA'
          AND date(created_at) >= date(?)
          AND date(created_at) <= date(?)
      `)
      .get(startDate, endDate);

    const operatingExpenses = Number(Number(expenseRow?.total || 0).toFixed(2));

    // 8. Lucro Operacional Líquido e Margem Líquida
    const netOperatingProfit = Number((grossProfit - operatingExpenses).toFixed(2));
    const netMarginPercent = netRevenue > 0
      ? Number(((netOperatingProfit / netRevenue) * 100).toFixed(2))
      : 0;

    return {
      startDate,
      endDate,
      grossRevenue,
      discounts,
      cancellations,
      tefFees,
      netRevenue,
      cmv,
      grossProfit,
      grossMarginPercent,
      operatingExpenses,
      netOperatingProfit,
      netMarginPercent,
      salesCount,
      itemsSold,
    };
  }

  /**
   * Gera a Curva ABC 80/20 com ranking de faturamento por produto e resumo
   * por categorias farmacêuticas (REFERENCIA, GENERICO, SIMILAR, PERFUMARIA, CORRELATOS_OUTROS).
   */
  generateAbcCurve(startDate: string, endDate: string, categoryFilter?: string): AbcCurveReport {
    interface ProductSalesRow {
      product_id: number;
      ean: string;
      product_name: string;
      category: PharmaceuticalCategory;
      quantity_sold: number;
      gross_revenue: number;
      unit_cost_average: number;
    }

    const categoryCondition = categoryFilter ? 'AND p.category = ?' : '';
    const queryParams: (string | number)[] = [startDate, endDate];
    if (categoryFilter) {
      queryParams.push(categoryFilter);
    }

    const rows = this.db
      .prepare<ProductSalesRow>(`
        SELECT
          p.id as product_id,
          p.ean,
          p.name as product_name,
          p.category,
          SUM(si.quantity) as quantity_sold,
          SUM(si.total_price) as gross_revenue,
          COALESCE(
            (
              SELECT pii.unit_cost
              FROM purchase_invoice_items pii
              JOIN purchase_invoices pi ON pi.id = pii.purchase_invoice_id
              WHERE pii.product_id = p.id
              ORDER BY pi.id DESC, pii.id DESC
              LIMIT 1
            ),
            p.pf,
            p.price * 0.6
          ) as unit_cost_average
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE s.status = 'COMPLETED'
          AND date(s.created_at) >= date(?)
          AND date(s.created_at) <= date(?)
          ${categoryCondition}
        GROUP BY p.id, p.ean, p.name, p.category
        ORDER BY gross_revenue DESC
      `)
      .all(...queryParams);

    const totalRevenue = Number(
      rows.reduce((acc, r) => acc + Number(r.gross_revenue), 0).toFixed(2)
    );

    let cumulativeRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;

    let classACount = 0;
    let classBCount = 0;
    let classCCount = 0;

    const items: AbcCurveItem[] = rows.map((r, index) => {
      const grossRevenue = Number(Number(r.gross_revenue).toFixed(2));
      const quantitySold = Number(r.quantity_sold);
      const unitCostAverage = Number(Number(r.unit_cost_average).toFixed(2));
      const itemCost = Number((unitCostAverage * quantitySold).toFixed(2));
      const itemProfit = Number((grossRevenue - itemCost).toFixed(2));
      const marginPercent = grossRevenue > 0
        ? Number(((itemProfit / grossRevenue) * 100).toFixed(2))
        : 0;

      totalCost += itemCost;
      totalProfit += itemProfit;

      const revenueSharePercent = totalRevenue > 0
        ? Number(((grossRevenue / totalRevenue) * 100).toFixed(2))
        : 0;

      cumulativeRevenue += grossRevenue;
      const cumulativeRevenuePercent = totalRevenue > 0
        ? Number(((cumulativeRevenue / totalRevenue) * 100).toFixed(2))
        : 0;

      // Classificacao Pareto 80/20:
      // Top acumulado ate 80% -> Classe A
      // Acumulado de 80% ate 95% -> Classe B
      // Acima de 95% -> Classe C
      let abcClass: AbcClass = 'A';
      if (index === 0 || cumulativeRevenuePercent <= 80.0) {
        abcClass = 'A';
        classACount++;
      } else if (cumulativeRevenuePercent <= 95.0 || classBCount === 0) {
        abcClass = 'B';
        classBCount++;
      } else {
        abcClass = 'C';
        classCCount++;
      }

      return {
        productId: r.product_id,
        ean: r.ean,
        productName: r.product_name,
        category: r.category,
        quantitySold,
        grossRevenue,
        revenueSharePercent,
        cumulativeRevenuePercent,
        abcClass,
        unitCostAverage,
        totalCost: itemCost,
        grossProfit: itemProfit,
        marginPercent,
      };
    });

    totalCost = Number(totalCost.toFixed(2));
    totalProfit = Number(totalProfit.toFixed(2));
    const overallMarginPercent = totalRevenue > 0
      ? Number(((totalProfit / totalRevenue) * 100).toFixed(2))
      : 0;

    // Resumo por categoria farmaceutica
    const categoryMap = new Map<PharmaceuticalCategory, {
      grossRevenue: number;
      quantitySold: number;
      totalCost: number;
    }>();

    for (const item of items) {
      const cat = item.category;
      const current = categoryMap.get(cat) || { grossRevenue: 0, quantitySold: 0, totalCost: 0 };
      current.grossRevenue += item.grossRevenue;
      current.quantitySold += item.quantitySold;
      current.totalCost += item.totalCost;
      categoryMap.set(cat, current);
    }

    const categoriesSummary: AbcCategorySummary[] = Array.from(categoryMap.entries()).map(
      ([category, val]) => {
        const catRev = Number(val.grossRevenue.toFixed(2));
        const catProfit = Number((catRev - val.totalCost).toFixed(2));
        const revenueSharePercent = totalRevenue > 0
          ? Number(((catRev / totalRevenue) * 100).toFixed(2))
          : 0;
        const marginPercent = catRev > 0
          ? Number(((catProfit / catRev) * 100).toFixed(2))
          : 0;

        return {
          category,
          grossRevenue: catRev,
          revenueSharePercent,
          quantitySold: val.quantitySold,
          grossProfit: catProfit,
          marginPercent,
        };
      }
    );

    return {
      startDate,
      endDate,
      totalRevenue,
      totalCost,
      totalProfit,
      overallMarginPercent,
      totalProductsCount: items.length,
      classACount,
      classBCount,
      classCCount,
      items,
      categoriesSummary,
    };
  }
}
