import { describe, it, expect } from 'vitest';
import { parseNfeXml, NfeParseError } from '../../../src/modules/purchases/nfe-parser';

describe('NF-e 4.00 Parser (nfe-parser)', () => {
  const sampleNfeProcXml = `<?xml version="1.0" encoding="UTF-8"?>
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
        <xFant>FARMA DISTRIBUIDORA</xFant>
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
          <xProd>AMOXICILINA 500MG 21 CAPSULAS &amp; CIA</xProd>
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
          <xProd>SABONETE LIQUIDO DERMATOLOGICO 200ML</xProd>
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
          <vBC>775.00</vBC>
          <vICMS>139.50</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>45.50</vST>
          <vProd>775.00</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>5.04</vPIS>
          <vCOFINS>23.25</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>820.50</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

  it('should parse a complete NF-e with <nfeProc> envelope and pharmaceutical <med> block', () => {
    const invoice = parseNfeXml(sampleNfeProcXml);

    expect(invoice.accessKey).toBe('35231012345678000199550010000001231000001234');
    expect(invoice.invoiceNumber).toBe(123);
    expect(invoice.invoiceSeries).toBe(1);
    expect(invoice.issueDate).toBe('2023-10-25');
    expect(invoice.supplierCnpj).toBe('12345678000199');
    expect(invoice.supplierName).toBe('DISTRIBUIDORA DE MEDICAMENTOS FARMA S/A');
    expect(invoice.supplierIe).toBe('123456789012');
    expect(invoice.totalInvoiceAmount).toBe(820.5);
    expect(invoice.totalProductsAmount).toBe(775.0);
    expect(invoice.totalIcmsSt).toBe(45.5);

    expect(invoice.items).toHaveLength(2);

    // Item 1: Medicamento com tag <med>
    const item1 = invoice.items[0];
    expect(item1.itemIndex).toBe(1);
    expect(item1.supplierProductCode).toBe('MED001');
    expect(item1.ean).toBe('7891234567890');
    expect(item1.productName).toBe('AMOXICILINA 500MG 21 CAPSULAS & CIA');
    expect(item1.ncm).toBe('30041011');
    expect(item1.cfop).toBe('5102');
    expect(item1.quantity).toBe(50);
    expect(item1.unitCost).toBe(12.5);
    expect(item1.totalCost).toBe(625.0);
    expect(item1.anvisaRegistration).toBe('1004300120015');
    expect(item1.batchNumber).toBe('LOT12345');
    expect(item1.manufacturingDate).toBe('2023-01-15');
    expect(item1.expirationDate).toBe('2025-01-15');
    expect(item1.pmc).toBe(25.9);

    // Item 2: Produto sem <med> (dermocosmético / higiene)
    const item2 = invoice.items[1];
    expect(item2.itemIndex).toBe(2);
    expect(item2.supplierProductCode).toBe('PERF002');
    expect(item2.ean).toBe('7899876543210');
    expect(item2.productName).toBe('SABONETE LIQUIDO DERMATOLOGICO 200ML');
    expect(item2.ncm).toBe('34011190');
    expect(item2.cfop).toBe('5102');
    expect(item2.quantity).toBe(10);
    expect(item2.unitCost).toBe(15.0);
    expect(item2.totalCost).toBe(150.0);
    expect(item2.batchNumber).toBeFalsy();
    expect(item2.expirationDate).toBeFalsy();
    expect(item2.anvisaRegistration).toBeFalsy();
    expect(item2.pmc).toBeFalsy();
  });

  it('should parse an NF-e without <nfeProc> envelope (standalone <NFe>)', () => {
    const rawNfeXml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
      <infNFe Id="NFe41231199887766000155550020000054321098765432" versao="4.00">
        <ide>
          <nNF>5432</nNF>
          <serie>2</serie>
          <dhEmi>2023-11-01</dhEmi>
        </ide>
        <emit>
          <CNPJ>99887766000155</CNPJ>
          <xNome>DROGAS SUL DISTRIBUIDORA LTDA</xNome>
        </emit>
        <det nItem="1">
          <prod>
            <cProd>DIP500</cProd>
            <cEAN>7891000100010</cEAN>
            <xProd>DIPIRONA SODICA 500MG GTS 20ML</xProd>
            <NCM>30049099</NCM>
            <CFOP>5102</CFOP>
            <qCom>100</qCom>
            <vUnCom>4.20</vUnCom>
            <vProd>420.00</vProd>
            <med>
              <cProdANVISA>1018101230011</cProdANVISA>
              <nLote>DIP2023B</nLote>
              <qLote>100</qLote>
              <dFab>2023-05-10</dFab>
              <dVal>2025-05-10</dVal>
            </med>
          </prod>
        </det>
        <total>
          <ICMSTot>
            <vProd>420.00</vProd>
            <vST>0.00</vST>
            <vNF>420.00</vNF>
          </ICMSTot>
        </total>
      </infNFe>
    </NFe>`;

    const invoice = parseNfeXml(rawNfeXml);
    expect(invoice.accessKey).toBe('41231199887766000155550020000054321098765432');
    expect(invoice.invoiceNumber).toBe(5432);
    expect(invoice.invoiceSeries).toBe(2);
    expect(invoice.issueDate).toBe('2023-11-01');
    expect(invoice.supplierCnpj).toBe('99887766000155');
    expect(invoice.supplierName).toBe('DROGAS SUL DISTRIBUIDORA LTDA');
    expect(invoice.totalInvoiceAmount).toBe(420.0);
    expect(invoice.totalProductsAmount).toBe(420.0);
    expect(invoice.totalIcmsSt).toBe(0.0);
    expect(invoice.items).toHaveLength(1);
    expect(invoice.items[0].batchNumber).toBe('DIP2023B');
    expect(invoice.items[0].pmc).toBeNull();
  });

  it('should split item into multiple ParsedNfeItem when multiple <med> batches exist in a single <det>', () => {
    const multiLotXml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
      <infNFe Id="NFe35231012345678000199550010000001231000009999" versao="4.00">
        <ide>
          <nNF>9999</nNF>
          <serie>1</serie>
          <dhEmi>2023-10-30T10:00:00-03:00</dhEmi>
        </ide>
        <emit>
          <CNPJ>12345678000199</CNPJ>
          <xNome>DISTRIBUIDORA MULTILOTE S/A</xNome>
        </emit>
        <det nItem="1">
          <prod>
            <cProd>PARACETAMOL500</cProd>
            <cEAN>7895555555555</cEAN>
            <xProd>PARACETAMOL 500MG 20 CPR</xProd>
            <NCM>30049099</NCM>
            <CFOP>5102</CFOP>
            <qCom>150.00</qCom>
            <vUnCom>5.00</vUnCom>
            <vProd>750.00</vProd>
            <med>
              <cProdANVISA>1037000110011</cProdANVISA>
              <nLote>LOTE-A</nLote>
              <qLote>50.00</qLote>
              <dFab>2023-01-01</dFab>
              <dVal>2025-01-01</dVal>
              <vPMC>12.00</vPMC>
            </med>
            <med>
              <cProdANVISA>1037000110011</cProdANVISA>
              <nLote>LOTE-B</nLote>
              <qLote>100.00</qLote>
              <dFab>2023-02-01</dFab>
              <dVal>2025-02-01</dVal>
              <vPMC>12.00</vPMC>
            </med>
          </prod>
        </det>
        <total>
          <ICMSTot>
            <vProd>750.00</vProd>
            <vST>0.00</vST>
            <vNF>750.00</vNF>
          </ICMSTot>
        </total>
      </infNFe>
    </NFe>`;

    const invoice = parseNfeXml(multiLotXml);
    expect(invoice.items).toHaveLength(2);

    expect(invoice.items[0].supplierProductCode).toBe('PARACETAMOL500');
    expect(invoice.items[0].batchNumber).toBe('LOTE-A');
    expect(invoice.items[0].quantity).toBe(50.0);
    expect(invoice.items[0].unitCost).toBe(5.0);
    expect(invoice.items[0].totalCost).toBe(250.0);
    expect(invoice.items[0].expirationDate).toBe('2025-01-01');

    expect(invoice.items[1].supplierProductCode).toBe('PARACETAMOL500');
    expect(invoice.items[1].batchNumber).toBe('LOTE-B');
    expect(invoice.items[1].quantity).toBe(100.0);
    expect(invoice.items[1].unitCost).toBe(5.0);
    expect(invoice.items[1].totalCost).toBe(500.0);
    expect(invoice.items[1].expirationDate).toBe('2025-02-01');
  });

  describe('Error handling', () => {
    it('should throw NfeParseError for empty or whitespace XML', () => {
      expect(() => parseNfeXml('')).toThrow(NfeParseError);
      expect(() => parseNfeXml('   \n  ')).toThrowError(/vazio/i);
    });

    it('should throw NfeParseError for non-XML or missing infNFe', () => {
      expect(() => parseNfeXml('<hello>world</hello>')).toThrow(NfeParseError);
      try {
        parseNfeXml('<hello>world</hello>');
      } catch (err) {
        expect(err).toBeInstanceOf(NfeParseError);
        expect((err as NfeParseError).code).toBe('INVALID_NFE_XML');
      }
    });

    it('should throw NfeParseError if access key is invalid or not 44 digits', () => {
      const invalidKeyXml = `<NFe><infNFe Id="NFe123"><ide><nNF>1</nNF></ide></infNFe></NFe>`;
      expect(() => parseNfeXml(invalidKeyXml)).toThrowError(/chave de acesso/i);
    });

    it('should parse XML with explicit namespace prefix (e.g. nfe:infNFe, nfe:det)', () => {
      const prefixedXml = `<nfe:NFe xmlns:nfe="http://www.portalfiscal.inf.br/nfe">
        <nfe:infNFe Id="NFe35231012345678000199550010000001231000001234" versao="4.00">
          <nfe:ide>
            <nfe:nNF>999</nfe:nNF>
            <nfe:serie>1</nfe:serie>
            <nfe:dhEmi>2023-11-01T10:00:00-03:00</nfe:dhEmi>
          </nfe:ide>
          <nfe:emit>
            <nfe:CNPJ>12345678000199</nfe:CNPJ>
            <nfe:xNome>DISTRIBUIDORA PREFIXADA S/A</nfe:xNome>
          </nfe:emit>
          <nfe:total>
            <nfe:ICMSTot>
              <nfe:vNF>100.00</nfe:vNF>
              <nfe:vProd>100.00</nfe:vProd>
            </nfe:ICMSTot>
          </nfe:total>
          <nfe:det nItem="1">
            <nfe:prod>
              <nfe:cProd>PROD01</nfe:cProd>
              <nfe:cEAN>7890000000001</nfe:cEAN>
              <nfe:xProd>PRODUTO PREFIXADO</nfe:xProd>
              <nfe:NCM>30049099</nfe:NCM>
              <nfe:CFOP>5102</nfe:CFOP>
              <nfe:qCom>10</nfe:qCom>
              <nfe:vUnCom>10.00</nfe:vUnCom>
              <nfe:vProd>100.00</nfe:vProd>
            </nfe:prod>
          </nfe:det>
        </nfe:infNFe>
      </nfe:NFe>`;
      const parsed = parseNfeXml(prefixedXml);
      expect(parsed.accessKey).toBe('35231012345678000199550010000001231000001234');
      expect(parsed.invoiceNumber).toBe(999);
      expect(parsed.supplierName).toBe('DISTRIBUIDORA PREFIXADA S/A');
      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].productName).toBe('PRODUTO PREFIXADO');
    });
  });
});
