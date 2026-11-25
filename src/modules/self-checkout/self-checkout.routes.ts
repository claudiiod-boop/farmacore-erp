import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { SelfCheckoutService } from './self-checkout.service';
import type {
  StartSessionInput,
  ScanItemInput,
  SelfCheckoutPaymentMethod,
} from './self-checkout.types';

export async function registerSelfCheckoutRoutes(app: FastifyInstance, db: Database) {
  const service = new SelfCheckoutService(db);

  // 1. Iniciar Sessão de Autoatendimento
  app.post('/api/self-checkout/sessions', async (request, reply) => {
    try {
      const body = (request.body || {}) as any;
      const input: StartSessionInput = {
        kioskId: Number(body.kioskId || body.kiosk_id || 1),
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        customerCpf: body.customerCpf || body.customer_cpf,
        customerName: body.customerName || body.customer_name,
      };

      const session = service.startSession(input);
      return reply.status(201).send(session);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao iniciar sessão no totem' });
    }
  });

  // 2. Obter Sessão por ID
  app.get('/api/self-checkout/sessions/:id', async (request, reply) => {
    try {
      const params = request.params as any;
      const session = service.getSessionById(Number(params.id));
      if (!session) return reply.status(404).send({ error: 'Sessão não encontrada' });
      return reply.send(session);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 3. Bipe de Produto (Scanner Contínuo com Bloqueio Regulatório)
  app.post('/api/self-checkout/sessions/:id/scan', async (request, reply) => {
    try {
      const params = request.params as any;
      const body = request.body as any;

      const input: ScanItemInput = {
        sessionId: Number(params.id),
        eanOrCode: String(body.eanOrCode || body.ean || body.code),
        quantity: body.quantity ? Number(body.quantity) : 1,
      };

      const result = service.scanItem(input);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao bipar produto' });
    }
  });

  // 4. Remover Item do Carrinho Touch
  app.delete('/api/self-checkout/sessions/:id/items/:itemId', async (request, reply) => {
    try {
      const params = request.params as any;
      const session = service.removeItem(Number(params.id), Number(params.itemId));
      return reply.send(session);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 5. Iniciar Pagamento Touch (PIX Dinâmico ou TEF PinPad)
  app.post('/api/self-checkout/sessions/:id/payment', async (request, reply) => {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const paymentMethod = (body.paymentMethod || body.payment_method || 'PIX') as SelfCheckoutPaymentMethod;

      const result = service.initiatePayment(Number(params.id), paymentMethod);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 6. Concluir Venda Autônoma (NFC-e e Baixa de Lotes)
  app.post('/api/self-checkout/sessions/:id/finalize', async (request, reply) => {
    try {
      const params = request.params as any;
      const body = (request.body || {}) as any;

      const result = service.finalizeSale(Number(params.id), body);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 7. Cancelar Sessão do Totem
  app.post('/api/self-checkout/sessions/:id/cancel', async (request, reply) => {
    try {
      const params = request.params as any;
      const body = (request.body || {}) as any;
      const reason = body.reason || 'Cancelado no totem';

      const session = service.cancelSession(Number(params.id), reason);
      return reply.send(session);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 8. KPIs de Autoatendimento
  app.get('/api/self-checkout/kpis', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId ? Number(query.storeId) : 1;
      const kpis = service.getKpis(storeId);
      return reply.send(kpis);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
