import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { SubscriptionService } from './subscription.service';
import { SubscriptionStatus } from './subscription.types';

export async function registerSubscriptionRoutes(app: FastifyInstance, db: Database) {
  const service = new SubscriptionService(db);

  // 1. Listar Assinaturas
  app.get('/api/subscriptions', async (request, reply) => {
    const { status, customer_id, store_id } = request.query as any;
    const subs = service.listSubscriptions({
      status: status as SubscriptionStatus,
      customer_id: customer_id ? Number(customer_id) : undefined,
      store_id: store_id ? Number(store_id) : undefined,
    });
    return reply.send(subs);
  });

  // 2. Criar Nova Assinatura
  app.post('/api/subscriptions', async (request, reply) => {
    try {
      const sub = service.createSubscription(request.body as any);
      return reply.status(201).send(sub);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao criar assinatura' });
    }
  });

  // 3. Obter Detalhes da Assinatura
  app.get('/api/subscriptions/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const sub = service.getSubscription(Number(id));
      return reply.send(sub);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message || 'Assinatura não encontrada' });
    }
  });

  // 4. Alterar Status (ACTIVE, PAUSED, CANCELLED)
  app.patch('/api/subscriptions/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { status } = request.body as any;
      const updated = service.updateSubscriptionStatus(Number(id), status);
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao atualizar status' });
    }
  });

  // 5. Adicionar Item à Assinatura
  app.post('/api/subscriptions/:id/items', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const item = service.addSubscriptionItem(Number(id), request.body as any);
      return reply.status(201).send(item);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao adicionar item' });
    }
  });

  // 6. Remover Item da Assinatura
  app.delete('/api/subscriptions/items/:itemId', async (request, reply) => {
    try {
      const { itemId } = request.params as any;
      service.removeSubscriptionItem(Number(itemId));
      return reply.send({ success: true, message: 'Item removido da assinatura' });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao remover item' });
    }
  });

  // 7. Renovar Receita Médica de Uso Contínuo
  app.patch('/api/subscriptions/items/:itemId/prescription', async (request, reply) => {
    try {
      const { itemId } = request.params as any;
      const updatedItem = service.renewPrescription(Number(itemId), request.body as any);
      return reply.send(updatedItem);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao renovar receita' });
    }
  });

  // 8. Relatório de Receitas Expirando / Vencidas
  app.get('/api/subscriptions/expiring-prescriptions', async (request, reply) => {
    const { daysAhead } = request.query as any;
    const items = service.getExpiringPrescriptions(daysAhead ? Number(daysAhead) : 15);
    return reply.send(items);
  });

  // 9. Processar Reposições Agendadas (Motor de Autoship)
  app.post('/api/subscriptions/process-refills', async (request, reply) => {
    try {
      const { currentDate, storeId } = (request.body as any) || {};
      const dateToProcess = currentDate || new Date().toISOString().split('T')[0];
      const result = service.processScheduledRefills(
        dateToProcess,
        storeId ? Number(storeId) : undefined
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao processar reposições' });
    }
  });

  // 10. Dashboard de KPIs de Recorrência
  app.get('/api/subscriptions/kpis', async (_request, reply) => {
    const kpis = service.getSubscriptionKpis();
    return reply.send(kpis);
  });
}
