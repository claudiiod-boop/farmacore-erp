import type { TransferWithItems, TransferItem } from './types';
import type { Store } from '../stores/types';

export const SLIP_WIDTH = 80;
export const ESC_POS_CUT = '\x1b\x69'; // ESC i - paper cut

function formatCurrency(val: number): string {
  return val.toFixed(2).replace('.', ',');
}

function center(text: string, width = SLIP_WIDTH): string {
  const trimmed = text.trim();
  if (trimmed.length >= width) {
    return trimmed.substring(0, width);
  }
  const leftPad = Math.floor((width - trimmed.length) / 2);
  const rightPad = width - trimmed.length - leftPad;
  return ' '.repeat(leftPad) + trimmed + ' '.repeat(rightPad);
}

function padRight(text: string, length: number): string {
  if (text.length >= length) {
    return text.substring(0, length);
  }
  return text + ' '.repeat(length - text.length);
}

function padLeft(text: string, length: number): string {
  if (text.length >= length) {
    return text.substring(0, length);
  }
  return ' '.repeat(length - text.length) + text;
}

export function formatTransferSlip(
  transfer: TransferWithItems,
  sourceStore: Store,
  targetStore: Store
): { textSlip: string; fullEscPos: string } {
  const lines: string[] = [];
  const dividerDouble = '='.repeat(SLIP_WIDTH);
  const dividerSingle = '-'.repeat(SLIP_WIDTH);

  // 1. Header
  lines.push(dividerDouble);
  lines.push(center('FARMACORE ERP - ROMANEIO DE TRANSFERÊNCIA ENTRE FILIAIS'));
  lines.push(dividerDouble);

  const transferNum = transfer.transferNumber || transfer.transfer_number || `TRF-${transfer.id}`;
  const createdAt = transfer.createdAt || transfer.created_at || new Date().toISOString();
  const cfop = transfer.cfop || '5152';
  const cfopDescription = cfop === '6152' ? 'Transferência Interestadual' : 'Transferência Estadual';

  lines.push(`Nº Transferência: ${transferNum}`);
  lines.push(`Data/Hora: ${createdAt} | Status: ${transfer.status}`);
  lines.push(`CFOP: ${cfop} - ${cfopDescription}`);
  lines.push(dividerSingle);

  // 2. Origem e Destino
  const src = sourceStore || transfer.sourceStore;
  const tgt = targetStore || transfer.targetStore;

  lines.push(`ORIGEM : [${src.code}] ${src.name}`);
  lines.push(`         CNPJ: ${src.cnpj} | IE: ${src.ie}`);
  lines.push(`         ${src.street}, ${src.number} - ${src.city}/${src.state}`);
  lines.push(`DESTINO: [${tgt.code}] ${tgt.name}`);
  lines.push(`         CNPJ: ${tgt.cnpj} | IE: ${tgt.ie}`);
  lines.push(`         ${tgt.street}, ${tgt.number} - ${tgt.city}/${tgt.state}`);
  lines.push(dividerSingle);

  // 3. Transporte
  const carrier = transfer.carrierName || transfer.carrier_name || 'Próprio/Não informado';
  const tracking = transfer.trackingCode || transfer.tracking_code || 'N/A';
  const nfe = transfer.nfeKey || transfer.nfe_key || 'Não emitida / Pendente';

  lines.push(`Transportador: ${carrier}`);
  lines.push(`Rastreio/Placa: ${tracking}`);
  lines.push(`NF-e Chave: ${nfe}`);
  lines.push(dividerSingle);

  // 4. Tabela de Itens
  // Layout 80 cols:
  // Col 1: Item (3)
  // Col 2: Descrição (21)
  // Col 3: Lote (12)
  // Col 4: Validade (10)
  // Col 5: Qtd Env (7)
  // Col 6: Custo Unit (10)
  // Col 7: Custo Total (11)
  // Separators: 6 spaces between columns => 3+1+21+1+12+1+10+1+7+1+10+1+11 = 80
  const headerCol =
    padRight('Itm', 3) +
    ' ' +
    padRight('Descrição', 21) +
    ' ' +
    padRight('Lote', 12) +
    ' ' +
    padRight('Validade', 10) +
    ' ' +
    padLeft('Qtd Env', 7) +
    ' ' +
    padLeft('Custo Unit', 10) +
    ' ' +
    padLeft('Custo Total', 11);

  lines.push(headerCol);
  lines.push(dividerSingle);

  let totalItems = 0;
  let totalQuantity = 0;
  let totalValue = 0;

  const items = transfer.items || [];
  items.forEach((item: TransferItem, idx: number) => {
    totalItems += 1;
    const qty =
      item.shippedQuantity !== undefined && item.shippedQuantity > 0
        ? item.shippedQuantity
        : item.shipped_quantity !== undefined && (item.shipped_quantity as number) > 0
        ? (item.shipped_quantity as number)
        : item.requestedQuantity ?? item.requested_quantity ?? 0;

    const unitCost = item.unitCost ?? item.unit_cost ?? 0;
    const costTotal = item.totalCost ?? item.total_cost ?? qty * unitCost;

    totalQuantity += qty;
    totalValue += costTotal;

    const itemNum = padRight(String(idx + 1).padStart(2, '0'), 3);
    const desc = padRight(item.productName || item.product_name || `Produto #${item.productId}`, 21);
    const batch = padRight(item.batchNumber || item.batch_number || 'N/A', 12);
    const expiry = padRight(item.expirationDate || item.expiration_date || 'N/A', 10);
    const qtyStr = padLeft(String(qty), 7);
    const unitStr = padLeft(formatCurrency(unitCost), 10);
    const totalStr = padLeft(formatCurrency(costTotal), 11);

    lines.push(`${itemNum} ${desc} ${batch} ${expiry} ${qtyStr} ${unitStr} ${totalStr}`);
  });

  // 5. Resumo / Totais
  lines.push(dividerSingle);
  lines.push('RESUMO / TOTAIS DA CARGA');
  lines.push(`Total de Itens: ${totalItems}`);
  lines.push(`Quantidade Total de Peças/Unidades: ${totalQuantity}`);
  lines.push(`Valor Total da Carga (R$): R$ ${formatCurrency(totalValue)}`);
  lines.push(dividerDouble);

  // 6. Canhoto / Termos de Expedição e Recebimento
  lines.push(center('TERMOS DE EXPEDIÇÃO E RECEBIMENTO'));
  lines.push('');
  lines.push('Expedido por: _________________________ Data: ___/___/______');
  lines.push('Transportado por: _____________________ Data: ___/___/______');
  lines.push('Recebido e Conferido por: _____________ Data: ___/___/______');
  lines.push(dividerDouble);

  const textSlip = lines.join('\n');

  // ESC/POS Formatted String
  const ESC = '\x1b';
  const GS = '\x1d';

  const escPosLines: string[] = [
    `${ESC}@`, // Initialize printer
    `${ESC}t\x00`, // Code page standard
    `${ESC}a\x01`, // Center alignment
    `${ESC}E\x01`, // Bold ON
    'FARMACORE ERP\nROMANEIO DE TRANSFERÊNCIA ENTRE FILIAIS\n',
    `${ESC}E\x00`, // Bold OFF
    `${ESC}a\x00`, // Left alignment
    textSlip,
    '\n\n\n', // Paper feed
    ESC_POS_CUT, // Paper cut (\x1b\x69)
  ];

  const fullEscPos = escPosLines.join('');

  return {
    textSlip,
    fullEscPos,
  };
}
