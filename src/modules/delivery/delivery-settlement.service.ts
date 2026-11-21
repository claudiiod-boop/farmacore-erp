import { Database } from '../../database/connection';
import type {
  DeliveryDispatch,
  DeliveryDispatchWithOrders,
  CreateDispatchInput,
  SettleDispatchParams,
  SettlementResult,
  DeliveryOrder,
  DeliveryOrderItem,
  Courier,
  DispatchStatus,
  DeliveryOrderStatus,
  DeliveryPaymentMethod,
  CourierVehicleType,
  CourierStatus,
} from './types';

export class SettlementError extends Error {
  constructor(public code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'SettlementError';
  }
}

// Compatibilidade cruzada com DeliveryError
export { SettlementError as DeliveryError };

export interface DispatchFilters {
  storeId?: number;
  courierId?: number;
  status?: DispatchStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

interface DispatchDbRow {
  id: number;
  dispatch_number: string;
  store_id: number;
  courier_id: number;
  cash_session_id: number | null;
  total_orders: number;
  total_amount: number;
  total_change_provided: number;
  collected_cash: number;
  collected_card: number;
  collected_pix: number;
  total_commission: number;
  status: DispatchStatus;
  operator_name: string | null;
  notes: string | null;
  dispatched_at: string;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
}

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

interface CourierDbRow {
  id: number;
  store_id: number | null;
  name: string;
  cpf: string;
  phone: string;
  vehicle_type: CourierVehicleType;
  vehicle_plate: string | null;
  cnh: string | null;
  commission_per_delivery: number;
  daily_allowance: number;
  status: CourierStatus;
  is_active: number;
  created_at: string;
  updated_at: string;
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

function mapCourierRow(row: CourierDbRow): Courier {
  return {
    id: Number(row.id),
    storeId: row.store_id != null ? Number(row.store_id) : null,
    name: row.name,
    cpf: row.cpf,
    phone: row.phone,
    vehicleType: row.vehicle_type,
    vehiclePlate: row.vehicle_plate,
    cnh: row.cnh,
    commissionPerDelivery: Number(row.commission_per_delivery),
    dailyAllowance: Number(row.daily_allowance),
    status: row.status,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // DB compatibility aliases
    store_id: row.store_id != null ? Number(row.store_id) : null,
    vehicle_type: row.vehicle_type,
    vehicle_plate: row.vehicle_plate,
    commission_per_delivery: Number(row.commission_per_delivery),
    daily_allowance: Number(row.daily_allowance),
    is_active: Number(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapDispatchRow(
  row: DispatchDbRow,
  orders: DeliveryOrder[] = [],
  courier: Courier | null = null
): DeliveryDispatchWithOrders {
  return {
    id: Number(row.id),
    dispatchNumber: row.dispatch_number,
    storeId: Number(row.store_id),
    courierId: Number(row.courier_id),
    cashSessionId: row.cash_session_id != null ? Number(row.cash_session_id) : null,
    totalOrders: Number(row.total_orders),
    totalAmount: Number(row.total_amount),
    totalChangeProvided: Number(row.total_change_provided),
    collectedCash: Number(row.collected_cash),
    collectedCard: Number(row.collected_card),
    collectedPix: Number(row.collected_pix),
    totalCommission: Number(row.total_commission),
    status: row.status,
    operatorName: row.operator_name,
    notes: row.notes,
    dispatchedAt: row.dispatched_at,
    settledAt: row.settled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    orders,
    courier,

    // DB compatibility aliases
    dispatch_number: row.dispatch_number,
    store_id: Number(row.store_id),
    courier_id: Number(row.courier_id),
    cash_session_id: row.cash_session_id != null ? Number(row.cash_session_id) : null,
    total_orders: Number(row.total_orders),
    total_amount: Number(row.total_amount),
    total_change_provided: Number(row.total_change_provided),
    collected_cash: Number(row.collected_cash),
    collected_card: Number(row.collected_card),
    collected_pix: Number(row.collected_pix),
    total_commission: Number(row.total_commission),
    operator_name: row.operator_name,
    dispatched_at: row.dispatched_at,
    settled_at: row.settled_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class DeliverySettlementService {
  constructor(private db: Database) {}

  /**
   * Gera numeração sequencial única no formato ROM-YYYYMM-XXXX
   */
  private generateDispatchNumber(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `ROM-${yearMonth}-`;

    const last = this.db
      .prepare(
        'SELECT dispatch_number FROM delivery_dispatches WHERE dispatch_number LIKE ? ORDER BY dispatch_number DESC LIMIT 1'
      )
      .get(`${prefix}%`) as { dispatch_number: string } | undefined;

    let seq = 1;
    if (last?.dispatch_number) {
      const parts = last.dispatch_number.split('-');
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
   * 1. createDispatch: Agrupa múltiplos pedidos READY_FOR_PICKUP, gera romaneio sequencial,
   * atualiza pedidos para DISPATCHED e motoboy para ON_DELIVERY atomicamente.
   */
  createDispatch(input: CreateDispatchInput): DeliveryDispatchWithOrders {
    const storeId = input.storeId ?? input.store_id;
    const courierId = input.courierId ?? input.courier_id;
    const orderIds = input.orderIds ?? input.order_ids ?? [];
    const notes = input.notes ?? null;

    if (!storeId || isNaN(storeId) || storeId <= 0) {
      throw new SettlementError('INVALID_STORE_ID', 'ID da loja inválido ou não informado');
    }

    if (!courierId || isNaN(courierId) || courierId <= 0) {
      throw new SettlementError('INVALID_COURIER_ID', 'ID do entregador inválido ou não informado');
    }

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      throw new SettlementError('EMPTY_ORDERS_LIST', 'A lista de pedidos para despacho não pode ser vazia');
    }

    // Validação do entregador
    const courierRow = this.db
      .prepare('SELECT * FROM couriers WHERE id = ?')
      .get(courierId) as CourierDbRow | undefined;

    if (!courierRow) {
      throw new SettlementError('COURIER_NOT_FOUND', `Entregador ID ${courierId} não encontrado`);
    }

    if (!courierRow.is_active || courierRow.status !== 'AVAILABLE') {
      throw new SettlementError(
        'COURIER_NOT_AVAILABLE',
        `Entregador ${courierRow.name} indisponível para despacho (status: ${courierRow.status}, ativo: ${courierRow.is_active})`
      );
    }

    // Validação dos pedidos
    const orders: OrderDbRow[] = [];
    let totalAmount = 0;
    let totalChangeProvided = 0;

    for (const orderId of orderIds) {
      const orderRow = this.db
        .prepare('SELECT * FROM delivery_orders WHERE id = ?')
        .get(orderId) as OrderDbRow | undefined;

      if (!orderRow) {
        throw new SettlementError(
          'ORDER_NOT_READY_FOR_DISPATCH',
          `Pedido ID ${orderId} não encontrado no sistema`
        );
      }

      if (orderRow.status !== 'READY_FOR_PICKUP') {
        throw new SettlementError(
          'ORDER_NOT_READY_FOR_DISPATCH',
          `Pedido ${orderRow.order_number} (ID: ${orderRow.id}) não está pronto para despacho. Status atual: ${orderRow.status}`
        );
      }

      orders.push(orderRow);
      totalAmount += Number(orderRow.total_amount);

      // Troco que o motoboy deve portar
      if (
        orderRow.payment_method === 'DINHEIRO' &&
        orderRow.change_for != null &&
        Number(orderRow.change_for) > Number(orderRow.total_amount)
      ) {
        const changeNeeded = Number(orderRow.change_for) - Number(orderRow.total_amount);
        totalChangeProvided += changeNeeded;
      }
    }

    totalAmount = Number(totalAmount.toFixed(2));
    totalChangeProvided = Number(totalChangeProvided.toFixed(2));
    const dispatchNumber = this.generateDispatchNumber();

    const insertDispatch = this.db.prepare(`
      INSERT INTO delivery_dispatches (
        dispatch_number, store_id, courier_id, total_orders, total_amount, total_change_provided,
        collected_cash, collected_card, collected_pix, total_commission, status, notes, dispatched_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0.0, 0.0, 0.0, 0.0, 'OPEN', ?, CURRENT_TIMESTAMP)
    `);

    const updateOrder = this.db.prepare(`
      UPDATE delivery_orders
      SET status = 'DISPATCHED',
          courier_id = ?,
          dispatch_id = ?,
          dispatched_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const updateCourier = this.db.prepare(`
      UPDATE couriers
      SET status = 'ON_DELIVERY',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    let newDispatchId = 0;

    const executeTx = this.db.transaction(() => {
      const dispatchResult = insertDispatch.run(
        dispatchNumber,
        storeId,
        courierId,
        orders.length,
        totalAmount,
        totalChangeProvided,
        notes
      );
      newDispatchId = Number(dispatchResult.lastInsertRowid);

      for (const order of orders) {
        updateOrder.run(courierId, newDispatchId, order.id);
      }

      updateCourier.run(courierId);
    });

    executeTx();

    const created = this.getDispatchById(newDispatchId);
    if (!created) {
      throw new SettlementError('DISPATCH_CREATE_FAILED', 'Falha ao recuperar o romaneio criado');
    }

    return created;
  }

  /**
   * 2. settleDispatch: Acerto de contas de romaneio em aberto, marcação de DELIVERED/RETURNED,
   * cálculo de comissão, suprimento formal no caixa PDV e comprovante térmico.
   */
  settleDispatch(dispatchId: number, params: SettleDispatchParams): SettlementResult {
    if (!dispatchId || isNaN(dispatchId) || dispatchId <= 0) {
      throw new SettlementError('INVALID_DISPATCH_ID', 'ID do romaneio inválido');
    }

    const dispatchRow = this.db
      .prepare('SELECT * FROM delivery_dispatches WHERE id = ?')
      .get(dispatchId) as DispatchDbRow | undefined;

    if (!dispatchRow) {
      throw new SettlementError('DISPATCH_NOT_FOUND', `Romaneio ID ${dispatchId} não encontrado`);
    }

    if (dispatchRow.status !== 'OPEN') {
      throw new SettlementError(
        'DISPATCH_ALREADY_SETTLED',
        `Romaneio ${dispatchRow.dispatch_number} não está em aberto para acerto (status: ${dispatchRow.status})`
      );
    }

    const courierRow = this.db
      .prepare('SELECT * FROM couriers WHERE id = ?')
      .get(dispatchRow.courier_id) as CourierDbRow | undefined;

    const cashSessionId = params.cashSessionId ?? params.cash_session_id ?? null;
    let sessionRow: { id: number; status: string; current_cash: number } | undefined;

    if (cashSessionId != null) {
      sessionRow = this.db
        .prepare('SELECT id, status, current_cash FROM cash_sessions WHERE id = ?')
        .get(cashSessionId) as { id: number; status: string; current_cash: number } | undefined;

      if (!sessionRow) {
        throw new SettlementError('SESSION_NOT_FOUND', `Sessão de caixa ID ${cashSessionId} não encontrada`);
      }

      if (sessionRow.status !== 'OPEN') {
        throw new SettlementError('SESSION_NOT_OPEN', `Sessão de caixa ID ${cashSessionId} não está aberta`);
      }
    }

    // Pedidos vinculados a este romaneio
    const linkedOrders = this.db
      .prepare('SELECT * FROM delivery_orders WHERE dispatch_id = ?')
      .all(dispatchId) as OrderDbRow[];

    const orderResolutionMap = new Map<number, { delivered: boolean; returnedReason?: string }>();
    if (params.orders && Array.isArray(params.orders)) {
      for (const item of params.orders) {
        const oId = Number(item.orderId ?? item.order_id);
        orderResolutionMap.set(oId, {
          delivered: Boolean(item.delivered),
          returnedReason: item.returnedReason ?? item.returned_reason,
        });
      }
    }

    let totalDelivered = 0;
    let totalReturned = 0;

    const updateDeliveredStmt = this.db.prepare(`
      UPDATE delivery_orders
      SET status = 'DELIVERED',
          delivered_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const updateReturnedStmt = this.db.prepare(`
      UPDATE delivery_orders
      SET status = 'RETURNED',
          cancellation_reason = ?,
          returned_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const collectedCash = Number(params.collectedCash ?? params.collected_cash ?? 0);
    const collectedCard = Number(params.collectedCard ?? params.collected_card ?? 0);
    const collectedPix = Number(params.collectedPix ?? params.collected_pix ?? 0);
    const operatorName = params.operatorName ?? params.operator_name ?? dispatchRow.operator_name ?? 'Operador PDV';
    const notes = params.notes ?? dispatchRow.notes;

    let cashMovementId: number | null = null;

    const executeSettleTx = this.db.transaction(() => {
      // 1. Atualizar status de cada pedido do romaneio
      for (const order of linkedOrders) {
        const resolution = orderResolutionMap.get(order.id);
        const isDelivered = resolution ? resolution.delivered : true;

        if (isDelivered) {
          updateDeliveredStmt.run(order.id);
          totalDelivered++;
        } else {
          const reason = resolution?.returnedReason || 'Pedido não entregue/devolvido no acerto';
          updateReturnedStmt.run(reason, order.id);
          totalReturned++;
        }
      }

      // 2. Calcular comissão: totalDelivered * commissionPerDelivery + dailyAllowance
      const commissionPerDelivery = courierRow ? Number(courierRow.commission_per_delivery) : 0;
      const dailyAllowance = courierRow ? Number(courierRow.daily_allowance) : 0;
      const totalCommission = Number((totalDelivered * commissionPerDelivery + dailyAllowance).toFixed(2));

      // 3. Suprimento no Caixa PDV caso collectedCash > 0 e cashSessionId informado
      if (collectedCash > 0 && cashSessionId != null) {
        const movementRes = this.db
          .prepare(`
            INSERT INTO cash_movements (
              cash_session_id, type, amount, reason, operator_name, created_at
            ) VALUES (?, 'SUPPLY', ?, ?, ?, CURRENT_TIMESTAMP)
          `)
          .run(
            cashSessionId,
            collectedCash,
            `Acerto de Romaneio ${dispatchRow.dispatch_number} - Suprimento em Dinheiro`,
            operatorName
          );

        cashMovementId = Number(movementRes.lastInsertRowid);

        this.db
          .prepare('UPDATE cash_sessions SET current_cash = current_cash + ? WHERE id = ?')
          .run(collectedCash, cashSessionId);
      }

      // 4. Atualizar o romaneio para SETTLED
      this.db
        .prepare(`
          UPDATE delivery_dispatches
          SET status = 'SETTLED',
              settled_at = CURRENT_TIMESTAMP,
              collected_cash = ?,
              collected_card = ?,
              collected_pix = ?,
              total_commission = ?,
              cash_session_id = ?,
              operator_name = ?,
              notes = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(
          collectedCash,
          collectedCard,
          collectedPix,
          totalCommission,
          cashSessionId,
          operatorName,
          notes,
          dispatchId
        );

      // 5. Liberar o motoboy de volta para AVAILABLE
      if (courierRow) {
        this.db
          .prepare(`
            UPDATE couriers
            SET status = 'AVAILABLE',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .run(courierRow.id);
      }
    });

    executeSettleTx();

    const updatedDispatch = this.getDispatchById(dispatchId);
    if (!updatedDispatch) {
      throw new SettlementError('DISPATCH_FETCH_FAILED', 'Falha ao recuperar o romaneio liquidado');
    }

    const commissionEarned = updatedDispatch.totalCommission;
    const receiptText = this.generateReceiptText({
      dispatch: updatedDispatch,
      courier: courierRow ? mapCourierRow(courierRow) : null,
      totalDelivered,
      totalReturned,
      collectedCash,
      collectedCard,
      collectedPix,
      commissionEarned,
      cashMovementId,
      operatorName,
    });

    return {
      dispatch: updatedDispatch,
      totalDelivered,
      totalReturned,
      collectedCash,
      collectedCard,
      collectedPix,
      commissionEarned,
      cashMovementId,
      receiptText,

      // Compatibilidade snake_case
      total_delivered: totalDelivered,
      total_returned: totalReturned,
      collected_cash: collectedCash,
      collected_card: collectedCard,
      collected_pix: collectedPix,
      commission_earned: commissionEarned,
      cash_movement_id: cashMovementId,
      receipt_text: receiptText,
    };
  }

  /**
   * Formatação de comprovante para impressora térmica PDV (40 colunas)
   */
  private generateReceiptText(data: {
    dispatch: DeliveryDispatchWithOrders;
    courier: Courier | null;
    totalDelivered: number;
    totalReturned: number;
    collectedCash: number;
    collectedCard: number;
    collectedPix: number;
    commissionEarned: number;
    cashMovementId: number | null;
    operatorName: string;
  }): string {
    const formatBrl = (val: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
        .format(val)
        .replace(/\u00A0/g, ' ');

    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const totalCollected = data.collectedCash + data.collectedCard + data.collectedPix;

    return [
      '========================================',
      '        FARMACORE ERP — FARMÁCIA        ',
      '   COMPROVANTE DE ACERTO DE ROMANEIO    ',
      '========================================',
      `Romaneio:   ${data.dispatch.dispatchNumber}`,
      `Data/Hora:  ${formattedDate}`,
      `Entregador: ${data.courier ? data.courier.name : 'N/A'} (ID: ${data.dispatch.courierId})`,
      `Veículo:    ${data.courier?.vehicleType ?? 'MOTO'} ${data.courier?.vehiclePlate ? `(${data.courier.vehiclePlate})` : ''}`,
      `Operador:   ${data.operatorName}`,
      '----------------------------------------',
      'RESUMO DAS ENTREGAS',
      `Total de Pedidos:  ${data.dispatch.totalOrders}`,
      `Entregues:         ${data.totalDelivered}`,
      `Devolvidos:        ${data.totalReturned}`,
      '----------------------------------------',
      'APURAÇÃO DE VALORES RECEBIDOS',
      `Dinheiro:          ${formatBrl(data.collectedCash)}`,
      `Cartão:            ${formatBrl(data.collectedCard)}`,
      `PIX:               ${formatBrl(data.collectedPix)}`,
      `Total Recebido:    ${formatBrl(totalCollected)}`,
      '----------------------------------------',
      'COMISSÃO DO ENTREGADOR',
      `Valor da Comissão: ${formatBrl(data.commissionEarned)}`,
      ...(data.cashMovementId
        ? [
            '----------------------------------------',
            'MOVIMENTAÇÃO DE CAIXA PDV',
            `Suprimento:        ${formatBrl(data.collectedCash)} (Dinheiro)`,
            `Movimento Caixa:   #${data.cashMovementId}`,
          ]
        : []),
      '----------------------------------------',
      '',
      '________________________________________',
      'Assinatura do Entregador',
      '',
      '________________________________________',
      'Assinatura do Operador de Caixa',
      '========================================',
    ].join('\n');
  }

  /**
   * 3. getDispatchById: Busca romaneio com pedidos e motoboy agrupados
   */
  getDispatchById(id: number): DeliveryDispatchWithOrders | null {
    const row = this.db
      .prepare('SELECT * FROM delivery_dispatches WHERE id = ?')
      .get(id) as DispatchDbRow | undefined;

    if (!row) return null;

    return this.hydrateDispatch(row);
  }

  /**
   * Busca romaneio por código ROM-YYYYMM-XXXX
   */
  getDispatchByNumber(dispatchNumber: string): DeliveryDispatchWithOrders | null {
    const row = this.db
      .prepare('SELECT * FROM delivery_dispatches WHERE dispatch_number = ?')
      .get(dispatchNumber) as DispatchDbRow | undefined;

    if (!row) return null;

    return this.hydrateDispatch(row);
  }

  /**
   * Lista romaneios com filtros por storeId, courierId, status e paginação
   */
  listDispatches(filters: DispatchFilters = {}): {
    dispatches: DeliveryDispatchWithOrders[];
    total: number;
  } {
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (filters.storeId != null) {
      whereClauses.push('d.store_id = ?');
      params.push(filters.storeId);
    }

    if (filters.courierId != null) {
      whereClauses.push('d.courier_id = ?');
      params.push(filters.courierId);
    }

    if (filters.status) {
      whereClauses.push('d.status = ?');
      params.push(filters.status);
    }

    if (filters.startDate) {
      whereClauses.push('d.dispatched_at >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClauses.push('d.dispatched_at <= ?');
      params.push(filters.endDate);
    }

    if (filters.search) {
      const term = `%${filters.search.trim()}%`;
      whereClauses.push('(d.dispatch_number LIKE ? OR d.notes LIKE ? OR d.operator_name LIKE ?)');
      params.push(term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = this.db
      .prepare(`SELECT COUNT(*) as count FROM delivery_dispatches d ${whereSql}`)
      .get(...params) as { count: number };
    const total = countRow ? Number(countRow.count) : 0;

    let query = `
      SELECT d.*
      FROM delivery_dispatches d
      ${whereSql}
      ORDER BY d.id DESC
    `;

    const queryParams = [...params];
    if (filters.limit != null && filters.limit > 0) {
      query += ' LIMIT ?';
      queryParams.push(filters.limit);
      if (filters.offset != null && filters.offset >= 0) {
        query += ' OFFSET ?';
        queryParams.push(filters.offset);
      }
    }

    const rows = this.db.prepare(query).all(...queryParams) as DispatchDbRow[];
    const dispatches = rows.map((r) => this.hydrateDispatch(r));

    return { dispatches, total };
  }

  /**
   * Carrega pedidos e entregador associados ao romaneio
   */
  private hydrateDispatch(row: DispatchDbRow): DeliveryDispatchWithOrders {
    const orderRows = this.db
      .prepare('SELECT * FROM delivery_orders WHERE dispatch_id = ? ORDER BY id ASC')
      .all(row.id) as OrderDbRow[];

    const orderIds = orderRows.map((o) => o.id);
    let itemsByOrderId = new Map<number, DeliveryOrderItem[]>();

    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      const itemRows = this.db
        .prepare(
          `SELECT * FROM delivery_order_items WHERE delivery_order_id IN (${placeholders}) ORDER BY id ASC`
        )
        .all(...orderIds) as ItemDbRow[];

      for (const itemRow of itemRows) {
        const orderId = Number(itemRow.delivery_order_id);
        const list = itemsByOrderId.get(orderId) || [];
        list.push(mapItemRow(itemRow));
        itemsByOrderId.set(orderId, list);
      }
    }

    const orders = orderRows.map((o) => mapOrderRow(o, itemsByOrderId.get(o.id) || []));

    let courier: Courier | null = null;
    if (row.courier_id) {
      const courierRow = this.db
        .prepare('SELECT * FROM couriers WHERE id = ?')
        .get(row.courier_id) as CourierDbRow | undefined;
      if (courierRow) {
        courier = mapCourierRow(courierRow);
      }
    }

    return mapDispatchRow(row, orders, courier);
  }
}
