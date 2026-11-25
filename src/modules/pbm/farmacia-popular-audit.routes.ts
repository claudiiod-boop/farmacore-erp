import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { FarmaciaPopularAuditService } from './farmacia-popular-audit.service';
import {
  ImportSettlementBatchInput,
  RegisterDossierInput,
  ContestGlossInput,
  FpAuditItemStatus,
  FpDossierStatus,
} from './fp-audit.types';

export function registerFarmaciaPopularAuditRoutes(app: FastifyInstance, db: Database) {
  const service = new FarmaciaPopularAuditService(db);

  // 1. Importar Lote de Repasse do FNS
  app.post<{
    Body: ImportSettlementBatchInput;
  }>('/api/v1/farmacia-popular/settlements/import', async (req, reply) => {
    try {
      const { store_id, batch_reference, competence_month, credit_date, items } = req.body;
      if (!store_id || !batch_reference || !competence_month || !credit_date || !items) {
        return reply.status(400).send({
          success: false,
          error: 'store_id, batch_reference, competence_month, credit_date e items são obrigatórios'
        });
      }

      const batch = await service.importSettlementBatch(req.body);
      return reply.send({ success: true, data: batch });
    } catch (err: any) {
      if (err.message === 'STORE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Loja não encontrada' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 2. Conciliar Autorizações com Vendas/PBM do Caixa
  app.post<{
    Params: { id: string };
  }>('/api/v1/farmacia-popular/settlements/:id/reconcile', async (req, reply) => {
    try {
      const batchId = Number(req.params.id);
      const result = await service.reconcileAuthorizations(batchId);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      if (err.message === 'BATCH_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Lote não encontrado' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 3. Listar Itens do Lote / Glosas
  app.get<{
    Querystring: {
      store_id?: string;
      settlement_batch_id?: string;
      status?: FpAuditItemStatus;
    };
  }>('/api/v1/farmacia-popular/settlements/items', async (req, reply) => {
    try {
      const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
      const batchId = req.query.settlement_batch_id ? Number(req.query.settlement_batch_id) : undefined;
      const status = req.query.status;

      const items = await service.listAuditItems({
        store_id: storeId,
        settlement_batch_id: batchId,
        status: status
      });
      return reply.send({ success: true, data: items });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 4. Contestar Glosa Administrativa junto ao MS
  app.post<{
    Params: { id: string };
    Body: ContestGlossInput;
  }>('/api/v1/farmacia-popular/glosas/:id/contest', async (req, reply) => {
    try {
      const itemId = Number(req.params.id);
      const { justification } = req.body;
      if (!justification) {
        return reply.status(400).send({
          success: false,
          error: 'justification é obrigatória'
        });
      }

      const item = await service.contestGloss(itemId, req.body);
      return reply.send({ success: true, data: item });
    } catch (err: any) {
      if (err.message === 'AUDIT_ITEM_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Item de auditoria não encontrado' });
      }
      if (err.message === 'ITEM_HAS_NO_GLOSS') {
        return reply.status(400).send({ success: false, error: 'Este item não possui valor glosado' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 5. Cadastrar Dossiê Digital de 5 Anos
  app.post<{
    Body: RegisterDossierInput;
  }>('/api/v1/farmacia-popular/dossiers', async (req, reply) => {
    try {
      const { store_id, authorization_code, patient_cpf, patient_name, dispensation_date } = req.body;
      if (!store_id || !authorization_code || !patient_cpf || !patient_name || !dispensation_date) {
        return reply.status(400).send({
          success: false,
          error: 'store_id, authorization_code, patient_cpf, patient_name e dispensation_date são obrigatórios'
        });
      }

      const dossier = await service.registerDigitalDossier(req.body);
      return reply.send({ success: true, data: dossier });
    } catch (err: any) {
      if (err.message === 'STORE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Loja não encontrada' });
      }
      if (err.message === 'DOSSIER_ALREADY_EXISTS') {
        return reply.status(409).send({ success: false, error: 'Dossiê para esta autorização já existe' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 6. Listar Dossiês Digitais
  app.get<{
    Querystring: {
      store_id?: string;
      status?: FpDossierStatus;
      patient_cpf?: string;
    };
  }>('/api/v1/farmacia-popular/dossiers', async (req, reply) => {
    try {
      const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
      const status = req.query.status;
      const cpf = req.query.patient_cpf;

      const dossiers = await service.listDossiers({
        store_id: storeId,
        status: status,
        patient_cpf: cpf
      });
      return reply.send({ success: true, data: dossiers });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 7. KPIs Consolidados Farmácia Popular
  app.get<{
    Querystring: { store_id?: string };
  }>('/api/v1/farmacia-popular/kpis', async (req, reply) => {
    try {
      const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
      const kpis = await service.getAuditKpis(storeId);
      return reply.send({ success: true, data: kpis });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
}
