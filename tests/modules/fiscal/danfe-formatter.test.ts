import { describe, it, expect } from 'vitest';
import { formatDanfeNfce, NfceInvoiceDetails } from '../../../src/modules/fiscal/danfe-formatter';
import type { FiscalProfile, NfceInvoice } from '../../../src/modules/fiscal/types';

describe('Thermal DANFE Formatter (48 Columns ESC/POS)', () => {
  const sampleProfile: FiscalProfile = {
    id: 1,
    cnpj: '12.345.678/0001-90',
    ie: '123.456.789.111',
    razaoSocial: 'DROGARIA POPULAR FARMACORE LTDA',
    nomeFantasia: 'DROGARIA POPULAR',
    crt: 1,
    cUf: 35,
    municipio: 'São Paulo',
    cMun: 3550308,
    logradouro: 'Av. Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    cep: '01310-100',
    serie: 1,
    nextNnf: 100,
    cscToken: 'TEST-TOKEN-123',
    cscId: '000001',
    environment: 'HOMOLOGACAO',
  };

  const sampleAuthorizedInvoice: NfceInvoice = {
    id: 1,
    saleId: 42,
    chNFe: '35261112345678000190650010000001001123456781',
    nNF: 100,
    serie: 1,
    tpAmb: 2,
    tpEmis: 1,
    status: 'AUTORIZADA',
    protocolNumber: '135260000123456',
    protocolDate: '2026-11-06T15:30:00-03:00',
    xmlSigned: '<NFe>...</NFe>',
    xmlAuthorized: '<nfeProc>...</nfeProc>',
    qrCodeUrl: 'https://www.fazenda.sp.gov.br/nfce/qrcode?p=35261112345678000190650010000001001123456781|2|2|000001|hash123',
    digestValue: 'digestBase64==',
    cStat: 100,
    xMotivo: 'Autorizado o uso da NF-e',
    cancellationReason: null,
    createdAt: '2026-11-06T15:30:00-03:00',
  };

  const sampleDetails: NfceInvoiceDetails = {
    invoice: sampleAuthorizedInvoice,
    profile: sampleProfile,
    items: [
      {
        name: 'Dipirona 500mg 10 comprimidos Medley',
        ean: '7891234567890',
        quantity: 2,
        unitPrice: 8.5,
        totalPrice: 17.0,
      },
      {
        name: 'Amoxicilina 500mg 21 capsulas EMS',
        ean: '7899876543210',
        quantity: 1,
        unitPrice: 28.9,
        totalPrice: 28.9,
      },
    ],
    payments: [
      {
        method: 'DINHEIRO',
        amount: 50.0,
      },
    ],
    taxes: {
      vTotTrib: 15.35,
      vICMS: 0,
      vICMSST: 0,
      vPIS: 0,
      vCOFINS: 0,
      items: [
        {
          vBC: 0,
          pICMS: 0,
          vICMS: 0,
          vBCST: 0,
          pICMSST: 0,
          vICMSST: 0,
          csosn: '500',
          cfop: '5405',
          cstPis: '04',
          vBCPis: 0,
          pPis: 0,
          vPis: 0,
          cstCofins: '04',
          vBCCofins: 0,
          pCofins: 0,
          vCofins: 0,
          vTotTrib: 5.69,
        },
        {
          vBC: 0,
          pICMS: 0,
          vICMS: 0,
          vBCST: 0,
          pICMSST: 0,
          vICMSST: 0,
          csosn: '500',
          cfop: '5405',
          cstPis: '04',
          vBCPis: 0,
          pPis: 0,
          vPis: 0,
          cstCofins: '04',
          vBCCofins: 0,
          pCofins: 0,
          vCofins: 0,
          vTotTrib: 9.66,
        },
      ],
    },
    customerCpf: '123.456.789-00',
    changeAmount: 4.1,
  };

  it('should format receipt strictly within 48 columns per line', () => {
    const danfe = formatDanfeNfce(sampleDetails);
    expect(danfe).toBeDefined();

    const lines = danfe.split('\n');
    for (const [idx, line] of lines.entries()) {
      // Stripping trailing \r if any
      const cleanLine = line.replace(/\r$/, '');
      expect(
        cleanLine.length,
        `Line ${idx + 1} exceeds 48 columns: "${cleanLine}" (length: ${cleanLine.length})`
      ).toBeLessThanOrEqual(48);
    }
  });

  it('should include required SEFAZ headers and corporate information', () => {
    const danfe = formatDanfeNfce(sampleDetails);

    expect(danfe).toContain('DROGARIA POPULAR');
    expect(danfe).toContain('DROGARIA POPULAR FARMACORE LTDA');
    expect(danfe).toContain('12.345.678/0001-90');
    expect(danfe).toContain('DANFE NFC-e - Documento Auxiliar da');
    expect(danfe).toContain('Nota Fiscal de Consumidor Eletrônica');
    expect(danfe).toContain('NÃO PERMITE APROVEITAMENTO DE CRÉDITO DE ICMS');
  });

  it('should format items table with description, quantity, price and total', () => {
    const danfe = formatDanfeNfce(sampleDetails);

    expect(danfe).toContain('Dipirona 500mg');
    expect(danfe).toContain('Amoxicilina 500mg');
    expect(danfe).toContain('17,00');
    expect(danfe).toContain('28,90');
  });

  it('should format totals, payment method and change amount', () => {
    const danfe = formatDanfeNfce(sampleDetails);

    expect(danfe).toContain('QTD. TOTAL DE ITENS');
    expect(danfe).toContain('2');
    expect(danfe).toContain('VALOR TOTAL R$');
    expect(danfe).toContain('45,90');
    expect(danfe).toContain('DINHEIRO');
    expect(danfe).toContain('50,00');
    expect(danfe).toContain('Troco R$');
    expect(danfe).toContain('4,10');
  });

  it('should include IBPT approximate tax transparency (Lei 12.741/2012)', () => {
    const danfe = formatDanfeNfce(sampleDetails);

    expect(danfe).toContain('Tributos Totais Incidentes');
    expect(danfe).toContain('12.741/2012');
    expect(danfe).toContain('15,35');
  });

  it('should format access key in 11 groups of 4 digits, protocol and QR code URL', () => {
    const danfe = formatDanfeNfce(sampleDetails);

    // Formatted in 11 groups of 4 digits wrapped into 2 centered lines (max 48 cols)
    expect(danfe).toContain('3526 1112 3456 7800 0190 6500');
    expect(danfe).toContain('1000 0001 0011 2345 6781');
    expect(danfe).toContain('135260000123456');
    expect(danfe).toContain('CONSULTA VIA LEITOR DE QR CODE');
    expect(danfe).toContain('https://www.fazenda.sp.gov.br/nfce/qrcode?p=');
    expect(danfe).toContain('CONSUMIDOR CPF: 123.456.789-00');
  });

  it('should display CONSUMIDOR NÃO IDENTIFICADO when customer CPF is not provided', () => {
    const detailsNoCpf: NfceInvoiceDetails = {
      ...sampleDetails,
      customerCpf: null,
    };

    const danfe = formatDanfeNfce(detailsNoCpf);
    expect(danfe).toContain('CONSUMIDOR NÃO IDENTIFICADO');
  });

  it('should format contingency emission (tpEmis = 9) with prominent warning block', () => {
    const contingencyInvoice: NfceInvoice = {
      ...sampleAuthorizedInvoice,
      tpEmis: 9,
      status: 'CONTINGENCIA',
      protocolNumber: null,
      protocolDate: null,
    };

    const contingencyDetails: NfceInvoiceDetails = {
      ...sampleDetails,
      invoice: contingencyInvoice,
    };

    const danfe = formatDanfeNfce(contingencyDetails);

    expect(danfe).toContain('EMITIDA EM CONTINGÊNCIA - PENDENTE DE');
    expect(danfe).toContain('AUTORIZAÇÃO');
    expect(danfe).not.toContain('Protocolo de Autorização');
  });
});
