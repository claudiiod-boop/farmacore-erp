import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Migration 047: Balança de Precisão & Checkout com Código de Barras Pesável', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('deve criar com sucesso as tabelas scale_devices, weighted_barcode_configs e scale_weighing_logs', () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('scale_devices', 'weighted_barcode_configs', 'scale_weighing_logs')"
      )
      .all() as Array<{ name: string }>;

    expect(tables.map((t) => t.name)).toContain('scale_devices');
    expect(tables.map((t) => t.name)).toContain('weighted_barcode_configs');
    expect(tables.map((t) => t.name)).toContain('scale_weighing_logs');
  });

  it('deve inserir e consultar dispositivo de balança e log de pesagem com chaves estrangeiras', () => {
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj) VALUES (1, 'Farma Matriz Balança', '11.111.111/0001-11')
    `).run();

    db.prepare(`
      INSERT INTO products (
        id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price
      ) VALUES (
        1, '7891234567890', 'Camomila Flores a Granel 100g', 'Matricaria recutita', 'ISENTO', 'SEM_TARJA', 'NONE', 10.0, 5.0, 8.0
      )
    `).run();

    const scale = db.prepare(`
      INSERT INTO scale_devices (
        store_id, name, serial_port, protocol, inmetro_seal_number
      ) VALUES (1, 'Toledo Checkout 01', 'COM1', 'TOLEDO_PR4', 'INMETRO-SP-2026-99')
    `).run();

    const scaleId = Number(scale.lastInsertRowid);

    db.prepare(`
      INSERT INTO scale_weighing_logs (
        scale_device_id, product_id, gross_weight_grams, tare_grams, net_weight_grams,
        price_per_kg, total_price, generated_barcode, operator_name
      ) VALUES (?, 1, 250.0, 10.0, 240.0, 80.0, 19.20, '2000010019208', 'Operador Balcão')
    `).run(scaleId);

    const log = db.prepare('SELECT * FROM scale_weighing_logs WHERE product_id = 1').get() as any;
    expect(log.net_weight_grams).toBe(240.0);
    expect(log.total_price).toBe(19.20);
    expect(log.generated_barcode).toBe('2000010019208');
  });
});
