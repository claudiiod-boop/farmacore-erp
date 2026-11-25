import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { SanitaryAuditService } from './sanitary-audit.service';
import { RunSanitaryScanInput } from './sanitary-audit.types';

export function registerSanitaryAuditRoutes(app: FastifyInstance, db: Database) {
  const service = new SanitaryAuditService(db);

  // Execução de varredura sanitária e geração de auditoria
  app.post<{
    Body: RunSanitaryScanInput;
  }>('/api/v1/sanitary-audit/scan', async (req, reply) => {
    try {
      const { store_id, responsible_pharmacist_crf, responsible_pharmacist_name } = req.body;
      if (!responsible_pharmacist_crf || !responsible_pharmacist_name) {
        return reply.status(400).send({
          success: false,
          error: 'CRF e Nome do farmacêutico RT são obrigatórios'
        });
      }
      const audit = await service.runSanitaryScan({
        store_id: store_id || '1',
        responsible_pharmacist_crf,
        responsible_pharmacist_name
      });
      return reply.send({ success: true, data: audit });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Histórico de auditorias
  app.get<{
    Querystring: {
      store_id?: string;
    };
  }>('/api/v1/sanitary-audit/history', async (req, reply) => {
    try {
      const storeId = req.query.store_id || '1';
      const history = await service.listAuditHistory(storeId);
      return reply.send({ success: true, data: history });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Busca de auditoria detalhada com checklist
  app.get<{
    Params: { id: string };
  }>('/api/v1/sanitary-audit/:id', async (req, reply) => {
    try {
      const audit = await service.getAuditById(req.params.id);
      if (!audit) {
        return reply.status(404).send({ success: false, error: 'Auditoria não encontrada' });
      }
      return reply.send({ success: true, data: audit });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Dossiê consolidado para fiscalização ANVISA / VISA
  app.get<{
    Params: { id: string };
  }>('/api/v1/sanitary-audit/:id/dossier', async (req, reply) => {
    try {
      const dossier = await service.generateInspectionDossier(req.params.id);
      return reply.send({ success: true, data: dossier });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Atualização do Plano de Ação Corretiva (CAPA)
  app.post<{
    Params: { id: string };
    Body: { notes: string };
  }>('/api/v1/sanitary-audit/:id/action-plan', async (req, reply) => {
    try {
      const updated = await service.updateActionPlan(req.params.id, req.body.notes);
      return reply.send({ success: true, data: updated });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Dashboard de Saúde Sanitária
  app.get<{
    Querystring: {
      store_id?: string;
    };
  }>('/api/v1/sanitary-audit/dashboard', async (req, reply) => {
    try {
      const storeId = req.query.store_id || '1';
      const kpis = await service.getSanitaryDashboard(storeId);
      return reply.send({ success: true, data: kpis });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
}
