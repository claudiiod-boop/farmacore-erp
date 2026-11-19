import { getDatabase, Database } from '../../database/connection';
import { TransferService } from './transfer.service';
import { StoreService } from '../stores/store.service';
import { generateAccessKey } from '../fiscal/access-key';
import type { FiscalTransferResult, TransferWithItems } from './types';
import type { Store } from '../stores/types';

const UF_TO_CUF: Record<string, number> = {
  RO: 11,
  AC: 12,
  AM: 13,
  RR: 14,
  PA: 15,
  AP: 16,
  TO: 17,
  MA: 21,
  PI: 22,
  CE: 23,
  RN: 24,
  PB: 25,
  PE: 26,
  AL: 27,
  SE: 28,
  BA: 29,
  MG: 31,
  ES: 32,
  RJ: 33,
  SP: 35,
  PR: 41,
  SC: 42,
  RS: 43,
  MS: 50,
  MT: 51,
  GO: 52,
  DF: 53,
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class TransferFiscalService {
  private transferService: TransferService;
  private storeService: StoreService;

  constructor(private db: Database = getDatabase()) {
    this.transferService = new TransferService(this.db);
    this.storeService = new StoreService(this.db);
  }

  private resolveCuf(store: Store): number {
    if (store.ibgeCode && /^\d{2}/.test(store.ibgeCode)) {
      return parseInt(store.ibgeCode.substring(0, 2), 10);
    }
    const state = (store.state || '').toUpperCase();
    return UF_TO_CUF[state] || 35;
  }

  /**
   * Emite NF-e Mod. 55 de transferência para uma transferência em trânsito ou recebida.
   */
  async emitTransferNfe(transferId: number): Promise<FiscalTransferResult> {
    const transfer = this.transferService.getTransferById(transferId);
    if (!transfer) {
      throw new Error(`Transferência não encontrada: ID ${transferId}`);
    }

    if (transfer.status !== 'IN_TRANSIT' && transfer.status !== 'RECEIVED') {
      throw new Error(
        `Não é possível emitir NF-e para transferência com status ${transfer.status}. Status permitido: IN_TRANSIT ou RECEIVED.`
      );
    }

    const sourceStore =
      transfer.sourceStore || this.storeService.getStoreById(transfer.sourceStoreId);
    const targetStore =
      transfer.targetStore || this.storeService.getStoreById(transfer.targetStoreId);

    if (!sourceStore) {
      throw new Error(`Loja de origem não encontrada: ID ${transfer.sourceStoreId}`);
    }
    if (!targetStore) {
      throw new Error(`Loja de destino não encontrada: ID ${transfer.targetStoreId}`);
    }

    const isInterstate = sourceStore.state.toUpperCase() !== targetStore.state.toUpperCase();
    const cfop = isInterstate ? '6152' : '5152';

    // 1. Chave de acesso mod 55
    const cUf = this.resolveCuf(sourceStore);
    const now = new Date();
    const yearMonth = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const cleanEmitCnpj = sourceStore.cnpj.replace(/\D/g, '');
    const cleanDestCnpj = targetStore.cnpj.replace(/\D/g, '');
    const serie = 1;
    const nNF = transfer.id;

    const { accessKey, cDv, cNf } = generateAccessKey({
      cUf,
      yearMonth,
      cnpj: cleanEmitCnpj,
      mod: 55,
      serie,
      nNF,
      tpEmis: 1,
    });

    const dhEmi = `${now.toISOString().slice(0, 19)}-03:00`;

    // 2. Construção do XML NF-e Mod. 55
    let totalProducts = 0;
    const itemsXml: string[] = [];

    const items = transfer.items || [];
    items.forEach((item, index) => {
      const nItem = index + 1;
      const qty =
        item.shippedQuantity !== undefined && item.shippedQuantity > 0
          ? item.shippedQuantity
          : item.shipped_quantity !== undefined && (item.shipped_quantity as number) > 0
          ? (item.shipped_quantity as number)
          : item.requestedQuantity ?? item.requested_quantity ?? 0;

      const unitCost = item.unitCost ?? item.unit_cost ?? 0;
      const costTotal = item.totalCost ?? item.total_cost ?? qty * unitCost;
      totalProducts += costTotal;

      const prodName = escapeXml(item.productName || item.product_name || `Produto #${item.productId}`);
      const batchNumber = escapeXml(item.batchNumber || item.batch_number || 'LOTE-PADRAO');
      const expiry = item.expirationDate || item.expiration_date || '2028-12-31';
      const mfg = item.manufacturingDate || item.manufacturing_date || '2025-01-01';

      let rastroXml = '';
      if (batchNumber) {
        rastroXml = `
        <rastro>
          <nLote>${batchNumber}</nLote>
          <qLote>${qty.toFixed(3)}</qLote>
          <dFab>${mfg}</dFab>
          <dVal>${expiry}</dVal>
        </rastro>`;
      }

      itemsXml.push(`
      <det nItem="${nItem}">
        <prod>
          <cProd>${item.productId}</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>${prodName}</xProd>
          <NCM>30049099</NCM>
          <CFOP>${cfop}</CFOP>
          <uCom>UN</uCom>
          <qCom>${qty.toFixed(4)}</qCom>
          <vUnCom>${unitCost.toFixed(4)}</vUnCom>
          <vProd>${costTotal.toFixed(2)}</vProd>
          <cEANTrib>SEM GTIN</cEANTrib>
          <uTrib>UN</uTrib>
          <qTrib>${qty.toFixed(4)}</qTrib>
          <vUnTrib>${unitCost.toFixed(4)}</vUnTrib>
          <indTot>1</indTot>${rastroXml}
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>3</modBC>
              <vBC>0.00</vBC>
              <pICMS>0.00</pICMS>
              <vICMS>0.00</vICMS>
            </ICMS00>
          </ICMS>
          <PIS>
            <PISNT>
              <CST>08</CST>
            </PISNT>
          </PIS>
          <COFINS>
            <COFINSNT>
              <CST>08</CST>
            </COFINSNT>
          </COFINS>
        </imposto>
      </det>`);
    });

    const carrierName = transfer.carrierName || transfer.carrier_name;
    const trackingCode = transfer.trackingCode || transfer.tracking_code;

    let transportXml = `<transp><modFrete>${carrierName ? '0' : '9'}</modFrete>`;
    if (carrierName) {
      transportXml += `<transporta><xNome>${escapeXml(carrierName)}</xNome></transporta>`;
    }
    if (trackingCode) {
      transportXml += `<veicTransp><placa>${escapeXml(trackingCode)}</placa></veicTransp>`;
    }
    transportXml += `</transp>`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${accessKey}" versao="4.00">
    <ide>
      <cUF>${cUf}</cUF>
      <cNF>${cNf}</cNF>
      <natOp>TRANSFERENCIA DE MERCADORIA</natOp>
      <mod>55</mod>
      <serie>${serie}</serie>
      <nNF>${nNF}</nNF>
      <dhEmi>${dhEmi}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>${isInterstate ? 2 : 1}</idDest>
      <cMunFG>${sourceStore.ibgeCode || '3550308'}</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${cDv}</cDV>
      <tpAmb>2</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>0</indFinal>
      <indPres>0</indPres>
      <procEmi>0</procEmi>
      <verProc>FarmaCore 1.0</verProc>
    </ide>
    <emit>
      <CNPJ>${cleanEmitCnpj}</CNPJ>
      <xNome>${escapeXml(sourceStore.companyName || sourceStore.name)}</xNome>
      <xFant>${escapeXml(sourceStore.name)}</xFant>
      <enderEmit>
        <xLgr>${escapeXml(sourceStore.street)}</xLgr>
        <nro>${escapeXml(sourceStore.number)}</nro>
        <xBairro>${escapeXml(sourceStore.neighborhood || 'Centro')}</xBairro>
        <cMun>${sourceStore.ibgeCode || '3550308'}</cMun>
        <xMun>${escapeXml(sourceStore.city)}</xMun>
        <UF>${sourceStore.state}</UF>
        <CEP>${sourceStore.zipCode.replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
      </enderEmit>
      <IE>${sourceStore.ie.replace(/\D/g, '')}</IE>
      <CRT>${sourceStore.taxRegime === 'SIMPLES_NACIONAL' ? 1 : 3}</CRT>
    </emit>
    <dest>
      <CNPJ>${cleanDestCnpj}</CNPJ>
      <xNome>${escapeXml(targetStore.companyName || targetStore.name)}</xNome>
      <enderDest>
        <xLgr>${escapeXml(targetStore.street)}</xLgr>
        <nro>${escapeXml(targetStore.number)}</nro>
        <xBairro>${escapeXml(targetStore.neighborhood || 'Centro')}</xBairro>
        <cMun>${targetStore.ibgeCode || '3509502'}</cMun>
        <xMun>${escapeXml(targetStore.city)}</xMun>
        <UF>${targetStore.state}</UF>
        <CEP>${targetStore.zipCode.replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
      </enderDest>
      <indIEDest>1</indIEDest>
      <IE>${targetStore.ie.replace(/\D/g, '')}</IE>
    </dest>
    ${itemsXml.join('')}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCPUFDest>0.00</vFCPUFDest>
        <vICMSUFDest>0.00</vICMSUFDest>
        <vICMSUFFve>0.00</vICMSUFFve>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${totalProducts.toFixed(2)}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${totalProducts.toFixed(2)}</vNF>
        <vTotTrib>0.00</vTotTrib>
      </ICMSTot>
    </total>
    ${transportXml}
  </infNFe>
</NFe>`.trim();

    // 3. Simulação de autorização SEFAZ (cStat 100)
    const protocol = `1${cUf}${Date.now().toString().slice(-10)}`;

    // 4. Atualizar registro em transfers
    this.db
      .prepare(
        `
        UPDATE transfers
        SET nfe_key = ?,
            nfe_protocol = ?,
            cfop = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      )
      .run(accessKey, protocol, cfop, transferId);

    return {
      transferId,
      nfeKey: accessKey,
      protocol,
      cfop,
      status: 'AUTORIZADA',
      xml,
    };
  }
}
