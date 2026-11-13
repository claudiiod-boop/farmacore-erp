import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { Database, getDatabase } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify Purchases Routes (/api/purchases/*)', () => {
  let app: FastifyInstance;
  let db: Database;

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

  const sampleXmlSecond = `<?xml version="1.0" encoding="UTF-8"?>
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
          <uCom>CX</uCom>
          <qCom>100.0000</qCom>
          <vUnCom>4.5000</vUnCom>
          <vProd>450.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vST>0.00</vST>
          <vProd>450.00</vProd>
          <vNF>450.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);
    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('POST /api/purchases/preview-xml', () => {
    it('should return 200 with preview summary for valid NF-e XML', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/purchases/preview-xml',
        payload: {
          xmlContent: sampleXmlWithMed,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.accessKey).toBe('35231012345678000199550010000001231000001234');
      expect(data.invoiceNumber).toBe(123);
      expect(data.supplierCnpj).toBe('12345678000199');
      expect(data.supplierName).toBe('DISTRIBUIDORA DE MEDICAMENTOS FARMA S/A');
      expect(data.items).toHaveLength(2);
      expect(data.newProductsCount).toBe(2);
      expect(data.existingProductsCount).toBe(0);
      expect(data.items[0].anvisaRegistration).toBe('1004300120015');
      expect(data.items[0].batchNumber).toBe('LOT12345');
    });

    it('should return 400 when xmlContent is missing or empty', async () => {
      const resMissing = await app.inject({
        method: 'POST',
        url: '/api/purchases/preview-xml',
        payload: {},
      });
      expect(resMissing.statusCode).toBe(400);

      const resEmpty = await app.inject({
        method: 'POST',
        url: '/api/purchases/preview-xml',
        payload: { xmlContent: '' },
      });
      expect(resEmpty.statusCode).toBe(400);
    });

    it('should return 400 when xmlContent is invalid XML', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/purchases/preview-xml',
        payload: {
          xmlContent: '<invalid>not a valid nfe</invalid>',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.code).toBeDefined();
    });
  });

  describe('POST /api/purchases/import-xml', () => {
    it('should return 201 and import invoice when autoRegisterProducts is true', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/purchases/import-xml',
        payload: {
          xmlContent: sampleXmlWithMed,
          autoRegisterProducts: true,
          itemClassifications: {
            '7891234567890': { stripe: 'VERMELHA', controlType: 'PORTARIA_344_C1' },
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.invoiceId).toBeGreaterThan(0);
      expect(data.accessKey).toBe('35231012345678000199550010000001231000001234');
      expect(data.batchesCreatedCount).toBe(2);
      expect(data.productsRegisteredCount).toBe(2);

      // Verify product was registered with custom classification
      const product = db
        .prepare<any>('SELECT * FROM products WHERE ean = ?')
        .get('7891234567890');
      expect(product).toBeDefined();
      expect(product.stripe).toBe('VERMELHA');
      expect(product.control_type).toBe('PORTARIA_344_C1');

      // Verify regulatory SNGPC entry movement was created for controlled medication
      const sngpcMov = db
        .prepare<any>('SELECT * FROM sngpc_movements WHERE product_id = ?')
        .get(product.id);
      expect(sngpcMov).toBeDefined();
      expect(sngpcMov.movement_type).toBe('ENTRADA');
      expect(sngpcMov.quantity).toBe(50);
    });

    it('should return 400 when product does not exist and autoRegisterProducts is false', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/purchases/import-xml',
        payload: {
          xmlContent: sampleXmlWithMed,
          autoRegisterProducts: false,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('should return 409 when importing the same invoice twice', async () => {
      // First import
      const first = await app.inject({
        method: 'POST',
        url: '/api/purchases/import-xml',
        payload: {
          xmlContent: sampleXmlWithMed,
          autoRegisterProducts: true,
        },
      });
      expect(first.statusCode).toBe(201);

      // Second import with identical access key
      const second = await app.inject({
        method: 'POST',
        url: '/api/purchases/import-xml',
        payload: {
          xmlContent: sampleXmlWithMed,
          autoRegisterProducts: true,
        },
      });

      expect(second.statusCode).toBe(409);
      const body = second.json();
      expect(body.code).toBe('PURCHASE_INVOICE_ALREADY_IMPORTED');
    });

    it('should return 400 when xmlContent is missing or malformed', async () => {
      const resMissing = await app.inject({
        method: 'POST',
        url: '/api/purchases/import-xml',
        payload: {},
      });
      expect(resMissing.statusCode).toBe(400);

      const resMalformed = await app.inject({
        method: 'POST',
        url: '/api/purchases/import-xml',
        payload: { xmlContent: '<broken>' },
      });
      expect(resMalformed.statusCode).toBe(400);
      expect(resMalformed.json().code).toBe('INVALID_NFE_XML');
    });
  });

  describe('GET /api/purchases/invoices', () => {
    it('should return 200 with list of imported invoices', async () => {
      // Import two invoices
      await app.inject({
        method: 'POST',
        url: '/api/purchases/import-xml',
        payload: { xmlContent: sampleXmlWithMed, autoRegisterProducts: true },
      });
      await app.inject({
        method: 'POST',
        url: '/api/purchases/import-xml',
        payload: { xmlContent: sampleXmlSecond, autoRegisterProducts: true },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/purchases/invoices',
      });

      expect(response.statusCode).toBe(200);
      const invoices = response.json();
      expect(Array.isArray(invoices)).toBe(true);
      expect(invoices).toHaveLength(2);
      expect(invoices[0].invoiceNumber).toBe(999); // Ordered DESC
      expect(invoices[1].invoiceNumber).toBe(123);
    });
  });

  describe('GET /api/purchases/invoices/:id', () => {
    it('should return 200 with invoice details and items for valid ID', async () => {
      const importRes = await app.inject({
        method: 'POST',
        url: '/api/purchases/import-xml',
        payload: { xmlContent: sampleXmlWithMed, autoRegisterProducts: true },
      });
      const invoiceId = importRes.json().invoiceId;

      const response = await app.inject({
        method: 'GET',
        url: `/api/purchases/invoices/${invoiceId}`,
      });

      expect(response.statusCode).toBe(200);
      const details = response.json();
      expect(details.id).toBe(invoiceId);
      expect(details.accessKey).toBe('35231012345678000199550010000001231000001234');
      expect(details.items).toHaveLength(2);
      expect(details.items[0].batch).toBeDefined();
      expect(details.items[0].batch.batchNumber).toBe('LOT12345');
    });

    it('should return 404 for non-existent invoice ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/purchases/invoices/999999',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.code).toBe('PURCHASE_INVOICE_NOT_FOUND');
    });

    it('should return 400 for non-numeric invoice ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/purchases/invoices/invalid-id',
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.code).toBe('INVALID_ID');
    });
  });
});
