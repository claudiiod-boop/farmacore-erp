import { describe, it, expect } from 'vitest';
import { buildNfceXml } from '../../../src/modules/fiscal/xml-builder';
import type { NfceXmlParams, NfceItemInput, NfcePaymentInput, NfceCardInput } from '../../../src/modules/fiscal/xml-builder';
import type { FiscalProfile, CalculatedSaleTaxes } from '../../../src/modules/fiscal/types';

describe('NFC-e XML Builder - Card Group Integration (<card>)', () => {
  const sampleProfile: FiscalProfile = {
    id: 1,
    cnpj: '12.345.678/0001-95',
    ie: '123.456.789.111',
    razaoSocial: 'DROGARIA FARMACORE LTDA',
    nomeFantasia: 'FARMACORE DROGARIA',
    crt: 1,
    cUf: 35, // SP
    municipio: 'SAO PAULO',
    cMun: 3550308,
    logradouro: 'AV PAULISTA',
    numero: '1000',
    bairro: 'BELA VISTA',
    cep: '01310-100',
    serie: 1,
    nextNnf: 100,
    cscToken: 'CSC123456',
    cscId: '000001',
    environment: 'HOMOLOGACAO',
  };

  const sampleAccessKey = '35261112345678000195650010000001001123456780';

  const sampleItem: NfceItemInput = {
    id: 1,
    productId: 10,
    name: 'Dipirona 500mg 20 comp',
    ean: '7891000000011',
    ncm: '3004.90.99',
    cest: '13.001.00',
    cfop: '5102',
    quantity: 1,
    unitPrice: 20.0,
    totalPrice: 20.0,
    tax: {
      vBC: 0,
      pICMS: 0,
      vICMS: 0,
      vBCST: 0,
      pICMSST: 0,
      vICMSST: 0,
      csosn: '102',
      cfop: '5102',
      cstPis: '49',
      vBCPis: 0,
      pPis: 0,
      vPis: 0,
      cstCofins: '49',
      vBCCofins: 0,
      pCofins: 0,
      vCofins: 0,
      vTotTrib: 6.8,
    },
  };

  const sampleTaxes: CalculatedSaleTaxes = {
    vTotTrib: 6.8,
    vICMS: 0,
    vICMSST: 0,
    vPIS: 0,
    vCOFINS: 0,
    items: [sampleItem.tax],
  };

  it('should include <card> group with tpIntegra 1, sanitized 14-digit CNPJ, tBand and cAut when payment has card data', () => {
    const cardData: NfceCardInput = {
      tpIntegra: 1,
      cnpj: '01.027.058/0001-91', // Cielo com máscara
      tBand: '01', // Visa
      cAut: 'AUTH987654',
    };

    const payment: NfcePaymentInput = {
      method: 'CARTAO_CREDITO',
      amount: 20.0,
      card: cardData,
    };

    const params: NfceXmlParams = {
      profile: sampleProfile,
      accessKey: sampleAccessKey,
      nNF: 100,
      serie: 1,
      dhEmi: '2026-11-18T16:00:00-03:00',
      tpEmis: 1,
      tpAmb: 2,
      items: [sampleItem],
      payments: [payment],
      taxes: sampleTaxes,
    };

    const xml = buildNfceXml(params);

    expect(xml).toContain('<detPag>');
    expect(xml).toContain('<tPag>03</tPag>');
    expect(xml).toContain('<vPag>20.00</vPag>');
    expect(xml).toContain('<card>');
    expect(xml).toContain('<tpIntegra>1</tpIntegra>');
    expect(xml).toContain('<CNPJ>01027058000191</CNPJ>');
    expect(xml).toContain('<tBand>01</tBand>');
    expect(xml).toContain('<cAut>AUTH987654</cAut>');
    expect(xml).toContain('</card>');
  });

  it('should escape XML special characters in cAut and sanitize 14-digit CNPJ correctly', () => {
    const cardData: NfceCardInput = {
      tpIntegra: 1,
      cnpj: '12345678000195', // já sem pontuação
      tBand: '02', // Mastercard
      cAut: 'AUTH&<123>',
    };

    const payment: NfcePaymentInput = {
      method: 'CARTAO_DEBITO',
      amount: 20.0,
      card: cardData,
    };

    const params: NfceXmlParams = {
      profile: sampleProfile,
      accessKey: sampleAccessKey,
      nNF: 101,
      serie: 1,
      dhEmi: '2026-11-18T16:00:00-03:00',
      tpEmis: 1,
      tpAmb: 2,
      items: [sampleItem],
      payments: [payment],
      taxes: sampleTaxes,
    };

    const xml = buildNfceXml(params);

    expect(xml).toContain('<tPag>04</tPag>');
    expect(xml).toContain('<CNPJ>12345678000195</CNPJ>');
    expect(xml).toContain('<cAut>AUTH&amp;&lt;123&gt;</cAut>');
  });

  it('should omit <card> group for non-card payments or card payments without card metadata', () => {
    const cashPayment: NfcePaymentInput = {
      method: 'DINHEIRO',
      amount: 10.0,
    };

    const pixPayment: NfcePaymentInput = {
      method: 'PIX',
      amount: 10.0,
    };

    const params: NfceXmlParams = {
      profile: sampleProfile,
      accessKey: sampleAccessKey,
      nNF: 102,
      serie: 1,
      dhEmi: '2026-11-18T16:00:00-03:00',
      tpEmis: 1,
      tpAmb: 2,
      items: [sampleItem],
      payments: [cashPayment, pixPayment],
      taxes: sampleTaxes,
    };

    const xml = buildNfceXml(params);

    expect(xml).not.toContain('<card>');
    expect(xml).not.toContain('<tpIntegra>');
  });
});
