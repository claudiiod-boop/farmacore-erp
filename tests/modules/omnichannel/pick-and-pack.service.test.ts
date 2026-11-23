import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { OpenWaGatewayService } from '../../../src/modules/omnichannel/openwa-gateway.service';
import { PickAndPackService } from '../../../src/modules/omnichannel/pick-and-pack.service';

describe('PickAndPackService (Esteira de Separação & Conferência Cega)', () => {
  let db: Database;
  let gateway: OpenWaGatewayService;
  let service: PickAndPackService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);

    gateway = new OpenWaGatewayService(db);
    service = new PickAndPackService(db, gateway);

    // Seed canal
    gateway.saveChannel({
      store_id: 1,
      channel_type: 'WHATSAPP_OPENWA',
      name: 'WhatsApp Farmácia Matriz',
      base_url: 'http://localhost:8080',
      session_id: 'farmacia-matriz',
      is_active: 1,
      bot_enabled: 1,
    });
  });

  afterEach(() => {
    db.close();
  });

  it('should create an omnichannel order with items and status NEW', () => {
    const order = service.createOrder({
      channel_id: 1,
      customer_name: 'Juliana Costa',
      customer_phone: '5511998765432',
      delivery_address: 'Rua Bela Cintra, 450 - SP',
      payment_method: 'PIX_ENTREGA',
      delivery_fee: 7.0,
      items: [
        {
          product_id: 1,
          ean: '7891111222233',
          product_name: 'Paracetamol 750mg 20cpr',
          quantity_ordered: 2,
          unit_price: 12.0,
        },
        {
          product_id: 2,
          ean: '7893333444455',
          product_name: 'Vitamina C 1g Efervescente 10cpr',
          quantity_ordered: 1,
          unit_price: 18.0,
        },
      ],
    });

    expect(order.id).toBeDefined();
    expect(order.status).toBe('NEW');
    expect(order.total_amount).toBe(49.0); // 24 + 18 + 7
    expect(order.items?.length).toBe(2);
    expect(order.items![0].status).toBe('PENDING');
  });

  it('should transition to IN_SEPARATION when startPicking is called', () => {
    const order = service.createOrder({
      channel_id: 1,
      customer_name: 'Juliana Costa',
      customer_phone: '5511998765432',
      items: [
        {
          product_id: 1,
          ean: '7891111222233',
          product_name: 'Paracetamol 750mg 20cpr',
          quantity_ordered: 1,
          unit_price: 12.0,
        },
      ],
    });

    const pickingOrder = service.startPicking(order.id!, 10, 'OPERADOR_ANA');
    expect(pickingOrder.status).toBe('IN_SEPARATION');
    expect(pickingOrder.picker_operator_id).toBe(10);
  });

  it('should increment picked quantity on valid scan and set status CHECKED when all items complete', () => {
    const order = service.createOrder({
      channel_id: 1,
      customer_name: 'Juliana Costa',
      customer_phone: '5511998765432',
      items: [
        {
          product_id: 1,
          ean: '7891111222233',
          product_name: 'Paracetamol 750mg 20cpr',
          quantity_ordered: 2,
          unit_price: 12.0,
        },
      ],
    });

    service.startPicking(order.id!, 10, 'OPERADOR_ANA');

    // 1º Scan
    const scan1 = service.scanBarcode(order.id!, '7891111222233', 'OPERADOR_ANA');
    expect(scan1.success).toBe(true);
    expect(scan1.allItemsPicked).toBe(false);
    expect(scan1.item?.quantity_picked).toBe(1);

    // 2º Scan (completa)
    const scan2 = service.scanBarcode(order.id!, '7891111222233', 'OPERADOR_ANA');
    expect(scan2.success).toBe(true);
    expect(scan2.allItemsPicked).toBe(true);
    expect(scan2.item?.quantity_picked).toBe(2);
    expect(scan2.item?.status).toBe('PICKED');

    const updated = service.getOrderById(order.id!)!;
    expect(updated.status).toBe('CHECKED');
  });

  it('should throw error when scanning wrong barcode or attempting over-picking', () => {
    const order = service.createOrder({
      channel_id: 1,
      customer_name: 'Juliana Costa',
      customer_phone: '5511998765432',
      items: [
        {
          product_id: 1,
          ean: '7891111222233',
          product_name: 'Paracetamol 750mg 20cpr',
          quantity_ordered: 1,
          unit_price: 12.0,
        },
        {
          product_id: 2,
          ean: '7893333444455',
          product_name: 'Dipirona 500mg 20cpr',
          quantity_ordered: 1,
          unit_price: 8.0,
        },
      ],
    });

    service.startPicking(order.id!, 10, 'OPERADOR_ANA');

    // Bipa código errado
    expect(() =>
      service.scanBarcode(order.id!, '7899999999999', 'OPERADOR_ANA')
    ).toThrow(/não pertence a este pedido/i);

    // Bipa o Paracetamol (fica 1/1, mas o pedido ainda está IN_SEPARATION por causa da Dipirona)
    service.scanBarcode(order.id!, '7891111222233', 'OPERADOR_ANA');

    // Tenta bipar o Paracetamol de novo (excedente)
    expect(() =>
      service.scanBarcode(order.id!, '7891111222233', 'OPERADOR_ANA')
    ).toThrow(/todas as unidades deste item já foram conferidas/i);
  });

  it('should block dispatch before CHECKED and allow dispatch with WhatsApp notification when CHECKED', async () => {
    const order = service.createOrder({
      channel_id: 1,
      customer_name: 'Juliana Costa',
      customer_phone: '5511998765432',
      items: [
        {
          product_id: 1,
          ean: '7891111222233',
          product_name: 'Paracetamol 750mg 20cpr',
          quantity_ordered: 1,
          unit_price: 12.0,
        },
      ],
    });

    // Tenta despachar enquanto ainda está NEW
    await expect(service.dispatchOrder(order.id!, 'OPERADOR_ANA')).rejects.toThrow(
      /após 100% de conferência/i
    );

    // Separa e bipa
    service.startPicking(order.id!, 10, 'OPERADOR_ANA');
    service.scanBarcode(order.id!, '7891111222233', 'OPERADOR_ANA');

    const spySend = vi.spyOn(gateway, 'sendTextMessage').mockResolvedValue({
      success: true,
      messageId: 'mock-msg-123',
    });

    const dispatched = await service.dispatchOrder(order.id!, 'OPERADOR_ANA');
    expect(dispatched.status).toBe('DISPATCHED');
    expect(spySend).toHaveBeenCalledWith(
      1,
      '5511998765432',
      expect.stringContaining('Seu Pedido FarmaCore foi Despachado')
    );
  });
});
