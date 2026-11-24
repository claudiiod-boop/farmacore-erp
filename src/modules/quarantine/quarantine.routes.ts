import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { QuarantineService } from './quarantine.service';
import type {
  TransferToQuarantineInput,
  ResolveQuarantineInput,
  RegisterRecallAlertInput,
  QuarantineReason,
  QuarantineOrigin,
} from './quarantine.types';

export async function registerQuarantineRoutes(app: FastifyInstance, db: Database) {
  const service = new QuarantineService(db);

  // 1. Transferir lote para quarentena sanitária
  app.post('/api/quarantine/transfer', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body.batchId || !body.quantity) {
        return reply.status(400).send({ error: 'batchId e quantity são obrigatórios' });
      }

      const input: TransferToQuarantineInput = {
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        productId: Number(body.productId || body.product_id),
        batchId: Number(body.batchId || body.batch_id),
        quantity: Number(body.quantity),
        reason: (body.reason as QuarantineReason) || 'OTHER',
        origin: (body.origin as QuarantineOrigin) || 'MANUAL',
        notes: body.notes,
        quarantinedBy: body.quarantinedBy || body.quarantined_by || 'Farmacêutico RT',
      };

      const result = service.quarantineBatch(input);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao transferir para quarentena' });
    }
  });

  // 2. Executar Varredura de Lotes Vencidos (Auditoria FEFO)
  app.post('/api/quarantine/sweep-expired', async (request, reply) => {
    try {
      const body = (request.body as any) || {};
      const storeId = body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1;
      const sweptBy = body.sweptBy || body.swept_by || 'Varredura Automática de Validades';

      const result = service.sweepExpiredBatches(storeId, sweptBy);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao varrer lotes vencidos' });
    }
  });

  // 3. Cadastrar Alerta de Recall ANVISA / Notivisa
  app.post('/api/quarantine/recalls', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body.anvisaReNumber || !body.productId || !body.batchNumber) {
        return reply.status(400).send({ error: 'anvisaReNumber, productId e batchNumber são obrigatórios' });
      }

      const input: RegisterRecallAlertInput = {
        anvisaReNumber: body.anvisaReNumber || body.anvisa_re_number,
        publicationDate: body.publicationDate || body.publication_date || new Date().toISOString().slice(0, 10),
        productId: Number(body.productId || body.product_id),
        batchNumber: body.batchNumber || body.batch_number,
        reason: body.reason || 'Recolhimento Cautelar Notivisa',
        severity: body.severity || 'HIGH',
        createdBy: body.createdBy || body.created_by || 'Farmacovigilância',
        autoBlockStock: body.autoBlockStock !== false,
      };

      const result = service.registerRecallAlert(input);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar alerta de recall' });
    }
  });

  // 4. Listar Alertas de Recall
  app.get('/api/quarantine/recalls', async (request, reply) => {
    try {
      const recalls = service.listRecallAlerts();
      return reply.send(recalls);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao listar alertas de recall' });
    }
  });

  // 5. Listar registros de quarentena
  app.get('/api/quarantine', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const status = query.status as string | undefined;
      const reason = query.reason as string | undefined;
      const limit = query.limit ? Number(query.limit) : 50;

      const records = service.listQuarantine(storeId, { status, reason, limit });
      return reply.send(records);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao listar itens em quarentena' });
    }
  });

  // 6. Obter detalhes de registro de quarentena por ID
  app.get('/api/quarantine/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const record = service.getQuarantineById(Number(id));
      return reply.send(record);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message || 'Registro de quarentena não encontrado' });
    }
  });

  // 7. Resolver destinação de lote em quarentena
  app.post('/api/quarantine/:id/resolve', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;

      if (!body.resolution) {
        return reply.status(400).send({ error: 'resolution é obrigatório (DISPOSED_PGRSS, RETURNED_TO_SUPPLIER, RELEASED)' });
      }

      const input: ResolveQuarantineInput = {
        resolution: body.resolution,
        resolvedBy: body.resolvedBy || body.resolved_by || 'Farmacêutico RT',
        resolutionNotes: body.resolutionNotes || body.resolution_notes,
        pharmacistCrf: body.pharmacistCrf || body.pharmacist_crf,
        fiscalNfeKey: body.fiscalNfeKey || body.fiscal_nfe_key,
        pgrssHazardGroup: body.pgrssHazardGroup || body.pgrss_hazard_group,
      };

      const resolved = service.resolveQuarantine(Number(id), input);
      return reply.send(resolved);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao resolver quarentena' });
    }
  });

  // 8. Obter KPIs do módulo de Quarentena Sanitária
  app.get('/api/quarantine/kpis', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const kpis = service.getKpis(storeId);
      return reply.send(kpis);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao obter KPIs de quarentena' });
    }
  });
}
