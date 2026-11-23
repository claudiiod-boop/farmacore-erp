import type { EdiQuotationLine, EdiProposalLine } from './b2b.types';

export interface EdiQuotationHeader {
  campaignCode: string;
  pharmacyCnpj: string;
  pharmacyName: string;
  lines: EdiQuotationLine[];
}

export interface ParsedEdiProposalResponse {
  campaignCode: string;
  supplierCnpj: string;
  supplierName?: string;
  items: EdiProposalLine[];
}

export class EdiFarmaService {
  /**
   * Gera o arquivo padronizado de espelho de cotação EDI Farma (layout posicional/delimitado)
   * compatível com as maiores distribuidoras do Brasil (Santa Cruz, Panpharma, Profarma, GAM).
   */
  static generateEdiQuotationFile(data: EdiQuotationHeader): string {
    const lines: string[] = [];

    // Header: HDR|<codigo_campanha>|<cnpj_farmacia>|<nome_farmacia>|<timestamp>
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    lines.push(`HDR|${data.campaignCode}|${data.pharmacyCnpj}|${data.pharmacyName}|${now}`);

    let totalQuantity = 0;
    // Items: ITM|<ean>|<descricao>|<quantidade>|<preco_alvo>
    for (const item of data.lines) {
      totalQuantity += item.quantityRequested;
      const targetPriceStr = item.targetPrice !== undefined ? item.targetPrice.toFixed(2) : '0.00';
      lines.push(`ITM|${item.ean}|${item.description}|${item.quantityRequested}|${targetPriceStr}`);
    }

    // Trailer: TRL|<total_itens>|<soma_quantidades>
    lines.push(`TRL|${data.lines.length}|${totalQuantity}`);

    return lines.join('\r\n');
  }

  /**
   * Realiza o parser da resposta da distribuidora (arquivo de proposta com preços e estoques).
   */
  static parseEdiProposalResponse(fileContent: string): ParsedEdiProposalResponse {
    const rawLines = fileContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

    let campaignCode = '';
    let supplierCnpj = '';
    let supplierName = '';
    const items: EdiProposalLine[] = [];

    for (const line of rawLines) {
      const parts = line.split('|');
      const tag = parts[0]?.toUpperCase();

      if (tag === 'HDR') {
        campaignCode = parts[1] || '';
        supplierCnpj = parts[2] || '';
        supplierName = parts[3] || '';
      } else if (tag === 'ITM') {
        // Formato: ITM|<ean>|<preco_ofertado>|<desconto_percentual>|<qtd_disponivel>|<st_icms_incluso>
        const ean = parts[1];
        const offeredPrice = parseFloat(parts[2] || '0');
        const discountPercent = parseFloat(parts[3] || '0');
        const availableQuantity = parseInt(parts[4] || '0', 10);
        const stIcmsIncluded = parts[5] === '1' || parts[5]?.toUpperCase() === 'TRUE';

        if (ean && !isNaN(offeredPrice)) {
          items.push({
            ean,
            offeredPrice,
            discountPercent: isNaN(discountPercent) ? 0 : discountPercent,
            availableQuantity: isNaN(availableQuantity) ? 0 : availableQuantity,
            stIcmsIncluded,
          });
        }
      }
    }

    return {
      campaignCode,
      supplierCnpj,
      supplierName,
      items,
    };
  }
}
