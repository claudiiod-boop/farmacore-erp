import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { MdfeFiscalService } from './mdfe.service';
import {
  CreateMdfeDraftInput,
  CloseMdfeInput,
  CancelMdfeInput,
  MdfeStatus,
} from './mdfe.types';

export function registerMdfeRoutes(app: FastifyInstance, db: Database) {
  const service = new MdfeFiscalService(db);

  // 1. Criar Rascunho de MDF-e
  app.post<{
    Body: CreateMdfeDraftInput;
  }>('/api/v1/fiscal/mdfe/drafts', async (req, reply) => {
    try {
      const { store_id, uf_start, uf_end, driver_name, driver_cpf, vehicle_plate, items } = req.body;
      if (!store_id || !uf_start || !uf_end || !driver_name || !driver_cpf || !vehicle_plate || !items) {
        return reply.status(400).send({
          success: false,
          error: 'store_id, uf_start, uf_end, driver_name, driver_cpf, vehicle_plate e items são obrigatórios'
        });
      }

      const mdfe = await service.createMdfeDraft(req.body);
      return reply.send({ success: true, data: mdfe });
    } catch (err: any) {
      if (err.message === 'STORE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Loja não encontrada' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 2. Autorizar MDF-e junto à SEFAZ
  app.post<{
    Params: { id: string };
  }>('/api/v1/fiscal/mdfe/:id/authorize', async (req, reply) => {
    try {
      const mdfeId = Number(req.params.id);
      const authorized = await service.authorizeMdfe(mdfeId);
      return reply.send({ success: true, data: authorized });
    } catch (err: any) {
      if (err.message === 'MDFE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'MDF-e não encontrado' });
      }
      if (err.message === 'MDFE_ALREADY_PROCESSED') {
        return reply.status(400).send({ success: false, error: 'MDF-e já foi processado ou autorizado' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 3. Encerrar MDF-e no Destino
  app.post<{
    Params: { id: string };
    Body?: CloseMdfeInput;
  }>('/api/v1/fiscal/mdfe/:id/close', async (req, reply) => {
    try {
      const mdfeId = Number(req.params.id);
      const closed = await service.closeMdfe(mdfeId, req.body);
      return reply.send({ success: true, data: closed });
    } catch (err: any) {
      if (err.message === 'MDFE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'MDF-e não encontrado' });
      }
      if (err.message === 'MDFE_NOT_AUTHORIZED_FOR_CLOSURE') {
        return reply.status(400).send({ success: false, error: 'Apenas MDF-e autorizado pode ser encerrado' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 4. Cancelar MDF-e Autorizado
  app.post<{
    Params: { id: string };
    Body: CancelMdfeInput;
  }>('/api/v1/fiscal/mdfe/:id/cancel', async (req, reply) => {
    try {
      const mdfeId = Number(req.params.id);
      const { justification } = req.body;
      if (!justification) {
        return reply.status(400).send({
          success: false,
          error: 'justification é obrigatória'
        });
      }

      const cancelled = await service.cancelMdfe(mdfeId, req.body);
      return reply.send({ success: true, data: cancelled });
    } catch (err: any) {
      if (err.message === 'MDFE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'MDF-e não encontrado' });
      }
      if (err.message === 'MDFE_ALREADY_CLOSED_CANNOT_CANCEL') {
        return reply.status(400).send({ success: false, error: 'MDF-e já encerrado não pode ser cancelado' });
      }
      if (err.message === 'JUSTIFICATION_TOO_SHORT') {
        return reply.status(400).send({ success: false, error: 'A justificativa de cancelamento deve ter ao menos 15 caracteres' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 5. Obter DAMDFE Formatado
  app.get<{
    Params: { id: string };
  }>('/api/v1/fiscal/mdfe/:id/damdfe', async (req, reply) => {
    try {
      const mdfeId = Number(req.params.id);
      const damdfe = await service.generateDamdfe(mdfeId);
      return reply.send({ success: true, data: damdfe });
    } catch (err: any) {
      if (err.message === 'MDFE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'MDF-e não encontrado' });
      }
      if (err.message === 'MDFE_NOT_AUTHORIZED') {
        return reply.status(400).send({ success: false, error: 'MDF-e em rascunho não possui DAMDFE oficial' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 6. Listar Manifestos com Filtros
  app.get<{
    Querystring: {
      store_id?: string;
      status?: MdfeStatus;
    };
  }>('/api/v1/fiscal/mdfe', async (req, reply) => {
    try {
      const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
      const status = req.query.status;

      const mdfes = await service.listMdfes({ store_id: storeId, status });
      return reply.send({ success: true, data: mdfes });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 7. KPIs de MDF-e
  app.get<{
    Querystring: { store_id?: string };
  }>('/api/v1/fiscal/mdfe/kpis', async (req, reply) => {
    try {
      const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
      const kpis = await service.getMdfeKpis(storeId);
      return reply.send({ success: true, data: kpis });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
}
