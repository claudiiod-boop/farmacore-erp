import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { OpenWaGatewayService } from './openwa-gateway.service';
import { OmnichannelBotService } from './omnichannel-bot.service';
import { PickAndPackService } from './pick-and-pack.service';
import { OpenWaWebhookPayload } from './omnichannel.types';

export async function registerOmnichannelRoutes(app: FastifyInstance, db: Database) {
  const gateway = new OpenWaGatewayService(db);
  const botService = new OmnichannelBotService(db, gateway);
  const pickPackService = new PickAndPackService(db, gateway);

  // 1. Webhook OpenWA (Recebe mensagens e eventos do WhatsApp)
  app.post('/api/omnichannel/webhook/openwa', async (request, reply) => {
    try {
      const payload = request.body as OpenWaWebhookPayload;
      const result = await botService.handleOpenWaWebhook(payload);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao processar webhook OpenWA' });
    }
  });

  // 2. Canais
  app.get('/api/omnichannel/channels', async (request, reply) => {
    const { storeId } = request.query as any;
    const channels = gateway.listChannels(storeId ? Number(storeId) : 1);
    return reply.send(channels);
  });

  app.post('/api/omnichannel/channels', async (request, reply) => {
    try {
      const channelData = request.body as any;
      const saved = gateway.saveChannel(channelData);
      return reply.status(201).send(saved);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao salvar canal' });
    }
  });

  // 3. Conversas & Mensageria de Atendimento
  app.get('/api/omnichannel/conversations', async (request, reply) => {
    const { storeId } = request.query as any;
    const convs = gateway.listConversations(storeId ? Number(storeId) : 1);
    return reply.send(convs);
  });

  app.get('/api/omnichannel/conversations/:id/messages', async (request, reply) => {
    const { id } = request.params as any;
    const messages = gateway.getConversationMessages(Number(id));
    return reply.send(messages);
  });

  app.post('/api/omnichannel/conversations/:id/reply', async (request, reply) => {
    const { id } = request.params as any;
    const { content, operatorName } = request.body as any;

    if (!content) {
      return reply.status(400).send({ error: 'Conteúdo da mensagem é obrigatório.' });
    }

    const conv = db
      .prepare<any>('SELECT * FROM omnichannel_conversations WHERE id = ?')
      .get(Number(id));

    if (!conv) {
      return reply.status(404).send({ error: 'Conversa não encontrada.' });
    }

    try {
      const result = await gateway.sendTextMessage(conv.channel_id, conv.contact_phone, content);
      return reply.send({ success: true, messageId: result.messageId });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao enviar mensagem' });
    }
  });

  // 4. Pedidos & Esteira de Pick-and-Pack
  app.get('/api/omnichannel/orders', async (request, reply) => {
    const { storeId, status } = request.query as any;
    const orders = pickPackService.listOrders(
      storeId ? Number(storeId) : 1,
      status || undefined
    );
    return reply.send(orders);
  });

  app.post('/api/omnichannel/orders', async (request, reply) => {
    try {
      const order = pickPackService.createOrder(request.body as any);
      return reply.status(201).send(order);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao criar pedido omnichannel' });
    }
  });

  app.get('/api/omnichannel/orders/:id', async (request, reply) => {
    const { id } = request.params as any;
    const order = pickPackService.getOrderById(Number(id));
    if (!order) {
      return reply.status(404).send({ error: 'Pedido não encontrado.' });
    }
    return reply.send(order);
  });

  app.post('/api/omnichannel/orders/:id/start-picking', async (request, reply) => {
    const { id } = request.params as any;
    const { operatorId, operatorName } = request.body as any;
    try {
      const order = pickPackService.startPicking(
        Number(id),
        Number(operatorId) || 1,
        operatorName || 'OPERADOR_BALCAO'
      );
      return reply.send(order);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao iniciar separação' });
    }
  });

  app.post('/api/omnichannel/orders/:id/scan', async (request, reply) => {
    const { id } = request.params as any;
    const { barcode, operatorName } = request.body as any;

    if (!barcode) {
      return reply.status(400).send({ error: 'Código de barras é obrigatório para a bipagem.' });
    }

    try {
      const result = pickPackService.scanBarcode(
        Number(id),
        barcode,
        operatorName || 'OPERADOR_BALCAO'
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao conferir item' });
    }
  });

  app.post('/api/omnichannel/orders/:id/dispatch', async (request, reply) => {
    const { id } = request.params as any;
    const { operatorName } = request.body as any;

    try {
      const order = await pickPackService.dispatchOrder(
        Number(id),
        operatorName || 'OPERADOR_EXPEDICAO'
      );
      return reply.send(order);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao despachar pedido' });
    }
  });
}
