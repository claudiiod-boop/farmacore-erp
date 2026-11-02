import { describe, it, expect, beforeEach } from 'vitest';
import { Database, getDatabase } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CatalogService } from '../../../src/modules/catalog/catalog.service';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';
import { PreSaleService } from '../../../src/modules/counter/pre-sale.service';
import { PosService } from '../../../src/modules/pos/pos.service';
import { PaymentItem } from '../../../src/modules/pos/types';

describe('PosService (PDV & Finalização de Vendas)', () => {
  let db: Database;
  let catalog: CatalogService;
  let inventory: InventoryService;
  let preSaleService: PreSaleService;
  let posService: PosService;

  let isentoProductId: number;
  let isentoBatchId: number;

  let controlledProductId: number;
  let controlledBatchId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    catalog = new CatalogService(db);
    inventory = new InventoryService(db);
    preSaleService = new PreSaleService(db, catalog, inventory);
    posService = new PosService(db, preSaleService, inventory);

    // Setup OTC Product (Dipirona 500mg - R$ 10.00)
    const isento = catalog.createProduct({
      ean: '7891111111111',
      name: 'Dipirona 500mg',
      activeIngredient: 'Dipirona Sódica',
      msRegistration: '100000000001',
      stripe: 'SEM_TARJA',
      controlType: 'ISENTO',
      pmc: 15.0,
      pf: 10.0,
      price: 10.0,
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

    // Setup Controlled Product (Diazepam 10mg - R$ 25.00)
    const controlled = catalog.createProduct({
      ean: '7892222222222',
      name: 'Diazepam 10mg',
      activeIngredient: 'Diazepam',
      msRegistration: '100000000002',
      stripe: 'PRETA',
      controlType: 'B1',
      pmc: 35.0,
      pf: 20.0,
      price: 25.0,
    });
    controlledProductId = controlled.id;

    const b2 = inventory.addBatch({
      productId: controlledProductId,
      batchNumber: 'LOTE-CTRL-01',
      manufacturingDate: '2026-01-01',
      expirationDate: '2028-12-31',
      quantity: 30,
    });
    controlledBatchId = b2.id;
  });

  describe('Cash Session Management (openCashSession, closeCashSession, getCurrentSession)', () => {
    it('should open a new cash session with valid operator and initial cash', () => {
      const session = posService.openCashSession('Operador 1', 100.0);

      expect(session.id).toBeDefined();
      expect(session.operatorName).toBe('Operador 1');
      expect(session.initialCash).toBe(100.0);
      expect(session.currentCash).toBe(100.0);
      expect(session.status).toBe('OPEN');
      expect(session.openedAt).toBeDefined();
      expect(session.closedAt).toBeNull();
    });

    it('should reject opening session with empty or whitespace operator name', () => {
      expect(() => posService.openCashSession('', 100.0)).toThrow('INVALID_OPERATOR');
      expect(() => posService.openCashSession('   ', 100.0)).toThrow('INVALID_OPERATOR');
    });

    it('should reject opening session with negative initial cash', () => {
      expect(() => posService.openCashSession('Operador 1', -10.0)).toThrow('INVALID_AMOUNT');
    });

    it('should reject opening duplicate cash session for the same operator while one is already OPEN', () => {
      posService.openCashSession('Operador 1', 100.0);

      expect(() => {
        posService.openCashSession('Operador 1', 50.0);
      }).toThrow('SESSION_ALREADY_OPEN');
    });

    it('should allow opening session for different operators concurrently', () => {
      const s1 = posService.openCashSession('Operador 1', 100.0);
      const s2 = posService.openCashSession('Operador 2', 150.0);

      expect(s1.id).toBeDefined();
      expect(s2.id).toBeDefined();
      expect(s1.id).not.toBe(s2.id);
    });

    it('should get current open session for operator or general open session', () => {
      expect(posService.getCurrentSession('Operador 1')).toBeNull();
      expect(posService.getCurrentSession()).toBeNull();

      const s1 = posService.openCashSession('Operador 1', 100.0);

      expect(posService.getCurrentSession('Operador 1')?.id).toBe(s1.id);
      expect(posService.getCurrentSession()?.id).toBe(s1.id);
      expect(posService.getCurrentSession('Operador 2')).toBeNull();
    });

    it('should close cash session and generate summary with 0 sales when empty', () => {
      const session = posService.openCashSession('Operador 1', 100.0);
      const summary = posService.closeCashSession(session.id);

      expect(summary.session.id).toBe(session.id);
      expect(summary.session.status).toBe('CLOSED');
      expect(summary.session.closedAt).toBeDefined();
      expect(summary.totalSalesCount).toBe(0);
      expect(summary.totalSalesAmount).toBe(0);
      expect(summary.totalsByMethod).toEqual({
        DINHEIRO: 0,
        CARTAO_CREDITO: 0,
        CARTAO_DEBITO: 0,
        PIX: 0,
      });

      // Verify session is no longer current
      expect(posService.getCurrentSession('Operador 1')).toBeNull();
    });

    it('should reject closing session that does not exist or is already closed', () => {
      expect(() => posService.closeCashSession(99999)).toThrow('SESSION_NOT_OPEN');

      const session = posService.openCashSession('Operador 1', 100.0);
      posService.closeCashSession(session.id);

      expect(() => posService.closeCashSession(session.id)).toThrow('SESSION_NOT_OPEN');
    });

    it('should allow reopening a session for the operator after closing the previous one', () => {
      const s1 = posService.openCashSession('Operador 1', 100.0);
      posService.closeCashSession(s1.id);

      const s2 = posService.openCashSession('Operador 1', 200.0);
      expect(s2.id).toBeDefined();
      expect(s2.id).not.toBe(s1.id);
      expect(s2.status).toBe('OPEN');
    });

    it('should close session and generate correct summary with sales totals by payment method', () => {
      const session = posService.openCashSession('Operador 1', 100.0);

      // Sale 1: 2x Dipirona = R$ 20.00 via DINHEIRO
      const pv1 = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 2 }],
      });
      posService.finalizeSaleFromPreSale(
        pv1.code,
        [{ method: 'DINHEIRO', amount: 20.0 }],
        session.id
      );

      // Sale 2: 1x Dipirona = R$ 10.00 via CARTAO_CREDITO
      const pv2 = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 1 }],
      });
      posService.finalizeSaleFromPreSale(
        pv2.code,
        [{ method: 'CARTAO_CREDITO', amount: 10.0 }],
        session.id
      );

      // Sale 3: 3x Dipirona = R$ 30.00 via PIX (R$ 20.00) + CARTAO_DEBITO (R$ 10.00)
      const pv3 = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 3 }],
      });
      posService.finalizeSaleFromPreSale(
        pv3.code,
        [
          { method: 'PIX', amount: 20.0 },
          { method: 'CARTAO_DEBITO', amount: 10.0 },
        ],
        session.id
      );

      const summary = posService.closeCashSession(session.id);

      expect(summary.totalSalesCount).toBe(3);
      expect(summary.totalSalesAmount).toBe(60.0);
      expect(summary.totalsByMethod.DINHEIRO).toBe(20.0);
      expect(summary.totalsByMethod.CARTAO_CREDITO).toBe(10.0);
      expect(summary.totalsByMethod.CARTAO_DEBITO).toBe(10.0);
      expect(summary.totalsByMethod.PIX).toBe(20.0);
      expect(summary.session.currentCash).toBe(120.0); // 100 initial + 20 cash
    });
  });

  describe('Finalize Sale from Pre-Sale (finalizeSaleFromPreSale)', () => {
    it('should successfully finalize pre-sale with exact cash payment and confirm physical inventory deduction', () => {
      const pv = preSaleService.createPreSale({
        customerName: 'Cliente Balcão',
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 3 }],
      });

      // Before sale: 50 total, 3 reserved, 47 available
      let batch = inventory.getBatchById(isentoBatchId)!;
      expect(batch.quantity).toBe(50);
      expect(batch.reservedQuantity).toBe(3);
      expect(batch.availableQuantity).toBe(47);

      const saleDetails = posService.finalizeSaleFromPreSale(pv.code, [
        { method: 'DINHEIRO', amount: 30.0 },
      ]);

      expect(saleDetails.sale.id).toBeDefined();
      expect(saleDetails.sale.status).toBe('COMPLETED');
      expect(saleDetails.sale.totalAmount).toBe(30.0);
      expect(saleDetails.sale.changeAmount).toBe(0);
      expect(saleDetails.items).toHaveLength(1);
      expect(saleDetails.items[0].productName).toBe('Dipirona 500mg');
      expect(saleDetails.items[0].batchNumber).toBe('LOTE-ISENTO-01');
      expect(saleDetails.items[0].quantity).toBe(3);
      expect(saleDetails.items[0].totalPrice).toBe(30.0);
      expect(saleDetails.payments).toHaveLength(1);
      expect(saleDetails.payments[0].method).toBe('DINHEIRO');
      expect(saleDetails.payments[0].amount).toBe(30.0);

      // Verify pre-sale status is now CONVERTED_TO_SALE
      const updatedPreSale = preSaleService.getPreSaleByCode(pv.code);
      expect(updatedPreSale?.preSale.status).toBe('CONVERTED_TO_SALE');

      // Verify physical stock deduction: quantity 50 - 3 = 47, reserved 3 - 3 = 0, available = 47
      batch = inventory.getBatchById(isentoBatchId)!;
      expect(batch.quantity).toBe(47);
      expect(batch.reservedQuantity).toBe(0);
      expect(batch.availableQuantity).toBe(47);
    });

    it('should finalize pre-sale with cash payment generating change and update cash session drawer', () => {
      const session = posService.openCashSession('Operador 1', 100.0);

      const pv = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 2 }], // R$ 20.00
      });

      // Customer pays R$ 50.00 in cash, expected change R$ 30.00
      const saleDetails = posService.finalizeSaleFromPreSale(
        pv.code,
        [{ method: 'DINHEIRO', amount: 50.0 }],
        session.id
      );

      expect(saleDetails.sale.totalAmount).toBe(20.0);
      expect(saleDetails.sale.changeAmount).toBe(30.0);
      expect(saleDetails.payments[0].amount).toBe(50.0);

      // Session drawer should increase by net cash: 50 - 30 = 20 (initial 100 + 20 = 120)
      const currentSession = posService.getCurrentSession('Operador 1')!;
      expect(currentSession.currentCash).toBe(120.0);
    });

    it('should finalize pre-sale with split payments (Dinheiro + Cartão) and calculate correct change', () => {
      const session = posService.openCashSession('Operador 1', 200.0);

      const pv = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 4 }], // R$ 40.00
      });

      // Customer pays R$ 25.00 Cartão de Crédito + R$ 20.00 Dinheiro = R$ 45.00 (troco = R$ 5.00)
      const payments: PaymentItem[] = [
        { method: 'CARTAO_CREDITO', amount: 25.0 },
        { method: 'DINHEIRO', amount: 20.0 },
      ];

      const saleDetails = posService.finalizeSaleFromPreSale(pv.code, payments, session.id);

      expect(saleDetails.sale.totalAmount).toBe(40.0);
      expect(saleDetails.sale.changeAmount).toBe(5.0);
      expect(saleDetails.payments).toHaveLength(2);

      // Net cash added to drawer = 20 - 5 = 15 -> drawer = 200 + 15 = 215.00
      const currentSession = posService.getCurrentSession('Operador 1')!;
      expect(currentSession.currentCash).toBe(215.0);
    });

    it('should throw PRE_SALE_NOT_FOUND if pre-sale code does not exist', () => {
      expect(() => {
        posService.finalizeSaleFromPreSale('PV-9999', [{ method: 'DINHEIRO', amount: 50.0 }]);
      }).toThrow('PRE_SALE_NOT_FOUND');
    });

    it('should block finalization of already finalized pre-sale (Review Focus 5: PRE_SALE_ALREADY_CLOSED)', () => {
      const pv = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 1 }],
      });

      // Finalize first time
      posService.finalizeSaleFromPreSale(pv.code, [{ method: 'DINHEIRO', amount: 10.0 }]);

      // Attempt to finalize again
      expect(() => {
        posService.finalizeSaleFromPreSale(pv.code, [{ method: 'DINHEIRO', amount: 10.0 }]);
      }).toThrow('PRE_SALE_ALREADY_CLOSED');
    });

    it('should block finalization of cancelled pre-sale (PRE_SALE_ALREADY_CLOSED)', () => {
      const pv = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 1 }],
      });

      preSaleService.cancelPreSale(pv.code);

      expect(() => {
        posService.finalizeSaleFromPreSale(pv.code, [{ method: 'DINHEIRO', amount: 10.0 }]);
      }).toThrow('PRE_SALE_ALREADY_CLOSED');
    });

    it('should block finalization with empty payments array (NO_PAYMENT_PROVIDED)', () => {
      const pv = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 1 }],
      });

      expect(() => {
        posService.finalizeSaleFromPreSale(pv.code, []);
      }).toThrow('NO_PAYMENT_PROVIDED');
    });

    it('should block payment item with zero or negative amount (INVALID_PAYMENT_AMOUNT)', () => {
      const pv = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 1 }],
      });

      expect(() => {
        posService.finalizeSaleFromPreSale(pv.code, [{ method: 'DINHEIRO', amount: 0 }]);
      }).toThrow('INVALID_PAYMENT_AMOUNT');

      expect(() => {
        posService.finalizeSaleFromPreSale(pv.code, [{ method: 'DINHEIRO', amount: -15.0 }]);
      }).toThrow('INVALID_PAYMENT_AMOUNT');
    });

    it('should block insufficient payment (INSUFFICIENT_PAYMENT)', () => {
      const pv = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 2 }], // R$ 20.00
      });

      expect(() => {
        posService.finalizeSaleFromPreSale(pv.code, [{ method: 'DINHEIRO', amount: 19.99 }]);
      }).toThrow('INSUFFICIENT_PAYMENT');
    });

    it('should block excess payment when non-cash method attempts to generate change (EXCESS_NON_CASH_PAYMENT)', () => {
      const pv = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 2 }], // R$ 20.00
      });

      // Customer tries to swipe card for R$ 30.00 without cash
      expect(() => {
        posService.finalizeSaleFromPreSale(pv.code, [{ method: 'CARTAO_CREDITO', amount: 30.0 }]);
      }).toThrow('EXCESS_NON_CASH_PAYMENT');

      // Customer pays R$ 15.00 card + R$ 10.00 PIX = R$ 25.00 (troco = 5.00, but no DINHEIRO)
      expect(() => {
        posService.finalizeSaleFromPreSale(pv.code, [
          { method: 'CARTAO_CREDITO', amount: 15.0 },
          { method: 'PIX', amount: 10.0 },
        ]);
      }).toThrow('EXCESS_NON_CASH_PAYMENT');

      // Customer pays R$ 20.00 card + R$ 2.00 cash = R$ 22.00 on R$ 20.00 -> change is 2.00, cash is 2.00 -> Allowed!
      const validSale = posService.finalizeSaleFromPreSale(pv.code, [
        { method: 'CARTAO_CREDITO', amount: 20.0 },
        { method: 'DINHEIRO', amount: 2.0 },
      ]);
      expect(validSale.sale.changeAmount).toBe(2.0);
    });

    it('should preserve and return prescription details when finalizing pre-sale with controlled medication', () => {
      const pv = preSaleService.createPreSale({
        customerName: 'Carlos Receita',
        items: [{ productId: controlledProductId, batchId: controlledBatchId, quantity: 2 }],
        prescription: {
          doctorName: 'Dr. Lucas Silva',
          doctorCrm: '654321',
          doctorUf: 'SP',
          prescriptionType: 'B1_AZUL',
          prescriptionDate: '2026-10-31',
          patientName: 'Carlos Receita',
          buyerName: 'Carlos Receita',
          buyerCpf: '111.222.333-44',
        },
      });

      const saleDetails = posService.finalizeSaleFromPreSale(pv.code, [
        { method: 'PIX', amount: 50.0 }, // 2x R$ 25.00 = R$ 50.00
      ]);

      expect(saleDetails.sale.id).toBeDefined();
      expect(saleDetails.prescription).toBeDefined();
      expect(saleDetails.prescription.doctorName).toBe('Dr. Lucas Silva');
      expect(saleDetails.prescription.doctorCrm).toBe('654321');
      expect(saleDetails.prescription.prescriptionType).toBe('B1_AZUL');
      expect(saleDetails.prescription.patientName).toBe('Carlos Receita');

      // Controlled batch physically deducted
      const batch = inventory.getBatchById(controlledBatchId)!;
      expect(batch.quantity).toBe(28); // 30 - 2
      expect(batch.reservedQuantity).toBe(0);
    });

    it('should reject finalizing with non-existent or closed cashSessionId (SESSION_NOT_OPEN)', () => {
      const pv = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 1 }],
      });

      expect(() => {
        posService.finalizeSaleFromPreSale(
          pv.code,
          [{ method: 'DINHEIRO', amount: 10.0 }],
          99999 // Non-existent
        );
      }).toThrow('SESSION_NOT_OPEN');

      const session = posService.openCashSession('Operador 1', 100.0);
      posService.closeCashSession(session.id);

      expect(() => {
        posService.finalizeSaleFromPreSale(
          pv.code,
          [{ method: 'DINHEIRO', amount: 10.0 }],
          session.id // Closed
        );
      }).toThrow('SESSION_NOT_OPEN');
    });

    it('should support direct property access on returned sale details (e.g. sale.id, sale.status)', () => {
      const pv = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 1 }],
      });

      const sale: any = posService.finalizeSaleFromPreSale(pv.code, [
        { method: 'DINHEIRO', amount: 10.0 },
      ]);

      expect(sale.id).toBeDefined();
      expect(sale.status).toBe('COMPLETED');
      expect(sale.changeAmount).toBe(0);
      expect(sale.sale.id).toBe(sale.id);
    });

    it('should rollback transaction if inventory deduction fails', () => {
      const pv = preSaleService.createPreSale({
        items: [{ productId: isentoProductId, batchId: isentoBatchId, quantity: 2 }],
      });

      // Simulate stock issue by directly resetting batch quantity to 0
      db.prepare('UPDATE batches SET quantity = 0, reserved_quantity = 0 WHERE id = ?').run(
        isentoBatchId
      );

      expect(() => {
        posService.finalizeSaleFromPreSale(pv.code, [{ method: 'DINHEIRO', amount: 20.0 }]);
      }).toThrow('INSUFFICIENT_BATCH_STOCK');

      // Pre-sale should remain OPEN
      const preSale = preSaleService.getPreSaleByCode(pv.code)!;
      expect(preSale.preSale.status).toBe('OPEN');

      // No sales or sale_items should have been persisted
      const salesCount = (
        db.prepare('SELECT count(*) as count FROM sales').get() as { count: number }
      ).count;
      expect(salesCount).toBe(0);
    });
  });
});
