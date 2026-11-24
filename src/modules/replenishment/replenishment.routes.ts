import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { ReplenishmentService } from './replenishment.service';
import type { StockRuptureStatus, ReplenishmentOrderStatus } from './replenishment.types';

export async function registerReplenishmentRoutes(app: FastifyInstance, db: Database) {
  const service = new ReplenishmentService(db);

  // 1. Obter Sugestões de Compra Inteligente
  app.get('/api/replenishment/suggestions', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const days = query.days ? Number(query.days) : 30;
      const status = query.status as StockRuptureStatus | undefined;

      const suggestions = service.generatePurchaseSuggestions(storeId, days, status);
      return reply.send(suggestions);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao gerar sugestões de reposição' });
    }
  });

  // 2. Análise Individual de Estoque e Demanda de um Produto
  app.get('/api/replenishment/analysis/:productId', async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const days = query.days ? Number(query.days) : 30;

      const analysis = service.computeProductStockAnalysis(Number(productId), storeId, days);
      if (!analysis) {
        return reply.status(404).send({ error: 'Produto não encontrado' });
      }
      return reply.send(analysis);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao analisar produto' });
    }
  });

  // 3. Criar Pedido de Reposição Formal
  app.post('/api/replenishment/orders', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return reply.status(400).send({ error: 'O pedido deve conter ao menos um item' });
      }

      const order = service.createReplenishmentOrder({
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        distributorName: body.distributorName || body.distributor_name,
        notes: body.notes,
        items: body.items.map((it: any) => ({
          productId: Number(it.productId || it.product_id),
          orderQuantity: Number(it.orderQuantity || it.order_quantity || it.quantity || 1),
          unitCost: it.unitCost || it.unit_cost ? Number(it.unitCost || it.unit_cost) : undefined,
          suggestedQuantity: it.suggestedQuantity || it.suggested_quantity ? Number(it.suggestedQuantity || it.suggested_quantity) : undefined,
          currentStock: it.currentStock || it.current_stock ? Number(it.currentStock || it.current_stock) : undefined,
          reorderPoint: it.reorderPoint || it.reorder_point ? Number(it.reorderPoint || it.reorder_point) : undefined,
        })),
      });

      return reply.status(201).send(order);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao criar pedido de reposição' });
    }
  });

  // 4. Listar Pedidos de Reposição
  app.get('/api/replenishment/orders', async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
    const status = query.status as ReplenishmentOrderStatus | undefined;

    const orders = service.listOrders(storeId, status);
    return reply.send(orders);
  });

  // 5. Detalhes de um Pedido de Reposição
  app.get('/api/replenishment/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = service.getOrderById(Number(id));
    if (!order) {
      return reply.status(404).send({ error: 'Pedido de reposição não encontrado' });
    }
    return reply.send(order);
  });

  // 6. Atualizar Status do Pedido de Reposição
  app.patch('/api/replenishment/orders/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      if (!body.status) {
        return reply.status(400).send({ error: 'Status é obrigatório' });
      }

      const updated = service.updateOrderStatus(Number(id), body.status as ReplenishmentOrderStatus);
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao atualizar status do pedido' });
    }
  });

  // 7. KPIs de Reposição
  app.get('/api/replenishment/kpis', async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
    const kpis = service.getReplenishmentKpis(storeId);
    return reply.send(kpis);
  });
}
