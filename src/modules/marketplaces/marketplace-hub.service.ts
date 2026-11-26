import { Database } from '../../database/connection';
import {
  MarketplaceChannel,
  MarketplaceCatalogMapping,
  MarketplaceOrder,
  MarketplaceOrderItem,
  RegisterChannelInput,
  MapCatalogProductInput,
  IngestOrderInput,
  MarketplaceOrderStatus,
  MarketplaceKpis,
} from './marketplace.types';

export class MarketplaceHubService {
  constructor(private db: Database) {}

  /**
   * Registra ou atualiza canal de marketplace para uma loja.
   */
  registerOrUpdateChannel(input: RegisterChannelInput): MarketplaceChannel {
    const existing = this.db
      .prepare('SELECT * FROM marketplace_channels WHERE store_id = ? AND channel_name = ?')
      .get(input.storeId, input.channelName) as MarketplaceChannel | undefined;

    if (existing) {
      this.db
        .prepare(`
          UPDATE marketplace_channels SET
            merchant_id = COALESCE(?, merchant_id),
            api_key = COALESCE(?, api_key),
            api_secret = COALESCE(?, api_secret),
            webhook_secret = COALESCE(?, webhook_secret),
            commission_rate = COALESCE(?, commission_rate),
            stock_buffer_percent = COALESCE(?, stock_buffer_percent),
            auto_confirm_orders = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(
          input.merchantId ?? null,
          input.apiKey ?? null,
          input.apiSecret ?? null,
          input.webhookSecret ?? null,
          input.commissionRate ?? null,
          input.stockBufferPercent ?? null,
          input.autoConfirmOrders !== undefined ? (input.autoConfirmOrders ? 1 : 0) : existing.auto_confirm_orders,
          existing.id
        );

      return this.getChannelById(existing.id)!;
    }

    const res = this.db
      .prepare(`
        INSERT INTO marketplace_channels (
          store_id, channel_name, merchant_id, api_key, api_secret,
          webhook_secret, commission_rate, stock_buffer_percent, auto_confirm_orders, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `)
      .run(
        input.storeId,
        input.channelName,
        input.merchantId ?? null,
        input.apiKey ?? null,
        input.apiSecret ?? null,
        input.webhookSecret ?? null,
        input.commissionRate ?? 0.0,
        input.stockBufferPercent ?? 10.0,
        input.autoConfirmOrders !== false ? 1 : 0
      );

    return this.getChannelById(Number(res.lastInsertRowid))!;
  }

  listChannels(storeId: number, options?: { showSecrets?: boolean }): MarketplaceChannel[] {
    const list = this.db
      .prepare('SELECT * FROM marketplace_channels WHERE store_id = ? ORDER BY id ASC')
      .all(storeId) as MarketplaceChannel[];
    if (options?.showSecrets) return list;
    return list.map((c) => ({
      ...c,
      api_secret: c.api_secret ? '********' : null,
      webhook_secret: c.webhook_secret ? '********' : null,
    }));
  }

  getChannelById(channelId: number, options?: { showSecrets?: boolean }): MarketplaceChannel | null {
    const channel = this.db
      .prepare('SELECT * FROM marketplace_channels WHERE id = ?')
      .get(channelId) as MarketplaceChannel | undefined;
    if (!channel || options?.showSecrets) return channel || null;
    return {
      ...channel,
      api_secret: channel.api_secret ? '********' : null,
      webhook_secret: channel.webhook_secret ? '********' : null,
    };
  }

  toggleChannelStatus(channelId: number, isActive: boolean): MarketplaceChannel {
    this.db
      .prepare('UPDATE marketplace_channels SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(isActive ? 1 : 0, channelId);

    const channel = this.getChannelById(channelId);
    if (!channel) throw new Error('Canal de marketplace não encontrado.');
    return channel;
  }

  /**
   * Mapeamento De-Para Produto ERP <-> SKU Marketplace
   */
  mapCatalogProduct(input: MapCatalogProductInput): MarketplaceCatalogMapping {
    const existing = this.db
      .prepare('SELECT * FROM marketplace_catalog_mappings WHERE channel_id = ? AND product_id = ?')
      .get(input.channelId, input.productId) as MarketplaceCatalogMapping | undefined;

    if (existing) {
      this.db
        .prepare(`
          UPDATE marketplace_catalog_mappings SET
            external_sku = ?,
            markup_percent = ?,
            custom_price = ?,
            is_synced = 1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(input.externalSku, input.markupPercent ?? 0.0, input.customPrice ?? null, existing.id);

      return this.getCatalogMappingById(existing.id)!;
    }

    const res = this.db
      .prepare(`
        INSERT INTO marketplace_catalog_mappings (
          channel_id, product_id, external_sku, markup_percent, custom_price, is_synced
        ) VALUES (?, ?, ?, ?, ?, 1)
      `)
      .run(
        input.channelId,
        input.productId,
        input.externalSku,
        input.markupPercent ?? 0.0,
        input.customPrice ?? null
      );

    return this.getCatalogMappingById(Number(res.lastInsertRowid))!;
  }

  getCatalogMappingById(id: number): MarketplaceCatalogMapping | null {
    const row = this.db
      .prepare(`
        SELECT 
          m.*,
          p.name AS product_name,
          p.ean,
          p.price AS current_price,
          CASE 
            WHEN m.custom_price IS NOT NULL AND m.custom_price > 0 THEN m.custom_price
            ELSE ROUND(p.price * (1 + (m.markup_percent / 100.0)), 2)
          END AS calculated_price
        FROM marketplace_catalog_mappings m
        JOIN products p ON p.id = m.product_id
        WHERE m.id = ?
      `)
      .get(id) as MarketplaceCatalogMapping | undefined;

    return row || null;
  }

  listCatalogMappings(channelId: number): MarketplaceCatalogMapping[] {
    return this.db
      .prepare(`
        SELECT 
          m.*,
          p.name AS product_name,
          p.ean,
          p.price AS current_price,
          CASE 
            WHEN m.custom_price IS NOT NULL AND m.custom_price > 0 THEN m.custom_price
            ELSE ROUND(p.price * (1 + (m.markup_percent / 100.0)), 2)
          END AS calculated_price,
          COALESCE((
            SELECT SUM(b.quantity - b.reserved_quantity)
            FROM batches b
            WHERE b.product_id = m.product_id
              AND date(b.expiration_date) >= date('now')
          ), 0) AS available_stock
        FROM marketplace_catalog_mappings m
        JOIN products p ON p.id = m.product_id
        WHERE m.channel_id = ?
        ORDER BY m.id DESC
      `)
      .all(channelId) as MarketplaceCatalogMapping[];
  }

  /**
   * Sincronização de Estoque com Buffer de Segurança
   */
  syncStock(channelId: number): {
    syncedCount: number;
    items: { productId: number; externalSku: string; availableStock: number; bufferDeducted: number }[];
  } {
    const channel = this.getChannelById(channelId);
    if (!channel) throw new Error('Canal não encontrado');

    const mappings = this.listCatalogMappings(channelId);
    const results: { productId: number; externalSku: string; availableStock: number; bufferDeducted: number }[] = [];

    const bufferMultiplier = Math.max(0, 1 - channel.stock_buffer_percent / 100.0);

    const updateStmt = this.db.prepare(`
      UPDATE marketplace_catalog_mappings
      SET last_stock_synced = ?, last_sync_at = CURRENT_TIMESTAMP, is_synced = 1
      WHERE id = ?
    `);

    for (const mapping of mappings) {
      const rawStock = mapping.available_stock || 0;
      const effectiveStock = Math.max(0, Math.floor(rawStock * bufferMultiplier));
      const bufferDeducted = rawStock - effectiveStock;

      updateStmt.run(effectiveStock, mapping.id);

      results.push({
        productId: mapping.product_id,
        externalSku: mapping.external_sku,
        availableStock: effectiveStock,
        bufferDeducted,
      });
    }

    return {
      syncedCount: results.length,
      items: results,
    };
  }

  /**
   * Ingestão de Pedido Recebido via Webhook / Marketplace Externo
   */
  ingestOrder(input: IngestOrderInput): MarketplaceOrder {
    const channel = this.getChannelById(input.channelId);
    if (!channel) throw new Error('Canal de marketplace não encontrado.');

    // Verificar idempotência de pedido já existente
    const existing = this.db
      .prepare('SELECT * FROM marketplace_orders WHERE channel_id = ? AND external_order_id = ?')
      .get(input.channelId, input.externalOrderId) as MarketplaceOrder | undefined;

    if (existing) {
      return this.getOrderById(existing.id)!;
    }

    const initialStatus: MarketplaceOrderStatus = channel.auto_confirm_orders ? 'CONFIRMED' : 'PENDING_CONFIRMATION';
    const confirmedAt = channel.auto_confirm_orders ? new Date().toISOString() : null;

    const orderRes = this.db
      .prepare(`
        INSERT INTO marketplace_orders (
          store_id, channel_id, external_order_id, display_order_id,
          customer_name, customer_document, customer_phone, delivery_address,
          status, subtotal, delivery_fee, platform_fee, total_amount,
          placed_at, confirmed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        input.storeId,
        input.channelId,
        input.externalOrderId,
        input.displayOrderId ?? `#${input.externalOrderId.slice(-4)}`,
        input.customerName,
        input.customerDocument ?? null,
        input.customerPhone ?? null,
        input.deliveryAddress,
        initialStatus,
        input.subtotal,
        input.deliveryFee ?? 0.0,
        input.platformFee ?? 0.0,
        input.totalAmount,
        input.placedAt ?? new Date().toISOString(),
        confirmedAt
      );

    const orderId = Number(orderRes.lastInsertRowid);

    // Inserir itens
    const itemStmt = this.db.prepare(`
      INSERT INTO marketplace_order_items (
        order_id, product_id, external_sku, product_name, quantity, unit_price, total_price, batch_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of input.items) {
      itemStmt.run(
        orderId,
        item.productId,
        item.externalSku ?? null,
        item.productName,
        item.quantity,
        item.unitPrice,
        item.totalPrice,
        item.batchNumber ?? null
      );

      // Se auto-confirmado, reserva estoque do lote
      if (initialStatus === 'CONFIRMED') {
        this.reserveItemStock(item.productId, item.quantity);
      }
    }

    return this.getOrderById(orderId)!;
  }

  private reserveItemStock(productId: number, quantity: number): void {
    // Busca lote mais antigo com validade vigente e quantidade disponível
    const batch = this.db
      .prepare(`
        SELECT id, quantity, reserved_quantity
        FROM batches
        WHERE product_id = ? AND date(expiration_date) >= date('now')
          AND (quantity - reserved_quantity) >= ?
        ORDER BY date(expiration_date) ASC
        LIMIT 1
      `)
      .get(productId, quantity) as { id: number; quantity: number; reserved_quantity: number } | undefined;

    if (batch) {
      this.db
        .prepare('UPDATE batches SET reserved_quantity = reserved_quantity + ? WHERE id = ?')
        .run(quantity, batch.id);
    }
  }

  private releaseItemStock(productId: number, quantity: number): void {
    const batch = this.db
      .prepare(`
        SELECT id, reserved_quantity
        FROM batches
        WHERE product_id = ? AND reserved_quantity >= ?
        LIMIT 1
      `)
      .get(productId, quantity) as { id: number; reserved_quantity: number } | undefined;

    if (batch) {
      this.db
        .prepare('UPDATE batches SET reserved_quantity = reserved_quantity - ? WHERE id = ?')
        .run(quantity, batch.id);
    }
  }

  private deductItemStock(productId: number, quantity: number): void {
    const batch = this.db
      .prepare(`
        SELECT id, quantity, reserved_quantity
        FROM batches
        WHERE product_id = ? AND quantity >= ?
        ORDER BY date(expiration_date) ASC
        LIMIT 1
      `)
      .get(productId, quantity) as { id: number; quantity: number; reserved_quantity: number } | undefined;

    if (batch) {
      const newReserved = Math.max(0, batch.reserved_quantity - quantity);
      this.db
        .prepare('UPDATE batches SET quantity = quantity - ?, reserved_quantity = ? WHERE id = ?')
        .run(quantity, newReserved, batch.id);
    }
  }

  /**
   * Atualização de Status da Máquina de Estados do Pedido
   */
  updateOrderStatus(
    orderId: number,
    newStatus: MarketplaceOrderStatus,
    cancellationReason?: string
  ): MarketplaceOrder {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error('Pedido de marketplace não encontrado.');

    const currentStatus = order.status;

    // Regras de transição válidas
    const validTransitions: Record<MarketplaceOrderStatus, MarketplaceOrderStatus[]> = {
      PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PREPARING', 'READY_FOR_PICKUP', 'DISPATCHED', 'CANCELLED'],
      PREPARING: ['READY_FOR_PICKUP', 'DISPATCHED', 'CANCELLED'],
      READY_FOR_PICKUP: ['DISPATCHED', 'CANCELLED'],
      DISPATCHED: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`Transição de status inválida de ${currentStatus} para ${newStatus}.`);
    }

    const now = new Date().toISOString();
    let confirmedAt = order.confirmed_at;
    let dispatchedAt = order.dispatched_at;
    let deliveredAt = order.delivered_at;

    if (newStatus === 'CONFIRMED' && !confirmedAt) {
      confirmedAt = now;
      if (order.items) {
        for (const item of order.items) {
          this.reserveItemStock(item.product_id, item.quantity);
        }
      }
    } else if (newStatus === 'DISPATCHED') {
      dispatchedAt = now;
      if (order.items) {
        for (const item of order.items) {
          this.deductItemStock(item.product_id, item.quantity);
        }
      }
    } else if (newStatus === 'DELIVERED') {
      deliveredAt = now;
    } else if (newStatus === 'CANCELLED') {
      // Se estava confirmado/preparando, devolve reserva
      if (['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(currentStatus) && order.items) {
        for (const item of order.items) {
          this.releaseItemStock(item.product_id, item.quantity);
        }
      }
    }

    this.db
      .prepare(`
        UPDATE marketplace_orders SET
          status = ?,
          confirmed_at = ?,
          dispatched_at = ?,
          delivered_at = ?,
          cancellation_reason = COALESCE(?, cancellation_reason),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(newStatus, confirmedAt, dispatchedAt, deliveredAt, cancellationReason ?? null, orderId);

    return this.getOrderById(orderId)!;
  }

  getOrderById(orderId: number): MarketplaceOrder | null {
    const order = this.db
      .prepare(`
        SELECT 
          o.*,
          c.channel_name
        FROM marketplace_orders o
        JOIN marketplace_channels c ON c.id = o.channel_id
        WHERE o.id = ?
      `)
      .get(orderId) as MarketplaceOrder | undefined;

    if (!order) return null;

    const items = this.db
      .prepare('SELECT * FROM marketplace_order_items WHERE order_id = ?')
      .all(orderId) as MarketplaceOrderItem[];

    return {
      ...order,
      items,
    };
  }

  listOrders(storeId: number, status?: MarketplaceOrderStatus, channelId?: number): MarketplaceOrder[] {
    let sql = `
      SELECT 
        o.*,
        c.channel_name
      FROM marketplace_orders o
      JOIN marketplace_channels c ON c.id = o.channel_id
      WHERE o.store_id = ?
    `;
    const params: any[] = [storeId];

    if (status) {
      sql += ' AND o.status = ?';
      params.push(status);
    }
    if (channelId) {
      sql += ' AND o.channel_id = ?';
      params.push(channelId);
    }

    sql += ' ORDER BY o.id DESC';

    const orders = this.db.prepare(sql).all(...params) as MarketplaceOrder[];

    // Popular itens resumidos
    for (const ord of orders) {
      ord.items = this.db
        .prepare('SELECT * FROM marketplace_order_items WHERE order_id = ?')
        .all(ord.id) as MarketplaceOrderItem[];
    }

    return orders;
  }

  getKpis(storeId: number): MarketplaceKpis {
    const totalOrders = (this.db
      .prepare('SELECT COUNT(*) as count FROM marketplace_orders WHERE store_id = ?')
      .get(storeId) as any)?.count || 0;

    const pendingOrders = (this.db
      .prepare("SELECT COUNT(*) as count FROM marketplace_orders WHERE store_id = ? AND status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING')")
      .get(storeId) as any)?.count || 0;

    const dispatchedOrders = (this.db
      .prepare("SELECT COUNT(*) as count FROM marketplace_orders WHERE store_id = ? AND status IN ('DISPATCHED', 'DELIVERED')")
      .get(storeId) as any)?.count || 0;

    const totalRevenue = (this.db
      .prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM marketplace_orders WHERE store_id = ? AND status != 'CANCELLED'")
      .get(storeId) as any)?.total || 0;

    const activeChannelsCount = (this.db
      .prepare('SELECT COUNT(*) as count FROM marketplace_channels WHERE store_id = ? AND is_active = 1')
      .get(storeId) as any)?.count || 0;

    const channelRows = this.db
      .prepare(`
        SELECT 
          c.channel_name as channel,
          COUNT(o.id) as count,
          COALESCE(SUM(o.total_amount), 0) as total
        FROM marketplace_channels c
        LEFT JOIN marketplace_orders o ON o.channel_id = c.id AND o.status != 'CANCELLED'
        WHERE c.store_id = ?
        GROUP BY c.channel_name
      `)
      .all(storeId) as { channel: any; count: number; total: number }[];

    return {
      totalOrders,
      pendingOrders,
      dispatchedOrders,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      activeChannelsCount,
      ordersByChannel: channelRows,
    };
  }
}
