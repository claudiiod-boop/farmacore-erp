import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { MarketplaceHubService } from '../../../src/modules/marketplaces/marketplace-hub.service';

describe('MarketplaceHubService', () => {
  let db: Database;
  let service: MarketplaceHubService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new MarketplaceHubService(db);

    // Produto de teste
    db.prepare(`
      INSERT INTO products (
        id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active
      ) VALUES (
        1, '7891234567890', 'Dipirona Monoidratada 500mg', 'Dipirona', '1004300010011', 'SEM_TARJA', 'NAO_CONTROLADO',
        20.0, 10.0, 15.0, 1
      )
    `).run();

    // Lote de teste com 50 unidades válidas
    db.prepare(`
      INSERT INTO batches (
        id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
      ) VALUES (
        1, 1, 'L-DIP-01', '2026-01-01', '2027-12-31', 50, 0
      )
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('1. Registra e lista canais de marketplace', () => {
    const channel = service.registerOrUpdateChannel({
      storeId: 1,
      channelName: 'IFOOD',
      merchantId: 'IFOOD-STORE-1',
      apiKey: 'key_123',
      commissionRate: 15.0,
      stockBufferPercent: 10.0,
      autoConfirmOrders: true,
    });

    expect(channel.id).toBeGreaterThan(0);
    expect(channel.channel_name).toBe('IFOOD');
    expect(channel.commission_rate).toBe(15.0);

    const list = service.listChannels(1);
    expect(list.length).toBe(1);
    expect(list[0].merchant_id).toBe('IFOOD-STORE-1');
  });

  it('2. Mapeia produto do catálogo e calcula preço com markup', () => {
    const channel = service.registerOrUpdateChannel({
      storeId: 1,
      channelName: 'RAPPI',
      commissionRate: 12.0,
    });

    const mapping = service.mapCatalogProduct({
      channelId: channel.id,
      productId: 1,
      externalSku: 'SKU-RAPPI-DIP',
      markupPercent: 20.0, // 15.0 * 1.2 = 18.00
    });

    expect(mapping.external_sku).toBe('SKU-RAPPI-DIP');
    expect(mapping.markup_percent).toBe(20.0);
    expect(mapping.calculated_price).toBe(18.0);
  });

  it('3. Sincroniza estoque aplicando buffer percentual anti-ruptura', () => {
    const channel = service.registerOrUpdateChannel({
      storeId: 1,
      channelName: 'FARMACIAS_APP',
      stockBufferPercent: 10.0, // 50 * 0.9 = 45
    });

    service.mapCatalogProduct({
      channelId: channel.id,
      productId: 1,
      externalSku: 'FAPP-100',
    });

    const syncResult = service.syncStock(channel.id);
    expect(syncResult.syncedCount).toBe(1);
    expect(syncResult.items[0].availableStock).toBe(45);
    expect(syncResult.items[0].bufferDeducted).toBe(5);
  });

  it('4. Ingestão de pedido externo via webhook e reserva de estoque', () => {
    const channel = service.registerOrUpdateChannel({
      storeId: 1,
      channelName: 'IFOOD',
      autoConfirmOrders: true,
    });

    const order = service.ingestOrder({
      storeId: 1,
      channelId: channel.id,
      externalOrderId: 'IF-ORD-8822',
      customerName: 'Fernanda Rocha',
      customerPhone: '11988887777',
      deliveryAddress: 'Rua das Flores, 123',
      subtotal: 30.0,
      deliveryFee: 5.0,
      totalAmount: 35.0,
      items: [
        {
          productId: 1,
          productName: 'Dipirona Monoidratada 500mg',
          quantity: 2,
          unitPrice: 15.0,
          totalPrice: 30.0,
        },
      ],
    });

    expect(order.id).toBeGreaterThan(0);
    expect(order.status).toBe('CONFIRMED');
    expect(order.items?.length).toBe(1);

    // Verifica que 2 unidades foram reservadas no lote
    const batch = db.prepare('SELECT reserved_quantity FROM batches WHERE id = 1').get() as any;
    expect(batch.reserved_quantity).toBe(2);
  });

  it('5. Máquina de estados: CONFIRMED -> PREPARING -> READY_FOR_PICKUP -> DISPATCHED e baixa do estoque', () => {
    const channel = service.registerOrUpdateChannel({
      storeId: 1,
      channelName: 'CONSULTA_REMEDIOS',
      autoConfirmOrders: true,
    });

    const order = service.ingestOrder({
      storeId: 1,
      channelId: channel.id,
      externalOrderId: 'CR-9901',
      customerName: 'Lucas Moura',
      deliveryAddress: 'Av. Brasil, 500',
      subtotal: 15.0,
      totalAmount: 15.0,
      items: [
        {
          productId: 1,
          productName: 'Dipirona Monoidratada 500mg',
          quantity: 1,
          unitPrice: 15.0,
          totalPrice: 15.0,
        },
      ],
    });

    // Transição PREPARING
    const prepOrder = service.updateOrderStatus(order.id, 'PREPARING');
    expect(prepOrder.status).toBe('PREPARING');

    // Transição READY_FOR_PICKUP
    const readyOrder = service.updateOrderStatus(order.id, 'READY_FOR_PICKUP');
    expect(readyOrder.status).toBe('READY_FOR_PICKUP');

    // Transição DISPATCHED (baixa física no lote)
    const dispOrder = service.updateOrderStatus(order.id, 'DISPATCHED');
    expect(dispOrder.status).toBe('DISPATCHED');
    expect(dispOrder.dispatched_at).toBeDefined();

    const batch = db.prepare('SELECT quantity, reserved_quantity FROM batches WHERE id = 1').get() as any;
    expect(batch.quantity).toBe(49);
    expect(batch.reserved_quantity).toBe(0);

    // Finalizar com DELIVERED
    const delivOrder = service.updateOrderStatus(order.id, 'DELIVERED');
    expect(delivOrder.status).toBe('DELIVERED');
  });

  it('6. Cancela pedido e libera estoque reservado', () => {
    const channel = service.registerOrUpdateChannel({
      storeId: 1,
      channelName: 'IFOOD',
      autoConfirmOrders: true,
    });

    const order = service.ingestOrder({
      storeId: 1,
      channelId: channel.id,
      externalOrderId: 'IF-CANCEL-1',
      customerName: 'Pedro Silva',
      deliveryAddress: 'Rua Verde, 10',
      subtotal: 15.0,
      totalAmount: 15.0,
      items: [
        {
          productId: 1,
          productName: 'Dipirona Monoidratada 500mg',
          quantity: 3,
          unitPrice: 15.0,
          totalPrice: 15.0,
        },
      ],
    });

    const batchBefore = db.prepare('SELECT reserved_quantity FROM batches WHERE id = 1').get() as any;
    expect(batchBefore.reserved_quantity).toBe(3);

    const cancelledOrder = service.updateOrderStatus(order.id, 'CANCELLED', 'Cliente desistiu');
    expect(cancelledOrder.status).toBe('CANCELLED');
    expect(cancelledOrder.cancellation_reason).toBe('Cliente desistiu');

    const batchAfter = db.prepare('SELECT reserved_quantity FROM batches WHERE id = 1').get() as any;
    expect(batchAfter.reserved_quantity).toBe(0);
  });

  it('7. Retorna KPIs consolidados de marketplaces', () => {
    const channel = service.registerOrUpdateChannel({
      storeId: 1,
      channelName: 'IFOOD',
      autoConfirmOrders: true,
    });

    service.ingestOrder({
      storeId: 1,
      channelId: channel.id,
      externalOrderId: 'KPI-ORD-1',
      customerName: 'Julia',
      deliveryAddress: 'Rua A',
      subtotal: 100.0,
      totalAmount: 100.0,
      items: [
        {
          productId: 1,
          productName: 'Dipirona',
          quantity: 1,
          unitPrice: 100.0,
          totalPrice: 100.0,
        },
      ],
    });

    const kpis = service.getKpis(1);
    expect(kpis.totalOrders).toBe(1);
    expect(kpis.pendingOrders).toBe(1);
    expect(kpis.totalRevenue).toBe(100.0);
    expect(kpis.activeChannelsCount).toBe(1);
  });
});
