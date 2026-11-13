import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { SngpcService } from '../../../src/modules/sngpc/sngpc.service';
import { PosService } from '../../../src/modules/pos/pos.service';
import { PreSaleService } from '../../../src/modules/counter/pre-sale.service';
import { CatalogService } from '../../../src/modules/catalog/catalog.service';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';
import { SngpcMovementType } from '../../../src/modules/sngpc/types';

describe('SngpcService & POS Regulatory Integration', () => {
  let db: Database;
  let sngpcService: SngpcService;
  let catalogService: CatalogService;
  let inventoryService: InventoryService;
  let preSaleService: PreSaleService;
  let posService: PosService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);

    sngpcService = new SngpcService(db);
    catalogService = new CatalogService(db);
    inventoryService = new InventoryService(db);
    preSaleService = new PreSaleService(db, catalogService, inventoryService);
    posService = new PosService(db, preSaleService, inventoryService, sngpcService);

    // Setup pharmacy fiscal profile
    db.prepare(`
      INSERT INTO fiscal_profiles (
        cnpj, ie, razao_social, nome_fantasia, crt, c_uf, municipio, c_mun,
        logradouro, numero, bairro, cep, csc_token, environment
      ) VALUES (
        '12345678000195', '123456789', 'Farmacia FarmaCore LTDA', 'FarmaCore Central',
        1, 35, 'São Paulo', 3550308, 'Av Paulista', '1000', 'Bela Vista',
        '01310100', 'CSC123456', 'HOMOLOGACAO'
      )
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  function createTestProduct(overrides?: Partial<{
    name: string;
    ean: string;
    controlType: string;
    stripe: string;
    msRegistration: string;
  }>) {
    const ean = overrides?.ean || `7891234${Math.floor(100000 + Math.random() * 900000)}`;
    const name = overrides?.name || 'Clonazepam 2mg 30 comp';
    const controlType = overrides?.controlType || 'PORTARIA_344_B1';
    const stripe = overrides?.stripe || 'PRETA';
    const msRegistration = overrides?.msRegistration || '1.0043.0021.001-4';

    const run = db.prepare(`
      INSERT INTO products (
        ean, name, active_ingredient, ms_registration, stripe, control_type,
        pmc, pf, price, is_active
      ) VALUES (?, ?, 'Clonazepam', ?, ?, ?, 35.00, 25.00, 30.00, 1)
    `).run(ean, name, msRegistration, stripe, controlType);

    const productId = Number(run.lastInsertRowid);

    const batchRun = db.prepare(`
      INSERT INTO batches (
        product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
      ) VALUES (?, 'LOT-CLONA-001', '2026-01-01', '2027-12-31', 100, 0)
    `).run(productId);

    const batchId = Number(batchRun.lastInsertRowid);

    return { productId, batchId, ean, name, msRegistration, controlType };
  }

  describe('recordEntryMovement', () => {
    it('should record an ENTRADA movement for purchase invoice', () => {
      const prod = createTestProduct();

      // Insert purchase invoice
      const invoiceRun = db.prepare(`
        INSERT INTO purchase_invoices (
          access_key, invoice_number, invoice_series, issue_date, supplier_cnpj, supplier_name,
          total_invoice_amount, total_products_amount, xml_content
        ) VALUES ('35261112345678000199550010000012341234567890', 1234, 1, '2026-11-01', '98765432000100', 'Distr Medicamentos', 500, 500, '<xml></xml>')
      `).run();
      const invoiceId = Number(invoiceRun.lastInsertRowid);

      const movement = sngpcService.recordEntryMovement({
        productId: prod.productId,
        batchId: prod.batchId,
        quantity: 50,
        referenceId: invoiceId,
        movementDate: '2026-11-01',
        msRegistration: prod.msRegistration,
      });

      expect(movement.id).toBeGreaterThan(0);
      expect(movement.movementType).toBe('ENTRADA');
      expect(movement.productId).toBe(prod.productId);
      expect(movement.batchId).toBe(prod.batchId);
      expect(movement.quantity).toBe(50);
      expect(movement.referenceType).toBe('PURCHASE_INVOICE');
      expect(movement.referenceId).toBe(invoiceId);
      expect(movement.isTransmitted).toBe(0);
      expect(movement.msRegistration).toBe(prod.msRegistration);

      // Verify DB row
      const row = db.prepare<any>('SELECT * FROM sngpc_movements WHERE id = ?').get(movement.id);
      expect(row).toBeDefined();
      expect(row.movement_type).toBe('ENTRADA');
      expect(row.quantity).toBe(50);
    });

    it('should throw error when recording entry with invalid data', () => {
      const prod = createTestProduct();

      expect(() => {
        sngpcService.recordEntryMovement({
          productId: prod.productId,
          batchId: prod.batchId,
          quantity: 0,
          referenceId: 1,
          movementDate: '2026-11-01',
          msRegistration: prod.msRegistration,
        });
      }).toThrow();

      expect(() => {
        sngpcService.recordEntryMovement({
          productId: prod.productId,
          batchId: prod.batchId,
          quantity: 10,
          referenceId: 1,
          movementDate: '',
          msRegistration: prod.msRegistration,
        });
      }).toThrow();
    });
  });

  describe('recordSaleMovement', () => {
    it('should record a SAIDA_VENDA movement linked to a prescription', () => {
      const prod = createTestProduct();

      // Pre-sale with prescription
      const preSaleRun = db.prepare(`
        INSERT INTO pre_sales (code, status, total_amount) VALUES ('PV-0001', 'CONVERTED_TO_SALE', 30.00)
      `).run();
      const preSaleId = Number(preSaleRun.lastInsertRowid);

      const prescRun = db.prepare(`
        INSERT INTO prescriptions (
          pre_sale_id, doctor_name, doctor_crm, doctor_uf, prescription_type,
          prescription_date, patient_name, buyer_name, buyer_cpf, notification_number
        ) VALUES (?, 'Dr. Silva', '12345', 'SP', 'B1_AZUL', '2026-11-02', 'Paciente A', 'Comprador B', '11122233344', 'NOTIF-001')
      `).run(preSaleId);
      const prescriptionId = Number(prescRun.lastInsertRowid);

      const saleRun = db.prepare(`
        INSERT INTO sales (pre_sale_id, total_amount) VALUES (?, 30.00)
      `).run(preSaleId);
      const saleId = Number(saleRun.lastInsertRowid);

      const movement = sngpcService.recordSaleMovement({
        productId: prod.productId,
        batchId: prod.batchId,
        quantity: 2,
        referenceId: saleId,
        movementDate: '2026-11-02',
        msRegistration: prod.msRegistration,
        prescriptionId,
      });

      expect(movement.id).toBeGreaterThan(0);
      expect(movement.movementType).toBe('SAIDA_VENDA');
      expect(movement.quantity).toBe(2);
      expect(movement.referenceType).toBe('SALE');
      expect(movement.referenceId).toBe(saleId);
      expect(movement.prescriptionId).toBe(prescriptionId);
      expect(movement.isTransmitted).toBe(0);

      const row = db.prepare<any>('SELECT * FROM sngpc_movements WHERE id = ?').get(movement.id);
      expect(row.movement_type).toBe('SAIDA_VENDA');
      expect(row.prescription_id).toBe(prescriptionId);
    });
  });

  describe('getMovements', () => {
    it('should filter movements by date range, type, and transmission status', () => {
      const prod = createTestProduct();

      sngpcService.recordEntryMovement({
        productId: prod.productId,
        batchId: prod.batchId,
        quantity: 10,
        referenceId: 101,
        movementDate: '2026-11-01',
        msRegistration: prod.msRegistration,
      });

      sngpcService.recordEntryMovement({
        productId: prod.productId,
        batchId: prod.batchId,
        quantity: 20,
        referenceId: 102,
        movementDate: '2026-11-03',
        msRegistration: prod.msRegistration,
      });

      // Filter by date range
      const inRange = sngpcService.getMovements({
        startDate: '2026-11-02',
        endDate: '2026-11-04',
      });
      expect(inRange).toHaveLength(1);
      expect(inRange[0].quantity).toBe(20);

      // Filter by type
      const entries = sngpcService.getMovements({ movementType: 'ENTRADA' });
      expect(entries).toHaveLength(2);

      const sales = sngpcService.getMovements({ movementType: 'SAIDA_VENDA' });
      expect(sales).toHaveLength(0);

      // Filter by transmission status
      const unTransmitted = sngpcService.getMovements({ isTransmitted: 0 });
      expect(unTransmitted).toHaveLength(2);
    });
  });

  describe('getLivroRegistro (Portaria 344/98)', () => {
    it('should consolidate initial balance, entries, exits, and final balance sequentially', () => {
      const prod = createTestProduct();

      // Prior movement before period (initial balance)
      sngpcService.recordEntryMovement({
        productId: prod.productId,
        batchId: prod.batchId,
        quantity: 100,
        referenceId: 10,
        movementDate: '2026-10-25',
        msRegistration: prod.msRegistration,
      });

      // Entry movement within period
      sngpcService.recordEntryMovement({
        productId: prod.productId,
        batchId: prod.batchId,
        quantity: 50,
        referenceId: 20,
        movementDate: '2026-11-02',
        msRegistration: prod.msRegistration,
      });

      // Prescription & Sale movement within period
      const preSaleRun = db.prepare(`
        INSERT INTO pre_sales (code, status, total_amount) VALUES ('PV-999', 'CONVERTED_TO_SALE', 60.00)
      `).run();
      const preSaleId = Number(preSaleRun.lastInsertRowid);

      const prescRun = db.prepare(`
        INSERT INTO prescriptions (
          pre_sale_id, doctor_name, doctor_crm, doctor_uf, prescription_type,
          prescription_date, patient_name, buyer_name, buyer_cpf, notification_number
        ) VALUES (?, 'Dr. João Medeiros', '9988', 'SP', 'B1_AZUL', '2026-11-03', 'Paciente Teste', 'Comprador Teste', '12345678900', 'NOTIF-9988')
      `).run(preSaleId);
      const prescId = Number(prescRun.lastInsertRowid);

      const saleRun = db.prepare(`INSERT INTO sales (pre_sale_id, total_amount) VALUES (?, 60.00)`).run(preSaleId);
      const saleId = Number(saleRun.lastInsertRowid);

      sngpcService.recordSaleMovement({
        productId: prod.productId,
        batchId: prod.batchId,
        quantity: 5,
        referenceId: saleId,
        movementDate: '2026-11-03',
        msRegistration: prod.msRegistration,
        prescriptionId: prescId,
      });

      const livro = sngpcService.getLivroRegistro({
        startDate: '2026-11-01',
        endDate: '2026-11-07',
        productId: prod.productId,
      });

      expect(livro.pharmacyCnpj).toBe('12345678000195');
      expect(livro.pharmacyName).toContain('FarmaCore');
      expect(livro.openingTerm).toBeDefined();
      expect(livro.closingTerm).toBeDefined();
      expect(livro.items).toHaveLength(2);

      // First item: ENTRADA (+50). Initial balance was 100, final balance 150
      expect(livro.items[0].movementType).toBe('ENTRADA');
      expect(livro.items[0].date).toBe('2026-11-02');
      expect(livro.items[0].initialBalance).toBe(100);
      expect(livro.items[0].entryQuantity).toBe(50);
      expect(livro.items[0].exitQuantity).toBe(0);
      expect(livro.items[0].finalBalance).toBe(150);

      // Second item: SAIDA_VENDA (-5). Initial balance was 150, final balance 145
      expect(livro.items[1].movementType).toBe('SAIDA_VENDA');
      expect(livro.items[1].date).toBe('2026-11-03');
      expect(livro.items[1].initialBalance).toBe(150);
      expect(livro.items[1].entryQuantity).toBe(0);
      expect(livro.items[1].exitQuantity).toBe(5);
      expect(livro.items[1].finalBalance).toBe(145);
      expect(livro.items[1].doctorName).toBe('Dr. João Medeiros');
      expect(livro.items[1].doctorCrm).toBe('9988');
      expect(livro.items[1].buyerName).toBe('Comprador Teste');
    });
  });

  describe('generateWeeklyXml', () => {
    it('should generate official XML, store transmission record, and flag movements as transmitted', () => {
      const prod = createTestProduct();

      // Purchase entry
      const invoiceRun = db.prepare(`
        INSERT INTO purchase_invoices (
          access_key, invoice_number, invoice_series, issue_date, supplier_cnpj, supplier_name,
          total_invoice_amount, total_products_amount, xml_content
        ) VALUES ('35261112345678000199550010000012341234567890', 8888, 1, '2026-11-02', '98765432000100', 'Distribuidora', 100, 100, '<xml></xml>')
      `).run();
      const invoiceId = Number(invoiceRun.lastInsertRowid);

      sngpcService.recordEntryMovement({
        productId: prod.productId,
        batchId: prod.batchId,
        quantity: 20,
        referenceId: invoiceId,
        movementDate: '2026-11-02',
        msRegistration: prod.msRegistration,
      });

      // Sale exit
      const preSaleRun = db.prepare(`INSERT INTO pre_sales (code, status, total_amount) VALUES ('PV-12', 'CONVERTED_TO_SALE', 30.00)`).run();
      const preSaleId = Number(preSaleRun.lastInsertRowid);

      const prescRun = db.prepare(`
        INSERT INTO prescriptions (
          pre_sale_id, doctor_name, doctor_crm, doctor_uf, prescription_type,
          prescription_date, patient_name, buyer_name, buyer_cpf, notification_number
        ) VALUES (?, 'Dra. Ana', '7766', 'SP', 'B1_AZUL', '2026-11-03', 'Paciente Ana', 'Paciente Ana', '22233344455', 'NOTIF-7766')
      `).run(preSaleId);
      const prescId = Number(prescRun.lastInsertRowid);

      const saleRun = db.prepare(`INSERT INTO sales (pre_sale_id, total_amount) VALUES (?, 30.00)`).run(preSaleId);
      const saleId = Number(saleRun.lastInsertRowid);

      sngpcService.recordSaleMovement({
        productId: prod.productId,
        batchId: prod.batchId,
        quantity: 2,
        referenceId: saleId,
        movementDate: '2026-11-03',
        msRegistration: prod.msRegistration,
        prescriptionId: prescId,
      });

      const result = sngpcService.generateWeeklyXml({
        startDate: '2026-11-01',
        endDate: '2026-11-07',
        pharmacistName: 'Dr. Roberto Farma',
        pharmacistCpf: '12345678901',
        pharmacistCrf: '54321',
        pharmacistCrfUf: 'SP',
      });

      expect(result.movementsCount).toBe(2);
      expect(result.transmission.id).toBeGreaterThan(0);
      expect(result.transmission.status).toBe('GERADO');
      expect(result.transmission.hashXml).toMatch(/^[a-f0-9]{40}$/);
      expect(result.transmission.xmlContent).toContain('<mensagemSNGPC xmlns="urn:sngpc-schema">');
      expect(result.transmission.xmlContent).toContain('<entradaMedicamentos>');
      expect(result.transmission.xmlContent).toContain('<saidaMedicamentoVendaAoConsumidor>');

      // Verify that movements were marked as transmitted
      const movements = sngpcService.getMovements({ isTransmitted: 0 });
      expect(movements).toHaveLength(0);

      const transmittedMovements = sngpcService.getMovements({ isTransmitted: 1 });
      expect(transmittedMovements).toHaveLength(2);
      expect(transmittedMovements[0].transmissionId).toBe(result.transmission.id);

      // Verify getTransmissions and getTransmissionById
      const allTransmissions = sngpcService.getTransmissions();
      expect(allTransmissions).toHaveLength(1);
      expect(allTransmissions[0].id).toBe(result.transmission.id);

      const single = sngpcService.getTransmissionById(result.transmission.id);
      expect(single).not.toBeNull();
      expect(single?.hashXml).toBe(result.transmission.hashXml);
    });
  });

  describe('POS Checkout Sanitary Integration', () => {
    it('should automatically record SNGPC SAIDA_VENDA movement when checking out controlled item with prescription', () => {
      const prod = createTestProduct({ controlType: 'PORTARIA_344_B1' });

      // Open cash session
      const session = posService.openCashSession('Operador Teste', 100.00);

      // Create pre-sale with prescription
      const preSaleResult = preSaleService.createPreSale({
        items: [{ productId: prod.productId, batchId: prod.batchId, quantity: 2 }],
        prescription: {
          doctorName: 'Dr. Marcos Santos',
          doctorCrm: '445566',
          doctorUf: 'SP',
          prescriptionType: 'B1_AZUL',
          prescriptionDate: '2026-11-05',
          patientName: 'Clarice Lispector',
          buyerName: 'Clarice Lispector',
          buyerCpf: '33344455566',
        },
      });

      // Checkout the pre-sale
      const sale = posService.checkout({
        preSaleCode: preSaleResult.code,
        cashSessionId: session.id,
        payments: [{ method: 'DINHEIRO', amount: 60.00 }],
      });

      expect(sale.sale.id).toBeGreaterThan(0);

      // Verify SNGPC movement was automatically recorded
      const movements = sngpcService.getMovements({
        movementType: 'SAIDA_VENDA',
        productId: prod.productId,
      });

      expect(movements).toHaveLength(1);
      const m = movements[0];
      expect(m.quantity).toBe(2);
      expect(m.referenceId).toBe(sale.sale.id);
      expect(m.msRegistration).toBe(prod.msRegistration);
      expect(m.isTransmitted).toBe(0);
      expect(m.prescriptionId).toBeDefined();
    });

    it('should NOT record SNGPC movement for OTC / ISENTO medicines during checkout', () => {
      const isentoProd = createTestProduct({
        name: 'Dipirona 500mg',
        controlType: 'ISENTO',
        stripe: 'SEM_TARJA',
      });

      const session = posService.openCashSession('Operador 2', 100.00);

      const preSaleResult = preSaleService.createPreSale({
        items: [{ productId: isentoProd.productId, batchId: isentoProd.batchId, quantity: 3 }],
      });

      const sale = posService.checkout({
        preSaleCode: preSaleResult.code,
        cashSessionId: session.id,
        payments: [{ method: 'DINHEIRO', amount: 90.00 }],
      });

      expect(sale.sale.id).toBeGreaterThan(0);

      const movements = sngpcService.getMovements({ productId: isentoProd.productId });
      expect(movements).toHaveLength(0);
    });
  });
});
