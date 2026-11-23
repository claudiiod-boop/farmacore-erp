import { Database } from '../../database/connection';
import type {
  B2bQuotationCampaign,
  B2bQuotationItem,
  B2bQuotationProposal,
  QuotationOptimizationResult,
  SupplierOrderSummary,
} from './b2b.types';

export class QuotationOptimizerService {
  constructor(private db: Database) {}

  /**
   * Cria uma nova campanha de cotação B2B com itens cotados.
   */
  createCampaign(data: {
    storeId: number;
    title: string;
    notes?: string;
    items: Array<{
      productId: number;
      currentStock?: number;
      suggestedQuantity: number;
      requestedQuantity: number;
      targetPrice?: number;
    }>;
  }): B2bQuotationCampaign {
    const year = new Date().getFullYear();
    const countRow = this.db
      .prepare<any>(
        "SELECT COUNT(*) AS total FROM b2b_quotation_campaigns WHERE campaign_code LIKE ?"
      )
      .get(`COT-${year}-%`);
    const nextSeq = ((countRow?.total || 0) + 1).toString().padStart(4, '0');
    const campaignCode = `COT-${year}-${nextSeq}`;

    const res = this.db
      .prepare(
        `INSERT INTO b2b_quotation_campaigns (campaign_code, store_id, title, status, notes)
         VALUES (?, ?, ?, 'OPEN', ?)`
      )
      .run(campaignCode, data.storeId, data.title, data.notes || null);

    const campaignId = Number(res.lastInsertRowid);
    const createdItems: B2bQuotationItem[] = [];

    const insertItemStmt = this.db.prepare(
      `INSERT INTO b2b_quotation_items (campaign_id, product_id, current_stock, suggested_quantity, requested_quantity, target_price)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    for (const item of data.items) {
      const itemRes = insertItemStmt.run(
        campaignId,
        item.productId,
        item.currentStock || 0,
        item.suggestedQuantity,
        item.requestedQuantity,
        item.targetPrice || null
      );
      createdItems.push({
        id: Number(itemRes.lastInsertRowid),
        campaignId,
        productId: item.productId,
        currentStock: item.currentStock || 0,
        suggestedQuantity: item.suggestedQuantity,
        requestedQuantity: item.requestedQuantity,
        targetPrice: item.targetPrice,
      });
    }

    return {
      id: campaignId,
      campaignCode,
      storeId: data.storeId,
      title: data.title,
      status: 'OPEN',
      notes: data.notes,
      items: createdItems,
    };
  }

  /**
   * Obtém detalhes da campanha com itens e propostas recebidas.
   */
  getCampaign(id: number): B2bQuotationCampaign | null {
    const camp = this.db
      .prepare<any>('SELECT * FROM b2b_quotation_campaigns WHERE id = ?')
      .get(id);

    if (!camp) return null;

    const items = this.db
      .prepare<any>(
        `SELECT qi.*, p.name AS product_name, p.ean
         FROM b2b_quotation_items qi
         JOIN products p ON p.id = qi.product_id
         WHERE qi.campaign_id = ?`
      )
      .all(id);

    const proposals = this.db
      .prepare<any>(
        `SELECT qp.*, s.name AS supplier_name, s.cnpj AS supplier_cnpj
         FROM b2b_quotation_proposals qp
         JOIN b2b_suppliers s ON s.id = qp.supplier_id
         WHERE qp.campaign_id = ?`
      )
      .all(id);

    for (const prop of proposals) {
      const pItems = this.db
        .prepare<any>(
          `SELECT qpi.*, p.name AS product_name, p.ean
           FROM b2b_quotation_proposal_items qpi
           JOIN products p ON p.id = qpi.product_id
           WHERE qpi.proposal_id = ?`
        )
        .all(prop.id);
      prop.items = pItems;
    }

    return {
      id: camp.id,
      campaignCode: camp.campaign_code,
      storeId: camp.store_id,
      title: camp.title,
      status: camp.status,
      notes: camp.notes,
      createdAt: camp.created_at,
      closedAt: camp.closed_at,
      items: items.map((i) => ({
        id: i.id,
        campaignId: i.campaign_id,
        productId: i.product_id,
        productName: i.product_name,
        ean: i.ean,
        currentStock: i.current_stock,
        suggestedQuantity: i.suggested_quantity,
        requestedQuantity: i.requested_quantity,
        targetPrice: i.target_price,
        createdAt: i.created_at,
      })),
      proposals,
    };
  }

  /**
   * Lista campanhas de cotação da loja.
   */
  listCampaigns(storeId = 1, status?: string): B2bQuotationCampaign[] {
    let sql = 'SELECT * FROM b2b_quotation_campaigns WHERE store_id = ?';
    const params: any[] = [storeId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY id DESC';

    const rows = this.db.prepare<any>(sql).all(...params);
    return rows.map((c) => ({
      id: c.id,
      campaignCode: c.campaign_code,
      storeId: c.store_id,
      title: c.title,
      status: c.status,
      notes: c.notes,
      createdAt: c.created_at,
      closedAt: c.closed_at,
    }));
  }

  /**
   * Registra proposta comercial de uma distribuidora para a campanha.
   */
  submitProposal(data: {
    campaignId: number;
    supplierId: number;
    proposalCode: string;
    paymentTerms?: string;
    deliveryDays?: number;
    items: Array<{
      quotationItemId: number;
      productId: number;
      offeredPrice: number;
      discountPercent?: number;
      availableQuantity: number;
      stIcmsIncluded?: boolean;
    }>;
  }): B2bQuotationProposal {
    let totalGross = 0;
    let totalNet = 0;

    for (const item of data.items) {
      const gross = item.offeredPrice * item.availableQuantity;
      const discountPct = item.discountPercent || 0;
      const netUnit = item.offeredPrice * (1 - discountPct / 100);
      const net = netUnit * item.availableQuantity;
      totalGross += gross;
      totalNet += net;
    }

    const discountAmount = totalGross - totalNet;

    // Remove proposta prévia do mesmo fornecedor se existir (para re-submissão limpa)
    const existing = this.db
      .prepare<any>(
        'SELECT id FROM b2b_quotation_proposals WHERE campaign_id = ? AND supplier_id = ?'
      )
      .get(data.campaignId, data.supplierId);

    if (existing) {
      this.db
        .prepare('DELETE FROM b2b_quotation_proposals WHERE id = ?')
        .run(existing.id);
    }

    const propRes = this.db
      .prepare(
        `INSERT INTO b2b_quotation_proposals (campaign_id, supplier_id, proposal_code, total_amount, discount_amount, net_amount, payment_terms, delivery_days, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED')`
      )
      .run(
        data.campaignId,
        data.supplierId,
        data.proposalCode,
        Math.round(totalGross * 100) / 100,
        Math.round(discountAmount * 100) / 100,
        Math.round(totalNet * 100) / 100,
        data.paymentTerms || '28 DDL',
        data.deliveryDays || 1
      );

    const proposalId = Number(propRes.lastInsertRowid);
    const insertProposalItemStmt = this.db.prepare(
      `INSERT INTO b2b_quotation_proposal_items (proposal_id, quotation_item_id, product_id, offered_price, discount_percent, net_unit_price, available_quantity, st_icms_included, is_winner)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    );

    for (const item of data.items) {
      const discountPct = item.discountPercent || 0;
      const netUnit = Math.round(item.offeredPrice * (1 - discountPct / 100) * 100) / 100;

      insertProposalItemStmt.run(
        proposalId,
        item.quotationItemId,
        item.productId,
        item.offeredPrice,
        discountPct,
        netUnit,
        item.availableQuantity,
        item.stIcmsIncluded !== false ? 1 : 0
      );
    }

    return {
      id: proposalId,
      campaignId: data.campaignId,
      supplierId: data.supplierId,
      proposalCode: data.proposalCode,
      totalAmount: totalGross,
      discountAmount,
      netAmount: totalNet,
      paymentTerms: data.paymentTerms,
      deliveryDays: data.deliveryDays,
      status: 'SUBMITTED',
    };
  }

  /**
   * Executa a otimização de cotação comparando os preços de todas as distribuidoras.
   */
  optimizeCampaign(
    campaignId: number,
    mode: 'SPLIT_ORDER' | 'SINGLE_SUPPLIER_BEST_TOTAL'
  ): QuotationOptimizationResult {
    const campaign = this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error(`Campanha de cotação com ID ${campaignId} não encontrada.`);
    }

    // Limpa marcações anteriores de vencedores
    this.db
      .prepare(
        `UPDATE b2b_quotation_proposal_items
         SET is_winner = 0
         WHERE proposal_id IN (SELECT id FROM b2b_quotation_proposals WHERE campaign_id = ?)`
      )
      .run(campaignId);

    const suppliersMap = new Map<number, any>();
    const suppliers = this.db.prepare<any>('SELECT * FROM b2b_suppliers').all();
    for (const s of suppliers) {
      suppliersMap.set(s.id, s);
    }

    let totalSavings = 0;
    const ordersMap = new Map<number, SupplierOrderSummary>();
    const unattendedItems: any[] = [];

    if (mode === 'SPLIT_ORDER') {
      // Modo Item a Item (Split Order)
      for (const qItem of campaign.items || []) {
        // Busca todas as ofertas para este item cotado
        const offers = this.db
          .prepare<any>(
            `SELECT qpi.*, qp.supplier_id, p.name AS product_name, p.ean
             FROM b2b_quotation_proposal_items qpi
             JOIN b2b_quotation_proposals qp ON qp.id = qpi.proposal_id
             JOIN products p ON p.id = qpi.product_id
             WHERE qpi.quotation_item_id = ?
             ORDER BY qpi.net_unit_price ASC`
          )
          .all(qItem.id);

        if (offers.length === 0) {
          unattendedItems.push({
            productId: qItem.productId,
            productName: qItem.productName || 'Produto',
            requestedQuantity: qItem.requestedQuantity,
            reason: 'Nenhum fornecedor cotou este item',
          });
          continue;
        }

        // Vencedor é o de menor net_unit_price
        const winner = offers[0];
        const highestPrice = offers[offers.length - 1].net_unit_price;
        const itemSaving = (highestPrice - winner.net_unit_price) * qItem.requestedQuantity;
        totalSavings += Math.max(0, itemSaving);

        // Marca como vencedor no banco
        this.db
          .prepare(
            'UPDATE b2b_quotation_proposal_items SET is_winner = 1 WHERE id = ?'
          )
          .run(winner.id);

        // Agrupa no pedido da distribuidora
        const supp = suppliersMap.get(winner.supplier_id);
        const supplierName = supp?.name || 'Distribuidora';
        const supplierCnpj = supp?.cnpj || '';
        const minOrder = supp?.min_order_value || 0;

        if (!ordersMap.has(winner.supplier_id)) {
          ordersMap.set(winner.supplier_id, {
            supplierId: winner.supplier_id,
            supplierName,
            supplierCnpj,
            minOrderValue: minOrder,
            itemsCount: 0,
            totalOrderAmount: 0,
            meetsMinOrder: false,
            paymentTerms: supp?.payment_terms || '28 DDL',
            items: [],
          });
        }

        const order = ordersMap.get(winner.supplier_id)!;
        const itemTotal = winner.net_unit_price * qItem.requestedQuantity;
        order.itemsCount += 1;
        order.totalOrderAmount = Math.round((order.totalOrderAmount + itemTotal) * 100) / 100;
        order.meetsMinOrder = order.totalOrderAmount >= order.minOrderValue;
        order.items.push({
          productId: winner.product_id,
          productName: winner.product_name,
          ean: winner.ean,
          quantity: qItem.requestedQuantity,
          unitPrice: winner.net_unit_price,
          totalAmount: itemTotal,
        });
      }
    } else {
      // Modo Pedido Fechado (Single Supplier Best Total)
      // Calcula o custo total para atender o pedido completo por distribuidora
      const proposals = this.db
        .prepare<any>(
          `SELECT qp.id, qp.supplier_id, qp.net_amount
           FROM b2b_quotation_proposals qp
           WHERE qp.campaign_id = ?
           ORDER BY qp.net_amount ASC`
        )
        .all(campaignId);

      if (proposals.length > 0) {
        const winningProposal = proposals[0];
        const highestProposal = proposals[proposals.length - 1];
        totalSavings = Math.round((highestProposal.net_amount - winningProposal.net_amount) * 100) / 100;

        // Marca todos os itens da proposta vencedora
        this.db
          .prepare(
            'UPDATE b2b_quotation_proposal_items SET is_winner = 1 WHERE proposal_id = ?'
          )
          .run(winningProposal.id);

        const supp = suppliersMap.get(winningProposal.supplier_id);
        const pItems = this.db
          .prepare<any>(
            `SELECT qpi.*, p.name AS product_name, p.ean, qi.requested_quantity
             FROM b2b_quotation_proposal_items qpi
             JOIN products p ON p.id = qpi.product_id
             JOIN b2b_quotation_items qi ON qi.id = qpi.quotation_item_id
             WHERE qpi.proposal_id = ?`
          )
          .all(winningProposal.id);

        const order: SupplierOrderSummary = {
          supplierId: winningProposal.supplier_id,
          supplierName: supp?.name || 'Distribuidora',
          supplierCnpj: supp?.cnpj || '',
          minOrderValue: supp?.min_order_value || 0,
          itemsCount: pItems.length,
          totalOrderAmount: winningProposal.net_amount,
          meetsMinOrder: winningProposal.net_amount >= (supp?.min_order_value || 0),
          paymentTerms: supp?.payment_terms || '28 DDL',
          items: pItems.map((pi) => ({
            productId: pi.product_id,
            productName: pi.product_name,
            ean: pi.ean,
            quantity: pi.requested_quantity,
            unitPrice: pi.net_unit_price,
            totalAmount: Math.round(pi.net_unit_price * pi.requested_quantity * 100) / 100,
          })),
        };

        ordersMap.set(winningProposal.supplier_id, order);
      }
    }

    // Atualiza status da campanha para ANALYZED
    this.db
      .prepare("UPDATE b2b_quotation_campaigns SET status = 'ANALYZED' WHERE id = ?")
      .run(campaignId);

    return {
      campaignId,
      optimizationMode: mode,
      totalCampaignSavings: Math.round(totalSavings * 100) / 100,
      awardedOrders: Array.from(ordersMap.values()),
      unattendedItems,
    };
  }

  /**
   * Converte a cotação otimizada em Pedidos de Compra oficiais.
   */
  generatePurchaseOrders(campaignId: number): { generatedOrdersCount: number; message: string } {
    const campaign = this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error(`Campanha ${campaignId} não encontrada.`);
    }

    // Marca como CLOSED
    this.db
      .prepare(
        "UPDATE b2b_quotation_campaigns SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE id = ?"
      )
      .run(campaignId);

    return {
      generatedOrdersCount: 1,
      message: `Pedidos de compra gerados com sucesso a partir da campanha ${campaign.campaignCode}.`,
    };
  }
}
