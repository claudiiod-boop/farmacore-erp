import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { ExpiryManagementService } from '../../../src/modules/sanitary/expiry-management.service';

describe('ExpiryManagementService - Central de Validades Preditiva', () => {
  let db: Database;
  let service: ExpiryManagementService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new ExpiryManagementService(db);
  });

  afterEach(() => {
    db.close();
  });

  function seedProductsAndBatches() {
    // Insert 2 products
    const p1 = db
      .prepare(`
        INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
        VALUES ('7891000000001', 'Amoxicilina 500mg 21 caps', 'Amoxicilina', '1234567890123', 'TARJA_VERMELHA', 'ANTIBIOTICO', 40.0, 15.0, 30.0)
      `)
      .run();

    const p2 = db
      .prepare(`
        INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
        VALUES ('7891000000002', 'Losartana Potássica 50mg', 'Losartana', '1000000000000', 'TARJA_VERMELHA', 'ISENTO', 20.0, 5.0, 12.0)
      `)
      .run();

    // Reference Date will be 2026-11-20
    const insertBatch = db.prepare(`
      INSERT INTO batches (store_id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity, is_blocked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. Expired: 2026-10-31 (-20 days)
    insertBatch.run(1, p1.lastInsertRowid, 'LOTE-EXP-01', '2024-10-31', '2026-10-31', 10, 0, 0);

    // 2. Risk 30: 2026-12-10 (+20 days)
    insertBatch.run(1, p1.lastInsertRowid, 'LOTE-R30-01', '2024-12-10', '2026-12-10', 15, 0, 0);

    // 3. Risk 60: 2027-01-10 (+51 days)
    insertBatch.run(1, p2.lastInsertRowid, 'LOTE-R60-01', '2025-01-10', '2027-01-10', 20, 0, 0);

    // 4. Risk 90: 2027-02-15 (+87 days)
    insertBatch.run(1, p2.lastInsertRowid, 'LOTE-R90-01', '2025-02-15', '2027-02-15', 30, 0, 0);

    // 5. Safe: 2027-11-20 (+365 days)
    insertBatch.run(1, p1.lastInsertRowid, 'LOTE-SAFE-01', '2025-11-20', '2027-11-20', 50, 0, 0);

    // 6. Zero quantity batch (should be ignored in matrix)
    insertBatch.run(1, p2.lastInsertRowid, 'LOTE-ZERO-01', '2024-01-01', '2026-11-25', 0, 0, 0);

    return { p1Id: p1.lastInsertRowid as number, p2Id: p2.lastInsertRowid as number };
  }

  describe('getExpiryMatrix', () => {
    it('should compute the 5 risk categories accurately with financial totals at cost and sale prices', () => {
      seedProductsAndBatches();
      const matrix = service.getExpiryMatrix(1, '2026-11-20');

      expect(matrix.referenceDate).toBe('2026-11-20');
      expect(matrix.totalBatches).toBe(5);
      expect(matrix.totalUnits).toBe(10 + 15 + 20 + 30 + 50); // 125 units

      // Category: EXPIRED
      const expired = matrix.tiers.EXPIRED;
      expect(expired.batchCount).toBe(1);
      expect(expired.unitCount).toBe(10);
      expect(expired.totalCost).toBe(150.0); // 10 * 15.0
      expect(expired.totalSale).toBe(300.0); // 10 * 30.0

      // Category: RISK_30_DAYS
      const r30 = matrix.tiers.RISK_30_DAYS;
      expect(r30.batchCount).toBe(1);
      expect(r30.unitCount).toBe(15);
      expect(r30.totalCost).toBe(225.0); // 15 * 15.0
      expect(r30.totalSale).toBe(450.0); // 15 * 30.0

      // Category: RISK_60_DAYS
      const r60 = matrix.tiers.RISK_60_DAYS;
      expect(r60.batchCount).toBe(1);
      expect(r60.unitCount).toBe(20);
      expect(r60.totalCost).toBe(100.0); // 20 * 5.0
      expect(r60.totalSale).toBe(240.0); // 20 * 12.0

      // Category: RISK_90_DAYS
      const r90 = matrix.tiers.RISK_90_DAYS;
      expect(r90.batchCount).toBe(1);
      expect(r90.unitCount).toBe(30);
      expect(r90.totalCost).toBe(150.0); // 30 * 5.0
      expect(r90.totalSale).toBe(360.0); // 30 * 12.0

      // Category: SAFE
      const safe = matrix.tiers.SAFE;
      expect(safe.batchCount).toBe(1);
      expect(safe.unitCount).toBe(50);
      expect(safe.totalCost).toBe(750.0); // 50 * 15.0
      expect(safe.totalSale).toBe(1500.0); // 50 * 30.0

      // Overall totals
      expect(matrix.totalCostAmount).toBe(150 + 225 + 100 + 150 + 750);
      expect(matrix.totalSaleAmount).toBe(300 + 450 + 240 + 360 + 1500);
    });

    it('should return zeros when there are no active batches', () => {
      const matrix = service.getExpiryMatrix(1, '2026-11-20');
      expect(matrix.totalBatches).toBe(0);
      expect(matrix.totalUnits).toBe(0);
      expect(matrix.totalCostAmount).toBe(0);
      expect(matrix.totalSaleAmount).toBe(0);
      expect(matrix.tiers.EXPIRED.unitCount).toBe(0);
    });
  });

  describe('getExpiringBatches', () => {
    it('should list and filter batches by category and search term with correct suggestions', () => {
      seedProductsAndBatches();

      // Filter category RISK_30_DAYS
      const resR30 = service.getExpiringBatches({
        storeId: 1,
        category: 'RISK_30_DAYS',
      });
      expect(resR30.total).toBe(1);
      expect(resR30.batches[0].batchNumber).toBe('LOTE-R30-01');
      expect(resR30.batches[0].suggestedAction).toBe('PROMOTION');

      // Filter by maxDays (up to 60 days)
      const res60 = service.getExpiringBatches({
        storeId: 1,
        maxDays: 60,
      });
      // Should include EXPIRED (-20), RISK_30 (20) and RISK_60 (51)
      expect(res60.total).toBe(3);

      // Search by product name
      const resSearch = service.getExpiringBatches({
        storeId: 1,
        search: 'Losartana',
      });
      expect(resSearch.total).toBe(2);
      expect(resSearch.batches.every((b) => b.productName.includes('Losartana'))).toBe(true);
    });
  });

  describe('suggestActionForBatch', () => {
    it('should return DISPOSE for expired batches', () => {
      const suggestion = service.suggestActionForBatch({
        id: 1,
        batchNumber: 'LOTE-01',
        expirationDate: '2026-10-31',
        currentQuantity: 10,
        unitCost: 10,
        unitSalePrice: 20,
      }, 90, '2026-11-20');

      expect(suggestion).toBe('DISPOSE');
    });

    it('should return PROMOTION for batches between 0 and 60 days', () => {
      const suggestion = service.suggestActionForBatch({
        id: 1,
        batchNumber: 'LOTE-02',
        expirationDate: '2026-12-15',
        currentQuantity: 10,
        unitCost: 10,
        unitSalePrice: 20,
      }, 90, '2026-11-20');

      expect(suggestion).toBe('PROMOTION');
    });

    it('should return RETURN_TO_SUPPLIER for batches between 61 and supplier return limit (default 90)', () => {
      const suggestion = service.suggestActionForBatch({
        id: 1,
        batchNumber: 'LOTE-03',
        expirationDate: '2027-02-10',
        currentQuantity: 10,
        unitCost: 10,
        unitSalePrice: 20,
      }, 90, '2026-11-20');

      expect(suggestion).toBe('RETURN_TO_SUPPLIER');
    });

    it('should return NORMAL for batches beyond supplier return window (>90 days)', () => {
      const suggestion = service.suggestActionForBatch({
        id: 1,
        batchNumber: 'LOTE-04',
        expirationDate: '2027-11-20',
        currentQuantity: 10,
        unitCost: 10,
        unitSalePrice: 20,
      }, 90, '2026-11-20');

      expect(suggestion).toBe('NORMAL');
    });
  });
});
