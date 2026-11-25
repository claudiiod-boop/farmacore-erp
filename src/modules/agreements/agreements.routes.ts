import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { CorporateAgreementService } from './agreements.service';
import { AgreementInvoiceStatus } from './agreements.types';

export function registerCorporateAgreementsRoutes(app: FastifyInstance, db: Database) {
  const service = new CorporateAgreementService(db);

  // 1. Gerar fatura individual de convênio
  app.post<{
    Body: {
      agreement_id: number;
      period_start: string;
      period_end: string;
      due_date: string;
    };
  }>('/api/v1/agreements/invoices/generate', async (req, reply) => {
    try {
      const { agreement_id, period_start, period_end, due_date } = req.body;
      if (!agreement_id || !period_start || !period_end || !due_date) {
        return reply.status(400).send({
          success: false,
          error: 'agreement_id, period_start, period_end e due_date são obrigatórios'
        });
      }

      const invoice = await service.generateInvoiceForAgreement(
        Number(agreement_id),
        period_start,
        period_end,
        due_date
      );
      return reply.send({ success: true, data: invoice });
    } catch (err: any) {
      if (err.message === 'AGREEMENT_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Convênio não encontrado' });
      }
      if (err.message === 'NO_SALES_TO_INVOICE') {
        return reply.status(400).send({ success: false, error: 'Não há vendas pendentes para faturar no período' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 2. Faturamento em lote de todos os convênios ativos
  app.post<{
    Body: {
      period_start: string;
      period_end: string;
      due_date: string;
    };
  }>('/api/v1/agreements/invoices/batch-billing', async (req, reply) => {
    try {
      const { period_start, period_end, due_date } = req.body;
      if (!period_start || !period_end || !due_date) {
        return reply.status(400).send({
          success: false,
          error: 'period_start, period_end e due_date são obrigatórios'
        });
      }

      const invoices = await service.generateBatchBilling(period_start, period_end, due_date);
      return reply.send({ success: true, data: invoices });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 3. Listagem de faturas
  app.get<{
    Querystring: {
      agreement_id?: string;
      status?: AgreementInvoiceStatus;
    };
  }>('/api/v1/agreements/invoices', async (req, reply) => {
    try {
      const agreementId = req.query.agreement_id ? Number(req.query.agreement_id) : undefined;
      const status = req.query.status;
      const invoices = await service.listInvoices(agreementId, status);
      return reply.send({ success: true, data: invoices });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 4. Detalhes de uma fatura
  app.get<{
    Params: { id: string };
  }>('/api/v1/agreements/invoices/:id', async (req, reply) => {
    try {
      const invoice = await service.getInvoiceById(Number(req.params.id));
      if (!invoice) {
        return reply.status(404).send({ success: false, error: 'Fatura não encontrada' });
      }
      return reply.send({ success: true, data: invoice });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 5. Espelho de Desconto em Folha para RH (CSV / Metadados)
  app.get<{
    Params: { id: string };
    Querystring: { format?: 'json' | 'csv' };
  }>('/api/v1/agreements/invoices/:id/payroll-export', async (req, reply) => {
    try {
      const exportData = await service.exportPayrollDiscountFile(Number(req.params.id));
      if (req.query.format === 'csv') {
        return reply
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', `attachment; filename="desconto_folha_${exportData.invoiceId}.csv"`)
          .send(exportData.csvContent);
      }
      return reply.send({ success: true, data: exportData });
    } catch (err: any) {
      if (err.message === 'INVOICE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Fatura não encontrada' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 6. Liquidação / Baixa da fatura
  app.post<{
    Params: { id: string };
    Body: { paid_date: string; notes?: string };
  }>('/api/v1/agreements/invoices/:id/settle', async (req, reply) => {
    try {
      const { paid_date, notes } = req.body;
      if (!paid_date) {
        return reply.status(400).send({ success: false, error: 'paid_date é obrigatório' });
      }
      const settled = await service.settleAgreementInvoice(Number(req.params.id), paid_date, notes);
      return reply.send({ success: true, data: settled });
    } catch (err: any) {
      if (err.message === 'INVOICE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Fatura não encontrada' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 7. Checagem de elegibilidade do colaborador
  app.get<{
    Params: { customerId: string };
    Querystring: { sale_amount?: string };
  }>('/api/v1/agreements/eligibility/:customerId', async (req, reply) => {
    try {
      const customerId = Number(req.params.customerId);
      const saleAmount = req.query.sale_amount ? Number(req.query.sale_amount) : 0;
      const eligibility = await service.checkCustomerAgreementEligibility(customerId, saleAmount);
      return reply.send({ success: true, data: eligibility });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 8. KPIs de convênios empresariais
  app.get('/api/v1/agreements/kpis', async (_req, reply) => {
    try {
      const kpis = await service.getAgreementKpis();
      return reply.send({ success: true, data: kpis });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
}
