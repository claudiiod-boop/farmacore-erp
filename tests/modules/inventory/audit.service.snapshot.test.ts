import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { InventoryAuditService } from '../../../src/modules/inventory/audit.service';

describe('InventoryAuditService - Session Creation & Logical Stock Snapshot', () => {
  let db: Database;
  let service: InventoryAuditService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new InventoryAuditService(db);

    // Setup helper data: Create second store
    db.prepare(`
      INSERT INTO stores (id, code, name, company_name, cnpj, ie, is_headquarters, street, number, neighborhood, city, state, zip_code, ibge_code, tax_regime, is_active)
      VALUES (2, 'LJ02', 'FarmaCore Filial Jardins', 'Drogaria FarmaCore Jardins Ltda', '12.345.678/0002-71', '987654321', 0, 'Rua Augusta', '500', 'Cerqueira César', 'São Paulo', 'SP', '01412-000', '3550308', 'SIMPLES_NACIONAL', 1)
    `).run();

    // Insert test products
    // 1: Referência, ISENTO, pf 20.00
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active, category)
      VALUES (1, '7891000000010', 'Dipirona 500mg Gotas', 'Dipirona Sódica', '1.0000.0001.001-1', 'SEM_TARJA', 'ISENTO', 25.00, 20.00, 22.00, 1, 'REFERENCIA')
    `).run();

    // 2: Genérico, ANTIMICROBIANO, pf 15.50
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active, category)
      VALUES (2, '7891000000027', 'Amoxicilina 500mg 21 caps', 'Amoxicilina Tri-hidratada', '1.0000.0002.001-2', 'VERMELHA', 'ANTIMICROBIANO', 20.00, 15.50, 18.00, 1, 'GENERICO')
    `).run();

    // 3: Perfumaria, ISENTO, pf 10.00
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active, category)
      VALUES (3, '7891000000034', 'Shampoo Anticaspa 200ml', 'Zinco Piritiona', 'ISENTO', 'SEM_TARJA', 'ISENTO', 15.00, 10.00, 14.00, 1, 'PERFUMARIA')
    `).run();

    // 4: Similar, C1 (Controlado Portaria 344), pf 30.00
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active, category)
      VALUES (4, '7891000000041', 'Clonazepam 2mg 30 comp', 'Clonazepam', '1.0000.0004.001-4', 'PRETA', 'C1', 35.00, 30.00, 32.00, 1, 'SIMILAR')
    `).run();

    // Insert batches for Store 1
    db.prepare(`
      INSERT INTO batches (id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity, store_id)
      VALUES 
        (1, 1, 'LOT001', '2026-01-01', '2027-12-31', 50, 5, 1),
        (2, 1, 'LOT002', '2026-02-01', '2028-01-31', 20, 0, 1),
        (3, 2, 'LOT003', '2026-03-01', '2027-06-30', 30, 0, 1),
        (4, 3, 'LOT004', '2026-01-15', '2028-06-30', 10, 2, 1),
        (5, 4, 'LOT005', '2026-04-01', '2027-10-31', 40, 10, 1)
    `).run();

    // Insert batch for Store 2 (must not leak into Store 1)
    db.prepare(`
      INSERT INTO batches (id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity, store_id)
      VALUES (6, 1, 'LOT-STORE2', '2026-01-01', '2027-12-31', 99, 0, 2)
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  describe('createSession', () => {
    it('should create a GERAL inventory session capturing all store active batches', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Carlos Almoxarife',
        notes: 'Balanço Geral de Final de Mês',
      });

      expect(session).toBeDefined();
      expect(session.id).toBeGreaterThan(0);
      expect(session.sessionCode).toMatch(/^INV-\d{8}-\d{4}$/);
      expect(session.storeId).toBe(1);
      expect(session.inventoryType).toBe('GERAL');
      expect(session.status).toBe('OPEN');
      expect(session.openedBy).toBe('Carlos Almoxarife');
      expect(session.notes).toBe('Balanço Geral de Final de Mês');

      // Store 1 has 5 batches across 4 products
      expect(session.totalBatchesExpected).toBe(5);
      expect(session.totalProductsExpected).toBe(4);
      expect(session.items).toHaveLength(5);

      // Verify store details
      expect(session.store).toBeDefined();
      expect(session.store?.code).toBe('LJ01');

      // Check items snapshot calculation
      const itemLot1 = session.items.find((i) => i.batchNumber === 'LOT001');
      expect(itemLot1).toBeDefined();
      expect(itemLot1?.expectedQuantity).toBe(45); // 50 - 5
      expect(itemLot1?.countedQuantity).toBe(0);
      expect(itemLot1?.differenceQuantity).toBe(-45);
      expect(itemLot1?.differenceStatus).toBe('SHORTAGE');
      expect(itemLot1?.unitCost).toBe(20.00);
      expect(itemLot1?.totalCostDifference).toBe(-900.00); // -45 * 20.00
      expect(itemLot1?.productName).toBe('Dipirona 500mg Gotas');
      expect(itemLot1?.productEan).toBe('7891000000010');

      // Verify batch from Store 2 is not present
      const store2Item = session.items.find((i) => i.batchNumber === 'LOT-STORE2');
      expect(store2Item).toBeUndefined();
    });

    it('should generate sequential session codes (e.g. 0001, 0002)', () => {
      const s1 = service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Op 1',
      });
      // Close or cancel s1 so we can open another in same store if needed, or open in store 2
      const s2 = service.createSession({
        storeId: 2,
        inventoryType: 'GERAL',
        openedBy: 'Op 2',
      });

      expect(s1.sessionCode.endsWith('0001')).toBe(true);
      expect(s2.sessionCode.endsWith('0002')).toBe(true);
    });

    it('should create a ROTATIVO inventory session filtered by product category', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'ROTATIVO',
        categoryFilter: 'GENERICO',
        openedBy: 'Maria Fiscal',
      });

      expect(session.inventoryType).toBe('ROTATIVO');
      expect(session.categoryFilter).toBe('GENERICO');
      // Only Product 2 is GENERICO (LOT003: qty 30, reserved 0)
      expect(session.totalBatchesExpected).toBe(1);
      expect(session.totalProductsExpected).toBe(1);
      expect(session.items).toHaveLength(1);
      expect(session.items[0].batchNumber).toBe('LOT003');
      expect(session.items[0].expectedQuantity).toBe(30);
      expect(session.items[0].productName).toBe('Amoxicilina 500mg 21 caps');
    });

    it('should create a CONTROLADOS_SNGPC inventory session filtered by control_type', () => {
      const session = service.createSession({
        storeId: 1,
        inventoryType: 'CONTROLADOS_SNGPC',
        openedBy: 'Dra. Roberta CRF/SP 12345',
      });

      expect(session.inventoryType).toBe('CONTROLADOS_SNGPC');
      // In Store 1: Product 2 (ANTIMICROBIANO, LOT003) and Product 4 (C1, LOT005)
      expect(session.totalBatchesExpected).toBe(2);
      expect(session.totalProductsExpected).toBe(2);
      expect(session.items).toHaveLength(2);

      const batchNumbers = session.items.map((i) => i.batchNumber);
      expect(batchNumbers).toContain('LOT003');
      expect(batchNumbers).toContain('LOT005');
      expect(batchNumbers).not.toContain('LOT001'); // ISENTO
      expect(batchNumbers).not.toContain('LOT004'); // ISENTO
    });

    it('should throw error when store does not exist', () => {
      expect(() => {
        service.createSession({
          storeId: 9999,
          inventoryType: 'GERAL',
          openedBy: 'Tester',
        });
      }).toThrow(/filial n[ãa]o encontrada/i);
    });

    it('should throw error when store is inactive', () => {
      db.prepare('UPDATE stores SET is_active = 0 WHERE id = 2').run();

      expect(() => {
        service.createSession({
          storeId: 2,
          inventoryType: 'GERAL',
          openedBy: 'Tester',
        });
      }).toThrow(/filial n[ãa]o encontrada ou inativa/i);
    });

    it('should throw error when openedBy is empty', () => {
      expect(() => {
        service.createSession({
          storeId: 1,
          inventoryType: 'GERAL',
          openedBy: '   ',
        });
      }).toThrow(/openedby.*obrigat[óo]rio/i);
    });

    it('should throw error when categoryFilter is missing for ROTATIVO inventory', () => {
      expect(() => {
        service.createSession({
          storeId: 1,
          inventoryType: 'ROTATIVO',
          openedBy: 'Tester',
        });
      }).toThrow(/categoria.*obrigat[óo]rio/i);
    });

    it('should throw error when an OPEN session with same scope already exists in store', () => {
      service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Tester 1',
      });

      expect(() => {
        service.createSession({
          storeId: 1,
          inventoryType: 'GERAL',
          openedBy: 'Tester 2',
        });
      }).toThrow(/j[áa] existe uma sess[ãa]o de invent[áa]rio aberta para este escopo/i);
    });

    it('should allow concurrent ROTATIVO sessions in same store if categories differ', () => {
      const s1 = service.createSession({
        storeId: 1,
        inventoryType: 'ROTATIVO',
        categoryFilter: 'GENERICO',
        openedBy: 'Tester 1',
      });
      const s2 = service.createSession({
        storeId: 1,
        inventoryType: 'ROTATIVO',
        categoryFilter: 'PERFUMARIA',
        openedBy: 'Tester 2',
      });

      expect(s1.categoryFilter).toBe('GENERICO');
      expect(s2.categoryFilter).toBe('PERFUMARIA');
    });

    it('should prevent duplicate ROTATIVO sessions for the exact same category', () => {
      service.createSession({
        storeId: 1,
        inventoryType: 'ROTATIVO',
        categoryFilter: 'GENERICO',
        openedBy: 'Tester 1',
      });

      expect(() => {
        service.createSession({
          storeId: 1,
          inventoryType: 'ROTATIVO',
          categoryFilter: 'GENERICO',
          openedBy: 'Tester 2',
        });
      }).toThrow(/j[áa] existe uma sess[ãa]o de invent[áa]rio aberta para este escopo/i);
    });
  });

  describe('getSessionById', () => {
    it('should return session with items and store if found', () => {
      const created = service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Carlos Almoxarife',
      });

      const found = service.getSessionById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.sessionCode).toBe(created.sessionCode);
      expect(found?.items).toHaveLength(5);
      expect(found?.store?.id).toBe(1);
    });

    it('should return null if session not found', () => {
      const found = service.getSessionById(99999);
      expect(found).toBeNull();
    });
  });

  describe('listSessions', () => {
    it('should list sessions with filters and pagination', () => {
      service.createSession({
        storeId: 1,
        inventoryType: 'GERAL',
        openedBy: 'Op 1',
      });
      service.createSession({
        storeId: 2,
        inventoryType: 'CONTROLADOS_SNGPC',
        openedBy: 'Op 2',
      });

      const all = service.listSessions();
      expect(all.total).toBe(2);
      expect(all.sessions).toHaveLength(2);
      // Order by id DESC
      expect(all.sessions[0].storeId).toBe(2);
      expect(all.sessions[1].storeId).toBe(1);

      // Filter by storeId
      const store1Only = service.listSessions({ storeId: 1 });
      expect(store1Only.total).toBe(1);
      expect(store1Only.sessions[0].storeId).toBe(1);

      // Filter by inventoryType
      const sngpcOnly = service.listSessions({ inventoryType: 'CONTROLADOS_SNGPC' });
      expect(sngpcOnly.total).toBe(1);
      expect(sngpcOnly.sessions[0].inventoryType).toBe('CONTROLADOS_SNGPC');

      // Filter by status
      const openOnly = service.listSessions({ status: 'OPEN' });
      expect(openOnly.total).toBe(2);

      const countedOnly = service.listSessions({ status: 'COUNTED' });
      expect(countedOnly.total).toBe(0);

      // Pagination
      const page1 = service.listSessions({ limit: 1, offset: 0 });
      expect(page1.total).toBe(2);
      expect(page1.sessions).toHaveLength(1);
      expect(page1.sessions[0].storeId).toBe(2);

      const page2 = service.listSessions({ limit: 1, offset: 1 });
      expect(page2.total).toBe(2);
      expect(page2.sessions).toHaveLength(1);
      expect(page2.sessions[0].storeId).toBe(1);
    });
  });
});
