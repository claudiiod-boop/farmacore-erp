import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import {
  DeliveryOrderService,
  DeliveryError,
} from '../../../src/modules/delivery/delivery-order.service';
import type {
  CreateDeliveryOrderInput,
  DeliveryOrderStatus,
} from '../../../src/modules/delivery/types';

describe('DeliveryOrderService — Gestão de Pedidos de Tele-Entrega e Máquina de Estados', () => {
  let db: Database;
  let service: DeliveryOrderService;
  let defaultStoreId = 1;
  let defaultCourierId = 1;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new DeliveryOrderService(db);

    // Setup a sample product and batch if not existing
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

    // Setup sample courier
    const courierRes = db.prepare(`
      INSERT OR IGNORE INTO couriers (id, store_id, name, cpf, phone, vehicle_type, vehicle_plate, cnh, commission_per_delivery, daily_allowance, status, is_active)
      VALUES (1, 1, 'Marcos Entregador', '111.222.333-44', '(11) 99999-1111', 'MOTO', 'BRA2E19', '12345678900', 4.5, 20.0, 'AVAILABLE', 1)
    `).run();
    if (courierRes.lastInsertRowid) {
      defaultCourierId = Number(courierRes.lastInsertRowid);
    }
  });

  afterEach(() => {
    db.close();
  });

  describe('createDeliveryOrder', () => {
    it('deve criar pedido com numeração sequencial automática DEL-YYYYMM-XXXX', () => {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const expectedPrefix = `DEL-${yearMonth}-`;

      const input1: CreateDeliveryOrderInput = {
        storeId: defaultStoreId,
        customerName: 'Maria Silva',
        customerPhone: '(11) 98765-4321',
        customerCpf: '123.456.789-01',
        street: 'Rua das Flores',
        number: '123',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        paymentMethod: 'PIX',
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg 10cp',
            quantity: 2,
            unitPrice: 10.0,
            batchId: 201,
            batchNumber: 'LOTE-DIP-01',
          },
        ],
      };

      const order1 = service.createDeliveryOrder(input1);
      expect(order1.id).toBeDefined();
      expect(order1.orderNumber).toMatch(new RegExp(`^${expectedPrefix}\\d{4}$`));
      expect(order1.orderNumber.endsWith('0001')).toBe(true);

      const input2: CreateDeliveryOrderInput = {
        ...input1,
        customerName: 'João Santos',
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg 10cp',
            quantity: 1,
            unitPrice: 10.0,
          },
        ],
      };

      const order2 = service.createDeliveryOrder(input2);
      expect(order2.orderNumber).toMatch(new RegExp(`^${expectedPrefix}\\d{4}$`));
      expect(order2.orderNumber.endsWith('0002')).toBe(true);
    });

    it('deve calcular taxa de entrega automática buscando zona por bairro e cidade', () => {
      // Zona seeded: 'Centro', 'São Paulo' -> taxa 5.0, threshold frete grátis 50.0
      const input: CreateDeliveryOrderInput = {
        storeId: defaultStoreId,
        customerName: 'Carlos Souza',
        customerPhone: '(11) 97777-6666',
        street: 'Av Central',
        number: '50',
        neighborhood: 'Centro',
        city: 'São Paulo',
        paymentMethod: 'CARTAO_CREDITO',
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg 10cp',
            quantity: 2, // subtotal = 20.0 (< 50.0)
            unitPrice: 10.0,
          },
        ],
      };

      const order = service.createDeliveryOrder(input);
      expect(order.subtotalAmount).toBe(20.0);
      expect(order.deliveryFee).toBe(5.0);
      expect(order.totalAmount).toBe(25.0);
    });

    it('deve aplicar isenção de taxa de entrega (frete grátis) quando subtotal >= free_shipping_threshold', () => {
      // Centro threshold = 50.0. Vamos comprar 6 caixas de 10.0 = 60.0 >= 50.0
      const input: CreateDeliveryOrderInput = {
        storeId: defaultStoreId,
        customerName: 'Fernanda Lima',
        customerPhone: '(11) 96666-5555',
        street: 'Praça da Sé',
        number: '10',
        neighborhood: 'Centro',
        city: 'São Paulo',
        paymentMethod: 'PIX',
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg 10cp',
            quantity: 6,
            unitPrice: 10.0, // subtotal = 60.0
          },
        ],
      };

      const order = service.createDeliveryOrder(input);
      expect(order.subtotalAmount).toBe(60.0);
      expect(order.deliveryFee).toBe(0.0);
      expect(order.totalAmount).toBe(60.0);
    });

    it('deve validar troco se payment_method === DINHEIRO (lança INVALID_CHANGE_AMOUNT se change_for < total)', () => {
      const input: CreateDeliveryOrderInput = {
        storeId: defaultStoreId,
        customerName: 'Roberto Dias',
        customerPhone: '(11) 95555-4444',
        street: 'Rua Direita',
        number: '100',
        neighborhood: 'Centro',
        city: 'São Paulo',
        paymentMethod: 'DINHEIRO',
        changeFor: 20.0, // Subtotal 20 + taxa 5 = 25.0. Troco para 20 é menor que total!
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg',
            quantity: 2,
            unitPrice: 10.0,
          },
        ],
      };

      expect(() => service.createDeliveryOrder(input)).toThrow(DeliveryError);
      try {
        service.createDeliveryOrder(input);
      } catch (err: any) {
        expect(err.code).toBe('INVALID_CHANGE_AMOUNT');
      }

      // Com troco válido (R$ 50.0 >= R$ 25.0)
      const validOrder = service.createDeliveryOrder({
        ...input,
        changeFor: 50.0,
      });
      expect(validOrder.id).toBeDefined();
      expect(validOrder.changeFor).toBe(50.0);
    });

    it('deve validar loja ativa lançando STORE_NOT_FOUND ou STORE_INACTIVE', () => {
      const baseInput: CreateDeliveryOrderInput = {
        storeId: 99999, // Inexistente
        customerName: 'Cliente Teste',
        customerPhone: '(11) 94444-3333',
        street: 'Rua A',
        number: '1',
        neighborhood: 'Centro',
        city: 'São Paulo',
        paymentMethod: 'PIX',
        items: [
          {
            productId: 101,
            productName: 'Dipirona',
            quantity: 1,
            unitPrice: 10.0,
          },
        ],
      };

      expect(() => service.createDeliveryOrder(baseInput)).toThrow(DeliveryError);
      try {
        service.createDeliveryOrder(baseInput);
      } catch (err: any) {
        expect(err.code).toBe('STORE_NOT_FOUND');
      }

      // Cria loja inativa
      db.prepare(`
        INSERT INTO stores (id, code, name, company_name, cnpj, ie, street, number, neighborhood, city, state, zip_code, ibge_code, is_active)
        VALUES (99, 'LJ99', 'Loja Fechada', 'Loja Inativa Ltda', '99.999.999/0001-99', '99999999', 'Rua X', '9', 'Centro', 'São Paulo', 'SP', '01000-000', '3550308', 0)
      `).run();

      expect(() => service.createDeliveryOrder({ ...baseInput, storeId: 99 })).toThrow(DeliveryError);
      try {
        service.createDeliveryOrder({ ...baseInput, storeId: 99 });
      } catch (err: any) {
        expect(err.code).toBe('STORE_INACTIVE');
      }
    });

    it('deve inserir atomicamente pedido e múltiplos itens com lote/validade e status inicial RECEIVED', () => {
      const input: CreateDeliveryOrderInput = {
        storeId: defaultStoreId,
        customerName: 'Juliana Paes',
        customerPhone: '(11) 93333-2222',
        customerCpf: '333.444.555-66',
        street: 'Av Paulista',
        number: '1578',
        complement: 'Apto 101',
        neighborhood: 'Jardins',
        city: 'São Paulo',
        paymentMethod: 'CARTAO_DEBITO',
        notes: 'Interfone quebrado, favor ligar',
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg 10cp',
            quantity: 2,
            unitPrice: 10.0,
            batchId: 201,
            batchNumber: 'LOTE-DIP-01',
          },
          {
            productId: 102,
            productName: 'Amoxicilina 500mg 21cps',
            quantity: 1,
            unitPrice: 35.0,
            batchId: 202,
            batchNumber: 'LOTE-AMX-01',
          },
        ],
      };

      const order = service.createDeliveryOrder(input);

      expect(order.id).toBeDefined();
      expect(order.status).toBe('RECEIVED');
      expect(order.subtotalAmount).toBe(55.0); // 20 + 35
      expect(order.notes).toBe('Interfone quebrado, favor ligar');
      expect(order.receivedAt).toBeDefined();

      // Checa itens salvos
      expect(order.items).toBeDefined();
      expect(order.items?.length).toBe(2);
      expect(order.items?.[0].productName).toBe('Dipirona 500mg 10cp');
      expect(order.items?.[0].batchNumber).toBe('LOTE-DIP-01');
      expect(order.items?.[1].productName).toBe('Amoxicilina 500mg 21cps');
      expect(order.items?.[1].batchNumber).toBe('LOTE-AMX-01');
    });
  });

  describe('updateOrderStatus (Máquina de Estados de Entrega)', () => {
    let baseOrder: any;

    beforeEach(() => {
      baseOrder = service.createDeliveryOrder({
        storeId: defaultStoreId,
        customerName: 'Cliente Máquina de Estados',
        customerPhone: '(11) 91111-2222',
        street: 'Rua da Saúde',
        number: '10',
        neighborhood: 'Centro',
        city: 'São Paulo',
        paymentMethod: 'PIX',
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg',
            quantity: 1,
            unitPrice: 10.0,
          },
        ],
      });
    });

    it('deve realizar ciclo completo de transições válidas: RECEIVED -> PREPARING -> READY_FOR_PICKUP -> DISPATCHED -> DELIVERED', () => {
      expect(baseOrder.status).toBe('RECEIVED');

      // 1. RECEIVED -> PREPARING
      const preparing = service.updateOrderStatus(baseOrder.id, { status: 'PREPARING' });
      expect(preparing.status).toBe('PREPARING');

      // 2. PREPARING -> READY_FOR_PICKUP
      const ready = service.updateOrderStatus(baseOrder.id, { status: 'READY_FOR_PICKUP' });
      expect(ready.status).toBe('READY_FOR_PICKUP');

      // 3. READY_FOR_PICKUP -> DISPATCHED (requer courierId e atualiza dispatched_at)
      const dispatched = service.updateOrderStatus(baseOrder.id, {
        status: 'DISPATCHED',
        courierId: defaultCourierId,
      });
      expect(dispatched.status).toBe('DISPATCHED');
      expect(dispatched.courierId).toBe(defaultCourierId);
      expect(dispatched.dispatchedAt).toBeDefined();

      // 4. DISPATCHED -> DELIVERED (atualiza delivered_at)
      const delivered = service.updateOrderStatus(baseOrder.id, { status: 'DELIVERED' });
      expect(delivered.status).toBe('DELIVERED');
      expect(delivered.deliveredAt).toBeDefined();
    });

    it('deve permitir transição DISPATCHED -> RETURNED atualizando returned_at', () => {
      service.updateOrderStatus(baseOrder.id, { status: 'PREPARING' });
      service.updateOrderStatus(baseOrder.id, { status: 'READY_FOR_PICKUP' });
      service.updateOrderStatus(baseOrder.id, {
        status: 'DISPATCHED',
        courierId: defaultCourierId,
      });

      const returned = service.updateOrderStatus(baseOrder.id, { status: 'RETURNED' });
      expect(returned.status).toBe('RETURNED');
      expect(returned.returnedAt).toBeDefined();
    });

    it('deve exigir courierId ao despachar (READY_FOR_PICKUP -> DISPATCHED)', () => {
      service.updateOrderStatus(baseOrder.id, { status: 'PREPARING' });
      service.updateOrderStatus(baseOrder.id, { status: 'READY_FOR_PICKUP' });

      expect(() =>
        service.updateOrderStatus(baseOrder.id, { status: 'DISPATCHED' })
      ).toThrow(DeliveryError);

      try {
        service.updateOrderStatus(baseOrder.id, { status: 'DISPATCHED' });
      } catch (err: any) {
        expect(err.code).toBe('COURIER_REQUIRED');
      }
    });

    it('deve permitir cancelamento com motivo obrigatório e rejeitar se motivo vazio', () => {
      // Rejeita cancelamento sem motivo
      expect(() =>
        service.updateOrderStatus(baseOrder.id, {
          status: 'CANCELLED',
          cancellationReason: '',
        })
      ).toThrow(DeliveryError);

      try {
        service.updateOrderStatus(baseOrder.id, {
          status: 'CANCELLED',
          cancellationReason: '   ',
        })
      } catch (err: any) {
        expect(err.code).toBe('CANCELLATION_REASON_REQUIRED');
      }

      // Sucesso no cancelamento com motivo
      const cancelled = service.updateOrderStatus(baseOrder.id, {
        status: 'CANCELLED',
        cancellationReason: 'Cliente desistiu da compra',
      });
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancellationReason).toBe('Cliente desistiu da compra');
    });

    it('deve bloquear transições inválidas lançando INVALID_STATUS_TRANSITION', () => {
      // De RECEIVED direto para DELIVERED (pula etapas)
      expect(() =>
        service.updateOrderStatus(baseOrder.id, { status: 'DELIVERED' })
      ).toThrow(DeliveryError);

      try {
        service.updateOrderStatus(baseOrder.id, { status: 'DELIVERED' });
      } catch (err: any) {
        expect(err.code).toBe('INVALID_STATUS_TRANSITION');
      }

      // Leva até DELIVERED
      service.updateOrderStatus(baseOrder.id, { status: 'PREPARING' });
      service.updateOrderStatus(baseOrder.id, { status: 'READY_FOR_PICKUP' });
      service.updateOrderStatus(baseOrder.id, {
        status: 'DISPATCHED',
        courierId: defaultCourierId,
      });
      service.updateOrderStatus(baseOrder.id, { status: 'DELIVERED' });

      // De DELIVERED para RECEIVED (regressão proibida)
      expect(() =>
        service.updateOrderStatus(baseOrder.id, { status: 'RECEIVED' })
      ).toThrow(DeliveryError);

      // De DELIVERED para CANCELLED (não pode cancelar entregue)
      expect(() =>
        service.updateOrderStatus(baseOrder.id, {
          status: 'CANCELLED',
          cancellationReason: 'Tentativa indevida',
        })
      ).toThrow(DeliveryError);
    });

    it('deve lançar ORDER_NOT_FOUND para ID inexistente', () => {
      expect(() =>
        service.updateOrderStatus(99999, { status: 'PREPARING' })
      ).toThrow(DeliveryError);

      try {
        service.updateOrderStatus(99999, { status: 'PREPARING' });
      } catch (err: any) {
        expect(err.code).toBe('ORDER_NOT_FOUND');
      }
    });
  });

  describe('getDeliveryOrderById e getDeliveryOrderByNumber', () => {
    it('deve buscar pedido com array completo de itens por ID e por Número', () => {
      const created = service.createDeliveryOrder({
        storeId: defaultStoreId,
        customerName: 'Ana Clara',
        customerPhone: '(11) 92222-3333',
        street: 'Rua Augusta',
        number: '500',
        neighborhood: 'Centro',
        city: 'São Paulo',
        paymentMethod: 'PIX',
        items: [
          {
            productId: 101,
            productName: 'Dipirona 500mg',
            quantity: 3,
            unitPrice: 10.0,
            batchNumber: 'LOTE-1',
          },
        ],
      });

      const byId = service.getDeliveryOrderById(created.id);
      expect(byId).not.toBeNull();
      expect(byId?.id).toBe(created.id);
      expect(byId?.items?.length).toBe(1);
      expect(byId?.items?.[0].productName).toBe('Dipirona 500mg');

      const byNumber = service.getDeliveryOrderByNumber(created.orderNumber);
      expect(byNumber).not.toBeNull();
      expect(byNumber?.orderNumber).toBe(created.orderNumber);
      expect(byNumber?.items?.length).toBe(1);

      // Inexistentes retornam null
      expect(service.getDeliveryOrderById(99999)).toBeNull();
      expect(service.getDeliveryOrderByNumber('DEL-INEXISTENTE')).toBeNull();
    });
  });

  describe('listDeliveryOrders', () => {
    beforeEach(() => {
      // Pedido 1: Centro / RECEIVED
      service.createDeliveryOrder({
        storeId: 1,
        customerName: 'Cliente Alpha',
        customerPhone: '(11) 91000-0001',
        street: 'Rua A',
        number: '1',
        neighborhood: 'Centro',
        city: 'São Paulo',
        paymentMethod: 'PIX',
        items: [{ productId: 101, productName: 'Dipirona', quantity: 1, unitPrice: 10.0 }],
      });

      // Pedido 2: Jardins / PREPARING
      const o2 = service.createDeliveryOrder({
        storeId: 1,
        customerName: 'Cliente Beta',
        customerPhone: '(11) 91000-0002',
        street: 'Rua B',
        number: '2',
        neighborhood: 'Jardins',
        city: 'São Paulo',
        paymentMethod: 'CARTAO_CREDITO',
        items: [{ productId: 101, productName: 'Dipirona', quantity: 2, unitPrice: 10.0 }],
      });
      service.updateOrderStatus(o2.id, { status: 'PREPARING' });

      // Pedido 3: Centro / DISPATCHED com courier
      const o3 = service.createDeliveryOrder({
        storeId: 1,
        customerName: 'Cliente Gama',
        customerPhone: '(11) 91000-0003',
        street: 'Rua C',
        number: '3',
        neighborhood: 'Centro',
        city: 'São Paulo',
        paymentMethod: 'DINHEIRO',
        changeFor: 50.0,
        items: [{ productId: 101, productName: 'Dipirona', quantity: 1, unitPrice: 10.0 }],
      });
      service.updateOrderStatus(o3.id, { status: 'PREPARING' });
      service.updateOrderStatus(o3.id, { status: 'READY_FOR_PICKUP' });
      service.updateOrderStatus(o3.id, { status: 'DISPATCHED', courierId: defaultCourierId });
    });

    it('deve listar com paginação { orders, total }', () => {
      const res = service.listDeliveryOrders({ limit: 2, offset: 0 });
      expect(res.total).toBe(3);
      expect(res.orders.length).toBe(2);
    });

    it('deve filtrar por status (único ou array)', () => {
      const received = service.listDeliveryOrders({ status: 'RECEIVED' });
      expect(received.total).toBe(1);
      expect(received.orders[0].customerName).toBe('Cliente Alpha');

      const activeList = service.listDeliveryOrders({
        status: ['RECEIVED', 'PREPARING'] as DeliveryOrderStatus[],
      });
      expect(activeList.total).toBe(2);
    });

    it('deve filtrar por courierId', () => {
      const withCourier = service.listDeliveryOrders({ courierId: defaultCourierId });
      expect(withCourier.total).toBe(1);
      expect(withCourier.orders[0].customerName).toBe('Cliente Gama');
    });

    it('deve buscar por termo search (nome, telefone ou número)', () => {
      const byName = service.listDeliveryOrders({ search: 'Beta' });
      expect(byName.total).toBe(1);
      expect(byName.orders[0].customerName).toBe('Cliente Beta');

      const byPhone = service.listDeliveryOrders({ search: '91000-0003' });
      expect(byPhone.total).toBe(1);
      expect(byPhone.orders[0].customerName).toBe('Cliente Gama');
    });
  });

  describe('cancelDeliveryOrder', () => {
    it('deve cancelar diretamente com motivo', () => {
      const order = service.createDeliveryOrder({
        storeId: defaultStoreId,
        customerName: 'Cancelamento Direto',
        customerPhone: '(11) 90000-1111',
        street: 'Rua X',
        number: '99',
        neighborhood: 'Centro',
        city: 'São Paulo',
        paymentMethod: 'PIX',
        items: [{ productId: 101, productName: 'Dipirona', quantity: 1, unitPrice: 10.0 }],
      });

      const cancelled = service.cancelDeliveryOrder(order.id, 'Endereço fora do raio de entrega');
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancellationReason).toBe('Endereço fora do raio de entrega');
    });
  });
});
