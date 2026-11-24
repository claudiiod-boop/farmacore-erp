import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { DreService } from './dre.service';
import { DreRegime } from './dre.types';

export async function registerDreRoutes(app: FastifyInstance, db: Database) {
  const service = new DreService(db);

  // 1. Relatório Consolidado de DRE
  app.get('/api/dre/report', async (request, reply) => {
    try {
      const query = request.query as any;
      const month = query.periodMonth || query.month || new Date().toISOString().substring(0, 7);
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined;
      const regime: DreRegime = query.regime === 'CAIXA' ? 'CAIXA' : 'COMPETENCIA';

      const report = service.generateDreReport(month, storeId, regime);
      return reply.send(report);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao gerar relatório DRE' });
    }
  });

  // 2. Fechamento Oficial e Snapshot de DRE
  app.post('/api/dre/snapshot', async (request, reply) => {
    try {
      const body = request.body as any;
      const month = body.periodMonth || body.month || new Date().toISOString().substring(0, 7);
      const storeId = body.storeId || body.store_id ? Number(body.storeId || body.store_id) : undefined;
      const regime: DreRegime = body.regime === 'CAIXA' ? 'CAIXA' : 'COMPETENCIA';

      const snapshot = service.saveDreSnapshot(month, storeId, regime);
      return reply.status(201).send(snapshot);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao salvar snapshot de DRE' });
    }
  });

  app.get('/api/dre/snapshots', async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined;
    const periodMonth = query.periodMonth || query.month;

    const list = service.listDreSnapshots(storeId, periodMonth);
    return reply.send(list);
  });

  // 3. Centros de Custos Farmacêuticos
  app.get('/api/dre/cost-centers', async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined;
    const list = service.listCostCenters(storeId);
    return reply.send(list);
  });

  app.post('/api/dre/cost-centers', async (request, reply) => {
    try {
      const body = request.body as any;
      const costCenter = service.createCostCenter({
        store_id: body.storeId || body.store_id,
        code: body.code,
        name: body.name,
        department_type: body.departmentType || body.department_type,
      });
      return reply.status(201).send(costCenter);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao criar centro de custo' });
    }
  });

  // 4. Despesas Operacionais
  app.get('/api/dre/expenses', async (request, reply) => {
    const query = request.query as any;
    const expenses = service.listExpenses({
      store_id: query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined,
      cost_center_id: query.costCenterId || query.cost_center_id ? Number(query.costCenterId || query.cost_center_id) : undefined,
      expense_type: query.expenseType || query.expense_type,
      status: query.status,
      start_date: query.startDate || query.start_date,
      end_date: query.endDate || query.end_date,
    });
    return reply.send(expenses);
  });

  app.post('/api/dre/expenses', async (request, reply) => {
    try {
      const body = request.body as any;
      const expense = service.createExpense({
        store_id: Number(body.storeId || body.store_id),
        cost_center_id: Number(body.costCenterId || body.cost_center_id),
        expense_type: body.expenseType || body.expense_type,
        description: body.description,
        amount: Number(body.amount),
        due_date: body.dueDate || body.due_date,
        payment_date: body.paymentDate || body.payment_date,
        status: body.status,
      });
      return reply.status(201).send(expense);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao lançar despesa operacional' });
    }
  });

  app.patch('/api/dre/expenses/:id/pay', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as any) || {};
      const updated = service.payExpense(Number(id), body.paymentDate || body.payment_date);
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao baixar despesa' });
    }
  });

  // 5. Ranking de Rentabilidade por Filial
  app.get('/api/dre/branch-ranking', async (request, reply) => {
    const query = request.query as any;
    const month = query.periodMonth || query.month || new Date().toISOString().substring(0, 7);
    const ranking = service.getBranchProfitabilityRanking(month);
    return reply.send(ranking);
  });

  // 6. KPIs de Alto Nível
  app.get('/api/dre/kpis', async (request, reply) => {
    const query = request.query as any;
    const month = query.periodMonth || query.month || new Date().toISOString().substring(0, 7);
    const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined;
    const regime: DreRegime = query.regime === 'CAIXA' ? 'CAIXA' : 'COMPETENCIA';

    const report = service.generateDreReport(month, storeId, regime);
    return reply.send({
      gross_revenue: report.gross_revenue,
      net_revenue: report.net_revenue,
      cmv_amount: report.cmv_amount,
      gross_profit: report.gross_profit,
      gross_margin_percent: report.gross_margin_percent,
      ebitda_amount: report.ebitda_amount,
      ebitda_margin_percent: report.ebitda_margin_percent,
      net_profit: report.net_profit,
      net_margin_percent: report.net_margin_percent,
      break_even_point: report.break_even_point,
    });
  });
}
