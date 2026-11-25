import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Migration 046: Emissor e Validador de Cupom Fiscal SAT (CF-e-SAT SP / MF-e CE)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('deve criar com sucesso as tabelas sat_devices, cfe_sat_documents e cfe_sat_contingency_queue', () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sat_devices', 'cfe_sat_documents', 'cfe_sat_contingency_queue')"
      )
      .all() as Array<{ name: string }>;

    expect(tables.map((t) => t.name)).toContain('sat_devices');
    expect(tables.map((t) => t.name)).toContain('cfe_sat_documents');
    expect(tables.map((t) => t.name)).toContain('cfe_sat_contingency_queue');
  });

  it('deve inserir e consultar dispositivo SAT e documento CF-e com constraints e índices', () => {
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj) VALUES (1, 'Farma Matriz SP', '11.111.111/0001-11')
    `).run();

    db.prepare(`
      INSERT INTO sales (id, total_amount, created_at) VALUES (10, 85.50, '2026-11-25 10:00:00')
    `).run();

    const dev = db.prepare(`
      INSERT INTO sat_devices (
        store_id, pos_station_id, serial_number, model, sign_code
      ) VALUES (1, 'CX-01', '000123456', 'DIMEP_D_SAT', 'SIGNAUTH12345')
    `).run();

    const devId = Number(dev.lastInsertRowid);

    db.prepare(`
      INSERT INTO cfe_sat_documents (
        sale_id, store_id, sat_device_id, access_key, cfe_number,
        session_random_number, total_amount, net_amount, xml_sent, xml_signed,
        qr_code_payload, sefaz_status_code, sefaz_status_message
      ) VALUES (
        10, 1, ?, '35261111111111000111590001234560000011234567', 1,
        123456, 85.50, 85.50, '<xml>sent</xml>', '<xml>signed</xml>',
        '352611...|20261125...|85.50', '06000', 'Emitido com sucesso'
      )
    `).run(devId);

    const doc = db.prepare('SELECT * FROM cfe_sat_documents WHERE sale_id = 10').get() as any;
    expect(doc.cfe_number).toBe(1);
    expect(doc.access_key).toHaveLength(44);
    expect(doc.status).toBe('AUTHORIZED');
  });
});
