import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { AnalyticsService } from '../../../src/modules/analytics/analytics.service';

describe('AnalyticsService (Magnos Farma Analytics & Orçamento WhatsApp)', () => {
  let db: Database;
  let service: AnalyticsService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new AnalyticsService(db);

    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj)
      VALUES (1, 'Magnos Farma Centro', '11.222.333/0001-44')
    `).run();

    // Produtos
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES (101, '7891010101010', 'Dipirona 500mg 10cp', 'Dipirona Sódica', '100000001', 'SEM_TARJA', 'Geral', 10.0, 6.0, 8.50),
             (102, '7891020202020', 'Amoxicilina 500mg 21cps', 'Amoxicilina', '100000002', 'VERMELHA', 'Antimicrobiano', 45.0, 25.0, 35.00)
    `).run();

    // Lotes
    db.prepare(`
      INSERT INTO batches (id, product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (1, 101, 'L001', '2026-01-01', '2027-12-31', 100),
             (2, 102, 'L002', '2026-01-01', '2027-12-31', 50)
    `).run();
  });

  afterEach(() => {
    if (db) db.close();
  });

  it('should calculate live analytics with sales, tickets and hourly distribution', () => {
    const today = new Date().toISOString().slice(0, 10);

    const sessionRes = db.prepare(`
      INSERT INTO cash_sessions (operator_name, initial_cash, current_cash)
      VALUES ('Carlos Balconista', 100.0, 100.0)
    `).run();
    const sessionId = sessionRes.lastInsertRowid;

    // Inserir vendas simuladas de hoje
    const s1 = db.prepare(`
      INSERT INTO sales (store_id, cash_session_id, total_amount, discount_amount, status, created_at)
      VALUES (1, ?, 100.0, 10.0, 'COMPLETED', '${today} 09:30:00')
    `).run(sessionId);

    db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, 101, 1, 2, 8.5, 17.0)
    `).run(s1.lastInsertRowid);

    const s2 = db.prepare(`
      INSERT INTO sales (store_id, cash_session_id, total_amount, discount_amount, status, created_at)
      VALUES (1, ?, 50.0, 0.0, 'COMPLETED', '${today} 14:15:00')
    `).run(sessionId);

    db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, 102, 2, 1, 35.0, 35.0)
    `).run(s2.lastInsertRowid);

    const analytics = service.getLiveAnalytics(1);

    expect(analytics.todaySalesBrl).toBe(140.0);
    expect(analytics.todayReceiptsCount).toBe(2);
    expect(analytics.todayAverageTicketBrl).toBe(70.0);
    expect(analytics.monthSalesBrl).toBe(140.0);
    expect(analytics.hourlyDistribution.length).toBeGreaterThanOrEqual(15);
    expect(analytics.employeePerformance.length).toBe(1);
    expect(analytics.employeePerformance[0].employeeName).toBe('Carlos Balconista');
    expect(analytics.employeePerformance[0].totalSalesBrl).toBe(140.0);
  });

  it('should create WhatsApp quotation with formatted payload and direct wa.me link', () => {
    const quotation = service.createWhatsAppQuotation({
      storeId: 1,
      customerName: 'Dona Maria Oliveira',
      customerPhone: '11988887777',
      attendantName: 'Marcos Balcão',
      items: [
        { productId: 101, productName: 'Dipirona 500mg 10cp', quantity: 2, unitPriceBrl: 8.5 },
        { productId: 102, productName: 'Amoxicilina 500mg 21cps', quantity: 1, unitPriceBrl: 35.0 },
      ],
      discountBrl: 5.0,
      validDays: 2,
    });

    expect(quotation.id).toBeDefined();
    expect(quotation.subtotal_brl).toBe(52.0);
    expect(quotation.discount_brl).toBe(5.0);
    expect(quotation.total_brl).toBe(47.0);
    expect(quotation.whatsapp_message_payload).toContain('Dona Maria Oliveira');
    expect(quotation.whatsapp_message_payload).toContain('Dipirona 500mg 10cp');
    expect(quotation.whatsapp_message_payload).toContain('TOTAL A PAGAR: R$ 47.00');
    expect(quotation.whatsapp_url).toContain('https://api.whatsapp.com/send?phone=5511988887777');

    const list = service.listWhatsAppQuotations(1);
    expect(list.length).toBe(1);

    const updated = service.updateQuotationStatus(quotation.id, 'CONVERTED');
    expect(updated?.status).toBe('CONVERTED');
  });
});
