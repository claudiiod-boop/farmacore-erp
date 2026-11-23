import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Omnichannel, WhatsApp & Pick-and-Pack (Fase 21)', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('should save channel, list channels and process OpenWA webhook', async () => {
    // 1. Criar canal
    const createChannelRes = await app.inject({
      method: 'POST',
      url: '/api/omnichannel/channels',
      payload: {
        store_id: 1,
        channel_type: 'WHATSAPP_OPENWA',
        name: 'WhatsApp Teste',
        base_url: 'http://localhost:8080',
        session_id: 'test-session',
        phone_number: '5511999887766',
        is_active: 1,
        bot_enabled: 1,
      },
    });

    expect(createChannelRes.statusCode).toBe(201);
    const channel = JSON.parse(createChannelRes.body);
    expect(channel.id).toBeDefined();

    // 2. Listar canais
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/omnichannel/channels?storeId=1',
    });
    expect(listRes.statusCode).toBe(200);
    const channels = JSON.parse(listRes.body);
    expect(channels.length).toBe(1);

    // 3. Receber Webhook
    const webhookRes = await app.inject({
      method: 'POST',
      url: '/api/omnichannel/webhook/openwa',
      payload: {
        event: 'onMessage',
        session: 'test-session',
        data: {
          id: 'wpp-001',
          from: '5511988887777@c.us',
          body: 'Ola',
          sender: { pushname: 'Ana Carolina' },
        },
      },
    });

    expect(webhookRes.statusCode).toBe(200);
    const webhookData = JSON.parse(webhookRes.body);
    expect(webhookData.handled).toBe(true);
    expect(webhookData.replyText).toContain('Olá, *Ana Carolina*!');
  });

  it('should manage order lifecycle: create, start-picking, scan and dispatch', async () => {
    // Criar canal prévio
    const channelRes = await app.inject({
      method: 'POST',
      url: '/api/omnichannel/channels',
      payload: {
        store_id: 1,
        channel_type: 'WHATSAPP_OPENWA',
        name: 'WhatsApp Vendas',
        base_url: 'http://localhost:8080',
        session_id: 'vendas-session',
      },
    });
    const channel = JSON.parse(channelRes.body);

    // 1. Criar pedido
    const createOrderRes = await app.inject({
      method: 'POST',
      url: '/api/omnichannel/orders',
      payload: {
        channel_id: channel.id,
        customer_name: 'Roberto Souza',
        customer_phone: '5511977778888',
        delivery_address: 'Rua Augusta, 1200 - Consolação',
        payment_method: 'PIX_ENTREGA',
        items: [
          {
            product_id: 10,
            ean: '7891234567890',
            product_name: 'Ibuprofeno 600mg',
            quantity_ordered: 1,
            unit_price: 15.0,
          },
        ],
      },
    });

    expect(createOrderRes.statusCode).toBe(201);
    const order = JSON.parse(createOrderRes.body);
    expect(order.status).toBe('NEW');

    // 2. Iniciar separação
    const startRes = await app.inject({
      method: 'POST',
      url: `/api/omnichannel/orders/${order.id}/start-picking`,
      payload: { operatorId: 1, operatorName: 'CARLOS_FARM' },
    });
    expect(startRes.statusCode).toBe(200);
    expect(JSON.parse(startRes.body).status).toBe('IN_SEPARATION');

    // 3. Bipar item (scan)
    const scanRes = await app.inject({
      method: 'POST',
      url: `/api/omnichannel/orders/${order.id}/scan`,
      payload: { barcode: '7891234567890', operatorName: 'CARLOS_FARM' },
    });
    expect(scanRes.statusCode).toBe(200);
    const scanResult = JSON.parse(scanRes.body);
    expect(scanResult.allItemsPicked).toBe(true);

    // 4. Despachar
    const dispatchRes = await app.inject({
      method: 'POST',
      url: `/api/omnichannel/orders/${order.id}/dispatch`,
      payload: { operatorName: 'CARLOS_FARM' },
    });
    expect(dispatchRes.statusCode).toBe(200);
    expect(JSON.parse(dispatchRes.body).status).toBe('DISPATCHED');
  });
});
