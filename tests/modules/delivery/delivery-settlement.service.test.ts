import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import {
  DeliverySettlementService,
  SettlementError,
  DeliveryError,
} from '../../../src/modules/delivery/delivery-settlement.service';
import type {
  CreateDispatchInput,
  SettleDispatchParams,
} from '../../../src/modules/delivery/types';

describe('DeliverySettlementService — Roteirização, Despacho e Acerto de Contas no Caixa PDV', () => {
  let db: Database;
  let service: DeliverySettlementService;
  const storeId = 1;
  let courierId: number;
  let cashSessionId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new DeliverySettlementService(db);

    // Cria produto padrão para os itens dos pedidos
    db.prepare(`
      INSERT OR IGNORE INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
      VALUES (101, '7891010101010', 'Medicamento Teste', 'Princípio Ativo Teste', '1.0001.0001.001-1', 'SEM_TARJA', 'LIBERADO', 20.0, 10.0, 15.0, 1)
    `).run();

    // Cria entregador padrão para os testes
    const courierRes = db
      .prepare(`
        INSERT INTO couriers (
          store_id, name, cpf, phone, vehicle_type, vehicle_plate, cnh,
          commission_per_delivery, daily_allowance, status, is_active
        ) VALUES (
          ?, 'Carlos Motoboy', '123.456.789-00', '(11) 98888-1111', 'MOTO', 'BRA2E19', '12345678900',
          5.0, 20.0, 'AVAILABLE', 1
        )
      `)
      .run(storeId);
    courierId = Number(courierRes.lastInsertRowid);

    // Cria sessão de caixa aberta no PDV
    const sessionRes = db
      .prepare(`
        INSERT INTO cash_sessions (store_id, operator_name, initial_cash, current_cash, status)
        VALUES (?, 'Operador Caixa 1', 100.0, 100.0, 'OPEN')
      `)
      .run(storeId);
    cashSessionId = Number(sessionRes.lastInsertRowid);
  });

  afterEach(() => {
    db.close();
  });

  // Helper para criar pedidos com status e formas de pagamento desejadas
  function createTestOrder(opts: {
    status?: string;
    totalAmount?: number;
    paymentMethod?: string;
    changeFor?: number | null;
    customerName?: string;
    courierId?: number | null;
    dispatchId?: number | null;
  } = {}): number {
    const status = opts.status ?? 'READY_FOR_PICKUP';
    const totalAmount = opts.totalAmount ?? 50.0;
    const paymentMethod = opts.paymentMethod ?? 'DINHEIRO';
    const changeFor = opts.changeFor !== undefined ? opts.changeFor : 100.0;
    const customerName = opts.customerName ?? 'Cliente Teste';
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const rand = Math.floor(Math.random() * 9000 + 1000);
    const orderNumber = `DEL-${yearMonth}-${rand}`;

    const res = db
      .prepare(`
        INSERT INTO delivery_orders (
          order_number, store_id, customer_name, customer_phone,
          street, number, neighborhood, city, state,
          subtotal_amount, delivery_fee, discount_amount, total_amount,
          payment_method, change_for, status, courier_id, dispatch_id
        ) VALUES (
          ?, ?, ?, '(11) 99999-0000',
          'Rua das Palmeiras', '100', 'Centro', 'São Paulo', 'SP',
          ?, 5.0, 0.0, ?,
          ?, ?, ?, ?, ?
        )
      `)
      .run(
        orderNumber,
        storeId,
        customerName,
        totalAmount - 5.0,
        totalAmount,
        paymentMethod,
        changeFor,
        status,
        opts.courierId ?? null,
        opts.dispatchId ?? null
      );

    const orderId = Number(res.lastInsertRowid);

    // Insere item de teste
    db.prepare(`
      INSERT INTO delivery_order_items (
        delivery_order_id, product_id, product_name, quantity, unit_price, total_price
      ) VALUES (?, 101, 'Medicamento Teste', 1, ?, ?)
    `).run(orderId, totalAmount - 5.0, totalAmount - 5.0);

    return orderId;
  }

  // =========================================================================
  // 1. ROTEIRIZAÇÃO E DESPACHO (createDispatch)
  // =========================================================================

  describe('createDispatch — Criação e Despacho de Romaneio', () => {
    it('deve agrupar múltiplos pedidos READY_FOR_PICKUP e gerar romaneio ROM-YYYYMM-XXXX', () => {
      const order1 = createTestOrder({
        totalAmount: 60.0,
        paymentMethod: 'DINHEIRO',
        changeFor: 100.0, // Troco necessário: 100 - 60 = 40
      });
      const order2 = createTestOrder({
        totalAmount: 40.0,
        paymentMethod: 'CARTAO_CREDITO',
        changeFor: null,
      });
      const order3 = createTestOrder({
        totalAmount: 30.0,
        paymentMethod: 'DINHEIRO',
        changeFor: 50.0, // Troco necessário: 50 - 30 = 20
      });

      const input: CreateDispatchInput = {
        storeId,
        courierId,
        orderIds: [order1, order2, order3],
        notes: 'Saída às 14:00 - Região Central',
      };

      const dispatch = service.createDispatch(input);

      // Verificação da numeração sequencial
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      expect(dispatch.dispatchNumber).toMatch(new RegExp(`^ROM-${yearMonth}-\\d{4}$`));
      expect(dispatch.status).toBe('OPEN');
      expect(dispatch.storeId).toBe(storeId);
      expect(dispatch.courierId).toBe(courierId);
      expect(dispatch.totalOrders).toBe(3);
      expect(dispatch.totalAmount).toBe(130.0); // 60 + 40 + 30
      expect(dispatch.totalChangeProvided).toBe(60.0); // 40 + 20
      expect(dispatch.notes).toBe('Saída às 14:00 - Região Central');

      // Pedidos anexados no retorno
      expect(dispatch.orders).toHaveLength(3);
      expect(dispatch.courier).toBeDefined();
      expect(dispatch.courier?.name).toBe('Carlos Motoboy');

      // Validação no banco: pedidos atualizados para DISPATCHED com dispatch_id e courier_id
      for (const orderId of [order1, order2, order3]) {
        const orderRow = db
          .prepare('SELECT status, dispatch_id, courier_id, dispatched_at FROM delivery_orders WHERE id = ?')
          .get(orderId) as any;

        expect(orderRow.status).toBe('DISPATCHED');
        expect(orderRow.dispatch_id).toBe(dispatch.id);
        expect(orderRow.courier_id).toBe(courierId);
        expect(orderRow.dispatched_at).not.toBeNull();
      }

      // Validação no banco: status do entregador alterado para ON_DELIVERY
      const courierRow = db
        .prepare('SELECT status FROM couriers WHERE id = ?')
        .get(courierId) as any;
      expect(courierRow.status).toBe('ON_DELIVERY');
    });

    it('deve gerar sequência incremental correta ROM-YYYYMM-0001, ROM-YYYYMM-0002', () => {
      const orderA = createTestOrder();
      const orderB = createTestOrder();

      const d1 = service.createDispatch({
        storeId,
        courierId,
        orderIds: [orderA],
      });
      expect(d1.dispatchNumber.endsWith('0001')).toBe(true);

      // Atualiza entregador de volta para AVAILABLE para permitir segundo despacho
      db.prepare('UPDATE couriers SET status = ? WHERE id = ?').run('AVAILABLE', courierId);

      const d2 = service.createDispatch({
        storeId,
        courierId,
        orderIds: [orderB],
      });
      expect(d2.dispatchNumber.endsWith('0002')).toBe(true);
    });

    it('deve calcular totalChangeProvided como 0 quando nenhum pedido exigir troco', () => {
      const order1 = createTestOrder({
        totalAmount: 50.0,
        paymentMethod: 'PIX',
        changeFor: null,
      });
      const order2 = createTestOrder({
        totalAmount: 80.0,
        paymentMethod: 'DINHEIRO',
        changeFor: 80.0, // Troco 0
      });

      const dispatch = service.createDispatch({
        storeId,
        courierId,
        orderIds: [order1, order2],
      });

      expect(dispatch.totalChangeProvided).toBe(0.0);
      expect(dispatch.totalAmount).toBe(130.0);
    });

    it('deve lançar EMPTY_ORDERS_LIST quando a lista de pedidos for vazia', () => {
      expect(() => {
        service.createDispatch({
          storeId,
          courierId,
          orderIds: [],
        });
      }).toThrowError(SettlementError);

      try {
        service.createDispatch({
          storeId,
          courierId,
          orderIds: [],
        });
      } catch (err: any) {
        expect(err.code).toBe('EMPTY_ORDERS_LIST');
      }
    });

    it('deve lançar COURIER_NOT_FOUND quando o entregador não existir', () => {
      const order = createTestOrder();

      try {
        service.createDispatch({
          storeId,
          courierId: 9999,
          orderIds: [order],
        });
        expect.fail('Deveria ter lançado erro');
      } catch (err: any) {
        expect(err).toBeInstanceOf(SettlementError);
        expect(err.code).toBe('COURIER_NOT_FOUND');
      }
    });

    it('deve lançar COURIER_NOT_AVAILABLE se o motoboy já estiver em entrega (ON_DELIVERY) ou INACTIVE', () => {
      db.prepare('UPDATE couriers SET status = ? WHERE id = ?').run('ON_DELIVERY', courierId);
      const order = createTestOrder();

      try {
        service.createDispatch({
          storeId,
          courierId,
          orderIds: [order],
        });
        expect.fail('Deveria ter lançado erro');
      } catch (err: any) {
        expect(err.code).toBe('COURIER_NOT_AVAILABLE');
      }

      // Motoboy inativo
      db.prepare('UPDATE couriers SET status = ?, is_active = 0 WHERE id = ?').run('AVAILABLE', courierId);
      expect(() => {
        service.createDispatch({
          storeId,
          courierId,
          orderIds: [order],
        });
      }).toThrow(SettlementError);
    });

    it('deve lançar ORDER_NOT_READY_FOR_DISPATCH se algum pedido não existir ou não estiver em READY_FOR_PICKUP', () => {
      const orderValid = createTestOrder({ status: 'READY_FOR_PICKUP' });
      const orderInvalid = createTestOrder({ status: 'PREPARING' });

      // Pedido inexistente
      expect(() => {
        service.createDispatch({
          storeId,
          courierId,
          orderIds: [orderValid, 88888],
        });
      }).toThrowError(SettlementError);

      try {
        service.createDispatch({
          storeId,
          courierId,
          orderIds: [orderValid, 88888],
        });
      } catch (err: any) {
        expect(err.code).toBe('ORDER_NOT_READY_FOR_DISPATCH');
      }

      // Pedido em status incorreto (PREPARING)
      try {
        service.createDispatch({
          storeId,
          courierId,
          orderIds: [orderValid, orderInvalid],
        });
      } catch (err: any) {
        expect(err.code).toBe('ORDER_NOT_READY_FOR_DISPATCH');
      }
    });
  });

  // =========================================================================
  // 2. ACERTO DE CONTAS NO CAIXA PDV (settleDispatch)
  // =========================================================================

  describe('settleDispatch — Acerto de Romaneio com Movimentação de Caixa e Comissões', () => {
    it('deve liquidar romaneio com pedidos entregues, gerar suprimento no caixa PDV e liberar motoboy', () => {
      const order1 = createTestOrder({
        totalAmount: 50.0,
        paymentMethod: 'DINHEIRO',
        changeFor: 50.0,
      });
      const order2 = createTestOrder({
        totalAmount: 70.0,
        paymentMethod: 'CARTAO_CREDITO',
      });
      const order3 = createTestOrder({
        totalAmount: 40.0,
        paymentMethod: 'PIX',
      });

      const dispatch = service.createDispatch({
        storeId,
        courierId,
        orderIds: [order1, order2, order3],
      });

      const settleParams: SettleDispatchParams = {
        orders: [
          { orderId: order1, delivered: true },
          { orderId: order2, delivered: true },
          { orderId: order3, delivered: true },
        ],
        collectedCash: 50.0,
        collectedCard: 70.0,
        collectedPix: 40.0,
        cashSessionId,
        operatorName: 'Operador Caixa 1',
        notes: 'Acerto sem divergências',
      };

      const result = service.settleDispatch(dispatch.id, settleParams);

      // Verificação do resultado estruturado
      expect(result.dispatch.id).toBe(dispatch.id);
      expect(result.dispatch.status).toBe('SETTLED');
      expect(result.totalDelivered).toBe(3);
      expect(result.totalReturned).toBe(0);
      expect(result.collectedCash).toBe(50.0);
      expect(result.collectedCard).toBe(70.0);
      expect(result.collectedPix).toBe(40.0);

      // Comissão: 3 entregas * 5.0 + 20.0 diária = 35.0
      expect(result.commissionEarned).toBe(35.0);
      expect(result.dispatch.totalCommission).toBe(35.0);

      // Verificação da movimentação formal de caixa (SUPPLY)
      expect(result.cashMovementId).toBeDefined();
      expect(result.cashMovementId).toBeGreaterThan(0);

      const movementRow = db
        .prepare('SELECT * FROM cash_movements WHERE id = ?')
        .get(result.cashMovementId) as any;

      expect(movementRow).toBeDefined();
      expect(movementRow.cash_session_id).toBe(cashSessionId);
      expect(movementRow.type).toBe('SUPPLY');
      expect(movementRow.amount).toBe(50.0);
      expect(movementRow.reason).toContain('Acerto de Romaneio');
      expect(movementRow.operator_name).toBe('Operador Caixa 1');

      // Verificação do saldo atual do caixa PDV (100.0 inicial + 50.0 suprimento = 150.0)
      const sessionRow = db
        .prepare('SELECT current_cash FROM cash_sessions WHERE id = ?')
        .get(cashSessionId) as any;
      expect(sessionRow.current_cash).toBe(150.0);

      // Status do motoboy restaurado para AVAILABLE
      const courierRow = db
        .prepare('SELECT status FROM couriers WHERE id = ?')
        .get(courierId) as any;
      expect(courierRow.status).toBe('AVAILABLE');

      // Pedidos atualizados para DELIVERED com delivered_at
      for (const oId of [order1, order2, order3]) {
        const oRow = db
          .prepare('SELECT status, delivered_at FROM delivery_orders WHERE id = ?')
          .get(oId) as any;
        expect(oRow.status).toBe('DELIVERED');
        expect(oRow.delivered_at).not.toBeNull();
      }

      // Comprovante textual para impressão térmica
      expect(result.receiptText).toBeDefined();
      expect(result.receiptText).toContain('COMPROVANTE DE ACERTO DE ROMANEIO');
      expect(result.receiptText).toContain(dispatch.dispatchNumber);
      expect(result.receiptText).toContain('Carlos Motoboy');
      expect(result.receiptText).toContain('R$ 50,00');
      expect(result.receiptText).toContain('R$ 35,00');
    });

    it('deve tratar devolução de pedido (RETURNED) com motivo e calcular comissão apenas dos entregues', () => {
      const orderDelivered = createTestOrder({ totalAmount: 45.0 });
      const orderReturned = createTestOrder({ totalAmount: 60.0 });

      const dispatch = service.createDispatch({
        storeId,
        courierId,
        orderIds: [orderDelivered, orderReturned],
      });

      const settleParams: SettleDispatchParams = {
        orders: [
          { orderId: orderDelivered, delivered: true },
          {
            orderId: orderReturned,
            delivered: false,
            returnedReason: 'Cliente ausente após 3 tentativas',
          },
        ],
        collectedCash: 45.0,
        collectedCard: 0,
        collectedPix: 0,
        cashSessionId,
      };

      const result = service.settleDispatch(dispatch.id, settleParams);

      expect(result.totalDelivered).toBe(1);
      expect(result.totalReturned).toBe(1);
      // Comissão: 1 entrega * 5.0 + 20.0 diária = 25.0
      expect(result.commissionEarned).toBe(25.0);

      // Pedido entregue
      const rowDelivered = db
        .prepare('SELECT status, delivered_at FROM delivery_orders WHERE id = ?')
        .get(orderDelivered) as any;
      expect(rowDelivered.status).toBe('DELIVERED');

      // Pedido devolvido
      const rowReturned = db
        .prepare('SELECT status, cancellation_reason, returned_at FROM delivery_orders WHERE id = ?')
        .get(orderReturned) as any;
      expect(rowReturned.status).toBe('RETURNED');
      expect(rowReturned.cancellation_reason).toBe('Cliente ausente após 3 tentativas');
      expect(rowReturned.returned_at).not.toBeNull();
    });

    it('não deve gerar movimentação de caixa se collectedCash for 0 ou omitido', () => {
      const orderPix = createTestOrder({ totalAmount: 100.0, paymentMethod: 'PIX' });
      const dispatch = service.createDispatch({
        storeId,
        courierId,
        orderIds: [orderPix],
      });

      const result = service.settleDispatch(dispatch.id, {
        orders: [{ orderId: orderPix, delivered: true }],
        collectedCash: 0,
        collectedPix: 100.0,
        cashSessionId,
      });

      expect(result.cashMovementId).toBeNull();

      // current_cash do caixa permanece inalterado
      const sessionRow = db
        .prepare('SELECT current_cash FROM cash_sessions WHERE id = ?')
        .get(cashSessionId) as any;
      expect(sessionRow.current_cash).toBe(100.0);
    });

    it('deve lançar SESSION_NOT_OPEN se a sessão de caixa estiver fechada (CLOSED)', () => {
      db.prepare('UPDATE cash_sessions SET status = ? WHERE id = ?').run('CLOSED', cashSessionId);

      const order = createTestOrder({ totalAmount: 50.0 });
      const dispatch = service.createDispatch({
        storeId,
        courierId,
        orderIds: [order],
      });

      try {
        service.settleDispatch(dispatch.id, {
          orders: [{ orderId: order, delivered: true }],
          collectedCash: 50.0,
          cashSessionId,
        });
        expect.fail('Deveria ter lançado erro');
      } catch (err: any) {
        expect(err).toBeInstanceOf(SettlementError);
        expect(err.code).toBe('SESSION_NOT_OPEN');
      }
    });

    it('deve lançar DISPATCH_ALREADY_SETTLED ao tentar liquidar romaneio já liquidado', () => {
      const order = createTestOrder();
      const dispatch = service.createDispatch({
        storeId,
        courierId,
        orderIds: [order],
      });

      // Primeiro acerto com sucesso
      service.settleDispatch(dispatch.id, {
        orders: [{ orderId: order, delivered: true }],
        collectedCash: 0,
        cashSessionId,
      });

      // Tentativa de segundo acerto
      try {
        service.settleDispatch(dispatch.id, {
          orders: [{ orderId: order, delivered: true }],
          collectedCash: 0,
          cashSessionId,
        });
        expect.fail('Deveria ter lançado erro');
      } catch (err: any) {
        expect(err.code).toBe('DISPATCH_ALREADY_SETTLED');
      }
    });

    it('deve lançar DISPATCH_NOT_FOUND para ID de romaneio inexistente', () => {
      try {
        service.settleDispatch(99999, {
          orders: [],
        });
        expect.fail('Deveria ter lançado erro');
      } catch (err: any) {
        expect(err.code).toBe('DISPATCH_NOT_FOUND');
      }
    });
  });

  // =========================================================================
  // 3. CONSULTA E LISTAGEM DE ROMANEIOS (getDispatchById & listDispatches)
  // =========================================================================

  describe('Consultas — getDispatchById, getDispatchByNumber & listDispatches', () => {
    it('deve buscar romaneio completo por ID com pedidos agregados e dados do motoboy', () => {
      const o1 = createTestOrder({ totalAmount: 40.0 });
      const o2 = createTestOrder({ totalAmount: 60.0 });

      const created = service.createDispatch({
        storeId,
        courierId,
        orderIds: [o1, o2],
      });

      const found = service.getDispatchById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.dispatchNumber).toBe(created.dispatchNumber);
      expect(found?.orders).toHaveLength(2);
      expect(found?.courier?.name).toBe('Carlos Motoboy');
    });

    it('deve buscar romaneio por número ROM-YYYYMM-XXXX', () => {
      const o1 = createTestOrder();
      const created = service.createDispatch({
        storeId,
        courierId,
        orderIds: [o1],
      });

      const found = service.getDispatchByNumber(created.dispatchNumber);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it('deve listar romaneios aplicando filtros por storeId, courierId e status', () => {
      const o1 = createTestOrder();
      const d1 = service.createDispatch({
        storeId,
        courierId,
        orderIds: [o1],
      });

      // Liquida d1
      service.settleDispatch(d1.id, {
        orders: [{ orderId: o1, delivered: true }],
        collectedCash: 0,
      });

      // Cria segundo despacho em aberto
      db.prepare('UPDATE couriers SET status = ? WHERE id = ?').run('AVAILABLE', courierId);
      const o2 = createTestOrder();
      const d2 = service.createDispatch({
        storeId,
        courierId,
        orderIds: [o2],
      });

      // Filtra por status OPEN
      const openDispatches = service.listDispatches({ status: 'OPEN' });
      expect(openDispatches.dispatches.some((d) => d.id === d2.id)).toBe(true);
      expect(openDispatches.dispatches.some((d) => d.id === d1.id)).toBe(false);

      // Filtra por status SETTLED
      const settledDispatches = service.listDispatches({ status: 'SETTLED' });
      expect(settledDispatches.dispatches.some((d) => d.id === d1.id)).toBe(true);
      expect(settledDispatches.dispatches.some((d) => d.id === d2.id)).toBe(false);

      // Filtra por courierId
      const courierDispatches = service.listDispatches({ courierId });
      expect(courierDispatches.dispatches.length).toBeGreaterThanOrEqual(2);
    });
  });
});
