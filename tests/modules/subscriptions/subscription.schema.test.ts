import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Clube de Assinatura & Reposição Recorrente Schema (Migration 022)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required subscription tables cleanly', () => {
    const tables = [
      'subscriptions',
      'subscription_items',
      'subscription_cycles',
    ];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
      expect(row?.name).toBe(table);
    }
  });

  it('should enforce foreign keys and constraints on subscriptions', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    expect(store).toBeDefined();

    const customerRes = db.prepare(
      "INSERT INTO customers (store_id, name, cpf) VALUES (?, 'Carlos Silva', '111.222.333-44')"
    ).run(store.id);
    const customerId = Number(customerRes.lastInsertRowid);

    const insertSub = db.prepare(`
      INSERT INTO subscriptions (
        customer_id, store_id, plan_name, interval_days, preferred_delivery_day,
        delivery_mode, payment_method, discount_percentage, status, next_billing_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertSub.run(
      customerId,
      store.id,
      'Clube Hipertensão Mensal',
      30,
      10,
      'DELIVERY',
      'PIX_RECURRING',
      7.5,
      'ACTIVE',
      '2026-12-10'
    );

    expect(result.lastInsertRowid).toBeGreaterThan(0);

    // Deve falhar caso o interval_days não esteja entre os permitidos
    expect(() => {
      insertSub.run(
        customerId,
        store.id,
        'Plano Inválido',
        20, // inválido (só 15, 30, 45, 60, 90)
        10,
        'DELIVERY',
        'PIX_RECURRING',
        5,
        'ACTIVE',
        '2026-12-10'
      );
    }).toThrow();
  });

  it('should insert and link subscription_items and subscription_cycles', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    const customerRes = db.prepare(
      "INSERT INTO customers (store_id, name, cpf) VALUES (?, 'Mariana Santos', '222.333.444-55')"
    ).run(store.id);
    const customerId = Number(customerRes.lastInsertRowid);

    const productRes = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('Losartana Potássica 50mg', '7891234567890', 'Losartana', '100000000', 'RED', 'NONE', 25.0, 15.0, 20.0)
    `).run();
    const productId = Number(productRes.lastInsertRowid);

    const subResult = db.prepare(`
      INSERT INTO subscriptions (
        customer_id, store_id, plan_name, interval_days, preferred_delivery_day,
        delivery_mode, payment_method, discount_percentage, status, next_billing_date
      ) VALUES (?, ?, ?, 30, 5, 'STORE_PICKUP', 'CREDIT_CARD_TOKEN', 5.0, 'ACTIVE', '2026-12-05')
    `).run(customerId, store.id, 'Assinatura Teste');

    const subId = Number(subResult.lastInsertRowid);

    // Item
    const itemResult = db.prepare(`
      INSERT INTO subscription_items (
        subscription_id, product_id, quantity, unit_price, discount_percentage,
        requires_prescription, prescription_doctor_crm, prescription_doctor_uf, prescription_expiry_date
      ) VALUES (?, ?, 2.0, ?, 5.0, 1, '12345', 'SP', '2027-01-01')
    `).run(subId, productId, 20.0);

    expect(itemResult.lastInsertRowid).toBeGreaterThan(0);

    // Ciclo
    const cycleResult = db.prepare(`
      INSERT INTO subscription_cycles (
        subscription_id, cycle_number, scheduled_date, status, total_amount
      ) VALUES (?, 1, '2026-12-05', 'PENDING', 50.0)
    `).run(subId);

    expect(cycleResult.lastInsertRowid).toBeGreaterThan(0);
  });
});
