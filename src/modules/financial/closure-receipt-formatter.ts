import type { CashClosure, StoreInfo } from './types';
import type { CashSession } from '../pos/types';

const DEFAULT_STORE_NAME = 'FARMACORE DROGARIA & FARMACIA';
const DEFAULT_CNPJ = '12.345.678/0001-90';
const DEFAULT_ADDRESS = 'Av. Paulista, 1000 - Bela Vista';
const DEFAULT_CITY = 'Sao Paulo - SP';
const DEFAULT_WIDTH = 48;

function centerText(text: string, width: number): string {
  if (text.length >= width) {
    return text.slice(0, width);
  }
  const totalPadding = width - text.length;
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
}

function justifyText(left: string, right: string, width: number): string {
  const combinedLength = left.length + right.length;
  if (combinedLength >= width) {
    const availableLeft = Math.max(0, width - right.length - 1);
    left = left.slice(0, availableLeft);
  }
  const spaceCount = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(spaceCount) + right;
}

function truncateOrFit(text: string, width: number): string {
  if (text.length > width) {
    return text.slice(0, width);
  }
  return text;
}

function formatCurrency(value: number): string {
  return value.toFixed(2);
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'N/D';

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

  return truncateOrFit(dateStr, 19);
}

/**
 * Formata o comprovante de fechamento cego de caixa em 48 colunas
 * para impressoras termicas ESC/POS e visualizacao em texto claro.
 */
export function formatCashClosureReceipt(
  closure: CashClosure,
  session: CashSession,
  storeInfo?: StoreInfo
): { textReceipt: string; fullEscPos: string } {
  const width = DEFAULT_WIDTH;
  const storeName = storeInfo?.name ?? storeInfo?.storeName ?? DEFAULT_STORE_NAME;
  const cnpj = storeInfo?.cnpj ?? DEFAULT_CNPJ;
  const address = storeInfo?.address ?? DEFAULT_ADDRESS;
  const city = storeInfo?.city ?? DEFAULT_CITY;
  const phone = storeInfo?.phone ? ` - TEL: ${storeInfo.phone}` : '';

  const lines: string[] = [];

  // 1. Cabecalho do Estabelecimento
  lines.push('='.repeat(width));
  lines.push(centerText(storeName, width));
  lines.push(centerText(`CNPJ: ${cnpj}`, width));
  lines.push(centerText(`${address} - ${city}${phone}`, width));
  lines.push('-'.repeat(width));

  // 2. Titulo e Identificacao da Sessao
  lines.push(centerText('COMPROVANTE DE FECHAMENTO DE CAIXA', width));
  lines.push(centerText('CONFERENCIA CEGA & AUDITORIA GERENCIAL', width));
  lines.push('-'.repeat(width));

  const sessionNum = String(session.id).padStart(6, '0');
  lines.push(justifyText(`SESSAO No: ${sessionNum}`, `STATUS: ${session.status}`, width));
  lines.push(justifyText(`OPERADOR: ${closure.operatorName}`, `FECHAMENTO: No ${closure.id}`, width));
  lines.push(justifyText('ABERTURA:', formatDateTime(session.openedAt), width));
  lines.push(justifyText('DECLARADO EM:', formatDateTime(closure.declaredAt), width));
  lines.push('-'.repeat(width));

  // 3. Demonstrativo de Movimentacao do Sistema (Valores Apurados)
  lines.push(centerText('*** VALORES APURADOS PELO SISTEMA ***', width));
  lines.push(justifyText('SALDO INICIAL (FUNDO DE TROCO)', `R$ ${formatCurrency(session.initialCash)}`, width));
  lines.push(justifyText('(+) SUPRIMENTOS DE CAIXA', `R$ ${formatCurrency(closure.systemSupplies)}`, width));
  lines.push(justifyText('(-) SANGRIA DE CAIXA', `R$ ${formatCurrency(closure.systemSangrias)}`, width));
  lines.push(justifyText('(+) VENDAS DINHEIRO LIQUIDO', `R$ ${formatCurrency(closure.systemCash - session.initialCash - closure.systemSupplies + closure.systemSangrias)}`, width));
  lines.push(justifyText('(=) DINHEIRO EM GAVETA ESPERADO', `R$ ${formatCurrency(closure.systemCash)}`, width));
  lines.push(justifyText('(+) CARTAO DE CREDITO', `R$ ${formatCurrency(closure.systemCredit)}`, width));
  lines.push(justifyText('(+) CARTAO DE DEBITO', `R$ ${formatCurrency(closure.systemDebit)}`, width));
  lines.push(justifyText('(+) PIX', `R$ ${formatCurrency(closure.systemPix)}`, width));
  lines.push(justifyText('(+) CONVENIO / PBM', `R$ ${formatCurrency(closure.systemPbm)}`, width));
  lines.push('-'.repeat(width));
  lines.push(justifyText('TOTAL APURADO SISTEMA', `R$ ${formatCurrency(closure.totalSystem)}`, width));
  lines.push('-'.repeat(width));

  // 4. Demonstrativo da Contagem Fisica Declarada (Operador)
  lines.push(centerText('*** CONTAGEM FISICA DECLARADA (OPERADOR) ***', width));
  lines.push(justifyText('DINHEIRO DECLARADO EM ESPECIE', `R$ ${formatCurrency(closure.declaredCash)}`, width));
  lines.push(justifyText('CARTAO DE CREDITO DECLARADO', `R$ ${formatCurrency(closure.declaredCredit)}`, width));
  lines.push(justifyText('CARTAO DE DEBITO DECLARADO', `R$ ${formatCurrency(closure.declaredDebit)}`, width));
  lines.push(justifyText('PIX DECLARADO', `R$ ${formatCurrency(closure.declaredPix)}`, width));
  lines.push(justifyText('CONVENIO / PBM DECLARADO', `R$ ${formatCurrency(closure.declaredPbm)}`, width));
  lines.push('-'.repeat(width));
  lines.push(justifyText('TOTAL DECLARADO PELO OPERADOR', `R$ ${formatCurrency(closure.totalDeclared)}`, width));

  if (closure.operatorNotes) {
    lines.push(truncateOrFit(`OBS OP: ${closure.operatorNotes}`, width));
  }
  lines.push('-'.repeat(width));

  // 5. Apuracao de Diferencas (Confronto)
  lines.push(centerText('*** APURACAO DE CONFERENCIA & DIFERENCAS ***', width));
  lines.push(justifyText('DIFERENCA EM DINHEIRO', `R$ ${formatCurrency(closure.cashDifference)}`, width));
  lines.push(justifyText('DIFERENCA TOTAL GERAL', `R$ ${formatCurrency(closure.totalDifference)}`, width));

  let statusDesc = 'EXATO - SEM DIFERENCA';
  if (closure.differenceStatus === 'SURPLUS') {
    statusDesc = 'SOBRA DE CAIXA';
  } else if (closure.differenceStatus === 'SHORTAGE') {
    statusDesc = 'QUEBRA DE CAIXA (FALTA)';
  }
  lines.push(justifyText('SITUACAO DA CONFERENCIA:', statusDesc, width));
  lines.push('-'.repeat(width));

  // 6. Homologacao Gerencial
  lines.push(centerText('*** HOMOLOGACAO & AUDITORIA GERENCIAL ***', width));
  let reviewText = 'PENDENTE DE HOMOLOGACAO';
  if (closure.status === 'APPROVED') {
    reviewText = 'APROVADO';
  } else if (closure.status === 'REJECTED') {
    reviewText = 'REJEITADO';
  }
  lines.push(justifyText('STATUS GERENCIAL:', reviewText, width));

  if (closure.managerName) {
    lines.push(justifyText('GERENTE RESPONSAVEL:', closure.managerName, width));
  }
  if (closure.reviewedAt) {
    lines.push(justifyText('DATA HOMOLOGACAO:', formatDateTime(closure.reviewedAt), width));
  }
  if (closure.managerNotes) {
    lines.push(truncateOrFit(`PARECER: ${closure.managerNotes}`, width));
  }
  lines.push('-'.repeat(width));

  // 7. Bloco de Assinaturas
  lines.push(centerText('ASSINATURAS DE CONFERENCIA', width));
  lines.push('');
  lines.push(centerText('________________________________________', width));
  lines.push(centerText(`Operador: ${closure.operatorName}`, width));
  lines.push('');
  lines.push(centerText('________________________________________', width));
  const managerDisplay = closure.managerName ? closure.managerName : 'Gerente / Responsavel';
  lines.push(centerText(`Homologador: ${managerDisplay}`, width));
  lines.push('='.repeat(width));

  const textReceipt = lines.map((l) => truncateOrFit(l, width)).join('\n');

  // Montagem do fluxo de bytes/comandos ESC/POS
  const ESC = '\x1b';
  const GS = '\x1d';

  const escPosCommands: string[] = [
    `${ESC}@`, // Initialize printer
    `${ESC}t\x00`, // Code page standard
    `${ESC}a\x01`, // Center alignment
    `${ESC}E\x01`, // Bold ON
    `${storeName}\n`,
    `${ESC}E\x00`, // Bold OFF
    `CNPJ: ${cnpj}\n`,
    `${address} - ${city}\n`,
    `${ESC}E\x01`,
    'COMPROVANTE DE FECHAMENTO DE CAIXA\n',
    `${ESC}E\x00`,
    `${ESC}a\x00`, // Left alignment
    textReceipt,
    '\n\n\n', // Paper feed
    `${GS}V\x00`, // Partial cut
  ];

  const fullEscPos = escPosCommands.join('');

  return {
    textReceipt,
    fullEscPos,
  };
}
