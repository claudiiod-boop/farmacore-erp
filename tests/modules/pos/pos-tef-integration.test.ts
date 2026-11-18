import { describe, it, expect, beforeEach } from 'vitest';
import { Database, getDatabase } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CatalogService } from '../../../src/modules/catalog/catalog.service';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';
import { PreSaleService } from '../../../src/modules/counter/pre-sale.service';
import { PosService } from '../../../src/modules/pos/pos.service';
import { TefService } from '../../../src/modules/tef/tef.service';
import { CashSession } from '../../../src/modules/pos/types';

describe('POS Checkout with TEF Integration', () => {
  let db: Database;
  let catalog: CatalogService;
  let inventory: InventoryService;
  let preSaleService: PreSaleService;
  let tefService: TefService;
  let posService: PosService;

  let productId: number;
  let batchId: number;
  let openSession: CashSession;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);

    catalog = new CatalogService(db);
    inventory = new InventoryService(db);
    preSaleService = new PreSaleService(db, catalog, inventory);
    tefService = new TefService(db);
    posService = new PosService(db, preSaleService, inventory, undefined, undefined, tefService);

    const product = catalog.createProduct({
      ean: '7891234567890',
      name: 'Vitamina C 1g 30 Comprimidos Efervescentes',
      activeIngredient: 'Ácido Ascórbico',
      msRegistration: '100000000001',
      stripe: 'SEM_TARJA',
      controlType: 'ISENTO',
      pmc: 35.0,
      pf: 20.0,
      price: 25.0,
    });
    productId = product.id;

    const batch = inventory.addBatch({
      productId,
      batchNumber: 'LOTE-VITC-01',
      manufacturingDate: '2026-01-01',
      expirationDate: '2028-12-31',
      quantity: 50,
    });
    batchId = batch.id;

    openSession = posService.openCashSession('Operador Caixa 1', 100.0);
  });

  it('should complete checkout with TEF payment, link transaction and confirm automatically', async () => {
    // 1. Autorização PinPad via TefService (2 x 25.00 = 50.00)
    const tefPayResult = await tefService.pay({
      operationType: 'CREDITO',
      amount: 50.0,
      installments: 1,
      terminalId: 'SE000001',
    });

    expect(tefPayResult.success).toBe(true);
    expect(tefPayResult.nsu).toBeDefined();

    const authorizedTx = tefService.getTransactionByNsu(tefPayResult.nsu);
    expect(authorizedTx).not.toBeNull();
    expect(authorizedTx!.status).toBe('AUTHORIZED');
    expect(authorizedTx!.saleId).toBeNull();
    expect(authorizedTx!.paymentId).toBeNull();

    // 2. Checkout no PDV com pagamento TEF
    const saleDetails = await posService.checkout({
      cashSessionId: openSession.id,
      additionalItems: [{ productId, batchId, quantity: 2 }],
      payments: [
        {
          method: 'CARTAO_CREDITO',
          amount: 50.0,
          tefTransactionUuid: authorizedTx!.transactionUuid,
          tefNsu: authorizedTx!.nsu,
          cardFiscalData: {
            tpIntegra: 1,
            cnpj: authorizedTx!.acquirerCnpj,
            tBand: authorizedTx!.brandCodeSefaz,
            cAut: authorizedTx!.authorizationCode,
          },
        },
      ],
    });

    expect(saleDetails.sale.id).toBeDefined();
    expect(saleDetails.sale.status).toBe('COMPLETED');
    expect(saleDetails.sale.totalAmount).toBe(50.0);

    // 3. Transação TEF deve ter sido confirmada automaticamente
    const confirmedTx = tefService.getTransactionByNsu(tefPayResult.nsu);
    expect(confirmedTx).not.toBeNull();
    expect(confirmedTx!.status).toBe('CONFIRMED');
    expect(confirmedTx!.saleId).toBe(saleDetails.sale.id);
    expect(confirmedTx!.paymentId).toBe(saleDetails.payments[0].id);
  });

  it('should record tef_transaction_id and tef_nsu in sale_payments', async () => {
    const tefPayResult = await tefService.pay({
      operationType: 'DEBITO',
      amount: 25.0,
      terminalId: 'SE000001',
    });

    const tx = tefService.getTransactionByNsu(tefPayResult.nsu)!;

    const saleDetails = await posService.checkout({
      cashSessionId: openSession.id,
      additionalItems: [{ productId, batchId, quantity: 1 }],
      payments: [
        {
          method: 'CARTAO_DEBITO',
          amount: 25.0,
          tefNsu: tx.nsu,
          tefTransactionUuid: tx.transactionUuid,
        },
      ],
    });

    expect(saleDetails.payments).toHaveLength(1);
    expect(saleDetails.payments[0].method).toBe('CARTAO_DEBITO');
    expect(saleDetails.payments[0].amount).toBe(25.0);
    expect(saleDetails.payments[0].tefTransactionId).toBe(tx.id);
    expect(saleDetails.payments[0].tefNsu).toBe(tx.nsu);

    // Conferência direta no banco de dados SQLite
    const row = db
      .prepare<{ tef_transaction_id: number; tef_nsu: string }>(
        'SELECT tef_transaction_id, tef_nsu FROM sale_payments WHERE id = ?'
      )
      .get(saleDetails.payments[0].id);

    expect(row).toBeDefined();
    expect(row!.tef_transaction_id).toBe(tx.id);
    expect(row!.tef_nsu).toBe(tx.nsu);
  });

  it('should automatically undo TEF transaction if checkout transaction fails', async () => {
    // 1. Autoriza o cartão do cliente no PinPad
    const tefPayResult = await tefService.pay({
      operationType: 'CREDITO',
      amount: 25.0,
      terminalId: 'SE000001',
    });

    const tx = tefService.getTransactionByNsu(tefPayResult.nsu)!;
    expect(tx.status).toBe('AUTHORIZED');

    // 2. Checkout falha intencionalmente (ex: estoque insuficiente ou sessão fechada)
    await expect(
      posService.checkout({
        cashSessionId: openSession.id,
        additionalItems: [{ productId, batchId, quantity: 9999 }], // estoque insuficiente!
        payments: [
          {
            method: 'CARTAO_CREDITO',
            amount: 25.0,
            tefNsu: tx.nsu,
            tefTransactionUuid: tx.transactionUuid,
          },
        ],
      })
    ).rejects.toThrow('INSUFFICIENT_BATCH_STOCK');

    // 3. A transação TEF deve ter sido desfeita (status = REVERSED) com motivo FALHA_CHECKOUT_PDV
    const reversedTx = tefService.getTransactionByNsu(tx.nsu)!;
    expect(reversedTx.status).toBe('REVERSED');
    expect(reversedTx.reversalReason).toBe('FALHA_CHECKOUT_PDV');
    expect(reversedTx.reversedAt).toBeDefined();
  });

  it('should support setTefService method and split payment with cash and TEF', async () => {
    // Instanciar PosService sem tefService no construtor
    const newPos = new PosService(db, preSaleService, inventory);
    newPos.setTefService(tefService);

    const tefPayResult = await tefService.pay({
      operationType: 'DEBITO',
      amount: 30.0,
      terminalId: 'SE000001',
    });

    const tx = tefService.getTransactionByNsu(tefPayResult.nsu)!;

    // Total = 50.0 (2 x 25.0). Pago 30.0 no cartão TEF + 20.0 em dinheiro
    const saleDetails = await newPos.checkout({
      cashSessionId: openSession.id,
      additionalItems: [{ productId, batchId, quantity: 2 }],
      payments: [
        {
          method: 'CARTAO_DEBITO',
          amount: 30.0,
          tefNsu: tx.nsu,
          tefTransactionUuid: tx.transactionUuid,
        },
        {
          method: 'DINHEIRO',
          amount: 20.0,
        },
      ],
    });

    expect(saleDetails.sale.id).toBeDefined();
    expect(saleDetails.payments).toHaveLength(2);

    const cardPay = saleDetails.payments.find((p) => p.method === 'CARTAO_DEBITO')!;
    expect(cardPay.tefTransactionId).toBe(tx.id);
    expect(cardPay.tefNsu).toBe(tx.nsu);

    const cashPay = saleDetails.payments.find((p) => p.method === 'DINHEIRO')!;
    expect(cashPay.tefTransactionId).toBeNull();
    expect(cashPay.tefNsu).toBeNull();

    const confirmedTx = tefService.getTransactionByNsu(tx.nsu)!;
    expect(confirmedTx.status).toBe('CONFIRMED');
  });
});
