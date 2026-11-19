import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { TransferService } from '../../../src/modules/transfers/transfer.service';
import { StoreService } from '../../../src/modules/stores/store.service';
import { TransferFiscalService } from '../../../src/modules/transfers/transfer-fiscal.service';
import { validateAccessKey } from '../../../src/modules/fiscal/access-key';
import type { CreateStoreInput } from '../../../src/modules/stores/types';
import type { CreateTransferInput } from '../../../src/modules/transfers/types';

describe('TransferFiscalService', () => {
  let db: Database;
  let transferService: TransferService;
  let storeService: StoreService;
  let fiscalService: TransferFiscalService;

  let storeMatrizId: number; // SP
  let storeFilialSPId: number; // SP
  let storeFilialRJId: number; // RJ
  let productId1: number;
  let productId2: number;
  let batchId1: number;
  let batchId2: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    transferService = new TransferService(db);
    storeService = new StoreService(db);
    fiscalService = new TransferFiscalService(db);

    // Matriz SP is store 1
    storeMatrizId = 1;

    // Filial SP (Intrastate)
    const storeSPInput: CreateStoreInput = {
      code: 'LJ02',
      name: 'FarmaCore Filial Campinas',
      companyName: 'Drogaria FarmaCore Campinas Ltda',
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
      taxRegime: 'LUCRO_REAL',
      isActive: true,
    };
    const filialSP = storeService.createStore(storeSPInput);
    storeFilialSPId = filialSP.id;

    // Filial RJ (Interstate)
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
      taxRegime: 'LUCRO_REAL',
      isActive: true,
    };
    const filialRJ = storeService.createStore(storeRJInput);
    storeFilialRJId = filialRJ.id;

    // Products
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
      25.0,
      28.0
    );
    productId1 = Number(p1.lastInsertRowid);

    const p2 = prodStmt.run(
      '7899876543210',
      'Dipirona Sódica 500mg 20 comprimidos',
      'Dipirona Sódica',
      '100000002',
      'SEM_TARJA',
      'LIVRE',
      12.0,
      7.0,
      8.5
    );
    productId2 = Number(p2.lastInsertRowid);

    // Seed stock for Matriz
    const batchStmt = db.prepare(`
      INSERT INTO batches (
        product_id, store_id, batch_number, expiration_date, manufacturing_date,
        quantity, reserved_quantity
      ) VALUES (?, ?, ?, ?, ?, ?, 0)
    `);

    const b1 = batchStmt.run(productId1, storeMatrizId, 'AMX-2026-01', '2027-10-31', '2025-10-01', 100);
    batchId1 = Number(b1.lastInsertRowid);

    const b2 = batchStmt.run(productId2, storeMatrizId, 'DIP-2026-02', '2028-05-31', '2026-01-01', 200);
    batchId2 = Number(b2.lastInsertRowid);
  });

  it('should emit NF-e mod 55 for intrastate transfer (CFOP 5152)', async () => {
    // 1. Create and dispatch transfer (IN_TRANSIT)
    const input: CreateTransferInput = {
      sourceStoreId: storeMatrizId,
      targetStoreId: storeFilialSPId,
      requestedBy: 'Carlos Gerente',
      items: [
        {
          productId: productId1,
          requestedQuantity: 20,
          unitCost: 15.0,
        },
        {
          productId: productId2,
          requestedQuantity: 50,
          unitCost: 4.0,
        },
      ],
    };

    const created = transferService.createTransfer(input);
    const dispatched = transferService.dispatchTransfer(created.id, 'Expedidor João', {
      carrierName: 'Expresso Farma SP',
      trackingCode: 'EXP-9988',
    });

    expect(dispatched.status).toBe('IN_TRANSIT');

    // 2. Emit NF-e
    const result = await fiscalService.emitTransferNfe(created.id);

    expect(result.transferId).toBe(created.id);
    expect(result.status).toBe('AUTORIZADA');
    expect(result.cfop).toBe('5152');
    expect(result.nfeKey).toBeDefined();
    expect(result.nfeKey.length).toBe(44);
    expect(validateAccessKey(result.nfeKey)).toBe(true);
    expect(result.protocol).toMatch(/^1\d+/);

    // Verify XML contents
    expect(result.xml).toContain('<mod>55</mod>');
    expect(result.xml).toContain('<CFOP>5152</CFOP>');
    expect(result.xml).toContain('<natOp>TRANSFERENCIA DE MERCADORIA</natOp>');
    expect(result.xml).toContain('<idDest>1</idDest>'); // Estadual
    expect(result.xml).toContain('Amoxicilina 500mg');
    expect(result.xml).toContain('Dipirona');
    expect(result.xml).toContain('<xNome>Expresso Farma SP</xNome>');

    // 3. Verify database was updated
    const updatedTransfer = transferService.getTransferById(created.id);
    expect(updatedTransfer?.nfeKey).toBe(result.nfeKey);
    expect(updatedTransfer?.nfeProtocol).toBe(result.protocol);
  });

  it('should emit NF-e mod 55 for interstate transfer (CFOP 6152)', async () => {
    const input: CreateTransferInput = {
      sourceStoreId: storeMatrizId,
      targetStoreId: storeFilialRJId,
      requestedBy: 'Diretoria Logística',
      items: [
        {
          productId: productId1,
          requestedQuantity: 30,
          unitCost: 15.0,
        },
      ],
    };

    const created = transferService.createTransfer(input);
    transferService.dispatchTransfer(created.id, 'Expedidor João');

    const result = await fiscalService.emitTransferNfe(created.id);

    expect(result.transferId).toBe(created.id);
    expect(result.cfop).toBe('6152');
    expect(result.xml).toContain('<CFOP>6152</CFOP>');
    expect(result.xml).toContain('<idDest>2</idDest>'); // Interestadual
    expect(result.xml).toContain('Rio de Janeiro');
  });

  it('should allow emitting NF-e mod 55 when transfer is in RECEIVED status', async () => {
    const input: CreateTransferInput = {
      sourceStoreId: storeMatrizId,
      targetStoreId: storeFilialSPId,
      requestedBy: 'Carlos Gerente',
      items: [
        {
          productId: productId1,
          requestedQuantity: 10,
          unitCost: 15.0,
        },
      ],
    };

    const created = transferService.createTransfer(input);
    transferService.dispatchTransfer(created.id, 'Expedidor João');
    transferService.receiveTransfer(created.id, 'Recebedor Mario');

    const result = await fiscalService.emitTransferNfe(created.id);
    expect(result.status).toBe('AUTORIZADA');
    expect(validateAccessKey(result.nfeKey)).toBe(true);
  });

  it('should reject NF-e emission if transfer is in DRAFT status', async () => {
    const input: CreateTransferInput = {
      sourceStoreId: storeMatrizId,
      targetStoreId: storeFilialSPId,
      requestedBy: 'Carlos Gerente',
      items: [
        {
          productId: productId1,
          requestedQuantity: 10,
        },
      ],
    };

    const created = transferService.createTransfer(input);
    expect(created.status).toBe('DRAFT');

    await expect(fiscalService.emitTransferNfe(created.id)).rejects.toThrow(
      /não é possível emitir nf-e|status inválido/i
    );
  });

  it('should reject NF-e emission if transfer is in CANCELLED status', async () => {
    const input: CreateTransferInput = {
      sourceStoreId: storeMatrizId,
      targetStoreId: storeFilialSPId,
      requestedBy: 'Carlos Gerente',
      items: [
        {
          productId: productId1,
          requestedQuantity: 10,
        },
      ],
    };

    const created = transferService.createTransfer(input);
    transferService.cancelTransfer(created.id, 'Erro na solicitação');

    await expect(fiscalService.emitTransferNfe(created.id)).rejects.toThrow(
      /não é possível emitir nf-e|status inválido/i
    );
  });

  it('should reject NF-e emission if transfer does not exist', async () => {
    await expect(fiscalService.emitTransferNfe(99999)).rejects.toThrow(
      /transferência não encontrada/i
    );
  });
});
