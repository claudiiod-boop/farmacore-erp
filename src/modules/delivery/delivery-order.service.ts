import { getDatabase, Database } from '../../database/connection';
import type {
  DeliveryOrder,
  DeliveryOrderItem,
  DeliveryOrderStatus,
  DeliveryPaymentMethod,
  CreateDeliveryOrderInput,
  UpdateOrderStatusInput,
  DeliveryOrderFilters,
  DeliveryZone,
} from './types';

export class DeliveryError extends Error {
  constructor(public code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'DeliveryError';
  }
}

const VALID_TRANSITIONS: Record<DeliveryOrderStatus, DeliveryOrderStatus[]> = {
  RECEIVED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED', 'RETURNED', 'CANCELLED'],
  RETURNED: ['READY_FOR_PICKUP', 'DISPATCHED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

interface OrderDbRow {
  id: number;
  order_number: string;
  store_id: number;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string;
  customer_cpf: string | null;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string | null;
  reference_point: string | null;
  subtotal_amount: number;
  delivery_fee: number;
  discount_amount: number;
  total_amount: number;
  payment_method: DeliveryPaymentMethod;
  change_for: number | null;
  status: DeliveryOrderStatus;
  courier_id: number | null;
  dispatch_id: number | null;
  pre_sale_id: number | null;
  sale_id: number | null;
  cancellation_reason: string | null;
  notes: string | null;
  received_at: string;
  dispatched_at: string | null;
  delivered_at: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemDbRow {
  id: number;
  delivery_order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  batch_id: number | null;
  batch_number: string | null;
  created_at: string;
}

function mapItemRow(row: ItemDbRow): DeliveryOrderItem {
  return {
    id: Number(row.id),
    deliveryOrderId: Number(row.delivery_order_id),
    productId: Number(row.product_id),
    productName: row.product_name,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    totalPrice: Number(row.total_price),
    batchId: row.batch_id != null ? Number(row.batch_id) : null,
    batchNumber: row.batch_number,
    createdAt: row.created_at,

    // DB compatibility aliases
    delivery_order_id: Number(row.delivery_order_id),
    product_id: Number(row.product_id),
    product_name: row.product_name,
    unit_price: Number(row.unit_price),
    total_price: Number(row.total_price),
    batch_id: row.batch_id != null ? Number(row.batch_id) : null,
    batch_number: row.batch_number,
    created_at: row.created_at,
  };
}

function mapOrderRow(row: OrderDbRow, items: DeliveryOrderItem[] = []): DeliveryOrder {
  return {
    id: Number(row.id),
    orderNumber: row.order_number,
    storeId: Number(row.store_id),
    customerId: row.customer_id != null ? Number(row.customer_id) : null,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerCpf: row.customer_cpf,
    street: row.street,
    number: row.number,
    complement: row.complement,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    referencePoint: row.reference_point,
    subtotalAmount: Number(row.subtotal_amount),
    deliveryFee: Number(row.delivery_fee),
    discountAmount: Number(row.discount_amount),
    totalAmount: Number(row.total_amount),
    paymentMethod: row.payment_method,
    changeFor: row.change_for != null ? Number(row.change_for) : null,
    status: row.status,
    courierId: row.courier_id != null ? Number(row.courier_id) : null,
    dispatchId: row.dispatch_id != null ? Number(row.dispatch_id) : null,
    preSaleId: row.pre_sale_id != null ? Number(row.pre_sale_id) : null,
    saleId: row.sale_id != null ? Number(row.sale_id) : null,
    cancellationReason: row.cancellation_reason,
    notes: row.notes,
    receivedAt: row.received_at,
    dispatchedAt: row.dispatched_at,
    deliveredAt: row.delivered_at,
    returnedAt: row.returned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,

    // DB compatibility aliases
    order_number: row.order_number,
    store_id: Number(row.store_id),
    customer_id: row.customer_id != null ? Number(row.customer_id) : null,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_cpf: row.customer_cpf,
    zip_code: row.zip_code,
    reference_point: row.reference_point,
    subtotal_amount: Number(row.subtotal_amount),
    delivery_fee: Number(row.delivery_fee),
    discount_amount: Number(row.discount_amount),
    total_amount: Number(row.total_amount),
    payment_method: row.payment_method,
    change_for: row.change_for != null ? Number(row.change_for) : null,
    courier_id: row.courier_id != null ? Number(row.courier_id) : null,
    dispatch_id: row.dispatch_id != null ? Number(row.dispatch_id) : null,
    pre_sale_id: row.pre_sale_id != null ? Number(row.pre_sale_id) : null,
    sale_id: row.sale_id != null ? Number(row.sale_id) : null,
    cancellation_reason: row.cancellation_reason,
    received_at: row.received_at,
    dispatched_at: row.dispatched_at,
    delivered_at: row.delivered_at,
    returned_at: row.returned_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class DeliveryOrderService {
  constructor(private db: Database = getDatabase()) {}

  /**
   * Gera numeração sequencial única no formato DEL-YYYYMM-XXXX
   */
  private generateOrderNumber(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `DEL-${yearMonth}-`;

    const last = this.db
      .prepare(
        'SELECT order_number FROM delivery_orders WHERE order_number LIKE ? ORDER BY order_number DESC LIMIT 1'
      )
      .get(`${prefix}%`) as { order_number: string } | undefined;

    let seq = 1;
    if (last?.order_number) {
      const parts = last.order_number.split('-');
      if (parts.length >= 3) {
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
          seq = lastSeq + 1;
        }
      }
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Localiza a zona de entrega ativa para o bairro/cidade e loja
   */
  findDeliveryZone(storeId: number, neighborhood: string, city: string): DeliveryZone | null {
    if (!neighborhood || !city) return null;

    const row = this.db
      .prepare(
        `SELECT * FROM delivery_zones
         WHERE LOWER(TRIM(neighborhood)) = LOWER(TRIM(?))
           AND LOWER(TRIM(city)) = LOWER(TRIM(?))
           AND is_active = 1
           AND (store_id = ? OR store_id IS NULL)
         ORDER BY store_id DESC
         LIMIT 1`
      )
      .get(neighborhood, city, storeId) as any;

    if (!row) return null;

    return {
      id: Number(row.id),
      storeId: row.store_id != null ? Number(row.store_id) : null,
      name: row.name,
      neighborhood: row.neighborhood,
      city: row.city,
      state: row.state,
      deliveryFee: Number(row.delivery_fee),
      estimatedMinutes: Number(row.estimated_minutes),
      freeShippingThreshold:
        row.free_shipping_threshold != null ? Number(row.free_shipping_threshold) : null,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,

      // snake_case aliases
      store_id: row.store_id != null ? Number(row.store_id) : null,
      delivery_fee: Number(row.delivery_fee),
      estimated_minutes: Number(row.estimated_minutes),
      free_shipping_threshold:
        row.free_shipping_threshold != null ? Number(row.free_shipping_threshold) : null,
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Calcula taxa de entrega com base na zona e faixa de frete grátis
   */
  calculateDeliveryFee(
    storeId: number,
    neighborhood: string,
    city: string,
    subtotal: number
  ): number {
    const zone = this.findDeliveryZone(storeId, neighborhood, city);
    if (!zone) return 0.0;

    if (zone.freeShippingThreshold != null && subtotal >= zone.freeShippingThreshold) {
      return 0.0;
    }
    return zone.deliveryFee;
  }

  /**
   * Cria novo pedido de tele-entrega atomicamente com múltiplos itens
   */
  createDeliveryOrder(input: CreateDeliveryOrderInput): DeliveryOrder {
    const storeId = input.storeId ?? input.store_id;
    if (!storeId) {
      throw new DeliveryError('STORE_NOT_FOUND', 'ID da loja não informado');
    }

    // 1. Validação de loja ativa
    const store = this.db
      .prepare('SELECT id, is_active FROM stores WHERE id = ?')
      .get(storeId) as { id: number; is_active: number } | undefined;

    if (!store) {
      throw new DeliveryError('STORE_NOT_FOUND', `Loja #${storeId} não encontrada`);
    }
    if (!store.is_active) {
      throw new DeliveryError('STORE_INACTIVE', `Loja #${storeId} está inativa`);
    }

    // 2. Validação de itens
    if (!input.items || input.items.length === 0) {
      throw new DeliveryError('ITEMS_REQUIRED', 'O pedido deve conter pelo menos um item');
    }

    // 3. Cálculo de subtotal
    const subtotalAmount =
      input.subtotalAmount ??
      input.subtotal_amount ??
      input.items.reduce((sum, item) => {
        const qty = item.quantity ?? 1;
        const unitPrice = item.unitPrice ?? item.unit_price ?? 0;
        const totalPrice = item.totalPrice ?? item.total_price ?? qty * unitPrice;
        return sum + totalPrice;
      }, 0);

    // 4. Cálculo de taxa de entrega com verificação de frete grátis
    let deliveryFee = input.deliveryFee ?? input.delivery_fee;
    const zone = this.findDeliveryZone(storeId, input.neighborhood, input.city);
    if (zone) {
      if (zone.freeShippingThreshold != null && subtotalAmount >= zone.freeShippingThreshold) {
        deliveryFee = 0.0;
      } else if (deliveryFee === undefined) {
        deliveryFee = zone.deliveryFee;
      }
    } else {
      deliveryFee = deliveryFee ?? 0.0;
    }

    // 5. Totalizador
    const discountAmount = input.discountAmount ?? input.discount_amount ?? 0.0;
    const totalAmount =
      input.totalAmount ??
      input.total_amount ??
      Math.max(0, subtotalAmount + deliveryFee - discountAmount);

    // 6. Validação de pagamento e troco em dinheiro
    const paymentMethod = input.paymentMethod ?? input.payment_method;
    const changeFor = input.changeFor ?? input.change_for;

    if (paymentMethod === 'DINHEIRO') {
      if (changeFor !== undefined && changeFor !== null && changeFor < totalAmount) {
        throw new DeliveryError(
          'INVALID_CHANGE_AMOUNT',
          `Valor para troco (R$ ${changeFor.toFixed(2)}) não pode ser inferior ao total do pedido (R$ ${totalAmount.toFixed(2)})`
        );
      }
    }

    // 7. Numeração sequencial
    const orderNumber = this.generateOrderNumber();

    // 8. Inserção atômica
    let createdOrderId = 0;

    const insertOrderStmt = this.db.prepare(`
      INSERT INTO delivery_orders (
        order_number, store_id, customer_id, customer_name, customer_phone, customer_cpf,
        street, number, complement, neighborhood, city, state, zip_code, reference_point,
        subtotal_amount, delivery_fee, discount_amount, total_amount, payment_method,
        change_for, status, courier_id, pre_sale_id, sale_id, notes, received_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, 'RECEIVED', ?, ?, ?, ?, CURRENT_TIMESTAMP
      )
    `);

    const insertItemStmt = this.db.prepare(`
      INSERT INTO delivery_order_items (
        delivery_order_id, product_id, product_name, quantity, unit_price, total_price, batch_id, batch_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      const orderResult = insertOrderStmt.run(
        orderNumber,
        storeId,
        input.customerId ?? input.customer_id ?? null,
        input.customerName ?? input.customer_name,
        input.customerPhone ?? input.customer_phone,
        input.customerCpf ?? input.customer_cpf ?? null,
        input.street,
        input.number,
        input.complement ?? null,
        input.neighborhood,
        input.city,
        input.state ?? 'SP',
        input.zipCode ?? input.zip_code ?? null,
        input.referencePoint ?? input.reference_point ?? null,
        subtotalAmount,
        deliveryFee,
        discountAmount,
        totalAmount,
        paymentMethod,
        changeFor ?? null,
        input.courierId ?? input.courier_id ?? null,
        input.preSaleId ?? input.pre_sale_id ?? null,
        input.saleId ?? input.sale_id ?? null,
        input.notes ?? null
      );

      createdOrderId = Number(orderResult.lastInsertRowid);

      for (const item of input.items) {
        const qty = item.quantity;
        const unitPrice = item.unitPrice ?? item.unit_price ?? 0;
        const totalPrice = item.totalPrice ?? item.total_price ?? qty * unitPrice;
        const productId = item.productId ?? item.product_id;
        const productName = item.productName ?? item.product_name ?? `Produto #${productId}`;
        const batchId = item.batchId ?? item.batch_id ?? null;
        const batchNumber = item.batchNumber ?? item.batch_number ?? null;

        insertItemStmt.run(
          createdOrderId,
          productId,
          productName,
          qty,
          unitPrice,
          totalPrice,
          batchId,
          batchNumber
        );
      }
    });

    transaction();

    const createdOrder = this.getDeliveryOrderById(createdOrderId);
    if (!createdOrder) {
      throw new DeliveryError('INTERNAL_ERROR', 'Falha ao recuperar o pedido criado');
    }
    return createdOrder;
  }

  /**
   * Atualiza status do pedido validando a máquina de estados
   */
  updateOrderStatus(id: number, input: UpdateOrderStatusInput): DeliveryOrder {
    const order = this.getDeliveryOrderById(id);
    if (!order) {
      throw new DeliveryError('ORDER_NOT_FOUND', `Pedido de delivery #${id} não encontrado`);
    }

    const currentStatus = order.status;
    const newStatus = input.status;

    // Validação da transição
    const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(newStatus)) {
      throw new DeliveryError(
        'INVALID_STATUS_TRANSITION',
        `Transição inválida de status: de ${currentStatus} para ${newStatus}`
      );
    }

    let courierIdToSet = order.courierId;
    let cancellationReasonToSet = order.cancellationReason;

    // Regras específicas de cada transição
    if (newStatus === 'DISPATCHED') {
      const courierId = input.courierId ?? input.courier_id ?? order.courierId;
      if (!courierId) {
        throw new DeliveryError('COURIER_REQUIRED', 'Entregador é obrigatório para despachar o pedido');
      }
      courierIdToSet = courierId;
    }

    if (newStatus === 'CANCELLED') {
      const reason = input.cancellationReason ?? input.cancellation_reason;
      if (!reason || !reason.trim()) {
        throw new DeliveryError('CANCELLATION_REASON_REQUIRED', 'Motivo do cancelamento é obrigatório');
      }
      cancellationReasonToSet = reason.trim();
    }

    // Atualização com timestamps correspondentes
    let sql = 'UPDATE delivery_orders SET status = ?, updated_at = CURRENT_TIMESTAMP';
    const params: any[] = [newStatus];

    if (newStatus === 'DISPATCHED') {
      sql += ', dispatched_at = CURRENT_TIMESTAMP, courier_id = ?';
      params.push(courierIdToSet);
    } else if (newStatus === 'DELIVERED') {
      sql += ', delivered_at = CURRENT_TIMESTAMP';
    } else if (newStatus === 'RETURNED') {
      sql += ', returned_at = CURRENT_TIMESTAMP';
    } else if (newStatus === 'CANCELLED') {
      sql += ', cancellation_reason = ?';
      params.push(cancellationReasonToSet);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    this.db.prepare(sql).run(...params);

    const updated = this.getDeliveryOrderById(id);
    if (!updated) {
      throw new DeliveryError('INTERNAL_ERROR', `Falha ao recarregar o pedido #${id}`);
    }
    return updated;
  }

  /**
   * Cancelamento direto de pedido com motivo obrigatório
   */
  cancelDeliveryOrder(id: number, cancellationReason: string): DeliveryOrder {
    return this.updateOrderStatus(id, {
      status: 'CANCELLED',
      cancellationReason,
    });
  }

  /**
   * Busca pedido completo por ID com array de itens
   */
  getDeliveryOrderById(id: number): DeliveryOrder | null {
    const row = this.db
      .prepare('SELECT * FROM delivery_orders WHERE id = ?')
      .get(id) as OrderDbRow | undefined;

    if (!row) return null;

    const items = this.getItemsForOrder(id);
    return mapOrderRow(row, items);
  }

  /**
   * Busca pedido completo por Número com array de itens
   */
  getDeliveryOrderByNumber(orderNumber: string): DeliveryOrder | null {
    const row = this.db
      .prepare('SELECT * FROM delivery_orders WHERE order_number = ?')
      .get(orderNumber) as OrderDbRow | undefined;

    if (!row) return null;

    const items = this.getItemsForOrder(row.id);
    return mapOrderRow(row, items);
  }

  /**
   * Retorna os itens de um pedido específico
   */
  private getItemsForOrder(orderId: number): DeliveryOrderItem[] {
    const rows = this.db
      .prepare('SELECT * FROM delivery_order_items WHERE delivery_order_id = ? ORDER BY id ASC')
      .all(orderId) as ItemDbRow[];

    return rows.map(mapItemRow);
  }

  /**
   * Lista pedidos com filtros combinados e paginação
   */
  listDeliveryOrders(filters: DeliveryOrderFilters = {}): {
    orders: DeliveryOrder[];
    total: number;
  } {
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (filters.storeId != null) {
      whereClauses.push('o.store_id = ?');
      params.push(filters.storeId);
    }

    if (filters.courierId != null) {
      whereClauses.push('o.courier_id = ?');
      params.push(filters.courierId);
    }

    if (filters.customerId != null) {
      whereClauses.push('o.customer_id = ?');
      params.push(filters.customerId);
    }

    if (filters.paymentMethod) {
      whereClauses.push('o.payment_method = ?');
      params.push(filters.paymentMethod);
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        if (filters.status.length > 0) {
          const placeholders = filters.status.map(() => '?').join(', ');
          whereClauses.push(`o.status IN (${placeholders})`);
          params.push(...filters.status);
        }
      } else {
        whereClauses.push('o.status = ?');
        params.push(filters.status);
      }
    }

    if (filters.startDate) {
      whereClauses.push('o.received_at >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClauses.push('o.received_at <= ?');
      params.push(filters.endDate);
    }

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      whereClauses.push(`(
        o.customer_name LIKE ? OR
        o.customer_phone LIKE ? OR
        o.customer_cpf LIKE ? OR
        o.order_number LIKE ? OR
        o.neighborhood LIKE ? OR
        o.street LIKE ?
      )`);
      params.push(term, term, term, term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count
    const countRow = this.db
      .prepare(`SELECT COUNT(*) as total FROM delivery_orders o ${whereSql}`)
      .get(...params) as { total: number };
    const total = Number(countRow?.total ?? 0);

    // Orders page
    const limit = filters.limit != null && filters.limit > 0 ? filters.limit : 50;
    const offset = filters.offset != null && filters.offset >= 0 ? filters.offset : 0;

    const pageParams = [...params, limit, offset];
    const rows = this.db
      .prepare(
        `SELECT o.* FROM delivery_orders o
         ${whereSql}
         ORDER BY o.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...pageParams) as OrderDbRow[];

    if (rows.length === 0) {
      return { orders: [], total };
    }

    // Busca itens em lote para performance
    const orderIds = rows.map((r) => r.id);
    const itemPlaceholders = orderIds.map(() => '?').join(', ');
    const itemRows = this.db
      .prepare(
        `SELECT * FROM delivery_order_items WHERE delivery_order_id IN (${itemPlaceholders}) ORDER BY id ASC`
      )
      .all(...orderIds) as ItemDbRow[];

    const itemsByOrderId = new Map<number, DeliveryOrderItem[]>();
    for (const itemRow of itemRows) {
      const mapped = mapItemRow(itemRow);
      const list = itemsByOrderId.get(mapped.deliveryOrderId) || [];
      list.push(mapped);
      itemsByOrderId.set(mapped.deliveryOrderId, list);
    }

    const orders = rows.map((r) => mapOrderRow(r, itemsByOrderId.get(r.id) || []));

    return { orders, total };
  }
}
