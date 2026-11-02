import { describe, it, expect, beforeEach } from 'vitest';
import { Database, getDatabase } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CatalogService } from '../../../src/modules/catalog/catalog.service';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';
import { PreSaleService } from '../../../src/modules/counter/pre-sale.service';
import { PosService } from '../../../src/modules/pos/pos.service';

describe('PosService - Movimentações de Caixa (Sangria & Suprimento)', () => {
  let db: Database;
  let catalog: CatalogService;
  let inventory: InventoryService;
  let preSaleService: PreSaleService;
  let posService: PosService;

  let testProductId: number;
  let testBatchId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    catalog = new CatalogService(db);
    inventory = new InventoryService(db);
    preSaleService = new PreSaleService(db, catalog, inventory);
    posService = new PosService(db, preSaleService, inventory);

    const product = catalog.createProduct({
      ean: '7891234567890',
      name: 'Vitamina C 1g',
      activeIngredient: 'Ácido Ascórbico',
      msRegistration: '100000000002',
      stripe: 'SEM_TARJA',
      controlType: 'ISENTO',
      pmc: 25.0,
      pf: 15.0,
      price: 20.0,
    });
    testProductId = product.id;

    const batch = inventory.addBatch({
      productId: testProductId,
      batchNumber: 'LOTE-TEST-01',
      manufacturingDate: '2026-01-01',
      expirationDate: '2028-12-31',
      quantity: 100,
    });
    testBatchId = batch.id;
  });

  it('deve registrar suprimento (SUPPLY) e incrementar current_cash da sessão', () => {
    const session = posService.openCashSession('Operador Caixa 1', 100.0);
    expect(session.currentCash).toBe(100.0);

    const movement = posService.registerCashMovement(
      session.id,
      'SUPPLY',
      50.0,
      'Aporte inicial de moedas para troco',
      'Operador Caixa 1'
    );

    expect(movement).toBeDefined();
    expect(movement.id).toBeGreaterThan(0);
    expect(movement.cashSessionId).toBe(session.id);
    expect(movement.type).toBe('SUPPLY');
    expect(movement.amount).toBe(50.0);
    expect(movement.reason).toBe('Aporte inicial de moedas para troco');
    expect(movement.operatorName).toBe('Operador Caixa 1');
    expect(movement.createdAt).toBeDefined();

    const currentSession = posService.getCurrentSession('Operador Caixa 1');
    expect(currentSession?.currentCash).toBe(150.0);
  });

  it('deve registrar sangria (SANGRIA) e decrementar current_cash da sessão', () => {
    const session = posService.openCashSession('Operador Caixa 1', 200.0);

    const movement = posService.registerCashMovement(
      session.id,
      'SANGRIA',
      80.0,
      'Sangria de segurança para o cofre',
      'Operador Caixa 1'
    );

    expect(movement.type).toBe('SANGRIA');
    expect(movement.amount).toBe(80.0);

    const currentSession = posService.getCurrentSession('Operador Caixa 1');
    expect(currentSession?.currentCash).toBe(120.0);
  });

  it('deve lançar erro INSUFFICIENT_DRAWER_CASH se sangria exceder saldo em dinheiro na gaveta', () => {
    const session = posService.openCashSession('Operador Caixa 1', 100.0);

    expect(() => {
      posService.registerCashMovement(
        session.id,
        'SANGRIA',
        100.01,
        'Retirada maior que saldo',
        'Operador Caixa 1'
      );
    }).toThrow('INSUFFICIENT_DRAWER_CASH');

    const currentSession = posService.getCurrentSession('Operador Caixa 1');
    expect(currentSession?.currentCash).toBe(100.0);
  });

  it('deve bloquear movimentações em sessões encerradas com SESSION_NOT_OPEN', () => {
    const session = posService.openCashSession('Operador Caixa 1', 100.0);
    posService.closeCashSession(session.id);

    expect(() => {
      posService.registerCashMovement(
        session.id,
        'SUPPLY',
        50.0,
        'Aporte pós-fechamento',
        'Operador Caixa 1'
      );
    }).toThrow('SESSION_NOT_OPEN');

    expect(() => {
      posService.registerCashMovement(
        99999,
        'SANGRIA',
        10.0,
        'Sessão inexistente',
        'Operador Caixa 1'
      );
    }).toThrow('SESSION_NOT_OPEN');
  });

  it('deve validar valores inválidos de amount com INVALID_AMOUNT', () => {
    const session = posService.openCashSession('Operador Caixa 1', 100.0);

    expect(() => {
      posService.registerCashMovement(
        session.id,
        'SUPPLY',
        0,
        'Valor zero',
        'Operador Caixa 1'
      );
    }).toThrow('INVALID_AMOUNT');

    expect(() => {
      posService.registerCashMovement(
        session.id,
        'SUPPLY',
        -25.0,
        'Valor negativo',
        'Operador Caixa 1'
      );
    }).toThrow('INVALID_AMOUNT');

    expect(() => {
      posService.registerCashMovement(
        session.id,
        'SUPPLY',
        NaN,
        'Valor NaN',
        'Operador Caixa 1'
      );
    }).toThrow('INVALID_AMOUNT');
  });

  it('deve exigir motivo preenchido com INVALID_REASON', () => {
    const session = posService.openCashSession('Operador Caixa 1', 100.0);

    expect(() => {
      posService.registerCashMovement(
        session.id,
        'SUPPLY',
        50.0,
        '',
        'Operador Caixa 1'
      );
    }).toThrow('INVALID_REASON');

    expect(() => {
      posService.registerCashMovement(
        session.id,
        'SUPPLY',
        50.0,
        '   ',
        'Operador Caixa 1'
      );
    }).toThrow('INVALID_REASON');
  });

  it('deve exigir operador preenchido com INVALID_OPERATOR', () => {
    const session = posService.openCashSession('Operador Caixa 1', 100.0);

    expect(() => {
      posService.registerCashMovement(
        session.id,
        'SUPPLY',
        50.0,
        'Motivo válido',
        ''
      );
    }).toThrow('INVALID_OPERATOR');

    expect(() => {
      posService.registerCashMovement(
        session.id,
        'SUPPLY',
        50.0,
        'Motivo válido',
        '   '
      );
    }).toThrow('INVALID_OPERATOR');
  });

  it('deve listar todas as movimentações da sessão via getCashMovements', () => {
    const session = posService.openCashSession('Operador Caixa 1', 100.0);

    expect(posService.getCashMovements(session.id)).toEqual([]);

    posService.registerCashMovement(
      session.id,
      'SUPPLY',
      50.0,
      'Aporte moedas',
      'Operador Caixa 1'
    );
    posService.registerCashMovement(
      session.id,
      'SANGRIA',
      30.0,
      'Sangria gaveta',
      'Operador Caixa 1'
    );

    const movements = posService.getCashMovements(session.id);
    expect(movements).toHaveLength(2);
    expect(movements[0].type).toBe('SUPPLY');
    expect(movements[0].amount).toBe(50.0);
    expect(movements[1].type).toBe('SANGRIA');
    expect(movements[1].amount).toBe(30.0);
  });

  it('deve enriquecer closeCashSession com totalSupplies, totalSangrias e expectedCash', () => {
    const session = posService.openCashSession('Operador Caixa 1', 100.0);

    posService.registerCashMovement(
      session.id,
      'SUPPLY',
      40.0,
      'Troco moedas',
      'Operador Caixa 1'
    );
    posService.registerCashMovement(
      session.id,
      'SANGRIA',
      25.0,
      'Retirada cofre',
      'Operador Caixa 1'
    );

    // Make a sale with cash payment: 20.00
    const preSale = preSaleService.createPreSale({
      customerName: 'Cliente Balcao',
      items: [{ productId: testProductId, batchId: testBatchId, quantity: 1 }],
    });

    posService.finalizeSaleFromPreSale(
      preSale.code,
      [{ method: 'DINHEIRO', amount: 20.0 }],
      session.id
    );

    const summary = posService.closeCashSession(session.id);

    // Initial 100 + Supply 40 - Sangria 25 + Cash sale 20 = 135
    expect(summary.totalSupplies).toBe(40.0);
    expect(summary.totalSangrias).toBe(25.0);
    expect(summary.totalsByMethod.DINHEIRO).toBe(20.0);
    expect(summary.expectedCash).toBe(135.0);
    expect(summary.session.currentCash).toBe(135.0);
    expect(summary.session.status).toBe('CLOSED');
  });
});
