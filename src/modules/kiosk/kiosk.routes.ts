import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { KioskService } from './kiosk.service';

export async function registerKioskRoutes(app: FastifyInstance, db: Database) {
  const service = new KioskService(db);

  // 1. Consulta Rápida de Preço no Totem
  app.get('/api/kiosk/price-check', async (request, reply) => {
    try {
      const query = request.query as any;
      const term = query.ean || query.term || query.q;
      if (!term) {
        return reply.status(400).send({ error: 'Parâmetro ean ou term é obrigatório' });
      }

      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const kioskId = query.kioskId || query.kiosk_id ? Number(query.kioskId || query.kiosk_id) : undefined;
      const customerCpf = query.customerCpf || query.customer_cpf;

      const result = service.queryProductPrice(term, customerCpf, storeId, kioskId);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao consultar preço' });
    }
  });

  // 2. Fila Inteligente: Emissão de Senha
  app.post('/api/kiosk/queue/ticket', async (request, reply) => {
    try {
      const body = request.body as any;
      const result = service.issueQueueTicket({
        store_id: Number(body.storeId || body.store_id || 1),
        service_type: body.serviceType || body.service_type || 'NORMAL',
        kiosk_id: body.kioskId || body.kiosk_id ? Number(body.kioskId || body.kiosk_id) : undefined,
        customer_name: body.customerName || body.customer_name,
        customer_cpf: body.customerCpf || body.customer_cpf,
      });
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao emitir senha' });
    }
  });

  // 3. Fila Inteligente: Listagem de Senhas
  app.get('/api/kiosk/queue/tickets', async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
    const status = query.status;
    const tickets = service.listQueueTickets(storeId, status);
    return reply.send(tickets);
  });

  // 4. Fila Inteligente: Chamada de Senha pelo Balconista
  app.patch('/api/kiosk/queue/tickets/:id/call', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as any) || {};
      const operatorName = body.operatorName || body.operator_name || 'Balconista';
      const updated = service.callQueueTicket(Number(id), operatorName);
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao chamar senha' });
    }
  });

  // 5. Fila Inteligente: Conclusão de Atendimento
  app.patch('/api/kiosk/queue/tickets/:id/complete', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const updated = service.completeQueueTicket(Number(id));
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao concluir atendimento' });
    }
  });

  // 6. Pré-Venda Express no Totem
  app.post('/api/kiosk/pre-sale', async (request, reply) => {
    try {
      const body = request.body as any;
      const rawItems = body.items || [];
      const normalizedItems = rawItems.map((it: any) => ({
        product_id: Number(it.productId || it.product_id),
        quantity: Number(it.quantity),
      }));

      const result = service.createExpressPreSale({
        store_id: Number(body.storeId || body.store_id || 1),
        kiosk_id: body.kioskId || body.kiosk_id ? Number(body.kioskId || body.kiosk_id) : undefined,
        customer_name: body.customerName || body.customer_name,
        customer_cpf: body.customerCpf || body.customer_cpf,
        items: normalizedItems,
      });
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao criar pré-venda expressa' });
    }
  });

  // 7. Terminais
  app.get('/api/kiosk/terminals', async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined;
    const terminals = service.listTerminals(storeId);
    return reply.send(terminals);
  });

  app.post('/api/kiosk/terminals', async (request, reply) => {
    try {
      const body = request.body as any;
      const terminal = service.createTerminal({
        store_id: Number(body.storeId || body.store_id || 1),
        terminal_code: body.terminalCode || body.terminal_code,
        name: body.name,
        ip_address: body.ipAddress || body.ip_address,
        mode: body.mode,
      });
      return reply.status(201).send(terminal);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao cadastrar terminal' });
    }
  });

  // 8. KPIs do Totem
  app.get('/api/kiosk/kpis', async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined;
    const kpis = service.getKioskKpis(storeId);
    return reply.send(kpis);
  });
}
