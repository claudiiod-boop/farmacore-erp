import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Balanços Oficiais BMPO, RMNRA & RMNRB Schema (Migration 028)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required regulatory tables cleanly', () => {
    const tables = [
      'regulatory_reports',
      'regulatory_report_items',
      'regulatory_prescriptions_rel',
    ];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }
  });

  it('should insert a regulatory report and linked item and prescription relation', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };

    // Inserir produto controlado
    const prodRes = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7891234567888', 'Diazepam 10mg 30 comp', 'Diazepam', '1004300120011', 'PRETA', 'B1', 22.0, 10.0, 18.0)
    `).run();
    const prodId = Number(prodRes.lastInsertRowid);

    // Inserir relatório BMPO
    const reportRes = db.prepare(`
      INSERT INTO regulatory_reports (store_id, report_type, period_year, period_quarter, pharmacist_name, pharmacist_crf, status)
      VALUES (?, 'BMPO_TRIMESTRAL', 2026, 4, 'Dra. Vanessa', 'CRF-SP 55443', 'DRAFT')
    `).run(store.id);
    const reportId = Number(reportRes.lastInsertRowid);

    // Inserir item do balanço
    db.prepare(`
      INSERT INTO regulatory_report_items (
        report_id, product_id, active_ingredient, therapeutic_class, control_list, presentation, initial_stock, acquisitions, sales, losses, final_stock
      ) VALUES (?, ?, 'Diazepam', 'Ansiolítico', 'B1', '30 Comprimidos', 10, 5, 4, 0, 11)
    `).run(reportId, prodId);

    // Inserir relação de notificação de receita
    db.prepare(`
      INSERT INTO regulatory_prescriptions_rel (
        report_id, product_id, prescription_notification_number, notification_type, dispensation_date, prescriber_name, prescriber_register_number, prescriber_uf, patient_name, buyer_name, buyer_document, quantity_dispensed, batch_number
      ) VALUES (?, ?, 'NOTIF-B-998877', 'B', '2026-11-23', 'Dr. Roberto', 'CRM 99887', 'SP', 'Carlos Paciente', 'Maria Compradora', '12345678900', 1, 'LOTE-DIAZ-01')
    `).run(reportId, prodId);

    const reportCount = db.prepare('SELECT COUNT(*) as count FROM regulatory_reports WHERE id = ?').get(reportId) as { count: number };
    expect(reportCount.count).toBe(1);

    const items = db.prepare('SELECT * FROM regulatory_report_items WHERE report_id = ?').all(reportId) as any[];
    expect(items.length).toBe(1);
    expect(items[0].active_ingredient).toBe('Diazepam');
    expect(items[0].final_stock).toBe(11);

    const prescs = db.prepare('SELECT * FROM regulatory_prescriptions_rel WHERE report_id = ?').all(reportId) as any[];
    expect(prescs.length).toBe(1);
    expect(prescs[0].prescription_notification_number).toBe('NOTIF-B-998877');
  });
});
