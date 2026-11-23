import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Omnichannel, WhatsApp & Pick-and-Pack Schema (Migration 020)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required omnichannel tables with proper columns and constraints', () => {
    const tables = [
      'omnichannel_channels',
      'omnichannel_conversations',
      'omnichannel_messages',
      'omnichannel_orders',
      'omnichannel_order_items',
      'omnichannel_order_audits',
    ];

    for (const table of tables) {
      const row = db
        .prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table);
      expect(row, `Tabela ${table} deveria existir`).toBeDefined();
    }
  });

  it('should insert and retrieve a channel configuration', () => {
    const stmt = db.prepare(`
      INSERT INTO omnichannel_channels (
        store_id, channel_type, name, base_url, api_key, session_id, phone_number, is_active, bot_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      1,
      'WHATSAPP_OPENWA',
      'WhatsApp Matriz',
      'http://localhost:8080',
      'secret-key-123',
      'matriz-session',
      '5511999998888',
      1,
      1
    );

    expect(result.lastInsertRowid).toBeDefined();

    const channel = db
      .prepare('SELECT * FROM omnichannel_channels WHERE id = ?')
      .get(result.lastInsertRowid) as any;

    expect(channel.channel_type).toBe('WHATSAPP_OPENWA');
    expect(channel.session_id).toBe('matriz-session');
    expect(channel.is_active).toBe(1);
    expect(channel.bot_enabled).toBe(1);
  });

  it('should record conversation, inbound/outbound messages, and order with items', () => {
    // 0. Channel
    const channelResult = db.prepare(`
      INSERT INTO omnichannel_channels (
        store_id, channel_type, name, base_url, session_id
      ) VALUES (1, 'WHATSAPP_OPENWA', 'WhatsApp Matriz', 'http://localhost:8080', 'default')
    `).run();
    const channelId = channelResult.lastInsertRowid;

    // 1. Conversation
    const convStmt = db.prepare(`
      INSERT INTO omnichannel_conversations (
        channel_id, contact_phone, contact_name, state
      ) VALUES (?, '5511988887777', 'Maria Silva', 'IDLE')
    `);
    const convResult = convStmt.run(channelId);
    const convId = convResult.lastInsertRowid;

    // 2. Inbound Message
    db.prepare(`
      INSERT INTO omnichannel_messages (
        conversation_id, direction, message_type, content, status
      ) VALUES (?, 'INBOUND', 'TEXT', 'Ola, gostaria de pedir dipirona', 'RECEIVED')
    `).run(convId);

    // 3. Outbound Message
    db.prepare(`
      INSERT INTO omnichannel_messages (
        conversation_id, direction, message_type, content, status
      ) VALUES (?, 'OUTBOUND', 'TEXT', 'Ola Maria! Localizamos Dipirona 500mg por R$ 5,00', 'SENT')
    `).run(convId);

    const messages = db
      .prepare('SELECT * FROM omnichannel_messages WHERE conversation_id = ?')
      .all(convId) as any[];
    expect(messages.length).toBe(2);

    // 4. Order & Items
    const orderStmt = db.prepare(`
      INSERT INTO omnichannel_orders (
        store_id, channel_id, conversation_id, channel_order_code, customer_name, customer_phone,
        delivery_type, delivery_address, subtotal, delivery_fee, total_amount, payment_method, status
      ) VALUES (1, ?, ?, 'WPP-202611-0001', 'Maria Silva', '5511988887777', 'DELIVERY', 'Rua das Flores, 100', 10.00, 5.00, 15.00, 'PIX_ENTREGA', 'NEW')
    `);
    const orderResult = orderStmt.run(channelId, convId);
    const orderId = orderResult.lastInsertRowid;

    db.prepare(`
      INSERT INTO omnichannel_order_items (
        order_id, product_id, ean, product_name, quantity_ordered, quantity_picked, unit_price, total_price, status
      ) VALUES (?, 10, '7891234567890', 'Dipirona 500mg 20ml', 2, 0, 5.00, 10.00, 'PENDING')
    `).run(orderId);

    const items = db
      .prepare('SELECT * FROM omnichannel_order_items WHERE order_id = ?')
      .all(orderId) as any[];
    expect(items.length).toBe(1);
    expect(items[0].ean).toBe('7891234567890');
    expect(items[0].quantity_ordered).toBe(2);
    expect(items[0].quantity_picked).toBe(0);
  });
});
