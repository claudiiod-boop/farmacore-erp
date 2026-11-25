import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerMarketplaceRoutes } from '../../src/modules/marketplaces/marketplace.routes';

describe('Marketplaces REST Routes', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    // Produto de teste
    db.prepare(`
      INSERT INTO products (
        id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active
      ) VALUES (
        1, '7891234567890', 'Dipirona 500mg', 'Dipirona', '1004300010011', 'SEM_TARJA', 'NAO_CONTROLADO',
        20.0, 10.0, 15.0, 1
      )
    `).run();

    // Lote com 40 unidades
    db.prepare(`
      INSERT INTO batches (
        id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
      ) VALUES (
        1, 1, 'L-DIP-01', '2026-01-01', '2027-12-31', 40, 0
      )
    `).run();

    app = fastify();
    await registerMarketplaceRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. POST /api/marketplaces/channels - cadastra canal e GET /api/marketplaces/channels lista', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/marketplaces/channels',
      payload: {
        storeId: 1,
        channelName: 'IFOOD',
        merchantId: 'MERCH-IF-1',
        commissionRate: 14.5,
        stockBufferPercent: 10.0,
      },
    });

    expect(postRes.statusCode).toBe(201);
    const channel = JSON.parse(postRes.payload);
    expect(channel.channel_name).toBe('IFOOD');

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/marketplaces/channels?storeId=1',
    });
    expect(getRes.statusCode).toBe(200);
    const list = JSON.parse(getRes.payload);
    expect(list.length).toBe(1);
  });

  it('2. POST /api/marketplaces/catalog/map e sincronização de estoque', async () => {
    const chanRes = await app.inject({
      method: 'POST',
      url: '/api/marketplaces/channels',
      payload: { storeId: 1, channelName: 'RAPPI', stockBufferPercent: 10.0 },
    });
    const channel = JSON.parse(chanRes.payload);

    // Mapeamento
    const mapRes = await app.inject({
      method: 'POST',
      url: '/api/marketplaces/catalog/map',
      payload: {
        channelId: channel.id,
        productId: 1,
        externalSku: 'RAPPI-SKU-1',
        markupPercent: 10.0,
      },
    });
    expect(mapRes.statusCode).toBe(201);

    // Sincronização
    const syncRes = await app.inject({
      method: 'POST',
      url: `/api/marketplaces/catalog/${channel.id}/sync-stock`,
    });
    expect(syncRes.statusCode).toBe(200);
    const syncData = JSON.parse(syncRes.payload);
    expect(syncData.syncedCount).toBe(1);
    expect(syncData.items[0].availableStock).toBe(36); // 40 * 0.9 = 36
  });

  it('3. POST /api/marketplaces/webhook/:channel - ingere pedido e PATCH /status atualiza', async () => {
    const chanRes = await app.inject({
      method: 'POST',
      url: '/api/marketplaces/channels',
      payload: { storeId: 1, channelName: 'IFOOD', autoConfirmOrders: true },
    });
    const channel = JSON.parse(chanRes.payload);

    // Webhook ingestão
    const webhookRes = await app.inject({
      method: 'POST',
      url: '/api/marketplaces/webhook/IFOOD',
      payload: {
        storeId: 1,
        channelId: channel.id,
        externalOrderId: 'IF-ORD-9988',
        customerName: 'Renata Castro',
        deliveryAddress: 'Rua A, 500',
        subtotal: 30.0,
        totalAmount: 30.0,
        items: [
          {
            productId: 1,
            productName: 'Dipirona 500mg',
            quantity: 2,
            unitPrice: 15.0,
            totalPrice: 30.0,
          },
        ],
      },
    });
    expect(webhookRes.statusCode).toBe(201);
    const order = JSON.parse(webhookRes.payload);
    expect(order.status).toBe('CONFIRMED');

    // Despacho
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/marketplaces/orders/${order.id}/status`,
      payload: { status: 'DISPATCHED' },
    });
    expect(patchRes.statusCode).toBe(200);
    const updated = JSON.parse(patchRes.payload);
    expect(updated.status).toBe('DISPATCHED');
  });

  it('4. GET /api/marketplaces/kpis - retorna estatísticas', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/marketplaces/kpis?storeId=1',
    });
    expect(res.statusCode).toBe(200);
    const kpis = JSON.parse(res.payload);
    expect(kpis.totalOrders).toBeDefined();
    expect(kpis.totalRevenue).toBeDefined();
  });
});
