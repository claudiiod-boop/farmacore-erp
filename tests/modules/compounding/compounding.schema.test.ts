import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Farmácia Magistral & Manipulação Schema (Migration 021 - RDC 67/2007)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required compounding tables cleanly', () => {
    const tables = [
      'raw_materials',
      'raw_material_batches',
      'compounding_orders',
      'compounding_order_items',
    ];

    for (const table of tables) {
      const row = db
        .prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table);
      expect(row, `Tabela ${table} deveria existir`).toBeDefined();
    }
  });

  it('should register raw material and batch with quarantine status', () => {
    // 1. Raw material
    const matRes = db
      .prepare(`
        INSERT INTO raw_materials (dcb, cas_number, name, apparent_density, default_unit, cost_per_unit)
        VALUES ('03215', '50-81-7', 'Acido Ascorbico (Vitamina C)', 0.70, 'mg', 0.08)
      `)
      .run();
    const matId = matRes.lastInsertRowid;

    // 2. Batch in Quarantine
    const batchRes = db
      .prepare(`
        INSERT INTO raw_material_batches (
          raw_material_id, batch_number, supplier, manufacturer, potency_percent, moisture_percent,
          report_number, expiration_date, status, current_stock
        ) VALUES (?, 'LOTE-VITC-2026', 'Fagron', 'DSM', 99.5, 0.3, 'LAUDO-9988', '2028-10-31', 'QUARANTINE', 1000.0)
      `)
      .run(matId);

    const batch = db
      .prepare('SELECT * FROM raw_material_batches WHERE id = ?')
      .get(batchRes.lastInsertRowid) as any;

    expect(batch.status).toBe('QUARANTINE');
    expect(batch.potency_percent).toBe(99.5);
    expect(batch.moisture_percent).toBe(0.3);
  });

  it('should record compounding order with weighing items', () => {
    // Matéria prima
    const matRes = db
      .prepare(`
        INSERT INTO raw_materials (name, apparent_density, default_unit)
        VALUES ('Minoxidil Base', 0.55, 'mg')
      `)
      .run();

    // Ordem
    const orderRes = db
      .prepare(`
        INSERT INTO compounding_orders (
          order_number, patient_name, prescriber_name, prescriber_crm, prescriber_uf,
          pharmaceutical_form, total_units, capsule_size, status, subtotal, total_amount, directions
        ) VALUES (
          'OM-202611-0001', 'Lucas Mendes', 'Dra. Patricia Lima', '123456', 'SP',
          'CAPSULA', 60, '1', 'QUOTATION', 45.00, 65.00, 'Tomar 1 cápsula 1x ao dia'
        )
      `)
      .run();
    const orderId = orderRes.lastInsertRowid;

    // Item da Ficha de Pesagem
    db.prepare(`
      INSERT INTO compounding_order_items (
        order_id, raw_material_id, prescribed_dose, unit, factor_correction, factor_equivalence,
        corrected_dose_per_unit, total_dose_to_weigh, status
      ) VALUES (?, ?, 2.5, 'mg', 1.01, 1.0, 2.525, 151.5, 'PENDING')
    `).run(orderId, matRes.lastInsertRowid);

    const items = db
      .prepare('SELECT * FROM compounding_order_items WHERE order_id = ?')
      .all(orderId) as any[];

    expect(items.length).toBe(1);
    expect(items[0].prescribed_dose).toBe(2.5);
    expect(items[0].corrected_dose_per_unit).toBe(2.525);
    expect(items[0].total_dose_to_weigh).toBe(151.5);
    expect(items[0].status).toBe('PENDING');
  });
});
