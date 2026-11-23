import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { OpenWaGatewayService } from '../../../src/modules/omnichannel/openwa-gateway.service';
import { OmnichannelBotService } from '../../../src/modules/omnichannel/omnichannel-bot.service';

describe('OpenWaGatewayService & OmnichannelBotService (Fase 21)', () => {
  let db: Database;
  let gateway: OpenWaGatewayService;
  let bot: OmnichannelBotService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);

    gateway = new OpenWaGatewayService(db);
    bot = new OmnichannelBotService(db, gateway);

    // Seed canal WhatsApp
    gateway.saveChannel({
      store_id: 1,
      channel_type: 'WHATSAPP_OPENWA',
      name: 'WhatsApp Farmácia Matriz',
      base_url: 'http://localhost:8080',
      session_id: 'farmacia-matriz',
      is_active: 1,
      bot_enabled: 1,
    });

    // Seed produto para busca no catálogo
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES (101, '7891010101010', 'DIPIRONA SODICA 500MG GOTAS 20ML', 'Dipirona Sodica', '1.0000.0000.001-0', 'SEM_TARJA', 'ISENTO', 10.00, 6.00, 8.50)
    `).run();

    db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity)
      VALUES (101, 'LOTE-DIP-01', '2024-01-01', '2028-12-31', 40, 0)
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('should save and list channels correctly', () => {
    const channels = gateway.listChannels(1);
    expect(channels.length).toBe(1);
    expect(channels[0].session_id).toBe('farmacia-matriz');
    expect(channels[0].bot_enabled).toBe(1);
  });

  it('should answer with main menu on initial contact or greeting', async () => {
    const res = await bot.handleOpenWaWebhook({
      event: 'onMessage',
      session: 'farmacia-matriz',
      data: {
        id: 'msg-001',
        from: '5511999887766@c.us',
        body: 'Olá',
        sender: { pushname: 'Carlos Oliveira' },
      },
    });

    expect(res.handled).toBe(true);
    expect(res.replyText).toContain('Olá, *Carlos Oliveira*!');
    expect(res.replyText).toContain('1️⃣ *Consultar Preço & Estoque de Remédios*');

    // Confere que gravou as mensagens inbound e outbound
    const convs = gateway.listConversations(1);
    expect(convs.length).toBe(1);
    expect(convs[0].contact_phone).toBe('5511999887766');

    const msgs = gateway.getConversationMessages(convs[0].id!);
    expect(msgs.length).toBe(2);
    expect(msgs[0].direction).toBe('INBOUND');
    expect(msgs[1].direction).toBe('OUTBOUND');
  });

  it('should search product in catalog and return price and availability', async () => {
    // 1. Inicia conversa pedindo busca (opção 1)
    await bot.handleOpenWaWebhook({
      event: 'onMessage',
      session: 'farmacia-matriz',
      data: {
        id: 'msg-002',
        from: '5511999887766@c.us',
        body: '1',
      },
    });

    // 2. Envia termo da busca
    const searchRes = await bot.handleOpenWaWebhook({
      event: 'onMessage',
      session: 'farmacia-matriz',
      data: {
        id: 'msg-003',
        from: '5511999887766@c.us',
        body: 'DIPIRONA',
      },
    });

    expect(searchRes.handled).toBe(true);
    expect(searchRes.replyText).toContain('DIPIRONA SODICA 500MG GOTAS 20ML');
    expect(searchRes.replyText).toContain('R$ 8.50');
    expect(searchRes.replyText).toContain('Disponível (40 un)');
  });

  it('should track delivery order status via delivery_orders table', async () => {
    // Seed motoboy e pedido de entrega
    const courierRes = db.prepare(`
      INSERT INTO couriers (name, cpf, phone, vehicle_type)
      VALUES ('Marcos Entregador', '11122233344', '5511977776655', 'MOTO')
    `).run();

    db.prepare(`
      INSERT INTO delivery_orders (
        order_number, store_id, customer_name, customer_phone, street, number, neighborhood, city,
        subtotal_amount, total_amount, payment_method, status, courier_id
      ) VALUES (
        'DEL-202611-0088', 1, 'Carlos Oliveira', '5511999887766', 'Av Paulista', '1000', 'Bela Vista', 'São Paulo',
        45.00, 45.00, 'PIX', 'DISPATCHED', ?
      )
    `).run(courierRes.lastInsertRowid);

    // 1. Seleciona opção 3 (Rastrear entrega)
    await bot.handleOpenWaWebhook({
      event: 'onMessage',
      session: 'farmacia-matriz',
      data: {
        id: 'msg-004',
        from: '5511999887766@c.us',
        body: '3',
      },
    });

    // 2. Informa o número do pedido
    const trackRes = await bot.handleOpenWaWebhook({
      event: 'onMessage',
      session: 'farmacia-matriz',
      data: {
        id: 'msg-005',
        from: '5511999887766@c.us',
        body: 'DEL-202611-0088',
      },
    });

    expect(trackRes.handled).toBe(true);
    expect(trackRes.replyText).toContain('DEL-202611-0088');
    expect(trackRes.replyText).toContain('Em Rota de Entrega');
    expect(trackRes.replyText).toContain('Av Paulista, 1000');
  });

  it('should escalate conversation to human pharmacist on option 4', async () => {
    const res = await bot.handleOpenWaWebhook({
      event: 'onMessage',
      session: 'farmacia-matriz',
      data: {
        id: 'msg-006',
        from: '5511999887766@c.us',
        body: '4',
      },
    });

    expect(res.handled).toBe(true);
    expect(res.replyText).toContain('Encaminhado para o Balcão Farmacêutico');

    const conv = gateway.listConversations(1)[0];
    expect(conv.state).toBe('HUMAN_ESCALATION');
  });
});
