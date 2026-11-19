import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Database } from '../../database/connection';
import { TransferService } from './transfer.service';
import { TransferFiscalService } from './transfer-fiscal.service';
import type {
  CreateTransferInput,
  CarrierInfo,
  ReceiveItemInput,
  TransferFilters,
  TransferStatus,
} from './types';

const createTransferItemSchema = z
  .object({
    productId: z.number().int().positive().optional(),
    product_id: z.number().int().positive().optional(),
    requestedQuantity: z.number().positive().optional(),
    requested_quantity: z.number().positive().optional(),
    unitCost: z.number().min(0).optional(),
    unit_cost: z.number().min(0).optional(),
    sourceBatchId: z.number().int().positive().nullable().optional(),
    source_batch_id: z.number().int().positive().nullable().optional(),
    batchNumber: z.string().optional(),
    batch_number: z.string().optional(),
    expirationDate: z.string().optional(),
    expiration_date: z.string().optional(),
    manufacturingDate: z.string().optional(),
    manufacturing_date: z.string().optional(),
  })
  .refine(
    (d) => (d.productId ?? d.product_id) !== undefined && (d.productId ?? d.product_id)! > 0,
    {
      message: 'productId deve ser um número positivo',
      path: ['productId'],
    }
  )
  .refine(
    (d) => (d.requestedQuantity ?? d.requested_quantity) !== undefined && (d.requestedQuantity ?? d.requested_quantity)! > 0,
    {
      message: 'requestedQuantity deve ser maior que zero',
      path: ['requestedQuantity'],
    }
  );

const createTransferSchema = z
  .object({
    sourceStoreId: z.number().int().positive().optional(),
    source_store_id: z.number().int().positive().optional(),
    targetStoreId: z.number().int().positive().optional(),
    target_store_id: z.number().int().positive().optional(),
    requestedBy: z.string().trim().min(1).optional(),
    requested_by: z.string().trim().min(1).optional(),
    notes: z.string().nullable().optional(),
    status: z.enum(['DRAFT', 'REQUESTED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED']).optional(),
    cfop: z.string().optional(),
    items: z.array(createTransferItemSchema).min(1, 'A transferência deve conter ao menos um item'),
  })
  .refine((d) => (d.sourceStoreId ?? d.source_store_id) !== undefined, {
    message: 'sourceStoreId é obrigatório',
    path: ['sourceStoreId'],
  })
  .refine((d) => (d.targetStoreId ?? d.target_store_id) !== undefined, {
    message: 'targetStoreId é obrigatório',
    path: ['targetStoreId'],
  })
  .refine((d) => (d.requestedBy ?? d.requested_by) !== undefined && (d.requestedBy ?? d.requested_by)!.length > 0, {
    message: 'requestedBy é obrigatório',
    path: ['requestedBy'],
  });

const dispatchTransferSchema = z
  .object({
    dispatchedBy: z.string().trim().min(1).optional(),
    dispatched_by: z.string().trim().min(1).optional(),
    carrierName: z.string().trim().nullable().optional(),
    carrier_name: z.string().trim().nullable().optional(),
    trackingCode: z.string().trim().nullable().optional(),
    tracking_code: z.string().trim().nullable().optional(),
  })
  .refine(
    (d) => (d.dispatchedBy ?? d.dispatched_by) !== undefined && (d.dispatchedBy ?? d.dispatched_by)!.length > 0,
    {
      message: 'dispatchedBy é obrigatório',
      path: ['dispatchedBy'],
    }
  );

const receiveItemSchema = z.object({
  itemId: z.number().int().positive().optional(),
  item_id: z.number().int().positive().optional(),
  productId: z.number().int().positive().optional(),
  product_id: z.number().int().positive().optional(),
  receivedQuantity: z.number().min(0).optional(),
  received_quantity: z.number().min(0).optional(),
  batchNumber: z.string().optional(),
  batch_number: z.string().optional(),
  expirationDate: z.string().optional(),
  expiration_date: z.string().optional(),
});

const receiveTransferSchema = z
  .object({
    receivedBy: z.string().trim().min(1).optional(),
    received_by: z.string().trim().min(1).optional(),
    itemsConfirmed: z.array(receiveItemSchema).optional(),
    items_confirmed: z.array(receiveItemSchema).optional(),
  })
  .refine((d) => (d.receivedBy ?? d.received_by) !== undefined && (d.receivedBy ?? d.received_by)!.length > 0, {
    message: 'receivedBy é obrigatório',
    path: ['receivedBy'],
  });

const cancelTransferSchema = z.object({
  reason: z.string().trim().min(1, 'Motivo do cancelamento é obrigatório'),
});

export function registerTransferRoutes(app: FastifyInstance, db: Database): void {
  const transferService = new TransferService(db);
  const transferFiscalService = new TransferFiscalService(db);

  // GET /api/transfers - List transfers with filters and pagination
  app.get<{
    Querystring: {
      status?: TransferStatus;
      sourceStoreId?: string;
      source_store_id?: string;
      targetStoreId?: string;
      target_store_id?: string;
      startDate?: string;
      start_date?: string;
      endDate?: string;
      end_date?: string;
      limit?: string;
      offset?: string;
    };
  }>('/api/transfers', async (req, reply) => {
    const q = req.query || {};
    const filters: TransferFilters = {
      status: q.status,
      sourceStoreId: q.sourceStoreId ? Number(q.sourceStoreId) : (q.source_store_id ? Number(q.source_store_id) : undefined),
      targetStoreId: q.targetStoreId ? Number(q.targetStoreId) : (q.target_store_id ? Number(q.target_store_id) : undefined),
      startDate: q.startDate || q.start_date,
      endDate: q.endDate || q.end_date,
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
    };

    const result = transferService.listTransfers(filters);
    return reply.status(200).send(result);
  });

  // GET /api/transfers/:id - Get transfer by ID
  app.get<{ Params: { id: string } }>('/api/transfers/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_TRANSFER_ID',
        message: 'O identificador da transferência deve ser um número positivo',
      });
    }

    const transfer = transferService.getTransferById(id);
    if (!transfer) {
      return reply.status(404).send({
        error: 'TRANSFER_NOT_FOUND',
        message: `Transferência #${id} não encontrada`,
      });
    }

    return reply.status(200).send(transfer);
  });

  // POST /api/transfers - Create new transfer
  app.post('/api/transfers', async (req: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createTransferSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'Dados inválidos para criação de transferência',
        issues: parseResult.error.issues,
      });
    }

    try {
      const created = transferService.createTransfer(parseResult.data as CreateTransferInput);
      return reply.status(201).send(created);
    } catch (err: any) {
      return reply.status(400).send({
        error: 'TRANSFER_CREATION_FAILED',
        message: err.message || 'Erro ao criar transferência',
      });
    }
  });

  // POST /api/transfers/:id/dispatch - Dispatch transfer
  app.post<{ Params: { id: string } }>('/api/transfers/:id/dispatch', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_TRANSFER_ID',
        message: 'O identificador da transferência deve ser um número positivo',
      });
    }

    const parseResult = dispatchTransferSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'Dados inválidos para despacho',
        issues: parseResult.error.issues,
      });
    }

    const body = parseResult.data;
    const dispatchedBy = (body.dispatchedBy ?? body.dispatched_by)!;
    const carrierInfo: CarrierInfo = {
      carrierName: body.carrierName ?? body.carrier_name,
      trackingCode: body.trackingCode ?? body.tracking_code,
    };

    try {
      const dispatched = transferService.dispatchTransfer(id, dispatchedBy, carrierInfo);
      return reply.status(200).send(dispatched);
    } catch (err: any) {
      const msg = err.message || 'Erro ao despachar transferência';
      if (msg.includes('não encontrada')) {
        return reply.status(404).send({
          error: 'TRANSFER_NOT_FOUND',
          message: msg,
        });
      }
      return reply.status(400).send({
        error: 'TRANSFER_DISPATCH_FAILED',
        message: msg,
      });
    }
  });

  // POST /api/transfers/:id/receive - Receive transfer
  app.post<{ Params: { id: string } }>('/api/transfers/:id/receive', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_TRANSFER_ID',
        message: 'O identificador da transferência deve ser um número positivo',
      });
    }

    const parseResult = receiveTransferSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'Dados inválidos para recebimento',
        issues: parseResult.error.issues,
      });
    }

    const body = parseResult.data;
    const receivedBy = (body.receivedBy ?? body.received_by)!;
    const itemsConfirmed = (body.itemsConfirmed ?? body.items_confirmed) as ReceiveItemInput[] | undefined;

    try {
      const received = transferService.receiveTransfer(id, receivedBy, itemsConfirmed);
      return reply.status(200).send(received);
    } catch (err: any) {
      const msg = err.message || 'Erro ao receber transferência';
      if (msg.includes('não encontrada')) {
        return reply.status(404).send({
          error: 'TRANSFER_NOT_FOUND',
          message: msg,
        });
      }
      return reply.status(400).send({
        error: 'TRANSFER_RECEIVE_FAILED',
        message: msg,
      });
    }
  });

  // POST /api/transfers/:id/cancel - Cancel transfer
  app.post<{ Params: { id: string } }>('/api/transfers/:id/cancel', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_TRANSFER_ID',
        message: 'O identificador da transferência deve ser um número positivo',
      });
    }

    const parseResult = cancelTransferSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'Dados inválidos para cancelamento',
        issues: parseResult.error.issues,
      });
    }

    try {
      const cancelled = transferService.cancelTransfer(id, parseResult.data.reason);
      return reply.status(200).send(cancelled);
    } catch (err: any) {
      const msg = err.message || 'Erro ao cancelar transferência';
      if (msg.includes('não encontrada')) {
        return reply.status(404).send({
          error: 'TRANSFER_NOT_FOUND',
          message: msg,
        });
      }
      return reply.status(400).send({
        error: 'TRANSFER_CANCEL_FAILED',
        message: msg,
      });
    }
  });

  // GET /api/transfers/:id/slip - Get formatted transfer slip
  app.get<{ Params: { id: string } }>('/api/transfers/:id/slip', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_TRANSFER_ID',
        message: 'O identificador da transferência deve ser um número positivo',
      });
    }

    try {
      const slip = transferService.generateTransferSlip(id);
      return reply.status(200).send(slip);
    } catch (err: any) {
      const msg = err.message || 'Erro ao gerar romaneio de transferência';
      if (msg.includes('não encontrada')) {
        return reply.status(404).send({
          error: 'TRANSFER_NOT_FOUND',
          message: msg,
        });
      }
      return reply.status(400).send({
        error: 'TRANSFER_SLIP_FAILED',
        message: msg,
      });
    }
  });

  // POST /api/transfers/:id/emit-nfe - Emit NF-e Mod. 55 for transfer
  app.post<{ Params: { id: string } }>('/api/transfers/:id/emit-nfe', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_TRANSFER_ID',
        message: 'O identificador da transferência deve ser um número positivo',
      });
    }

    try {
      const result = await transferFiscalService.emitTransferNfe(id);
      return reply.status(200).send(result);
    } catch (err: any) {
      const msg = err.message || 'Erro ao emitir NF-e de transferência';
      if (msg.includes('não encontrada')) {
        return reply.status(404).send({
          error: 'TRANSFER_NOT_FOUND',
          message: msg,
        });
      }
      return reply.status(400).send({
        error: 'TRANSFER_NFE_FAILED',
        message: msg,
      });
    }
  });
}
