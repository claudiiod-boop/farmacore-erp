import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { TransferService } from '../../../src/modules/transfers/transfer.service';
import { StoreService } from '../../../src/modules/stores/store.service';
import type { CreateStoreInput } from '../../../src/modules/stores/types';

describe('TransferService', () => {
  let db: Database;
  let service: TransferService;
  let storeService: StoreService;

  let storeMatrizId: number; // SP
  let storeFilialSPId: number; // SP
  let storeFilialRJId: number; // RJ
  let productId1: number;
  let productId2: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new TransferService(db);
    storeService = new StoreService(db);

    // Store 1 is Matriz in SP (seeded by migration 008)
    storeMatrizId = 1;

    // Create a branch in SP (Intrastate)
    const storeSPInput: CreateStoreInput = {
      code: 'LJ02',
      name: 'FarmaCore Filial Campinas',
      companyName: 'Drogaria FarmaCore Ltda',
      cnpj: '12.345.678/0002-71',
      ie: '123456780',
      isHeadquarters: false,
      street: 'Av. Brasil',
      number: '500',
      neighborhood: 'Guanabara',
      city: 'Campinas',
      state: 'SP',
      zipCode: '13070-178',
      ibgeCode: '3509502',
      taxRegime: 'SIMPLES_NACIONAL',
      isActive: true,
    };
    const filialSP = storeService.createStore(storeSPInput);
    storeFilialSPId = filialSP.id;

    // Create a branch in RJ (Interstate)
    const storeRJInput: CreateStoreInput = {
      code: 'LJ03',
      name: 'FarmaCore Filial Copacabana',
      companyName: 'Drogaria FarmaCore RJ Ltda',
      cnpj: '12.345.678/0003-52',
      ie: '987654321',
      isHeadquarters: false,
      street: 'Av. Atlântica',
      number: '1200',
      neighborhood: 'Copacabana',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zipCode: '22070-000',
      ibgeCode: '3304557',
      taxRegime: 'SIMPLES_NACIONAL',
      isActive: true,
    };
    const filialRJ = storeService.createStore(storeRJInput);
    storeFilialRJId = filialRJ.id;

    // Create test products
    const prodStmt = db.prepare(`
      INSERT INTO products (
        ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const p1 = prodStmt.run(
      '7891234567890',
      'Amoxicilina 500mg 21 cápsulas',
      'Amoxicilina',
      '100000001',
      'VERMELHA',
      'ANTIBIOTICO',
      35.0,
      18.5,
      25.0
    );
    productId1 = Number(p1.lastInsertRowid);

    const p2 = prodStmt.run(
      '7899876543210',
      'Dipirona Sódica 500mg 10 comprimidos',
      'Dipirona Sódica',
      '100000002',
      'SEM_TARJA',
      'LIBERADO',
      12.0,
      4.2,
      8.0
    );
    productId2 = Number(p2.lastInsertRowid);
  });

  afterEach(() => {
    db.close();
  });

  // Helper to create a batch in batches table
  function createBatch(params: {
    storeId: number;
    productId: number;
    batchNumber: string;
    manufacturingDate: string;
    expirationDate: string;
    quantity: number;
    reservedQuantity?: number;
  }): number {
    const stmt = db.prepare(`
      INSERT INTO batches (store_id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      params.storeId,
      params.productId,
      params.batchNumber,
      params.manufacturingDate,
      params.expirationDate,
      params.quantity,
      params.reservedQuantity || 0
    );
    return Number(res.lastInsertRowid);
  }

  describe('createTransfer', () => {
    it('should create a draft transfer and generate sequential transfer number TRF-YYYYMMDD-XXXX', () => {
      const transfer1 = service.createTransfer({
        sourceStoreId: storeMatrizId,
        targetStoreId: storeFilialSPId,
        requestedBy: 'Carlos Gerente',
        notes: 'Transferência semanal para Filial Campinas',
        items: [
          {
            productId: productId1,
            requestedQuantity: 20,
          },
        ],
      });

      expect(transfer1).toBeDefined();
      expect(transfer1.id).toBeGreaterThan(0);
      expect(transfer1.status).toBe('DRAFT');
      expect(transfer1.requestedBy).toBe('Carlos Gerente');
      expect(transfer1.sourceStoreId).toBe(storeMatrizId);
      expect(transfer1.targetStoreId).toBe(storeFilialSPId);
      expect(transfer1.items.length).toBe(1);
      expect(transfer1.items[0].productId).toBe(productId1);
      expect(transfer1.items[0].requestedQuantity).toBe(20);
      expect(transfer1.items[0].unitCost).toBe(18.5); // resolved from products.pf
      expect(transfer1.items[0].totalCost).toBe(20 * 18.5);

      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      expect(transfer1.transferNumber).toBe(`TRF-${todayStr}-0001`);

      // Second transfer should have sequential number 0002
      const transfer2 = service.createTransfer({
        sourceStoreId: storeMatrizId,
        targetStoreId: storeFilialRJId,
        requestedBy: 'Ana Supervisora',
        items: [
          {
            productId: productId2,
            requestedQuantity: 15,
            unitCost: 5.0, // explicit unitCost
          },
        ],
      });
      expect(transfer2.transferNumber).toBe(`TRF-${todayStr}-0002`);
      expect(transfer2.items[0].unitCost).toBe(5.0);
      expect(transfer2.items[0].totalCost).toBe(75.0);
    });

    it('should reject creation when source and target stores are the same', () => {
      expect(() => {
        service.createTransfer({
          sourceStoreId: storeMatrizId,
          targetStoreId: storeMatrizId,
          requestedBy: 'Operador',
          items: [{ productId: productId1, requestedQuantity: 5 }],
        });
      }).toThrow(/mesma loja|iguais/i);
    });

    it('should reject creation when source or target store does not exist or is inactive', () => {
      expect(() => {
        service.createTransfer({
          sourceStoreId: 9999,
          targetStoreId: storeFilialSPId,
          requestedBy: 'Operador',
          items: [{ productId: productId1, requestedQuantity: 5 }],
        });
      }).toThrow(/origem/i);

      // Inactivate filial SP
      db.prepare('UPDATE stores SET is_active = 0 WHERE id = ?').run(storeFilialSPId);

      expect(() => {
        service.createTransfer({
          sourceStoreId: storeMatrizId,
          targetStoreId: storeFilialSPId,
          requestedBy: 'Operador',
          items: [{ productId: productId1, requestedQuantity: 5 }],
        });
      }).toThrow(/destino/i);
    });

    it('should reject creation when items array is empty or quantity is <= 0', () => {
      expect(() => {
        service.createTransfer({
          sourceStoreId: storeMatrizId,
          targetStoreId: storeFilialSPId,
          requestedBy: 'Operador',
          items: [],
        });
      }).toThrow(/ao menos um item/i);

      expect(() => {
        service.createTransfer({
          sourceStoreId: storeMatrizId,
          targetStoreId: storeFilialSPId,
          requestedBy: 'Operador',
          items: [{ productId: productId1, requestedQuantity: 0 }],
        });
      }).toThrow(/maior que zero/i);
    });
  });

  describe('dispatchTransfer', () => {
    it('should dispatch transfer with FEFO stock deduction and intrastate CFOP 5152', () => {
      // Create two batches in source store (storeMatrizId) for productId1:
      // Batch 1: expires 2027-01-15, qty = 10
      // Batch 2: expires 2027-06-30, qty = 30
      const b1 = createBatch({
        storeId: storeMatrizId,
        productId: productId1,
        batchNumber: 'LOTE-FEFO-01',
        manufacturingDate: '2025-01-15',
        expirationDate: '2027-01-15',
        quantity: 10,
      });

      const b2 = createBatch({
        storeId: storeMatrizId,
        productId: productId1,
        batchNumber: 'LOTE-FEFO-02',
        manufacturingDate: '2025-06-30',
        expirationDate: '2027-06-30',
        quantity: 30,
      });

      const transfer = service.createTransfer({
        sourceStoreId: storeMatrizId,
        targetStoreId: storeFilialSPId, // SP -> SP (Intrastate)
        requestedBy: 'Operador Origem',
        items: [{ productId: productId1, requestedQuantity: 25 }],
      });

      const dispatched = service.dispatchTransfer(transfer.id, 'Expedidor João', {
        carrierName: 'Transportes Rápidos',
        trackingCode: 'TR-998877',
      });

      expect(dispatched.status).toBe('IN_TRANSIT');
      expect(dispatched.dispatchedBy).toBe('Expedidor João');
      expect(dispatched.dispatchedAt).toBeDefined();
      expect(dispatched.carrierName).toBe('Transportes Rápidos');
      expect(dispatched.trackingCode).toBe('TR-998877');
      expect(dispatched.cfop).toBe('5152'); // SP to SP

      // Verify FEFO stock deduction in source batches:
      // First batch (b1, 10 units) should be fully consumed (quantity = 0)
      // Second batch (b2, 30 units) should have 15 deducted (quantity = 15)
      const b1After = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(b1) as { quantity: number };
      const b2After = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(b2) as { quantity: number };
      expect(b1After.quantity).toBe(0);
      expect(b2After.quantity).toBe(15);

      // Verify transfer items records: total shippedQuantity = 25
      const totalShipped = dispatched.items.reduce((sum, item) => sum + item.shippedQuantity, 0);
      expect(totalShipped).toBe(25);
    });

    it('should set interstate CFOP 6152 when source and target are in different states', () => {
      createBatch({
        storeId: storeMatrizId,
        productId: productId2,
        batchNumber: 'LOTE-DIP-01',
        manufacturingDate: '2025-01-01',
        expirationDate: '2028-01-01',
        quantity: 50,
      });

      const transfer = service.createTransfer({
        sourceStoreId: storeMatrizId, // SP
        targetStoreId: storeFilialRJId, // RJ
        requestedBy: 'Operador Rio',
        items: [{ productId: productId2, requestedQuantity: 10 }],
      });

      const dispatched = service.dispatchTransfer(transfer.id, 'Expedidor Rio');
      expect(dispatched.cfop).toBe('6152'); // SP to RJ
      expect(dispatched.status).toBe('IN_TRANSIT');
    });

    it('should fail dispatch when available stock in source store is insufficient', () => {
      createBatch({
        storeId: storeMatrizId,
        productId: productId1,
        batchNumber: 'LOTE-LOW-01',
        manufacturingDate: '2025-01-01',
        expirationDate: '2027-01-01',
        quantity: 5,
        reservedQuantity: 2, // available = 3
      });

      const transfer = service.createTransfer({
        sourceStoreId: storeMatrizId,
        targetStoreId: storeFilialSPId,
        requestedBy: 'Operador',
        items: [{ productId: productId1, requestedQuantity: 10 }],
      });

      expect(() => {
        service.dispatchTransfer(transfer.id, 'Expedidor');
      }).toThrow(/insuficiente/i);

      // Status should remain DRAFT
      const current = service.getTransferById(transfer.id);
      expect(current?.status).toBe('DRAFT');
    });

    it('should reject dispatch if transfer is already IN_TRANSIT or CANCELLED', () => {
      createBatch({
        storeId: storeMatrizId,
        productId: productId2,
        batchNumber: 'LOTE-01',
        manufacturingDate: '2025-01-01',
        expirationDate: '2028-01-01',
        quantity: 50,
      });

      const transfer = service.createTransfer({
        sourceStoreId: storeMatrizId,
        targetStoreId: storeFilialSPId,
        requestedBy: 'Operador',
        items: [{ productId: productId2, requestedQuantity: 10 }],
      });

      service.dispatchTransfer(transfer.id, 'Expedidor 1');

      expect(() => {
        service.dispatchTransfer(transfer.id, 'Expedidor 2');
      }).toThrow(/status atual/i);
    });
  });

  describe('receiveTransfer', () => {
    it('should receive transfer and incorporate items into target store batches', () => {
      createBatch({
        storeId: storeMatrizId,
        productId: productId1,
        batchNumber: 'LOTE-REC-01',
        manufacturingDate: '2025-01-01',
        expirationDate: '2027-12-31',
        quantity: 40,
      });

      const transfer = service.createTransfer({
        sourceStoreId: storeMatrizId,
        targetStoreId: storeFilialSPId,
        requestedBy: 'Solicitante SP',
        items: [{ productId: productId1, requestedQuantity: 15 }],
      });

      service.dispatchTransfer(transfer.id, 'Despachante');

      // Before receive: target store has 0 batches for productId1
      const targetBatchesBefore = db
        .prepare('SELECT * FROM batches WHERE store_id = ? AND product_id = ?')
        .all(storeFilialSPId, productId1);
      expect(targetBatchesBefore.length).toBe(0);

      const received = service.receiveTransfer(transfer.id, 'Farmacêutico Marcos');

      expect(received.status).toBe('RECEIVED');
      expect(received.receivedBy).toBe('Farmacêutico Marcos');
      expect(received.receivedAt).toBeDefined();
      expect(received.items[0].receivedQuantity).toBe(15);

      // After receive: target store now has a batch with exact details
      const targetBatchesAfter = db
        .prepare('SELECT * FROM batches WHERE store_id = ? AND product_id = ?')
        .all(storeFilialSPId, productId1) as any[];
      expect(targetBatchesAfter.length).toBe(1);
      expect(targetBatchesAfter[0].batch_number).toBe('LOTE-REC-01');
      expect(targetBatchesAfter[0].expiration_date).toBe('2027-12-31');
      expect(targetBatchesAfter[0].quantity).toBe(15);
      expect(targetBatchesAfter[0].reserved_quantity).toBe(0);
    });

    it('should increment existing batch quantity in target store if matching batch exists', () => {
      // Existing batch in target store with 10 units
      createBatch({
        storeId: storeFilialSPId,
        productId: productId1,
        batchNumber: 'LOTE-REC-SAME',
        manufacturingDate: '2025-01-01',
        expirationDate: '2027-12-31',
        quantity: 10,
      });

      // Source store batch
      createBatch({
        storeId: storeMatrizId,
        productId: productId1,
        batchNumber: 'LOTE-REC-SAME',
        manufacturingDate: '2025-01-01',
        expirationDate: '2027-12-31',
        quantity: 50,
      });

      const transfer = service.createTransfer({
        sourceStoreId: storeMatrizId,
        targetStoreId: storeFilialSPId,
        requestedBy: 'Operador',
        items: [{ productId: productId1, requestedQuantity: 20 }],
      });

      service.dispatchTransfer(transfer.id, 'Despachante');
      service.receiveTransfer(transfer.id, 'Recebedor');

      const targetBatches = db
        .prepare('SELECT * FROM batches WHERE store_id = ? AND product_id = ?')
        .all(storeFilialSPId, productId1) as any[];
      expect(targetBatches.length).toBe(1);
      expect(targetBatches[0].quantity).toBe(30); // 10 original + 20 received
    });

    it('should reject receive when transfer is not in IN_TRANSIT status', () => {
      const transfer = service.createTransfer({
        sourceStoreId: storeMatrizId,
        targetStoreId: storeFilialSPId,
        requestedBy: 'Operador',
        items: [{ productId: productId1, requestedQuantity: 5 }],
      });

      expect(() => {
        service.receiveTransfer(transfer.id, 'Recebedor');
      }).toThrow(/status atual/i);
    });
  });

  describe('cancelTransfer', () => {
    it('should cancel transfer before dispatch without stock changes', () => {
      const b1 = createBatch({
        storeId: storeMatrizId,
        productId: productId1,
        batchNumber: 'LOTE-CANCEL-01',
        manufacturingDate: '2025-01-01',
        expirationDate: '2027-12-31',
        quantity: 30,
      });

      const transfer = service.createTransfer({
        sourceStoreId: storeMatrizId,
        targetStoreId: storeFilialSPId,
        requestedBy: 'Operador',
        items: [{ productId: productId1, requestedQuantity: 10 }],
      });

      const cancelled = service.cancelTransfer(transfer.id, 'Cancelado a pedido da filial');
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.notes).toContain('Cancelamento: Cancelado a pedido da filial');

      const batchAfter = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(b1) as { quantity: number };
      expect(batchAfter.quantity).toBe(30); // Unchanged
    });

    it('should cancel transfer after dispatch and rollback deducted stock back to source batches', () => {
      const b1 = createBatch({
        storeId: storeMatrizId,
        productId: productId1,
        batchNumber: 'LOTE-ROLLBACK-01',
        manufacturingDate: '2025-01-01',
        expirationDate: '2027-12-31',
        quantity: 50,
      });

      const transfer = service.createTransfer({
        sourceStoreId: storeMatrizId,
        targetStoreId: storeFilialSPId,
        requestedBy: 'Operador',
        items: [{ productId: productId1, requestedQuantity: 20 }],
      });

      service.dispatchTransfer(transfer.id, 'Despachante');

      // Stock in source should have been reduced to 30
      const batchAfterDispatch = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(b1) as { quantity: number };
      expect(batchAfterDispatch.quantity).toBe(30);

      // Now cancel while IN_TRANSIT (e.g. vehicle broke down or order rejected)
      const cancelled = service.cancelTransfer(transfer.id, 'Veículo avariado, carga retornou');
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.notes).toContain('Veículo avariado');

      // Stock in source must be restored back to 50
      const batchAfterRollback = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(b1) as { quantity: number };
      expect(batchAfterRollback.quantity).toBe(50);
    });

    it('should reject cancelling a transfer that is already RECEIVED or CANCELLED', () => {
      createBatch({
        storeId: storeMatrizId,
        productId: productId2,
        batchNumber: 'LOTE-REC-CAN',
        manufacturingDate: '2025-01-01',
        expirationDate: '2028-01-01',
        quantity: 20,
      });

      const transfer = service.createTransfer({
        sourceStoreId: storeMatrizId,
        targetStoreId: storeFilialSPId,
        requestedBy: 'Operador',
        items: [{ productId: productId2, requestedQuantity: 5 }],
      });

      service.dispatchTransfer(transfer.id, 'Despachante');
      service.receiveTransfer(transfer.id, 'Recebedor');

      expect(() => {
        service.cancelTransfer(transfer.id, 'Tentativa de cancelamento');
      }).toThrow(/já recebida/i);
    });
  });

  describe('getTransferById and listTransfers', () => {
    it('should return transfer by id with full items, sourceStore, and targetStore details', () => {
      const transfer = service.createTransfer({
        sourceStoreId: storeMatrizId,
        targetStoreId: storeFilialSPId,
        requestedBy: 'Operador Detalhe',
        notes: 'Nota explicativa',
        items: [{ productId: productId1, requestedQuantity: 12 }],
      });

      const found = service.getTransferById(transfer.id);
      expect(found).not.toBeNull();
      expect(found?.transferNumber).toBe(transfer.transferNumber);
      expect(found?.sourceStore?.code).toBe('LJ01');
      expect(found?.targetStore?.code).toBe('LJ02');
      expect(found?.items[0].productName).toBe('Amoxicilina 500mg 21 cápsulas');
    });

    it('should list transfers and filter by status, stores and pagination', () => {
      service.createTransfer({
        sourceStoreId: storeMatrizId,
        targetStoreId: storeFilialSPId,
        requestedBy: 'Op 1',
        items: [{ productId: productId1, requestedQuantity: 5 }],
      });

      const t2 = service.createTransfer({
        sourceStoreId: storeMatrizId,
        targetStoreId: storeFilialRJId,
        requestedBy: 'Op 2',
        status: 'REQUESTED',
        items: [{ productId: productId2, requestedQuantity: 10 }],
      });

      const listAll = service.listTransfers();
      expect(listAll.total).toBe(2);
      expect(listAll.transfers.length).toBe(2);

      const listDraft = service.listTransfers({ status: 'DRAFT' });
      expect(listDraft.total).toBe(1);

      const listTargetRJ = service.listTransfers({ targetStoreId: storeFilialRJId });
      expect(listTargetRJ.total).toBe(1);
      expect(listTargetRJ.transfers[0].id).toBe(t2.id);

      const listPaginated = service.listTransfers({ limit: 1, offset: 0 });
      expect(listPaginated.transfers.length).toBe(1);
      expect(listPaginated.total).toBe(2);
    });
  });
});
