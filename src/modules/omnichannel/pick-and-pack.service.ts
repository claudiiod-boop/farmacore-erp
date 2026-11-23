import { Database } from '../../database/connection';
import { OpenWaGatewayService } from './openwa-gateway.service';
import {
  OmnichannelOrder,
  OmnichannelOrderItem,
  OmnichannelOrderStatus,
} from './omnichannel.types';

export class PickAndPackService {
  constructor(
    private db: Database,
    private gateway?: OpenWaGatewayService
  ) {}

  /**
   * Cria um pedido no Hub Omnichannel
   */
  public createOrder(
    orderData: {
      store_id?: number;
      channel_id: number;
      conversation_id?: number;
      customer_name: string;
      customer_phone: string;
      delivery_type?: 'DELIVERY' | 'BALCAO_RETIRADA';
      delivery_address?: string;
      notes?: string;
      payment_method?: 'PIX_ENTREGA' | 'CARTAO_ENTREGA' | 'DINHEIRO_ENTREGA' | 'PAGO_ONLINE';
      delivery_fee?: number;
      items: Array<{
        product_id: number;
        ean: string;
        product_name: string;
        quantity_ordered: number;
        unit_price: number;
        batch_number?: string;
      }>;
    }
  ): OmnichannelOrder {
    if (!orderData.items || orderData.items.length === 0) {
      throw new Error('O pedido deve conter ao menos um item.');
    }

    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    const countRow = this.db
      .prepare<{ total: number }>('SELECT COUNT(*) as total FROM omnichannel_orders')
      .get() || { total: 0 };
    const seq = String(countRow.total + 1).padStart(4, '0');
    const orderCode = `WPP-${yearMonth}-${seq}`;

    let subtotal = 0;
    for (const item of orderData.items) {
      subtotal += item.quantity_ordered * item.unit_price;
    }
    const deliveryFee = orderData.delivery_fee || 0;
    const totalAmount = subtotal + deliveryFee;

    const orderRes = this.db
      .prepare(`
        INSERT INTO omnichannel_orders (
          store_id, channel_id, conversation_id, channel_order_code, customer_name, customer_phone,
          delivery_type, delivery_address, notes, status, subtotal, delivery_fee, total_amount, payment_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?)
      `)
      .run(
        orderData.store_id || 1,
        orderData.channel_id,
        orderData.conversation_id || null,
        orderCode,
        orderData.customer_name,
        orderData.customer_phone,
        orderData.delivery_type || 'DELIVERY',
        orderData.delivery_address || null,
        orderData.notes || null,
        subtotal,
        deliveryFee,
        totalAmount,
        orderData.payment_method || 'PIX_ENTREGA'
      );

    const orderId = Number(orderRes.lastInsertRowid);

    const itemStmt = this.db.prepare(`
      INSERT INTO omnichannel_order_items (
        order_id, product_id, ean, product_name, quantity_ordered, quantity_picked, unit_price, total_price, batch_number, status
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 'PENDING')
    `);

    for (const item of orderData.items) {
      itemStmt.run(
        orderId,
        item.product_id,
        item.ean,
        item.product_name,
        item.quantity_ordered,
        item.unit_price,
        item.quantity_ordered * item.unit_price,
        item.batch_number || null
      );
    }

    // Auditoria
    this.addAudit(orderId, 'STATUS_CHANGE', 'Pedido criado via canal omnichannel', 'SISTEMA');

    return this.getOrderById(orderId)!;
  }

  /**
   * Obtém pedido com seus itens e progresso de separação
   */
  public getOrderById(orderId: number): OmnichannelOrder | undefined {
    const order = this.db
      .prepare<OmnichannelOrder>('SELECT * FROM omnichannel_orders WHERE id = ?')
      .get(orderId);

    if (!order) return undefined;

    const items = this.db
      .prepare<OmnichannelOrderItem>(
        'SELECT * FROM omnichannel_order_items WHERE order_id = ? ORDER BY id ASC'
      )
      .all(orderId);

    return { ...order, items };
  }

  /**
   * Lista pedidos por status ou loja
   */
  public listOrders(storeId: number = 1, status?: OmnichannelOrderStatus): OmnichannelOrder[] {
    let sql = 'SELECT * FROM omnichannel_orders WHERE store_id = ?';
    const params: any[] = [storeId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY id DESC';

    const orders = this.db.prepare<OmnichannelOrder>(sql).all(...params);

    return orders.map((ord) => {
      const items = this.db
        .prepare<OmnichannelOrderItem>(
          'SELECT * FROM omnichannel_order_items WHERE order_id = ? ORDER BY id ASC'
        )
        .all(ord.id!);
      return { ...ord, items };
    });
  }

  /**
   * Inicia a esteira de separação (Pick-and-Pack)
   */
  public startPicking(
    orderId: number,
    operatorId: number,
    operatorName: string
  ): OmnichannelOrder {
    const order = this.getOrderById(orderId);
    if (!order) {
      throw new Error(`Pedido ${orderId} não encontrado.`);
    }

    if (order.status !== 'NEW') {
      throw new Error(`Pedido não pode ser iniciado a partir do status ${order.status}.`);
    }

    this.db
      .prepare(`
        UPDATE omnichannel_orders
        SET status = 'IN_SEPARATION', picker_operator_id = ?, separated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(operatorId, orderId);

    this.addAudit(
      orderId,
      'STATUS_CHANGE',
      `Separação iniciada pelo operador ${operatorName}`,
      operatorName
    );

    return this.getOrderById(orderId)!;
  }

  /**
   * Bipagem de conferência cega (validação de código de barras / EAN)
   */
  public scanBarcode(
    orderId: number,
    scannedBarcode: string,
    operatorName: string
  ): { success: boolean; item?: OmnichannelOrderItem; allItemsPicked: boolean; message: string } {
    const order = this.getOrderById(orderId);
    if (!order) {
      throw new Error(`Pedido ${orderId} não encontrado.`);
    }

    if (order.status !== 'IN_SEPARATION') {
      throw new Error(
        `Pedido não está em separação. Status atual: ${order.status}`
      );
    }

    const cleanBarcode = scannedBarcode.trim();

    // Localiza item no pedido com o código de barras
    const candidateItem = order.items?.find(
      (item) => item.ean === cleanBarcode && item.quantity_picked < item.quantity_ordered
    );

    if (!candidateItem) {
      this.addAudit(
        orderId,
        'WRONG_ITEM_ATTEMPT',
        `Tentativa de bipagem com código incorreto: ${cleanBarcode}`,
        operatorName
      );
      throw new Error(
        `Código ${cleanBarcode} não pertence a este pedido ou todas as unidades deste item já foram conferidas!`
      );
    }

    // Incrementa quantidade conferida
    const newPickedQty = candidateItem.quantity_picked + 1;
    const isItemComplete = newPickedQty >= candidateItem.quantity_ordered;

    this.db
      .prepare(`
        UPDATE omnichannel_order_items
        SET quantity_picked = ?, status = ?
        WHERE id = ?
      `)
      .run(newPickedQty, isItemComplete ? 'PICKED' : 'PENDING', candidateItem.id!);

    this.addAudit(
      orderId,
      'ITEM_SCANNED',
      `Item ${candidateItem.product_name} (${cleanBarcode}) conferido [${newPickedQty}/${candidateItem.quantity_ordered}]`,
      operatorName
    );

    // Recarrega itens para checar se o pedido todo está concluído
    const updatedOrder = this.getOrderById(orderId)!;
    const allPicked = updatedOrder.items?.every((i) => i.status === 'PICKED') || false;

    if (allPicked) {
      this.db
        .prepare(`
          UPDATE omnichannel_orders
          SET status = 'CHECKED', checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(orderId);

      this.addAudit(
        orderId,
        'STATUS_CHANGE',
        `Conferência 100% finalizada com sucesso. Pedido pronto para expedição.`,
        operatorName
      );
    }

    const updatedItem = updatedOrder.items?.find((i) => i.id === candidateItem.id);

    return {
      success: true,
      item: updatedItem,
      allItemsPicked: allPicked,
      message: allPicked
        ? 'Todos os itens conferidos com 100% de precisão! Pedido pronto para despacho.'
        : `Item conferido (${newPickedQty}/${candidateItem.quantity_ordered})`,
    };
  }

  /**
   * Despacha o pedido e notifica o cliente via WhatsApp
   */
  public async dispatchOrder(
    orderId: number,
    operatorName: string
  ): Promise<OmnichannelOrder> {
    const order = this.getOrderById(orderId);
    if (!order) {
      throw new Error(`Pedido ${orderId} não encontrado.`);
    }

    if (order.status !== 'CHECKED') {
      throw new Error(
        `O pedido só pode ser despachado após 100% de conferência dos itens (status CHECKED). Status atual: ${order.status}`
      );
    }

    this.db
      .prepare(`
        UPDATE omnichannel_orders
        SET status = 'DISPATCHED', dispatched_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(orderId);

    this.addAudit(
      orderId,
      'DISPATCHED',
      `Pedido despachado por ${operatorName}`,
      operatorName
    );

    // Dispara notificação no WhatsApp se gateway estiver disponível
    if (this.gateway && order.channel_id && order.customer_phone) {
      const msg = `🎉 *Seu Pedido FarmaCore foi Despachado!* 🛵\n\n` +
                  `Olá, *${order.customer_name}*! Todos os itens do seu pedido *${order.channel_order_code}* foram conferidos e seu pacote já saiu para entrega.\n\n` +
                  `Total: R$ ${Number(order.total_amount).toFixed(2)}\n` +
                  `Forma de Pagamento: ${order.payment_method}\n\n` +
                  `Agradecemos a confiança! 💊`;
      try {
        await this.gateway.sendTextMessage(order.channel_id, order.customer_phone, msg);
      } catch (err) {
        // Loga erro mas não trava o despacho
      }
    }

    return this.getOrderById(orderId)!;
  }

  private addAudit(
    orderId: number,
    eventType: 'STATUS_CHANGE' | 'ITEM_SCANNED' | 'WRONG_ITEM_ATTEMPT' | 'DISPATCHED',
    description: string,
    operatorName: string
  ) {
    this.db
      .prepare(`
        INSERT INTO omnichannel_order_audits (order_id, event_type, description, operator_name)
        VALUES (?, ?, ?, ?)
      `)
      .run(orderId, eventType, description, operatorName);
  }
}
