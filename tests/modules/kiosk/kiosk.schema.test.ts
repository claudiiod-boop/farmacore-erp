import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Totem de Autoatendimento, Terminal de Preços & Fila Schema (Migration 027)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required kiosk tables and default terminal cleanly', () => {
    const tables = [
      'kiosk_terminals',
      'queue_tickets',
      'kiosk_price_queries',
    ];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }

    // Valida seed padrão de terminal
    const terminals = db.prepare('SELECT * FROM kiosk_terminals').all() as any[];
    expect(terminals.length).toBeGreaterThanOrEqual(1);
    expect(terminals[0].terminal_code).toBe('TTM-01');
    expect(terminals[0].mode).toBe('HYBRID');
  });

  it('should insert queue ticket and price query with valid foreign keys', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    const terminal = db.prepare('SELECT id FROM kiosk_terminals LIMIT 1').get() as { id: number };

    // Inserir produto
    const prodRes = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7891234567899', 'Vitamina C 1g Efervescente', 'Ácido Ascórbico', 'ISENTO', 'SEM_TARJA', 'NONE', 25.0, 10.0, 18.0)
    `).run();
    const prodId = Number(prodRes.lastInsertRowid);

    // Inserir senha de fila
    const ticketRes = db.prepare(`
      INSERT INTO queue_tickets (store_id, kiosk_id, ticket_number, service_type, customer_name, status)
      VALUES (?, ?, 'N-001', 'NORMAL', 'Sr. José', 'WAITING')
    `).run(store.id, terminal.id);
    expect(ticketRes.changes).toBe(1);

    // Inserir consulta de preço
    const queryRes = db.prepare(`
      INSERT INTO kiosk_price_queries (store_id, kiosk_id, product_id, customer_cpf, queried_price, discount_applied)
      VALUES (?, ?, ?, '111.222.333-44', 18.0, 2.0)
    `).run(store.id, terminal.id, prodId);
    expect(queryRes.changes).toBe(1);
  });
});
