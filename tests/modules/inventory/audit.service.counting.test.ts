import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { InventoryAuditService } from '../../../src/modules/inventory/audit.service';
import type { InventorySessionWithItems } from '../../../src/modules/inventory/audit-types';

describe('InventoryAuditService - Blind Counting, Recount & Divergence Consolidation', () => {
  let db: Database;
  let service: InventoryAuditService;
  let openSession: InventorySessionWithItems;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new InventoryAuditService(db);

    // Setup helper data: Create store 1
    // (Store 1 LJ01 is seeded by migration 008)

    // Insert products
    // Product 1: Dipirona 500mg, pf = 20.00
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active, category)
      VALUES (1, '7891000000010', 'Dipirona 500mg Gotas', 'Dipirona Sódica', '1.0000.0001.001-1', 'SEM_TARJA', 'ISENTO', 25.00, 20.00, 22.00, 1, 'REFERENCIA')
    `).run();

    // Product 2: Amoxicilina 500mg, pf = 15.50
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active, category)
      VALUES (2, '7891000000027', 'Amoxicilina 500mg 21 caps', 'Amoxicilina Tri-hidratada', '1.0000.0002.001-2', 'VERMELHA', 'ANTIMICROBIANO', 20.00, 15.50, 18.00, 1, 'GENERICO')
    `).run();

    // Product 3: Shampoo Anticaspa, pf = 10.00
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active, category)
      VALUES (3, '7891000000034', 'Shampoo Anticaspa 200ml', 'Zinco Piritiona', 'ISENTO', 'SEM_TARJA', 'ISENTO', 15.00, 10.00, 14.00, 1, 'PERFUMARIA')
    `).run();

    // Batches for Store 1
    // Batch 1: Product 1, LOT001, qty 50, reserved 5 -> expected 45, unitCost 20.00
    // Batch 2: Product 1, LOT002, qty 20, reserved 0 -> expected 20, unitCost 20.00
    // Batch 3: Product 2, LOT003, qty 30, reserved 0 -> expected 30, unitCost 15.50
    db.prepare(`
      INSERT INTO batches (id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity, store_id)
      VALUES 
        (1, 1, 'LOT001', '2026-01-01', '2027-12-31', 50, 5, 1),
        (2, 1, 'LOT002', '2026-02-01', '2028-01-31', 20, 0, 1),
        (3, 2, 'LOT003', '2026-03-01', '2027-06-30', 30, 0, 1)
    `).run();

    // Create OPEN session for Store 1
    openSession = service.createSession({
      storeId: 1,
      inventoryType: 'GERAL',
      openedBy: 'Operador Almoxarifado',
      notes: 'Sessão de Teste Contagem Cega',
    });
  });

  afterEach(() => {
    db.close();
  });

  describe('addCount', () => {
    it('should record an exact count (EXACT) when physical count matches expected quantity', () => {
      // LOT001 expectedQuantity is 45 (50 total - 5 reserved)
      const item = service.addCount(openSession.id, {
        productId: 1,
        batchNumber: 'LOT001',
        expirationDate: '2027-12-31',
        quantity: 45,
      });

      expect(item).toBeDefined();
      expect(item.sessionId).toBe(openSession.id);
      expect(item.productId).toBe(1);
      expect(item.batchNumber).toBe('LOT001');
      expect(item.expectedQuantity).toBe(45);
      expect(item.countedQuantity).toBe(45);
      expect(item.differenceQuantity).toBe(0);
      expect(item.differenceStatus).toBe('EXACT');
      expect(item.totalCostDifference).toBe(0);
    });

    it('should record a surplus (SURPLUS) when physical count exceeds expected quantity', () => {
      // LOT001 expected is 45; counted is 50 (+5 sobra, unitCost 20.00 -> total cost diff +100.00)
      const item = service.addCount(openSession.id, {
        productId: 1,
        batchNumber: 'LOT001',
        expirationDate: '2027-12-31',
        quantity: 50,
      });

      expect(item.countedQuantity).toBe(50);
      expect(item.differenceQuantity).toBe(5);
      expect(item.differenceStatus).toBe('SURPLUS');
      expect(item.unitCost).toBe(20.00);
      expect(item.totalCostDifference).toBe(100.00);
    });

    it('should record a shortage (SHORTAGE) when physical count is below expected quantity', () => {
      // LOT001 expected is 45; counted is 38 (-7 falta, unitCost 20.00 -> total cost diff -140.00)
      const item = service.addCount(openSession.id, {
        productId: 1,
        batchNumber: 'LOT001',
        expirationDate: '2027-12-31',
        quantity: 38,
      });

      expect(item.countedQuantity).toBe(38);
      expect(item.differenceQuantity).toBe(-7);
      expect(item.differenceStatus).toBe('SHORTAGE');
      expect(item.totalCostDifference).toBe(-140.00);
    });

    it('should resolve product by EAN barcode scan instead of productId', () => {
      // Product 2 EAN: '7891000000027', LOT003 expected is 30, unitCost 15.50
      const item = service.addCount(openSession.id, {
        ean: '7891000000027',
        batchNumber: 'LOT003',
        expirationDate: '2027-06-30',
        quantity: 30,
      });

      expect(item.productId).toBe(2);
      expect(item.productEan).toBe('7891000000027');
      expect(item.productName).toBe('Amoxicilina 500mg 21 caps');
      expect(item.countedQuantity).toBe(30);
      expect(item.differenceStatus).toBe('EXACT');
    });

    it('should support incremental barcode beep counting (isIncremental: true)', () => {
      // Operator beeps LOT002 three times (expected 20)
      service.addCount(openSession.id, {
        productId: 1,
        batchNumber: 'LOT002',
        expirationDate: '2028-01-31',
        quantity: 10,
        isIncremental: true,
      });

      service.addCount(openSession.id, {
        productId: 1,
        batchNumber: 'LOT002',
        expirationDate: '2028-01-31',
        quantity: 5,
        isIncremental: true,
      });

      const finalItem = service.addCount(openSession.id, {
        productId: 1,
        batchNumber: 'LOT002',
        expirationDate: '2028-01-31',
        quantity: 5,
        isIncremental: true,
      });

      expect(finalItem.countedQuantity).toBe(20);
      expect(finalItem.expectedQuantity).toBe(20);
      expect(finalItem.differenceQuantity).toBe(0);
      expect(finalItem.differenceStatus).toBe('EXACT');
    });

    it('should insert a new item for an uncataloged batch found on shelf (expected = 0, SURPLUS)', () => {
      // Physical batch LOT-SURPRISE found on shelf for Product 1, not in system snapshot
      const item = service.addCount(openSession.id, {
        productId: 1,
        batchNumber: 'LOT-SURPRISE',
        expirationDate: '2027-11-30',
        manufacturingDate: '2025-11-30',
        quantity: 12,
        unitCost: 20.00,
      });

      expect(item.id).toBeGreaterThan(0);
      expect(item.sessionId).toBe(openSession.id);
      expect(item.productId).toBe(1);
      expect(item.batchNumber).toBe('LOT-SURPRISE');
      expect(item.batchId).toBeNull();
      expect(item.expectedQuantity).toBe(0);
      expect(item.countedQuantity).toBe(12);
      expect(item.differenceQuantity).toBe(12);
      expect(item.differenceStatus).toBe('SURPLUS');
      expect(item.unitCost).toBe(20.00);
      expect(item.totalCostDifference).toBe(240.00);
      expect(item.adjustmentReason).toBe('SOBRA_NAO_IDENTIFICADA');

      // Verify it appears in getSessionById
      const updatedSession = service.getSessionById(openSession.id);
      expect(updatedSession?.items).toHaveLength(4); // 3 from snapshot + 1 uncataloged
    });

    it('should throw an error if session does not exist', () => {
      expect(() =>
        service.addCount(99999, {
          productId: 1,
          batchNumber: 'LOT001',
          expirationDate: '2027-12-31',
          quantity: 10,
        })
      ).toThrow(/Sessão de inventário não encontrada/i);
    });

    it('should throw an error if session is not OPEN', () => {
      // Force status to COUNTED
      db.prepare(`UPDATE inventory_sessions SET status = 'COUNTED' WHERE id = ?`).run(openSession.id);

      expect(() =>
        service.addCount(openSession.id, {
          productId: 1,
          batchNumber: 'LOT001',
          expirationDate: '2027-12-31',
          quantity: 10,
        })
      ).toThrow(/Sessão de inventário não está aberta para contagem/i);
    });

    it('should throw an error if product is not found by ID or EAN', () => {
      expect(() =>
        service.addCount(openSession.id, {
          productId: 9999,
          batchNumber: 'LOT001',
          expirationDate: '2027-12-31',
          quantity: 10,
        })
      ).toThrow(/Produto não encontrado/i);

      expect(() =>
        service.addCount(openSession.id, {
          ean: '0000000000000',
          batchNumber: 'LOT001',
          expirationDate: '2027-12-31',
          quantity: 10,
        })
      ).toThrow(/Produto não encontrado/i);
    });

    it('should throw an error if batchNumber or expirationDate is missing or quantity is invalid', () => {
      expect(() =>
        service.addCount(openSession.id, {
          productId: 1,
          batchNumber: '',
          expirationDate: '2027-12-31',
          quantity: 10,
        })
      ).toThrow(/Número do lote é obrigatório/i);

      expect(() =>
        service.addCount(openSession.id, {
          productId: 1,
          batchNumber: 'LOT001',
          expirationDate: '',
          quantity: 10,
        })
      ).toThrow(/Data de validade é obrigatória/i);

      expect(() =>
        service.addCount(openSession.id, {
          productId: 1,
          batchNumber: 'LOT001',
          expirationDate: '2027-12-31',
          quantity: -5,
        })
      ).toThrow(/Quantidade inválida/i);
    });
  });

  describe('recountItem', () => {
    it('should update counted quantity and recalculate differences during recount', () => {
      // First count: LOT001 expected 45, counted 40 (SHORTAGE -5, diff cost -100.00)
      const initialItem = service.addCount(openSession.id, {
        productId: 1,
        batchNumber: 'LOT001',
        expirationDate: '2027-12-31',
        quantity: 40,
      });

      expect(initialItem.countedQuantity).toBe(40);
      expect(initialItem.differenceQuantity).toBe(-5);
      expect(initialItem.differenceStatus).toBe('SHORTAGE');

      // Supervisor conducts recount: found 45 items (matches expected)
      const recountedItem = service.recountItem(openSession.id, initialItem.id, 45);

      expect(recountedItem.id).toBe(initialItem.id);
      expect(recountedItem.recountQuantity).toBe(45);
      expect(recountedItem.countedQuantity).toBe(45);
      expect(recountedItem.differenceQuantity).toBe(0);
      expect(recountedItem.differenceStatus).toBe('EXACT');
      expect(recountedItem.totalCostDifference).toBe(0);
    });

    it('should allow recounting when session status is COUNTED', () => {
      const initialItem = service.addCount(openSession.id, {
        productId: 1,
        batchNumber: 'LOT001',
        expirationDate: '2027-12-31',
        quantity: 40,
      });

      // Move session to COUNTED
      db.prepare(`UPDATE inventory_sessions SET status = 'COUNTED' WHERE id = ?`).run(openSession.id);

      const recountedItem = service.recountItem(openSession.id, initialItem.id, 46);
      expect(recountedItem.recountQuantity).toBe(46);
      expect(recountedItem.countedQuantity).toBe(46);
      expect(recountedItem.differenceQuantity).toBe(1);
      expect(recountedItem.differenceStatus).toBe('SURPLUS');
    });

    it('should throw an error if session is APPLIED or CANCELLED', () => {
      const item = openSession.items[0];

      db.prepare(`UPDATE inventory_sessions SET status = 'APPLIED' WHERE id = ?`).run(openSession.id);
      expect(() => service.recountItem(openSession.id, item.id, 10)).toThrow(
        /Sessão de inventário não permite recontagem/i
      );

      db.prepare(`UPDATE inventory_sessions SET status = 'CANCELLED' WHERE id = ?`).run(openSession.id);
      expect(() => service.recountItem(openSession.id, item.id, 10)).toThrow(
        /Sessão de inventário não permite recontagem/i
      );
    });

    it('should throw an error if item does not belong to session', () => {
      expect(() => service.recountItem(openSession.id, 9999, 10)).toThrow(
        /Item de inventário não encontrado nesta sessão/i
      );
    });

    it('should throw an error if recountQuantity is negative', () => {
      const item = openSession.items[0];
      expect(() => service.recountItem(openSession.id, item.id, -1)).toThrow(
        /Quantidade de recontagem inválida/i
      );
    });
  });

  describe('finishCounting', () => {
    it('should transition session to COUNTED and calculate accuracy and financial metrics', () => {
      // Store 1 initial snapshot:
      // Item 1: LOT001, expected 45, unitCost 20.00
      // Item 2: LOT002, expected 20, unitCost 20.00
      // Item 3: LOT003, expected 30, unitCost 15.50

      // Count Item 1: exact 45 -> EXACT, diff = 0
      service.addCount(openSession.id, {
        productId: 1,
        batchNumber: 'LOT001',
        expirationDate: '2027-12-31',
        quantity: 45,
      });

      // Count Item 2: 25 -> SURPLUS (+5 * 20.00 = +100.00)
      service.addCount(openSession.id, {
        productId: 1,
        batchNumber: 'LOT002',
        expirationDate: '2028-01-31',
        quantity: 25,
      });

      // Count Item 3: 28 -> SHORTAGE (-2 * 15.50 = -31.00)
      service.addCount(openSession.id, {
        productId: 2,
        batchNumber: 'LOT003',
        expirationDate: '2027-06-30',
        quantity: 28,
      });

      const finishedSession = service.finishCounting(openSession.id);

      expect(finishedSession.status).toBe('COUNTED');
      expect(finishedSession.totalProductsCounted).toBe(2); // Products 1 and 2
      expect(finishedSession.totalBatchesCounted).toBe(3); // 3 batches counted > 0
      // Accuracy rate: 1 EXACT out of 3 total items = 1/3 * 100 = 33.33%
      expect(finishedSession.accuracyRate).toBe(33.33);
      expect(finishedSession.totalSurplusCost).toBe(100.00);
      expect(finishedSession.totalShortageCost).toBe(31.00);
      // Net financial diff: 100.00 - 31.00 = +69.00
      expect(finishedSession.netFinancialDifference).toBe(69.00);
    });

    it('should achieve 100% accuracy when all items match expected quantities', () => {
      service.addCount(openSession.id, {
        productId: 1,
        batchNumber: 'LOT001',
        expirationDate: '2027-12-31',
        quantity: 45,
      });
      service.addCount(openSession.id, {
        productId: 1,
        batchNumber: 'LOT002',
        expirationDate: '2028-01-31',
        quantity: 20,
      });
      service.addCount(openSession.id, {
        productId: 2,
        batchNumber: 'LOT003',
        expirationDate: '2027-06-30',
        quantity: 30,
      });

      const finishedSession = service.finishCounting(openSession.id);

      expect(finishedSession.status).toBe('COUNTED');
      expect(finishedSession.accuracyRate).toBe(100.0);
      expect(finishedSession.totalSurplusCost).toBe(0);
      expect(finishedSession.totalShortageCost).toBe(0);
      expect(finishedSession.netFinancialDifference).toBe(0);
    });

    it('should throw an error if session is not OPEN', () => {
      db.prepare(`UPDATE inventory_sessions SET status = 'COUNTED' WHERE id = ?`).run(openSession.id);

      expect(() => service.finishCounting(openSession.id)).toThrow(
        /Sessão de inventário não está aberta para finalização de contagem/i
      );
    });
  });
});
