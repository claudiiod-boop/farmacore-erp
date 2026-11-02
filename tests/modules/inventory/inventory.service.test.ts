import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database, getDatabase } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CatalogService } from '../../../src/modules/catalog/catalog.service';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';
import { AddBatchDTO } from '../../../src/modules/inventory/types';

describe('InventoryService (FEFO & Batches)', () => {
  let db: Database;
  let catalog: CatalogService;
  let inventory: InventoryService;
  let productId: number;
  let secondProductId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    catalog = new CatalogService(db);
    inventory = new InventoryService(db);

    const prod1 = catalog.createProduct({
      ean: '7891111111111',
      name: 'Dipirona 500mg',
      activeIngredient: 'Dipirona Sódica',
      msRegistration: '100000000001',
      stripe: 'SEM_TARJA',
      controlType: 'ISENTO',
      pmc: 15.0,
      pf: 10.0,
      price: 8.5,
    });
    productId = prod1.id;

    const prod2 = catalog.createProduct({
      ean: '7892222222222',
      name: 'Amoxicilina 500mg',
      activeIngredient: 'Amoxicilina',
      msRegistration: '100000000002',
      stripe: 'VERMELHA',
      controlType: 'ANTIMICROBIANO',
      pmc: 40.0,
      pf: 25.0,
      price: 32.0,
    });
    secondProductId = prod2.id;
  });

  afterEach(() => {
    db.close();
  });

  describe('addBatch', () => {
    it('should successfully add a valid batch with future expiration date', () => {
      const dto: AddBatchDTO = {
        productId,
        batchNumber: 'LOTE-2029-A',
        manufacturingDate: '2026-01-01',
        expirationDate: '2029-12-31',
        quantity: 100,
      };

      const batch = inventory.addBatch(dto);

      expect(batch).toBeDefined();
      expect(batch.id).toBeGreaterThan(0);
      expect(batch.productId).toBe(productId);
      expect(batch.batchNumber).toBe('LOTE-2029-A');
      expect(batch.manufacturingDate).toBe('2026-01-01');
      expect(batch.expirationDate).toBe('2029-12-31');
      expect(batch.quantity).toBe(100);
      expect(batch.reservedQuantity).toBe(0);
      expect(batch.availableQuantity).toBe(100);
      expect(typeof batch.createdAt).toBe('string');
    });

    it('should reject adding an already expired batch with BATCH_EXPIRED error', () => {
      expect(() => {
        inventory.addBatch({
          productId,
          batchNumber: 'LOTE-EXPIRED-PAST',
          manufacturingDate: '2023-01-01',
          expirationDate: '2024-01-01',
          quantity: 10,
        });
      }).toThrow('BATCH_EXPIRED');
    });

    it('should reject adding a batch expiring today with BATCH_EXPIRED error', () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(() => {
        inventory.addBatch({
          productId,
          batchNumber: 'LOTE-EXPIRED-TODAY',
          manufacturingDate: '2025-01-01',
          expirationDate: today,
          quantity: 20,
        });
      }).toThrow('BATCH_EXPIRED');
    });

    it('should reject quantity <= 0 with INVALID_QUANTITY error', () => {
      expect(() => {
        inventory.addBatch({
          productId,
          batchNumber: 'LOTE-ZERO',
          manufacturingDate: '2026-01-01',
          expirationDate: '2029-12-31',
          quantity: 0,
        });
      }).toThrow('INVALID_QUANTITY');

      expect(() => {
        inventory.addBatch({
          productId,
          batchNumber: 'LOTE-NEG',
          manufacturingDate: '2026-01-01',
          expirationDate: '2029-12-31',
          quantity: -10,
        });
      }).toThrow('INVALID_QUANTITY');
    });
  });

  describe('getBatchById', () => {
    it('should return mapped batch when id exists', () => {
      const created = inventory.addBatch({
        productId,
        batchNumber: 'LOTE-FIND-1',
        manufacturingDate: '2026-01-01',
        expirationDate: '2029-06-30',
        quantity: 50,
      });

      const found = inventory.getBatchById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.batchNumber).toBe('LOTE-FIND-1');
      expect(found?.quantity).toBe(50);
      expect(found?.reservedQuantity).toBe(0);
      expect(found?.availableQuantity).toBe(50);
    });

    it('should return null when batch id does not exist', () => {
      const found = inventory.getBatchById(99999);
      expect(found).toBeNull();
    });
  });

  describe('getAvailableBatches & FEFO ordering', () => {
    it('should return available batches strictly ordered by expirationDate ASC', () => {
      inventory.addBatch({
        productId,
        batchNumber: 'LOTE-LATE',
        manufacturingDate: '2026-01-01',
        expirationDate: '2029-12-31',
        quantity: 50,
      });

      inventory.addBatch({
        productId,
        batchNumber: 'LOTE-EARLY',
        manufacturingDate: '2026-01-01',
        expirationDate: '2027-06-30',
        quantity: 20,
      });

      inventory.addBatch({
        productId,
        batchNumber: 'LOTE-MID',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-03-15',
        quantity: 30,
      });

      const batches = inventory.getAvailableBatches(productId);

      expect(batches).toHaveLength(3);
      expect(batches[0].batchNumber).toBe('LOTE-EARLY');
      expect(batches[1].batchNumber).toBe('LOTE-MID');
      expect(batches[2].batchNumber).toBe('LOTE-LATE');
    });

    it('should filter out batches of other products', () => {
      inventory.addBatch({
        productId,
        batchNumber: 'LOTE-PROD-1',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 10,
      });

      inventory.addBatch({
        productId: secondProductId,
        batchNumber: 'LOTE-PROD-2',
        manufacturingDate: '2026-01-01',
        expirationDate: '2027-12-31',
        quantity: 20,
      });

      const prod1Batches = inventory.getAvailableBatches(productId);
      expect(prod1Batches).toHaveLength(1);
      expect(prod1Batches[0].batchNumber).toBe('LOTE-PROD-1');

      const prod2Batches = inventory.getAvailableBatches(secondProductId);
      expect(prod2Batches).toHaveLength(1);
      expect(prod2Batches[0].batchNumber).toBe('LOTE-PROD-2');
    });

    it('should filter out expired batches and batches with 0 available quantity', () => {
      const b1 = inventory.addBatch({
        productId,
        batchNumber: 'LOTE-AVAILABLE',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 15,
      });

      // Insert an expired batch directly into DB to test runtime filtering
      db.prepare(`
        INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity)
        VALUES (?, 'LOTE-OLD-DB', '2020-01-01', '2021-01-01', 50, 0)
      `).run(productId);

      // Add a batch and fully reserve it
      const b2 = inventory.addBatch({
        productId,
        batchNumber: 'LOTE-FULLY-RESERVED',
        manufacturingDate: '2026-01-01',
        expirationDate: '2027-12-31',
        quantity: 10,
      });
      inventory.reserveBatchStock(b2.id, 10);

      const available = inventory.getAvailableBatches(productId);
      expect(available).toHaveLength(1);
      expect(available[0].batchNumber).toBe('LOTE-AVAILABLE');
    });
  });

  describe('suggestFefoBatch', () => {
    it('should automatically select the batch with earliest expiration date (FEFO)', () => {
      inventory.addBatch({
        productId,
        batchNumber: 'LOTE-LONGO',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 50,
      });

      inventory.addBatch({
        productId,
        batchNumber: 'LOTE-CURTO',
        manufacturingDate: '2026-01-01',
        expirationDate: '2027-06-30',
        quantity: 20,
      });

      const suggested = inventory.suggestFefoBatch(productId, 1);
      expect(suggested.batchNumber).toBe('LOTE-CURTO');
    });

    it('should skip earliest batch if it does not have enough available stock', () => {
      inventory.addBatch({
        productId,
        batchNumber: 'LOTE-CURTO-POUCO',
        manufacturingDate: '2026-01-01',
        expirationDate: '2027-06-30',
        quantity: 5,
      });

      inventory.addBatch({
        productId,
        batchNumber: 'LOTE-LONGO-MUITO',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 50,
      });

      // Request 10 units: LOTE-CURTO-POUCO only has 5, so LOTE-LONGO-MUITO must be suggested
      const suggested = inventory.suggestFefoBatch(productId, 10);
      expect(suggested.batchNumber).toBe('LOTE-LONGO-MUITO');
    });

    it('should throw INSUFFICIENT_STOCK if requested quantity exceeds all available batches', () => {
      inventory.addBatch({
        productId,
        batchNumber: 'LOTE-1',
        manufacturingDate: '2026-01-01',
        expirationDate: '2027-06-30',
        quantity: 10,
      });

      expect(() => {
        inventory.suggestFefoBatch(productId, 50);
      }).toThrow('INSUFFICIENT_STOCK');
    });

    it('should throw INSUFFICIENT_STOCK if product has no batches or stock', () => {
      expect(() => {
        inventory.suggestFefoBatch(productId, 1);
      }).toThrow('INSUFFICIENT_STOCK');
    });

    it('should throw INVALID_QUANTITY if requested quantity is <= 0', () => {
      expect(() => {
        inventory.suggestFefoBatch(productId, 0);
      }).toThrow('INVALID_QUANTITY');

      expect(() => {
        inventory.suggestFefoBatch(productId, -1);
      }).toThrow('INVALID_QUANTITY');
    });
  });

  describe('reserveBatchStock', () => {
    it('should throw BATCH_EXPIRED when attempting to reserve an expired batch', () => {
      const result = db.prepare(`
        INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity)
        VALUES (?, 'LOTE-EXPIRED-RES', '2020-01-01', '2021-01-01', 50, 0)
      `).run(productId);
      const expiredBatchId = Number(result.lastInsertRowid);

      expect(() => {
        inventory.reserveBatchStock(expiredBatchId, 5);
      }).toThrow('BATCH_EXPIRED');
    });

    it('should throw INVALID_QUANTITY when reserving quantity <= 0', () => {
      const batch = inventory.addBatch({
        productId,
        batchNumber: 'LOTE-RES-QTY',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 10,
      });

      expect(() => {
        inventory.reserveBatchStock(batch.id, 0);
      }).toThrow('INVALID_QUANTITY');

      expect(() => {
        inventory.reserveBatchStock(batch.id, -2);
      }).toThrow('INVALID_QUANTITY');
    });

    it('should reserve batch stock atomically', () => {
      const batch = inventory.addBatch({
        productId,
        batchNumber: 'LOTE-RESERVE-1',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 25,
      });

      inventory.reserveBatchStock(batch.id, 10);

      const updated = inventory.getBatchById(batch.id);
      expect(updated?.quantity).toBe(25);
      expect(updated?.reservedQuantity).toBe(10);
      expect(updated?.availableQuantity).toBe(15);
    });

    it('should throw INSUFFICIENT_BATCH_STOCK when attempting to reserve more than available', () => {
      const batch = inventory.addBatch({
        productId,
        batchNumber: 'LOTE-RESERVE-2',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 10,
      });

      inventory.reserveBatchStock(batch.id, 8);

      expect(() => {
        inventory.reserveBatchStock(batch.id, 3);
      }).toThrow('INSUFFICIENT_BATCH_STOCK');

      // State should remain unchanged after failed reservation
      const refreshed = inventory.getBatchById(batch.id);
      expect(refreshed?.reservedQuantity).toBe(8);
      expect(refreshed?.availableQuantity).toBe(2);
    });

    it('should throw INSUFFICIENT_BATCH_STOCK when batch does not exist', () => {
      expect(() => {
        inventory.reserveBatchStock(99999, 5);
      }).toThrow('INSUFFICIENT_BATCH_STOCK');
    });
  });

  describe('releaseBatchStock', () => {
    it('should throw INVALID_QUANTITY when release quantity <= 0', () => {
      const batch = inventory.addBatch({
        productId,
        batchNumber: 'LOTE-REL-QTY',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 10,
      });

      expect(() => {
        inventory.releaseBatchStock(batch.id, 0);
      }).toThrow('INVALID_QUANTITY');

      expect(() => {
        inventory.releaseBatchStock(batch.id, -5);
      }).toThrow('INVALID_QUANTITY');
    });

    it('should decrease reserved quantity and restore available quantity', () => {
      const batch = inventory.addBatch({
        productId,
        batchNumber: 'LOTE-RELEASE-1',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 30,
      });

      inventory.reserveBatchStock(batch.id, 20);
      inventory.releaseBatchStock(batch.id, 8);

      const updated = inventory.getBatchById(batch.id);
      expect(updated?.reservedQuantity).toBe(12);
      expect(updated?.availableQuantity).toBe(18);
    });

    it('should not allow reserved quantity to drop below zero (MAX(0, reserved - qty))', () => {
      const batch = inventory.addBatch({
        productId,
        batchNumber: 'LOTE-RELEASE-2',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 30,
      });

      inventory.reserveBatchStock(batch.id, 5);
      inventory.releaseBatchStock(batch.id, 100);

      const updated = inventory.getBatchById(batch.id);
      expect(updated?.reservedQuantity).toBe(0);
      expect(updated?.availableQuantity).toBe(30);
    });
  });

  describe('deductBatchStock', () => {
    it('should throw BATCH_EXPIRED when attempting to deduct an expired batch', () => {
      const result = db.prepare(`
        INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity)
        VALUES (?, 'LOTE-EXPIRED-DED', '2020-01-01', '2021-01-01', 50, 0)
      `).run(productId);
      const expiredBatchId = Number(result.lastInsertRowid);

      expect(() => {
        inventory.deductBatchStock(expiredBatchId, 5);
      }).toThrow('BATCH_EXPIRED');
    });

    it('should throw INVALID_QUANTITY when deducting quantity <= 0', () => {
      const batch = inventory.addBatch({
        productId,
        batchNumber: 'LOTE-DED-QTY',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 10,
      });

      expect(() => {
        inventory.deductBatchStock(batch.id, 0);
      }).toThrow('INVALID_QUANTITY');

      expect(() => {
        inventory.deductBatchStock(batch.id, -3);
      }).toThrow('INVALID_QUANTITY');
    });

    it('should physically deduct batch quantity and decrement reserved quantity', () => {
      const batch = inventory.addBatch({
        productId,
        batchNumber: 'LOTE-DEDUCT-1',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 50,
      });

      inventory.reserveBatchStock(batch.id, 10);
      inventory.deductBatchStock(batch.id, 10);

      const updated = inventory.getBatchById(batch.id);
      expect(updated?.quantity).toBe(40);
      expect(updated?.reservedQuantity).toBe(0);
      expect(updated?.availableQuantity).toBe(40);
    });

    it('should throw INSUFFICIENT_BATCH_STOCK if trying to deduct more than physical quantity', () => {
      const batch = inventory.addBatch({
        productId,
        batchNumber: 'LOTE-DEDUCT-2',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 5,
      });

      expect(() => {
        inventory.deductBatchStock(batch.id, 10);
      }).toThrow('INSUFFICIENT_BATCH_STOCK');
    });

    it('should throw INSUFFICIENT_BATCH_STOCK if batch does not exist', () => {
      expect(() => {
        inventory.deductBatchStock(99999, 1);
      }).toThrow('INSUFFICIENT_BATCH_STOCK');
    });
  });
});
