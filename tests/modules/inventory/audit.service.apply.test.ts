import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { InventoryAuditService } from '../../../src/modules/inventory/audit.service';
import type { InventorySessionWithItems } from '../../../src/modules/inventory/audit-types';

describe('InventoryAuditService - Apply Adjustments & Cancel Session', () => {
  let db: Database;
  let service: InventoryAuditService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new InventoryAuditService(db);

    // Seed products:
    // Product 1: Common (Dipirona 500mg, ISENTO)
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active, category)
      VALUES (1, '7891000000010', 'Dipirona 500mg Gotas', 'Dipirona Sódica', '1.0000.0001.001-1', 'SEM_TARJA', 'ISENTO', 25.00, 20.00, 22.00, 1, 'REFERENCIA')
    `).run();

    // Product 2: Controlled Antimicrobial (Amoxicilina 500mg, ANTIMICROBIANO)
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active, category)
      VALUES (2, '7891000000027', 'Amoxicilina 500mg 21 caps', 'Amoxicilina Tri-hidratada', '1.0000.0002.001-2', 'VERMELHA', 'ANTIMICROBIANO', 20.00, 15.50, 18.00, 1, 'GENERICO')
    `).run();

    // Product 3: Controlled Portaria 344/98 C1 (Clonazepam 2mg, C1)
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active, category)
      VALUES (3, '7891000000034', 'Clonazepam 2mg 30 comp', 'Clonazepam', '1.0000.0003.001-3', 'PRETA', 'C1', 35.00, 28.00, 30.00, 1, 'GENERICO')
    `).run();

    // Seed initial batches for Store 1:
    // Batch 1: Product 1, LOT-DIP-01, qty 50, reserved 0
    // Batch 2: Product 2, LOT-AMX-01, qty 30, reserved 0
    // Batch 3: Product 3, LOT-CLO-01, qty 20, reserved 0
    db.prepare(`
      INSERT INTO batches (id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity, store_id)
      VALUES 
        (1, 1, 'LOT-DIP-01', '2026-01-01', '2027-12-31', 50, 0, 1),
        (2, 2, 'LOT-AMX-01', '2026-02-01', '2027-06-30', 30, 0, 1),
        (3, 3, 'LOT-CLO-01', '2026-03-01', '2028-01-31', 20, 0, 1)
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  describe('applyAdjustments - Validation & State Guards', () => {
    it('should throw when session does not exist', () => {
      expect(() => {
        service.applyAdjustments(99999, {
          appliedBy: 'Farmacêutico RT',
        });
      }).toThrow('Sessão de inventário não encontrada: ID 99999');
    });

    it('should throw when session is in OPEN status', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador 1',
      });

      expect(() => {
        service.applyAdjustments(session.id, {
          appliedBy: 'Farmacêutico RT',
        });
      }).toThrow('Sessão ainda está aberta para contagem. Finalize a contagem antes de aplicar os ajustes');
    });

    it('should throw when appliedBy is missing or empty', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador 1',
      });
      service.finishCounting(session.id);

      expect(() => {
        service.applyAdjustments(session.id, {
          appliedBy: '   ',
        });
      }).toThrow('Responsável pela aplicação (appliedBy) é obrigatório');
    });

    it('should throw when session is already APPLIED', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador 1',
      });
      // Count exact for all items
      service.addCount(session.id, { productId: 1, batchNumber: 'LOT-DIP-01', expirationDate: '2027-12-31', quantity: 50 });
      service.addCount(session.id, { productId: 2, batchNumber: 'LOT-AMX-01', expirationDate: '2027-06-30', quantity: 30 });
      service.addCount(session.id, { productId: 3, batchNumber: 'LOT-CLO-01', expirationDate: '2028-01-31', quantity: 20 });
      service.finishCounting(session.id);

      service.applyAdjustments(session.id, { appliedBy: 'Fiscal Estoque' });

      expect(() => {
        service.applyAdjustments(session.id, { appliedBy: 'Fiscal Estoque' });
      }).toThrow('Sessão de inventário já foi aplicada anteriormente');
    });

    it('should throw when session is CANCELLED', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador 1',
      });
      service.finishCounting(session.id);
      service.cancelSession(session.id, 'Cancelado por erro operacional');

      expect(() => {
        service.applyAdjustments(session.id, { appliedBy: 'Fiscal Estoque' });
      }).toThrow('Sessão de inventário cancelada não pode ser aplicada');
    });
  });

  describe('applyAdjustments - Pharmacist CRF Validation for Controlled Products', () => {
    it('should throw validation error when controlled product has divergence and pharmacist CRF/UF is missing', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'CONTROLADOS_SNGPC',
        openedBy: 'Operador 1',
      });

      // Product 2 (AMX) expected 30, count 25 (shortage of 5)
      service.addCount(session.id, {
        productId: 2,
        batchNumber: 'LOT-AMX-01',
        expirationDate: '2027-06-30',
        quantity: 25,
      });
      // Product 3 (CLO) count 20 (exact)
      service.addCount(session.id, {
        productId: 3,
        batchNumber: 'LOT-CLO-01',
        expirationDate: '2028-01-31',
        quantity: 20,
      });
      service.finishCounting(session.id);

      expect(() => {
        service.applyAdjustments(session.id, {
          appliedBy: 'Gerente Operacional',
          // responsiblePharmacistCrf omitted
        });
      }).toThrow('CRF e UF do Farmacêutico Responsável Técnico são obrigatórios para homologar ajustes de medicamentos controlados (Portaria 344/98)');

      expect(() => {
        service.applyAdjustments(session.id, {
          appliedBy: 'Gerente Operacional',
          responsiblePharmacistCrf: '12345',
          responsiblePharmacistUf: '', // empty UF
        });
      }).toThrow('CRF e UF do Farmacêutico Responsável Técnico são obrigatórios para homologar ajustes de medicamentos controlados (Portaria 344/98)');
    });

    it('should NOT require pharmacist CRF if controlled products have zero divergence (EXACT)', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'CONTROLADOS_SNGPC',
        openedBy: 'Operador 1',
      });

      // Both count exact
      service.addCount(session.id, { productId: 2, batchNumber: 'LOT-AMX-01', expirationDate: '2027-06-30', quantity: 30 });
      service.addCount(session.id, { productId: 3, batchNumber: 'LOT-CLO-01', expirationDate: '2028-01-31', quantity: 20 });
      service.finishCounting(session.id);

      // Should succeed even without pharmacist CRF because no divergence exists
      const applied = service.applyAdjustments(session.id, {
        appliedBy: 'Auditor Geral',
      });

      expect(applied.status).toBe('APPLIED');
      expect(applied.appliedBy).toBe('Auditor Geral');
    });

    it('should NOT require pharmacist CRF if divergences occur only on common (non-controlled) products', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador 1',
      });

      // Product 1 (Dipirona - ISENTO) has divergence: expected 50, counted 40
      service.addCount(session.id, { productId: 1, batchNumber: 'LOT-DIP-01', expirationDate: '2027-12-31', quantity: 40 });
      // Product 2 & 3 exact
      service.addCount(session.id, { productId: 2, batchNumber: 'LOT-AMX-01', expirationDate: '2027-06-30', quantity: 30 });
      service.addCount(session.id, { productId: 3, batchNumber: 'LOT-CLO-01', expirationDate: '2028-01-31', quantity: 20 });
      service.finishCounting(session.id);

      const applied = service.applyAdjustments(session.id, {
        appliedBy: 'Fiscal de Loja',
      });

      expect(applied.status).toBe('APPLIED');
      expect(applied.appliedBy).toBe('Fiscal de Loja');

      // Verify batch 1 updated to 40
      const batch1 = db.prepare('SELECT quantity FROM batches WHERE id = 1').get() as { quantity: number };
      expect(batch1.quantity).toBe(40);
    });
  });

  describe('applyAdjustments - Physical Stock Updates & SNGPC Regulatory Compliance', () => {
    it('should update existing batches for shortage and surplus, and apply itemReasons', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador 1',
      });

      // Product 1 (Dipirona): expected 50, counted 42 (-8 shortage)
      service.addCount(session.id, { productId: 1, batchNumber: 'LOT-DIP-01', expirationDate: '2027-12-31', quantity: 42 });
      // Product 2 (Amoxicilina): expected 30, counted 35 (+5 surplus)
      service.addCount(session.id, { productId: 2, batchNumber: 'LOT-AMX-01', expirationDate: '2027-06-30', quantity: 35 });
      // Product 3 (Clonazepam): expected 20, counted 20 (0 exact)
      service.addCount(session.id, { productId: 3, batchNumber: 'LOT-CLO-01', expirationDate: '2028-01-31', quantity: 20 });
      service.finishCounting(session.id);

      const countedSession = service.getSessionById(session.id)!;
      const itemDip = countedSession.items.find(i => i.productId === 1)!;
      const itemAmx = countedSession.items.find(i => i.productId === 2)!;

      const applied = service.applyAdjustments(session.id, {
        appliedBy: 'Farmacêutico Chefe',
        responsiblePharmacistCrf: '54321',
        responsiblePharmacistUf: 'SP',
        itemReasons: {
          [itemDip.id]: { reason: 'AVARIA', notes: 'Frascos quebrados no transporte' },
          [itemAmx.id]: { reason: 'SOBRA_NAO_IDENTIFICADA', notes: 'Conferência física a maior' },
        },
      });

      expect(applied.status).toBe('APPLIED');
      expect(applied.appliedBy).toBe('Farmacêutico Chefe');
      expect(applied.responsiblePharmacistCrf).toBe('54321');
      expect(applied.responsiblePharmacistUf).toBe('SP');
      expect(applied.closedAt).toBeTruthy();

      // Check batches table
      const b1 = db.prepare('SELECT quantity FROM batches WHERE id = 1').get() as { quantity: number };
      const b2 = db.prepare('SELECT quantity FROM batches WHERE id = 2').get() as { quantity: number };
      const b3 = db.prepare('SELECT quantity FROM batches WHERE id = 3').get() as { quantity: number };
      expect(b1.quantity).toBe(42);
      expect(b2.quantity).toBe(35);
      expect(b3.quantity).toBe(20);

      // Check item adjustment reasons and notes
      const updatedDip = applied.items.find(i => i.id === itemDip.id)!;
      expect(updatedDip.adjustmentReason).toBe('AVARIA');
      expect(updatedDip.notes).toBe('Frascos quebrados no transporte');

      const updatedAmx = applied.items.find(i => i.id === itemAmx.id)!;
      expect(updatedAmx.adjustmentReason).toBe('SOBRA_NAO_IDENTIFICADA');
      expect(updatedAmx.notes).toBe('Conferência física a maior');
      expect(updatedAmx.sngpcAdjusted).toBe(true);

      // Check SNGPC movements:
      // Product 1 (Dipirona) is ISENTO -> NO SNGPC record
      const sngpcDip = db.prepare('SELECT * FROM sngpc_movements WHERE product_id = 1').all();
      expect(sngpcDip).toHaveLength(0);

      // Product 2 (Amoxicilina) is ANTIMICROBIANO -> SURPLUS (+5) -> movement_type = 'ENTRADA'
      const sngpcAmx = db.prepare('SELECT * FROM sngpc_movements WHERE product_id = 2').all() as any[];
      expect(sngpcAmx).toHaveLength(1);
      expect(sngpcAmx[0].movement_type).toBe('ENTRADA');
      expect(sngpcAmx[0].quantity).toBe(5);
      expect(sngpcAmx[0].reference_type).toBe('INVENTORY_ADJUSTMENT');
      expect(sngpcAmx[0].reference_id).toBe(session.id);
      expect(sngpcAmx[0].batch_id).toBe(2);
      expect(sngpcAmx[0].ms_registration).toBe('1.0000.0002.001-2');
      expect(sngpcAmx[0].is_transmitted).toBe(0);
    });

    it('should generate PERDA in sngpc_movements when controlled product has shortage', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'CONTROLADOS_SNGPC',
        openedBy: 'Farmacêutico RT',
      });

      // Product 3 (Clonazepam - C1): expected 20, counted 16 (-4 shortage)
      service.addCount(session.id, { productId: 3, batchNumber: 'LOT-CLO-01', expirationDate: '2028-01-31', quantity: 16 });
      // Product 2 exact
      service.addCount(session.id, { productId: 2, batchNumber: 'LOT-AMX-01', expirationDate: '2027-06-30', quantity: 30 });
      service.finishCounting(session.id);

      const countedSession = service.getSessionById(session.id)!;
      const itemClo = countedSession.items.find(i => i.productId === 3)!;

      const applied = service.applyAdjustments(session.id, {
        appliedBy: 'Dra. Maria Farmacêutica',
        responsiblePharmacistCrf: '99887',
        responsiblePharmacistUf: 'SP',
        itemReasons: {
          [itemClo.id]: { reason: 'FURTO_EXTRAVIO', notes: 'Divergência apurada em auditoria de cofre' },
        },
      });

      expect(applied.status).toBe('APPLIED');

      const sngpcClo = db.prepare('SELECT * FROM sngpc_movements WHERE product_id = 3').all() as any[];
      expect(sngpcClo).toHaveLength(1);
      expect(sngpcClo[0].movement_type).toBe('PERDA');
      expect(sngpcClo[0].quantity).toBe(4);
      expect(sngpcClo[0].reference_type).toBe('INVENTORY_ADJUSTMENT');
      expect(sngpcClo[0].reference_id).toBe(session.id);
      expect(sngpcClo[0].batch_id).toBe(3);
      expect(sngpcClo[0].ms_registration).toBe('1.0000.0003.001-3');
      expect(sngpcClo[0].is_transmitted).toBe(0);

      const updatedClo = applied.items.find(i => i.id === itemClo.id)!;
      expect(updatedClo.sngpcAdjusted).toBe(true);
      expect(updatedClo.adjustmentReason).toBe('FURTO_EXTRAVIO');
    });

    it('should create new batch in batches when surplus lot was uncataloged (batch_id is null)', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador 1',
      });

      // Product 1 existing lot count exact
      service.addCount(session.id, { productId: 1, batchNumber: 'LOT-DIP-01', expirationDate: '2027-12-31', quantity: 50 });
      // Product 2 existing lot count exact
      service.addCount(session.id, { productId: 2, batchNumber: 'LOT-AMX-01', expirationDate: '2027-06-30', quantity: 30 });
      // Product 3 existing lot count exact
      service.addCount(session.id, { productId: 3, batchNumber: 'LOT-CLO-01', expirationDate: '2028-01-31', quantity: 20 });

      // Brand new surplus batch for Product 2 (Controlled Antimicrobial) found physically on shelf
      const uncatalogedItem = service.addCount(session.id, {
        productId: 2,
        batchNumber: 'LOT-AMX-NEW99',
        expirationDate: '2028-12-31',
        manufacturingDate: '2026-05-01',
        quantity: 12,
      });

      expect(uncatalogedItem.batchId).toBeNull();
      expect(uncatalogedItem.differenceQuantity).toBe(12);
      expect(uncatalogedItem.differenceStatus).toBe('SURPLUS');

      service.finishCounting(session.id);

      const applied = service.applyAdjustments(session.id, {
        appliedBy: 'Dra. Maria',
        responsiblePharmacistCrf: '88776',
        responsiblePharmacistUf: 'SP',
      });

      // Check that a new batch was inserted into batches table
      const newBatch = db.prepare(`
        SELECT * FROM batches WHERE product_id = 2 AND batch_number = 'LOT-AMX-NEW99'
      `).get() as any;

      expect(newBatch).toBeDefined();
      expect(newBatch.store_id).toBe(1);
      expect(newBatch.batch_number).toBe('LOT-AMX-NEW99');
      expect(newBatch.expiration_date).toBe('2028-12-31');
      expect(newBatch.manufacturing_date).toBe('2026-05-01');
      expect(newBatch.quantity).toBe(12);
      expect(newBatch.reserved_quantity).toBe(0);

      // Verify inventory_items was updated with the new batch_id
      const updatedItem = applied.items.find(i => i.batchNumber === 'LOT-AMX-NEW99')!;
      expect(updatedItem.batchId).toBe(newBatch.id);
      expect(updatedItem.sngpcAdjusted).toBe(true);

      // Check SNGPC movement was created with the new resolved batchId
      const sngpcRows = db.prepare(`
        SELECT * FROM sngpc_movements WHERE product_id = 2 AND batch_id = ?
      `).all(newBatch.id) as any[];

      expect(sngpcRows).toHaveLength(1);
      expect(sngpcRows[0].movement_type).toBe('ENTRADA');
      expect(sngpcRows[0].quantity).toBe(12);
      expect(sngpcRows[0].batch_id).toBe(newBatch.id);
      expect(sngpcRows[0].reference_type).toBe('INVENTORY_ADJUSTMENT');
      expect(sngpcRows[0].reference_id).toBe(session.id);
    });
  });

  describe('cancelSession', () => {
    it('should cancel an OPEN session without modifying stock', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador 1',
        notes: 'Sessão aberta para teste',
      });

      const cancelled = service.cancelSession(session.id, 'Contagem suspensa pela diretoria');

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.notes).toContain('Sessão aberta para teste | Cancelado: Contagem suspensa pela diretoria');

      // Verify stock was untouched
      const b1 = db.prepare('SELECT quantity FROM batches WHERE id = 1').get() as { quantity: number };
      expect(b1.quantity).toBe(50);
    });

    it('should cancel a COUNTED session without modifying stock', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador 1',
      });
      service.addCount(session.id, { productId: 1, batchNumber: 'LOT-DIP-01', expirationDate: '2027-12-31', quantity: 10 });
      service.finishCounting(session.id);

      const cancelled = service.cancelSession(session.id, 'Divergência excessiva, novo balanço será agendado');

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.notes).toBe('Cancelado: Divergência excessiva, novo balanço será agendado');

      // Stock remains untouched
      const b1 = db.prepare('SELECT quantity FROM batches WHERE id = 1').get() as { quantity: number };
      expect(b1.quantity).toBe(50);

      // No SNGPC movements created
      const sngpcCount = db.prepare('SELECT COUNT(*) as c FROM sngpc_movements').get() as { c: number };
      expect(sngpcCount.c).toBe(0);
    });

    it('should throw when trying to cancel an already APPLIED session', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador 1',
      });
      service.finishCounting(session.id);
      service.applyAdjustments(session.id, {
        appliedBy: 'Fiscal',
        responsiblePharmacistCrf: '12345',
        responsiblePharmacistUf: 'SP',
      });

      expect(() => {
        service.cancelSession(session.id, 'Tentativa de cancelamento');
      }).toThrow('Sessão já aplicada não pode ser cancelada');
    });

    it('should throw when trying to cancel an already CANCELLED session', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador 1',
      });
      service.cancelSession(session.id, 'Primeiro cancelamento');

      expect(() => {
        service.cancelSession(session.id, 'Segundo cancelamento');
      }).toThrow('Sessão já está cancelada');
    });

    it('should throw when reason is empty', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Operador 1',
      });

      expect(() => {
        service.cancelSession(session.id, '   ');
      }).toThrow('Motivo do cancelamento é obrigatório');
    });

    it('should throw when session does not exist', () => {
      expect(() => {
        service.cancelSession(88888, 'Inexistente');
      }).toThrow('Sessão de inventário não encontrada: ID 88888');
    });
  });
});
