import { describe, it, expect } from 'vitest';
import { buildNfceXml } from '../../../src/modules/fiscal/xml-builder';
import type { NfceXmlParams, NfceItemInput, NfcePaymentInput } from '../../../src/modules/fiscal/xml-builder';
import type { FiscalProfile, CalculatedSaleTaxes } from '../../../src/modules/fiscal/types';

describe('NFC-e SEFAZ 4.00 XML Builder', () => {
  const sampleProfile: FiscalProfile = {
    id: 1,
    cnpj: '12.345.678/0001-95',
    ie: '123.456.789.111',
    razaoSocial: 'DROGARIA FARMACORE LTDA',
    nomeFantasia: 'FARMACORE DROGARIA',
    crt: 1, // Simples Nacional
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

  const sampleItemOtc: NfceItemInput = {
    id: 1,
    productId: 10,
    name: 'Shampoo Anticaspa 200ml',
    ean: '7891000000011',
    ncm: '3305.10.00',
    cest: '20.019.00',
    cfop: '5102',
    quantity: 2,
    unitPrice: 25.0,
    totalPrice: 50.0,
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
      vTotTrib: 19.13,
    },
  };

  const sampleItemMed: NfceItemInput = {
    id: 2,
    productId: 20,
    name: 'Amoxicilina 500mg 21 Cápsulas',
    ean: '7892000000022',
    ncm: '3004.10.12',
    cest: '13.001.00',
    cfop: '5405',
    quantity: 1,
    unitPrice: 40.0,
    totalPrice: 40.0,
    anvisaRegistration: '1004300010011',
    pmc: 45.0,
    batchNumber: 'LOTE123',
    expirationDate: '2027-12-31',
    tax: {
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
      vTotTrib: 13.38,
    },
  };

  const samplePayments: NfcePaymentInput[] = [
    { method: 'DINHEIRO', amount: 50.0 },
    { method: 'PIX', amount: 40.0 },
  ];

  const sampleTaxes: CalculatedSaleTaxes = {
    vTotTrib: 32.51,
    vICMS: 0.0,
    vICMSST: 0.0,
    vPIS: 0.0,
    vCOFINS: 0.0,
    items: [sampleItemOtc.tax, sampleItemMed.tax],
  };

  const sampleParams: NfceXmlParams = {
    profile: sampleProfile,
    accessKey: sampleAccessKey,
    nNF: 100,
    serie: 1,
    dhEmi: '2026-11-06T15:30:00-03:00',
    tpEmis: 1,
    tpAmb: 2,
    items: [sampleItemOtc, sampleItemMed],
    payments: samplePayments,
    taxes: sampleTaxes,
    customerCpf: '123.456.789-00',
    changeAmount: 0.0,
  };

  it('should build a valid NFC-e root and infNFe structure with access key', () => {
    const xml = buildNfceXml(sampleParams);

    expect(xml).toContain('<NFe xmlns="http://www.portalfiscal.inf.br/nfe">');
    expect(xml).toContain(`<infNFe Id="NFe${sampleAccessKey}" versao="4.00">`);
    expect(xml).toContain('</infNFe></NFe>');
  });

  it('should include correct ide block for NFC-e modelo 65', () => {
    const xml = buildNfceXml(sampleParams);

    expect(xml).toContain('<ide>');
    expect(xml).toContain('<cUF>35</cUF>');
    expect(xml).toContain('<natOp>VENDA A CONSUMIDOR</natOp>');
    expect(xml).toContain('<mod>65</mod>');
    expect(xml).toContain('<serie>1</serie>');
    expect(xml).toContain('<nNF>100</nNF>');
    expect(xml).toContain('<dhEmi>2026-11-06T15:30:00-03:00</dhEmi>');
    expect(xml).toContain('<tpNF>1</tpNF>');
    expect(xml).toContain('<idDest>1</idDest>');
    expect(xml).toContain('<cMunFG>3550308</cMunFG>');
    expect(xml).toContain('<tpImp>4</tpImp>');
    expect(xml).toContain('<tpEmis>1</tpEmis>');
    expect(xml).toContain('<tpAmb>2</tpAmb>');
    expect(xml).toContain('<finNFe>1</finNFe>');
    expect(xml).toContain('<indFinal>1</indFinal>');
    expect(xml).toContain('<indPres>1</indPres>');
    expect(xml).toContain('<procEmi>0</procEmi>');
    expect(xml).toContain('<verProc>FarmaCore 1.0</verProc>');
    expect(xml).toContain('</ide>');
  });

  it('should include sanitized emit block with CRT and address', () => {
    const xml = buildNfceXml(sampleParams);

    expect(xml).toContain('<CNPJ>12345678000195</CNPJ>');
    expect(xml).toContain('<xNome>DROGARIA FARMACORE LTDA</xNome>');
    expect(xml).toContain('<xFant>FARMACORE DROGARIA</xFant>');
    expect(xml).toContain('<enderEmit>');
    expect(xml).toContain('<xLgr>AV PAULISTA</xLgr>');
    expect(xml).toContain('<nro>1000</nro>');
    expect(xml).toContain('<xBairro>BELA VISTA</xBairro>');
    expect(xml).toContain('<cMun>3550308</cMun>');
    expect(xml).toContain('<xMun>SAO PAULO</xMun>');
    expect(xml).toContain('<UF>SP</UF>');
    expect(xml).toContain('<CEP>01310100</CEP>');
    expect(xml).toContain('<cPais>1058</cPais>');
    expect(xml).toContain('<xPais>BRASIL</xPais>');
    expect(xml).toContain('</enderEmit>');
    expect(xml).toContain('<IE>123456789111</IE>');
    expect(xml).toContain('<CRT>1</CRT>');
  });

  it('should include dest block when customer CPF is provided, and omit when absent', () => {
    const withCpf = buildNfceXml(sampleParams);
    expect(withCpf).toContain('<dest><CPF>12345678900</CPF><indIEDest>9</indIEDest></dest>');

    const withoutCpf = buildNfceXml({
      ...sampleParams,
      customerCpf: null,
    });
    expect(withoutCpf).not.toContain('<dest>');
    expect(withoutCpf).not.toContain('<CPF>');
  });

  it('should render medication items with med tag containing cProdANVISA and vPMC', () => {
    const xml = buildNfceXml(sampleParams);

    expect(xml).toContain('<det nItem="2">');
    expect(xml).toContain('<cProd>20</cProd>');
    expect(xml).toContain('<xProd>Amoxicilina 500mg 21 Cápsulas</xProd>');
    expect(xml).toContain('<NCM>30041012</NCM>');
    expect(xml).toContain('<CEST>1300100</CEST>');
    expect(xml).toContain('<CFOP>5405</CFOP>');
    expect(xml).toContain('<med>');
    expect(xml).toContain('<cProdANVISA>1004300010011</cProdANVISA>');
    expect(xml).toContain('<vPMC>45.00</vPMC>');
    expect(xml).toContain('</med>');
  });

  it('should render ICMS, PIS and COFINS tags according to tax regime', () => {
    const xml = buildNfceXml(sampleParams);

    // Item 1: CSOSN 102, PIS 49, COFINS 49
    expect(xml).toContain('<ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102>');
    expect(xml).toContain('<PISOutr><CST>49</CST><vBC>0.00</vBC><pPIS>0.00</pPIS><vPIS>0.00</vPIS></PISOutr>');
    expect(xml).toContain('<COFINSOutr><CST>49</CST><vBC>0.00</vBC><pCOFINS>0.00</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr>');

    // Item 2: CSOSN 500, PIS 04, COFINS 04
    expect(xml).toContain('<ICMSSN500><orig>0</orig><CSOSN>500</CSOSN><vBCSTRet>0.00</vBCSTRet><pST>0.00</pST><vICMSSubstituto>0.00</vICMSSubstituto><vICMSSTRet>0.00</vICMSSTRet></ICMSSN500>');
    expect(xml).toContain('<PISNT><CST>04</CST></PISNT>');
    expect(xml).toContain('<COFINSNT><CST>04</CST></COFINSNT>');
  });

  it('should render total ICMSTot matching items and taxes', () => {
    const xml = buildNfceXml(sampleParams);

    expect(xml).toContain('<total><ICMSTot>');
    expect(xml).toContain('<vProd>90.00</vProd>');
    expect(xml).toContain('<vNF>90.00</vNF>');
    expect(xml).toContain('<vTotTrib>32.51</vTotTrib>');
    expect(xml).toContain('<vICMS>0.00</vICMS>');
    expect(xml).toContain('<vPIS>0.00</vPIS>');
    expect(xml).toContain('<vCOFINS>0.00</vCOFINS>');
    expect(xml).toContain('</ICMSTot></total>');
  });

  it('should render multi-tender payments and change amount', () => {
    const xml = buildNfceXml({
      ...sampleParams,
      changeAmount: 10.0,
    });

    expect(xml).toContain('<pag>');
    expect(xml).toContain('<detPag><tPag>01</tPag><vPag>50.00</vPag></detPag>');
    expect(xml).toContain('<detPag><tPag>17</tPag><vPag>40.00</vPag></detPag>');
    expect(xml).toContain('<vTroco>10.00</vTroco>');
    expect(xml).toContain('</pag>');
  });

  it('should include technical manager info (infRespTec)', () => {
    const xml = buildNfceXml(sampleParams);

    expect(xml).toContain('<infRespTec>');
    expect(xml).toContain('<CNPJ>00000000000000</CNPJ>');
    expect(xml).toContain('<xContato>Suporte FarmaCore</xContato>');
    expect(xml).toContain('<email>fiscal@farmacore.local</email>');
    expect(xml).toContain('<fone>11999999999</fone>');
    expect(xml).toContain('</infRespTec>');
  });
});
