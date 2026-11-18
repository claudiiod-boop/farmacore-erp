/**
 * Formatador de Comprovante TEF ESC/POS 48 Colunas
 * Padrão para impressoras térmicas não fiscais (Epson, Daruma, Bematech, Elgin, etc.)
 */

import type {
  TefTransaction,
  StoreInfo,
  TefOperationType,
  TefInstallmentType,
} from './types';

export const RECEIPT_WIDTH = 48;
export const ESC_POS_CUT = '\x1b\x69'; // ESC i - paper cut
export const ESC_POS_CUT_ALT = '\x1d\x56\x41\x00'; // GS V 65 0

/**
 * Formata moeda no padrão brasileiro (ex: 149,90)
 */
export function formatCurrency(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

/**
 * Formata data e hora DD/MM/AAAA HH:mm:ss
 */
export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
  }

  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (isoMatch) {
    const [, y, m, d, h, min, s] = isoMatch;
    return `${d}/${m}/${y} ${h}:${min}:${s}`;
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const mins = String(d.getUTCMinutes()).padStart(2, '0');
    const secs = String(d.getUTCSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
  }

  return dateStr.slice(0, 19);
}

/**
 * Centraliza um texto na largura da bobina (48 colunas)
 */
export function centerText(text: string, width = RECEIPT_WIDTH): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return '';
  if (trimmed.length >= width) {
    return trimmed.slice(0, width);
  }
  const totalPadding = width - trimmed.length;
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return ' '.repeat(leftPadding) + trimmed + ' '.repeat(rightPadding);
}

/**
 * Justifica à esquerda e à direita na mesma linha (48 colunas)
 */
export function justifyText(left: string, right: string, width = RECEIPT_WIDTH): string {
  const l = left.trim();
  const r = right.trim();
  const combinedLength = l.length + r.length;
  if (combinedLength >= width) {
    const maxLeft = Math.max(0, width - r.length - 1);
    const truncatedLeft = l.slice(0, maxLeft);
    const spaceCount = Math.max(1, width - truncatedLeft.length - r.length);
    return truncatedLeft + ' '.repeat(spaceCount) + r;
  }
  const spaceCount = width - l.length - r.length;
  return l + ' '.repeat(spaceCount) + r;
}

/**
 * Quebra texto longo em linhas de no máximo `width` colunas respeitando palavras
 */
export function wrapText(text: string, width = RECEIPT_WIDTH): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [''];
  if (trimmed.length <= width) return [trimmed];

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      if (word.length <= width) {
        currentLine = word;
      } else {
        for (let i = 0; i < word.length; i += width) {
          const chunk = word.slice(i, i + width);
          if (i + width >= word.length) {
            currentLine = chunk;
          } else {
            lines.push(chunk);
          }
        }
      }
    } else if (currentLine.length + 1 + word.length <= width) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      if (word.length <= width) {
        currentLine = word;
      } else {
        for (let i = 0; i < word.length; i += width) {
          const chunk = word.slice(i, i + width);
          if (i + width >= word.length) {
            currentLine = chunk;
          } else {
            lines.push(chunk);
          }
        }
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export function truncateOrFit(text: string, width = RECEIPT_WIDTH): string {
  if (text.length > width) {
    return text.slice(0, width);
  }
  return text;
}

export function finalizeReceiptText(lines: string[], width = RECEIPT_WIDTH): string {
  const processed: string[] = [];
  for (const line of lines) {
    if (line.length <= width) {
      processed.push(line);
    } else {
      const wrapped = wrapText(line, width);
      for (const w of wrapped) {
        processed.push(w.length > width ? w.slice(0, width) : w);
      }
    }
  }
  return processed.join('\n');
}

/**
 * Mascara número de cartão mantendo os 4 últimos dígitos
 */
export function maskCardNumber(card?: string | null): string {
  if (!card) return '**** **** **** ****';
  const clean = card.trim();
  if (clean.length === 4) {
    return `**** **** **** ${clean}`;
  }
  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 4) {
    const lastFour = digits.slice(-4);
    return `**** **** **** ${lastFour}`;
  }
  return clean.slice(0, RECEIPT_WIDTH);
}

/**
 * Retorna a descrição amigável da operação TEF
 */
export function formatOperationDescription(
  operationType: TefOperationType,
  installments = 1,
  installmentType?: TefInstallmentType
): string {
  switch (operationType) {
    case 'DEBITO':
      return 'CARTAO DE DEBITO A VISTA';
    case 'CREDITO':
      if (installments > 1) {
        const typeSuffix =
          installmentType === 'PARCELADO_ADM'
            ? ' ADM'
            : installmentType === 'PARCELADO_LOJA'
            ? ' LOJA'
            : '';
        return `CARTAO DE CREDITO ${installments}X${typeSuffix}`;
      }
      return 'CARTAO DE CREDITO A VISTA';
    case 'VOUCHER':
      return 'VOUCHER REFEICAO/ALIMENTACAO';
    case 'PIX_TEF':
      return 'PIX TEF';
    default:
      return `${operationType} A VISTA`;
  }
}

/**
 * Formata o comprovante de pagamento TEF (1ª via Cliente, 2ª via Estabelecimento e comando ESC/POS)
 */
export function formatTefReceipt(
  transaction: TefTransaction,
  storeInfo: StoreInfo
): {
  customerReceipt: string;
  merchantReceipt: string;
  fullEscPos: string;
} {
  const dividerDouble = '='.repeat(RECEIPT_WIDTH);
  const dividerSingle = '-'.repeat(RECEIPT_WIDTH);

  const opDesc = formatOperationDescription(
    transaction.operationType,
    transaction.installments,
    transaction.installmentType
  );
  const cardMasked = maskCardNumber(transaction.cardLastFour);
  const authDateTime = transaction.confirmedAt || transaction.createdAt;

  // ==========================================
  // 1ª VIA - CLIENTE
  // ==========================================
  const customerLines: string[] = [];

  customerLines.push(dividerDouble);
  customerLines.push(centerText('COMPROVANTE DE PAGAMENTO TEF'));
  customerLines.push(dividerDouble);

  // Dados do estabelecimento
  wrapText(storeInfo.name).forEach((l) => customerLines.push(centerText(l)));
  const cnpjIe = storeInfo.ie
    ? `CNPJ: ${storeInfo.cnpj}  IE: ${storeInfo.ie}`
    : `CNPJ: ${storeInfo.cnpj}`;
  wrapText(cnpjIe).forEach((l) => customerLines.push(centerText(l)));
  wrapText(storeInfo.address).forEach((l) => customerLines.push(centerText(l)));
  customerLines.push(dividerSingle);

  // Dados da transação
  customerLines.push('1a VIA - CLIENTE');
  wrapText(`OPERACAO: ${opDesc}`).forEach((l) => customerLines.push(l));
  customerLines.push(truncateOrFit(`BANDEIRA: ${transaction.brandName.toUpperCase()}`));
  customerLines.push(truncateOrFit(`CARTAO: ${cardMasked}`));
  customerLines.push(truncateOrFit(`DATA: ${formatDateTime(authDateTime)}`));
  customerLines.push(truncateOrFit(`REDE: ${transaction.acquirerName.toUpperCase()}`));
  customerLines.push(
    justifyText(`DOC/NSU: ${transaction.nsu}`, `AUTORIZACAO: ${transaction.authorizationCode}`)
  );
  customerLines.push(dividerSingle);

  // Valor
  customerLines.push(
    justifyText('VALOR TOTAL PAGO:', `R$ ${formatCurrency(transaction.amount)}`)
  );
  customerLines.push(dividerSingle);

  // Mensagem de aprovação
  customerLines.push(centerText('TRANSACAO APROVADA COM SUCESSO'));
  customerLines.push(dividerDouble);

  const customerReceipt = finalizeReceiptText(customerLines);

  // ==========================================
  // 2ª VIA - ESTABELECIMENTO (CONTROLE INTERNO)
  // ==========================================
  const merchantLines: string[] = [];

  merchantLines.push(dividerDouble);
  merchantLines.push(centerText('COMPROVANTE DE PAGAMENTO TEF'));
  merchantLines.push(dividerDouble);

  // Dados do estabelecimento (resumido)
  wrapText(storeInfo.name).forEach((l) => merchantLines.push(centerText(l)));
  const merchantCnpj = `CNPJ: ${storeInfo.cnpj}`;
  wrapText(merchantCnpj).forEach((l) => merchantLines.push(centerText(l)));
  merchantLines.push(dividerSingle);

  // Dados de controle interno
  merchantLines.push('2a VIA - ESTABELECIMENTO (CONTROLE INTERNO)');
  wrapText(`OPERACAO: ${opDesc}`).forEach((l) => merchantLines.push(l));
  merchantLines.push(truncateOrFit(`BANDEIRA: ${transaction.brandName.toUpperCase()}`));
  merchantLines.push(truncateOrFit(`CARTAO: ${cardMasked}`));
  merchantLines.push(truncateOrFit(`DATA: ${formatDateTime(authDateTime)}`));
  merchantLines.push(truncateOrFit(`REDE: ${transaction.acquirerName.toUpperCase()}`));
  merchantLines.push(
    justifyText(`DOC/NSU: ${transaction.nsu}`, `AUTORIZACAO: ${transaction.authorizationCode}`)
  );
  merchantLines.push(
    justifyText('VALOR:', `R$ ${formatCurrency(transaction.amount)}`)
  );

  // Vínculo fiscal NFC-e se houver saleId
  if (transaction.saleId != null) {
    const saleIdPadded = String(transaction.saleId).padStart(9, '0');
    merchantLines.push(truncateOrFit(`CUPOM FISCAL / NFC-e: ${saleIdPadded}`));
  }

  merchantLines.push(dividerDouble);

  const merchantReceipt = finalizeReceiptText(merchantLines);

  // Junção ESC/POS com comando de corte de papel
  const fullEscPos = `${customerReceipt}\n\n\n\n${ESC_POS_CUT}\n\n${merchantReceipt}\n\n\n\n${ESC_POS_CUT}\n`;

  return {
    customerReceipt,
    merchantReceipt,
    fullEscPos,
  };
}

/**
 * Formata o comprovante de cancelamento/estorno TEF
 */
export function formatTefCancellationReceipt(
  transaction: TefTransaction,
  storeInfo: StoreInfo
): {
  customerReceipt: string;
  merchantReceipt: string;
  fullEscPos: string;
} {
  const dividerDouble = '='.repeat(RECEIPT_WIDTH);
  const dividerSingle = '-'.repeat(RECEIPT_WIDTH);

  const opDesc = formatOperationDescription(
    transaction.operationType,
    transaction.installments,
    transaction.installmentType
  );
  const cardMasked = maskCardNumber(transaction.cardLastFour);
  const cancelDateTime =
    transaction.cancelledAt || transaction.reversedAt || new Date().toISOString();
  const reason = transaction.cancellationReason || transaction.reversalReason;

  // ==========================================
  // 1ª VIA - CLIENTE (CANCELAMENTO)
  // ==========================================
  const customerLines: string[] = [];

  customerLines.push(dividerDouble);
  customerLines.push(centerText('COMPROVANTE DE CANCELAMENTO / ESTORNO'));
  customerLines.push(centerText('TRANSACAO TEF'));
  customerLines.push(dividerDouble);

  // Dados do estabelecimento
  wrapText(storeInfo.name).forEach((l) => customerLines.push(centerText(l)));
  const cnpjIe = storeInfo.ie
    ? `CNPJ: ${storeInfo.cnpj}  IE: ${storeInfo.ie}`
    : `CNPJ: ${storeInfo.cnpj}`;
  wrapText(cnpjIe).forEach((l) => customerLines.push(centerText(l)));
  wrapText(storeInfo.address).forEach((l) => customerLines.push(centerText(l)));
  customerLines.push(dividerSingle);

  // Dados do cancelamento
  customerLines.push('1a VIA - CLIENTE');
  wrapText(`OPERACAO ORIGINAL: ${opDesc}`).forEach((l) => customerLines.push(l));
  customerLines.push(truncateOrFit(`BANDEIRA: ${transaction.brandName.toUpperCase()}`));
  customerLines.push(truncateOrFit(`CARTAO: ${cardMasked}`));
  customerLines.push(truncateOrFit(`REDE: ${transaction.acquirerName.toUpperCase()}`));
  customerLines.push(truncateOrFit(`DOC/NSU ORIGINAL: ${transaction.nsu}`));
  customerLines.push(truncateOrFit(`NSU CANCELAMENTO: ${transaction.cancellationNsu || 'N/A'}`));
  customerLines.push(truncateOrFit(`AUTORIZACAO: ${transaction.authorizationCode}`));
  customerLines.push(truncateOrFit(`DATA/HORA ESTORNO: ${formatDateTime(cancelDateTime)}`));
  customerLines.push(
    justifyText('VALOR ESTORNADO:', `R$ ${formatCurrency(transaction.amount)}`)
  );

  if (reason) {
    wrapText(`MOTIVO: ${reason}`).forEach((l) => customerLines.push(l));
  }

  customerLines.push(dividerSingle);
  customerLines.push(centerText('ESTORNO CONFIRMADO NA REDE ADQUIRENTE'));
  customerLines.push(dividerDouble);

  const customerReceipt = finalizeReceiptText(customerLines);

  // ==========================================
  // 2ª VIA - ESTABELECIMENTO (CANCELAMENTO)
  // ==========================================
  const merchantLines: string[] = [];

  merchantLines.push(dividerDouble);
  merchantLines.push(centerText('COMPROVANTE DE CANCELAMENTO / ESTORNO'));
  merchantLines.push(centerText('TRANSACAO TEF'));
  merchantLines.push(dividerDouble);

  // Dados do estabelecimento (resumido)
  wrapText(storeInfo.name).forEach((l) => merchantLines.push(centerText(l)));
  const merchantCnpj = `CNPJ: ${storeInfo.cnpj}`;
  wrapText(merchantCnpj).forEach((l) => merchantLines.push(centerText(l)));
  merchantLines.push(dividerSingle);

  // Dados de controle interno
  merchantLines.push('2a VIA - ESTABELECIMENTO (CONTROLE INTERNO)');
  wrapText(`OPERACAO ORIGINAL: ${opDesc}`).forEach((l) => merchantLines.push(l));
  merchantLines.push(truncateOrFit(`BANDEIRA: ${transaction.brandName.toUpperCase()}`));
  merchantLines.push(truncateOrFit(`CARTAO: ${cardMasked}`));
  merchantLines.push(truncateOrFit(`REDE: ${transaction.acquirerName.toUpperCase()}`));
  merchantLines.push(truncateOrFit(`DOC/NSU ORIGINAL: ${transaction.nsu}`));
  merchantLines.push(truncateOrFit(`NSU CANCELAMENTO: ${transaction.cancellationNsu || 'N/A'}`));
  merchantLines.push(truncateOrFit(`AUTORIZACAO: ${transaction.authorizationCode}`));
  merchantLines.push(truncateOrFit(`DATA/HORA ESTORNO: ${formatDateTime(cancelDateTime)}`));
  merchantLines.push(
    justifyText('VALOR ESTORNADO:', `R$ ${formatCurrency(transaction.amount)}`)
  );

  if (reason) {
    wrapText(`MOTIVO: ${reason}`).forEach((l) => merchantLines.push(l));
  }

  // Vínculo fiscal NFC-e se houver saleId
  if (transaction.saleId != null) {
    const saleIdPadded = String(transaction.saleId).padStart(9, '0');
    merchantLines.push(truncateOrFit(`CUPOM FISCAL / NFC-e: ${saleIdPadded}`));
  }

  merchantLines.push(dividerSingle);
  merchantLines.push(centerText('ESTORNO CONFIRMADO NA REDE ADQUIRENTE'));
  merchantLines.push(dividerDouble);

  const merchantReceipt = finalizeReceiptText(merchantLines);

  // Junção ESC/POS com comando de corte de papel
  const fullEscPos = `${customerReceipt}\n\n\n\n${ESC_POS_CUT}\n\n${merchantReceipt}\n\n\n\n${ESC_POS_CUT}\n`;

  return {
    customerReceipt,
    merchantReceipt,
    fullEscPos,
  };
}
