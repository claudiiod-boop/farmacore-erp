import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { SubscriptionService } from '../../../src/modules/subscriptions/subscription.service';

describe('SubscriptionService (Clube de Assinatura & Reposição Recorrente)', () => {
  let db: Database;
  let service: SubscriptionService;
  let storeId: number;
  let customerId: number;
  let normalProductId: number;
  let controlledProductId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new SubscriptionService(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    // Cria cliente de teste
    const custRes = db.prepare(`
      INSERT INTO customers (store_id, name, cpf, phone)
      VALUES (?, 'Dona Maria da Silva', '123.456.789-00', '(11) 98765-4321')
    `).run(storeId);
    customerId = Number(custRes.lastInsertRowid);

    // Cria produto comum (Losartana)
    const prod1Res = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('Losartana Potássica 50mg 30 comp', '7891234567890', 'Losartana', '100000001', 'RED', 'NONE', 20.0, 10.0, 15.0)
    `).run();
    normalProductId = Number(prod1Res.lastInsertRowid);

    // Cria produto controlado (Clonazepam / Portaria 344)
    const prod2Res = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('Clonazepam 2mg 30 comp', '7891234567891', 'Clonazepam', '100000002', 'BLACK', 'C1', 35.0, 20.0, 30.0)
    `).run();
    controlledProductId = Number(prod2Res.lastInsertRowid);
  });

  afterEach(() => {
    db.close();
  });

  it('should calculate next billing date correctly based on preferred day', () => {
    // Se hoje é 2026-11-20 e o dia preferido é dia 25 do mês
    const next1 = service.calculateNextBillingDate('2026-11-20', 25);
    expect(next1).toBe('2026-11-25');

    // Se hoje é 2026-11-26 e o dia preferido era dia 10 do mês (já passou)
    const next2 = service.calculateNextBillingDate('2026-11-26', 10);
    expect(next2).toBe('2026-12-10');

    // Virada de ano: dia 15 em 2026-12-20
    const next3 = service.calculateNextBillingDate('2026-12-20', 15);
    expect(next3).toBe('2027-01-15');
  });

  it('should create subscription with items and apply discount percentage', () => {
    const sub = service.createSubscription({
      customer_id: customerId,
      store_id: storeId,
      plan_name: 'Plano Hipertensão Familiar',
      interval_days: 30,
      preferred_delivery_day: 10,
      delivery_mode: 'DELIVERY',
      delivery_address: 'Rua das Flores, 123',
      delivery_neighborhood: 'Jardins',
      delivery_city: 'São Paulo',
      payment_method: 'PIX_RECURRING',
      discount_percentage: 10.0,
      startDate: '2026-11-01',
      items: [
        {
          product_id: normalProductId,
          quantity: 2,
          unit_price: 15.0,
        },
      ],
    });

    expect(sub.id).toBeGreaterThan(0);
    expect(sub.plan_name).toBe('Plano Hipertensão Familiar');
    expect(sub.discount_percentage).toBe(10.0);
    expect(sub.next_billing_date).toBe('2026-11-10');
    expect(sub.items).toHaveLength(1);
    expect(sub.items[0].product_name).toBe('Losartana Potássica 50mg 30 comp');
  });

  it('should update subscription status to PAUSED and CANCELLED', () => {
    const sub = service.createSubscription({
      customer_id: customerId,
      store_id: storeId,
      plan_name: 'Plano Teste Status',
      items: [{ product_id: normalProductId, quantity: 1, unit_price: 15.0 }],
    });

    expect(sub.status).toBe('ACTIVE');

    const paused = service.updateSubscriptionStatus(sub.id, 'PAUSED');
    expect(paused.status).toBe('PAUSED');

    const cancelled = service.updateSubscriptionStatus(sub.id, 'CANCELLED');
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('should add and remove subscription items', () => {
    const sub = service.createSubscription({
      customer_id: customerId,
      store_id: storeId,
      plan_name: 'Plano Multi-Itens',
      items: [{ product_id: normalProductId, quantity: 1 }],
    });
    expect(sub.items).toHaveLength(1);

    const added = service.addSubscriptionItem(sub.id, {
      product_id: controlledProductId,
      quantity: 1,
      requires_prescription: true,
      prescription_doctor_crm: '654321',
      prescription_doctor_uf: 'SP',
      prescription_expiry_date: '2027-06-30',
    });
    expect(added.id).toBeGreaterThan(0);
    expect(added.requires_prescription).toBe(1);

    const updatedSub = service.getSubscription(sub.id);
    expect(updatedSub.items).toHaveLength(2);

    service.removeSubscriptionItem(added.id);
    const subAfterRemoval = service.getSubscription(sub.id);
    expect(subAfterRemoval.items).toHaveLength(1);
  });

  it('should detect expiring and expired prescriptions and allow renewal', () => {
    const today = new Date().toISOString().split('T')[0];
    const pastDate = '2026-01-01'; // vencida

    const sub = service.createSubscription({
      customer_id: customerId,
      store_id: storeId,
      plan_name: 'Plano Saúde Mental',
      items: [
        {
          product_id: controlledProductId,
          quantity: 1,
          requires_prescription: true,
          prescription_doctor_crm: '123456',
          prescription_doctor_uf: 'SP',
          prescription_expiry_date: pastDate,
        },
      ],
    });

    const expiring = service.getExpiringPrescriptions(30);
    expect(expiring.length).toBeGreaterThanOrEqual(1);
    expect(expiring[0].is_expired).toBe(true);

    // Renova a receita com nova data futura
    const futureDate = '2027-12-31';
    const renewed = service.renewPrescription(sub.items[0].id, {
      prescription_doctor_crm: '789012',
      prescription_doctor_uf: 'RJ',
      prescription_expiry_date: futureDate,
    });

    expect(renewed.prescription_doctor_crm).toBe('789012');
    expect(renewed.prescription_doctor_uf).toBe('RJ');
    expect(renewed.prescription_expiry_date).toBe(futureDate);

    // Agora não deve mais constar como vencida ou expirando em 15 dias
    const expiringAfter = service.getExpiringPrescriptions(15);
    expect(expiringAfter.some((x) => x.item_id === sub.items[0].id)).toBe(false);
  });

  it('should block refill cycle if controlled item prescription is expired (RDC 44/2009)', () => {
    const currentDate = '2026-11-23';

    // Assinatura com receita vencida
    const sub = service.createSubscription({
      customer_id: customerId,
      store_id: storeId,
      plan_name: 'Plano Controlados com Receita Vencida',
      preferred_delivery_day: 23,
      startDate: currentDate,
      items: [
        {
          product_id: controlledProductId,
          quantity: 1,
          unit_price: 30.0,
          requires_prescription: true,
          prescription_doctor_crm: '998877',
          prescription_doctor_uf: 'SP',
          prescription_expiry_date: '2026-11-20', // vencida 3 dias antes
        },
      ],
    });

    const result = service.processScheduledRefills(currentDate, storeId);

    expect(result.totalProcessed).toBe(1);
    expect(result.prescriptionPendingCount).toBe(1);
    expect(result.successCount).toBe(0);
    expect(result.details[0].status).toBe('PRESCRIPTION_PENDING');

    // A assinatura não deve ter tido sua data avançada para não perder o ciclo
    const refreshed = service.getSubscription(sub.id);
    expect(refreshed.cycles[0].status).toBe('PRESCRIPTION_PENDING');
  });

  it('should successfully process refill, create pre-sale and delivery order when prescriptions are valid', () => {
    const currentDate = '2026-11-23';

    const sub = service.createSubscription({
      customer_id: customerId,
      store_id: storeId,
      plan_name: 'Plano Hipertensão Mensal OK',
      preferred_delivery_day: 23,
      interval_days: 30,
      delivery_mode: 'DELIVERY',
      discount_percentage: 10.0,
      startDate: currentDate,
      items: [
        {
          product_id: normalProductId,
          quantity: 2, // 2 x 15 = 30.0
          unit_price: 15.0,
        },
        {
          product_id: controlledProductId,
          quantity: 1, // 1 x 30 = 30.0
          unit_price: 30.0,
          requires_prescription: true,
          prescription_doctor_crm: '112233',
          prescription_doctor_uf: 'SP',
          prescription_expiry_date: '2027-05-10', // receita válida
        },
      ],
    });

    // Subtotal: 60.0. Com 10% de desconto: 54.00
    const result = service.processScheduledRefills(currentDate, storeId);

    expect(result.totalProcessed).toBe(1);
    expect(result.successCount).toBe(1);
    expect(result.prescriptionPendingCount).toBe(0);

    const detail = result.details[0];
    expect(detail.status).toBe('PROCESSED');
    expect(detail.totalAmount).toBe(54.0);
    expect(detail.preSaleId).toBeDefined();
    expect(detail.deliveryOrderId).toBeDefined();

    // Valida que a pré-venda foi gravada no banco
    const preSale = db.prepare('SELECT * FROM pre_sales WHERE id = ?').get(detail.preSaleId) as any;
    expect(preSale).toBeDefined();
    expect(preSale.total_amount).toBe(54.0);
    expect(preSale.code).toMatch(/^PV-SUB-/);

    // Valida que a ordem de entrega foi criada
    const delOrder = db.prepare('SELECT * FROM delivery_orders WHERE id = ?').get(detail.deliveryOrderId) as any;
    expect(delOrder).toBeDefined();
    expect(delOrder.total_amount).toBe(54.0);
    expect(delOrder.order_number).toMatch(/^DEL-SUB-/);

    // Valida avanço da próxima cobrança (+30 dias)
    const refreshed = service.getSubscription(sub.id);
    expect(refreshed.last_billing_date).toBe(currentDate);
    expect(refreshed.next_billing_date).toBe('2026-12-23');
  });

  it('should return accurate subscription KPIs', () => {
    service.createSubscription({
      customer_id: customerId,
      store_id: storeId,
      plan_name: 'Plano Ativo 1',
      discount_percentage: 0.0,
      interval_days: 30,
      items: [{ product_id: normalProductId, quantity: 2, unit_price: 20.0 }], // 40.0
    });

    const kpis = service.getSubscriptionKpis();
    expect(kpis.activeSubscriptions).toBe(1);
    expect(kpis.totalMonthlyRecurringRevenue).toBe(40.0);
  });
});
