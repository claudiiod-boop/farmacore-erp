export type FiscalEnvironment = 'HOMOLOGACAO' | 'PRODUCAO' | 'SIMULADOR';

export interface FiscalProfile {
  id?: number;
  cnpj: string;
  ie: string;
  razaoSocial: string;
  nomeFantasia: string;
  crt: number; // 1 = Simples Nacional, 2 = Simples com excesso de sublimite, 3 = Regime Normal
  cUf: number;
  municipio: string;
  cMun: number;
  logradouro: string;
  numero: string;
  bairro: string;
  cep: string;
  serie: number;
  nextNnf: number;
  cscToken: string;
  cscId: string;
  environment: FiscalEnvironment;
  certPfxBase64?: string | null;
  certPassword?: string | null;
  updatedAt?: string;
}

export interface ProductFiscalData {
  ncm: string;
  cest: string;
  cfop: string;
  csosnIcms: string;
  cstPis: string;
  cstCofins: string;
  origin: number;
}

export type NfceInvoiceStatus = 'AUTORIZADA' | 'CONTINGENCIA' | 'CANCELADA' | 'REJEITADA';

export interface NfceInvoice {
  id: number;
  saleId: number;
  chNFe: string;
  nNF: number;
  serie: number;
  tpAmb: number; // 1 = Produção, 2 = Homologação
  tpEmis: number; // 1 = Normal, 9 = Contingência Offline
  status: NfceInvoiceStatus;
  protocolNumber: string | null;
  protocolDate: string | null;
  xmlSigned: string;
  xmlAuthorized: string | null;
  qrCodeUrl: string;
  digestValue: string | null;
  cStat: number | null;
  xMotivo: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

export interface AccessKeyParams {
  cUf: number;
  yearMonth: string; // AAMM
  cnpj: string;
  mod: number; // 65 for NFC-e
  serie: number;
  nNF: number;
  tpEmis: number; // 1 for Normal, 9 for Offline Contingency
  cNF?: number | string; // 8-digit random code
}

export interface CalculatedItemTax {
  vBC: number;
  pICMS: number;
  vICMS: number;
  vBCST: number;
  pICMSST: number;
  vICMSST: number;
  csosn: string;
  cfop: string;
  cstPis: string;
  vBCPis: number;
  pPis: number;
  vPis: number;
  cstCofins: string;
  vBCCofins: number;
  pCofins: number;
  vCofins: number;
  vTotTrib: number;
}

export interface CalculatedSaleTaxes {
  vTotTrib: number;
  vICMS: number;
  vICMSST: number;
  vPIS: number;
  vCOFINS: number;
  items: CalculatedItemTax[];
}

export interface NfceCardInput {
  tpIntegra: 1 | 2;
  cnpj: string;
  tBand: string;
  cAut: string;
}

