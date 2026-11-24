import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { CommissionService } from './commission.service';
import { StatementStatus } from './commission.types';

export async function registerCommissionRoutes(app: FastifyInstance, db: Database) {
  const service = new CommissionService(db);

  // 1. Vendedores
  app.get('/api/commissions/sellers', async (request, reply) => {
    const { storeId, activeOnly } = request.query as any;
    const sellers = service.listSellers(
      storeId ? Number(storeId) : undefined,
      activeOnly === undefined ? true : activeOnly === 'true'
    );
    return reply.send(sellers);
  });

  app.post('/api/commissions/sellers', async (request, reply) => {
    try {
      const seller = service.createSeller(request.body as any);
      return reply.status(201).send(seller);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao cadastrar vendedor' });
    }
  });

  // 2. Regras por Categoria
  app.get('/api/commissions/rules', async (_request, reply) => {
    const rules = service.listRules();
    return reply.send(rules);
  });

  app.put('/api/commissions/rules', async (request, reply) => {
    try {
      const { categoryType, percentage, description } = request.body as any;
      const updated = service.updateRule(categoryType, Number(percentage), description);
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao atualizar regra' });
    }
  });

  // 3. Campanhas de Premiação por Caixa
  app.get('/api/commissions/campaigns', async (request, reply) => {
    const { activeOnly } = request.query as any;
    const campaigns = service.listCampaigns(activeOnly === 'true');
    return reply.send(campaigns);
  });

  app.post('/api/commissions/campaigns', async (request, reply) => {
    try {
      const campaign = service.createCampaign(request.body as any);
      return reply.status(201).send(campaign);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao criar campanha' });
    }
  });

  // 4. Metas Mensais
  app.get('/api/commissions/goals', async (request, reply) => {
    const { periodMonth, storeId } = request.query as any;
    const month = periodMonth || new Date().toISOString().slice(0, 7);
    const goals = service.listGoals(month, storeId ? Number(storeId) : undefined);
    return reply.send(goals);
  });

  app.post('/api/commissions/goals', async (request, reply) => {
    try {
      const goal = service.setSalesGoal(request.body as any);
      return reply.status(201).send(goal);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao definir meta' });
    }
  });

  // 5. Apuração de Venda
  app.post('/api/commissions/calculate-sale', async (request, reply) => {
    try {
      const statements = service.calculateSaleCommissions(request.body as any);
      return reply.status(201).send(statements);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao apurar comissões da venda' });
    }
  });

  // 6. Extrato do Vendedor
  app.get('/api/commissions/statements', async (request, reply) => {
    const { sellerId, seller_id, periodMonth, status } = request.query as any;
    const targetSellerId = sellerId || seller_id;
    if (!targetSellerId) {
      return reply.status(400).send({ error: 'SELLER_ID_REQUIRED' });
    }
    const statements = service.getSellerStatement(
      Number(targetSellerId),
      periodMonth,
      status as StatementStatus
    );
    return reply.send(statements);
  });

  // 7. Fechamento Mensal para Folha
  app.post('/api/commissions/close-period', async (request, reply) => {
    try {
      const { sellerId, seller_id, periodMonth, status } = request.body as any;
      const targetSellerId = sellerId || seller_id;
      if (!targetSellerId) {
        return reply.status(400).send({ error: 'SELLER_ID_REQUIRED' });
      }
      const res = service.closeMonthlyCommissions(
        Number(targetSellerId),
        periodMonth || new Date().toISOString().slice(0, 7),
        status || 'APPROVED'
      );
      return reply.send(res);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao fechar comissões' });
    }
  });

  // 8. KPIs Comerciais
  app.get('/api/commissions/kpis', async (request, reply) => {
    const { periodMonth } = request.query as any;
    const kpis = service.getCommissionKpis(periodMonth);
    return reply.send(kpis);
  });
}
