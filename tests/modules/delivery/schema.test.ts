import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import type {
  CourierVehicleType,
  CourierStatus,
  DeliveryOrderStatus,
  DeliveryPaymentMethod,
  DispatchStatus,
  DeliveryZone,
  Courier,
  DeliveryOrder,
  DeliveryOrderItem,
  DeliveryDispatch,
  DeliveryDispatchWithOrders,
  CreateDeliveryZoneInput,
  CreateCourierInput,
  CreateDeliveryOrderInput,
  SettleDispatchParams,
  SettlementResult,
} from '../../../src/modules/delivery/types';

describe('Schema 012 - Delivery Farmacêutico, Entregadores e Romaneios de Despacho', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('should run all migrations including 012 cleanly and create all 5 delivery tables', () => {
    runMigrations(db);

    const tables = db
      .prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('delivery_zones', 'couriers', 'delivery_orders', 'delivery_order_items', 'delivery_dispatches')"
      )
      .all();

    const tableNames = tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([
      'couriers',
      'delivery_dispatches',
      'delivery_order_items',
      'delivery_orders',
      'delivery_zones',
    ]);
  });

  it('should create the 6 performance indexes', () => {
    runMigrations(db);

    const indexes = db
      .prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND (name LIKE 'idx_delivery%')"
      )
      .all();

    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain('idx_delivery_orders_status');
    expect(indexNames).toContain('idx_delivery_orders_customer');
    expect(indexNames).toContain('idx_delivery_orders_courier');
    expect(indexNames).toContain('idx_delivery_orders_dispatch');
    expect(indexNames).toContain('idx_delivery_dispatches_courier');
    expect(indexNames).toContain('idx_delivery_zones_neighborhood');
  });

  it('should seed default delivery zones (INSERT OR IGNORE)', () => {
    runMigrations(db);

    const zones = db
      .prepare<DeliveryZone>('SELECT * FROM delivery_zones ORDER BY id ASC')
      .all();

    expect(zones.length).toBeGreaterThanOrEqual(1);

    const centro = zones.find((z) => z.neighborhood === 'Centro');
    expect(centro).toBeDefined();
    expect(centro?.name).toBeDefined();
    expect(Number(centro?.delivery_fee ?? centro?.deliveryFee)).toBeGreaterThanOrEqual(0);
  });

  it('should enforce unique cpf and valid vehicle_type and status on couriers', () => {
    runMigrations(db);

    // Insert valid courier
    const courierStmt = db.prepare(`
      INSERT INTO couriers (name, cpf, phone, vehicle_type, vehicle_plate, cnh, commission_per_delivery, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    courierStmt.run(
      'Carlos Eduardo Motoboy',
      '123.456.789-00',
      '(11) 98888-7777',
      'MOTO',
      'ABC1D23',
      '12345678900',
      3.5,
      'AVAILABLE'
    );

    // Duplicate CPF must fail
    expect(() => {
      courierStmt.run(
        'Outro Carlos',
        '123.456.789-00',
        '(11) 97777-6666',
        'MOTO',
        'XYZ9A87',
        '98765432100',
        3.5,
        'AVAILABLE'
      );
    }).toThrow();

    // Valid vehicle types: MOTO, BIKE, CAR, WALK
    const validVehicles: CourierVehicleType[] = ['MOTO', 'BIKE', 'CAR', 'WALK'];
    validVehicles.forEach((v, idx) => {
      expect(() => {
        courierStmt.run(
          `Courier ${v}`,
          `000.000.00${idx}-11`,
          '(11) 91111-2222',
          v,
          null,
          null,
          3.0,
          'AVAILABLE'
        );
      }).not.toThrow();
    });

    // Invalid vehicle type
    expect(() => {
      courierStmt.run(
        'Invalid Vehicle',
        '999.888.777-66',
        '(11) 90000-0000',
        'HELICOPTER',
        null,
        null,
        5.0,
        'AVAILABLE'
      );
    }).toThrow();

    // Valid statuses: AVAILABLE, ON_DELIVERY, INACTIVE
    const validStatuses: CourierStatus[] = ['AVAILABLE', 'ON_DELIVERY', 'INACTIVE'];
    validStatuses.forEach((st, idx) => {
      expect(() => {
        courierStmt.run(
          `Courier Status ${st}`,
          `111.111.11${idx}-22`,
          '(11) 92222-3333',
          'MOTO',
          null,
          null,
          3.0,
          st
        );
      }).not.toThrow();
    });

    // Invalid courier status
    expect(() => {
      courierStmt.run(
        'Invalid Status',
        '888.777.666-55',
        '(11) 93333-4444',
        'MOTO',
        null,
        null,
        3.0,
        'VACATION'
      );
    }).toThrow();
  });

  it('should enforce unique order_number, status, payment_method on delivery_orders', () => {
    runMigrations(db);

    const orderStmt = db.prepare(`
      INSERT INTO delivery_orders (
        order_number, store_id, customer_name, customer_phone,
        street, number, neighborhood, city, state,
        subtotal_amount, delivery_fee, total_amount, payment_method, status
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, 'SP', ?, ?, ?, ?, ?)
    `);

    orderStmt.run(
      'DEL-202611-0001',
      'Maria das Dores',
      '(11) 95555-4444',
      'Rua das Flores',
      '123',
      'Centro',
      'São Paulo',
      50.0,
      5.0,
      55.0,
      'PIX',
      'RECEIVED'
    );

    // Duplicate order_number must fail
    expect(() => {
      orderStmt.run(
        'DEL-202611-0001',
        'Outro Cliente',
        '(11) 94444-3333',
        'Rua das Palmeiras',
        '456',
        'Centro',
        'São Paulo',
        30.0,
        5.0,
        35.0,
        'DINHEIRO',
        'RECEIVED'
      );
    }).toThrow();

    // Valid order statuses: RECEIVED, PREPARING, READY_FOR_PICKUP, DISPATCHED, DELIVERED, RETURNED, CANCELLED
    const validStatuses: DeliveryOrderStatus[] = [
      'RECEIVED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'DISPATCHED',
      'DELIVERED',
      'RETURNED',
      'CANCELLED',
    ];

    validStatuses.forEach((st, idx) => {
      expect(() => {
        orderStmt.run(
          `DEL-202611-001${idx}`,
          `Cliente ${st}`,
          '(11) 90000-0001',
          'Rua Teste',
          '10',
          'Centro',
          'São Paulo',
          20.0,
          0.0,
          20.0,
          'PIX',
          st
        );
      }).not.toThrow();
    });

    // Invalid order status
    expect(() => {
      orderStmt.run(
        'DEL-202611-9999',
        'Cliente Invalido',
        '(11) 90000-0000',
        'Rua Teste',
        '10',
        'Centro',
        'São Paulo',
        20.0,
        0.0,
        20.0,
        'PIX',
        'LOST_IN_TRANSIT'
      );
    }).toThrow();

    // Valid payment methods: DINHEIRO, CARTAO_CREDITO, CARTAO_DEBITO, PIX, CONVENIO, CREDIARIO
    const validPayments: DeliveryPaymentMethod[] = [
      'DINHEIRO',
      'CARTAO_CREDITO',
      'CARTAO_DEBITO',
      'PIX',
      'CONVENIO',
      'CREDIARIO',
    ];

    validPayments.forEach((pm, idx) => {
      expect(() => {
        orderStmt.run(
          `DEL-202611-002${idx}`,
          `Cliente Pay ${pm}`,
          '(11) 90000-0002',
          'Rua Teste',
          '20',
          'Centro',
          'São Paulo',
          30.0,
          0.0,
          30.0,
          pm,
          'RECEIVED'
        );
      }).not.toThrow();
    });

    // Invalid payment method
    expect(() => {
      orderStmt.run(
        'DEL-202611-8888',
        'Cliente Cheque',
        '(11) 90000-0000',
        'Rua Teste',
        '10',
        'Centro',
        'São Paulo',
        20.0,
        0.0,
        20.0,
        'BITCOIN',
        'RECEIVED'
      );
    }).toThrow();
  });

  it('should enforce cascade deletion on delivery_order_items when order is deleted', () => {
    runMigrations(db);

    // Insert product
    const prodRes = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7891234567890', 'Dipirona 500mg', 'Dipirona', '1.0001.0001.001-1', 'SEM_TARJA', 'LIBERADO', 15.0, 8.0, 10.0)
    `).run();
    const productId = Number(prodRes.lastInsertRowid);

    // Insert order
    const orderRes = db.prepare(`
      INSERT INTO delivery_orders (
        order_number, store_id, customer_name, customer_phone,
        street, number, neighborhood, city, state,
        subtotal_amount, delivery_fee, total_amount, payment_method, status
      ) VALUES ('DEL-202611-CASCADE', 1, 'Joao Silva', '(11) 91111-2222', 'Rua A', '1', 'Bairro B', 'Cidade C', 'SP', 40.0, 5.0, 45.0, 'PIX', 'RECEIVED')
    `).run();
    const orderId = Number(orderRes.lastInsertRowid);

    // Insert order items
    const itemStmt = db.prepare(`
      INSERT INTO delivery_order_items (
        delivery_order_id, product_id, product_name, quantity, unit_price, total_price
      ) VALUES (?, ?, 'Dipirona 500mg', 2, 10.0, 20.0)
    `);
    itemStmt.run(orderId, productId);
    itemStmt.run(orderId, productId);

    const countBefore = db
      .prepare<{ count: number }>(
        'SELECT COUNT(*) as count FROM delivery_order_items WHERE delivery_order_id = ?'
      )
      .get(orderId)?.count;
    expect(countBefore).toBe(2);

    // Delete order
    db.prepare('DELETE FROM delivery_orders WHERE id = ?').run(orderId);

    // Items must be cascade deleted
    const countAfter = db
      .prepare<{ count: number }>(
        'SELECT COUNT(*) as count FROM delivery_order_items WHERE delivery_order_id = ?'
      )
      .get(orderId)?.count;
    expect(countAfter).toBe(0);
  });

  it('should enforce unique dispatch_number and valid status on delivery_dispatches', () => {
    runMigrations(db);

    // Create courier
    const courierRes = db.prepare(`
      INSERT INTO couriers (name, cpf, phone, vehicle_type, status)
      VALUES ('Motoboy Romaneio', '555.666.777-88', '(11) 97777-8888', 'MOTO', 'AVAILABLE')
    `).run();
    const courierId = Number(courierRes.lastInsertRowid);

    const dispatchStmt = db.prepare(`
      INSERT INTO delivery_dispatches (
        dispatch_number, store_id, courier_id, total_orders, total_amount, status
      ) VALUES (?, 1, ?, 3, 120.0, ?)
    `);

    dispatchStmt.run('ROM-202611-0001', courierId, 'OPEN');

    // Duplicate dispatch_number must fail
    expect(() => {
      dispatchStmt.run('ROM-202611-0001', courierId, 'OPEN');
    }).toThrow();

    // Valid statuses: OPEN, SETTLED, CANCELLED
    const validStatuses: DispatchStatus[] = ['OPEN', 'SETTLED', 'CANCELLED'];
    validStatuses.forEach((st, idx) => {
      expect(() => {
        dispatchStmt.run(`ROM-202611-001${idx}`, courierId, st);
      }).not.toThrow();
    });

    // Invalid dispatch status
    expect(() => {
      dispatchStmt.run('ROM-202611-9999', courierId, 'IN_PROGRESS');
    }).toThrow();
  });

  it('should validate TypeScript domain types definitions', () => {
    const zone: DeliveryZone = {
      id: 1,
      storeId: 1,
      name: 'Centro',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      deliveryFee: 5.0,
      estimatedMinutes: 30,
      freeShippingThreshold: 50.0,
      isActive: true,
    };
    expect(zone.neighborhood).toBe('Centro');

    const courier: Courier = {
      id: 1,
      storeId: 1,
      name: 'Marcos Motoboy',
      cpf: '123.456.789-00',
      phone: '(11) 99999-9999',
      vehicleType: 'MOTO',
      commissionPerDelivery: 4.0,
      dailyAllowance: 20.0,
      status: 'AVAILABLE',
      isActive: true,
    };
    expect(courier.vehicleType).toBe('MOTO');

    const orderItem: DeliveryOrderItem = {
      id: 1,
      deliveryOrderId: 10,
      productId: 1,
      productName: 'Paracetamol 750mg',
      quantity: 2,
      unitPrice: 12.5,
      totalPrice: 25.0,
    };
    expect(orderItem.quantity).toBe(2);

    const order: DeliveryOrder = {
      id: 10,
      orderNumber: 'DEL-202611-0001',
      storeId: 1,
      customerName: 'Ana Souza',
      customerPhone: '(11) 98888-1111',
      street: 'Av Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      subtotalAmount: 25.0,
      deliveryFee: 5.0,
      discountAmount: 0,
      totalAmount: 30.0,
      paymentMethod: 'PIX',
      status: 'RECEIVED',
      receivedAt: new Date().toISOString(),
      items: [orderItem],
    };
    expect(order.orderNumber).toBe('DEL-202611-0001');

    const dispatch: DeliveryDispatch = {
      id: 1,
      dispatchNumber: 'ROM-202611-0001',
      storeId: 1,
      courierId: 1,
      totalOrders: 1,
      totalAmount: 30.0,
      totalChangeProvided: 0,
      collectedCash: 0,
      collectedCard: 0,
      collectedPix: 30.0,
      totalCommission: 4.0,
      status: 'OPEN',
      dispatchedAt: new Date().toISOString(),
    };
    expect(dispatch.status).toBe('OPEN');

    const dispatchWithOrders: DeliveryDispatchWithOrders = {
      ...dispatch,
      orders: [order],
      courier,
    };
    expect(dispatchWithOrders.orders).toHaveLength(1);

    const settleParams: SettleDispatchParams = {
      orders: [{ orderId: 10, delivered: true }],
      collectedPix: 30.0,
    };
    expect(settleParams.orders[0].delivered).toBe(true);

    const settlementResult: SettlementResult = {
      dispatch: { ...dispatch, status: 'SETTLED' },
      totalDelivered: 1,
      totalReturned: 0,
      collectedCash: 0,
      collectedCard: 0,
      collectedPix: 30.0,
      commissionEarned: 24.0,
    };
    expect(settlementResult.totalDelivered).toBe(1);
  });
});
