// FarmaCore ERP — Rotas Fastify do Módulo de Delivery Farmacêutico, Tele-Entrega e Romaneios (Fase 13)

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Database } from '../../database/connection';
import { CourierService, CourierError } from './courier.service';
import { DeliveryOrderService, DeliveryError } from './delivery-order.service';
import { DeliverySettlementService, SettlementError } from './delivery-settlement.service';
import {
  formatDeliveryDispatchSlip,
  formatDeliveryOrderSlip,
  formatCourierSettlementReceipt,
  type StoreInfo,
} from './delivery-receipt-formatter';
import type {
  CourierStatus,
  CourierVehicleType,
  DeliveryOrderStatus,
  DeliveryPaymentMethod,
  DispatchStatus,
} from './types';

// =========================================================================
// Schemas Zod de Validação
// =========================================================================

// 1. Entregadores (Couriers)
const vehicleTypesEnum = z.enum(['MOTO', 'BIKE', 'CAR', 'WALK']);
const courierStatusEnum = z.enum(['AVAILABLE', 'ON_DELIVERY', 'INACTIVE']);

const createCourierSchema = z.object({
  storeId: z.number().int().positive().optional().nullable(),
  store_id: z.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1, 'Nome do entregador é obrigatório'),
  cpf: z.string().trim().min(1, 'CPF do entregador é obrigatório'),
  phone: z.string().trim().min(1, 'Telefone do entregador é obrigatório'),
  vehicleType: vehicleTypesEnum.optional(),
  vehicle_type: vehicleTypesEnum.optional(),
  vehiclePlate: z.string().trim().optional().nullable(),
  vehicle_plate: z.string().trim().optional().nullable(),
  cnh: z.string().trim().optional().nullable(),
  commissionPerDelivery: z.number().min(0).optional(),
  commission_per_delivery: z.number().min(0).optional(),
  dailyAllowance: z.number().min(0).optional(),
  daily_allowance: z.number().min(0).optional(),
  status: courierStatusEnum.optional(),
  isActive: z.boolean().optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
});

const updateCourierSchema = z.object({
  storeId: z.number().int().positive().optional().nullable(),
  store_id: z.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1).optional(),
  cpf: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  vehicleType: vehicleTypesEnum.optional(),
  vehicle_type: vehicleTypesEnum.optional(),
  vehiclePlate: z.string().trim().optional().nullable(),
  vehicle_plate: z.string().trim().optional().nullable(),
  cnh: z.string().trim().optional().nullable(),
  commissionPerDelivery: z.number().min(0).optional(),
  commission_per_delivery: z.number().min(0).optional(),
  dailyAllowance: z.number().min(0).optional(),
  daily_allowance: z.number().min(0).optional(),
  status: courierStatusEnum.optional(),
  isActive: z.boolean().optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
});

const updateCourierStatusSchema = z.object({
  status: courierStatusEnum,
});

// 2. Zonas de Entrega (Delivery Zones)
const createDeliveryZoneSchema = z.object({
  storeId: z.number().int().positive().optional().nullable(),
  store_id: z.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1, 'Nome da zona é obrigatório'),
  neighborhood: z.string().trim().min(1, 'Bairro é obrigatório'),
  city: z.string().trim().min(1, 'Cidade é obrigatória'),
  state: z.string().trim().default('SP'),
  deliveryFee: z.number().min(0, 'Taxa de entrega não pode ser negativa'),
  delivery_fee: z.number().min(0).optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  estimated_minutes: z.number().int().positive().optional(),
  freeShippingThreshold: z.number().min(0).optional().nullable(),
  free_shipping_threshold: z.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
});

const updateDeliveryZoneSchema = z.object({
  name: z.string().trim().min(1).optional(),
  neighborhood: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  state: z.string().trim().optional(),
  deliveryFee: z.number().min(0).optional(),
  delivery_fee: z.number().min(0).optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  estimated_minutes: z.number().int().positive().optional(),
  freeShippingThreshold: z.number().min(0).optional().nullable(),
  free_shipping_threshold: z.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
});

const calculateDeliveryFeeSchema = z.object({
  neighborhood: z.string().trim().min(1, 'Bairro é obrigatório'),
  city: z.string().trim().min(1, 'Cidade é obrigatória'),
  subtotalAmount: z.number().min(0).optional(),
  subtotal_amount: z.number().min(0).optional(),
  storeId: z.number().int().positive().optional().nullable(),
  store_id: z.number().int().positive().optional().nullable(),
});

// 3. Pedidos de Tele-Entrega (Delivery Orders)
const orderStatusEnum = z.enum([
  'RECEIVED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'DISPATCHED',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
]);

const paymentMethodEnum = z.enum([
  'DINHEIRO',
  'CARTAO_CREDITO',
  'CARTAO_DEBITO',
  'PIX',
  'CONVENIO',
  'CREDIARIO',
]);

const createOrderItemSchema = z.object({
  productId: z.number().int().positive().optional(),
  product_id: z.number().int().positive().optional(),
  productName: z.string().trim().min(1).optional(),
  product_name: z.string().trim().min(1).optional(),
  quantity: z.number().int().positive('Quantidade deve ser positiva'),
  unitPrice: z.number().min(0).optional(),
  unit_price: z.number().min(0).optional(),
  totalPrice: z.number().min(0).optional(),
  total_price: z.number().min(0).optional(),
  batchId: z.number().int().positive().optional().nullable(),
  batch_id: z.number().int().positive().optional().nullable(),
  batchNumber: z.string().trim().optional().nullable(),
  batch_number: z.string().trim().optional().nullable(),
});

const createDeliveryOrderSchema = z.object({
  storeId: z.number().int().positive().optional().default(1),
  store_id: z.number().int().positive().optional(),
  customerId: z.number().int().positive().optional().nullable(),
  customer_id: z.number().int().positive().optional().nullable(),
  customerName: z.string().trim().min(1, 'Nome do cliente é obrigatório'),
  customer_name: z.string().trim().min(1).optional(),
  customerPhone: z.string().trim().min(1, 'Telefone do cliente é obrigatório'),
  customer_phone: z.string().trim().min(1).optional(),
  customerCpf: z.string().trim().optional().nullable(),
  customer_cpf: z.string().trim().optional().nullable(),
  street: z.string().trim().min(1, 'Logradouro é obrigatório'),
  number: z.string().trim().min(1, 'Número é obrigatório'),
  complement: z.string().trim().optional().nullable(),
  neighborhood: z.string().trim().min(1, 'Bairro é obrigatório'),
  city: z.string().trim().min(1, 'Cidade é obrigatória'),
  state: z.string().trim().default('SP'),
  zipCode: z.string().trim().optional().nullable(),
  zip_code: z.string().trim().optional().nullable(),
  referencePoint: z.string().trim().optional().nullable(),
  reference_point: z.string().trim().optional().nullable(),
  subtotalAmount: z.number().min(0).optional(),
  subtotal_amount: z.number().min(0).optional(),
  deliveryFee: z.number().min(0).optional(),
  delivery_fee: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  discount_amount: z.number().min(0).optional(),
  totalAmount: z.number().min(0).optional(),
  total_amount: z.number().min(0).optional(),
  paymentMethod: paymentMethodEnum.optional(),
  payment_method: paymentMethodEnum.optional(),
  changeFor: z.number().min(0).optional().nullable(),
  change_for: z.number().min(0).optional().nullable(),
  courierId: z.number().int().positive().optional().nullable(),
  courier_id: z.number().int().positive().optional().nullable(),
  preSaleId: z.number().int().positive().optional().nullable(),
  pre_sale_id: z.number().int().positive().optional().nullable(),
  saleId: z.number().int().positive().optional().nullable(),
  sale_id: z.number().int().positive().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  items: z.array(createOrderItemSchema).min(1, 'O pedido deve conter ao menos 1 item'),
});

const updateOrderStatusSchema = z.object({
  status: orderStatusEnum,
  courierId: z.number().int().positive().optional().nullable(),
  courier_id: z.number().int().positive().optional().nullable(),
  cancellationReason: z.string().trim().optional().nullable(),
  cancellation_reason: z.string().trim().optional().nullable(),
});

const cancelDeliveryOrderSchema = z.object({
  reason: z.string().trim().min(1, 'Motivo do cancelamento é obrigatório').optional(),
  cancellationReason: z.string().trim().min(1).optional(),
  cancellation_reason: z.string().trim().min(1).optional(),
});

// 4. Romaneios e Acerto (Dispatches & Settlement)
const createDispatchSchema = z.object({
  storeId: z.number().int().positive().optional().default(1),
  store_id: z.number().int().positive().optional(),
  courierId: z.number().int().positive().optional(),
  courier_id: z.number().int().positive().optional(),
  orderIds: z.array(z.number().int().positive()).min(1, 'Romaneio deve conter ao menos 1 pedido').optional(),
  order_ids: z.array(z.number().int().positive()).min(1).optional(),
  notes: z.string().trim().optional().nullable(),
});

const settleDispatchOrderItemSchema = z.object({
  orderId: z.number().int().positive().optional(),
  order_id: z.number().int().positive().optional(),
  delivered: z.boolean(),
  returnedReason: z.string().trim().optional(),
  returned_reason: z.string().trim().optional(),
});

const settleDispatchSchema = z.object({
  orders: z.array(settleDispatchOrderItemSchema).min(1, 'Lista de conferência de pedidos é obrigatória'),
  collectedCash: z.number().min(0).optional(),
  collected_cash: z.number().min(0).optional(),
  collectedCard: z.number().min(0).optional(),
  collected_card: z.number().min(0).optional(),
  collectedPix: z.number().min(0).optional(),
  collected_pix: z.number().min(0).optional(),
  cashSessionId: z.number().int().positive().optional().nullable(),
  cash_session_id: z.number().int().positive().optional().nullable(),
  operatorName: z.string().trim().optional(),
  operator_name: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

// =========================================================================
// Helper de Consulta de Dados da Loja
// =========================================================================

function getStoreInfo(db: Database, storeId = 1): StoreInfo {
  try {
    const store = db
      .prepare('SELECT name, cnpj, address, city, phone FROM stores WHERE id = ?')
      .get(storeId) as any;
    if (store) {
      return {
        name: store.name,
        storeName: store.name,
        cnpj: store.cnpj,
        address: store.address,
        city: store.city,
        phone: store.phone,
      };
    }
  } catch {
    // Tabela stores pode não existir ou consulta falhar em mock
  }
  return {
    name: 'DROGARIA FARMACORE MATRIZ',
    storeName: 'DROGARIA FARMACORE MATRIZ',
    cnpj: '12.345.678/0001-90',
    address: 'Av. Paulista, 1500 - Bela Vista',
    city: 'São Paulo - SP',
    phone: '(11) 3200-5000',
  };
}

// =========================================================================
// Registro Principal de Rotas Fastify
// =========================================================================

export function registerDeliveryRoutes(app: FastifyInstance, db: Database): void {
  const courierService = new CourierService(db);
  const orderService = new DeliveryOrderService(db);
  const settlementService = new DeliverySettlementService(db);

  // =======================================================================
  // 1. ROTAS DE ENTREGADORES (/api/delivery/couriers)
  // =======================================================================

  // GET /api/delivery/couriers
  app.get('/api/delivery/couriers', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as {
      storeId?: string;
      activeOnly?: string;
      status?: CourierStatus;
      vehicleType?: CourierVehicleType;
      search?: string;
    };

    const filters = {
      storeId: query.storeId ? Number(query.storeId) : undefined,
      activeOnly: query.activeOnly === 'true' || query.activeOnly === '1',
      status: query.status,
      vehicleType: query.vehicleType,
      search: query.search,
    };

    const couriers = courierService.listCouriers(filters);
    return reply.status(200).send(couriers);
  });

  // POST /api/delivery/couriers
  app.post('/api/delivery/couriers', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = createCourierSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dados inválidos para cadastro de entregador.',
        details: parsed.error.format(),
      });
    }

    const data = parsed.data;
    try {
      const created = courierService.createCourier({
        storeId: data.storeId ?? data.store_id ?? null,
        name: data.name,
        cpf: data.cpf,
        phone: data.phone,
        vehicleType: data.vehicleType ?? data.vehicle_type ?? 'MOTO',
        vehiclePlate: data.vehiclePlate ?? data.vehicle_plate ?? null,
        cnh: data.cnh ?? null,
        commissionPerDelivery: data.commissionPerDelivery ?? data.commission_per_delivery,
        dailyAllowance: data.dailyAllowance ?? data.daily_allowance,
        status: data.status,
        isActive: data.isActive ?? (data.is_active != null ? Boolean(data.is_active) : undefined),
      });

      return reply.status(201).send(created);
    } catch (err: any) {
      if (err instanceof CourierError && err.code === 'DUPLICATE_CPF') {
        return reply.status(409).send({ error: err.code, message: err.message });
      }
      return reply.status(400).send({
        error: err.code ?? 'COURIER_CREATE_ERROR',
        message: err.message,
      });
    }
  });

  // GET /api/delivery/couriers/:id
  app.get('/api/delivery/couriers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const id = Number((req.params as { id: string }).id);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'ID inválido.' });
    }

    const courier = courierService.getCourierById(id);
    if (!courier) {
      return reply.status(404).send({
        error: 'COURIER_NOT_FOUND',
        message: `Entregador #${id} não encontrado.`,
      });
    }

    return reply.status(200).send(courier);
  });

  // PUT /api/delivery/couriers/:id
  app.put('/api/delivery/couriers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const id = Number((req.params as { id: string }).id);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'ID inválido.' });
    }

    const parsed = updateCourierSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dados inválidos para atualização de entregador.',
        details: parsed.error.format(),
      });
    }

    const data = parsed.data;
    try {
      const updated = courierService.updateCourier(id, {
        storeId: data.storeId ?? data.store_id ?? undefined,
        name: data.name,
        cpf: data.cpf,
        phone: data.phone,
        vehicleType: data.vehicleType ?? data.vehicle_type,
        vehiclePlate: data.vehiclePlate ?? data.vehicle_plate,
        cnh: data.cnh,
        commissionPerDelivery: data.commissionPerDelivery ?? data.commission_per_delivery,
        dailyAllowance: data.dailyAllowance ?? data.daily_allowance,
        status: data.status,
        isActive: data.isActive ?? (data.is_active != null ? Boolean(data.is_active) : undefined),
      });

      return reply.status(200).send(updated);
    } catch (err: any) {
      if (err instanceof CourierError && err.code === 'COURIER_NOT_FOUND') {
        return reply.status(404).send({ error: err.code, message: err.message });
      }
      if (err instanceof CourierError && err.code === 'DUPLICATE_CPF') {
        return reply.status(409).send({ error: err.code, message: err.message });
      }
      return reply.status(400).send({
        error: err.code ?? 'COURIER_UPDATE_ERROR',
        message: err.message,
      });
    }
  });

  // PATCH /api/delivery/couriers/:id/status
  app.patch('/api/delivery/couriers/:id/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const id = Number((req.params as { id: string }).id);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'ID inválido.' });
    }

    const parsed = updateCourierStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Status de entregador inválido.',
        details: parsed.error.format(),
      });
    }

    try {
      const updated = courierService.updateCourierStatus(id, parsed.data.status);
      return reply.status(200).send(updated);
    } catch (err: any) {
      if (err instanceof CourierError && err.code === 'COURIER_NOT_FOUND') {
        return reply.status(404).send({ error: err.code, message: err.message });
      }
      return reply.status(400).send({
        error: err.code ?? 'COURIER_STATUS_ERROR',
        message: err.message,
      });
    }
  });

  // =======================================================================
  // 2. ROTAS DE ZONAS DE ENTREGA (/api/delivery/zones)
  // =======================================================================

  // GET /api/delivery/zones
  app.get('/api/delivery/zones', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as {
      storeId?: string;
      activeOnly?: string;
      search?: string;
    };

    const filters = {
      storeId: query.storeId ? Number(query.storeId) : undefined,
      activeOnly: query.activeOnly === 'true' || query.activeOnly === '1',
      search: query.search,
    };

    const zones = courierService.listDeliveryZones(filters);
    return reply.status(200).send(zones);
  });

  // POST /api/delivery/zones
  app.post('/api/delivery/zones', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = createDeliveryZoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dados inválidos para zona de entrega.',
        details: parsed.error.format(),
      });
    }

    const data = parsed.data;
    try {
      const created = courierService.createDeliveryZone({
        storeId: data.storeId ?? data.store_id ?? null,
        name: data.name,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        deliveryFee: data.deliveryFee ?? data.delivery_fee ?? 5.0,
        estimatedMinutes: data.estimatedMinutes ?? data.estimated_minutes ?? 40,
        freeShippingThreshold: data.freeShippingThreshold ?? data.free_shipping_threshold ?? null,
        isActive: data.isActive ?? (data.is_active != null ? Boolean(data.is_active) : true),
      });

      return reply.status(201).send(created);
    } catch (err: any) {
      return reply.status(400).send({
        error: err.code ?? 'ZONE_CREATE_ERROR',
        message: err.message,
      });
    }
  });

  // PUT /api/delivery/zones/:id
  app.put('/api/delivery/zones/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const id = Number((req.params as { id: string }).id);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'ID inválido.' });
    }

    const parsed = updateDeliveryZoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dados inválidos para atualização de zona.',
        details: parsed.error.format(),
      });
    }

    const data = parsed.data;
    try {
      const updated = courierService.updateDeliveryZone(id, {
        name: data.name,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        deliveryFee: data.deliveryFee ?? data.delivery_fee,
        estimatedMinutes: data.estimatedMinutes ?? data.estimated_minutes,
        freeShippingThreshold: data.freeShippingThreshold ?? data.free_shipping_threshold,
        isActive: data.isActive ?? (data.is_active != null ? Boolean(data.is_active) : undefined),
      });

      return reply.status(200).send(updated);
    } catch (err: any) {
      if (err instanceof CourierError && err.code === 'ZONE_NOT_FOUND') {
        return reply.status(404).send({ error: err.code, message: err.message });
      }
      return reply.status(400).send({
        error: err.code ?? 'ZONE_UPDATE_ERROR',
        message: err.message,
      });
    }
  });

  // DELETE /api/delivery/zones/:id
  app.delete('/api/delivery/zones/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const id = Number((req.params as { id: string }).id);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'ID inválido.' });
    }

    try {
      courierService.deleteDeliveryZone(id);
      return reply.status(200).send({
        success: true,
        message: `Zona de entrega #${id} excluída com sucesso.`,
      });
    } catch (err: any) {
      if (err instanceof CourierError && err.code === 'ZONE_NOT_FOUND') {
        return reply.status(404).send({ error: err.code, message: err.message });
      }
      return reply.status(400).send({
        error: err.code ?? 'ZONE_DELETE_ERROR',
        message: err.message,
      });
    }
  });

  // POST /api/delivery/zones/calculate-fee
  app.post('/api/delivery/zones/calculate-fee', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = calculateDeliveryFeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dados inválidos para cálculo de taxa de entrega.',
        details: parsed.error.format(),
      });
    }

    const { neighborhood, city, subtotalAmount, subtotal_amount, storeId, store_id } = parsed.data;
    const subtotal = subtotalAmount ?? subtotal_amount ?? 0;
    const stId = storeId ?? store_id ?? undefined;

    const calc = courierService.calculateDeliveryFee(
      neighborhood,
      city,
      subtotal,
      stId ?? undefined
    );

    return reply.status(200).send({
      deliveryFee: calc.fee,
      fee: calc.fee,
      estimatedMinutes: calc.estimatedMinutes,
      isFreeShipping: calc.isFree,
      isFree: calc.isFree,
      zone: calc.zone,
      zoneId: calc.zoneId,
      zoneName: calc.zoneName ?? (calc.zone ? calc.zone.name : null),
    });
  });

  // =======================================================================
  // 3. ROTAS DE PEDIDOS DE TELE-ENTREGA (/api/delivery/orders)
  // =======================================================================

  // GET /api/delivery/orders
  app.get('/api/delivery/orders', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as {
      storeId?: string;
      status?: DeliveryOrderStatus;
      courierId?: string;
      customerId?: string;
      paymentMethod?: DeliveryPaymentMethod;
      startDate?: string;
      endDate?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };

    const filters = {
      storeId: query.storeId ? Number(query.storeId) : undefined,
      status: query.status,
      courierId: query.courierId ? Number(query.courierId) : undefined,
      customerId: query.customerId ? Number(query.customerId) : undefined,
      paymentMethod: query.paymentMethod,
      startDate: query.startDate,
      endDate: query.endDate,
      search: query.search,
      limit: query.limit ? Number(query.limit) : 50,
      offset: query.offset ? Number(query.offset) : 0,
    };

    const result = orderService.listDeliveryOrders(filters);
    return reply.status(200).send(result);
  });

  // POST /api/delivery/orders
  app.post('/api/delivery/orders', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = createDeliveryOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dados inválidos para criação do pedido de tele-entrega.',
        details: parsed.error.format(),
      });
    }

    const data = parsed.data;
    try {
      const items = data.items.map((item) => ({
        productId: item.productId ?? item.product_id!,
        productName: item.productName ?? item.product_name ?? `Produto #${item.productId ?? item.product_id}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? item.unit_price ?? 0,
        totalPrice: item.totalPrice ?? item.total_price,
        batchId: item.batchId ?? item.batch_id,
        batchNumber: item.batchNumber ?? item.batch_number,
      }));

      const created = orderService.createDeliveryOrder({
        storeId: data.storeId ?? data.store_id ?? 1,
        customerId: data.customerId ?? data.customer_id,
        customerName: data.customerName ?? data.customer_name!,
        customerPhone: data.customerPhone ?? data.customer_phone!,
        customerCpf: data.customerCpf ?? data.customer_cpf,
        street: data.street,
        number: data.number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode ?? data.zip_code,
        referencePoint: data.referencePoint ?? data.reference_point,
        subtotalAmount: data.subtotalAmount ?? data.subtotal_amount,
        deliveryFee: data.deliveryFee ?? data.delivery_fee,
        discountAmount: data.discountAmount ?? data.discount_amount,
        totalAmount: data.totalAmount ?? data.total_amount,
        paymentMethod: (data.paymentMethod ?? data.payment_method ?? 'DINHEIRO') as DeliveryPaymentMethod,
        changeFor: data.changeFor ?? data.change_for,
        courierId: data.courierId ?? data.courier_id,
        preSaleId: data.preSaleId ?? data.pre_sale_id,
        saleId: data.saleId ?? data.sale_id,
        notes: data.notes,
        items,
      });

      return reply.status(201).send(created);
    } catch (err: any) {
      return reply.status(400).send({
        error: err.code ?? 'ORDER_CREATE_ERROR',
        message: err.message,
      });
    }
  });

  // GET /api/delivery/orders/:id
  app.get('/api/delivery/orders/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const id = Number((req.params as { id: string }).id);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'ID inválido.' });
    }

    const order = orderService.getDeliveryOrderById(id);
    if (!order) {
      return reply.status(404).send({
        error: 'ORDER_NOT_FOUND',
        message: `Pedido de tele-entrega #${id} não encontrado.`,
      });
    }

    return reply.status(200).send(order);
  });

  // PATCH /api/delivery/orders/:id/status
  app.patch('/api/delivery/orders/:id/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const id = Number((req.params as { id: string }).id);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'ID inválido.' });
    }

    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Status do pedido inválido.',
        details: parsed.error.format(),
      });
    }

    const data = parsed.data;
    try {
      const updated = orderService.updateOrderStatus(id, {
        status: data.status,
        courierId: data.courierId ?? data.courier_id,
        cancellationReason: data.cancellationReason ?? data.cancellation_reason,
      });

      return reply.status(200).send(updated);
    } catch (err: any) {
      if (err instanceof DeliveryError && err.code === 'ORDER_NOT_FOUND') {
        return reply.status(404).send({ error: err.code, message: err.message });
      }
      return reply.status(400).send({
        error: err.code ?? 'STATUS_UPDATE_ERROR',
        message: err.message,
      });
    }
  });

  // POST /api/delivery/orders/:id/cancel
  app.post('/api/delivery/orders/:id/cancel', async (req: FastifyRequest, reply: FastifyReply) => {
    const id = Number((req.params as { id: string }).id);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'ID inválido.' });
    }

    const parsed = cancelDeliveryOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Motivo do cancelamento é obrigatório.',
        details: parsed.error.format(),
      });
    }

    const reason =
      parsed.data.reason ??
      parsed.data.cancellationReason ??
      parsed.data.cancellation_reason;

    if (!reason || !reason.trim()) {
      return reply.status(400).send({
        error: 'REASON_REQUIRED',
        message: 'Motivo do cancelamento é obrigatório.',
      });
    }

    try {
      const cancelled = orderService.cancelDeliveryOrder(id, reason.trim());
      return reply.status(200).send(cancelled);
    } catch (err: any) {
      if (err instanceof DeliveryError && err.code === 'ORDER_NOT_FOUND') {
        return reply.status(404).send({ error: err.code, message: err.message });
      }
      return reply.status(400).send({
        error: err.code ?? 'CANCEL_ORDER_ERROR',
        message: err.message,
      });
    }
  });

  // GET /api/delivery/orders/:id/slip
  app.get('/api/delivery/orders/:id/slip', async (req: FastifyRequest, reply: FastifyReply) => {
    const id = Number((req.params as { id: string }).id);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'ID inválido.' });
    }

    const order = orderService.getDeliveryOrderById(id);
    if (!order) {
      return reply.status(404).send({
        error: 'ORDER_NOT_FOUND',
        message: `Pedido #${id} não encontrado.`,
      });
    }

    let courierName: string | null = null;
    if (order.courierId) {
      const c = courierService.getCourierById(order.courierId);
      if (c) courierName = c.name;
    }

    const store = getStoreInfo(db, order.storeId);
    const formatted = formatDeliveryOrderSlip({
      store,
      order,
      items: order.items,
      courierName,
    });

    return reply.status(200).send({
      orderId: order.id,
      orderNumber: order.orderNumber,
      order,
      textReceipt: formatted.textReceipt,
      fullEscPos: formatted.fullEscPos,
    });
  });

  // =======================================================================
  // 4. ROTAS DE ROMANEIOS E ACERTO NO CAIXA (/api/delivery/dispatches)
  // =======================================================================

  // GET /api/delivery/dispatches
  app.get('/api/delivery/dispatches', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as {
      storeId?: string;
      courierId?: string;
      status?: DispatchStatus;
      startDate?: string;
      endDate?: string;
      search?: string;
    };

    const filters = {
      storeId: query.storeId ? Number(query.storeId) : undefined,
      courierId: query.courierId ? Number(query.courierId) : undefined,
      status: query.status,
      startDate: query.startDate,
      endDate: query.endDate,
      search: query.search,
    };

    const result = settlementService.listDispatches(filters);
    return reply.status(200).send(result);
  });

  // POST /api/delivery/dispatches
  app.post('/api/delivery/dispatches', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = createDispatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dados inválidos para geração do romaneio de despacho.',
        details: parsed.error.format(),
      });
    }

    const data = parsed.data;
    const courierId = data.courierId ?? data.courier_id;
    const orderIds = data.orderIds ?? data.order_ids;

    if (!courierId || !orderIds || orderIds.length === 0) {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: 'Entregador e pedidos são obrigatórios.',
      });
    }

    try {
      const created = settlementService.createDispatch({
        storeId: data.storeId ?? data.store_id ?? 1,
        courierId,
        orderIds,
        notes: data.notes,
      });

      return reply.status(201).send(created);
    } catch (err: any) {
      return reply.status(400).send({
        error: err.code ?? 'DISPATCH_CREATE_ERROR',
        message: err.message,
      });
    }
  });

  // GET /api/delivery/dispatches/:id
  app.get('/api/delivery/dispatches/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const id = Number((req.params as { id: string }).id);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'ID inválido.' });
    }

    const dispatch = settlementService.getDispatchById(id);
    if (!dispatch) {
      return reply.status(404).send({
        error: 'DISPATCH_NOT_FOUND',
        message: `Romaneio #${id} não encontrado.`,
      });
    }

    return reply.status(200).send(dispatch);
  });

  // GET /api/delivery/dispatches/:id/slip
  app.get('/api/delivery/dispatches/:id/slip', async (req: FastifyRequest, reply: FastifyReply) => {
    const id = Number((req.params as { id: string }).id);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'ID inválido.' });
    }

    const dispatch = settlementService.getDispatchById(id);
    if (!dispatch) {
      return reply.status(404).send({
        error: 'DISPATCH_NOT_FOUND',
        message: `Romaneio #${id} não encontrado.`,
      });
    }

    const store = getStoreInfo(db, dispatch.storeId);
    const formatted = formatDeliveryDispatchSlip({
      store,
      dispatch,
      courier: dispatch.courier,
      orders: dispatch.orders,
    });

    return reply.status(200).send({
      dispatchId: dispatch.id,
      dispatchNumber: dispatch.dispatchNumber,
      dispatch,
      textReceipt: formatted.textReceipt,
      fullEscPos: formatted.fullEscPos,
    });
  });

  // POST /api/delivery/dispatches/:id/settle
  app.post('/api/delivery/dispatches/:id/settle', async (req: FastifyRequest, reply: FastifyReply) => {
    const id = Number((req.params as { id: string }).id);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'ID inválido.' });
    }

    const parsed = settleDispatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dados inválidos para acerto de contas do romaneio.',
        details: parsed.error.format(),
      });
    }

    const data = parsed.data;
    try {
      const orders = data.orders.map((o) => ({
        orderId: o.orderId ?? o.order_id!,
        delivered: o.delivered,
        returnedReason: o.returnedReason ?? o.returned_reason,
      }));

      const settlementResult = settlementService.settleDispatch(id, {
        orders,
        collectedCash: data.collectedCash ?? data.collected_cash,
        collectedCard: data.collectedCard ?? data.collected_card,
        collectedPix: data.collectedPix ?? data.collected_pix,
        cashSessionId: data.cashSessionId ?? data.cash_session_id,
        operatorName: data.operatorName ?? data.operator_name,
        notes: data.notes,
      });

      // Gera o comprovante formatado com o novo formatador
      const store = getStoreInfo(db, settlementResult.dispatch.storeId);
      const courier = courierService.getCourierById(settlementResult.dispatch.courierId);
      const receipt = formatCourierSettlementReceipt({
        store,
        dispatch: settlementResult.dispatch,
        courier,
        settlementResult,
      });

      return reply.status(200).send({
        ...settlementResult,
        receiptText: receipt.textReceipt,
        fullEscPos: receipt.fullEscPos,
      });
    } catch (err: any) {
      if (err instanceof SettlementError && err.code === 'DISPATCH_NOT_FOUND') {
        return reply.status(404).send({ error: err.code, message: err.message });
      }
      return reply.status(400).send({
        error: err.code ?? 'SETTLEMENT_ERROR',
        message: err.message,
      });
    }
  });
}
