// FarmaCore ERP — Rotas Fastify do Módulo CRM, Fidelidade e Promoções (Fase 12)

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Database } from '../../database/connection';
import { LoyaltyService, LoyaltyError } from './loyalty.service';
import { PromotionEngineService, PromotionError } from './promotion-engine.service';
import { TreatmentAdherenceService, TreatmentError } from './treatment-adherence.service';
import {
  formatCashbackStatement,
  formatTreatmentRefillSlip,
  type StoreInfo,
} from './crm-receipt-formatter';
import type {
  PromotionType,
  PromotionAppliesTo,
  PromotionProductRole,
} from './types';

// =========================================================================
// Schemas Zod de Validação
// =========================================================================

const updateLoyaltyProgramSchema = z.object({
  storeId: z.number().int().positive().nullable().optional(),
  store_id: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).optional(),
  cashbackPercent: z.number().min(0, 'cashbackPercent não pode ser negativo').max(100).optional(),
  cashback_percent: z.number().min(0, 'cashback_percent não pode ser negativo').max(100).optional(),
  validityDays: z.number().int().positive('validityDays deve ser positivo').optional(),
  validity_days: z.number().int().positive('validity_days deve ser positivo').optional(),
  minPurchaseAmount: z.number().min(0).optional(),
  min_purchase_amount: z.number().min(0).optional(),
  minRedeemAmount: z.number().min(0).optional(),
  min_redeem_amount: z.number().min(0).optional(),
  maxRedeemPercent: z.number().min(0).max(100).optional(),
  max_redeem_percent: z.number().min(0).max(100).optional(),
  allowWithPromotions: z.boolean().optional(),
  allow_with_promotions: z.union([z.boolean(), z.number()]).optional(),
  isActive: z.boolean().optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
});

const redeemCashbackSchema = z.object({
  customerId: z.number().int().positive().optional(),
  customer_id: z.number().int().positive().optional(),
  saleAmount: z.number().positive('saleAmount deve ser maior que zero').optional(),
  sale_amount: z.number().positive('sale_amount deve ser maior que zero').optional(),
  requestedRedeem: z.number().positive('requestedRedeem deve ser maior que zero').optional(),
  requested_redeem: z.number().positive('requested_redeem deve ser maior que zero').optional(),
  saleId: z.number().int().positive().optional(),
  sale_id: z.number().int().positive().optional(),
  notes: z.string().optional(),
}).refine(
  (d) => (d.customerId ?? d.customer_id) !== undefined,
  { message: 'customerId é obrigatório', path: ['customerId'] }
).refine(
  (d) => (d.saleAmount ?? d.sale_amount) !== undefined,
  { message: 'saleAmount é obrigatório', path: ['saleAmount'] }
).refine(
  (d) => (d.requestedRedeem ?? d.requested_redeem) !== undefined,
  { message: 'requestedRedeem é obrigatório', path: ['requestedRedeem'] }
);

const expireCashbackSchema = z.object({
  referenceDate: z.string().optional(),
  reference_date: z.string().optional(),
});

const promotionProductSchema = z.object({
  productId: z.number().int().positive().optional(),
  product_id: z.number().int().positive().optional(),
  role: z.enum(['TRIGGER', 'REWARD', 'BOTH']).optional(),
  specialPrice: z.number().min(0).optional(),
  special_price: z.number().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discount_percent: z.number().min(0).max(100).optional(),
}).refine(
  (d) => (d.productId ?? d.product_id) !== undefined,
  { message: 'productId é obrigatório no produto da promoção', path: ['productId'] }
);

const createPromotionSchema = z.object({
  name: z.string().trim().min(1, 'Nome da promoção é obrigatório'),
  description: z.string().nullable().optional(),
  type: z.enum([
    'TAKE_MORE_PAY_LESS',
    'PROGRESSIVE_DISCOUNT',
    'COMBO_CROSS_SELL',
    'CLUB_SPECIAL_PRICE',
    'BIRTHDAY_DISCOUNT',
  ]),
  startDate: z.string().trim().min(1).optional(),
  start_date: z.string().trim().min(1).optional(),
  endDate: z.string().trim().min(1).optional(),
  end_date: z.string().trim().min(1).optional(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
  appliesTo: z.enum(['ALL_PRODUCTS', 'SPECIFIC_PRODUCTS', 'CATEGORY']).optional(),
  applies_to: z.enum(['ALL_PRODUCTS', 'SPECIFIC_PRODUCTS', 'CATEGORY']).optional(),
  targetCategory: z.string().nullable().optional(),
  target_category: z.string().nullable().optional(),
  conditionsJson: z.union([z.record(z.any()), z.string()]).optional(),
  conditions_json: z.union([z.record(z.any()), z.string()]).optional(),
  products: z.array(promotionProductSchema).optional(),
}).refine(
  (d) => (d.startDate ?? d.start_date) !== undefined,
  { message: 'Data de início (startDate) é obrigatória', path: ['startDate'] }
).refine(
  (d) => (d.endDate ?? d.end_date) !== undefined,
  { message: 'Data de término (endDate) é obrigatória', path: ['endDate'] }
).refine(
  (d) => (d.conditionsJson ?? d.conditions_json) !== undefined,
  { message: 'conditionsJson é obrigatório', path: ['conditionsJson'] }
);

const updatePromotionSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z
    .enum([
      'TAKE_MORE_PAY_LESS',
      'PROGRESSIVE_DISCOUNT',
      'COMBO_CROSS_SELL',
      'CLUB_SPECIAL_PRICE',
      'BIRTHDAY_DISCOUNT',
    ])
    .optional(),
  startDate: z.string().trim().min(1).optional(),
  start_date: z.string().trim().min(1).optional(),
  endDate: z.string().trim().min(1).optional(),
  end_date: z.string().trim().min(1).optional(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
  appliesTo: z.enum(['ALL_PRODUCTS', 'SPECIFIC_PRODUCTS', 'CATEGORY']).optional(),
  applies_to: z.enum(['ALL_PRODUCTS', 'SPECIFIC_PRODUCTS', 'CATEGORY']).optional(),
  targetCategory: z.string().nullable().optional(),
  target_category: z.string().nullable().optional(),
  conditionsJson: z.union([z.record(z.any()), z.string()]).optional(),
  conditions_json: z.union([z.record(z.any()), z.string()]).optional(),
  products: z.array(promotionProductSchema).optional(),
});

const evaluateCartSchema = z.object({
  items: z.array(
    z.object({
      productId: z.number().int().positive().optional(),
      product_id: z.number().int().positive().optional(),
      quantity: z.number().positive(),
      unitPrice: z.number().min(0).optional(),
      unit_price: z.number().min(0).optional(),
      cmedMaxPrice: z.number().min(0).optional(),
      cmed_max_price: z.number().min(0).optional(),
      category: z.string().optional(),
    }).refine(
      (i) => (i.productId ?? i.product_id) !== undefined,
      { message: 'productId é obrigatório para item do carrinho', path: ['productId'] }
    ).refine(
      (i) => (i.unitPrice ?? i.unit_price) !== undefined,
      { message: 'unitPrice é obrigatório para item do carrinho', path: ['unitPrice'] }
    )
  ),
  customerId: z.number().int().positive().optional(),
  customer_id: z.number().int().positive().optional(),
  storeId: z.number().int().positive().optional(),
  store_id: z.number().int().positive().optional(),
  referenceDate: z.string().optional(),
  reference_date: z.string().optional(),
});

const contactTreatmentSchema = z.object({
  notes: z.string().optional(),
});

const discontinueTreatmentSchema = z.object({
  reason: z.string().optional(),
});

// =========================================================================
// Helpers Utilitários
// =========================================================================

function getStoreInfo(db: Database, storeId?: number | null): StoreInfo | undefined {
  let row: any;
  if (storeId) {
    row = db
      .prepare('SELECT name, company_name, cnpj, street, number, neighborhood, city, state, phone FROM stores WHERE id = ?')
      .get(storeId);
  }
  if (!row) {
    row = db
      .prepare('SELECT name, company_name, cnpj, street, number, neighborhood, city, state, phone FROM stores LIMIT 1')
      .get();
  }

  if (!row) return undefined;

  const address = row.street
    ? `${row.street}, ${row.number || 'S/N'}${row.neighborhood ? ` - ${row.neighborhood}` : ''}`
    : undefined;
  const city = row.city && row.state ? `${row.city} - ${row.state}` : row.city;

  return {
    storeName: row.name || row.company_name,
    cnpj: row.cnpj,
    address,
    city,
    phone: row.phone,
  };
}

// =========================================================================
// Registro de Rotas Fastify do CRM
// =========================================================================

export function registerCrmRoutes(app: FastifyInstance, db: Database): void {
  const loyaltyService = new LoyaltyService(db);
  const promotionService = new PromotionEngineService(db);
  const treatmentService = new TreatmentAdherenceService(db);

  // -------------------------------------------------------------------------
  // 1. FIDELIDADE E CASHBACK (/api/crm/loyalty/*)
  // -------------------------------------------------------------------------

  // GET /api/crm/loyalty/program
  app.get('/api/crm/loyalty/program', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { storeId?: string | number };
    const storeId = query?.storeId ? Number(query.storeId) : undefined;
    const config = loyaltyService.getProgramConfig(storeId);
    return reply.status(200).send(config);
  });

  // PUT /api/crm/loyalty/program
  app.put('/api/crm/loyalty/program', async (req: FastifyRequest, reply: FastifyReply) => {
    const parseResult = updateLoyaltyProgramSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Dados inválidos para configuração do programa de fidelidade',
        errors: parseResult.error.format(),
      });
    }

    const data = parseResult.data;
    const updated = loyaltyService.updateProgramConfig({
      storeId: data.storeId ?? data.store_id ?? null,
      name: data.name,
      cashbackPercent: data.cashbackPercent ?? data.cashback_percent,
      validityDays: data.validityDays ?? data.validity_days,
      minPurchaseAmount: data.minPurchaseAmount ?? data.min_purchase_amount,
      minRedeemAmount: data.minRedeemAmount ?? data.min_redeem_amount,
      maxRedeemPercent: data.maxRedeemPercent ?? data.max_redeem_percent,
      allowWithPromotions:
        data.allowWithPromotions !== undefined
          ? data.allowWithPromotions
          : data.allow_with_promotions !== undefined
            ? Boolean(data.allow_with_promotions)
            : undefined,
      isActive:
        data.isActive !== undefined
          ? data.isActive
          : data.is_active !== undefined
            ? Boolean(data.is_active)
            : undefined,
    });

    return reply.status(200).send(updated);
  });

  // GET /api/crm/loyalty/wallet/:customerId
  app.get('/api/crm/loyalty/wallet/:customerId', async (req: FastifyRequest, reply: FastifyReply) => {
    const params = req.params as { customerId: string };
    const customerId = Number(params.customerId);

    const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      return reply.status(404).send({ message: `Cliente com ID ${customerId} não encontrado` });
    }

    const wallet = loyaltyService.getOrCreateWallet(customerId);
    return reply.status(200).send(wallet);
  });

  // GET /api/crm/loyalty/wallet/:customerId/statement
  app.get('/api/crm/loyalty/wallet/:customerId/statement', async (req: FastifyRequest, reply: FastifyReply) => {
    const params = req.params as { customerId: string };
    const customerId = Number(params.customerId);

    const customer = db
      .prepare('SELECT id, name, cpf, phone, store_id FROM customers WHERE id = ?')
      .get(customerId) as any;
    if (!customer) {
      return reply.status(404).send({ message: `Cliente com ID ${customerId} não encontrado` });
    }

    const statement = loyaltyService.getWalletStatement(customerId);
    const program = loyaltyService.getProgramConfig(customer.store_id || undefined);
    const storeInfo = getStoreInfo(db, customer.store_id);

    const formatted = formatCashbackStatement({
      store: storeInfo,
      customer: {
        id: customer.id,
        name: customer.name,
        cpf: customer.cpf,
        phone: customer.phone,
      },
      wallet: statement.wallet,
      transactions: statement.transactions,
      program,
    });

    return reply.status(200).send({
      wallet: statement.wallet,
      transactions: statement.transactions,
      textReceipt: formatted.textReceipt,
      fullEscPos: formatted.fullEscPos,
    });
  });

  // POST /api/crm/loyalty/redeem
  app.post('/api/crm/loyalty/redeem', async (req: FastifyRequest, reply: FastifyReply) => {
    const parseResult = redeemCashbackSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Dados inválidos para resgate de cashback',
        errors: parseResult.error.format(),
      });
    }

    const data = parseResult.data;
    const customerId = (data.customerId ?? data.customer_id)!;
    const saleAmount = (data.saleAmount ?? data.sale_amount)!;
    const requestedRedeem = (data.requestedRedeem ?? data.requested_redeem)!;
    const saleId = data.saleId ?? data.sale_id;

    const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      return reply.status(404).send({ message: `Cliente com ID ${customerId} não encontrado` });
    }

    try {
      const tx = loyaltyService.redeemCashback({
        customerId,
        saleAmount,
        requestedRedeem,
        saleId,
        notes: data.notes,
      });

      return reply.status(200).send(tx);
    } catch (err: any) {
      if (err instanceof LoyaltyError) {
        if (err.code === 'CUSTOMER_NOT_FOUND') {
          return reply.status(404).send({ message: err.message, code: err.code });
        }
        return reply.status(400).send({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  // POST /api/crm/loyalty/expire
  app.post('/api/crm/loyalty/expire', async (req: FastifyRequest, reply: FastifyReply) => {
    const parseResult = expireCashbackSchema.safeParse(req.body || {});
    const refDate = parseResult.success
      ? parseResult.data.referenceDate ?? parseResult.data.reference_date
      : undefined;

    const result = loyaltyService.expireOverdueCashback(refDate);
    return reply.status(200).send(result);
  });

  // -------------------------------------------------------------------------
  // 2. PROMOÇÕES COMBINADAS (/api/crm/promotions/*)
  // -------------------------------------------------------------------------

  // GET /api/crm/promotions
  app.get('/api/crm/promotions', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as {
      activeOnly?: string | boolean;
      type?: PromotionType;
      search?: string;
      storeId?: string | number;
    };

    const promotions = promotionService.listPromotions({
      activeOnly: query.activeOnly === 'true' || query.activeOnly === true,
      type: query.type,
      search: query.search,
      storeId: query.storeId ? Number(query.storeId) : undefined,
    });

    return reply.status(200).send(promotions);
  });

  // POST /api/crm/promotions
  app.post('/api/crm/promotions', async (req: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createPromotionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Dados inválidos para criação de promoção',
        errors: parseResult.error.format(),
      });
    }

    const data = parseResult.data;
    const startDate = (data.startDate ?? data.start_date)!;
    const endDate = (data.endDate ?? data.end_date)!;
    const conditionsJson = (data.conditionsJson ?? data.conditions_json)!;

    const products = data.products?.map((p) => ({
      productId: (p.productId ?? p.product_id)!,
      role: p.role as PromotionProductRole | undefined,
      specialPrice: p.specialPrice ?? p.special_price,
      discountPercent: p.discountPercent ?? p.discount_percent,
    }));

    try {
      const created = promotionService.createPromotion({
        name: data.name,
        description: data.description,
        type: data.type as PromotionType,
        startDate,
        endDate,
        priority: data.priority,
        isActive:
          data.isActive !== undefined
            ? data.isActive
            : data.is_active !== undefined
              ? Boolean(data.is_active)
              : true,
        appliesTo: (data.appliesTo ?? data.applies_to) as PromotionAppliesTo | undefined,
        targetCategory: data.targetCategory ?? data.target_category,
        conditionsJson,
        products,
      });

      return reply.status(201).send(created);
    } catch (err: any) {
      if (err instanceof PromotionError) {
        return reply.status(400).send({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  // GET /api/crm/promotions/:id
  app.get('/api/crm/promotions/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const params = req.params as { id: string };
    const id = Number(params.id);

    const promotion = promotionService.getPromotionById(id);
    if (!promotion) {
      return reply.status(404).send({ message: `Promoção com ID ${id} não encontrada` });
    }

    return reply.status(200).send(promotion);
  });

  // PUT /api/crm/promotions/:id
  app.put('/api/crm/promotions/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const params = req.params as { id: string };
    const id = Number(params.id);

    const parseResult = updatePromotionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Dados inválidos para atualização de promoção',
        errors: parseResult.error.format(),
      });
    }

    const data = parseResult.data;
    const products = data.products?.map((p) => ({
      productId: (p.productId ?? p.product_id)!,
      role: p.role as PromotionProductRole | undefined,
      specialPrice: p.specialPrice ?? p.special_price,
      discountPercent: p.discountPercent ?? p.discount_percent,
    }));

    try {
      const updated = promotionService.updatePromotion(id, {
        name: data.name,
        description: data.description,
        type: data.type,
        startDate: data.startDate ?? data.start_date,
        endDate: data.endDate ?? data.end_date,
        priority: data.priority,
        isActive:
          data.isActive !== undefined
            ? data.isActive
            : data.is_active !== undefined
              ? Boolean(data.is_active)
              : undefined,
        appliesTo: (data.appliesTo ?? data.applies_to) as PromotionAppliesTo | undefined,
        targetCategory: data.targetCategory ?? data.target_category,
        conditionsJson: data.conditionsJson ?? data.conditions_json,
        products,
      });

      return reply.status(200).send(updated);
    } catch (err: any) {
      if (err instanceof PromotionError) {
        if (err.code === 'PROMOTION_NOT_FOUND') {
          return reply.status(404).send({ message: err.message, code: err.code });
        }
        return reply.status(400).send({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  // DELETE /api/crm/promotions/:id
  app.delete('/api/crm/promotions/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const params = req.params as { id: string };
    const id = Number(params.id);

    try {
      const deleted = promotionService.deletePromotion(id);
      if (!deleted) {
        return reply.status(404).send({ message: `Promoção com ID ${id} não encontrada` });
      }
      return reply.status(200).send({ message: 'Promoção excluída com sucesso', id });
    } catch (err: any) {
      if (err instanceof PromotionError && err.code === 'PROMOTION_NOT_FOUND') {
        return reply.status(404).send({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  // POST /api/crm/promotions/evaluate
  app.post('/api/crm/promotions/evaluate', async (req: FastifyRequest, reply: FastifyReply) => {
    const parseResult = evaluateCartSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Dados inválidos para avaliação do carrinho',
        errors: parseResult.error.format(),
      });
    }

    const data = parseResult.data;
    const cartItems = data.items.map((i) => ({
      productId: (i.productId ?? i.product_id)!,
      quantity: i.quantity,
      unitPrice: (i.unitPrice ?? i.unit_price)!,
      cmedMaxPrice: i.cmedMaxPrice ?? i.cmed_max_price,
      category: i.category,
    }));

    const customerId = data.customerId ?? data.customer_id;
    const storeId = data.storeId ?? data.store_id;
    const referenceDate = data.referenceDate ?? data.reference_date;

    const evaluation = promotionService.evaluateCart(
      cartItems,
      customerId,
      storeId,
      referenceDate
    );

    return reply.status(200).send(evaluation);
  });

  // -------------------------------------------------------------------------
  // 3. ADESÃO A TRATAMENTO CONTÍNUO (/api/crm/treatments/*)
  // -------------------------------------------------------------------------

  // GET /api/crm/treatments/upcoming
  app.get('/api/crm/treatments/upcoming', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as {
      daysAhead?: string | number;
      storeId?: string | number;
      status?: string;
    };

    const daysAhead = query.daysAhead ? Number(query.daysAhead) : 7;
    const storeId = query.storeId ? Number(query.storeId) : undefined;
    const status = query.status as any;

    const items = treatmentService.listUpcomingRefills({
      daysAhead,
      storeId,
      status,
    });

    return reply.status(200).send(items);
  });

  // GET /api/crm/treatments/customer/:customerId
  app.get('/api/crm/treatments/customer/:customerId', async (req: FastifyRequest, reply: FastifyReply) => {
    const params = req.params as { customerId: string };
    const customerId = Number(params.customerId);

    try {
      const treatments = treatmentService.getCustomerTreatments(customerId);
      return reply.status(200).send(treatments);
    } catch (err: any) {
      if (err instanceof TreatmentError && err.code === 'CUSTOMER_NOT_FOUND') {
        return reply.status(404).send({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  // POST /api/crm/treatments/:id/contact
  app.post('/api/crm/treatments/:id/contact', async (req: FastifyRequest, reply: FastifyReply) => {
    const params = req.params as { id: string };
    const treatmentId = Number(params.id);

    const parseResult = contactTreatmentSchema.safeParse(req.body || {});
    const notes = parseResult.success ? parseResult.data.notes : undefined;

    try {
      const updated = treatmentService.markAsContacted(treatmentId, notes);
      return reply.status(200).send(updated);
    } catch (err: any) {
      if (err instanceof TreatmentError && err.code === 'TREATMENT_NOT_FOUND') {
        return reply.status(404).send({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  // POST /api/crm/treatments/:id/discontinue
  app.post('/api/crm/treatments/:id/discontinue', async (req: FastifyRequest, reply: FastifyReply) => {
    const params = req.params as { id: string };
    const treatmentId = Number(params.id);

    const parseResult = discontinueTreatmentSchema.safeParse(req.body || {});
    const reason = parseResult.success ? parseResult.data.reason : undefined;

    try {
      const updated = treatmentService.discontinueTreatment(treatmentId, reason);
      return reply.status(200).send(updated);
    } catch (err: any) {
      if (err instanceof TreatmentError && err.code === 'TREATMENT_NOT_FOUND') {
        return reply.status(404).send({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  // GET /api/crm/treatments/:id/slip
  app.get('/api/crm/treatments/:id/slip', async (req: FastifyRequest, reply: FastifyReply) => {
    const params = req.params as { id: string };
    const id = Number(params.id);

    const row = db
      .prepare(
        `SELECT pt.*,
                c.name AS customer_name, c.phone AS customer_phone, c.cpf AS customer_cpf, c.store_id AS customer_store_id,
                p.name AS product_name, p.active_ingredient
         FROM patient_treatments pt
         LEFT JOIN customers c ON c.id = pt.customer_id
         LEFT JOIN products p ON p.id = pt.product_id
         WHERE pt.id = ?`
      )
      .get(id) as any;

    if (!row) {
      return reply.status(404).send({ message: `Tratamento com ID ${id} não encontrado` });
    }

    const storeInfo = getStoreInfo(db, row.customer_store_id);

    const treatmentObj = {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      productId: row.product_id,
      productName: row.product_name,
      dosage: row.active_ingredient,
      dailyDose: Number(row.daily_dose),
      unitsPerBox: Number(row.units_per_box),
      boxesPurchased: Number(row.boxes_purchased),
      totalDaysSupply: Number(row.total_days_supply),
      startDate: row.start_date,
      expectedRefillDate: row.expected_refill_date,
      status: row.status,
      notes: row.notes,
    };

    const formatted = formatTreatmentRefillSlip({
      store: storeInfo,
      treatment: treatmentObj,
      customer: {
        id: row.customer_id,
        name: row.customer_name,
        cpf: row.customer_cpf,
        phone: row.customer_phone,
      },
      product: {
        id: row.product_id,
        name: row.product_name,
        dosage: row.active_ingredient,
      },
    });

    return reply.status(200).send({
      treatment: treatmentObj,
      textReceipt: formatted.textReceipt,
      fullEscPos: formatted.fullEscPos,
    });
  });
}
