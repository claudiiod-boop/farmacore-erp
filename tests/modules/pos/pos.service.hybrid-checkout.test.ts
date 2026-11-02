import { describe, it, expect, beforeEach } from 'vitest';
import { Database, getDatabase } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CatalogService } from '../../../src/modules/catalog/catalog.service';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';
import { PreSaleService } from '../../../src/modules/counter/pre-sale.service';
import { PosService } from '../../../src/modules/pos/pos.service';
import { CashSession } from '../../../src/modules/pos/types';

describe('PosService - Checkout Híbrido Unificado & Resumo de Sessão', () => {
  let db: Database;
  let catalog: CatalogService;
  let inventory: InventoryService;
  let preSaleService: PreSaleService;
  let posService: PosService;

  let otcProductId: number;
  let otcBatchId: number;

  let perfumeProductId: number;
  let perfumeBatchId: number;

  let controlledProductId: number;
  let controlledBatchId: number;

  let openSession: CashSession;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    catalog = new CatalogService(db);
    inventory = new InventoryService(db);
    preSaleService = new PreSaleService(db, catalog, inventory);
    posService = new PosService(db, preSaleService, inventory);

    // OTC Drug (Dipirona 500mg, R$ 12.00)
    const otc = catalog.createProduct({
      ean: '7891111111111',
      name: 'Dipirona 500mg 20 Comprimidos',
      activeIngredient: 'Dipirona Sódica',
      msRegistration: '100000000001',
      stripe: 'SEM_TARJA',
      controlType: 'ISENTO',
      pmc: 18.0,
      pf: 10.0,
      price: 12.0,
    });
    otcProductId = otc.id;

    const b1 = inventory.addBatch({
      productId: otcProductId,
      batchNumber: 'LOTE-DIP-01',
      manufacturingDate: '2026-01-01',
      expirationDate: '2028-12-31',
      quantity: 50,
    });
    otcBatchId = b1.id;

    // Convenience / Perfumery Item (Protetor Solar FPS 50, R$ 45.00)
    const perfume = catalog.createProduct({
      ean: '7892222222222',
      name: 'Protetor Solar FPS 50 200ml',
      activeIngredient: 'Filtro Solar',
      msRegistration: '200000000001',
      stripe: 'SEM_TARJA',
      controlType: 'ISENTO',
      pmc: 60.0,
      pf: 35.0,
      price: 45.0,
    });
    perfumeProductId = perfume.id;

    const b2 = inventory.addBatch({
      productId: perfumeProductId,
      batchNumber: 'LOTE-PROT-01',
      manufacturingDate: '2026-01-01',
      expirationDate: '2028-06-30',
      quantity: 20,
    });
    perfumeBatchId = b2.id;

    // Controlled Drug (Clonazepam 2mg, R$ 30.00 - Lista B1)
    const controlled = catalog.createProduct({
      ean: '7893333333333',
      name: 'Clonazepam 2mg 30 Comprimidos',
      activeIngredient: 'Clonazepam',
      msRegistration: '100000000003',
      stripe: 'PRETA',
      controlType: 'B1',
      pmc: 40.0,
      pf: 22.0,
      price: 30.0,
    });
    controlledProductId = controlled.id;

    const b3 = inventory.addBatch({
      productId: controlledProductId,
      batchNumber: 'LOTE-CLON-01',
      manufacturingDate: '2026-01-01',
      expirationDate: '2028-12-31',
      quantity: 30,
    });
    controlledBatchId = b3.id;

    // Open session with R$ 100.00
    openSession = posService.openCashSession('Operador Caixa 1', 100.0);
  });

  describe('Direct Cashier Sale (additionalItems only)', () => {
    it('should complete checkout for direct OTC items without pre-sale', () => {
      const saleDetails = posService.checkout({
        cashSessionId: openSession.id,
        additionalItems: [
          { productId: perfumeProductId, batchId: perfumeBatchId, quantity: 2 }, // 2 x 45 = 90.0
        ],
        payments: [{ method: 'PIX', amount: 90.0 }],
      });

      expect(saleDetails.sale.id).toBeDefined();
      expect(saleDetails.sale.status).toBe('COMPLETED');
      expect(saleDetails.sale.totalAmount).toBe(90.0);
      expect(saleDetails.sale.changeAmount).toBe(0);
      expect(saleDetails.sale.cashSessionId).toBe(openSession.id);
      expect(saleDetails.sale.preSaleId).toBeNull();
      expect(saleDetails.preSaleCode).toBeUndefined();

      expect(saleDetails.items).toHaveLength(1);
      expect(saleDetails.items[0].productId).toBe(perfumeProductId);
      expect(saleDetails.items[0].productName).toBe('Protetor Solar FPS 50 200ml');
      expect(saleDetails.items[0].quantity).toBe(2);
      expect(saleDetails.items[0].unitPrice).toBe(45.0);
      expect(saleDetails.items[0].totalPrice).toBe(90.0);

      expect(saleDetails.payments).toHaveLength(1);
      expect(saleDetails.payments[0].method).toBe('PIX');
      expect(saleDetails.payments[0].amount).toBe(90.0);

      // Verify physical stock deduction: 20 - 2 = 18
      const batch = inventory.getBatchById(perfumeBatchId)!;
      expect(batch.quantity).toBe(18);
      expect(batch.availableQuantity).toBe(18);
    });

    it('should block direct sale of controlled substance with CONTROLLED_DRUG_DIRECT_SALE_FORBIDDEN', () => {
      expect(() => {
        posService.checkout({
          cashSessionId: openSession.id,
          additionalItems: [
            { productId: controlledProductId, batchId: controlledBatchId, quantity: 1 },
          ],
          payments: [{ method: 'DINHEIRO', amount: 30.0 }],
        });
      }).toThrow('CONTROLLED_DRUG_DIRECT_SALE_FORBIDDEN');

      // Stock must not be touched
      const batch = inventory.getBatchById(controlledBatchId)!;
      expect(batch.quantity).toBe(30);
    });

    it('should reject direct sale if batch stock is insufficient (INSUFFICIENT_BATCH_STOCK)', () => {
      expect(() => {
        posService.checkout({
          cashSessionId: openSession.id,
          additionalItems: [
            { productId: perfumeProductId, batchId: perfumeBatchId, quantity: 25 }, // only 20 available
          ],
          payments: [{ method: 'DINHEIRO', amount: 1125.0 }],
        });
      }).toThrow('INSUFFICIENT_BATCH_STOCK');
    });

    it('should reject direct sale if product is not found (PRODUCT_NOT_FOUND)', () => {
      expect(() => {
        posService.checkout({
          cashSessionId: openSession.id,
          additionalItems: [{ productId: 999999, batchId: perfumeBatchId, quantity: 1 }],
          payments: [{ method: 'DINHEIRO', amount: 50.0 }],
        });
      }).toThrow('PRODUCT_NOT_FOUND');
    });
  });

  describe('Unified Hybrid Checkout (Pre-Sale + additionalItems)', () => {
    it('should combine pre-sale and additional items in single transaction and update cash drawer', () => {
      // 1. Create pre-sale at counter: 2 x Dipirona (2 x 12 = 24.0)
      const pv = preSaleService.createPreSale({
        customerName: 'Cliente Balcao',
        items: [{ productId: otcProductId, batchId: otcBatchId, quantity: 2 }],
      });

      // 2. Cashier adds Protetor Solar (1 x 45 = 45.0). Grand Total = 24 + 45 = 69.0
      // Pay 100.0 in cash, change = 31.0
      const saleDetails = posService.checkout({
        cashSessionId: openSession.id,
        preSaleCode: pv.code,
        additionalItems: [
          { productId: perfumeProductId, batchId: perfumeBatchId, quantity: 1 },
        ],
        payments: [{ method: 'DINHEIRO', amount: 100.0 }],
      });

      expect(saleDetails.sale.id).toBeDefined();
      expect(saleDetails.sale.status).toBe('COMPLETED');
      expect(saleDetails.sale.totalAmount).toBe(69.0);
      expect(saleDetails.sale.changeAmount).toBe(31.0);
      expect(saleDetails.preSaleCode).toBe(pv.code);

      // Verify items: 1 from pre-sale + 1 additional
      expect(saleDetails.items).toHaveLength(2);
      expect(saleDetails.items[0].productName).toBe('Dipirona 500mg 20 Comprimidos');
      expect(saleDetails.items[0].quantity).toBe(2);
      expect(saleDetails.items[1].productName).toBe('Protetor Solar FPS 50 200ml');
      expect(saleDetails.items[1].quantity).toBe(1);

      // Pre-sale status updated to CONVERTED_TO_SALE
      const updatedPv = preSaleService.getPreSaleByCode(pv.code);
      expect(updatedPv?.preSale.status).toBe('CONVERTED_TO_SALE');

      // Both stocks deducted
      const otcBatch = inventory.getBatchById(otcBatchId)!;
      expect(otcBatch.quantity).toBe(48);
      expect(otcBatch.reservedQuantity).toBe(0);

      const perfumeBatch = inventory.getBatchById(perfumeBatchId)!;
      expect(perfumeBatch.quantity).toBe(19);

      // Drawer updated: 100 initial + 69 net cash = 169.0
      const session = posService.getCurrentSession('Operador Caixa 1');
      expect(session?.currentCash).toBe(169.0);
    });

    it('should reject hybrid checkout if pre-sale is already converted', () => {
      const pv = preSaleService.createPreSale({
        customerName: 'Cliente Balcao',
        items: [{ productId: otcProductId, batchId: otcBatchId, quantity: 1 }],
      });

      // Finalize first time
      posService.checkout({
        cashSessionId: openSession.id,
        preSaleCode: pv.code,
        payments: [{ method: 'PIX', amount: 12.0 }],
      });

      // Attempt second time
      expect(() => {
        posService.checkout({
          cashSessionId: openSession.id,
          preSaleCode: pv.code,
          additionalItems: [
            { productId: perfumeProductId, batchId: perfumeBatchId, quantity: 1 },
          ],
          payments: [{ method: 'PIX', amount: 57.0 }],
        });
      }).toThrow('PRE_SALE_ALREADY_CLOSED');
    });

    it('should reject checkout if empty (EMPTY_CHECKOUT)', () => {
      expect(() => {
        posService.checkout({
          cashSessionId: openSession.id,
          additionalItems: [],
          payments: [{ method: 'DINHEIRO', amount: 10.0 }],
        });
      }).toThrow('EMPTY_CHECKOUT');
    });

    it('should reject checkout if cashSessionId belongs to a closed session (SESSION_NOT_OPEN)', () => {
      posService.closeCashSession(openSession.id);

      expect(() => {
        posService.checkout({
          cashSessionId: openSession.id,
          additionalItems: [
            { productId: perfumeProductId, batchId: perfumeBatchId, quantity: 1 },
          ],
          payments: [{ method: 'PIX', amount: 45.0 }],
        });
      }).toThrow('SESSION_NOT_OPEN');
    });

    it('should reject checkout if payment is insufficient (INSUFFICIENT_PAYMENT)', () => {
      expect(() => {
        posService.checkout({
          cashSessionId: openSession.id,
          additionalItems: [
            { productId: perfumeProductId, batchId: perfumeBatchId, quantity: 1 }, // 45.0
          ],
          payments: [{ method: 'DINHEIRO', amount: 40.0 }],
        });
      }).toThrow('INSUFFICIENT_PAYMENT');
    });

    it('should reject change from non-cash payments (EXCESS_NON_CASH_PAYMENT)', () => {
      expect(() => {
        posService.checkout({
          cashSessionId: openSession.id,
          additionalItems: [
            { productId: perfumeProductId, batchId: perfumeBatchId, quantity: 1 }, // 45.0
          ],
          payments: [{ method: 'CARTAO_CREDITO', amount: 50.0 }],
        });
      }).toThrow('EXCESS_NON_CASH_PAYMENT');
    });
  });

  describe('Session Summary without Closing (getSessionSummary)', () => {
    it('should return session summary with sales and movements without closing session', () => {
      // 1. Sangria 20.0
      posService.registerCashMovement(
        openSession.id,
        'SANGRIA',
        20.0,
        'Sangria parcial',
        'Operador Caixa 1'
      );

      // 2. Supply 30.0
      posService.registerCashMovement(
        openSession.id,
        'SUPPLY',
        30.0,
        'Aporte de troco',
        'Operador Caixa 1'
      );

      // 3. Checkout: 45.0 in cash
      posService.checkout({
        cashSessionId: openSession.id,
        additionalItems: [
          { productId: perfumeProductId, batchId: perfumeBatchId, quantity: 1 },
        ],
        payments: [{ method: 'DINHEIRO', amount: 45.0 }],
      });

      // Call getSessionSummary
      const summary = posService.getSessionSummary(openSession.id);

      expect(summary.session.id).toBe(openSession.id);
      expect(summary.session.status).toBe('OPEN');
      expect(summary.session.closedAt).toBeNull();
      expect(summary.totalSalesCount).toBe(1);
      expect(summary.totalSalesAmount).toBe(45.0);
      expect(summary.totalsByMethod.DINHEIRO).toBe(45.0);
      expect(summary.totalSupplies).toBe(30.0);
      expect(summary.totalSangrias).toBe(20.0);
      // Expected cash: 100 initial + 30 supply - 20 sangria + 45 cash = 155.0
      expect(summary.expectedCash).toBe(155.0);

      // Session should still be open
      const current = posService.getCurrentSession('Operador Caixa 1');
      expect(current?.status).toBe('OPEN');
    });

    it('should throw SESSION_NOT_OPEN if session does not exist or is already closed', () => {
      expect(() => {
        posService.getSessionSummary(999999);
      }).toThrow('SESSION_NOT_OPEN');

      posService.closeCashSession(openSession.id);

      expect(() => {
        posService.getSessionSummary(openSession.id);
      }).toThrow('SESSION_NOT_OPEN');
    });
  });
});
