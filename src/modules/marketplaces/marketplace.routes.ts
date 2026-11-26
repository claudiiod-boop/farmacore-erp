import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { MarketplaceHubService } from './marketplace-hub.service';
import { verifyWebhookSignature } from '../../middlewares/security.middleware';
import type {
  RegisterChannelInput,
  MapCatalogProductInput,
  IngestOrderInput,
  MarketplaceOrderStatus,
} from './marketplace.types';

export async function registerMarketplaceRoutes(app: FastifyInstance, db: Database) {
  const service = new MarketplaceHubService(db);

  // 1. Canais: Cadastrar ou Atualizar
  app.post('/api/marketplaces/channels', async (request, reply) => {
    try {
      const body = request.body as any;
      const input: RegisterChannelInput = {
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        channelName: body.channelName || body.channel_name,
        merchantId: body.merchantId || body.merchant_id,
        apiKey: body.apiKey || body.api_key,
        apiSecret: body.apiSecret || body.api_secret,
        webhookSecret: body.webhookSecret || body.webhook_secret,
        commissionRate: body.commissionRate || body.commission_rate ? Number(body.commissionRate || body.commission_rate) : undefined,
        stockBufferPercent: body.stockBufferPercent || body.stock_buffer_percent ? Number(body.stockBufferPercent || body.stock_buffer_percent) : undefined,
        autoConfirmOrders: body.autoConfirmOrders ?? body.auto_confirm_orders,
      };

      const result = service.registerOrUpdateChannel(input);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar canal de marketplace' });
    }
  });

  // 2. Canais: Listar
  app.get('/api/marketplaces/channels', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId ? Number(query.storeId) : 1;
      const list = service.listChannels(storeId);
      return reply.send(list);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 3. Canais: Ativar / Desativar
  app.patch('/api/marketplaces/channels/:id/toggle', async (request, reply) => {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const channelId = Number(params.id);
      const isActive = Boolean(body.isActive ?? body.is_active);

      const result = service.toggleChannelStatus(channelId, isActive);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 4. Catálogo: Mapear De-Para
  app.post('/api/marketplaces/catalog/map', async (request, reply) => {
    try {
      const body = request.body as any;
      const input: MapCatalogProductInput = {
        channelId: Number(body.channelId || body.channel_id),
        productId: Number(body.productId || body.product_id),
        externalSku: String(body.externalSku || body.external_sku),
        markupPercent: body.markupPercent || body.markup_percent ? Number(body.markupPercent || body.markup_percent) : undefined,
        customPrice: body.customPrice || body.custom_price ? Number(body.customPrice || body.custom_price) : undefined,
      };

      const result = service.mapCatalogProduct(input);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao mapear produto no catálogo' });
    }
  });

  // 5. Catálogo: Listar Mapeamentos
  app.get('/api/marketplaces/catalog/:channelId', async (request, reply) => {
    try {
      const params = request.params as any;
      const channelId = Number(params.channelId);
      const list = service.listCatalogMappings(channelId);
      return reply.send(list);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 6. Catálogo: Sincronizar Estoque
  app.post('/api/marketplaces/catalog/:channelId/sync-stock', async (request, reply) => {
    try {
      const params = request.params as any;
      const channelId = Number(params.channelId);
      const result = service.syncStock(channelId);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 7. Webhook: Ingestão de Pedido Externo (iFood, Rappi, etc)
  app.post('/api/marketplaces/webhook/:channel', async (request, reply) => {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const channelId = Number(body.channelId || body.channel_id);

      // Verificação de assinatura criptográfica HMAC-SHA256 se o canal possuir webhook_secret
      if (channelId) {
        const channelConfig = service.getChannelById(channelId, { showSecrets: true });
        if (channelConfig?.webhook_secret) {
          const sig = (request.headers['x-hub-signature-256'] ||
            request.headers['x-webhook-secret'] ||
            request.headers['authorization']) as string | undefined;

          if (!verifyWebhookSignature(channelConfig.webhook_secret, body, sig)) {
            return reply.status(401).send({
              error: 'UNAUTHORIZED_WEBHOOK_SIGNATURE',
              message: 'Assinatura inválida do webhook externo',
            });
          }
        }
      }

      const input: IngestOrderInput = {
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        channelId: Number(body.channelId || body.channel_id),
        externalOrderId: String(body.externalOrderId || body.external_order_id),
        displayOrderId: body.displayOrderId || body.display_order_id,
        customerName: String(body.customerName || body.customer_name),
        customerDocument: body.customerDocument || body.customer_document,
        customerPhone: body.customerPhone || body.customer_phone,
        deliveryAddress: String(body.deliveryAddress || body.delivery_address),
        subtotal: Number(body.subtotal),
        deliveryFee: body.deliveryFee !== undefined ? Number(body.deliveryFee) : 0,
        platformFee: body.platformFee !== undefined ? Number(body.platformFee) : 0,
        totalAmount: Number(body.totalAmount || body.total_amount),
        placedAt: body.placedAt || body.placed_at,
        items: (body.items || []).map((it: any) => ({
          productId: Number(it.productId || it.product_id),
          externalSku: it.externalSku || it.external_sku,
          productName: String(it.productName || it.product_name),
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice || it.unit_price),
          totalPrice: Number(it.totalPrice || it.total_price),
          batchNumber: it.batchNumber || it.batch_number,
        })),
      };

      const order = service.ingestOrder(input);
      return reply.status(201).send(order);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao processar pedido via webhook' });
    }
  });

  // 8. Pedidos: Listar
  app.get('/api/marketplaces/orders', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId ? Number(query.storeId) : 1;
      const status = query.status as MarketplaceOrderStatus | undefined;
      const channelId = query.channelId ? Number(query.channelId) : undefined;

      const orders = service.listOrders(storeId, status, channelId);
      return reply.send(orders);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 9. Pedidos: Buscar por ID
  app.get('/api/marketplaces/orders/:id', async (request, reply) => {
    try {
      const params = request.params as any;
      const order = service.getOrderById(Number(params.id));
      if (!order) return reply.status(404).send({ error: 'Pedido não encontrado' });
      return reply.send(order);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 10. Pedidos: Atualizar Status
  app.patch('/api/marketplaces/orders/:id/status', async (request, reply) => {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const orderId = Number(params.id);
      const newStatus = body.status as MarketplaceOrderStatus;
      const cancellationReason = body.cancellationReason || body.cancellation_reason;

      const order = service.updateOrderStatus(orderId, newStatus, cancellationReason);
      return reply.send(order);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 11. KPIs do Hub Omnichannel
  app.get('/api/marketplaces/kpis', async (request, reply) => {
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
