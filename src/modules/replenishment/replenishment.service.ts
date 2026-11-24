import { getDatabase, Database } from '../../database/connection';
import type {
  ProductStockAnalysis,
  ReplenishmentOrder,
  ReplenishmentOrderDetails,
  ReplenishmentOrderItem,
  CreateReplenishmentOrderInput,
  ReplenishmentKpis,
  StockRuptureStatus,
  AbcClass,
  ReplenishmentOrderStatus,
} from './replenishment.types';

export class ReplenishmentService {
  private db: Database;

  constructor(db?: Database) {
    this.db = db || getDatabase();
  }

  /**
   * Calcula demanda de um produto nos últimos N dias
   */
  calculateProductDemand(productId: number, storeId: number = 1, days: number = 30): { totalSold: number; dailyDemand: number } {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffIso = cutoffDate.toISOString().substring(0, 10);

    // Soma saídas de vendas a partir de sngpc_movements ou pre_sale_items de vendas finalizadas
    const movRow = this.db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total
      FROM sngpc_movements
      WHERE product_id = ? AND movement_type IN ('SAIDA', 'SAIDA_VENDA') AND movement_date >= ?
    `).get(productId, cutoffIso) as { total: number };

    let totalSold = movRow?.total || 0;

    // Se sngpc_movements não tiver (ex: OTC / não-controlados), busca via pre_sale_items
    if (totalSold === 0) {
      const psRow = this.db.prepare(`
        SELECT COALESCE(SUM(psi.quantity), 0) as total
        FROM pre_sale_items psi
        JOIN pre_sales ps ON psi.pre_sale_id = ps.id
        WHERE psi.product_id = ? AND ps.status = 'COMPLETED' AND ps.created_at >= ?
      `).get(productId, cutoffIso) as { total: number };

      totalSold = psRow?.total || 0;
    }

    const dailyDemand = Number((totalSold / Math.max(1, days)).toFixed(2));
    return { totalSold, dailyDemand };
  }

  /**
   * Obtém estoque atual de um produto no estabelecimento
   */
  getProductCurrentStock(productId: number, storeId: number = 1): number {
    const row = this.db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total
      FROM batches
      WHERE product_id = ?
    `).get(productId) as { total: number };

    return row?.total || 0;
  }

  /**
   * Análise completa de parâmetros e ponto de pedido de um produto
   */
  computeProductStockAnalysis(productId: number, storeId: number = 1, days: number = 30): ProductStockAnalysis | null {
    const product = this.db.prepare(`
      SELECT id, name, ean, category, pf, price FROM products WHERE id = ?
    `).get(productId) as { id: number; name: string; ean: string; category?: string; pf?: number; price: number } | undefined;

    if (!product) return null;

    // Parâmetros configurados ou defaults
    const param = this.db.prepare(`
      SELECT * FROM replenishment_parameters WHERE product_id = ? AND store_id = ?
    `).get(productId, storeId) as any | undefined;

    const leadTimeDays = param?.lead_time_days || 2;
    const safetyStockDays = param?.safety_stock_days || 3;
    const reviewCycleDays = param?.review_cycle_days || 7;
    const abcClass: AbcClass = param?.abc_class || 'B';

    const { dailyDemand } = this.calculateProductDemand(productId, storeId, days);
    const currentStock = this.getProductCurrentStock(productId, storeId);

    // Ponto de Pedido: (DMD * LeadTime) + Estoque de Segurança
    const safetyStock = Math.ceil(dailyDemand * safetyStockDays);
    const reorderPoint = Math.ceil((dailyDemand * leadTimeDays) + safetyStock);
    const maxStock = Math.max(
      reorderPoint + Math.ceil(dailyDemand * reviewCycleDays),
      dailyDemand > 0 ? Math.ceil(dailyDemand * (leadTimeDays + safetyStockDays + reviewCycleDays)) : 10
    );

    const daysOfCover = dailyDemand > 0 ? Number((currentStock / dailyDemand).toFixed(1)) : (currentStock > 0 ? 999 : 0);

    // Classificação de risco de ruptura
    let status: StockRuptureStatus = 'OK';
    if (currentStock === 0) {
      status = 'OUT_OF_STOCK';
    } else if (daysOfCover < leadTimeDays) {
      status = 'CRITICAL';
    } else if (currentStock <= reorderPoint) {
      status = 'REORDER_NEEDED';
    }

    // Quantidade sugerida para atingir maxStock
    const suggestedQuantity = Math.max(0, maxStock - currentStock);
    const unitCost = product.pf && product.pf > 0 ? product.pf : Number((product.price * 0.6).toFixed(2));
    const estimatedCost = Number((suggestedQuantity * unitCost).toFixed(2));

    return {
      productId: product.id,
      productName: product.name,
      ean: product.ean,
      category: product.category,
      currentStock,
      dailyDemand,
      leadTimeDays,
      safetyStock,
      reorderPoint,
      maxStock,
      daysOfCover,
      suggestedQuantity,
      unitCost,
      estimatedCost,
      abcClass,
      status,
    };
  }

  /**
   * Gera todas as sugestões de compra para itens que atingiram o Ponto de Pedido
   */
  generatePurchaseSuggestions(
    storeId: number = 1,
    days: number = 30,
    filterStatus?: StockRuptureStatus
  ): ProductStockAnalysis[] {
    const products = this.db.prepare(`
      SELECT id FROM products WHERE is_active = 1 ORDER BY id ASC
    `).all() as Array<{ id: number }>;

    const suggestions: ProductStockAnalysis[] = [];

    for (const p of products) {
      const analysis = this.computeProductStockAnalysis(p.id, storeId, days);
      if (!analysis) continue;

      if (filterStatus) {
        if (analysis.status === filterStatus) {
          suggestions.push(analysis);
        }
      } else {
        // Por padrão traz todos que precisam de reposição ou estoque zero
        if (analysis.status !== 'OK' || analysis.suggestedQuantity > 0) {
          suggestions.push(analysis);
        }
      }
    }

    // Ordenação por prioridade: OUT_OF_STOCK primeiro, depois CRITICAL, depois REORDER_NEEDED
    const priorityMap: Record<StockRuptureStatus, number> = {
      OUT_OF_STOCK: 1,
      CRITICAL: 2,
      REORDER_NEEDED: 3,
      OK: 4,
    };

    suggestions.sort((a, b) => priorityMap[a.status] - priorityMap[b.status]);

    return suggestions;
  }

  /**
   * Criação de Pedido Formal de Reposição
   */
  createReplenishmentOrder(input: CreateReplenishmentOrderInput): ReplenishmentOrderDetails {
    const storeId = input.storeId || 1;
    if (!input.items || input.items.length === 0) {
      throw new Error('O pedido de reposição deve conter ao menos um item');
    }

    let estimatedTotal = 0;
    for (const it of input.items) {
      const cost = it.unitCost || 0;
      estimatedTotal += cost * it.orderQuantity;
    }

    const orderRes = this.db.prepare(`
      INSERT INTO replenishment_orders (
        store_id, distributor_name, status, total_items, estimated_total, notes
      ) VALUES (?, ?, 'DRAFT', ?, ?, ?)
    `).run(
      storeId,
      input.distributorName || 'Distribuidora Principal',
      input.items.length,
      Number(estimatedTotal.toFixed(2)),
      input.notes || null
    );

    const orderId = Number(orderRes.lastInsertRowid);

    const orderItems: ReplenishmentOrderItem[] = [];
    for (const it of input.items) {
      const prod = this.db.prepare('SELECT name, price, pf FROM products WHERE id = ?').get(it.productId) as any;
      const unitCost = it.unitCost || prod?.pf || (prod?.price ? prod.price * 0.6 : 0);
      const subtotal = Number((unitCost * it.orderQuantity).toFixed(2));

      const itemRes = this.db.prepare(`
        INSERT INTO replenishment_order_items (
          order_id, product_id, suggested_quantity, order_quantity, unit_cost, subtotal, current_stock, reorder_point
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId,
        it.productId,
        it.suggestedQuantity || it.orderQuantity,
        it.orderQuantity,
        unitCost,
        subtotal,
        it.currentStock || 0,
        it.reorderPoint || 0
      );

      orderItems.push({
        id: Number(itemRes.lastInsertRowid),
        order_id: orderId,
        product_id: it.productId,
        product_name: prod?.name || 'Medicamento',
        suggested_quantity: it.suggestedQuantity || it.orderQuantity,
        order_quantity: it.orderQuantity,
        unit_cost: unitCost,
        subtotal,
        current_stock: it.currentStock || 0,
        reorder_point: it.reorderPoint || 0,
      });
    }

    const order = this.db.prepare('SELECT * FROM replenishment_orders WHERE id = ?').get(orderId) as ReplenishmentOrder;

    return {
      ...order,
      items: orderItems,
    };
  }

  /**
   * Atualiza status de um pedido de compras
   */
  updateOrderStatus(orderId: number, status: ReplenishmentOrderStatus): ReplenishmentOrderDetails {
    this.db.prepare(`
      UPDATE replenishment_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(status, orderId);

    return this.getOrderById(orderId)!;
  }

  /**
   * Busca detalhes do pedido por ID
   */
  getOrderById(id: number): ReplenishmentOrderDetails | null {
    const order = this.db.prepare('SELECT * FROM replenishment_orders WHERE id = ?').get(id) as ReplenishmentOrder | undefined;
    if (!order) return null;

    const items = this.db.prepare(`
      SELECT roi.*, p.name as product_name
      FROM replenishment_order_items roi
      JOIN products p ON roi.product_id = p.id
      WHERE roi.order_id = ?
    `).all(id) as ReplenishmentOrderItem[];

    return {
      ...order,
      items,
    };
  }

  /**
   * Lista pedidos de reposição
   */
  listOrders(storeId: number = 1, status?: ReplenishmentOrderStatus): ReplenishmentOrder[] {
    let sql = 'SELECT * FROM replenishment_orders WHERE store_id = ?';
    const params: any[] = [storeId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY id DESC';
    return this.db.prepare(sql).all(...params) as ReplenishmentOrder[];
  }

  /**
   * KPIs de reposição em tempo real
   */
  getReplenishmentKpis(storeId: number = 1): ReplenishmentKpis {
    const suggestions = this.generatePurchaseSuggestions(storeId, 30);

    const outOfStock = suggestions.filter((s) => s.status === 'OUT_OF_STOCK').length;
    const critical = suggestions.filter((s) => s.status === 'CRITICAL').length;
    const reorderNeeded = suggestions.filter((s) => s.status === 'REORDER_NEEDED').length;
    const totalEstimatedCost = suggestions.reduce((acc, curr) => acc + curr.estimatedCost, 0);

    const activeOrders = (this.db.prepare(`
      SELECT COUNT(*) as count FROM replenishment_orders WHERE store_id = ? AND status IN ('DRAFT', 'SUBMITTED')
    `).get(storeId) as { count: number }).count;

    return {
      out_of_stock_count: outOfStock,
      critical_count: critical,
      reorder_needed_count: reorderNeeded,
      total_suggestions: suggestions.length,
      total_estimated_cost: Number(totalEstimatedCost.toFixed(2)),
      active_orders_count: activeOrders,
    };
  }
}
