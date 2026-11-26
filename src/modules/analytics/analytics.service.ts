import { Database } from '../../database/connection';
import {
  LiveAnalyticsSummary,
  SalesHourlyDistribution,
  CategorySalesDistribution,
  EmployeeSalesPerformance,
  TopProductMetric,
  CreateWhatsAppQuotationDTO,
  WhatsAppQuotation,
  QuotationStatus,
} from './analytics.types';

export class AnalyticsService {
  constructor(private db: Database) {}

  public getLiveAnalytics(storeId = 1): LiveAnalyticsSummary {
    const store = this.db.prepare(`SELECT id, name FROM stores WHERE id = ?`).get(storeId) as any;
    const storeName = store ? store.name : 'Magnos Farma';

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const currentYearMonth = todayStr.slice(0, 7);   // YYYY-MM
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // 1. Vendas Hoje
    const todayQuery = this.db.prepare(`
      SELECT 
        COALESCE(SUM(total_amount - discount_amount), 0) as total,
        COUNT(id) as count
      FROM sales
      WHERE store_id = ? AND status = 'COMPLETED' AND substr(created_at, 1, 10) = ?
    `).get(storeId, todayStr) as { total: number; count: number };

    const todaySales = Number(todayQuery?.total || 0);
    const todayCount = Number(todayQuery?.count || 0);
    const todayTicket = todayCount > 0 ? Number((todaySales / todayCount).toFixed(2)) : 0;

    // 2. Vendas do Mês
    const monthQuery = this.db.prepare(`
      SELECT 
        COALESCE(SUM(total_amount - discount_amount), 0) as total,
        COALESCE(SUM(discount_amount), 0) as discount,
        COALESCE(SUM(total_amount), 0) as gross,
        COUNT(id) as count
      FROM sales
      WHERE store_id = ? AND status = 'COMPLETED' AND substr(created_at, 1, 7) = ?
    `).get(storeId, currentYearMonth) as { total: number; discount: number; gross: number; count: number };

    const monthSales = Number(monthQuery?.total || 0);
    const monthDiscount = Number(monthQuery?.discount || 0);
    const monthGross = Number(monthQuery?.gross || 0);
    const monthCount = Number(monthQuery?.count || 0);
    const monthTicket = monthCount > 0 ? Number((monthSales / monthCount).toFixed(2)) : 0;
    const monthDiscountPct = monthGross > 0 ? Number(((monthDiscount / monthGross) * 100).toFixed(2)) : 0;

    // 3. Meta do Mês e Projeção
    const targetRow = this.db.prepare(`
      SELECT target_amount FROM analytics_sales_targets WHERE store_id = ? AND year_month = ?
    `).get(storeId, currentYearMonth) as { target_amount: number } | undefined;

    const monthTarget = targetRow ? targetRow.target_amount : 150000;
    const targetAchievementPct = monthTarget > 0 ? Number(((monthSales / monthTarget) * 100).toFixed(1)) : 0;

    const dailyAverage = currentDay > 0 ? monthSales / currentDay : 0;
    const projectedSales = Number((dailyAverage * daysInMonth).toFixed(2));

    // 4. Distribuição por Hora (Hoje)
    const hourlyMap = new Map<number, { customers: number; total: number }>();
    for (let h = 7; h <= 22; h++) {
      hourlyMap.set(h, { customers: 0, total: 0 });
    }

    const hourlyRows = this.db.prepare(`
      SELECT 
        CAST(strftime('%H', created_at) AS INTEGER) as hour,
        COUNT(id) as count,
        COALESCE(SUM(total_amount - discount_amount), 0) as total
      FROM sales
      WHERE store_id = ? AND status = 'COMPLETED' AND substr(created_at, 1, 10) = ?
      GROUP BY strftime('%H', created_at)
    `).all(storeId, todayStr) as Array<{ hour: number; count: number; total: number }>;

    for (const r of hourlyRows) {
      if (hourlyMap.has(r.hour)) {
        hourlyMap.set(r.hour, { customers: Number(r.count), total: Number(r.total) });
      }
    }

    const hourlyDistribution: SalesHourlyDistribution[] = Array.from(hourlyMap.entries()).map(([hour, val]) => ({
      hour,
      customersCount: val.customers,
      totalAmountBrl: Number(val.total.toFixed(2)),
    }));

    // 5. Categorias do Mês
    const catRows = this.db.prepare(`
      SELECT 
        COALESCE(p.control_type, 'Geral') as category,
        COALESCE(SUM(si.total_price), 0) as total
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.store_id = ? AND s.status = 'COMPLETED' AND substr(s.created_at, 1, 7) = ?
      GROUP BY p.control_type
      ORDER BY total DESC
    `).all(storeId, currentYearMonth) as Array<{ category: string; total: number }>;

    const totalCatSales = catRows.reduce((acc, curr) => acc + Number(curr.total), 0) || 1;
    const categoryDistribution: CategorySalesDistribution[] = catRows.map((c) => ({
      category: c.category || 'Geral',
      totalBrl: Number(Number(c.total).toFixed(2)),
      percentage: Number(((Number(c.total) / totalCatSales) * 100).toFixed(2)),
    }));

    // 6. Ranking Balconistas
    const empRows = this.db.prepare(`
      SELECT 
        COALESCE(cs.operator_name, 'Balconista') as name,
        COUNT(s.id) as count,
        COALESCE(SUM(s.total_amount - s.discount_amount), 0) as total
      FROM sales s
      LEFT JOIN cash_sessions cs ON s.cash_session_id = cs.id
      WHERE s.store_id = ? AND s.status = 'COMPLETED' AND substr(s.created_at, 1, 7) = ?
      GROUP BY cs.operator_name
      ORDER BY total DESC
    `).all(storeId, currentYearMonth) as Array<{ name: string; count: number; total: number }>;

    const employeePerformance: EmployeeSalesPerformance[] = empRows.map((e, idx) => {
      const targetBrl = 35000;
      const salesTotal = Number(e.total);
      return {
        employeeId: idx + 1,
        employeeName: e.name,
        customersServed: Number(e.count),
        totalSalesBrl: Number(salesTotal.toFixed(2)),
        averageTicketBrl: Number(e.count) > 0 ? Number((salesTotal / Number(e.count)).toFixed(2)) : 0,
        targetBrl,
        targetAchievementPct: Number(((salesTotal / targetBrl) * 100).toFixed(1)),
      };
    });

    // 7. Top Produtos Mais Vendidos
    const topProdRows = this.db.prepare(`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        COALESCE(p.control_type, 'Geral') as category,
        COALESCE(SUM(si.quantity), 0) as qty,
        COALESCE(SUM(si.total_price), 0) as total
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.store_id = ? AND s.status = 'COMPLETED' AND substr(s.created_at, 1, 7) = ?
      GROUP BY p.id, p.name, p.control_type
      ORDER BY qty DESC
      LIMIT 10
    `).all(storeId, currentYearMonth) as Array<{ product_id: number; product_name: string; category: string; qty: number; total: number }>;

    const topProducts: TopProductMetric[] = topProdRows.map((tp) => ({
      productId: tp.product_id,
      productName: tp.product_name,
      category: tp.category,
      quantitySold: Number(tp.qty),
      totalBrl: Number(Number(tp.total).toFixed(2)),
    }));

    return {
      storeId,
      storeName,
      todaySalesBrl: Number(todaySales.toFixed(2)),
      todayReceiptsCount: todayCount,
      todayAverageTicketBrl: todayTicket,
      monthSalesBrl: Number(monthSales.toFixed(2)),
      monthReceiptsCount: monthCount,
      monthAverageTicketBrl: monthTicket,
      monthTotalDiscountBrl: Number(monthDiscount.toFixed(2)),
      monthAverageDiscountPct: monthDiscountPct,
      monthTargetBrl: monthTarget,
      monthTargetAchievementPct: targetAchievementPct,
      monthProjectedSalesBrl: projectedSales,
      hourlyDistribution,
      categoryDistribution,
      employeePerformance,
      topProducts,
    };
  }

  public setStoreTarget(storeId: number, yearMonth: string, targetAmount: number) {
    this.db.prepare(`
      INSERT INTO analytics_sales_targets (store_id, year_month, target_amount)
      VALUES (?, ?, ?)
      ON CONFLICT(store_id, year_month) DO UPDATE SET target_amount = excluded.target_amount
    `).run(storeId, yearMonth, targetAmount);
  }

  public createWhatsAppQuotation(dto: CreateWhatsAppQuotationDTO): WhatsAppQuotation {
    const validDays = dto.validDays || 3;
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + validDays);
    const validUntilStr = validUntilDate.toISOString().slice(0, 10);

    let subtotal = 0;
    const itemsProcessed = dto.items.map((it) => {
      const lineTotal = Number((it.quantity * it.unitPriceBrl).toFixed(2));
      subtotal += lineTotal;
      return {
        ...it,
        totalPriceBrl: lineTotal,
      };
    });

    const discount = dto.discountBrl || 0;
    const total = Math.max(0, Number((subtotal - discount).toFixed(2)));

    // Formatar mensagem oficial WhatsApp
    const lines: string[] = [];
    lines.push(`👋 Olá, *${dto.customerName.trim()}*! Aqui é da *Magnos Farma* (Atendente: ${dto.attendantName.trim()}).`);
    lines.push(`📄 Segue seu *Orçamento Farmacêutico* exclusivo:`);
    lines.push(``);

    itemsProcessed.forEach((it, idx) => {
      lines.push(`${idx + 1}. *${it.productName.trim()}*`);
      lines.push(`   ${it.quantity} un x R$ ${it.unitPriceBrl.toFixed(2)} = *R$ ${it.totalPriceBrl.toFixed(2)}*`);
    });

    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`Subtotal: R$ ${subtotal.toFixed(2)}`);
    if (discount > 0) {
      lines.push(`Desconto Especial: - R$ ${discount.toFixed(2)} 🎉`);
    }
    lines.push(`💰 *TOTAL A PAGAR: R$ ${total.toFixed(2)}*`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`⏳ *Validade do Orçamento:* até ${validUntilStr}`);
    lines.push(`🛵 Deseja entrega rápida em seu endereço ou retirar no balcão? Responda *CONFIRMAR* para separarmos seu pedido!`);

    const messageText = lines.join('\n');

    // Inserir no banco com transação
    let quotationId = 0;
    const tx = this.db.transaction(() => {
      const res = this.db.prepare(`
        INSERT INTO whatsapp_quotations (
          store_id, customer_name, customer_phone, attendant_name,
          subtotal_brl, discount_brl, total_brl, status, valid_until, whatsapp_message_payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)
      `).run(
        dto.storeId,
        dto.customerName.trim(),
        dto.customerPhone.trim(),
        dto.attendantName.trim(),
        subtotal,
        discount,
        total,
        validUntilStr,
        messageText
      );

      quotationId = Number(res.lastInsertRowid);

      const itemInsert = this.db.prepare(`
        INSERT INTO whatsapp_quotation_items (
          quotation_id, product_id, product_name, quantity, unit_price_brl, total_price_brl
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const it of itemsProcessed) {
        itemInsert.run(quotationId, it.productId, it.productName.trim(), it.quantity, it.unitPriceBrl, it.totalPriceBrl);
      }
    });

    tx();

    return this.getWhatsAppQuotationById(quotationId)!;
  }

  public getWhatsAppQuotationById(id: number): WhatsAppQuotation | null {
    const row = this.db.prepare(`SELECT * FROM whatsapp_quotations WHERE id = ?`).get(id) as any;
    if (!row) return null;

    const items = this.db.prepare(`SELECT * FROM whatsapp_quotation_items WHERE quotation_id = ?`).all(id) as any[];

    // Limpar telefone (apenas números)
    const cleanPhone = String(row.customer_phone).replace(/\D/g, '');
    const cleanDdiPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanDdiPhone}&text=${encodeURIComponent(row.whatsapp_message_payload)}`;

    return {
      ...row,
      subtotal_brl: Number(row.subtotal_brl),
      discount_brl: Number(row.discount_brl),
      total_brl: Number(row.total_brl),
      whatsapp_url: whatsappUrl,
      items: items.map((it) => ({
        ...it,
        quantity: Number(it.quantity),
        unit_price_brl: Number(it.unit_price_brl),
        total_price_brl: Number(it.total_price_brl),
      })),
    };
  }

  public listWhatsAppQuotations(storeId = 1, limit = 50): WhatsAppQuotation[] {
    const rows = this.db.prepare(`
      SELECT * FROM whatsapp_quotations
      WHERE store_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(storeId, limit) as any[];

    return rows.map((r) => this.getWhatsAppQuotationById(r.id)!);
  }

  public updateQuotationStatus(id: number, status: QuotationStatus): WhatsAppQuotation | null {
    this.db.prepare(`UPDATE whatsapp_quotations SET status = ? WHERE id = ?`).run(status, id);
    return this.getWhatsAppQuotationById(id);
  }
}
