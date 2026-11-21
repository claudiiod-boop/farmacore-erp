import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Database } from '../../database/connection';
import { ExpiryManagementService } from './expiry-management.service';
import { AnvisaRecallService } from './anvisa-recall.service';
import { InventoryLossService } from './inventory-loss.service';
import {
  formatExpiryAuditSlip,
  formatRecallPatientReport,
  formatDisposalLaudoSlip,
} from './sanitary-receipt-formatter';

const registerRecallSchema = z.object({
  resolutionNumber: z.string().min(1, 'resolutionNumber é obrigatório'),
  resolutionDate: z.string().min(1, 'resolutionDate é obrigatório'),
  publicationDate: z.string().min(1, 'publicationDate é obrigatório'),
  reason: z.string().min(1, 'reason é obrigatório'),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.number().int().positive(),
      batchNumber: z.string().min(1),
    })
  ).min(1, 'Ao menos um item afetado é obrigatório'),
});

const resolveRecallSchema = z.object({
  actionTaken: z.enum(['BLOCKED', 'RETURNED_TO_SUPPLIER', 'DESTROYED']),
  notes: z.string().optional(),
});

const createLossDraftSchema = z.object({
  storeId: z.number().int().positive(),
  reason: z.enum([
    'EXPIRED',
    'BROKEN_DAMAGED',
    'RECALL_ANVISA',
    'TEMPERATURE_EXCURSION',
    'THEFT_STOLEN',
    'OTHER',
  ]),
  responsiblePharmacistName: z.string().min(1, 'responsiblePharmacistName é obrigatório'),
  pharmacistCrf: z.string().min(1, 'pharmacistCrf é obrigatório'),
  pharmacistCrfUf: z.string().min(2).max(2),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.number().int().positive(),
      batchId: z.number().int().positive().nullable().optional(),
      batchNumber: z.string().min(1),
      expirationDate: z.string().min(1),
      quantity: z.number().int().positive(),
      unitCost: z.number().nonnegative(),
      unitSalePrice: z.number().nonnegative(),
    })
  ).min(1, 'Ao menos um item deve ser informado'),
});

const approveLossSchema = z.object({
  approvedByPharmacistName: z.string().optional(),
  pharmacistCrf: z.string().optional(),
  pharmacistCrfUf: z.string().optional(),
  notes: z.string().optional(),
});

const disposalCertificateSchema = z.object({
  disposalCompanyName: z.string().min(1, 'disposalCompanyName é obrigatório'),
  disposalCertificateNumber: z.string().min(1, 'disposalCertificateNumber é obrigatório'),
  mtrNumber: z.string().optional(),
  laudoNumber: z.string().optional(),
  disposedAt: z.string().optional(),
  notes: z.string().optional(),
});

export function registerSanitaryRoutes(app: FastifyInstance, db: Database): void {
  const expiryService = new ExpiryManagementService(db);
  const recallService = new AnvisaRecallService(db);
  const lossService = new InventoryLossService(db);

  // Helper to get store details
  const getStoreInfo = (storeId: number = 1) => {
    return db
      .prepare<{ name: string; cnpj: string; street: string; number: string; neighborhood: string; city: string; state: string }>(
        'SELECT name, cnpj, street, number, neighborhood, city, state FROM stores WHERE id = ?'
      )
      .get(storeId);
  };

  // 1. GESTÃO DE VALIDADES
  app.get('/api/sanitary/expiry/matrix', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { storeId?: string; referenceDate?: string };
    const storeId = query.storeId ? parseInt(query.storeId, 10) : undefined;
    const matrix = expiryService.getExpiryMatrix(storeId, query.referenceDate);
    return reply.send(matrix);
  });

  app.get('/api/sanitary/expiry/batches', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      storeId?: string;
      category?: any;
      maxDays?: string;
      search?: string;
      page?: string;
      limit?: string;
      referenceDate?: string;
    };
    const storeId = query.storeId ? parseInt(query.storeId, 10) : undefined;
    const maxDays = query.maxDays ? parseInt(query.maxDays, 10) : undefined;
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 50;

    const result = expiryService.getExpiringBatches(
      {
        storeId,
        category: query.category,
        maxDays,
        search: query.search,
        page,
        limit,
      },
      query.referenceDate
    );

    return reply.send(result);
  });

  app.get('/api/sanitary/expiry/audit-slip', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { storeId?: string; category?: any };
    const storeId = query.storeId ? parseInt(query.storeId, 10) : 1;
    const store = getStoreInfo(storeId);

    const result = expiryService.getExpiringBatches({
      storeId,
      category: query.category,
      limit: 100,
    });

    const slip = formatExpiryAuditSlip({
      store: {
        name: store?.name,
        cnpj: store?.cnpj,
      },
      category: query.category,
      items: result.batches.map((b) => ({
        productName: b.productName,
        ean: b.ean,
        batchNumber: b.batchNumber,
        expirationDate: b.expirationDate,
        daysRemaining: b.daysUntilExpiration,
        quantity: b.quantity,
        suggestedAction: b.suggestedAction,
      })),
    });

    return reply.send({ text: slip });
  });

  // 2. RECALL SANITÁRIO ANVISA
  app.get('/api/sanitary/recalls', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { status?: any; search?: string };
    const recalls = recallService.listRecalls({
      status: query.status,
      search: query.search,
    });
    return reply.send(recalls);
  });

  app.post('/api/sanitary/recalls', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerRecallSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    try {
      const recall = recallService.registerRecall(parsed.data);
      return reply.status(201).send(recall);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  app.get('/api/sanitary/recalls/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    const recall = recallService.getRecallById(id);
    if (!recall) {
      return reply.status(404).send({ error: 'Recall sanitário não encontrado' });
    }
    return reply.send(recall);
  });

  app.get('/api/sanitary/recalls/:id/patients', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    const patients = recallService.getAffectedPatients(id);
    return reply.send(patients);
  });

  app.post('/api/sanitary/recalls/:id/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    const parsed = resolveRecallSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    try {
      const updated = recallService.resolveRecall(id, parsed.data);
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  app.get('/api/sanitary/recalls/:id/patient-report', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    const recall = recallService.getRecallById(id);
    if (!recall) {
      return reply.status(404).send({ error: 'Recall não encontrado' });
    }

    const patients = recallService.getAffectedPatients(id);
    const store = getStoreInfo(1);

    const text = formatRecallPatientReport({
      store: { name: store?.name },
      recall: {
        resolutionNumber: recall.resolutionNumber,
        publicationDate: recall.publicationDate,
        reason: recall.reason,
      },
      affectedPatients: patients,
    });

    return reply.send({ text });
  });

  // 3. BAIXAS REGULATÓRIAS DE PERDAS & LAUDO VISA
  app.get('/api/sanitary/losses', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      storeId?: string;
      reason?: any;
      status?: any;
      startDate?: string;
      endDate?: string;
    };
    const storeId = query.storeId ? parseInt(query.storeId, 10) : undefined;
    const losses = lossService.listLosses({
      storeId,
      reason: query.reason,
      status: query.status,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return reply.send(losses);
  });

  app.post('/api/sanitary/losses', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createLossDraftSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    try {
      const loss = lossService.createLossDraft(parsed.data);
      return reply.status(201).send(loss);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  app.get('/api/sanitary/losses/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    const loss = lossService.getLossById(id);
    if (!loss) {
      return reply.status(404).send({ error: 'Baixa de perda não encontrada' });
    }
    return reply.send(loss);
  });

  app.post('/api/sanitary/losses/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    const parsed = approveLossSchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    try {
      const loss = lossService.approveAndDeductStock(id, parsed.data);
      return reply.send(loss);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  app.post('/api/sanitary/losses/:id/disposal', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    const parsed = disposalCertificateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    try {
      const loss = lossService.recordDisposalCertificate(id, parsed.data);
      return reply.send(loss);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  app.get('/api/sanitary/losses/:id/laudo', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    const loss = lossService.getLossById(id);
    if (!loss) {
      return reply.status(404).send({ error: 'Baixa não encontrada' });
    }

    const store = getStoreInfo(loss.storeId);
    const addressStr = store
      ? `${store.street}, ${store.number} - ${store.neighborhood} - ${store.city}/${store.state}`
      : undefined;

    const text = formatDisposalLaudoSlip({
      store: {
        name: store?.name,
        cnpj: store?.cnpj,
        address: addressStr,
      },
      loss: {
        lossNumber: loss.lossNumber,
        reason: loss.reason,
        status: loss.status,
        totalCostAmount: loss.totalCostAmount,
        responsiblePharmacistName: loss.responsiblePharmacistName,
        pharmacistCrf: loss.pharmacistCrf,
        pharmacistCrfUf: loss.pharmacistCrfUf,
        laudoNumber: loss.laudoNumber,
        disposalCompanyName: loss.disposalCompanyName,
        disposalCertificateNumber: loss.disposalCertificateNumber,
        mtrNumber: loss.mtrNumber,
        disposedAt: loss.disposedAt,
        notes: loss.notes,
        items: loss.items.map((it) => ({
          productName: it.productName,
          batchNumber: it.batchNumber,
          expirationDate: it.expirationDate,
          quantity: it.quantity,
          unitCost: it.unitCost,
          totalCost: it.totalCost,
        })),
      },
    });

    return reply.send({ text });
  });
}
