import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { BmpoService } from './bmpo.service';

export async function registerBmpoRoutes(app: FastifyInstance, db: Database) {
  const service = new BmpoService(db);

  // 1. Gerar Balanço BMPO (Trimestral ou Anual)
  app.post('/api/regulatory/bmpo', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body.periodYear && !body.period_year) {
        return reply.status(400).send({ error: 'Ano do período é obrigatório' });
      }
      if (!body.pharmacistName && !body.pharmacist_name) {
        return reply.status(400).send({ error: 'Nome do farmacêutico é obrigatório' });
      }
      if (!body.pharmacistCrf && !body.pharmacist_crf) {
        return reply.status(400).send({ error: 'CRF do farmacêutico é obrigatório' });
      }

      const report = service.generateBmpo({
        store_id: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        report_type: body.reportType || body.report_type || 'BMPO_TRIMESTRAL',
        period_year: Number(body.periodYear || body.period_year),
        period_quarter: body.periodQuarter || body.period_quarter ? Number(body.periodQuarter || body.period_quarter) : undefined,
        pharmacist_name: body.pharmacistName || body.pharmacist_name,
        pharmacist_crf: body.pharmacistCrf || body.pharmacist_crf,
        observations: body.observations,
      });

      return reply.status(201).send(report);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao gerar BMPO' });
    }
  });

  // 2. Gerar Relação Mensal RMNRA ou RMNRB
  app.post('/api/regulatory/rmnr', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body.periodYear && !body.period_year) {
        return reply.status(400).send({ error: 'Ano do período é obrigatório' });
      }
      if (!body.periodMonth && !body.period_month) {
        return reply.status(400).send({ error: 'Mês do período é obrigatório' });
      }
      if (!body.pharmacistName && !body.pharmacist_name) {
        return reply.status(400).send({ error: 'Nome do farmacêutico é obrigatório' });
      }
      if (!body.pharmacistCrf && !body.pharmacist_crf) {
        return reply.status(400).send({ error: 'CRF do farmacêutico é obrigatório' });
      }

      const report = service.generateRmnr({
        store_id: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        report_type: body.reportType || body.report_type || 'RMNRA',
        period_year: Number(body.periodYear || body.period_year),
        period_month: Number(body.periodMonth || body.period_month),
        pharmacist_name: body.pharmacistName || body.pharmacist_name,
        pharmacist_crf: body.pharmacistCrf || body.pharmacist_crf,
        observations: body.observations,
      });

      return reply.status(201).send(report);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao gerar RMNR' });
    }
  });

  // 3. Listar Relatórios Regulatórios
  app.get('/api/regulatory/reports', async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
    const reportType = query.reportType || query.report_type;
    const reports = service.listReports(storeId, reportType);
    return reply.send(reports);
  });

  // 4. Detalhes de um Relatório com itens e prescrições
  app.get('/api/regulatory/reports/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const report = service.getReportById(Number(id));
    if (!report) {
      return reply.status(404).send({ error: 'Relatório não encontrado' });
    }
    return reply.send(report);
  });

  // 5. Protocolar Entrega na VISA
  app.patch('/api/regulatory/reports/:id/file-visa', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      if (!body.visaProtocolNumber && !body.visa_protocol_number) {
        return reply.status(400).send({ error: 'Número de protocolo da VISA é obrigatório' });
      }
      if (!body.visaFilingDate && !body.visa_filing_date) {
        return reply.status(400).send({ error: 'Data de protocolo na VISA é obrigatória' });
      }

      const updated = service.fileReportWithVisa({
        report_id: Number(id),
        visa_protocol_number: body.visaProtocolNumber || body.visa_protocol_number,
        visa_filing_date: body.visaFilingDate || body.visa_filing_date,
        observations: body.observations,
      });

      return reply.send(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao protocolar relatório na VISA' });
    }
  });

  // 6. Excluir Rascunho de Relatório
  app.delete('/api/regulatory/reports/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      service.deleteReport(Number(id));
      return reply.status(204).send();
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao excluir relatório' });
    }
  });

  // 7. Obter Documento Oficial Formatado para Impressão
  app.get('/api/regulatory/reports/:id/print', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const doc = service.generateOfficialPrintDocument(Number(id));
      return reply.send({ document: doc });
    } catch (err: any) {
      return reply.status(404).send({ error: err.message || 'Erro ao gerar documento de impressão' });
    }
  });

  // 8. KPIs Regulatórios
  app.get('/api/regulatory/kpis', async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
    const kpis = service.getRegulatoryKpis(storeId);
    return reply.send(kpis);
  });
}
