import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { PurchaseService, PurchaseImportError } from '../../../src/modules/purchases/purchase.service';

describe('PurchaseService (Orquestrador de Compras)', () => {
  let db: Database;
  let purchaseService: PurchaseService;

  const sampleXmlWithMed = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35231012345678000199550010000001231000001234" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <cNF>00000123</cNF>
        <natOp>VENDA DE MERCADORIAS</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>123</nNF>
        <dhEmi>2023-10-25T14:30:00-03:00</dhEmi>
        <tpNF>1</tpNF>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>DISTRIBUIDORA DE MEDICAMENTOS FARMA S/A</xNome>
        <IE>123456789012</IE>
      </emit>
      <dest>
        <CNPJ>98765432000188</CNPJ>
        <xNome>DROGARIA POPULAR LTDA</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>MED001</cProd>
          <cEAN>7891234567890</cEAN>
          <xProd>AMOXICILINA 500MG 21 CAPS</xProd>
          <NCM>30041011</NCM>
          <CFOP>5102</CFOP>
          <uCom>CX</uCom>
          <qCom>50.0000</qCom>
          <vUnCom>12.5000</vUnCom>
          <vProd>625.00</vProd>
          <med>
            <cProdANVISA>1004300120015</cProdANVISA>
            <nLote>LOT12345</nLote>
            <qLote>50.0000</qLote>
            <dFab>2023-01-15</dFab>
            <dVal>2025-01-15</dVal>
            <vPMC>25.90</vPMC>
          </med>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>PERF002</cProd>
          <cEAN>7899876543210</cEAN>
          <xProd>SABONETE DERMATOLOGICO 200ML</xProd>
          <NCM>34011190</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>15.0000</vUnCom>
          <vProd>150.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vST>45.50</vST>
          <vProd>775.00</vProd>
          <vNF>820.50</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

  const sampleXmlSecondInvoice = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35231012345678000199550010000009991000009999" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <cNF>00000999</cNF>
        <serie>1</serie>
        <nNF>999</nNF>
        <dhEmi>2023-11-01T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>99887766000155</CNPJ>
        <xNome>PANPHARMA DISTRIBUIDORA LTDA</xNome>
      </emit>
      <dest><CNPJ>98765432000188</CNPJ></dest>
      <det nItem="1">
        <prod>
          <cProd>DIP01</cProd>
          <cEAN>7891111222333</cEAN>
          <xProd>DIPIRONA SODICA 500MG 10CP</xProd>
          <NCM>30049099</NCM>
          <CFOP>5102</CFOP>
          <qCom>20.0000</qCom>
          <vUnCom>4.5000</vUnCom>
          <vProd>90.00</vProd>
          <med>
            <cProdANVISA>1012345678901</cProdANVISA>
            <nLote>LOTE-DIP-01</nLote>
            <dFab>2023-02-01</dFab>
            <dVal>2025-06-30</dVal>
            <vPMC>8.00</vPMC>
          </med>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vST>0.00</vST>
          <vProd>90.00</vProd>
          <vNF>90.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    purchaseService = new PurchaseService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('previewNfeXml (Dry-run sem efeitos colaterais)', () => {
    it('should cross-reference EANs, detect existing and new products, and identify CMED alerts', () => {
      // Pré-cadastrar o produto 1 com preço superior ao PMC (R$ 30.00 > PMC R$ 25.90)
      db.prepare(`
        INSERT INTO products (
          ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price
        ) VALUES (
          '7891234567890', 'Amoxicilina 500mg', 'Amoxicilina', '1004300120015',
          'VERMELHA', 'ANTIBIOTICO', 25.90, 10.00, 30.00
        )
      `).run();

      const preview = purchaseService.previewNfeXml(sampleXmlWithMed);

      expect(preview.accessKey).toBe('35231012345678000199550010000001231000001234');
      expect(preview.invoiceNumber).toBe(123);
      expect(preview.supplierName).toBe('DISTRIBUIDORA DE MEDICAMENTOS FARMA S/A');
      expect(preview.items).toHaveLength(2);

      // Item 1: Produto existente com preço acima do PMC
      const item1 = preview.items[0];
      expect(item1.ean).toBe('7891234567890');
      expect(item1.isExistingProduct).toBe(true);
      expect(item1.productId).toBeGreaterThan(0);
      expect(item1.pmc).toBe(25.90);
      expect(item1.cmedWarning).toBeDefined();
      expect(item1.cmedWarning).not.toBeNull();
      expect(item1.suggestedPrice).toBe(25.90); // teto CMED sugerido

      // Item 2: Produto não cadastrado
      const item2 = preview.items[1];
      expect(item2.ean).toBe('7899876543210');
      expect(item2.isExistingProduct).toBe(false);
      expect(item2.productId).toBeNull();
      expect(item2.cmedWarning).toBeNull();

      // Métricas agregadas
      expect(preview.existingProductsCount).toBe(1);
      expect(preview.newProductsCount).toBe(1);
      expect(preview.hasCmedAlerts).toBe(true);
    });

    it('should not flag CMED alert when product price is below or equal to PMC', () => {
      // Produto com preço R$ 20.00 <= PMC R$ 25.90
      db.prepare(`
        INSERT INTO products (
          ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price
        ) VALUES (
          '7891234567890', 'Amoxicilina 500mg', 'Amoxicilina', '1004300120015',
          'VERMELHA', 'ANTIBIOTICO', 25.90, 10.00, 20.00
        )
      `).run();

      const preview = purchaseService.previewNfeXml(sampleXmlWithMed);

      expect(preview.items[0].cmedWarning).toBeNull();
      expect(preview.hasCmedAlerts).toBe(false);
    });

    it('should be strictly read-only and have zero side-effects on database', () => {
      const preview = purchaseService.previewNfeXml(sampleXmlWithMed);
      expect(preview.accessKey).toBeDefined();

      const invoices = db.prepare('SELECT COUNT(*) as count FROM purchase_invoices').get() as { count: number };
      const items = db.prepare('SELECT COUNT(*) as count FROM purchase_invoice_items').get() as { count: number };
      const batches = db.prepare('SELECT COUNT(*) as count FROM batches').get() as { count: number };
      const products = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };

      expect(invoices.count).toBe(0);
      expect(items.count).toBe(0);
      expect(batches.count).toBe(0);
      expect(products.count).toBe(0);
    });
  });

  describe('importNfeXml (Importação Atômica & Regras de Negócio)', () => {
    it('should reject already imported invoice access_key with PURCHASE_INVOICE_ALREADY_IMPORTED', () => {
      // Importa pela primeira vez com auto-cadastro
      purchaseService.importNfeXml(sampleXmlWithMed, { autoRegisterProducts: true });

      // Tenta importar novamente
      expect(() => {
        purchaseService.importNfeXml(sampleXmlWithMed, { autoRegisterProducts: true });
      }).toThrowError(/PURCHASE_INVOICE_ALREADY_IMPORTED|Nota fiscal de compra já importada/);

      try {
        purchaseService.importNfeXml(sampleXmlWithMed, { autoRegisterProducts: true });
      } catch (err: any) {
        expect(err.code).toBe('PURCHASE_INVOICE_ALREADY_IMPORTED');
      }
    });

    it('should throw error when product does not exist and autoRegisterProducts is false', () => {
      expect(() => {
        purchaseService.importNfeXml(sampleXmlWithMed, { autoRegisterProducts: false });
      }).toThrowError();
    });

    it('should auto-register new products with classifications and default fiscal data', () => {
      const result = purchaseService.importNfeXml(sampleXmlWithMed, {
        autoRegisterProducts: true,
        itemClassifications: {
          '7891234567890': { stripe: 'VERMELHA', controlType: 'ANTIBIOTICO' },
        },
      });

      expect(result.invoiceId).toBeGreaterThan(0);
      expect(result.productsRegisteredCount).toBe(2);
      expect(result.batchesCreatedCount).toBe(2);

      // Verificar produto cadastrado com classificação informada
      const p1 = db.prepare('SELECT * FROM products WHERE ean = ?').get('7891234567890') as any;
      expect(p1).toBeDefined();
      expect(p1.name).toContain('AMOXICILINA');
      expect(p1.active_ingredient).toBe(p1.name);
      expect(p1.ms_registration).toBe('1004300120015');
      expect(p1.stripe).toBe('VERMELHA');
      expect(p1.control_type).toBe('ANTIBIOTICO');
      expect(p1.ncm).toBe('30041011');
      expect(p1.cfop).toBe('5405');
      expect(p1.csosn_icms).toBe('500');
      expect(p1.cst_pis).toBe('04');

      // Verificar produto cadastrado com valores padrão (SEM_TARJA / ISENTO)
      const p2 = db.prepare('SELECT * FROM products WHERE ean = ?').get('7899876543210') as any;
      expect(p2).toBeDefined();
      expect(p2.stripe).toBe('SEM_TARJA');
      expect(p2.control_type).toBe('ISENTO');
    });

    it('should enforce CMED ceiling by auto-adjusting selling price to PMC when price > PMC', () => {
      // Cadastra produto previamente com preço abusivo acima do PMC (R$ 35.00 > PMC R$ 25.90)
      db.prepare(`
        INSERT INTO products (
          ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price
        ) VALUES (
          '7891234567890', 'Amoxicilina 500mg', 'Amoxicilina', '1004300120015',
          'VERMELHA', 'ANTIBIOTICO', 25.90, 10.00, 35.00
        )
      `).run();

      purchaseService.importNfeXml(sampleXmlWithMed, { autoRegisterProducts: true });

      const updatedProduct = db.prepare('SELECT price, pmc FROM products WHERE ean = ?').get('7891234567890') as any;
      expect(updatedProduct.price).toBe(25.90); // Auto-ajustado para o teto CMED
      expect(updatedProduct.pmc).toBe(25.90);
    });

    it('should create batches in batches table with correct batch_number, dates and quantities', () => {
      purchaseService.importNfeXml(sampleXmlWithMed, { autoRegisterProducts: true });

      const p1 = db.prepare('SELECT id FROM products WHERE ean = ?').get('7891234567890') as any;
      const batches = db.prepare('SELECT * FROM batches WHERE product_id = ?').all(p1.id) as any[];

      expect(batches).toHaveLength(1);
      expect(batches[0].batch_number).toBe('LOT12345');
      expect(batches[0].manufacturing_date).toBe('2023-01-15');
      expect(batches[0].expiration_date).toBe('2025-01-15');
      expect(batches[0].quantity).toBe(50);
      expect(batches[0].reserved_quantity).toBe(0);

      // Verificar item da nota fiscal vinculado ao lote
      const invoiceItem = db.prepare('SELECT * FROM purchase_invoice_items WHERE ean = ?').get('7891234567890') as any;
      expect(invoiceItem.batch_id).toBe(batches[0].id);
      expect(invoiceItem.batch_number).toBe('LOT12345');
      expect(invoiceItem.expiration_date).toBe('2025-01-15');
      expect(invoiceItem.pmc).toBe(25.90);
    });

    it('should record regulatory ENTRADA movement in sngpc_movements table for controlled products', () => {
      purchaseService.importNfeXml(sampleXmlWithMed, {
        autoRegisterProducts: true,
        itemClassifications: {
          '7891234567890': { stripe: 'VERMELHA', controlType: 'ANTIBIOTICO' },
        },
      });

      const movements = db.prepare('SELECT * FROM sngpc_movements').all() as any[];
      // Item 1 é controlado (ANTIBIOTICO), Item 2 é ISENTO
      expect(movements).toHaveLength(1);
      expect(movements[0].movement_type).toBe('ENTRADA');
      expect(movements[0].quantity).toBe(50);
      expect(movements[0].reference_type).toBe('PURCHASE_INVOICE');
      expect(movements[0].movement_date).toBe('2023-10-25');
      expect(movements[0].ms_registration).toBe('1004300120015');
      expect(movements[0].is_transmitted).toBe(0);
    });

    it('should call injected sngpcService.recordEntryMovement when provided', () => {
      const mockSngpcService = {
        recordEntryMovement: vi.fn(),
      };

      const customService = new PurchaseService(db, mockSngpcService);

      customService.importNfeXml(sampleXmlWithMed, {
        autoRegisterProducts: true,
        itemClassifications: {
          '7891234567890': { stripe: 'PRETA', controlType: 'PORTARIA_344_A1' },
        },
      });

      expect(mockSngpcService.recordEntryMovement).toHaveBeenCalledTimes(1);
      expect(mockSngpcService.recordEntryMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'ENTRADA',
          quantity: 50,
          referenceType: 'PURCHASE_INVOICE',
          movementDate: '2023-10-25',
          msRegistration: '1004300120015',
        })
      );
    });

    it('should execute atomically inside a transaction (rollback everything on error)', () => {
      // Simula falha ao passar autoRegisterProducts: false quando o 2º produto não existe
      // Primeiro cadastra o item 1
      db.prepare(`
        INSERT INTO products (
          ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price
        ) VALUES (
          '7891234567890', 'Amoxicilina 500mg', 'Amoxicilina', '1004300120015',
          'VERMELHA', 'ANTIBIOTICO', 25.90, 10.00, 20.00
        )
      `).run();

      // O item 2 não existe e autoRegisterProducts é false -> deve falhar e não salvar nada
      expect(() => {
        purchaseService.importNfeXml(sampleXmlWithMed, { autoRegisterProducts: false });
      }).toThrow();

      const invoiceCount = db.prepare('SELECT COUNT(*) as count FROM purchase_invoices').get() as { count: number };
      const batchCount = db.prepare('SELECT COUNT(*) as count FROM batches').get() as { count: number };
      const sngpcCount = db.prepare('SELECT COUNT(*) as count FROM sngpc_movements').get() as { count: number };

      expect(invoiceCount.count).toBe(0);
      expect(batchCount.count).toBe(0);
      expect(sngpcCount.count).toBe(0);
    });
  });

  describe('Consultas: getInvoices & getInvoiceById', () => {
    it('should list invoices sorted by created_at DESC with itemsCount', () => {
      purchaseService.importNfeXml(sampleXmlWithMed, { autoRegisterProducts: true });
      purchaseService.importNfeXml(sampleXmlSecondInvoice, { autoRegisterProducts: true });

      const invoices = purchaseService.getInvoices();
      expect(invoices).toHaveLength(2);
      expect(invoices[0].invoiceNumber).toBe(999);
      expect(invoices[0].supplierName).toBe('PANPHARMA DISTRIBUIDORA LTDA');
      expect(invoices[0].itemsCount).toBe(1);

      expect(invoices[1].invoiceNumber).toBe(123);
      expect(invoices[1].supplierName).toBe('DISTRIBUIDORA DE MEDICAMENTOS FARMA S/A');
      expect(invoices[1].itemsCount).toBe(2);
    });

    it('should return invoice details with items and batches by ID or null if not found', () => {
      const importResult = purchaseService.importNfeXml(sampleXmlWithMed, { autoRegisterProducts: true });

      const details = purchaseService.getInvoiceById(importResult.invoiceId);
      expect(details).not.toBeNull();
      expect(details?.accessKey).toBe('35231012345678000199550010000001231000001234');
      expect(details?.supplierCnpj).toBe('12345678000199');
      expect(details?.items).toHaveLength(2);

      const itemWithBatch = details?.items.find((i) => i.ean === '7891234567890');
      expect(itemWithBatch?.batchNumber).toBe('LOT12345');
      expect(itemWithBatch?.batch?.batchNumber).toBe('LOT12345');
      expect(itemWithBatch?.batch?.quantity).toBe(50);

      const notFound = purchaseService.getInvoiceById(999999);
      expect(notFound).toBeNull();
    });
  });
});
