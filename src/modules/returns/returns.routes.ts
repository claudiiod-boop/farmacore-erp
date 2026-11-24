import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { CustomerReturnService } from './returns.service';
import type { CreateReturnInput, ApproveReturnInput } from './returns.types';

export async function registerReturnsRoutes(app: FastifyInstance, db: Database) {
  const service = new CustomerReturnService(db);

  // 1. Obter itens elegíveis de uma venda para devolução/troca
  app.get('/api/returns/sale/:saleId/eligible-items', async (request, reply) => {
    try {
      const { saleId } = request.params as { saleId: string };
      const data = service.getEligibleItemsForSale(Number(saleId));
      return reply.send(data);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message || 'Venda não encontrada' });
    }
  });

  // 2. Criar solicitação de devolução ou troca
  app.post('/api/returns', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body.saleId || !body.items || !Array.isArray(body.items)) {
        return reply.status(400).send({ error: 'saleId e array de items são obrigatórios' });
      }

      const input: CreateReturnInput = {
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        saleId: Number(body.saleId || body.sale_id),
        customerId: body.customerId || body.customer_id ? Number(body.customerId || body.customer_id) : undefined,
        returnType: body.returnType || body.return_type || 'RETURN',
        refundMethod: body.refundMethod || body.refund_method || 'STORE_CREDIT',
        reason: body.reason || 'OUTRO',
        notes: body.notes,
        createdBy: body.createdBy || body.created_by || 'Operador Balcão',
        pharmacistCrf: body.pharmacistCrf || body.pharmacist_crf,
        items: body.items.map((it: any) => ({
          saleItemId: it.saleItemId || it.sale_item_id ? Number(it.saleItemId || it.sale_item_id) : undefined,
          productId: Number(it.productId || it.product_id),
          batchId: it.batchId || it.batch_id ? Number(it.batchId || it.batch_id) : undefined,
          quantity: Number(it.quantity || 1),
          unitPrice: it.unitPrice || it.unit_price ? Number(it.unitPrice || it.unit_price) : undefined,
          condition: it.condition || 'INTACT',
          destination: it.destination || 'RETURN_TO_STOCK',
          reason: it.reason,
        })),
      };

      const result = service.createReturn(input);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar devolução' });
    }
  });

  // 3. Listar devoluções com filtros
  app.get('/api/returns', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const status = query.status as string | undefined;
      const returnType = (query.returnType || query.return_type) as string | undefined;
      const limit = query.limit ? Number(query.limit) : 50;

      const returns = service.listReturns(storeId, { status, returnType, limit });
      return reply.send(returns);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao listar devoluções' });
    }
  });

  // 4. Obter detalhes da devolução por ID
  app.get('/api/returns/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const ret = service.getReturnById(Number(id));
      return reply.send(ret);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message || 'Devolução não encontrada' });
    }
  });

  // 5. Aprovar devolução e efetivar estorno/estoque
  app.post('/api/returns/:id/approve', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as any) || {};

      const input: ApproveReturnInput = {
        returnId: Number(id),
        authorizedByPharmacist: body.authorizedByPharmacist || body.authorized_by_pharmacist,
        fiscalNfeKey: body.fiscalNfeKey || body.fiscal_nfe_key,
      };

      const approved = service.approveReturn(Number(id), input);
      return reply.send(approved);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao aprovar devolução' });
    }
  });

  // 6. Rejeitar devolução
  app.post('/api/returns/:id/reject', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as any) || {};
      const reason = body.reason || 'Rejeitado pela gerência farmacêutica';

      const rejected = service.rejectReturn(Number(id), reason);
      return reply.send(rejected);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao rejeitar devolução' });
    }
  });

  // 7. Obter Espelho Fiscal de Estorno (NF-e de Devolução)
  app.get('/api/returns/:id/fiscal', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const fiscalSummary = service.generateFiscalReturnSummary(Number(id));
      return reply.send(fiscalSummary);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao gerar espelho fiscal' });
    }
  });

  // 8. Consultar/validar saldo de vale-compras (Store Credit)
  app.get('/api/returns/store-credits/validate/:code', async (request, reply) => {
    try {
      const { code } = request.params as { code: string };
      const validation = service.validateStoreCredit(code);
      return reply.send(validation);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao validar vale-compras' });
    }
  });

  // 9. Utilizar vale-compras
  app.post('/api/returns/store-credits/use', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body.code || !body.amount) {
        return reply.status(400).send({ error: 'code e amount são obrigatórios' });
      }

      const result = service.useStoreCredit(body.code, Number(body.amount));
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao utilizar vale-compras' });
    }
  });

  // 10. Obter KPIs do módulo
  app.get('/api/returns/kpis', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const kpis = service.getKpis(storeId);
      return reply.send(kpis);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao obter KPIs de devolução' });
    }
  });
}
