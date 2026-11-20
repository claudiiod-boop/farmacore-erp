import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import type {
  LoyaltyProgram,
  LoyaltyWallet,
  LoyaltyTransaction,
  Promotion,
  PromotionProduct,
  PatientTreatment,
  LoyaltyTransactionType,
  PromotionType,
  PromotionAppliesTo,
  PromotionProductRole,
  TreatmentStatus,
  TakeMorePayLessConditions,
  ProgressiveDiscountConditions,
  ComboCrossSellConditions,
  ClubSpecialPriceConditions,
  BirthdayDiscountConditions,
  CartItemInput,
  CartEvaluationResult,
  UpcomingRefillItem,
} from '../../../src/modules/crm/types';

describe('Schema 011 - CRM, Fidelidade, Promoções e Adesão a Tratamentos', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('should run all migrations including 011 cleanly and create tables and indexes', () => {
    runMigrations(db);

    const tables = db
      .prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('loyalty_programs', 'loyalty_wallets', 'loyalty_transactions', 'promotions', 'promotion_products', 'patient_treatments')"
      )
      .all();

    expect(tables.map((t) => t.name).sort()).toEqual([
      'loyalty_programs',
      'loyalty_transactions',
      'loyalty_wallets',
      'patient_treatments',
      'promotion_products',
      'promotions',
    ]);

    const indexes = db
      .prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND (name LIKE 'idx_loyalty%' OR name LIKE 'idx_promotion%' OR name LIKE 'idx_patient%')"
      )
      .all();

    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain('idx_loyalty_transactions_wallet');
    expect(indexNames).toContain('idx_promotions_active');
    expect(indexNames).toContain('idx_promotion_products_product');
    expect(indexNames).toContain('idx_patient_treatments_refill');
    expect(indexNames).toContain('idx_patient_treatments_customer');
  });

  it('should seed default loyalty_program record (id = 1)', () => {
    runMigrations(db);

    const program = db
      .prepare('SELECT * FROM loyalty_programs WHERE id = 1')
      .get() as any;

    expect(program).toBeDefined();
    expect(program.id).toBe(1);
    expect(program.name).toBe('Programa Fidelidade FarmaCore');
    expect(program.cashback_percent).toBe(3.0);
    expect(program.validity_days).toBe(90);
    expect(program.min_purchase_amount).toBe(10.0);
    expect(program.min_redeem_amount).toBe(5.0);
    expect(program.max_redeem_percent).toBe(50.0);
    expect(program.allow_with_promotions).toBe(1);
    expect(program.is_active).toBe(1);
  });

  it('should enforce unique customer_id on loyalty_wallets', () => {
    runMigrations(db);

    // Insert customer
    const custInfo = db.prepare(
      `INSERT INTO customers (store_id, name, cpf) VALUES (1, 'Carlos Souza', '111.222.333-44')`
    ).run();
    const customerId = Number(custInfo.lastInsertRowid);

    // First wallet succeeds
    db.prepare(
      `INSERT INTO loyalty_wallets (customer_id, current_balance) VALUES (?, 0.0)`
    ).run(customerId);

    // Duplicate wallet for same customer should throw
    expect(() => {
      db.prepare(
        `INSERT INTO loyalty_wallets (customer_id, current_balance) VALUES (?, 10.0)`
      ).run(customerId);
    }).toThrow();
  });

  it('should enforce cascade delete from customers to loyalty_wallets and transactions', () => {
    runMigrations(db);

    // Insert customer
    const custInfo = db.prepare(
      `INSERT INTO customers (store_id, name, cpf) VALUES (1, 'Ana Clara', '222.333.444-55')`
    ).run();
    const customerId = Number(custInfo.lastInsertRowid);

    // Insert wallet
    const walletInfo = db.prepare(
      `INSERT INTO loyalty_wallets (customer_id, current_balance, total_earned) VALUES (?, 15.0, 15.0)`
    ).run(customerId);
    const walletId = Number(walletInfo.lastInsertRowid);

    // Insert transaction
    db.prepare(
      `INSERT INTO loyalty_transactions (wallet_id, type, amount, balance_after) VALUES (?, 'EARN', 15.0, 15.0)`
    ).run(walletId);

    expect(db.prepare('SELECT COUNT(*) as count FROM loyalty_wallets WHERE id = ?').get(walletId)).toEqual({ count: 1 });
    expect(db.prepare('SELECT COUNT(*) as count FROM loyalty_transactions WHERE wallet_id = ?').get(walletId)).toEqual({ count: 1 });

    // Delete customer
    db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);

    // Wallet and transactions should be cascaded
    expect(db.prepare('SELECT COUNT(*) as count FROM loyalty_wallets WHERE id = ?').get(walletId)).toEqual({ count: 0 });
    expect(db.prepare('SELECT COUNT(*) as count FROM loyalty_transactions WHERE wallet_id = ?').get(walletId)).toEqual({ count: 0 });
  });

  it('should enforce constraints on loyalty_programs (cashback_percent between 0 and 100)', () => {
    runMigrations(db);

    // Valid bounds
    expect(() => {
      db.prepare(
        `INSERT INTO loyalty_programs (name, cashback_percent) VALUES ('Promo Min', 0)`
      ).run();
    }).not.toThrow();

    expect(() => {
      db.prepare(
        `INSERT INTO loyalty_programs (name, cashback_percent) VALUES ('Promo Max', 100)`
      ).run();
    }).not.toThrow();

    // Invalid negative
    expect(() => {
      db.prepare(
        `INSERT INTO loyalty_programs (name, cashback_percent) VALUES ('Invalid Neg', -1.0)`
      ).run();
    }).toThrow();

    // Invalid above 100
    expect(() => {
      db.prepare(
        `INSERT INTO loyalty_programs (name, cashback_percent) VALUES ('Invalid High', 100.5)`
      ).run();
    }).toThrow();
  });

  it('should enforce valid loyalty_transactions types', () => {
    runMigrations(db);

    const custInfo = db.prepare(
      `INSERT INTO customers (store_id, name, cpf) VALUES (1, 'Marcos Lima', '333.444.555-66')`
    ).run();
    const customerId = Number(custInfo.lastInsertRowid);

    const walletInfo = db.prepare(
      `INSERT INTO loyalty_wallets (customer_id, current_balance) VALUES (?, 100.0)`
    ).run(customerId);
    const walletId = Number(walletInfo.lastInsertRowid);

    const validTypes = ['EARN', 'REDEEM', 'EXPIRE', 'MANUAL_ADJUSTMENT'];
    for (const type of validTypes) {
      expect(() => {
        db.prepare(
          `INSERT INTO loyalty_transactions (wallet_id, type, amount, balance_after) VALUES (?, ?, 10.0, 90.0)`
        ).run(walletId, type);
      }).not.toThrow();
    }

    // Invalid type
    expect(() => {
      db.prepare(
        `INSERT INTO loyalty_transactions (wallet_id, type, amount, balance_after) VALUES (?, 'FRAUD_BONUS', 10.0, 90.0)`
      ).run(walletId);
    }).toThrow();
  });

  it('should enforce valid promotion types and constraints', () => {
    runMigrations(db);

    const validTypes = [
      'TAKE_MORE_PAY_LESS',
      'PROGRESSIVE_DISCOUNT',
      'COMBO_CROSS_SELL',
      'CLUB_SPECIAL_PRICE',
      'BIRTHDAY_DISCOUNT',
    ];

    for (const type of validTypes) {
      expect(() => {
        db.prepare(
          `INSERT INTO promotions (name, type, start_date, end_date, conditions_json)
           VALUES (?, ?, '2026-11-01', '2026-11-30', '{}')`
        ).run(`Promo ${type}`, type);
      }).not.toThrow();
    }

    // Invalid promotion type
    expect(() => {
      db.prepare(
        `INSERT INTO promotions (name, type, start_date, end_date, conditions_json)
         VALUES ('Invalid Type', 'FREE_GIFT_UNLIMITED', '2026-11-01', '2026-11-30', '{}')`
      ).run();
    }).toThrow();
  });

  it('should enforce foreign keys and cascade on promotion_products and patient_treatments', () => {
    runMigrations(db);

    // Insert product
    const prodInfo = db.prepare(
      `INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
       VALUES ('7891234567890', 'Losartana Potássica 50mg', 'Losartana', '1.0001.0001.001-1', 'SEM_TARJA', 'LIBERADO', 20.0, 12.0, 15.0)`
    ).run();
    const productId = Number(prodInfo.lastInsertRowid);

    // Insert customer
    const custInfo = db.prepare(
      `INSERT INTO customers (store_id, name, cpf) VALUES (1, 'Paciente Hipertenso', '444.555.666-77')`
    ).run();
    const customerId = Number(custInfo.lastInsertRowid);

    // Insert promotion
    const promoInfo = db.prepare(
      `INSERT INTO promotions (name, type, start_date, end_date, conditions_json)
       VALUES ('Leve 3 Pague 2 Losartana', 'TAKE_MORE_PAY_LESS', '2026-11-01', '2026-11-30', '{"take":3,"pay":2}')`
    ).run();
    const promotionId = Number(promoInfo.lastInsertRowid);

    // Insert promotion_products
    db.prepare(
      `INSERT INTO promotion_products (promotion_id, product_id, role)
       VALUES (?, ?, 'BOTH')`
    ).run(promotionId, productId);

    expect(
      db.prepare('SELECT COUNT(*) as count FROM promotion_products WHERE promotion_id = ?').get(promotionId)
    ).toEqual({ count: 1 });

    // Delete promotion -> cascade to promotion_products
    db.prepare('DELETE FROM promotions WHERE id = ?').run(promotionId);
    expect(
      db.prepare('SELECT COUNT(*) as count FROM promotion_products WHERE promotion_id = ?').get(promotionId)
    ).toEqual({ count: 0 });

    // Insert patient_treatments
    const treatmentInfo = db.prepare(
      `INSERT INTO patient_treatments (
        customer_id, product_id, daily_dose, units_per_box, boxes_purchased, total_days_supply, start_date, expected_refill_date, status
      ) VALUES (?, ?, 1.0, 30, 2, 60, '2026-11-01', '2026-12-31', 'ACTIVE')`
    ).run(customerId, productId);
    const treatmentId = Number(treatmentInfo.lastInsertRowid);

    const validStatuses = ['ACTIVE', 'CONTACTED', 'REFILLED', 'DISCONTINUED'];
    for (const status of validStatuses) {
      expect(() => {
        db.prepare('UPDATE patient_treatments SET status = ? WHERE id = ?').run(status, treatmentId);
      }).not.toThrow();
    }

    // Invalid treatment status throws
    expect(() => {
      db.prepare('UPDATE patient_treatments SET status = ? WHERE id = ?').run('INVALID_STATUS', treatmentId);
    }).toThrow();

    // Delete customer -> cascades to patient_treatments
    db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
    expect(
      db.prepare('SELECT COUNT(*) as count FROM patient_treatments WHERE id = ?').get(treatmentId)
    ).toEqual({ count: 0 });
  });

  it('should validate domain types TypeScript structure', () => {
    const program: LoyaltyProgram = {
      id: 1,
      name: 'Programa Fidelidade FarmaCore',
      cashbackPercent: 3.0,
      validityDays: 90,
      minPurchaseAmount: 10.0,
      minRedeemAmount: 5.0,
      maxRedeemPercent: 50.0,
      allowWithPromotions: true,
      isActive: true,
    };
    expect(program.name).toBe('Programa Fidelidade FarmaCore');

    const wallet: LoyaltyWallet = {
      id: 1,
      customerId: 10,
      currentBalance: 25.5,
      totalEarned: 50.0,
      totalRedeemed: 24.5,
      totalExpired: 0.0,
    };
    expect(wallet.currentBalance).toBe(25.5);

    const txType: LoyaltyTransactionType = 'EARN';
    const tx: LoyaltyTransaction = {
      id: 1,
      walletId: 1,
      type: txType,
      amount: 5.0,
      balanceAfter: 25.5,
      expiresAt: '2027-02-18',
    };
    expect(tx.type).toBe('EARN');

    const promoType: PromotionType = 'TAKE_MORE_PAY_LESS';
    const appliesTo: PromotionAppliesTo = 'SPECIFIC_PRODUCTS';
    const promo: Promotion = {
      id: 1,
      name: 'Black Friday Sabonetes',
      type: promoType,
      startDate: '2026-11-20',
      endDate: '2026-11-30',
      priority: 1,
      isActive: true,
      appliesTo,
      conditionsJson: JSON.stringify({ takeQuantity: 3, payQuantity: 2 } as TakeMorePayLessConditions),
    };
    expect(promo.type).toBe('TAKE_MORE_PAY_LESS');

    const role: PromotionProductRole = 'TRIGGER';
    const promoProd: PromotionProduct = {
      id: 1,
      promotionId: 1,
      productId: 5,
      role,
    };
    expect(promoProd.role).toBe('TRIGGER');

    const status: TreatmentStatus = 'ACTIVE';
    const treatment: PatientTreatment = {
      id: 1,
      customerId: 10,
      productId: 5,
      dailyDose: 1.0,
      unitsPerBox: 30,
      boxesPurchased: 2,
      totalDaysSupply: 60,
      startDate: '2026-11-20',
      expectedRefillDate: '2027-01-19',
      status,
    };
    expect(treatment.status).toBe('ACTIVE');

    const cartItem: CartItemInput = {
      productId: 5,
      quantity: 3,
      unitPrice: 10.0,
    };
    expect(cartItem.quantity).toBe(3);

    const cartResult: CartEvaluationResult = {
      items: [
        {
          productId: 5,
          quantity: 3,
          originalUnitPrice: 10.0,
          finalUnitPrice: 6.666,
          discountAmount: 10.0,
          appliedPromotionId: 1,
          appliedPromotionName: 'Black Friday Sabonetes',
          appliedPromotionType: 'TAKE_MORE_PAY_LESS',
        },
      ],
      subtotal: 30.0,
      totalDiscount: 10.0,
      finalTotal: 20.0,
      appliedPromotions: [
        { id: 1, name: 'Black Friday Sabonetes', type: 'TAKE_MORE_PAY_LESS', totalDiscount: 10.0 },
      ],
    };
    expect(cartResult.finalTotal).toBe(20.0);

    const refill: UpcomingRefillItem = {
      treatmentId: 1,
      customerId: 10,
      customerName: 'João da Silva',
      productId: 5,
      productName: 'Losartana 50mg',
      dailyDose: 1.0,
      unitsPerBox: 30,
      boxesPurchased: 2,
      totalDaysSupply: 60,
      startDate: '2026-11-20',
      expectedRefillDate: '2027-01-19',
      daysUntilRefill: 5,
      status: 'ACTIVE',
    };
    expect(refill.daysUntilRefill).toBe(5);
  });
});
