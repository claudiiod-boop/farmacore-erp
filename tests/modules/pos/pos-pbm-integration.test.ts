import { describe, it, expect, beforeEach } from 'vitest';
import { Database, getDatabase } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CatalogService } from '../../../src/modules/catalog/catalog.service';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';
import { PreSaleService } from '../../../src/modules/counter/pre-sale.service';
import { PosService } from '../../../src/modules/pos/pos.service';
import { PbmService } from '../../../src/modules/pbm/pbm.service';

describe('PDV & PBM Integration (CONVENIO_PBM Payment & Cash Closure)', () => {
  let db: Database;
  let catalog: CatalogService;
  let inventory: InventoryService;
  let preSaleService: PreSaleService;
  let posService: PosService;
  let pbmService: PbmService;

  let productId1: number;
  let batchId1: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    catalog = new CatalogService(db);
    inventory = new InventoryService(db);
    preSaleService = new PreSaleService(db, catalog, inventory);
    pbmService = new PbmService(db);
    posService = new PosService(db, preSaleService, inventory, undefined, pbmService);

    const product = catalog.createProduct({
      ean: '7896004701234',
      name: 'Losartana Potássica 50mg',
      activeIngredient: 'Losartana Potássica',
      msRegistration: '1004300010012',
      stripe: 'SEM_TARJA',
      controlType: 'ISENTO',
      pmc: 20.0,
      pf: 15.0,
      price: 20.0,
    });
    productId1 = product.id;

    const batch = inventory.addBatch({
      productId: productId1,
      batchNumber: 'LOTE-LOSARTANA-01',
      manufacturingDate: '2026-01-01',
      expirationDate: '2028-12-31',
      quantity: 100,
    });
    batchId1 = batch.id;
  });

  it('should allow checkout with split payment: CONVENIO_PBM (subsidy) + DINHEIRO (copay)', async () => {
    const session = posService.openCashSession('Operador Caixa 1', 100.0);

    // Total = 40.0 (2 x 20.0)
    // PBM subsidy: 36.00, Copay in cash: 4.00
    const saleDetails = await posService.checkout({
      cashSessionId: session.id,
      additionalItems: [{ productId: productId1, batchId: batchId1, quantity: 2 }],
      payments: [
        { method: 'CONVENIO_PBM' as any, amount: 36.0 },
        { method: 'DINHEIRO', amount: 4.0 },
      ],
    });

    expect(saleDetails.sale.id).toBeDefined();
    expect(saleDetails.sale.status).toBe('COMPLETED');
    expect(saleDetails.sale.totalAmount).toBe(40.0);
    expect(saleDetails.sale.changeAmount).toBe(0);
    expect(saleDetails.payments).toHaveLength(2);
    expect(saleDetails.payments.find((p) => p.method === 'CONVENIO_PBM')?.amount).toBe(36.0);
    expect(saleDetails.payments.find((p) => p.method === 'DINHEIRO')?.amount).toBe(4.0);

    const sessionSummary = posService.getSessionSummary(session.id);
    expect(sessionSummary.session.currentCash).toBe(104.0); // 100 + 4 cash
    expect(sessionSummary.expectedCash).toBe(104.0);
    expect(sessionSummary.totalsByMethod.CONVENIO_PBM).toBe(36.0);
    expect(sessionSummary.totalsByMethod.DINHEIRO).toBe(4.0);
  });

  it('should prevent change generation from CONVENIO_PBM amount', async () => {
    const session = posService.openCashSession('Operador Caixa 1', 100.0);

    // Total = 20.0 (1 x 20.0)
    // Paying with CONVENIO_PBM: 25.0 (excess non-cash payment)
    expect(() =>
      posService.checkout({
        cashSessionId: session.id,
        additionalItems: [{ productId: productId1, batchId: batchId1, quantity: 1 }],
        payments: [{ method: 'CONVENIO_PBM' as any, amount: 25.0 }],
      })
    ).toThrow('EXCESS_NON_CASH_PAYMENT');

    // Also with split where excess is covered by cash: Total 20.0, CONVENIO_PBM 15.0, DINHEIRO 10.0 (totalPaid 25.0, change 5.0, cash 10.0 >= 5.0 -> allowed)
    const validSale = await posService.checkout({
      cashSessionId: session.id,
      additionalItems: [{ productId: productId1, batchId: batchId1, quantity: 1 }],
      payments: [
        { method: 'CONVENIO_PBM' as any, amount: 15.0 },
        { method: 'DINHEIRO', amount: 10.0 },
      ],
    });
    expect(validSale.sale.changeAmount).toBe(5.0);

    // But if CONVENIO_PBM is 22.0 and DINHEIRO is 0.0 -> totalPaid 22.0, change 2.0, cash 0 < 2 -> EXCESS_NON_CASH_PAYMENT
    expect(() =>
      posService.checkout({
        cashSessionId: session.id,
        additionalItems: [{ productId: productId1, batchId: batchId1, quantity: 1 }],
        payments: [{ method: 'CONVENIO_PBM' as any, amount: 22.0 }],
      })
    ).toThrow('EXCESS_NON_CASH_PAYMENT');
  });

  it('should not add CONVENIO_PBM to physical cash drawer in calculateSessionSummary', async () => {
    const session = posService.openCashSession('Operador Caixa 1', 100.0);

    // Sale 1: 100% PBM (subsidy: 20.00, copay: 0)
    await posService.checkout({
      cashSessionId: session.id,
      additionalItems: [{ productId: productId1, batchId: batchId1, quantity: 1 }],
      payments: [{ method: 'CONVENIO_PBM' as any, amount: 20.0 }],
    });

    const summary = posService.closeCashSession(session.id);
    expect(summary.totalSalesCount).toBe(1);
    expect(summary.totalSalesAmount).toBe(20.0);
    expect(summary.totalsByMethod.CONVENIO_PBM).toBe(20.0);
    expect(summary.totalsByMethod.DINHEIRO).toBe(0);
    // Drawer must remain exactly 100.0 (CONVENIO_PBM is receivable credit, NOT physical cash)
    expect(summary.session.currentCash).toBe(100.0);
    expect(summary.expectedCash).toBe(100.0);
  });

  it('should automatically confirm PBM transaction upon checkout completion', async () => {
    const session = posService.openCashSession('Operador Caixa 1', 100.0);

    // Prepara autorização no PbmService
    const authResult = await pbmService.authorize({
      providerId: 'FARMACIA_POPULAR',
      patientCpf: '12345678909',
      patientName: 'Maria dos Santos',
      doctorCrm: '123456',
      doctorUf: 'SP',
      prescriptionDate: '2026-11-01',
      items: [
        {
          productId: productId1,
          ean: '7896004701234',
          msRegistration: '1004300010012',
          productName: 'Losartana Potássica 50mg',
          quantity: 1,
          unitPrice: 20.0,
        },
      ],
    });

    expect(authResult.success).toBe(true);
    const protocol = authResult.authorizationProtocol!;
    expect(protocol).toBeDefined();

    // Verifica que a transação está como AUTHORIZED
    const txBefore = pbmService.getTransactionByProtocol(protocol);
    expect(txBefore?.transaction.status).toBe('AUTHORIZED');
    expect(txBefore?.transaction.saleId).toBeNull();

    // Executa o checkout informando o pbmProtocol
    const saleDetails = await posService.checkout({
      cashSessionId: session.id,
      additionalItems: [{ productId: productId1, batchId: batchId1, quantity: 1 }],
      payments: [{ method: 'CONVENIO_PBM' as any, amount: 20.0 }],
      pbmProtocol: protocol,
    });

    expect(saleDetails.sale.id).toBeDefined();

    // Verifica que a transação foi confirmada e vinculada ao saleId
    const txAfter = pbmService.getTransactionByProtocol(protocol);
    expect(txAfter?.transaction.status).toBe('CONFIRMED');
    expect(txAfter?.transaction.saleId).toBe(saleDetails.sale.id);
    expect(txAfter?.transaction.receiptNumber).toBeDefined();
    expect(txAfter?.transaction.confirmedAt).toBeDefined();
  });
});
