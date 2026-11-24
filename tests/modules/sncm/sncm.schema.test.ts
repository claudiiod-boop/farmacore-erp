import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Rastreabilidade SNCM & DataMatrix Schema (Migration 029)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required SNCM tables cleanly', () => {
    const tables = ['sncm_items', 'sncm_events'];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }
  });

  it('should insert a serialized medicine item and record a RECEBIMENTO event', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };

    // Inserir produto
    const prodRes = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7891234567890', 'Rivotril 2mg 30 comp', 'Clonazepam', '1004300010022', 'PRETA', 'B1', 28.0, 12.0, 22.0)
    `).run();
    const prodId = Number(prodRes.lastInsertRowid);

    // Inserir item serializado SNCM
    const itemRes = db.prepare(`
      INSERT INTO sncm_items (
        product_id, store_id, gtin, serial_number, expiration_date, batch_number, status
      ) VALUES (?, ?, '07891234567890', 'SER123456789', '2028-05-31', 'LOTE-RIVO-01', 'IN_STOCK')
    `).run(prodId, store.id);
    const itemId = Number(itemRes.lastInsertRowid);

    // Inserir evento de recebimento
    const eventRes = db.prepare(`
      INSERT INTO sncm_events (
        store_id, sncm_item_id, event_type, nfe_access_key, fiscal_doc_number, transmission_status, operator_name
      ) VALUES (?, ?, 'RECEBIMENTO', '35261100000000000000550010000000011000000010', 'NF-001', 'PENDING', 'Conferente Estoque')
    `).run(store.id, itemId);
    const eventId = Number(eventRes.lastInsertRowid);

    expect(itemId).toBeGreaterThan(0);
    expect(eventId).toBeGreaterThan(0);

    const item = db.prepare('SELECT * FROM sncm_items WHERE id = ?').get(itemId) as any;
    expect(item.serial_number).toBe('SER123456789');
    expect(item.status).toBe('IN_STOCK');

    const event = db.prepare('SELECT * FROM sncm_events WHERE id = ?').get(eventId) as any;
    expect(event.event_type).toBe('RECEBIMENTO');
    expect(event.transmission_status).toBe('PENDING');

    // Valida constraint UNIQUE (gtin, serial_number)
    expect(() => {
      db.prepare(`
        INSERT INTO sncm_items (
          product_id, store_id, gtin, serial_number, expiration_date, batch_number, status
        ) VALUES (?, ?, '07891234567890', 'SER123456789', '2028-05-31', 'LOTE-RIVO-01', 'IN_STOCK')
      `).run(prodId, store.id);
    }).toThrow();
  });
});
