import type {
  CalculatedItemTax,
  CalculatedSaleTaxes,
  FiscalProfile,
} from './types';

export interface NfceItemInput {
  id: number;
  productId: number;
  name: string;
  ean: string;
  ncm: string;
  cest?: string;
  cfop: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  anvisaRegistration?: string;
  pmc?: number;
  batchNumber?: string;
  expirationDate?: string;
  tax: CalculatedItemTax;
}

export interface NfceCardInput {
  tpIntegra: 1 | 2;
  cnpj: string;
  tBand: string;
  cAut: string;
}

export interface NfcePaymentInput {
  method: string; // 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX'
  amount: number;
  card?: NfceCardInput;
}

export interface NfceXmlParams {
  profile: FiscalProfile;
  accessKey: string;
  nNF: number;
  serie: number;
  dhEmi: string; // YYYY-MM-DDTHH:mm:ss-03:00
  tpEmis: number; // 1 or 9
  tpAmb: number; // 1 (Prod) or 2 (Homolog)
  items: NfceItemInput[];
  payments: NfcePaymentInput[];
  taxes: CalculatedSaleTaxes;
  customerCpf?: string | null;
  changeAmount?: number;
}

const UF_MAP: Record<number, string> = {
  11: 'RO',
  12: 'AC',
  13: 'AM',
  14: 'RR',
  15: 'PA',
  16: 'AP',
  17: 'TO',
  21: 'MA',
  22: 'PI',
  23: 'CE',
  24: 'RN',
  25: 'PB',
  26: 'PE',
  27: 'AL',
  28: 'SE',
  29: 'BA',
  31: 'MG',
  32: 'ES',
  33: 'RJ',
  35: 'SP',
  41: 'PR',
  42: 'SC',
  43: 'RS',
  50: 'MS',
  51: 'MT',
  52: 'GO',
  53: 'DF',
};

const PAYMENT_METHOD_MAP: Record<string, string> = {
  DINHEIRO: '01',
  '01': '01',
  CHEQUE: '02',
  '02': '02',
  CARTAO_CREDITO: '03',
  '03': '03',
  CARTAO_DEBITO: '04',
  '04': '04',
  CREDITO_LOJA: '05',
  '05': '05',
  VALE_ALIMENTACAO: '10',
  '10': '10',
  VALE_REFEICAO: '11',
  '11': '11',
  VALE_PRESENTE: '12',
  '12': '12',
  VALE_COMBUSTIVEL: '13',
  '13': '13',
  BOLETO_BANCARIO: '15',
  '15': '15',
  DEPOSITO_BANCARIO: '16',
  '16': '16',
  PIX: '17',
  '17': '17',
  TRANSFERENCIA_BANCARIA: '18',
  '18': '18',
  SEM_PAGAMENTO: '90',
  '90': '90',
  CONVENIO_PBM: '99',
  OUTROS: '99',
  '99': '99',
};

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds the canonical SEFAZ 4.00 XML for NFC-e (Modelo 65).
 */
export function buildNfceXml(params: NfceXmlParams): string {
  const { profile, accessKey, nNF, serie, dhEmi, tpEmis, tpAmb, items, payments, taxes, customerCpf, changeAmount } =
    params;

  const cleanCnpj = profile.cnpj.replace(/\D/g, '');
  const cleanIe = profile.ie.replace(/\D/g, '');
  const cleanCep = profile.cep.replace(/\D/g, '');
  const cleanCpf = customerCpf ? customerCpf.replace(/\D/g, '') : null;
  const uf = UF_MAP[profile.cUf] || 'SP';

  const cNF = accessKey.substring(35, 43);
  const cDV = accessKey.substring(43, 44);

  // 1. Root and infNFe
  let xml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">`;
  xml += `<infNFe Id="NFe${accessKey}" versao="4.00">`;

  // 2. <ide>
  xml += `<ide>`;
  xml += `<cUF>${profile.cUf}</cUF>`;
  xml += `<cNF>${cNF}</cNF>`;
  xml += `<natOp>VENDA A CONSUMIDOR</natOp>`;
  xml += `<mod>65</mod>`;
  xml += `<serie>${serie}</serie>`;
  xml += `<nNF>${nNF}</nNF>`;
  xml += `<dhEmi>${dhEmi}</dhEmi>`;
  xml += `<tpNF>1</tpNF>`;
  xml += `<idDest>1</idDest>`;
  xml += `<cMunFG>${profile.cMun}</cMunFG>`;
  xml += `<tpImp>4</tpImp>`;
  xml += `<tpEmis>${tpEmis}</tpEmis>`;
  xml += `<cDV>${cDV}</cDV>`;
  xml += `<tpAmb>${tpAmb}</tpAmb>`;
  xml += `<finNFe>1</finNFe>`;
  xml += `<indFinal>1</indFinal>`;
  xml += `<indPres>1</indPres>`;
  xml += `<procEmi>0</procEmi>`;
  xml += `<verProc>FarmaCore 1.0</verProc>`;
  xml += `</ide>`;

  // 3. <emit>
  xml += `<emit>`;
  xml += `<CNPJ>${cleanCnpj}</CNPJ>`;
  xml += `<xNome>${escapeXml(profile.razaoSocial)}</xNome>`;
  xml += `<xFant>${escapeXml(profile.nomeFantasia)}</xFant>`;
  xml += `<enderEmit>`;
  xml += `<xLgr>${escapeXml(profile.logradouro)}</xLgr>`;
  xml += `<nro>${escapeXml(profile.numero)}</nro>`;
  xml += `<xBairro>${escapeXml(profile.bairro)}</xBairro>`;
  xml += `<cMun>${profile.cMun}</cMun>`;
  xml += `<xMun>${escapeXml(profile.municipio)}</xMun>`;
  xml += `<UF>${uf}</UF>`;
  xml += `<CEP>${cleanCep}</CEP>`;
  xml += `<cPais>1058</cPais>`;
  xml += `<xPais>BRASIL</xPais>`;
  xml += `</enderEmit>`;
  xml += `<IE>${cleanIe}</IE>`;
  xml += `<CRT>${profile.crt}</CRT>`;
  xml += `</emit>`;

  // 4. <dest> (Optional in NFC-e, included if CPF provided)
  if (cleanCpf) {
    xml += `<dest>`;
    xml += `<CPF>${cleanCpf}</CPF>`;
    xml += `<indIEDest>9</indIEDest>`;
    xml += `</dest>`;
  }

  // 5. Items (<det>)
  items.forEach((item, index) => {
    const nItem = index + 1;
    const cleanNcm = item.ncm.replace(/\D/g, '');
    const cleanCest = item.cest ? item.cest.replace(/\D/g, '') : null;
    const isMedication =
      Boolean(item.anvisaRegistration) || cleanNcm.startsWith('3003') || cleanNcm.startsWith('3004');

    xml += `<det nItem="${nItem}">`;
    xml += `<prod>`;
    xml += `<cProd>${item.productId}</cProd>`;
    xml += `<cEAN>${item.ean || 'SEM GTIN'}</cEAN>`;
    xml += `<xProd>${escapeXml(item.name)}</xProd>`;
    xml += `<NCM>${cleanNcm}</NCM>`;
    if (cleanCest) {
      xml += `<CEST>${cleanCest}</CEST>`;
    }
    xml += `<CFOP>${item.cfop}</CFOP>`;
    xml += `<uCom>UN</uCom>`;
    xml += `<qCom>${item.quantity.toFixed(4)}</qCom>`;
    xml += `<vUnCom>${item.unitPrice.toFixed(4)}</vUnCom>`;
    xml += `<vProd>${item.totalPrice.toFixed(2)}</vProd>`;
    xml += `<cEANTrib>${item.ean || 'SEM GTIN'}</cEANTrib>`;
    xml += `<uTrib>UN</uTrib>`;
    xml += `<qTrib>${item.quantity.toFixed(4)}</qTrib>`;
    xml += `<vUnTrib>${item.unitPrice.toFixed(4)}</vUnTrib>`;
    xml += `<indTot>1</indTot>`;

    if (isMedication) {
      xml += `<med>`;
      xml += `<cProdANVISA>${item.anvisaRegistration || 'ISENTO'}</cProdANVISA>`;
      if (item.batchNumber) {
        xml += `<nLote>${escapeXml(item.batchNumber)}</nLote>`;
        xml += `<qLote>${item.quantity.toFixed(4)}</qLote>`;
      }
      if (item.expirationDate) {
        xml += `<dVal>${item.expirationDate}</dVal>`;
      }
      xml += `<vPMC>${(item.pmc || item.unitPrice).toFixed(2)}</vPMC>`;
      xml += `</med>`;
    }
    xml += `</prod>`;

    // <imposto>
    xml += `<imposto>`;
    xml += `<vTotTrib>${item.tax.vTotTrib.toFixed(2)}</vTotTrib>`;

    // ICMS
    xml += `<ICMS>`;
    if (profile.crt === 1) {
      // Simples Nacional
      if (item.tax.csosn === '500') {
        xml += `<ICMSSN500><orig>0</orig><CSOSN>500</CSOSN><vBCSTRet>0.00</vBCSTRet><pST>0.00</pST><vICMSSubstituto>0.00</vICMSSubstituto><vICMSSTRet>0.00</vICMSSTRet></ICMSSN500>`;
      } else {
        xml += `<ICMSSN102><orig>0</orig><CSOSN>${item.tax.csosn || '102'}</CSOSN></ICMSSN102>`;
      }
    } else {
      // Regime Normal
      if (item.tax.csosn === '060' || item.tax.csosn === '60') {
        xml += `<ICMS60><orig>0</orig><CST>60</CST><vBCSTRet>0.00</vBCSTRet><pST>0.00</pST><vICMSSubstituto>0.00</vICMSSubstituto><vICMSSTRet>0.00</vICMSSTRet></ICMS60>`;
      } else {
        xml += `<ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>${item.tax.vBC.toFixed(2)}</vBC><pICMS>${item.tax.pICMS.toFixed(2)}</pICMS><vICMS>${item.tax.vICMS.toFixed(2)}</vICMS></ICMS00>`;
      }
    }
    xml += `</ICMS>`;

    // PIS
    xml += `<PIS>`;
    if (item.tax.cstPis === '04') {
      xml += `<PISNT><CST>04</CST></PISNT>`;
    } else if (item.tax.cstPis === '01') {
      xml += `<PISAliq><CST>01</CST><vBC>${item.tax.vBCPis.toFixed(2)}</vBC><pPIS>${item.tax.pPis.toFixed(2)}</pPIS><vPIS>${item.tax.vPis.toFixed(2)}</vPIS></PISAliq>`;
    } else {
      xml += `<PISOutr><CST>${item.tax.cstPis || '49'}</CST><vBC>${item.tax.vBCPis.toFixed(2)}</vBC><pPIS>${item.tax.pPis.toFixed(2)}</pPIS><vPIS>${item.tax.vPis.toFixed(2)}</vPIS></PISOutr>`;
    }
    xml += `</PIS>`;

    // COFINS
    xml += `<COFINS>`;
    if (item.tax.cstCofins === '04') {
      xml += `<COFINSNT><CST>04</CST></COFINSNT>`;
    } else if (item.tax.cstCofins === '01') {
      xml += `<COFINSAliq><CST>01</CST><vBC>${item.tax.vBCCofins.toFixed(2)}</vBC><pCOFINS>${item.tax.pCofins.toFixed(2)}</pCOFINS><vCOFINS>${item.tax.vCofins.toFixed(2)}</vCOFINS></COFINSAliq>`;
    } else {
      xml += `<COFINSOutr><CST>${item.tax.cstCofins || '49'}</CST><vBC>${item.tax.vBCCofins.toFixed(2)}</vBC><pCOFINS>${item.tax.pCofins.toFixed(2)}</pCOFINS><vCOFINS>${item.tax.vCofins.toFixed(2)}</vCOFINS></COFINSOutr>`;
    }
    xml += `</COFINS>`;

    xml += `</imposto>`;
    xml += `</det>`;
  });

  // 6. <total><ICMSTot>
  const totalProd = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const totalBc = taxes.items ? taxes.items.reduce((sum, item) => sum + (item.vBC || 0), 0) : 0;

  xml += `<total>`;
  xml += `<ICMSTot>`;
  xml += `<vBC>${totalBc.toFixed(2)}</vBC>`;
  xml += `<vICMS>${taxes.vICMS.toFixed(2)}</vICMS>`;
  xml += `<vICMSDeson>0.00</vICMSDeson>`;
  xml += `<vFCPUFDest>0.00</vFCPUFDest>`;
  xml += `<vICMSUFDest>0.00</vICMSUFDest>`;
  xml += `<vICMSUFRemet>0.00</vICMSUFRemet>`;
  xml += `<vFCP>0.00</vFCP>`;
  xml += `<vBCST>0.00</vBCST>`;
  xml += `<vST>${taxes.vICMSST.toFixed(2)}</vST>`;
  xml += `<vFCPST>0.00</vFCPST>`;
  xml += `<vFCPSTRet>0.00</vFCPSTRet>`;
  xml += `<vProd>${totalProd.toFixed(2)}</vProd>`;
  xml += `<vFrete>0.00</vFrete>`;
  xml += `<vSeg>0.00</vSeg>`;
  xml += `<vDesc>0.00</vDesc>`;
  xml += `<vII>0.00</vII>`;
  xml += `<vIPI>0.00</vIPI>`;
  xml += `<vIPIDevol>0.00</vIPIDevol>`;
  xml += `<vPIS>${taxes.vPIS.toFixed(2)}</vPIS>`;
  xml += `<vCOFINS>${taxes.vCOFINS.toFixed(2)}</vCOFINS>`;
  xml += `<vOutro>0.00</vOutro>`;
  xml += `<vNF>${totalProd.toFixed(2)}</vNF>`;
  xml += `<vTotTrib>${taxes.vTotTrib.toFixed(2)}</vTotTrib>`;
  xml += `</ICMSTot>`;
  xml += `</total>`;

  // 7. <transp>
  xml += `<transp>`;
  xml += `<modFrete>9</modFrete>`; // 9 = Sem ocorrência de transporte
  xml += `</transp>`;

  // 8. <pag>
  xml += `<pag>`;
  payments.forEach((payment) => {
    const tPag = PAYMENT_METHOD_MAP[payment.method] || '99';
    xml += `<detPag>`;
    xml += `<tPag>${tPag}</tPag>`;
    xml += `<vPag>${payment.amount.toFixed(2)}</vPag>`;
    if (payment.card) {
      const cleanCardCnpj = payment.card.cnpj.replace(/\D/g, '').padStart(14, '0');
      xml += `<card>`;
      xml += `<tpIntegra>${payment.card.tpIntegra}</tpIntegra>`;
      xml += `<CNPJ>${cleanCardCnpj}</CNPJ>`;
      xml += `<tBand>${payment.card.tBand}</tBand>`;
      xml += `<cAut>${escapeXml(payment.card.cAut)}</cAut>`;
      xml += `</card>`;
    }
    xml += `</detPag>`;
  });
  if (changeAmount && changeAmount > 0) {
    xml += `<vTroco>${changeAmount.toFixed(2)}</vTroco>`;
  }
  xml += `</pag>`;

  // 9. <infRespTec>
  xml += `<infRespTec>`;
  xml += `<CNPJ>00000000000000</CNPJ>`;
  xml += `<xContato>Suporte FarmaCore</xContato>`;
  xml += `<email>fiscal@farmacore.local</email>`;
  xml += `<fone>11999999999</fone>`;
  xml += `</infRespTec>`;

  xml += `</infNFe>`;
  xml += `</NFe>`;

  return xml;
}
