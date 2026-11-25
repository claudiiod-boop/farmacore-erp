import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { BlindInventoryService } from './blind-inventory.service';
import { CreateInventoryInput, InventoryStatus } from './blind-inventory.types';

export function registerBlindInventoryRoutes(app: FastifyInstance, db: Database) {
  const service = new BlindInventoryService(db);

  // 1. Iniciar nova sessão de inventário
  app.post<{
    Body: CreateInventoryInput;
  }>('/api/v1/blind-inventory/sessions', async (req, reply) => {
    try {
      const { store_id, type } = req.body;
      if (!store_id || !type) {
        return reply.status(400).send({
          success: false,
          error: 'store_id e type são obrigatórios'
        });
      }

      const session = await service.createInventorySession(req.body);
      return reply.send({ success: true, data: session });
    } catch (err: any) {
      if (err.message === 'STORE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Loja não encontrada' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 2. Registrar contagem cega de item
  app.post<{
    Params: { id: string };
    Body: { product_id: number; batch_id?: number; counted_quantity: number };
  }>('/api/v1/blind-inventory/sessions/:id/count', async (req, reply) => {
    try {
      const inventoryId = Number(req.params.id);
      const { product_id, batch_id, counted_quantity } = req.body;
      if (!product_id || counted_quantity === undefined) {
        return reply.status(400).send({
          success: false,
          error: 'product_id e counted_quantity são obrigatórios'
        });
      }

      const item = await service.registerItemCount({
        inventory_id: inventoryId,
        product_id,
        batch_id,
        counted_quantity
      });
      return reply.send({ success: true, data: item });
    } catch (err: any) {
      if (err.message === 'INVENTORY_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Inventário não encontrado' });
      }
      if (err.message === 'INVENTORY_CLOSED') {
        return reply.status(400).send({ success: false, error: 'Inventário já finalizado ou cancelado' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 3. Reconciliar e auditar divergências
  app.post<{
    Params: { id: string };
  }>('/api/v1/blind-inventory/sessions/:id/reconcile', async (req, reply) => {
    try {
      const inventoryId = Number(req.params.id);
      const reconciled = await service.reconcileDivergences(inventoryId);
      return reply.send({ success: true, data: reconciled });
    } catch (err: any) {
      if (err.message === 'INVENTORY_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Inventário não encontrado' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 4. Aprovação formal do Farmacêutico RT para divergências em medicamentos controlados
  app.post<{
    Params: { itemId: string };
    Body: { pharmacist_crf: string; justification: string };
  }>('/api/v1/blind-inventory/items/:itemId/approve-controlled', async (req, reply) => {
    try {
      const itemId = Number(req.params.itemId);
      const { pharmacist_crf, justification } = req.body;
      if (!pharmacist_crf || !justification) {
        return reply.status(400).send({
          success: false,
          error: 'CRF e justificativa técnica são obrigatórios para medicamentos controlados'
        });
      }

      const approved = await service.approveControlledDivergence({
        item_id: itemId,
        pharmacist_crf,
        justification
      });
      return reply.send({ success: true, data: approved });
    } catch (err: any) {
      if (err.message === 'ITEM_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Item de inventário não encontrado' });
      }
      if (err.message === 'ITEM_DOES_NOT_REQUIRE_APPROVAL') {
        return reply.status(400).send({ success: false, error: 'Item não requer aprovação de controlado' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 5. Finalização e regularização patrimonial/física de estoque
  app.post<{
    Params: { id: string };
    Body: { user_id?: number };
  }>('/api/v1/blind-inventory/sessions/:id/finalize', async (req, reply) => {
    try {
      const inventoryId = Number(req.params.id);
      const userId = req.body?.user_id;
      const result = await service.finalizeInventory(inventoryId, userId);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      if (err.message === 'INVENTORY_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Inventário não encontrado' });
      }
      if (err.message === 'PENDING_CONTROLLED_APPROVAL') {
        return reply.status(422).send({
          success: false,
          error: 'BLOQUEIO SANITÁRIO RDC 44/2009 & Portaria 344/98: Existem divergências em medicamentos controlados pendentes de justificativa do Farmacêutico RT.'
        });
      }
      if (err.message === 'INVENTORY_ALREADY_FINALIZED') {
        return reply.status(400).send({ success: false, error: 'Inventário já finalizado anteriormente' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 6. Detalhes de um inventário
  app.get<{
    Params: { id: string };
    Querystring: { is_manager_view?: string };
  }>('/api/v1/blind-inventory/sessions/:id', async (req, reply) => {
    try {
      const inventoryId = Number(req.params.id);
      const isManagerView = req.query.is_manager_view === 'true';
      const inv = await service.getInventoryById(inventoryId, isManagerView);
      if (!inv) {
        return reply.status(404).send({ success: false, error: 'Inventário não encontrado' });
      }
      return reply.send({ success: true, data: inv });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 7. Lista sessões
  app.get<{
    Querystring: { store_id?: string; status?: InventoryStatus };
  }>('/api/v1/blind-inventory/sessions', async (req, reply) => {
    try {
      const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
      const status = req.query.status;
      const list = await service.listInventories(storeId, status);
      return reply.send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 8. KPIs
  app.get<{
    Querystring: { store_id?: string };
  }>('/api/v1/blind-inventory/kpis', async (req, reply) => {
    try {
      const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
      const kpis = await service.getInventoryKpis(storeId);
      return reply.send({ success: true, data: kpis });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
}
