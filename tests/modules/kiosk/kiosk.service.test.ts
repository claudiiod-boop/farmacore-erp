import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { KioskService } from '../../../src/modules/kiosk/kiosk.service';

describe('KioskService (Autoatendimento, Consulta de Preços & Fila)', () => {
  let db: Database;
  let service: KioskService;
  let storeId: number;
  let otcProductId: number;
  let controlledProductId: number;
  let genericProductId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new KioskService(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    // Inserir produto de referência OTC
    const p1 = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, category)
      VALUES ('7890001', 'Dorflex 36 Comprimidos', 'Dipirona + Orfenadrina', '1.0001.0010', 'SEM_TARJA', 'NONE', 30.0, 15.0, 25.0, 'REFERENCIA')
    `).run();
    otcProductId = Number(p1.lastInsertRowid);

    // Inserir genérico mais barato
    const p2 = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, category)
      VALUES ('7890002', 'Dipirona + Orfenadrina Genérico', 'Dipirona + Orfenadrina', '1.0002.0020', 'SEM_TARJA', 'NONE', 20.0, 8.0, 14.50, 'GENERICO')
    `).run();
    genericProductId = Number(p2.lastInsertRowid);

    // Inserir produto controlado (Tarja Preta / B1)
    const p3 = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, category)
      VALUES ('7890003', 'Clonazepam 2mg', 'Clonazepam', '1.0003.0030', 'PRETA', 'B1', 22.0, 9.0, 18.0, 'GENERICO')
    `).run();
    controlledProductId = Number(p3.lastInsertRowid);

    // Inserir lotes
    db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (?, 'L01', '2024-01-01', '2027-01-01', 50, ?)
    `).run(otcProductId, storeId);

    db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (?, 'L02', '2024-01-01', '2027-01-01', 50, ?)
    `).run(genericProductId, storeId);

    db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (?, 'L03', '2024-01-01', '2027-01-01', 50, ?)
    `).run(controlledProductId, storeId);
  });

  afterEach(() => {
    db.close();
  });

  it('should list and create kiosk terminals', () => {
    const list = service.listTerminals(storeId);
    expect(list.length).toBeGreaterThanOrEqual(1);

    const term = service.createTerminal({
      store_id: storeId,
      terminal_code: 'TTM-02',
      name: 'Totem Saída / Farmácia',
      mode: 'PRICE_CHECKER',
    });

    expect(term.id).toBeDefined();
    expect(term.terminal_code).toBe('TTM-02');
  });

  it('should query product price, apply loyalty discount on CPF and suggest cheaper generic alternatives', () => {
    // Consulta sem CPF
    const res1 = service.queryProductPrice('7890001');
    expect(res1.name).toContain('Dorflex');
    expect(res1.final_price).toBe(25.0);
    expect(res1.club_member).toBe(false);
    expect(res1.requires_prescription).toBe(false);
    expect(res1.generic_alternatives.length).toBe(1);
    expect(res1.generic_alternatives[0].name).toContain('Genérico');
    expect(res1.generic_alternatives[0].savings_amount).toBe(10.5); // 25.0 - 14.50

    // Consulta com CPF do clube (12% desconto)
    const res2 = service.queryProductPrice('Dorflex', '111.222.333-44');
    expect(res2.club_member).toBe(true);
    expect(res2.discount_amount).toBe(3.0); // 12% de 25
    expect(res2.final_price).toBe(22.0);
  });

  it('should issue sequential queue tickets and manage queue status lifecycle', () => {
    const t1 = service.issueQueueTicket({
      store_id: storeId,
      service_type: 'NORMAL',
      customer_name: 'Marcos Silva',
    });
    expect(t1.ticket.ticket_number).toBe('N-001');
    expect(t1.receipt).toContain('N-001');
    expect(t1.receipt).toContain('NORMAL');

    const t2 = service.issueQueueTicket({
      store_id: storeId,
      service_type: 'NORMAL',
    });
    expect(t2.ticket.ticket_number).toBe('N-002');

    const tp = service.issueQueueTicket({
      store_id: storeId,
      service_type: 'PREFERENCIAL',
      customer_name: 'Dona Maria (65 anos)',
    });
    expect(tp.ticket.ticket_number).toBe('P-001');

    // Listagem da fila: Preferencial deve vir antes de Normal na ordenação prioritária
    const queue = service.listQueueTickets(storeId, 'WAITING');
    expect(queue[0].service_type).toBe('PREFERENCIAL');

    // Chamar senha
    const called = service.callQueueTicket(tp.ticket.id, 'Lucas Balconista');
    expect(called.status).toBe('CALLED');
    expect(called.counter_operator).toBe('Lucas Balconista');

    // Concluir atendimento
    const completed = service.completeQueueTicket(tp.ticket.id);
    expect(completed.status).toBe('COMPLETED');
  });

  it('should create express pre-sale for OTC items and return receipt ticket', () => {
    const preSale = service.createExpressPreSale({
      store_id: storeId,
      customer_cpf: '12345678901',
      items: [
        { product_id: otcProductId, quantity: 2 },
      ],
    });

    expect(preSale.pre_sale_id).toBeDefined();
    expect(preSale.code).toContain('PV-EXP-');
    expect(preSale.total_amount).toBe(50.0); // 2 * 25
    expect(preSale.discount_amount).toBe(5.0); // 10% autoatendimento
    expect(preSale.final_amount).toBe(45.0);
    expect(preSale.ticket_receipt).toContain('PRÉ-VENDA EXPRESS');
  });

  it('should block controlled / prescription-only medicines from kiosk express pre-sale', () => {
    expect(() => {
      service.createExpressPreSale({
        store_id: storeId,
        items: [
          { product_id: controlledProductId, quantity: 1 }, // Tarja preta
        ],
      });
    }).toThrow(/não pode ser comprado no totem de autoatendimento/);
  });

  it('should return accurate Kiosk KPIs', () => {
    service.queryProductPrice('7890001');
    service.issueQueueTicket({ store_id: storeId, service_type: 'NORMAL' });

    const kpis = service.getKioskKpis(storeId);
    expect(kpis.total_price_queries_today).toBe(1);
    expect(kpis.total_queue_tickets_today).toBe(1);
    expect(kpis.waiting_tickets_count).toBe(1);
  });
});
