import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { LoyaltyService, LoyaltyError } from '../../../src/modules/crm/loyalty.service';
import type {
  CashbackCreditInput,
  CashbackRedeemInput,
} from '../../../src/modules/crm/types';

describe('LoyaltyService (Carteira de Fidelidade e Motor de Cashback)', () => {
  let db: Database;
  let service: LoyaltyService;
  let testCustomerId: number;
  let secondCustomerId: number;

  const createSale = (id: number, totalAmount: number = 100.0) => {
    db.prepare(`INSERT OR REPLACE INTO sales (id, total_amount) VALUES (?, ?)`).run(id, totalAmount);
  };

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new LoyaltyService(db);

    // Create store 2 for branch-specific tests
    db.prepare(
      `INSERT OR IGNORE INTO stores (id, code, name, company_name, cnpj, ie, is_headquarters, street, number, neighborhood, city, state, zip_code, ibge_code, is_active)
       VALUES (2, 'LJ02', 'FarmaCore Filial Jardins', 'FarmaCore Drogaria Ltda', '12.345.678/0002-71', '123456789', 0, 'Av. Paulista', '1500', 'Bela Vista', 'São Paulo', 'SP', '01310-200', '3550308', 1)`
    ).run();

    // Create test customers
    const res1 = db.prepare(
      `INSERT INTO customers (store_id, name, cpf) VALUES (1, 'Carlos Silva', '111.222.333-44')`
    ).run();
    testCustomerId = Number(res1.lastInsertRowid);

    const res2 = db.prepare(
      `INSERT INTO customers (store_id, name, cpf) VALUES (1, 'Mariana Santos', '222.333.444-55')`
    ).run();
    secondCustomerId = Number(res2.lastInsertRowid);
  });

  afterEach(() => {
    db.close();
  });

  describe('getProgramConfig', () => {
    it('should return the default seeded global loyalty program config', () => {
      const config = service.getProgramConfig();
      expect(config).toBeDefined();
      expect(config.id).toBe(1);
      expect(config.name).toBe('Programa Fidelidade FarmaCore');
      expect(config.cashbackPercent).toBe(3.0);
      expect(config.validityDays).toBe(90);
      expect(config.minPurchaseAmount).toBe(10.0);
      expect(config.minRedeemAmount).toBe(5.0);
      expect(config.maxRedeemPercent).toBe(50.0);
      expect(config.allowWithPromotions).toBe(true);
      expect(config.isActive).toBe(true);
    });

    it('should return store-specific config when configured, or fallback to global', () => {
      // Create store-specific program for store 2
      db.prepare(
        `INSERT INTO loyalty_programs (store_id, name, cashback_percent, validity_days, min_purchase_amount, min_redeem_amount, max_redeem_percent, is_active)
         VALUES (2, 'Fidelidade Filial 2', 5.0, 60, 20.0, 10.0, 40.0, 1)`
      ).run();

      const store2Config = service.getProgramConfig(2);
      expect(store2Config.storeId).toBe(2);
      expect(store2Config.cashbackPercent).toBe(5.0);
      expect(store2Config.validityDays).toBe(60);

      // Store 1 doesn't have custom config -> fallback to global
      const store1Config = service.getProgramConfig(1);
      expect(store1Config.cashbackPercent).toBe(3.0);
      expect(store1Config.validityDays).toBe(90);
    });
  });

  describe('updateProgramConfig', () => {
    it('should update global loyalty program config', () => {
      const updated = service.updateProgramConfig({
        id: 1,
        name: 'Clube FarmaCore Plus',
        cashbackPercent: 4.5,
        validityDays: 120,
        minPurchaseAmount: 15.0,
        minRedeemAmount: 8.0,
        maxRedeemPercent: 60.0,
      });

      expect(updated.name).toBe('Clube FarmaCore Plus');
      expect(updated.cashbackPercent).toBe(4.5);
      expect(updated.validityDays).toBe(120);
      expect(updated.minPurchaseAmount).toBe(15.0);
      expect(updated.minRedeemAmount).toBe(8.0);
      expect(updated.maxRedeemPercent).toBe(60.0);

      const refreshed = service.getProgramConfig();
      expect(refreshed.cashbackPercent).toBe(4.5);
      expect(refreshed.validityDays).toBe(120);
    });

    it('should update or insert branch config when storeId is specified', () => {
      const storeConfig = service.updateProgramConfig({
        storeId: 2,
        name: 'Clube Filial 2',
        cashbackPercent: 6.0,
        validityDays: 45,
        minPurchaseAmount: 25.0,
        minRedeemAmount: 10.0,
        maxRedeemPercent: 30.0,
        isActive: true,
      });

      expect(storeConfig.storeId).toBe(2);
      expect(storeConfig.cashbackPercent).toBe(6.0);

      const fetched = service.getProgramConfig(2);
      expect(fetched.cashbackPercent).toBe(6.0);
      expect(fetched.minPurchaseAmount).toBe(25.0);
    });

    it('should throw LoyaltyError on invalid percent or negative amounts', () => {
      expect(() => {
        service.updateProgramConfig({ id: 1, cashbackPercent: -2 });
      }).toThrow(LoyaltyError);

      expect(() => {
        service.updateProgramConfig({ id: 1, cashbackPercent: 105 });
      }).toThrow(LoyaltyError);

      expect(() => {
        service.updateProgramConfig({ id: 1, maxRedeemPercent: 0 });
      }).toThrow(LoyaltyError);

      expect(() => {
        service.updateProgramConfig({ id: 1, validityDays: 0 });
      }).toThrow(LoyaltyError);
    });
  });

  describe('getOrCreateWallet', () => {
    it('should create a new wallet with zero balances for a new customer', () => {
      const wallet = service.getOrCreateWallet(testCustomerId);

      expect(wallet.id).toBeGreaterThan(0);
      expect(wallet.customerId).toBe(testCustomerId);
      expect(wallet.currentBalance).toBe(0.0);
      expect(wallet.totalEarned).toBe(0.0);
      expect(wallet.totalRedeemed).toBe(0.0);
      expect(wallet.totalExpired).toBe(0.0);
      expect(wallet.createdAt).toBeDefined();
    });

    it('should return existing wallet without recreating or overwriting balance', () => {
      const first = service.getOrCreateWallet(testCustomerId);

      // Mutate wallet directly in DB
      db.prepare('UPDATE loyalty_wallets SET current_balance = 50.0 WHERE id = ?').run(first.id);

      const second = service.getOrCreateWallet(testCustomerId);
      expect(second.id).toBe(first.id);
      expect(second.currentBalance).toBe(50.0);
    });

    it('should throw CUSTOMER_NOT_FOUND when customer does not exist', () => {
      expect(() => {
        service.getOrCreateWallet(99999);
      }).toThrow(LoyaltyError);

      try {
        service.getOrCreateWallet(99999);
      } catch (err: any) {
        expect(err.code).toBe('CUSTOMER_NOT_FOUND');
      }
    });
  });

  describe('calculateCashback', () => {
    it('should calculate exact cashback amount with cent rounding', () => {
      // Global config: 3%
      expect(service.calculateCashback(100.0)).toBe(3.0);
      expect(service.calculateCashback(50.0)).toBe(1.5);
      expect(service.calculateCashback(33.33)).toBe(1.0); // 33.33 * 0.03 = 0.9999 -> 1.00
      expect(service.calculateCashback(49.90)).toBe(1.5); // 49.90 * 0.03 = 1.497 -> 1.50
    });

    it('should return 0 if purchase amount is below min_purchase_amount', () => {
      // Global config: min_purchase_amount = 10.0
      expect(service.calculateCashback(9.99)).toBe(0);
      expect(service.calculateCashback(5.0)).toBe(0);
      expect(service.calculateCashback(0)).toBe(0);
    });

    it('should use branch specific config when storeId is provided', () => {
      // Configure store 2 with 10% cashback and min purchase R$ 50
      db.prepare(
        `INSERT INTO loyalty_programs (store_id, name, cashback_percent, validity_days, min_purchase_amount, min_redeem_amount, max_redeem_percent, is_active)
         VALUES (2, 'Filial 2 Turbo', 10.0, 30, 50.0, 5.0, 50.0, 1)`
      ).run();

      expect(service.calculateCashback(40.0, 2)).toBe(0); // below min purchase 50
      expect(service.calculateCashback(100.0, 2)).toBe(10.0);
    });

    it('should return 0 when program is inactive', () => {
      service.updateProgramConfig({ id: 1, isActive: false });
      expect(service.calculateCashback(100.0)).toBe(0);
    });
  });

  describe('creditCashback', () => {
    it('should credit cashback, create EARN transaction, update wallet balance and activity', () => {
      createSale(101, 200.0);
      const creditInput: CashbackCreditInput = {
        saleId: 101,
        customerId: testCustomerId,
        saleAmount: 200.0, // 3% of 200 = 6.00
        notes: 'Cashback referente à compra #101',
      };

      const tx = service.creditCashback(creditInput);

      expect(tx).toBeDefined();
      expect(tx?.walletId).toBeGreaterThan(0);
      expect(tx?.saleId).toBe(101);
      expect(tx?.type).toBe('EARN');
      expect(tx?.amount).toBe(6.0);
      expect(tx?.balanceAfter).toBe(6.0);
      expect(tx?.expiresAt).toBeDefined();

      // Check wallet state
      const wallet = service.getOrCreateWallet(testCustomerId);
      expect(wallet.currentBalance).toBe(6.0);
      expect(wallet.totalEarned).toBe(6.0);
      expect(wallet.totalRedeemed).toBe(0.0);
      expect(wallet.lastActivityAt).toBeDefined();

      // Second credit accumulates atomically
      createSale(102, 100.0);
      const tx2 = service.creditCashback({
        saleId: 102,
        customerId: testCustomerId,
        saleAmount: 100.0, // 3% of 100 = 3.00
      });

      expect(tx2?.amount).toBe(3.0);
      expect(tx2?.balanceAfter).toBe(9.0);

      const walletUpdated = service.getOrCreateWallet(testCustomerId);
      expect(walletUpdated.currentBalance).toBe(9.0);
      expect(walletUpdated.totalEarned).toBe(9.0);
    });

    it('should support positional arguments (saleId, customerId, saleAmount)', () => {
      createSale(201, 150.0);
      const tx = service.creditCashback(201, testCustomerId, 150.0);
      expect(tx).toBeDefined();
      expect(tx?.amount).toBe(4.5);
      expect(tx?.balanceAfter).toBe(4.5);
    });

    it('should return null when saleAmount is below min_purchase_amount', () => {
      createSale(103, 8.5);
      const tx = service.creditCashback({
        saleId: 103,
        customerId: testCustomerId,
        saleAmount: 8.5, // below 10.0 min
      });

      expect(tx).toBeNull();

      const wallet = service.getOrCreateWallet(testCustomerId);
      expect(wallet.currentBalance).toBe(0.0);
      expect(wallet.totalEarned).toBe(0.0);
    });

    it('should throw CUSTOMER_NOT_FOUND if customer does not exist', () => {
      createSale(104, 100.0);
      expect(() => {
        service.creditCashback({
          saleId: 104,
          customerId: 99999,
          saleAmount: 100.0,
        });
      }).toThrow(LoyaltyError);

      try {
        service.creditCashback({
          saleId: 104,
          customerId: 99999,
          saleAmount: 100.0,
        });
      } catch (err: any) {
        expect(err.code).toBe('CUSTOMER_NOT_FOUND');
      }
    });
  });

  describe('redeemCashback', () => {
    beforeEach(() => {
      createSale(1, 666.67);
      // Credit R$ 20 to test customer (sale of R$ 666.67 at 3% = 20.00)
      service.creditCashback(1, testCustomerId, 666.67);
    });

    it('should successfully redeem cashback, reduce balance and create REDEEM transaction', () => {
      createSale(301, 50.0);
      const redeemInput: CashbackRedeemInput = {
        customerId: testCustomerId,
        saleAmount: 50.0,
        requestedRedeem: 10.0, // Within 50% max of R$ 50 (= R$ 25), >= min R$ 5, <= balance R$ 20
        saleId: 301,
        notes: 'Resgate de cashback no checkout',
      };

      const tx = service.redeemCashback(redeemInput);

      expect(tx).toBeDefined();
      expect(tx.type).toBe('REDEEM');
      expect(tx.amount).toBe(10.0);
      expect(tx.balanceAfter).toBe(10.0); // 20.0 - 10.0
      expect(tx.saleId).toBe(301);

      const wallet = service.getOrCreateWallet(testCustomerId);
      expect(wallet.currentBalance).toBe(10.0);
      expect(wallet.totalRedeemed).toBe(10.0);
      expect(wallet.lastActivityAt).toBeDefined();
    });

    it('should support positional arguments (customerId, saleAmount, requestedRedeem, saleId)', () => {
      createSale(302, 50.0);
      const tx = service.redeemCashback(testCustomerId, 50.0, 10.0, 302);
      expect(tx.amount).toBe(10.0);
      expect(tx.balanceAfter).toBe(10.0);
    });

    it('should throw INVALID_REDEEM_AMOUNT when requested amount is <= 0', () => {
      expect(() => {
        service.redeemCashback({
          customerId: testCustomerId,
          saleAmount: 50.0,
          requestedRedeem: 0,
        });
      }).toThrowError(/INVALID_REDEEM_AMOUNT/);

      expect(() => {
        service.redeemCashback({
          customerId: testCustomerId,
          saleAmount: 50.0,
          requestedRedeem: -5.0,
        });
      }).toThrowError(/INVALID_REDEEM_AMOUNT/);
    });

    it('should throw BELOW_MINIMUM_REDEEM when requested amount is below min_redeem_amount (R$ 5.00)', () => {
      expect(() => {
        service.redeemCashback({
          customerId: testCustomerId,
          saleAmount: 50.0,
          requestedRedeem: 3.5, // below min R$ 5.00
        });
      }).toThrowError(/BELOW_MINIMUM_REDEEM/);
    });

    it('should throw EXCEEDS_MAX_REDEEM_PERCENT when requested amount exceeds ceiling (50% of saleAmount)', () => {
      // Sale of R$ 20 -> max allowed redeem is 50% = R$ 10.00
      expect(() => {
        service.redeemCashback({
          customerId: testCustomerId,
          saleAmount: 20.0,
          requestedRedeem: 15.0, // 15.0 > 10.0 (50% of 20)
        });
      }).toThrowError(/EXCEEDS_MAX_REDEEM_PERCENT/);
    });

    it('should throw INSUFFICIENT_BALANCE when requested amount exceeds current wallet balance', () => {
      // Balance is R$ 20.00. Sale of R$ 100 -> max allowed is 50 = R$ 50. But balance only 20.
      expect(() => {
        service.redeemCashback({
          customerId: testCustomerId,
          saleAmount: 100.0,
          requestedRedeem: 25.0, // 25 > 20 balance
        });
      }).toThrowError(/INSUFFICIENT_BALANCE/);
    });

    it('should throw CUSTOMER_NOT_FOUND when customer does not exist', () => {
      expect(() => {
        service.redeemCashback({
          customerId: 99999,
          saleAmount: 100.0,
          requestedRedeem: 10.0,
        });
      }).toThrowError(/CUSTOMER_NOT_FOUND/);
    });
  });

  describe('getWalletStatement', () => {
    it('should return wallet and full transaction history ordered by created_at DESC, id DESC', () => {
      createSale(401, 333.33);
      createSale(402, 166.67);
      createSale(403, 50.0);

      // 1. Credit 10
      service.creditCashback(401, testCustomerId, 333.33); // 10.00
      // 2. Credit 5
      service.creditCashback(402, testCustomerId, 166.67); // 5.00
      // 3. Redeem 5
      service.redeemCashback(testCustomerId, 50.0, 5.0, 403);

      const statement = service.getWalletStatement(testCustomerId);

      expect(statement.wallet).toBeDefined();
      expect(statement.wallet.customerId).toBe(testCustomerId);
      expect(statement.wallet.currentBalance).toBe(10.0);
      expect(statement.wallet.totalEarned).toBe(15.0);
      expect(statement.wallet.totalRedeemed).toBe(5.0);

      expect(statement.transactions).toHaveLength(3);
      // Order: newest first (REDEEM, EARN #2, EARN #1)
      expect(statement.transactions[0].type).toBe('REDEEM');
      expect(statement.transactions[0].amount).toBe(5.0);

      expect(statement.transactions[1].type).toBe('EARN');
      expect(statement.transactions[1].amount).toBe(5.0);

      expect(statement.transactions[2].type).toBe('EARN');
      expect(statement.transactions[2].amount).toBe(10.0);
    });

    it('should throw CUSTOMER_NOT_FOUND when customer does not exist', () => {
      expect(() => {
        service.getWalletStatement(99999);
      }).toThrow(LoyaltyError);
    });
  });

  describe('expireOverdueCashback', () => {
    it('should expire overdue credits, debit wallet balance and create EXPIRE transaction', () => {
      createSale(501, 333.33);
      createSale(502, 500.0);

      // Customer 1 earns R$ 10.00 (sale of 333.33 at 3%)
      const tx1 = service.creditCashback(501, testCustomerId, 333.33);
      expect(tx1?.amount).toBe(10.0);

      // Customer 2 earns R$ 15.00 (sale of 500 at 3%)
      const tx2 = service.creditCashback(502, secondCustomerId, 500.0);
      expect(tx2?.amount).toBe(15.0);

      // Verify balances before expiration
      expect(service.getOrCreateWallet(testCustomerId).currentBalance).toBe(10.0);
      expect(service.getOrCreateWallet(secondCustomerId).currentBalance).toBe(15.0);

      // Set tx1's expires_at to yesterday in the past
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      db.prepare('UPDATE loyalty_transactions SET expires_at = ? WHERE id = ?').run(yesterday, tx1?.id);

      // Run expiration job
      const result = service.expireOverdueCashback();

      expect(result.expiredCount).toBe(1);
      expect(result.totalAmount).toBe(10.0);

      // Customer 1's wallet should be debited
      const wallet1 = service.getOrCreateWallet(testCustomerId);
      expect(wallet1.currentBalance).toBe(0.0);
      expect(wallet1.totalExpired).toBe(10.0);

      // Customer 2's wallet should remain intact
      const wallet2 = service.getOrCreateWallet(secondCustomerId);
      expect(wallet2.currentBalance).toBe(15.0);
      expect(wallet2.totalExpired).toBe(0.0);

      // Check customer 1 statement has EXPIRE transaction
      const statement = service.getWalletStatement(testCustomerId);
      expect(statement.transactions[0].type).toBe('EXPIRE');
      expect(statement.transactions[0].amount).toBe(10.0);
      expect(statement.transactions[0].balanceAfter).toBe(0.0);

      // Running job again is idempotent
      const secondRun = service.expireOverdueCashback();
      expect(secondRun.expiredCount).toBe(0);
      expect(secondRun.totalAmount).toBe(0.0);
    });

    it('should only expire remaining currentBalance if customer already redeemed part of the balance', () => {
      createSale(601, 666.67);
      createSale(602, 50.0);

      // Customer earns R$ 20.00
      const tx = service.creditCashback(601, testCustomerId, 666.67);
      expect(tx?.amount).toBe(20.0);

      // Customer redeems R$ 15.00
      service.redeemCashback(testCustomerId, 50.0, 15.0, 602);
      expect(service.getOrCreateWallet(testCustomerId).currentBalance).toBe(5.0);

      // Set tx expires_at to past
      const pastDate = '2026-01-01T00:00:00.000Z';
      db.prepare('UPDATE loyalty_transactions SET expires_at = ? WHERE id = ?').run(pastDate, tx?.id);

      // Run expiration
      const result = service.expireOverdueCashback();

      // Only the remaining R$ 5.00 should be expired
      expect(result.expiredCount).toBe(1);
      expect(result.totalAmount).toBe(5.0);

      const wallet = service.getOrCreateWallet(testCustomerId);
      expect(wallet.currentBalance).toBe(0.0);
      expect(wallet.totalExpired).toBe(5.0);
    });
  });
});
