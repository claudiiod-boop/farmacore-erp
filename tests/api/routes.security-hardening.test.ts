import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server';
import { getDatabase, Database } from '../../src/database/connection';

describe('Security Hardening REST API Tests', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    app = await buildServer(db);
  }, 30000);

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. Deve incluir headers globais de segurança HTTP nas respostas', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-xss-protection']).toBe('1; mode=block');
  });

  it('2. Deve mascarar segredos de canais de marketplace em listagens públicas', async () => {
    // Cadastrar canal com segredos
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/marketplaces/channels',
      payload: {
        storeId: 1,
        channelName: 'IFOOD',
        merchantId: 'M-123',
        apiKey: 'chave-publica-ifood',
        apiSecret: 'segredo-critico-ifood',
        webhookSecret: 'secret-webhook-hmac',
      },
    });
    expect(createRes.statusCode).toBe(201);

    // Listar canais
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/marketplaces/channels?storeId=1',
    });
    expect(listRes.statusCode).toBe(200);
    const channels = JSON.parse(listRes.payload);
    expect(channels.length).toBeGreaterThan(0);

    const channel = channels.find((c: any) => c.channel_name === 'IFOOD');
    expect(channel.api_secret).toBe('********');
    expect(channel.webhook_secret).toBe('********');
  });

  it('3. Deve mascarar api_key de canais OpenWA em listagens públicas', async () => {
    // Cadastrar canal omnichannel
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/omnichannel/channels',
      payload: {
        store_id: 1,
        channel_type: 'WHATSAPP_OPENWA',
        name: 'WhatsApp Balcão',
        base_url: 'http://localhost:8085',
        api_key: 'token-secreto-whatsapp-openwa',
        session_id: 'balcao-session-1',
      },
    });
    expect(createRes.statusCode).toBe(201);

    // Listar canais
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/omnichannel/channels?storeId=1',
    });
    expect(listRes.statusCode).toBe(200);
    const channels = JSON.parse(listRes.payload);
    const channel = channels.find((c: any) => c.name === 'WhatsApp Balcão');
    expect(channel.api_key).toBe('********');
  });

  it('4. Deve validar assinatura criptográfica de webhook e rejeitar requisição não autenticada', async () => {
    const webhookSecret = 'my-super-hmac-webhook-key';

    // 1. Cadastra canal com webhookSecret configurado
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/marketplaces/channels',
      payload: {
        storeId: 1,
        channelName: 'RAPPI',
        merchantId: 'RAPPI-001',
        webhookSecret,
      },
    });
    const channel = JSON.parse(createRes.payload);

    const orderPayload = {
      storeId: 1,
      channelId: channel.id,
      externalOrderId: 'RAPPI-WH-100',
      customerName: 'Cliente Protegido',
      deliveryAddress: 'Av Paulista, 1000',
      subtotal: 10.0,
      totalAmount: 10.0,
      items: [
        {
          productId: 1,
          productName: 'Produto Catalogo',
          quantity: 1,
          unitPrice: 10.0,
          totalPrice: 10.0,
        },
      ],
    };

    // 2. Dispara webhook SEM assinatura -> Deve falhar com 401
    const unauthRes = await app.inject({
      method: 'POST',
      url: '/api/marketplaces/webhook/RAPPI',
      payload: orderPayload,
    });
    expect(unauthRes.statusCode).toBe(401);
    expect(JSON.parse(unauthRes.payload).error).toBe('UNAUTHORIZED_WEBHOOK_SIGNATURE');

    // 3. Dispara webhook COM assinatura HMAC-SHA256 válida -> Deve passar com 201
    const rawBody = JSON.stringify(orderPayload);
    const validSignature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    const authRes = await app.inject({
      method: 'POST',
      url: '/api/marketplaces/webhook/RAPPI',
      headers: {
        'x-hub-signature-256': `sha256=${validSignature}`,
      },
      payload: orderPayload,
    });
    expect(authRes.statusCode).toBe(201);
    expect(JSON.parse(authRes.payload).external_order_id).toBe('RAPPI-WH-100');
  });

  it('5. Deve bloquear tentativa de cadastro de RT por operador não autorizado (Anti-Escalada de Privilégio)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/assistance/staff',
      headers: {
        'x-operator-role': 'BALCONISTA',
      },
      payload: {
        store_id: 1,
        name: 'Farmacêutico Invasor',
        cpf: '12345678901',
        crf_number: '99999',
        crf_uf: 'SP',
        role: 'RT_TITULAR',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).error).toBe('FORBIDDEN');
  });
});
