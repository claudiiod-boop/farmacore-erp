import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import type {
  PurchaseInvoice,
  PurchaseInvoiceItem,
  ParsedNfeItem,
  ParsedNfeInvoice,
  PurchasePreviewItem,
  PurchasePreviewResult,
  PurchaseImportOptions,
  PurchaseImportResult,
} from '../../../src/modules/purchases/types';
import type {
  SngpcMovementType,
  SngpcReferenceType,
  SngpcTransmissionStatus,
  SngpcMovement,
  SngpcTransmission,
  SngpcTransmissionParams,
  SngpcLivroItem,
  SngpcLivroRegistro,
} from '../../../src/modules/sngpc/types';

describe('Purchases & SNGPC Schema 004 & Types', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should apply migration 004 and create all required tables', () => {
    const tables = db
      .prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      )
      .all()
      .map((r) => r.name);

    expect(tables).toContain('purchase_invoices');
    expect(tables).toContain('purchase_invoice_items');
    expect(tables).toContain('sngpc_movements');
    expect(tables).toContain('sngpc_transmissions');
  });

  it('should verify unique constraint on access_key in purchase_invoices', () => {
    const insertInvoice = db.prepare(`
      INSERT INTO purchase_invoices (
        access_key, invoice_number, invoice_series, issue_date,
        supplier_cnpj, supplier_name, supplier_ie,
        total_invoice_amount, total_products_amount, total_icms_st,
        xml_content
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertInvoice.run(
      '35261112345678000199550010000012341234567890',
      1234,
      1,
      '2026-11-12',
      '12345678000199',
      'Distribuidora Medicamentos SA',
      '123456789',
      1500.50,
      1400.00,
      100.50,
      '<nfeProc></nfeProc>'
    );

    // Duplicate access_key must throw SQLite constraint error
    expect(() => {
      insertInvoice.run(
        '35261112345678000199550010000012341234567890',
        9999,
        1,
        '2026-11-12',
        '98765432000188',
        'Outro Fornecedor LTDA',
        null,
        500.00,
        500.00,
        0,
        '<nfeProc></nfeProc>'
      );
    }).toThrow();
  });

  it('should verify foreign key constraints cascade properly on purchase_invoice_items', () => {
    // Enable foreign keys explicitly in SQLite
    db.exec('PRAGMA foreign_keys = ON;');

    // Insert a product first
    const insertProduct = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const prodResult = insertProduct.run(
      '7891234567890',
      'Amoxicilina 500mg',
      'Amoxicilina',
      '1.0000.0001.001-1',
      'VERMELHA',
      'ANTIBIOTICO',
      35.0,
      20.0,
      28.0
    );
    const productId = Number(prodResult.lastInsertRowid);

    // Insert purchase invoice
    const invoiceResult = db.prepare(`
      INSERT INTO purchase_invoices (
        access_key, invoice_number, invoice_series, issue_date,
        supplier_cnpj, supplier_name, supplier_ie,
        total_invoice_amount, total_products_amount, total_icms_st,
        xml_content
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      '35261112345678000199550010000012341234567891',
      1235,
      1,
      '2026-11-12',
      '12345678000199',
      'Distribuidora Medicamentos SA',
      '123456789',
      100.0,
      100.0,
      0,
      '<nfeProc></nfeProc>'
    );
    const invoiceId = Number(invoiceResult.lastInsertRowid);

    // Insert purchase invoice item
    db.prepare(`
      INSERT INTO purchase_invoice_items (
        purchase_invoice_id, product_id, item_index,
        supplier_product_code, ean, product_name, ncm, cfop,
        quantity, unit_cost, total_cost, batch_number,
        expiration_date, manufacturing_date, anvisa_registration, pmc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoiceId,
      productId,
      1,
      'PROD-001',
      '7891234567890',
      'Amoxicilina 500mg',
      '30041010',
      '5102',
      10,
      10.0,
      100.0,
      'LOT123',
      '2027-12-31',
      '2025-01-01',
      '1000000010011',
      35.0
    );

    const itemsBefore = db.prepare('SELECT COUNT(*) as count FROM purchase_invoice_items WHERE purchase_invoice_id = ?').get(invoiceId) as { count: number };
    expect(itemsBefore.count).toBe(1);

    // Delete purchase invoice -> items must be cascaded
    db.prepare('DELETE FROM purchase_invoices WHERE id = ?').run(invoiceId);

    const itemsAfter = db.prepare('SELECT COUNT(*) as count FROM purchase_invoice_items WHERE purchase_invoice_id = ?').get(invoiceId) as { count: number };
    expect(itemsAfter.count).toBe(0);
  });

  it('should verify prescriptions table has notification_number and buyer_doc_type columns with defaults', () => {
    const cols = db
      .pragma('table_info(prescriptions)')
      .map((col: any) => col.name);

    expect(cols).toContain('notification_number');
    expect(cols).toContain('buyer_doc_type');

    // Create a pre_sale first to satisfy foreign key
    const preSale = db.prepare(`
      INSERT INTO pre_sales (code, total_amount) VALUES ('PRE-001', 50.0)
    `).run();
    const preSaleId = Number(preSale.lastInsertRowid);

    // Insert prescription without specifying buyer_doc_type to test default
    db.prepare(`
      INSERT INTO prescriptions (
        pre_sale_id, doctor_name, doctor_crm, doctor_uf,
        prescription_type, prescription_date, patient_name,
        buyer_name, buyer_cpf, notification_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      preSaleId,
      'Dr. Carlos Silva',
      '12345',
      'SP',
      'RECEITA_BRANCA_2_VIAS',
      '2026-11-12',
      'Paciente A',
      'Comprador A',
      '12345678901',
      'NOTIF-2026-999'
    );

    const presc = db.prepare<any>('SELECT notification_number, buyer_doc_type FROM prescriptions WHERE pre_sale_id = ?').get(preSaleId);
    expect(presc.notification_number).toBe('NOTIF-2026-999');
    expect(presc.buyer_doc_type).toBe('1');
  });

  it('should verify sngpc_movements table constraints on movement_type, quantity, and reference_type', () => {
    db.exec('PRAGMA foreign_keys = ON;');

    // Insert product and batch
    const prod = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('7890000000001', 'Clonazepam 2mg', 'Clonazepam', '1.0000.0002.001-1', 'PRETA', 'B1', 25.0, 15.0, 20.0);
    const productId = Number(prod.lastInsertRowid);

    const batch = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, ?, ?, ?, ?)
    `).run(productId, 'LOT-CLONA-1', '2025-01-01', '2027-01-01', 50);
    const batchId = Number(batch.lastInsertRowid);

    const insertMovement = db.prepare(`
      INSERT INTO sngpc_movements (
        movement_type, product_id, batch_id, quantity,
        reference_type, reference_id, movement_date, ms_registration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Valid insertion
    expect(() => {
      insertMovement.run(
        'ENTRADA',
        productId,
        batchId,
        10,
        'PURCHASE_INVOICE',
        1,
        '2026-11-12',
        '1000000020011'
      );
    }).not.toThrow();

    // Invalid movement_type
    expect(() => {
      insertMovement.run(
        'TRANSFERENCIA',
        productId,
        batchId,
        5,
        'PURCHASE_INVOICE',
        1,
        '2026-11-12',
        '1000000020011'
      );
    }).toThrow();

    // Invalid quantity (0)
    expect(() => {
      insertMovement.run(
        'SAIDA_VENDA',
        productId,
        batchId,
        0,
        'SALE',
        1,
        '2026-11-12',
        '1000000020011'
      );
    }).toThrow();

    // Invalid quantity (< 0)
    expect(() => {
      insertMovement.run(
        'SAIDA_VENDA',
        productId,
        batchId,
        -5,
        'SALE',
        1,
        '2026-11-12',
        '1000000020011'
      );
    }).toThrow();

    // Invalid reference_type
    expect(() => {
      insertMovement.run(
        'PERDA',
        productId,
        batchId,
        1,
        'UNKNOWN_REF',
        1,
        '2026-11-12',
        '1000000020011'
      );
    }).toThrow();
  });

  it('should verify sngpc_transmissions table constraints and default status', () => {
    const insertTransmission = db.prepare(`
      INSERT INTO sngpc_transmissions (
        start_date, end_date, pharmacist_name, pharmacist_cpf,
        pharmacist_crf, pharmacist_crf_uf, xml_content, hash_xml
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertTransmission.run(
      '2026-11-01',
      '2026-11-07',
      'Dra. Farmacêutica Responsável',
      '12345678901',
      '98765',
      'SP',
      '<mensagemSNGPC></mensagemSNGPC>',
      'da39a3ee5e6b4b0d3255bfef95601890afd80709'
    );

    const transmission = db.prepare<any>('SELECT * FROM sngpc_transmissions WHERE id = ?').get(Number(result.lastInsertRowid));
    expect(transmission.status).toBe('GERADO');
    expect(transmission.pharmacist_cpf).toBe('12345678901');

    // Invalid status should throw
    expect(() => {
      db.prepare(`
        INSERT INTO sngpc_transmissions (
          start_date, end_date, pharmacist_name, pharmacist_cpf,
          pharmacist_crf, pharmacist_crf_uf, xml_content, hash_xml, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        '2026-11-01',
        '2026-11-07',
        'Dra. Farmacêutica Responsável',
        '12345678901',
        '98765',
        'SP',
        '<mensagemSNGPC></mensagemSNGPC>',
        'da39a3ee5e6b4b0d3255bfef95601890afd80709',
        'INVALID_STATUS'
      );
    }).toThrow();
  });

  it('should compile and validate domain types compatibility', () => {
    const invoice: PurchaseInvoice = {
      id: 1,
      accessKey: '35261112345678000199550010000012341234567890',
      invoiceNumber: 1234,
      invoiceSeries: 1,
      issueDate: '2026-11-12',
      supplierCnpj: '12345678000199',
      supplierName: 'Distribuidora Medicamentos SA',
      supplierIe: '123456789',
      totalInvoiceAmount: 1500.50,
      totalProductsAmount: 1400.00,
      totalIcmsSt: 100.50,
      xmlContent: '<xml></xml>',
      createdAt: '2026-11-12 10:00:00',
    };
    expect(invoice.accessKey).toHaveLength(44);

    const item: PurchaseInvoiceItem = {
      id: 1,
      purchaseInvoiceId: 1,
      productId: 10,
      batchId: 20,
      itemIndex: 1,
      supplierProductCode: 'MED-01',
      ean: '7891234567890',
      productName: 'Amoxicilina 500mg',
      ncm: '30041010',
      cfop: '5102',
      quantity: 50,
      unitCost: 12.5,
      totalCost: 625.0,
      batchNumber: 'LOT-123',
      expirationDate: '2027-12-31',
      manufacturingDate: '2025-01-01',
      anvisaRegistration: '1000000010011',
      pmc: 35.0,
    };
    expect(item.quantity).toBe(50);

    const parsedItem: ParsedNfeItem = {
      itemIndex: 1,
      supplierProductCode: 'MED-01',
      ean: '7891234567890',
      productName: 'Amoxicilina 500mg',
      ncm: '30041010',
      cfop: '5102',
      quantity: 50,
      unitCost: 12.5,
      totalCost: 625.0,
    };
    expect(parsedItem.totalCost).toBe(625.0);

    const parsedInvoice: ParsedNfeInvoice = {
      accessKey: '35261112345678000199550010000012341234567890',
      invoiceNumber: 1234,
      invoiceSeries: 1,
      issueDate: '2026-11-12',
      supplierCnpj: '12345678000199',
      supplierName: 'Distribuidora Medicamentos SA',
      totalInvoiceAmount: 625.0,
      totalProductsAmount: 625.0,
      totalIcmsSt: 0,
      items: [parsedItem],
    };
    expect(parsedInvoice.items).toHaveLength(1);

    const previewItem: PurchasePreviewItem = {
      ...parsedItem,
      productId: 10,
      isExistingProduct: true,
      cmedWarning: null,
      suggestedPrice: 28.0,
    };
    expect(previewItem.isExistingProduct).toBe(true);

    const previewResult: PurchasePreviewResult = {
      accessKey: parsedInvoice.accessKey,
      invoiceNumber: parsedInvoice.invoiceNumber,
      invoiceSeries: parsedInvoice.invoiceSeries,
      issueDate: parsedInvoice.issueDate,
      supplierCnpj: parsedInvoice.supplierCnpj,
      supplierName: parsedInvoice.supplierName,
      totalInvoiceAmount: parsedInvoice.totalInvoiceAmount,
      totalProductsAmount: parsedInvoice.totalProductsAmount,
      totalIcmsSt: parsedInvoice.totalIcmsSt,
      items: [previewItem],
      newProductsCount: 0,
      existingProductsCount: 1,
      hasCmedAlerts: false,
    };
    expect(previewResult.newProductsCount).toBe(0);

    const importOpts: PurchaseImportOptions = {
      autoRegisterProducts: true,
      itemClassifications: {
        '7891234567890': { stripe: 'VERMELHA', controlType: 'ANTIBIOTICO' },
      },
    };
    expect(importOpts.autoRegisterProducts).toBe(true);

    const importRes: PurchaseImportResult = {
      invoiceId: 1,
      accessKey: parsedInvoice.accessKey,
      batchesCreatedCount: 1,
      productsRegisteredCount: 0,
      totalItems: 1,
    };
    expect(importRes.batchesCreatedCount).toBe(1);

    const movType: SngpcMovementType = 'ENTRADA';
    const refType: SngpcReferenceType = 'PURCHASE_INVOICE';
    const status: SngpcTransmissionStatus = 'GERADO';

    const movement: SngpcMovement = {
      id: 1,
      movementType: movType,
      productId: 10,
      batchId: 20,
      quantity: 50,
      referenceType: refType,
      referenceId: 1,
      movementDate: '2026-11-12',
      msRegistration: '1000000010011',
      isTransmitted: 0,
    };
    expect(movement.movementType).toBe('ENTRADA');

    const transmission: SngpcTransmission = {
      id: 1,
      startDate: '2026-11-01',
      endDate: '2026-11-07',
      pharmacistName: 'Dra. Silva',
      pharmacistCpf: '12345678901',
      pharmacistCrf: '98765',
      pharmacistCrfUf: 'SP',
      xmlContent: '<xml></xml>',
      status,
      hashXml: 'hash123',
    };
    expect(transmission.status).toBe('GERADO');

    const params: SngpcTransmissionParams = {
      startDate: '2026-11-01',
      endDate: '2026-11-07',
      pharmacistName: 'Dra. Silva',
      pharmacistCpf: '12345678901',
      pharmacistCrf: '98765',
      pharmacistCrfUf: 'SP',
    };
    expect(params.pharmacistCpf).toBe('12345678901');

    const livroItem: SngpcLivroItem = {
      date: '2026-11-12',
      movementType: 'ENTRADA',
      documentNumber: 'NF-1234',
      productName: 'Amoxicilina 500mg',
      msRegistration: '1000000010011',
      batchNumber: 'LOT-123',
      initialBalance: 0,
      entryQuantity: 50,
      exitQuantity: 0,
      finalBalance: 50,
    };
    expect(livroItem.finalBalance).toBe(50);

    const livro: SngpcLivroRegistro = {
      pharmacyCnpj: '12345678000199',
      pharmacyName: 'Farmácia Central',
      pharmacistName: 'Dra. Silva',
      pharmacistCrf: '98765',
      pharmacistCrfUf: 'SP',
      startDate: '2026-11-01',
      endDate: '2026-11-07',
      items: [livroItem],
    };
    expect(livro.items).toHaveLength(1);
  });
});
