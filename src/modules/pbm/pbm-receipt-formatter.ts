/**
 * Formatador do Cupom Vinculado ESC/POS 48 Colunas
 * Programa Farmácia Popular do Brasil (Ministério da Saúde / Datasus / Denasus)
 * e Convênios Farmacêuticos (PBM).
 */

import type {
  PbmTransaction,
  PbmTransactionItem,
  StoreInfo,
} from './types';

export const RECEIPT_WIDTH = 48;
export const ESC_POS_CUT = '\x1b\x69'; // ESC i - paper cut
export const ESC_POS_CUT_ALT = '\x1d\x56\x41\x00'; // GS V 65 0

/**
 * Mascara o CPF no formato regulatório 123.***.***-00
 */
export function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.***.***-${digits.slice(9, 11)}`;
  }
  if (cpf.includes('***')) {
    return cpf;
  }
  if (cpf.length >= 5) {
    return `${cpf.slice(0, 3)}***${cpf.slice(-2)}`;
  }
  return '***.***.***-**';
}

/**
 * Formata moeda no padrão brasileiro (ex: 12,00)
 */
export function formatCurrency(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

/**
 * Formata apenas a data DD/MM/AAAA
 */
export function formatDateOnly(dateStr?: string | null): string {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const brMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    return dateStr.slice(0, 10);
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }
  return dateStr.slice(0, 10);
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
 * Centraliza um texto na largura da bobina
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
 * Justifica à esquerda e à direita na mesma linha
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

function truncateOrFit(text: string, width = RECEIPT_WIDTH): string {
  if (text.length > width) {
    return text.slice(0, width);
  }
  return text;
}

function finalizeReceiptText(lines: string[], width = RECEIPT_WIDTH): string {
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
 * Formata as 2 vias do Cupom Vinculado (Consumidor e Estabelecimento/Denasus)
 * e o comando completo de impressão ESC/POS.
 */
export function formatPbmReceipt(
  transaction: PbmTransaction,
  items: (PbmTransactionItem & { batchNumber?: string })[],
  storeInfo: StoreInfo
): {
  consumerCopy: string;
  storeCopy: string;
  fullEscPos: string;
} {
  const dividerDouble = '='.repeat(RECEIPT_WIDTH);
  const dividerSingle = '-'.repeat(RECEIPT_WIDTH);

  // ==========================================
  // 1ª VIA - CONSUMIDOR
  // ==========================================
  const consumerLines: string[] = [];

  consumerLines.push(dividerDouble);
  consumerLines.push(centerText('AQUI TEM FARMÁCIA POPULAR'));
  consumerLines.push(centerText('MINISTÉRIO DA SAÚDE'));
  consumerLines.push(dividerDouble);

  // Dados do estabelecimento
  wrapText(storeInfo.name).forEach((l) => consumerLines.push(centerText(l)));
  const cnpjIe = storeInfo.ie
    ? `CNPJ: ${storeInfo.cnpj}  IE: ${storeInfo.ie}`
    : `CNPJ: ${storeInfo.cnpj}`;
  wrapText(cnpjIe).forEach((l) => consumerLines.push(centerText(l)));
  wrapText(storeInfo.address).forEach((l) => consumerLines.push(centerText(l)));
  consumerLines.push(dividerSingle);

  // Identificação da autorização
  consumerLines.push(centerText('1a VIA - CONSUMIDOR'));
  consumerLines.push(truncateOrFit(`PROTOCOLO AUTORIZACAO: ${transaction.authorizationProtocol}`));
  if (transaction.receiptNumber) {
    consumerLines.push(truncateOrFit(`RECIBO DATASUS: ${transaction.receiptNumber}`));
  }
  const authDateTime = transaction.confirmedAt || transaction.createdAt;
  consumerLines.push(truncateOrFit(`DATA AUTORIZACAO: ${formatDateTime(authDateTime)}`));
  wrapText(`BENEFICIARIO: ${transaction.patientName}`).forEach((l) => consumerLines.push(l));
  consumerLines.push(truncateOrFit(`CPF: ${maskCpf(transaction.patientCpf)}`));

  const doctorLabel = transaction.doctorName
    ? `${transaction.doctorName} - CRM ${transaction.doctorCrm}/${transaction.doctorUf}`
    : `CRM ${transaction.doctorCrm}/${transaction.doctorUf}`;
  wrapText(`MEDICO: ${doctorLabel}`).forEach((l) => consumerLines.push(l));
  consumerLines.push(truncateOrFit(`DATA DA RECEITA: ${formatDateOnly(transaction.prescriptionDate)}`));

  if (transaction.proxyName) {
    wrapText(`PROCURADOR: ${transaction.proxyName}`).forEach((l) => consumerLines.push(l));
    consumerLines.push(truncateOrFit(`CPF PROCURADOR: ${maskCpf(transaction.proxyCpf || '')}`));
  }
  consumerLines.push(dividerSingle);

  // Itens autorizados
  consumerLines.push('ITENS AUTORIZADOS:');
  for (const item of items) {
    wrapText(item.productName).forEach((l) => consumerLines.push(l));
    const qtyUnit = `   ${item.authorizedQuantity} UN x R$ ${formatCurrency(item.unitGrossPrice)}`;
    const totalItem = `R$ ${formatCurrency(item.totalGrossPrice)}`;
    consumerLines.push(justifyText(qtyUnit, totalItem));
    consumerLines.push(justifyText('   VLR SUBSIDIO GOVERNO:', `R$ ${formatCurrency(item.subsidyTotalPrice)}`));
    consumerLines.push(justifyText('   VLR PAGO PACIENTE:', `R$ ${formatCurrency(item.patientTotalPrice)}`));
  }
  consumerLines.push(dividerSingle);

  // Totalizadores
  consumerLines.push(justifyText('TOTAL BRUTO:', `R$ ${formatCurrency(transaction.totalGrossAmount)}`));
  consumerLines.push(justifyText('TOTAL SUBSIDIADO (MIN. SAUDE):', `R$ ${formatCurrency(transaction.subsidyAmount)}`));
  consumerLines.push(justifyText('TOTAL A PAGAR PELO BENEFICIARIO:', `R$ ${formatCurrency(transaction.patientCopayAmount)}`));
  consumerLines.push(dividerDouble);

  const consumerCopy = finalizeReceiptText(consumerLines);

  // ==========================================
  // 2ª VIA - ESTABELECIMENTO (GUARDA 5 ANOS)
  // ==========================================
  const storeLines: string[] = [];

  storeLines.push(dividerDouble);
  storeLines.push(centerText('AQUI TEM FARMÁCIA POPULAR'));
  storeLines.push(centerText('MINISTÉRIO DA SAÚDE'));
  storeLines.push(dividerDouble);
  storeLines.push(centerText('2a VIA - ESTABELECIMENTO'));
  storeLines.push(centerText('(GUARDA OBRIGATORIA: 5 ANOS)'));
  storeLines.push(truncateOrFit(`PROTOCOLO AUTORIZACAO: ${transaction.authorizationProtocol}`));
  if (transaction.receiptNumber) {
    storeLines.push(truncateOrFit(`RECIBO DATASUS: ${transaction.receiptNumber}`));
  }

  // NFC-e / Cupom Fiscal
  if (transaction.nfceNumber != null) {
    storeLines.push(truncateOrFit(`CUPOM FISCAL / NFC-e: ${transaction.nfceNumber}`));
  } else if (transaction.fiscalKeyNfce) {
    storeLines.push(truncateOrFit(`CUPOM FISCAL / NFC-e: ${transaction.fiscalKeyNfce.slice(25, 34)}`));
  } else {
    storeLines.push('CUPOM FISCAL / NFC-e: N/A');
  }

  storeLines.push(truncateOrFit(`DATA: ${formatDateTime(authDateTime)}`));
  wrapText(`BENEFICIARIO: ${transaction.patientName}`).forEach((l) => storeLines.push(l));

  const birthDateStr = transaction.patientBirthDate ? `  DT NASC: ${formatDateOnly(transaction.patientBirthDate)}` : '';
  const patientCpfBirth = `CPF: ${maskCpf(transaction.patientCpf)}${birthDateStr}`;
  if (patientCpfBirth.length <= RECEIPT_WIDTH) {
    storeLines.push(patientCpfBirth);
  } else {
    storeLines.push(`CPF: ${maskCpf(transaction.patientCpf)}`);
    if (birthDateStr.trim()) {
      storeLines.push(birthDateStr.trim());
    }
  }

  wrapText(`MEDICO: ${doctorLabel}`).forEach((l) => storeLines.push(l));
  storeLines.push(truncateOrFit(`DATA RECEITA: ${formatDateOnly(transaction.prescriptionDate)}`));

  if (transaction.proxyName) {
    wrapText(`PROCURADOR: ${transaction.proxyName}`).forEach((l) => storeLines.push(l));
    storeLines.push(truncateOrFit(`CPF PROCURADOR: ${maskCpf(transaction.proxyCpf || '')}`));
  }
  storeLines.push(dividerSingle);

  // Itens dispensados / Auditoria Denasus
  storeLines.push('ITENS DISPENSADOS / AUDITORIA DENASUS:');
  for (const [idx, item] of items.entries()) {
    const itemNum = String(idx + 1).padStart(2, '0');
    wrapText(`${itemNum}. ${item.productName}`).forEach((l) => storeLines.push(l));
    const batchLabel = item.batchNumber || (item.batchId ? `LOT${item.batchId}` : 'N/A');
    storeLines.push(truncateOrFit(`    EAN: ${item.ean} | LOTE: ${batchLabel}`));
    storeLines.push(truncateOrFit(`    QTD AUTORIZADA: ${item.authorizedQuantity} UN | DOSE DIARIA: ${item.dailyDose.toFixed(1)}`));
    storeLines.push(truncateOrFit(`    VLR BRUTO: R$ ${formatCurrency(item.totalGrossPrice)} | SUBSIDIO: R$ ${formatCurrency(item.subsidyTotalPrice)}`));
  }
  storeLines.push(dividerSingle);

  // Totalizadores
  storeLines.push(justifyText('TOTAL BRUTO:', `R$ ${formatCurrency(transaction.totalGrossAmount)}`));
  storeLines.push(justifyText('TOTAL SUBSIDIADO:', `R$ ${formatCurrency(transaction.subsidyAmount)}`));
  storeLines.push(justifyText('TOTAL PAGO PELO PACIENTE:', `R$ ${formatCurrency(transaction.patientCopayAmount)}`));
  storeLines.push(dividerSingle);

  // Termo Legal Denasus
  storeLines.push('DECLARO TER RECEBIDO DO MINISTÉRIO DA SAÚDE,');
  storeLines.push('ATRAVÉS DO PROGRAMA FARMÁCIA POPULAR DO BRASIL,');
  storeLines.push('OS MEDICAMENTOS/FRALDAS CONSTANTES NESTE CUPOM.');
  storeLines.push('');
  storeLines.push('_'.repeat(RECEIPT_WIDTH));
  storeLines.push(centerText('ASSINATURA DO BENEFICIARIO OU PROCURADOR LEGAL'));
  const signatoryName = transaction.proxyName || transaction.patientName;
  wrapText(`NOME: ${signatoryName}`).forEach((l) => storeLines.push(l));
  storeLines.push('RG: ___________________ ORGAO EMISSOR: _________');
  storeLines.push('');
  storeLines.push('_'.repeat(RECEIPT_WIDTH));

  const crfUf = storeInfo.pharmacistUf || 'UF';
  const crfNum = storeInfo.pharmacistCrf || 'XXXXX';
  const pharmacistLine = `FARMACÊUTICO RESPONSÁVEL TÉCNICO - CRF/${crfUf} ${crfNum}`;
  wrapText(pharmacistLine).forEach((l) => storeLines.push(centerText(l)));
  storeLines.push(dividerDouble);

  const storeCopy = finalizeReceiptText(storeLines);

  // Junção ESC/POS com comando de corte de papel
  const fullEscPos = `${consumerCopy}\n\n\n\n${ESC_POS_CUT}\n\n${storeCopy}\n\n\n\n${ESC_POS_CUT}\n`;

  return {
    consumerCopy,
    storeCopy,
    fullEscPos,
  };
}
