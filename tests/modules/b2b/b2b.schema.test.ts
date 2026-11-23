import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('B2B Purchasing & EDI Quotations Schema (Migration 018)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should successfully create all B2B purchasing and quotation tables', () => {
    const tables = [
      'b2b_edi_logs',
      'b2b_quotation_campaigns',
      'b2b_quotation_items',
      'b2b_quotation_proposal_items',
      'b2b_quotation_proposals',
      'b2b_replenishment_rules',
      'b2b_suppliers',
    ];

    for (const table of tables) {
      const row = db.prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
      expect(row, `Tabela ${table} deveria existir`).toBeDefined();
    }
  });

  it('should register a pharmaceutical distributor supplier and enforce unique code', () => {
    db.prepare(`
      INSERT INTO b2b_suppliers (code, name, trade_name, cnpj, edi_code, min_order_value, lead_time_days)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('SUPP-SC', 'Santa Cruz Distribuidora de Medicamentos Ltda', 'Santa Cruz', '12345678000199', 'EDI-SC-01', 500.0, 1);

    const supplier = db.prepare<any>('SELECT * FROM b2b_suppliers WHERE code = ?').get('SUPP-SC');
    expect(supplier).toBeDefined();
    expect(supplier.name).toContain('Santa Cruz');
    expect(supplier.min_order_value).toBe(500.0);

    // Duplicidade de código deve falhar
    expect(() => {
      db.prepare(`
        INSERT INTO b2b_suppliers (code, name, cnpj)
        VALUES (?, ?, ?)
      `).run('SUPP-SC', 'Outro Fornecedor', '99888777000166');
    }).toThrow();
  });

  it('should create a quotation campaign with items and proposal items cascade on delete', () => {
    // Insere produto de teste
    const prod = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('7891234567890', 'Amoxicilina 500mg', 'Amoxicilina', '1000000000001', 'VERMELHA', 'ANTIMICROBIANO', 25.0, 18.0, 20.0);
    const productId = prod.lastInsertRowid;

    // Insere fornecedor e campanha
    const supp = db.prepare(`
      INSERT INTO b2b_suppliers (code, name, cnpj) VALUES (?, ?, ?)
    `).run('SUPP-PAN', 'Panpharma Distribuidora', '44555666000122');
    const supplierId = supp.lastInsertRowid;

    const camp = db.prepare(`
      INSERT INTO b2b_quotation_campaigns (campaign_code, store_id, title, status)
      VALUES (?, ?, ?, ?)
    `).run('COT-2026-001', 1, 'Cotação Semanal de Genéricos e Antibióticos', 'OPEN');
    const campaignId = camp.lastInsertRowid;

    // Insere item cotado
    const qItem = db.prepare(`
      INSERT INTO b2b_quotation_items (campaign_id, product_id, current_stock, suggested_quantity, requested_quantity, target_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(campaignId, productId, 2, 20, 20, 12.50);
    const quotationItemId = qItem.lastInsertRowid;

    // Insere proposta
    const prop = db.prepare(`
      INSERT INTO b2b_quotation_proposals (campaign_id, supplier_id, proposal_code, total_amount, net_amount, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(campaignId, supplierId, 'PROP-PAN-99', 240.0, 240.0, 'SUBMITTED');
    const proposalId = prop.lastInsertRowid;

    // Insere item da proposta
    db.prepare(`
      INSERT INTO b2b_quotation_proposal_items (proposal_id, quotation_item_id, product_id, offered_price, discount_percent, net_unit_price, available_quantity, is_winner)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(proposalId, quotationItemId, productId, 12.00, 5.0, 11.40, 20, 1);

    const items = db.prepare<any>('SELECT * FROM b2b_quotation_proposal_items WHERE proposal_id = ?').all(proposalId);
    expect(items.length).toBe(1);

    // Deleção em cascata da campanha deve remover itens e propostas
    db.prepare('DELETE FROM b2b_quotation_campaigns WHERE id = ?').run(campaignId);

    const itemsAfter = db.prepare<any>('SELECT * FROM b2b_quotation_items WHERE campaign_id = ?').all(campaignId);
    expect(itemsAfter.length).toBe(0);

    const proposalsAfter = db.prepare<any>('SELECT * FROM b2b_quotation_proposals WHERE campaign_id = ?').all(campaignId);
    expect(proposalsAfter.length).toBe(0);
  });
});
