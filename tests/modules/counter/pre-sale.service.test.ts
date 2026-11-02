import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database, getDatabase } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CatalogService } from '../../../src/modules/catalog/catalog.service';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';
import { PreSaleService } from '../../../src/modules/counter/pre-sale.service';
import { PrescriptionDTO } from '../../../src/modules/counter/types';

describe('PreSaleService (Counter Service & Portaria 344/98 Prescription Validation)', () => {
  let db: Database;
  let catalog: CatalogService;
  let inventory: InventoryService;
  let preSaleService: PreSaleService;

  let isentoProductId: number;
  let isentoBatchId: number;

  let controlledB1ProductId: number;
  let controlledB1BatchId: number;

  let antimicrobialProductId: number;
  let antimicrobialBatchId: number;

  const validPrescription: PrescriptionDTO = {
    doctorName: 'Dr. Roberto Carlos',
    doctorCrm: '123456',
    doctorUf: 'SP',
    prescriptionType: 'B1_AZUL',
    prescriptionDate: '2026-10-31',
    patientName: 'Maria Silva',
    buyerName: 'Carlos Silva',
    buyerCpf: '111.222.333-44',
  };

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    catalog = new CatalogService(db);
    inventory = new InventoryService(db);
    preSaleService = new PreSaleService(db, catalog, inventory);

    // 1. Isento Product (Dipirona)
    const isento = catalog.createProduct({
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
    isentoProductId = isento.id;

    const b1 = inventory.addBatch({
      productId: isentoProductId,
      batchNumber: 'LOTE-ISENTO-01',
      manufacturingDate: '2026-01-01',
      expirationDate: '2028-12-31',
      quantity: 50,
    });
    isentoBatchId = b1.id;

    // 2. Controlled B1 Product (Diazepam)
    const controlledB1 = catalog.createProduct({
      ean: '7892222222222',
      name: 'Diazepam 10mg',
      activeIngredient: 'Diazepam',
      msRegistration: '100000000002',
      stripe: 'PRETA',
      controlType: 'B1',
      pmc: 30.0,
      pf: 20.0,
      price: 22.0,
    });
    controlledB1ProductId = controlledB1.id;

    const b2 = inventory.addBatch({
      productId: controlledB1ProductId,
      batchNumber: 'LOTE-B1-01',
      manufacturingDate: '2026-01-01',
      expirationDate: '2027-12-31',
      quantity: 30,
    });
    controlledB1BatchId = b2.id;

    // 3. Antimicrobial Product (Amoxicilina)
    const antimicrobial = catalog.createProduct({
      ean: '7893333333333',
      name: 'Amoxicilina 500mg',
      activeIngredient: 'Amoxicilina',
      msRegistration: '100000000003',
      stripe: 'VERMELHA',
      controlType: 'ANTIMICROBIANO',
      pmc: 45.0,
      pf: 30.0,
      price: 35.0,
    });
    antimicrobialProductId = antimicrobial.id;

    const b3 = inventory.addBatch({
      productId: antimicrobialProductId,
      batchNumber: 'LOTE-AMX-01',
      manufacturingDate: '2026-01-01',
      expirationDate: '2028-06-30',
      quantity: 20,
    });
    antimicrobialBatchId = b3.id;
  });

  afterEach(() => {
    db.close();
  });

  describe('Item Validation', () => {
    it('should throw EMPTY_PRE_SALE when items array is empty', () => {
      expect(() => {
        preSaleService.createPreSale({
          items: [],
        });
      }).toThrow('EMPTY_PRE_SALE');
    });

    it('should throw INVALID_QUANTITY when any item has quantity <= 0', () => {
      expect(() => {
        preSaleService.createPreSale({
          items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 0 }],
        });
      }).toThrow('INVALID_QUANTITY');

      expect(() => {
        preSaleService.createPreSale({
          items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: -2 }],
        });
      }).toThrow('INVALID_QUANTITY');
    });

    it('should throw PRODUCT_NOT_FOUND when productId does not exist', () => {
      expect(() => {
        preSaleService.createPreSale({
          items: [{ productId: 99999, batchId: isentoBatchId, quantity: 1 }],
        });
      }).toThrow('PRODUCT_NOT_FOUND');
    });

    it('should throw PRODUCT_NOT_FOUND when product is inactive', () => {
      const inactive = catalog.createProduct({
        ean: '7899999999999',
        name: 'Produto Desativado',
        activeIngredient: 'Nenhum',
        msRegistration: '100000000099',
        stripe: 'SEM_TARJA',
        controlType: 'ISENTO',
        pmc: 20.0,
        pf: 15.0,
        price: 12.0,
      });
      db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(inactive.id);

      const batch = inventory.addBatch({
        productId: inactive.id,
        batchNumber: 'LOTE-INACTIVE',
        manufacturingDate: '2026-01-01',
        expirationDate: '2028-12-31',
        quantity: 10,
      });

      expect(() => {
        preSaleService.createPreSale({
          items: [{ productId: inactive.id, batchId: batch.id, quantity: 1 }],
        });
      }).toThrow('PRODUCT_NOT_FOUND');
    });

    it('should throw INSUFFICIENT_BATCH_STOCK when batchId does not belong to the product', () => {
      expect(() => {
        preSaleService.createPreSale({
          items: [{ productId: isentoProductId, batchId: controlledB1BatchId, quantity: 1 }],
        });
      }).toThrow('INSUFFICIENT_BATCH_STOCK');
    });

    it('should throw INSUFFICIENT_BATCH_STOCK when requested quantity exceeds available stock', () => {
      expect(() => {
        preSaleService.createPreSale({
          items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 100 }],
        });
      }).toThrow('INSUFFICIENT_BATCH_STOCK');
    });

    it('should throw BATCH_EXPIRED when attempting to pre-sell an expired batch', () => {
      const result = db.prepare(`
        INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity)
        VALUES (?, 'LOTE-EXP', '2020-01-01', '2021-01-01', 50, 0)
      `).run(isentoProductId);
      const expiredBatchId = Number(result.lastInsertRowid);

      expect(() => {
        preSaleService.createPreSale({
          items: [{ productId: isentoProductId, batchId: expiredBatchId, quantity: 1 }],
        });
      }).toThrow('BATCH_EXPIRED');
    });
  });

  describe('Regulatory Compliance (Portaria 344/98 & Antimicrobials)', () => {
    it('should throw PRESCRIPTION_REQUIRED when controlled product has no prescription', () => {
      expect(() => {
        preSaleService.createPreSale({
          customerName: 'João Silva',
          items: [{ productId: controlledB1ProductId, batchId: controlledB1BatchId, quantity: 1 }],
        });
      }).toThrow('PRESCRIPTION_REQUIRED');
    });

    it('should throw PRESCRIPTION_REQUIRED when antimicrobial has no prescription', () => {
      expect(() => {
        preSaleService.createPreSale({
          customerName: 'João Silva',
          items: [{ productId: antimicrobialProductId, batchId: antimicrobialBatchId, quantity: 1 }],
        });
      }).toThrow('PRESCRIPTION_REQUIRED');
    });

    it('should throw PRESCRIPTION_REQUIRED in a mixed pre-sale if any product is controlled', () => {
      expect(() => {
        preSaleService.createPreSale({
          customerName: 'João Silva',
          items: [
            { productId: isentoProductId, batchId: isentoBatchId, quantity: 2 },
            { productId: controlledB1ProductId, batchId: controlledB1BatchId, quantity: 1 },
          ],
        });
      }).toThrow('PRESCRIPTION_REQUIRED');
    });

    it('should throw PRESCRIPTION_REQUIRED if any required prescription field is missing or empty', () => {
      const fields: (keyof PrescriptionDTO)[] = [
        'doctorName',
        'doctorCrm',
        'doctorUf',
        'prescriptionType',
        'prescriptionDate',
        'patientName',
      ];

      for (const field of fields) {
        const incompletePrescription: any = { ...validPrescription };
        delete incompletePrescription[field];

        expect(() => {
          preSaleService.createPreSale({
            items: [{ productId: controlledB1ProductId, batchId: controlledB1BatchId, quantity: 1 }],
            prescription: incompletePrescription,
          });
        }).toThrow('PRESCRIPTION_REQUIRED');

        const emptyStringPrescription = { ...validPrescription, [field]: '   ' };
        expect(() => {
          preSaleService.createPreSale({
            items: [{ productId: controlledB1ProductId, batchId: controlledB1BatchId, quantity: 1 }],
            prescription: emptyStringPrescription,
          });
        }).toThrow('PRESCRIPTION_REQUIRED');
      }
    });
  });

  describe('Successful Pre-Sale Creation', () => {
    it('should create pre-sale for isento product without prescription and format code PV-0001', () => {
      const preSale = preSaleService.createPreSale({
        customerName: 'Carlos Ferreira',
        customerCpf: '123.456.789-10',
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 3 }],
      });

      expect(preSale).toBeDefined();
      expect(preSale.id).toBe(1);
      expect(preSale.code).toBe('PV-0001');
      expect(preSale.status).toBe('OPEN');
      expect(preSale.customerName).toBe('Carlos Ferreira');
      expect(preSale.customerCpf).toBe('123.456.789-10');
      expect(preSale.totalAmount).toBe(25.5); // 3 * 8.5
      expect(typeof preSale.createdAt).toBe('string');

      // Verify batch reservation
      const batch = inventory.getBatchById(isentoBatchId);
      expect(batch?.quantity).toBe(50);
      expect(batch?.reservedQuantity).toBe(3);
      expect(batch?.availableQuantity).toBe(47);
    });

    it('should create pre-sale for controlled medicine with complete prescription and format code PV-0002 sequentially', () => {
      // First sale
      preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 1 }],
      });

      // Second sale (controlled)
      const controlledPreSale = preSaleService.createPreSale({
        customerName: 'Maria Silva',
        customerCpf: '987.654.321-00',
        items: [{ productId: controlledB1ProductId, batchId: controlledB1BatchId, quantity: 2 }],
        prescription: validPrescription,
      });

      expect(controlledPreSale.id).toBe(2);
      expect(controlledPreSale.code).toBe('PV-0002');
      expect(controlledPreSale.status).toBe('OPEN');
      expect(controlledPreSale.totalAmount).toBe(44.0); // 2 * 22.0

      const b2 = inventory.getBatchById(controlledB1BatchId);
      expect(b2?.reservedQuantity).toBe(2);
      expect(b2?.availableQuantity).toBe(28);
    });

    it('should create pre-sale with multiple items and reserve all batches', () => {
      const multi = preSaleService.createPreSale({
        customerName: 'Ana Paula',
        items: [
          { productId: isentoProductId, batchId: isentoBatchId, quantity: 2 }, // 2 * 8.5 = 17.0
          { productId: antimicrobialProductId, batchId: antimicrobialBatchId, quantity: 1 }, // 1 * 35.0 = 35.0
        ],
        prescription: {
          ...validPrescription,
          prescriptionType: 'ANTIMICROBIANO',
        },
      });

      expect(multi.totalAmount).toBe(52.0);

      const bIsento = inventory.getBatchById(isentoBatchId);
      expect(bIsento?.reservedQuantity).toBe(2);

      const bAmx = inventory.getBatchById(antimicrobialBatchId);
      expect(bAmx?.reservedQuantity).toBe(1);
    });
  });

  describe('getPreSaleByCode', () => {
    it('should return null when pre-sale code is not found', () => {
      const result = preSaleService.getPreSaleByCode('PV-9999');
      expect(result).toBeNull();
    });

    it('should return complete pre-sale details for isento sale (prescription is null)', () => {
      const created = preSaleService.createPreSale({
        customerName: 'Isento Teste',
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 2 }],
      });

      const details = preSaleService.getPreSaleByCode(created.code);
      expect(details).not.toBeNull();
      expect(details?.preSale.id).toBe(created.id);
      expect(details?.preSale.code).toBe(created.code);
      expect(details?.preSale.status).toBe('OPEN');
      expect(details?.preSale.customerName).toBe('Isento Teste');
      expect(details?.preSale.totalAmount).toBe(17.0);

      expect(details?.items).toHaveLength(1);
      expect(details?.items[0].productId).toBe(isentoProductId);
      expect(details?.items[0].productName).toBe('Dipirona 500mg');
      expect(details?.items[0].batchId).toBe(isentoBatchId);
      expect(details?.items[0].batchNumber).toBe('LOTE-ISENTO-01');
      expect(details?.items[0].quantity).toBe(2);
      expect(details?.items[0].unitPrice).toBe(8.5);
      expect(details?.items[0].totalPrice).toBe(17.0);

      expect(details?.prescription).toBeNull();
    });

    it('should return complete pre-sale details including prescription details for controlled sale', () => {
      const created = preSaleService.createPreSale({
        customerName: 'Maria Silva',
        customerCpf: '111.222.333-44',
        items: [{ productId: controlledB1ProductId, batchId: controlledB1BatchId, quantity: 1 }],
        prescription: validPrescription,
      });

      const details = preSaleService.getPreSaleByCode(created.code);
      expect(details).not.toBeNull();
      expect(details?.preSale.code).toBe(created.code);
      expect(details?.items).toHaveLength(1);
      expect(details?.items[0].productName).toBe('Diazepam 10mg');
      expect(details?.items[0].batchNumber).toBe('LOTE-B1-01');

      expect(details?.prescription).not.toBeNull();
      expect(details?.prescription?.doctorName).toBe('Dr. Roberto Carlos');
      expect(details?.prescription?.doctorCrm).toBe('123456');
      expect(details?.prescription?.doctorUf).toBe('SP');
      expect(details?.prescription?.prescriptionType).toBe('B1_AZUL');
      expect(details?.prescription?.prescriptionDate).toBe('2026-10-31');
      expect(details?.prescription?.patientName).toBe('Maria Silva');
      expect(details?.prescription?.buyerName).toBe('Carlos Silva');
      expect(details?.prescription?.buyerCpf).toBe('111.222.333-44');
      expect(typeof details?.prescription?.createdAt).toBe('string');
    });
  });

  describe('cancelPreSale', () => {
    it('should throw PRE_SALE_NOT_FOUND when cancelling a non-existent pre-sale code', () => {
      expect(() => {
        preSaleService.cancelPreSale('PV-9999');
      }).toThrow('PRE_SALE_NOT_FOUND');
    });

    it('should cancel an open pre-sale and release reserved batch stock', () => {
      const preSale = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 10 }],
      });

      const batchBeforeCancel = inventory.getBatchById(isentoBatchId);
      expect(batchBeforeCancel?.reservedQuantity).toBe(10);
      expect(batchBeforeCancel?.availableQuantity).toBe(40);

      preSaleService.cancelPreSale(preSale.code);

      const details = preSaleService.getPreSaleByCode(preSale.code);
      expect(details?.preSale.status).toBe('CANCELLED');

      const batchAfterCancel = inventory.getBatchById(isentoBatchId);
      expect(batchAfterCancel?.reservedQuantity).toBe(0);
      expect(batchAfterCancel?.availableQuantity).toBe(50);
    });

    it('should throw PRE_SALE_NOT_OPEN when attempting to cancel an already cancelled pre-sale', () => {
      const preSale = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 5 }],
      });

      preSaleService.cancelPreSale(preSale.code);

      expect(() => {
        preSaleService.cancelPreSale(preSale.code);
      }).toThrow('PRE_SALE_NOT_OPEN');
    });

    it('should throw PRE_SALE_NOT_OPEN when attempting to cancel a sale already converted to sale', () => {
      const preSale = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 5 }],
      });

      db.prepare("UPDATE pre_sales SET status = 'CONVERTED_TO_SALE' WHERE id = ?").run(preSale.id);

      expect(() => {
        preSaleService.cancelPreSale(preSale.code);
      }).toThrow('PRE_SALE_NOT_OPEN');
    });
  });

  describe('Transactional Atomicity on Creation Failure', () => {
    it('should rollback batch reservation and pre-sale row if a subsequent item fails stock check', () => {
      // isentoBatch has 50 qty. b2 (Diazepam) has 30 qty.
      expect(() => {
        preSaleService.createPreSale({
          items: [
            { productId: isentoProductId, batchId: isentoBatchId, quantity: 10 },
            { productId: controlledB1ProductId, batchId: controlledB1BatchId, quantity: 999 }, // Will fail!
          ],
          prescription: validPrescription,
        });
      }).toThrow('INSUFFICIENT_BATCH_STOCK');

      // The first batch's reservation must be completely rolled back
      const b1 = inventory.getBatchById(isentoBatchId);
      expect(b1?.reservedQuantity).toBe(0);
      expect(b1?.availableQuantity).toBe(50);

      // No pre-sale row should exist
      const count = db.prepare<{ cnt: number }>('SELECT count(*) as cnt FROM pre_sales').get();
      expect(count?.cnt).toBe(0);
    });

    it('should rollback batch reservation if prescription validation fails', () => {
      expect(() => {
        preSaleService.createPreSale({
          items: [{ productId: controlledB1ProductId, batchId: controlledB1BatchId, quantity: 5 }],
          // Missing prescription!
        });
      }).toThrow('PRESCRIPTION_REQUIRED');

      const b2 = inventory.getBatchById(controlledB1BatchId);
      expect(b2?.reservedQuantity).toBe(0);
      expect(b2?.availableQuantity).toBe(30);

      const count = db.prepare<{ cnt: number }>('SELECT count(*) as cnt FROM pre_sales').get();
      expect(count?.cnt).toBe(0);
    });
  });
});
