import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';
import { CourierService } from '../../src/modules/delivery/courier.service';
import { DeliveryOrderService } from '../../src/modules/delivery/delivery-order.service';
import { DeliverySettlementService } from '../../src/modules/delivery/delivery-settlement.service';

describe('Delivery REST API Routes (/api/delivery/*)', () => {
  let app: FastifyInstance;
  let db: Database;
  let courierService: CourierService;
  let orderService: DeliveryOrderService;
  let settlementService: DeliverySettlementService;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    courierService = new CourierService(db);
    orderService = new DeliveryOrderService(db);
    settlementService = new DeliverySettlementService(db);

    // Setup base products and batches
    db.prepare(`
      INSERT OR IGNORE INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
      VALUES (101, '7891010101010', 'Dipirona 500mg 10cp', 'Dipirona Sódica', '1.0001.0001.001-1', 'SEM_TARJA', 'LIBERADO', 12.0, 8.0, 10.0, 1),
             (102, '7892020202020', 'Amoxicilina 500mg 21cps', 'Amoxicilina Tri-hidratada', '1.0002.0002.002-2', 'VERMELHA', 'ANTIBIOTICO', 45.0, 30.0, 35.0, 1)
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO batches (id, product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (201, 101, 'LOTE-DIP-01', '2025-01-01', '2027-01-01', 100, 1),
             (202, 102, 'LOTE-AMX-01', '2025-02-01', '2026-08-01', 50, 1)
    `).run();

    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  // =========================================================================
  // 1. ROTAS DE ENTREGADORES (/api/delivery/couriers)
  // =========================================================================
  describe('Couriers Routes', () => {
    it('GET /api/delivery/couriers should return 200 and list couriers', async () => {
      courierService.createCourier({
        name: 'Motoboy Teste',
        cpf: '111.222.333-44',
        phone: '(11) 98765-4321',
        vehicleType: 'MOTO',
        commissionPerDelivery: 5.0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/delivery/couriers',
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((c: any) => c.cpf === '111.222.333-44')).toBe(true);
    });

    it('POST /api/delivery/couriers should return 201 on success and 400 on validation failure', async () => {
      const validPayload = {
        name: 'Lucas Entrega',
        cpf: '222.333.444-55',
        phone: '(11) 91234-5678',
        vehicleType: 'BIKE',
        commissionPerDelivery: 4.0,
      };

      const resOk = await app.inject({
        method: 'POST',
        url: '/api/delivery/couriers',
        payload: validPayload,
      });

      expect(resOk.statusCode).toBe(201);
      const created = resOk.json();
      expect(created.name).toBe('Lucas Entrega');
      expect(created.id).toBeDefined();

      // Falha validação Zod (sem nome e cpf)
      const resBad = await app.inject({
        method: 'POST',
        url: '/api/delivery/couriers',
        payload: { phone: '123' },
      });
      expect(resBad.statusCode).toBe(400);
    });

    it('POST /api/delivery/couriers should return 409 on duplicate CPF', async () => {
      courierService.createCourier({
        name: 'Entregador 1',
        cpf: '999.888.777-66',
        phone: '(11) 90000-1111',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/delivery/couriers',
        payload: {
          name: 'Entregador 2',
          cpf: '999.888.777-66',
          phone: '(11) 90000-2222',
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it('GET /api/delivery/couriers/:id should return 200 or 404', async () => {
      const courier = courierService.createCourier({
        name: 'Rodrigo Motoboy',
        cpf: '333.444.555-66',
        phone: '(11) 98888-0000',
      });

      const resFound = await app.inject({
        method: 'GET',
        url: `/api/delivery/couriers/${courier.id}`,
      });
      expect(resFound.statusCode).toBe(200);
      expect(resFound.json().id).toBe(courier.id);

      const resNotFound = await app.inject({
        method: 'GET',
        url: '/api/delivery/couriers/9999',
      });
      expect(resNotFound.statusCode).toBe(404);
    });

    it('PUT /api/delivery/couriers/:id should update and return 200 or 404', async () => {
      const courier = courierService.createCourier({
        name: 'Antigo Nome',
        cpf: '444.555.666-77',
        phone: '(11) 97777-0000',
      });

      const resUpdate = await app.inject({
        method: 'PUT',
        url: `/api/delivery/couriers/${courier.id}`,
        payload: {
          name: 'Nome Atualizado',
          commissionPerDelivery: 6.5,
        },
      });
      expect(resUpdate.statusCode).toBe(200);
      expect(resUpdate.json().name).toBe('Nome Atualizado');

      const resNotFound = await app.inject({
        method: 'PUT',
        url: '/api/delivery/couriers/9999',
        payload: { name: 'Inexistente' },
      });
      expect(resNotFound.statusCode).toBe(404);
    });

    it('PATCH /api/delivery/couriers/:id/status should update status and return 200', async () => {
      const courier = courierService.createCourier({
        name: 'Status Teste',
        cpf: '555.666.777-88',
        phone: '(11) 96666-0000',
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/delivery/couriers/${courier.id}/status`,
        payload: { status: 'ON_DELIVERY' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('ON_DELIVERY');
    });
  });

  // =========================================================================
  // 2. ROTAS DE ZONAS DE ENTREGA (/api/delivery/zones)
  // =========================================================================
  describe('Delivery Zones Routes', () => {
    it('GET /api/delivery/zones should return 200 with zones list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/delivery/zones',
      });
      expect(response.statusCode).toBe(200);
      const zones = response.json();
      expect(Array.isArray(zones)).toBe(true);
      expect(zones.length).toBeGreaterThan(0); // seed tem zonas padrão
    });

    it('POST /api/delivery/zones should create a new zone (201) or return 400 on error', async () => {
      const resCreate = await app.inject({
        method: 'POST',
        url: '/api/delivery/zones',
        payload: {
          name: 'Zona Moema',
          neighborhood: 'Moema',
          city: 'São Paulo',
          state: 'SP',
          deliveryFee: 10.0,
          estimatedMinutes: 45,
          freeShippingThreshold: 100.0,
        },
      });
      expect(resCreate.statusCode).toBe(201);
      const zone = resCreate.json();
      expect(zone.neighborhood).toBe('Moema');

      const resBad = await app.inject({
        method: 'POST',
        url: '/api/delivery/zones',
        payload: { name: 'Sem Bairro' },
      });
      expect(resBad.statusCode).toBe(400);
    });

    it('PUT /api/delivery/zones/:id should update and return 200 or 404', async () => {
      const zone = courierService.createDeliveryZone({
        name: 'Vila Mariana',
        neighborhood: 'Vila Mariana',
        city: 'São Paulo',
        deliveryFee: 8.0,
      });

      const resUpdate = await app.inject({
        method: 'PUT',
        url: `/api/delivery/zones/${zone.id}`,
        payload: { deliveryFee: 9.5 },
      });
      expect(resUpdate.statusCode).toBe(200);
      expect(resUpdate.json().deliveryFee).toBe(9.5);

      const resNotFound = await app.inject({
        method: 'PUT',
        url: '/api/delivery/zones/9999',
        payload: { deliveryFee: 12.0 },
      });
      expect(resNotFound.statusCode).toBe(404);
    });

    it('DELETE /api/delivery/zones/:id should delete and return 200 or 404', async () => {
      const zone = courierService.createDeliveryZone({
        name: 'Zona Para Deletar',
        neighborhood: 'Bairro Temp',
        city: 'São Paulo',
        deliveryFee: 5.0,
      });

      const resDel = await app.inject({
        method: 'DELETE',
        url: `/api/delivery/zones/${zone.id}`,
      });
      expect(resDel.statusCode).toBe(200);

      const resNotFound = await app.inject({
        method: 'DELETE',
        url: '/api/delivery/zones/9999',
      });
      expect(resNotFound.statusCode).toBe(404);
    });

    it('POST /api/delivery/zones/calculate-fee should calculate delivery fee and free shipping', async () => {
      courierService.createDeliveryZone({
        name: 'Zona Cálculo',
        neighborhood: 'Tatuapé',
        city: 'São Paulo',
        deliveryFee: 12.0,
        freeShippingThreshold: 80.0,
      });

      // Abaixo do limite de frete grátis
      const resFee = await app.inject({
        method: 'POST',
        url: '/api/delivery/zones/calculate-fee',
        payload: {
          neighborhood: 'Tatuapé',
          city: 'São Paulo',
          subtotalAmount: 50.0,
        },
      });
      expect(resFee.statusCode).toBe(200);
      const dataFee = resFee.json();
      expect(dataFee.deliveryFee).toBe(12.0);
      expect(dataFee.isFreeShipping).toBe(false);

      // Acima do limite de frete grátis
      const resFree = await app.inject({
        method: 'POST',
        url: '/api/delivery/zones/calculate-fee',
        payload: {
          neighborhood: 'Tatuapé',
          city: 'São Paulo',
          subtotalAmount: 95.0,
        },
      });
      expect(resFree.statusCode).toBe(200);
      const dataFree = resFree.json();
      expect(dataFree.deliveryFee).toBe(0);
      expect(dataFree.isFreeShipping).toBe(true);
    });
  });

  // =========================================================================
  // 3. ROTAS DE PEDIDOS DE TELE-ENTREGA (/api/delivery/orders)
  // =========================================================================
  describe('Delivery Orders Routes', () => {
    it('GET /api/delivery/orders should list orders with filters', async () => {
      orderService.createDeliveryOrder({
        storeId: 1,
        customerName: 'Cliente Lista',
        customerPhone: '(11) 98888-1234',
        street: 'Rua das Palmeiras',
        number: '10',
        neighborhood: 'Centro',
        city: 'São Paulo',
        paymentMethod: 'DINHEIRO',
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg 10cp',
            quantity: 2,
            unitPrice: 10.0,
          },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/delivery/orders?status=RECEIVED',
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.orders).toBeDefined();
      expect(body.orders.length).toBeGreaterThan(0);
      expect(body.orders[0].customerName).toBe('Cliente Lista');
    });

    it('POST /api/delivery/orders should create order (201) or fail on validation (400)', async () => {
      const validOrder = {
        storeId: 1,
        customerName: 'Fernando Rocha',
        customerPhone: '(11) 97777-6666',
        street: 'Rua Vergueiro',
        number: '2000',
        neighborhood: 'Vila Mariana',
        city: 'São Paulo',
        paymentMethod: 'PIX',
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg 10cp',
            quantity: 1,
            unitPrice: 10.0,
          },
        ],
      };

      const resOk = await app.inject({
        method: 'POST',
        url: '/api/delivery/orders',
        payload: validOrder,
      });
      expect(resOk.statusCode).toBe(201);
      const created = resOk.json();
      expect(created.orderNumber).toMatch(/^DEL-\d{6}-\d{4}$/);
      expect(created.status).toBe('RECEIVED');

      // 400 sem itens
      const resBad = await app.inject({
        method: 'POST',
        url: '/api/delivery/orders',
        payload: {
          ...validOrder,
          items: [],
        },
      });
      expect(resBad.statusCode).toBe(400);
    });

    it('GET /api/delivery/orders/:id should return 200 or 404', async () => {
      const order = orderService.createDeliveryOrder({
        storeId: 1,
        customerName: 'Cliente Get',
        customerPhone: '(11) 91111-3333',
        street: 'Rua A',
        number: '1',
        neighborhood: 'Centro',
        city: 'São Paulo',
        paymentMethod: 'CARTAO_CREDITO',
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg 10cp',
            quantity: 1,
            unitPrice: 10.0,
          },
        ],
      });

      const resFound = await app.inject({
        method: 'GET',
        url: `/api/delivery/orders/${order.id}`,
      });
      expect(resFound.statusCode).toBe(200);
      expect(resFound.json().id).toBe(order.id);

      const resNotFound = await app.inject({
        method: 'GET',
        url: '/api/delivery/orders/9999',
      });
      expect(resNotFound.statusCode).toBe(404);
    });

    it('PATCH /api/delivery/orders/:id/status should update status (200) or fail on invalid transition (400)', async () => {
      const order = orderService.createDeliveryOrder({
        storeId: 1,
        customerName: 'Transição Status',
        customerPhone: '(11) 92222-4444',
        street: 'Rua B',
        number: '2',
        neighborhood: 'Centro',
        city: 'São Paulo',
        paymentMethod: 'PIX',
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg 10cp',
            quantity: 1,
            unitPrice: 10.0,
          },
        ],
      });

      // Transição válida: RECEIVED -> PREPARING
      const resOk = await app.inject({
        method: 'PATCH',
        url: `/api/delivery/orders/${order.id}/status`,
        payload: { status: 'PREPARING' },
      });
      expect(resOk.statusCode).toBe(200);
      expect(resOk.json().status).toBe('PREPARING');

      // Transição inválida: PREPARING -> DELIVERED (deve ir para READY_FOR_PICKUP antes)
      const resBad = await app.inject({
        method: 'PATCH',
        url: `/api/delivery/orders/${order.id}/status`,
        payload: { status: 'DELIVERED' },
      });
      expect(resBad.statusCode).toBe(400);
    });

    it('POST /api/delivery/orders/:id/cancel should cancel order with reason (200) or fail (400)', async () => {
      const order = orderService.createDeliveryOrder({
        storeId: 1,
        customerName: 'Cliente Cancela',
        customerPhone: '(11) 93333-5555',
        street: 'Rua C',
        number: '3',
        neighborhood: 'Centro',
        city: 'São Paulo',
        paymentMethod: 'DINHEIRO',
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg 10cp',
            quantity: 1,
            unitPrice: 10.0,
          },
        ],
      });

      // Falha se motivo não for informado
      const resNoReason = await app.inject({
        method: 'POST',
        url: `/api/delivery/orders/${order.id}/cancel`,
        payload: {},
      });
      expect(resNoReason.statusCode).toBe(400);

      // Sucesso com motivo
      const resOk = await app.inject({
        method: 'POST',
        url: `/api/delivery/orders/${order.id}/cancel`,
        payload: { reason: 'Cliente desistiu da compra' },
      });
      expect(resOk.statusCode).toBe(200);
      expect(resOk.json().status).toBe('CANCELLED');
      expect(resOk.json().cancellationReason).toBe('Cliente desistiu da compra');
    });

    it('GET /api/delivery/orders/:id/slip should return thermal ESC/POS order package slip (200 or 404)', async () => {
      const order = orderService.createDeliveryOrder({
        storeId: 1,
        customerName: 'Marina Slip',
        customerPhone: '(11) 94444-6666',
        customerCpf: '123.456.789-99',
        street: 'Rua da Consolação',
        number: '800',
        neighborhood: 'Consolação',
        city: 'São Paulo',
        state: 'SP',
        referencePoint: 'Ao lado do banco',
        paymentMethod: 'DINHEIRO',
        changeFor: 50.0,
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg 10cp',
            quantity: 2,
            unitPrice: 10.0,
            batchNumber: 'LOTE-DIP-01',
          },
        ],
      });

      const resSlip = await app.inject({
        method: 'GET',
        url: `/api/delivery/orders/${order.id}/slip`,
      });
      expect(resSlip.statusCode).toBe(200);
      const slipData = resSlip.json();
      expect(slipData.textReceipt).toBeDefined();
      expect(slipData.fullEscPos).toBeDefined();
      expect(slipData.textReceipt).toContain('TELE-ENTREGA - ETIQUETA DE PACOTE');
      expect(slipData.textReceipt).toContain('Marina Slip');
      expect(slipData.textReceipt).toContain('Ao lado do banco');

      const resNotFound = await app.inject({
        method: 'GET',
        url: '/api/delivery/orders/9999/slip',
      });
      expect(resNotFound.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // 4. ROTAS DE ROMANEIOS E ACERTO NO CAIXA (/api/delivery/dispatches)
  // =========================================================================
  describe('Delivery Dispatches and Settlement Routes', () => {
    let courierId: number;
    let orderId1: number;
    let orderId2: number;

    beforeEach(() => {
      const courier = courierService.createCourier({
        name: 'Motoboy Despacho',
        cpf: '777.888.999-00',
        phone: '(11) 91111-0000',
        vehicleType: 'MOTO',
        commissionPerDelivery: 5.0,
      });
      courierId = courier.id;

      const order1 = orderService.createDeliveryOrder({
        storeId: 1,
        customerName: 'Entrega 1',
        customerPhone: '(11) 91111-1111',
        street: 'Rua Um',
        number: '1',
        neighborhood: 'Centro',
        city: 'São Paulo',
        paymentMethod: 'DINHEIRO',
        changeFor: 50.0,
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg 10cp',
            quantity: 1,
            unitPrice: 10.0,
          },
        ],
      });
      orderId1 = order1.id;

      const order2 = orderService.createDeliveryOrder({
        storeId: 1,
        customerName: 'Entrega 2',
        customerPhone: '(11) 92222-2222',
        street: 'Rua Dois',
        number: '2',
        neighborhood: 'Centro',
        city: 'São Paulo',
        paymentMethod: 'PIX',
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg 10cp',
            quantity: 2,
            unitPrice: 10.0,
          },
        ],
      });
      orderId2 = order2.id;

      // Avançar pedidos para READY_FOR_PICKUP
      orderService.updateOrderStatus(orderId1, { status: 'PREPARING' });
      orderService.updateOrderStatus(orderId1, { status: 'READY_FOR_PICKUP' });
      orderService.updateOrderStatus(orderId2, { status: 'PREPARING' });
      orderService.updateOrderStatus(orderId2, { status: 'READY_FOR_PICKUP' });
    });

    it('GET /api/delivery/dispatches should return 200 with list of dispatches', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/delivery/dispatches',
      });
      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.dispatches).toBeDefined();
    });

    it('POST /api/delivery/dispatches should create dispatch (201) with ROM-YYYYMM-XXXX', async () => {
      const resCreate = await app.inject({
        method: 'POST',
        url: '/api/delivery/dispatches',
        payload: {
          storeId: 1,
          courierId,
          orderIds: [orderId1, orderId2],
        },
      });

      expect(resCreate.statusCode).toBe(201);
      const created = resCreate.json();
      expect(created.dispatchNumber).toMatch(/^ROM-\d{6}-\d{4}$/);
      expect(created.status).toBe('OPEN');
      expect(created.totalOrders).toBe(2);

      // Validação de erro quando pedidos não existem ou faltam parâmetros
      const resBad = await app.inject({
        method: 'POST',
        url: '/api/delivery/dispatches',
        payload: {
          storeId: 1,
          courierId,
          orderIds: [9999],
        },
      });
      expect(resBad.statusCode).toBe(400);
    });

    it('GET /api/delivery/dispatches/:id should return dispatch details (200 or 404)', async () => {
      const dispatch = settlementService.createDispatch({
        storeId: 1,
        courierId,
        orderIds: [orderId1, orderId2],
      });

      const resFound = await app.inject({
        method: 'GET',
        url: `/api/delivery/dispatches/${dispatch.id}`,
      });
      expect(resFound.statusCode).toBe(200);
      const data = resFound.json();
      expect(data.id).toBe(dispatch.id);
      expect(data.orders).toBeDefined();
      expect(data.orders.length).toBe(2);

      const resNotFound = await app.inject({
        method: 'GET',
        url: '/api/delivery/dispatches/9999',
      });
      expect(resNotFound.statusCode).toBe(404);
    });

    it('GET /api/delivery/dispatches/:id/slip should return ESC/POS dispatch slip (200 or 404)', async () => {
      const dispatch = settlementService.createDispatch({
        storeId: 1,
        courierId,
        orderIds: [orderId1, orderId2],
      });

      const resSlip = await app.inject({
        method: 'GET',
        url: `/api/delivery/dispatches/${dispatch.id}/slip`,
      });
      expect(resSlip.statusCode).toBe(200);
      const slip = resSlip.json();
      expect(slip.textReceipt).toBeDefined();
      expect(slip.fullEscPos).toBeDefined();
      expect(slip.textReceipt).toContain('ROMANEIO DE DESPACHO / TELE-ENTREGA');
      expect(slip.textReceipt).toContain(dispatch.dispatchNumber);
      expect(slip.textReceipt).toContain('Motoboy Despacho');

      const resNotFound = await app.inject({
        method: 'GET',
        url: '/api/delivery/dispatches/9999/slip',
      });
      expect(resNotFound.statusCode).toBe(404);
    });

    it('POST /api/delivery/dispatches/:id/settle should settle dispatch and generate receipt (200)', async () => {
      const dispatch = settlementService.createDispatch({
        storeId: 1,
        courierId,
        orderIds: [orderId1, orderId2],
      });

      const settlePayload = {
        orders: [
          { orderId: orderId1, delivered: true },
          { orderId: orderId2, delivered: true },
        ],
        collectedCash: 15.0,
        collectedPix: 25.0,
        operatorName: 'Operador Caixa',
      };

      const resSettle = await app.inject({
        method: 'POST',
        url: `/api/delivery/dispatches/${dispatch.id}/settle`,
        payload: settlePayload,
      });

      expect(resSettle.statusCode).toBe(200);
      const result = resSettle.json();
      expect(result.dispatch.status).toBe('SETTLED');
      expect(result.totalDelivered).toBe(2);
      expect(result.receiptText).toBeDefined();

      // Repetir acerto no mesmo romaneio deve retornar 400
      const resAgain = await app.inject({
        method: 'POST',
        url: `/api/delivery/dispatches/${dispatch.id}/settle`,
        payload: settlePayload,
      });
      expect(resAgain.statusCode).toBe(400);
    });
  });
});
