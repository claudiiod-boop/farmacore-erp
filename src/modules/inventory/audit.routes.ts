import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Database } from '../../database/connection';
import { InventoryAuditService } from './audit.service';
import { StoreService } from '../stores/store.service';
import { formatBalanceSlip } from './balance-slip-formatter';
import type {
  CreateInventorySessionInput,
  AddCountInput,
  ApplyAdjustmentsParams,
  InventorySessionFilters,
  InventoryType,
  InventoryStatus,
  AdjustmentReason,
} from './audit-types';

export const createInventorySessionSchema = z
  .object({
    storeId: z.number().int().positive().optional(),
    store_id: z.number().int().positive().optional(),
    inventoryType: z.enum(['GERAL', 'ROTATIVO', 'CONTROLADOS_SNGPC']).optional(),
    inventory_type: z.enum(['GERAL', 'ROTATIVO', 'CONTROLADOS_SNGPC']).optional(),
    categoryFilter: z.string().trim().nullable().optional(),
    category_filter: z.string().trim().nullable().optional(),
    openedBy: z.string().trim().min(1).optional(),
    opened_by: z.string().trim().min(1).optional(),
    notes: z.string().trim().nullable().optional(),
  })
  .refine((d) => (d.storeId ?? d.store_id) !== undefined, {
    message: 'storeId é obrigatório e deve ser positivo',
    path: ['storeId'],
  })
  .refine((d) => (d.inventoryType ?? d.inventory_type) !== undefined, {
    message: 'inventoryType é obrigatório (GERAL, ROTATIVO, CONTROLADOS_SNGPC)',
    path: ['inventoryType'],
  })
  .refine((d) => (d.openedBy ?? d.opened_by) !== undefined && (d.openedBy ?? d.opened_by)!.length > 0, {
    message: 'openedBy é obrigatório',
    path: ['openedBy'],
  });

export const addCountSchema = z
  .object({
    productId: z.number().int().positive().optional(),
    product_id: z.number().int().positive().optional(),
    ean: z.string().trim().min(1).optional(),
    batchNumber: z.string().trim().min(1).optional(),
    batch_number: z.string().trim().min(1).optional(),
    expirationDate: z.string().trim().min(1).optional(),
    expiration_date: z.string().trim().min(1).optional(),
    manufacturingDate: z.string().trim().optional(),
    manufacturing_date: z.string().trim().optional(),
    quantity: z.number().min(0, 'quantity deve ser não negativa'),
    unitCost: z.number().min(0).optional(),
    unit_cost: z.number().min(0).optional(),
    isIncremental: z.boolean().optional(),
    is_incremental: z.boolean().optional(),
  })
  .refine(
    (d) =>
      ((d.productId ?? d.product_id) !== undefined && (d.productId ?? d.product_id)! > 0) ||
      (d.ean !== undefined && d.ean.length > 0),
    {
      message: 'Ao menos productId ou ean deve ser fornecido',
      path: ['productId'],
    }
  )
  .refine(
    (d) => (d.batchNumber ?? d.batch_number) !== undefined && (d.batchNumber ?? d.batch_number)!.length > 0,
    {
      message: 'batchNumber é obrigatório',
      path: ['batchNumber'],
    }
  )
  .refine(
    (d) => (d.expirationDate ?? d.expiration_date) !== undefined && (d.expirationDate ?? d.expiration_date)!.length > 0,
    {
      message: 'expirationDate é obrigatório',
      path: ['expirationDate'],
    }
  );

export const recountSchema = z
  .object({
    recountQuantity: z.number().min(0).optional(),
    recount_quantity: z.number().min(0).optional(),
  })
  .refine((d) => (d.recountQuantity ?? d.recount_quantity) !== undefined, {
    message: 'recountQuantity é obrigatório e deve ser >= 0',
    path: ['recountQuantity'],
  });

export const applyAdjustmentsSchema = z
  .object({
    appliedBy: z.string().trim().min(1).optional(),
    applied_by: z.string().trim().min(1).optional(),
    responsiblePharmacistCrf: z.string().trim().nullable().optional(),
    responsible_pharmacist_crf: z.string().trim().nullable().optional(),
    responsiblePharmacistUf: z.string().trim().nullable().optional(),
    responsible_pharmacist_uf: z.string().trim().nullable().optional(),
    itemReasons: z
      .record(
        z.string(),
        z.object({
          reason: z.enum([
            'AVARIA',
            'VENCIMENTO',
            'FURTO_EXTRAVIO',
            'ERRO_OPERACIONAL',
            'QUEBRA_ARMAZENAMENTO',
            'AJUSTE_INVENTARIO',
            'SOBRA_NAO_IDENTIFICADA',
          ]),
          notes: z.string().optional(),
        })
      )
      .optional(),
    item_reasons: z
      .record(
        z.string(),
        z.object({
          reason: z.enum([
            'AVARIA',
            'VENCIMENTO',
            'FURTO_EXTRAVIO',
            'ERRO_OPERACIONAL',
            'QUEBRA_ARMAZENAMENTO',
            'AJUSTE_INVENTARIO',
            'SOBRA_NAO_IDENTIFICADA',
          ]),
          notes: z.string().optional(),
        })
      )
      .optional(),
  })
  .refine((d) => (d.appliedBy ?? d.applied_by) !== undefined && (d.appliedBy ?? d.applied_by)!.length > 0, {
    message: 'appliedBy é obrigatório',
    path: ['appliedBy'],
  });

export const cancelSessionSchema = z.object({
  reason: z.string().trim().min(1, 'Motivo do cancelamento é obrigatório'),
});

export function registerInventoryRoutes(app: FastifyInstance, db: Database): void {
  const inventoryAuditService = new InventoryAuditService(db);
  const storeService = new StoreService(db);

  // GET /api/inventory/sessions - List inventory sessions
  app.get<{
    Querystring: {
      storeId?: string;
      store_id?: string;
      status?: InventoryStatus;
      inventoryType?: InventoryType;
      inventory_type?: InventoryType;
      startDate?: string;
      start_date?: string;
      endDate?: string;
      end_date?: string;
      limit?: string;
      offset?: string;
    };
  }>('/api/inventory/sessions', async (req, reply) => {
    const q = req.query || {};
    const filters: InventorySessionFilters = {
      storeId: q.storeId ? Number(q.storeId) : q.store_id ? Number(q.store_id) : undefined,
      status: q.status,
      inventoryType: q.inventoryType || q.inventory_type,
      startDate: q.startDate || q.start_date,
      endDate: q.endDate || q.end_date,
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
    };

    const result = inventoryAuditService.listSessions(filters);
    return reply.status(200).send(result);
  });

  // GET /api/inventory/sessions/:id - Get session by ID
  app.get<{ Params: { id: string } }>('/api/inventory/sessions/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_INVENTORY_SESSION_ID',
        message: 'O identificador da sessão de inventário deve ser um número positivo',
      });
    }

    const session = inventoryAuditService.getSessionById(id);
    if (!session) {
      return reply.status(404).send({
        error: 'INVENTORY_SESSION_NOT_FOUND',
        message: `Sessão de inventário #${id} não encontrada`,
      });
    }

    return reply.status(200).send(session);
  });

  // POST /api/inventory/sessions - Create session
  app.post('/api/inventory/sessions', async (req: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createInventorySessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'Dados inválidos para criação de sessão de inventário',
        issues: parseResult.error.issues,
      });
    }

    const data = parseResult.data;
    const input: CreateInventorySessionInput = {
      storeId: (data.storeId ?? data.store_id)!,
      inventoryType: (data.inventoryType ?? data.inventory_type)!,
      categoryFilter: data.categoryFilter ?? data.category_filter ?? null,
      openedBy: (data.openedBy ?? data.opened_by)!,
      notes: data.notes ?? null,
    };

    try {
      const created = inventoryAuditService.createSession(input);
      return reply.status(201).send(created);
    } catch (err: any) {
      const msg = err.message || 'Erro ao criar sessão de inventário';
      const lower = msg.toLowerCase();
      if (
        lower.includes('já existe') ||
        lower.includes('ja existe') ||
        lower.includes('conflito') ||
        lower.includes('aberta')
      ) {
        return reply.status(409).send({
          error: 'INVENTORY_SESSION_CONFLICT',
          message: msg,
        });
      }
      return reply.status(400).send({
        error: 'INVENTORY_CREATION_FAILED',
        message: msg,
      });
    }
  });

  // POST /api/inventory/sessions/:id/count - Add count
  app.post<{ Params: { id: string } }>('/api/inventory/sessions/:id/count', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_INVENTORY_SESSION_ID',
        message: 'O identificador da sessão de inventário deve ser um número positivo',
      });
    }

    const parseResult = addCountSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'Dados inválidos para registro de contagem',
        issues: parseResult.error.issues,
      });
    }

    const data = parseResult.data;
    const input: AddCountInput = {
      productId: data.productId ?? data.product_id,
      ean: data.ean,
      batchNumber: (data.batchNumber ?? data.batch_number)!,
      expirationDate: (data.expirationDate ?? data.expiration_date)!,
      manufacturingDate: data.manufacturingDate ?? data.manufacturing_date,
      quantity: data.quantity,
      unitCost: data.unitCost ?? data.unit_cost,
      isIncremental: data.isIncremental ?? data.is_incremental,
    };

    try {
      const item = inventoryAuditService.addCount(id, input);
      return reply.status(200).send(item);
    } catch (err: any) {
      const msg = err.message || 'Erro ao registrar contagem';
      if (msg.includes('não encontrada') || msg.includes('não encontrado')) {
        return reply.status(404).send({
          error: 'INVENTORY_NOT_FOUND',
          message: msg,
        });
      }
      return reply.status(400).send({
        error: 'INVENTORY_COUNT_FAILED',
        message: msg,
      });
    }
  });

  // PUT /api/inventory/sessions/:id/items/:itemId/recount - Recount item
  app.put<{ Params: { id: string; itemId: string } }>(
    '/api/inventory/sessions/:id/items/:itemId/recount',
    async (req, reply) => {
      const id = Number(req.params.id);
      const itemId = Number(req.params.itemId);
      if (isNaN(id) || id <= 0 || isNaN(itemId) || itemId <= 0) {
        return reply.status(400).send({
          error: 'INVALID_ID',
          message: 'Os identificadores devem ser números positivos',
        });
      }

      const parseResult = recountSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Dados inválidos para recontagem',
          issues: parseResult.error.issues,
        });
      }

      const recountQuantity = (parseResult.data.recountQuantity ?? parseResult.data.recount_quantity)!;

      try {
        const item = inventoryAuditService.recountItem(id, itemId, recountQuantity);
        return reply.status(200).send(item);
      } catch (err: any) {
        const msg = err.message || 'Erro ao registrar recontagem';
        if (msg.includes('não encontrada') || msg.includes('não encontrado')) {
          return reply.status(404).send({
            error: 'INVENTORY_NOT_FOUND',
            message: msg,
          });
        }
        return reply.status(400).send({
          error: 'INVENTORY_RECOUNT_FAILED',
          message: msg,
        });
      }
    }
  );

  // POST /api/inventory/sessions/:id/finish-count - Finish counting
  app.post<{ Params: { id: string } }>('/api/inventory/sessions/:id/finish-count', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_INVENTORY_SESSION_ID',
        message: 'O identificador da sessão de inventário deve ser um número positivo',
      });
    }

    try {
      const updated = inventoryAuditService.finishCounting(id);
      return reply.status(200).send(updated);
    } catch (err: any) {
      const msg = err.message || 'Erro ao finalizar contagens';
      if (msg.includes('não encontrada') || msg.includes('não encontrado')) {
        return reply.status(404).send({
          error: 'INVENTORY_NOT_FOUND',
          message: msg,
        });
      }
      return reply.status(400).send({
        error: 'INVENTORY_FINISH_COUNT_FAILED',
        message: msg,
      });
    }
  });

  // POST /api/inventory/sessions/:id/apply - Apply adjustments
  app.post<{ Params: { id: string } }>('/api/inventory/sessions/:id/apply', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_INVENTORY_SESSION_ID',
        message: 'O identificador da sessão de inventário deve ser um número positivo',
      });
    }

    const parseResult = applyAdjustmentsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'Dados inválidos para homologação de inventário',
        issues: parseResult.error.issues,
      });
    }

    const data = parseResult.data;
    const rawItemReasons = data.itemReasons ?? data.item_reasons;
    let itemReasons: Record<number, { reason: AdjustmentReason; notes?: string }> | undefined;

    if (rawItemReasons) {
      itemReasons = {};
      for (const [key, val] of Object.entries(rawItemReasons)) {
        itemReasons[Number(key)] = val as { reason: AdjustmentReason; notes?: string };
      }
    }

    const params: ApplyAdjustmentsParams = {
      appliedBy: (data.appliedBy ?? data.applied_by)!,
      responsiblePharmacistCrf: data.responsiblePharmacistCrf ?? data.responsible_pharmacist_crf ?? undefined,
      responsiblePharmacistUf: data.responsiblePharmacistUf ?? data.responsible_pharmacist_uf ?? undefined,
      itemReasons,
    };

    try {
      const updated = inventoryAuditService.applyAdjustments(id, params);
      return reply.status(200).send(updated);
    } catch (err: any) {
      const msg = err.message || 'Erro ao homologar inventário';
      if (msg.includes('não encontrada') || msg.includes('não encontrado')) {
        return reply.status(404).send({
          error: 'INVENTORY_NOT_FOUND',
          message: msg,
        });
      }
      return reply.status(400).send({
        error: 'INVENTORY_APPLY_FAILED',
        message: msg,
      });
    }
  });

  // POST /api/inventory/sessions/:id/cancel - Cancel session
  app.post<{ Params: { id: string } }>('/api/inventory/sessions/:id/cancel', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_INVENTORY_SESSION_ID',
        message: 'O identificador da sessão de inventário deve ser um número positivo',
      });
    }

    const parseResult = cancelSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'Dados inválidos para cancelamento',
        issues: parseResult.error.issues,
      });
    }

    try {
      const updated = inventoryAuditService.cancelSession(id, parseResult.data.reason);
      return reply.status(200).send(updated);
    } catch (err: any) {
      const msg = err.message || 'Erro ao cancelar inventário';
      if (msg.includes('não encontrada') || msg.includes('não encontrado')) {
        return reply.status(404).send({
          error: 'INVENTORY_NOT_FOUND',
          message: msg,
        });
      }
      return reply.status(400).send({
        error: 'INVENTORY_CANCEL_FAILED',
        message: msg,
      });
    }
  });

  // GET /api/inventory/sessions/:id/report - Get report & balance slip
  app.get<{ Params: { id: string } }>('/api/inventory/sessions/:id/report', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_INVENTORY_SESSION_ID',
        message: 'O identificador da sessão de inventário deve ser um número positivo',
      });
    }

    const session = inventoryAuditService.getSessionById(id);
    if (!session) {
      return reply.status(404).send({
        error: 'INVENTORY_SESSION_NOT_FOUND',
        message: `Sessão de inventário #${id} não encontrada`,
      });
    }

    const store = storeService.getStoreById(session.storeId);
    if (!store) {
      return reply.status(404).send({
        error: 'STORE_NOT_FOUND',
        message: `Filial #${session.storeId} não encontrada`,
      });
    }

    const { textSlip, fullEscPos } = formatBalanceSlip(session, store);

    return reply.status(200).send({
      textSlip,
      fullEscPos,
      session,
      store,
    });
  });
}
