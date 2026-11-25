import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Marketplace Hub & External Delivery Schema (Migration 039)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all marketplace hub tables cleanly', () => {
    const tables = [
      'marketplace_channels',
      'marketplace_catalog_mappings',
      'marketplace_orders',
      'marketplace_order_items',
    ];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }
  });

  it('should insert a channel and enforce unique (store_id, channel_name)', () => {
    const res = db.prepare(`
      INSERT INTO marketplace_channels (
        store_id, channel_name, merchant_id, commission_rate, stock_buffer_percent
      ) VALUES (1, 'IFOOD', 'MERCH-IFOOD-01', 12.5, 10.0)
    `).run();

    expect(Number(res.lastInsertRowid)).toBeGreaterThan(0);

    // Duplicidade do mesmo canal para a mesma loja deve lançar erro
    expect(() => {
      db.prepare(`
        INSERT INTO marketplace_channels (
          store_id, channel_name, merchant_id
        ) VALUES (1, 'IFOOD', 'MERCH-IFOOD-DUPLICATE')
      `).run();
    }).toThrow();
  });

  it('should insert an order with items and enforce foreign key cascades', () => {
    // 1. Canal
    const channelRes = db.prepare(`
      INSERT INTO marketplace_channels (store_id, channel_name, merchant_id)
      VALUES (1, 'RAPPI', 'RAPPI-001')
    `).run();
    const channelId = Number(channelRes.lastInsertRowid);

    // Produto
    const prodRes = db.prepare(`
      INSERT INTO products (
        ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active
      ) VALUES (
        '7891234567890', 'Paracetamol 750mg', 'Paracetamol', '1004300010011', 'SEM_TARJA', 'NAO_CONTROLADO',
        30.0, 18.0, 25.0, 1
      )
    `).run();
    const productId = Number(prodRes.lastInsertRowid);

    // 2. Pedido
    const orderRes = db.prepare(`
      INSERT INTO marketplace_orders (
        store_id, channel_id, external_order_id, display_order_id,
        customer_name, customer_document, customer_phone, delivery_address,
        subtotal, delivery_fee, total_amount, placed_at
      ) VALUES (
        1, ?, 'RAPPI-ORD-999', '#999',
        'Cliente Teste', '12345678900', '11999998888', 'Av. Paulista, 1000 - Apto 51',
        50.0, 7.90, 57.90, '2026-11-25 09:00:00'
      )
    `).run(channelId);
    const orderId = Number(orderRes.lastInsertRowid);

    // 3. Itens
    db.prepare(`
      INSERT INTO marketplace_order_items (
        order_id, product_id, external_sku, product_name, quantity, unit_price, total_price
      ) VALUES (?, ?, 'SKU-MED-1', 'Paracetamol 750mg', 2, 25.0, 50.0)
    `).run(orderId, productId);

    const items = db.prepare('SELECT * FROM marketplace_order_items WHERE order_id = ?').all(orderId);
    expect(items.length).toBe(1);
    expect((items[0] as any).product_name).toBe('Paracetamol 750mg');
  });
});
