import type { InventorySessionWithItems, InventoryItem } from './audit-types';
import type { Store } from '../stores/types';

export const SLIP_WIDTH = 80;
export const ESC_POS_CUT = '\x1b\x69'; // ESC i - paper cut

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

export function formatBalanceSlip(
  session: InventorySessionWithItems,
  store: Store
): { textSlip: string; fullEscPos: string } {
  const lines: string[] = [];
  const dividerDouble = '='.repeat(SLIP_WIDTH);
  const dividerSingle = '-'.repeat(SLIP_WIDTH);

  // 1. Header
  lines.push(dividerDouble);
  lines.push(center('FARMACORE ERP - TERMO DE BALANÇO E AUDITORIA DE ESTOQUE'));
  lines.push(dividerDouble);

  const sessionCode = session.sessionCode || session.session_code || `INV-${session.id}`;
  const invType = session.inventoryType || session.inventory_type;
  const status = session.status;
  const startedAt = session.startedAt || session.started_at;
  const closedAt = session.closedAt || session.closed_at || 'Em aberto';
  const openedBy = session.openedBy || session.opened_by;
  const appliedBy = session.appliedBy || session.applied_by || 'Pendente';
  const crf = session.responsiblePharmacistCrf || session.responsible_pharmacist_crf;
  const uf = session.responsiblePharmacistUf || session.responsible_pharmacist_uf;
  const crfDisplay = crf ? `${crf}/${uf || ''}` : 'N/A';

  lines.push(`Nº Inventário: ${sessionCode} | Tipo: ${invType} | Status: ${status}`);
  lines.push(`Filial: [${store.code}] ${store.name} - CNPJ: ${store.cnpj}`);
  lines.push(`Data Abertura: ${startedAt} | Fechamento: ${closedAt}`);
  lines.push(`Responsável: ${openedBy} | Homologado por: ${appliedBy}`);
  lines.push(`Farmacêutico RT: ${crfDisplay}`);
  lines.push(dividerSingle);

  // 2. Indicadores & Totais
  const accuracyRate = session.accuracyRate ?? session.accuracy_rate ?? 0;
  const batchesExpected = session.totalBatchesExpected ?? session.total_batches_expected ?? 0;
  const batchesCounted = session.totalBatchesCounted ?? session.total_batches_counted ?? 0;
  const surplusCost = session.totalSurplusCost ?? session.total_surplus_cost ?? 0;
  const shortageCost = session.totalShortageCost ?? session.total_shortage_cost ?? 0;
  const netDiff = session.netFinancialDifference ?? session.net_financial_difference ?? 0;

  lines.push('INDICADORES E TOTAIS PATRIMONIAIS');
  lines.push(`Acurácia Patrimonial: ${accuracyRate.toFixed(2)}%`);
  lines.push(`Lotes Esperados: ${batchesExpected} | Lotes com Contagem: ${batchesCounted}`);
  lines.push(`Custo Total Sobras (+): R$ ${surplusCost.toFixed(2)}`);
  lines.push(`Custo Total Faltas (-):  R$ ${shortageCost.toFixed(2)}`);
  lines.push(`Diferença Líquida:       R$ ${netDiff.toFixed(2)}`);
  lines.push(dividerSingle);

  // 3. Seção de Divergências
  lines.push('DISCRIMINAÇÃO DE DIVERGÊNCIAS APURADAS');
  const items = session.items || [];
  const divergentItems = items.filter((it: InventoryItem) => {
    const diff = it.differenceQuantity ?? it.difference_quantity ?? 0;
    return diff !== 0;
  });

  if (divergentItems.length === 0) {
    lines.push('Nenhuma divergência apurada. Estoque 100% acurado.');
  } else {
    // Columns: Itm, Descrição (20 ch), Lote (10 ch), Validade (10 ch), Esp (5 ch), Cont (5 ch), Dif (5 ch), Custo Dif (10 ch), Motivo (12 ch).
    const colHeader =
      padRight('Itm', 3) +
      ' ' +
      padRight('Descrição', 20) +
      ' ' +
      padRight('Lote', 10) +
      ' ' +
      padRight('Validade', 10) +
      ' ' +
      padLeft('Esp', 5) +
      ' ' +
      padLeft('Cont', 5) +
      ' ' +
      padLeft('Dif', 5) +
      ' ' +
      padLeft('Custo Dif', 10) +
      ' ' +
      padRight('Motivo', 12);

    lines.push(colHeader);
    lines.push(dividerSingle);

    divergentItems.forEach((item: InventoryItem, idx: number) => {
      const itmNum = padRight(String(idx + 1).padStart(2, '0'), 3);
      const desc = padRight(item.productName || item.product_name || `Produto #${item.productId ?? item.product_id}`, 20);
      const batch = padRight(item.batchNumber || item.batch_number || 'N/A', 10);
      const expiry = padRight(item.expirationDate || item.expiration_date || 'N/A', 10);
      const expQty = padLeft(String(item.expectedQuantity ?? item.expected_quantity ?? 0), 5);
      const cntQty = padLeft(String(item.countedQuantity ?? item.counted_quantity ?? 0), 5);
      const difQty = padLeft(String(item.differenceQuantity ?? item.difference_quantity ?? 0), 5);
      const costDiff = padLeft((item.totalCostDifference ?? item.total_cost_difference ?? 0).toFixed(2), 10);
      const reason = padRight(item.adjustmentReason || item.adjustment_reason || 'NÃO INF.', 12);

      lines.push(`${itmNum} ${desc} ${batch} ${expiry} ${expQty} ${cntQty} ${difQty} ${costDiff} ${reason}`);
    });
  }

  lines.push(dividerDouble);

  // 4. Termos e Assinaturas Formais
  lines.push(center('TERMO DE ENCERRAMENTO E ASSINATURAS FORMAIS'));
  lines.push('');
  lines.push('________________________________________');
  lines.push('Farmacêutico Responsável Técnico');
  lines.push(`CRF: ${crf || '______'}/${uf || '___'}`);
  lines.push('');
  lines.push('________________________________________');
  lines.push('Gerente da Loja');
  lines.push('Data: ___/___/______');
  lines.push(dividerDouble);

  const textSlip = lines.join('\n');

  // ESC/POS Formatted String
  const ESC = '\x1b';
  const escPosLines: string[] = [
    `${ESC}\x40`, // Initialize printer (\x1b\x40)
    `${ESC}t\x00`, // Code page standard
    `${ESC}a\x01`, // Center alignment
    `${ESC}\x45\x01`, // Bold ON (\x1b\x45\x01)
    'FARMACORE ERP\nTERMO DE BALANÇO E AUDITORIA DE ESTOQUE\n',
    `${ESC}\x45\x00`, // Bold OFF (\x1b\x45\x00)
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
