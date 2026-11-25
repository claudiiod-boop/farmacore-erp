import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { DdaService } from './dda.service';
import { ImportDdaInvoiceInput, DdaInvoiceStatus } from './dda.types';

export function registerDdaRoutes(app: FastifyInstance, db: Database) {
  const service = new DdaService(db);

  // Importação de lote de boletos DDA
  app.post<{
    Body: {
      store_id: string;
      items: ImportDdaInvoiceInput[];
    };
  }>('/api/v1/dda/import-file', async (req, reply) => {
    try {
      const { store_id, items } = req.body;
      if (!store_id || !Array.isArray(items)) {
        return reply.status(400).send({
          success: false,
          error: 'store_id e array items são obrigatórios'
        });
      }
      const imported = await service.importDdaInvoices(store_id, items);
      return reply.send({ success: true, data: imported });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Listagem de boletos DDA com filtros
  app.get<{
    Querystring: {
      store_id?: string;
      status?: DdaInvoiceStatus;
      startDate?: string;
      endDate?: string;
    };
  }>('/api/v1/dda/invoices', async (req, reply) => {
    try {
      const storeId = req.query.store_id || '1';
      const invoices = await service.listDdaInvoices(storeId, {
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      });
      return reply.send({ success: true, data: invoices });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Execução do motor de conciliação automática
  app.post<{
    Body: {
      store_id?: string;
    };
  }>('/api/v1/dda/reconcile-auto', async (req, reply) => {
    try {
      const storeId = req.body?.store_id || '1';
      const result = await service.reconcileInvoicesAuto(storeId);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Vinculação manual de boleto DDA
  app.post<{
    Params: { id: string };
    Body: {
      matchType: 'PURCHASE' | 'EXPENSE';
      targetId: string | number;
      userId?: string;
    };
  }>('/api/v1/dda/invoices/:id/manual-match', async (req, reply) => {
    try {
      const { id } = req.params;
      const { matchType, targetId, userId } = req.body;
      if (!matchType || !targetId) {
        return reply.status(400).send({
          success: false,
          error: 'matchType e targetId são obrigatórios'
        });
      }
      const matched = await service.manualMatch(id, matchType, targetId, userId);
      return reply.send({ success: true, data: matched });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Quitação e liquidação do boleto DDA
  app.post<{
    Params: { id: string };
    Body: {
      paidAmount: number;
      paymentDate: string;
    };
  }>('/api/v1/dda/invoices/:id/settle', async (req, reply) => {
    try {
      const { id } = req.params;
      const { paidAmount, paymentDate } = req.body;
      const settled = await service.settleDdaInvoice(id, paidAmount, paymentDate);
      return reply.send({ success: true, data: settled });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Indicadores de conciliação DDA
  app.get<{
    Querystring: {
      store_id?: string;
    };
  }>('/api/v1/dda/kpis', async (req, reply) => {
    try {
      const storeId = req.query.store_id || '1';
      const kpis = await service.getDdaKpis(storeId);
      return reply.send({ success: true, data: kpis });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
}
