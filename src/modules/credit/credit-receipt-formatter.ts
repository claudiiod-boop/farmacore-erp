// FarmaCore ERP — Formatador Térmico ESC/POS e Comprovantes de Crediário (Fase 11)

import type {
  AgreementInvoiceWithDetails,
  Customer,
  CustomerReceivable,
} from './types';

export const ESC = '\x1b';
export const GS = '\x1d';
export const ESC_INIT = '\x1b@'; // \x1B\x40
export const ESC_CUT = '\x1d\x56\x41\x10'; // \x1D\x56\x41\x10 GS V 65 16 (Full cut with feed)
export const ESC_BOLD_ON = '\x1bE\x01';
export const ESC_BOLD_OFF = '\x1bE\x00';
export const ESC_ALIGN_LEFT = '\x1ba\x00';
export const ESC_ALIGN_CENTER = '\x1ba\x01';
export const ESC_ALIGN_RIGHT = '\x1ba\x02';

export interface StoreInfo {
  storeName?: string;
  name?: string;
  cnpj?: string;
  address?: string;
  city?: string;
  phone?: string;
}

export interface PromissoryNoteItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PromissoryNoteInstallment {
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string;
  amount: number;
}

export interface PromissoryNoteCustomer {
  id?: number;
  name: string;
  cpf: string;
  rg?: string | null;
  phone?: string | null;
  address?: string | null;
  registrationNumber?: string | null;
  department?: string | null;
}

export interface PromissoryNoteDependent {
  id?: number;
  name: string;
  cpf: string;
  relationship?: string;
}

export interface PromissoryNoteParams {
  store?: StoreInfo;
  saleId?: number | string;
  saleDate?: string;
  customer: PromissoryNoteCustomer;
  dependent?: PromissoryNoteDependent | null;
  items?: PromissoryNoteItem[];
  totalAmount: number;
  installments: PromissoryNoteInstallment[];
  agreementName?: string | null;
  columnWidth?: number;
}

export interface PaymentReceiptParams {
  store?: StoreInfo;
  customer: Customer;
  paidReceivables: CustomerReceivable[];
  totalPaid: number;
  remainingDebt: number;
  availableLimit: number;
  paymentMethod: string;
  cashSessionId?: number | null;
  operatorName?: string;
  paidAt?: string;
  columnWidth?: number;
}

export interface PayrollReportOptions {
  columnWidth?: number;
  store?: StoreInfo;
}

export interface FormattedReceipt {
  textReceipt: string;
  fullEscPos: string;
}

export interface FormattedPayrollReport {
  textReport: string;
  textReceipt: string;
  fullEscPos: string;
}

const DEFAULT_STORE: StoreInfo = {
  storeName: 'FARMACORE DROGARIA & FARMACIA',
  cnpj: '12.345.678/0001-90',
  address: 'Av. Paulista, 1000 - Bela Vista',
  city: 'Sao Paulo - SP',
  phone: '(11) 3200-0000',
};

// =========================================================================
// Funções Utilitárias de Alinhamento e Formatação
// =========================================================================

export function centerText(text: string, width = 48): string {
  if (text.length >= width) {
    return text.slice(0, width);
  }
  const totalPadding = width - text.length;
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
}

export function justifyText(left: string, right: string, width = 48): string {
  const combined = left.length + right.length;
  if (combined >= width) {
    const availableLeft = Math.max(0, width - right.length - 1);
    left = left.slice(0, availableLeft);
  }
  const spaceCount = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(spaceCount) + right;
}

export function truncateOrFit(text: string, width = 48): string {
  if (text.length > width) {
    return text.slice(0, width);
  }
  return text;
}

export function wrapText(text: string, width = 48): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;
    if (word.length > width) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      for (let i = 0; i < word.length; i += width) {
        lines.push(word.slice(i, i + width));
      }
      continue;
    }

    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= width) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export function formatCurrency(value: number): string {
  return (value || 0).toFixed(2);
}

export function formatDateBr(dateStr?: string | null): string {
  if (!dateStr) return '';
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}/${m}/${y}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

export function formatDateTimeBr(dateTimeStr?: string | null): string {
  if (!dateTimeStr) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}:${s}`;
  }

  const isoMatch = dateTimeStr.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):?(\d{2})?/
  );
  if (isoMatch) {
    const [, y, m, d, h, min, s] = isoMatch;
    return `${d}/${m}/${y} ${h}:${min}${s ? `:${s}` : ''}`;
  }
  return dateTimeStr;
}

// =========================================================================
// 1. NOTA PROMISSÓRIA / CONFISSÃO DE DÍVIDA (formatPromissoryNote)
// =========================================================================

export function formatPromissoryNote(params: PromissoryNoteParams): FormattedReceipt {
  const width = params.columnWidth ?? 48;
  const line = '-'.repeat(width);
  const doubleLine = '='.repeat(width);

  const store = {
    name: params.store?.storeName ?? params.store?.name ?? DEFAULT_STORE.storeName,
    cnpj: params.store?.cnpj ?? DEFAULT_STORE.cnpj,
    address: params.store?.address ?? DEFAULT_STORE.address,
    city: params.store?.city ?? DEFAULT_STORE.city,
    phone: params.store?.phone ?? DEFAULT_STORE.phone,
  };

  const lines: string[] = [];

  // Cabeçalho da Farmácia
  lines.push(doubleLine);
  lines.push(centerText(store.name!, width));
  if (store.cnpj) lines.push(centerText(`CNPJ: ${store.cnpj}`, width));
  if (store.address) lines.push(centerText(store.address, width));
  if (store.city) lines.push(centerText(store.city, width));
  lines.push(doubleLine);

  // Título do Documento
  lines.push(centerText('NOTA PROMISSÓRIA / CONFISSÃO DE DÍVIDA', width));
  lines.push(doubleLine);

  // Dados da Venda
  const saleIdStr = params.saleId ? `Venda #${params.saleId}` : 'Crediario Proprio';
  const saleDateStr = formatDateTimeBr(params.saleDate);
  lines.push(justifyText(saleIdStr, saleDateStr, width));
  lines.push(line);

  // Dados do Titular
  lines.push(truncateOrFit('TITULAR DO CREDIARIO:', width));
  lines.push(truncateOrFit(`Nome: ${params.customer.name}`, width));
  const docLine = params.customer.rg
    ? justifyText(`CPF: ${params.customer.cpf}`, `RG: ${params.customer.rg}`, width)
    : `CPF: ${params.customer.cpf}`;
  lines.push(truncateOrFit(docLine, width));

  if (params.customer.address) {
    const addrLines = wrapText(`End: ${params.customer.address}`, width);
    lines.push(...addrLines);
  }

  if (params.agreementName) {
    lines.push(truncateOrFit(`Convenio: ${params.agreementName}`, width));
  }

  // Dependente Comprador (se houver)
  if (params.dependent) {
    lines.push(line);
    lines.push(truncateOrFit('COMPRADOR / DEPENDENTE AUTORIZADO:', width));
    lines.push(truncateOrFit(`Nome: ${params.dependent.name}`, width));
    const depRel = params.dependent.relationship
      ? `Parentesco: ${params.dependent.relationship}`
      : '';
    lines.push(justifyText(`CPF: ${params.dependent.cpf}`, depRel, width));
  }

  // Resumo dos Itens da Compra
  if (params.items && params.items.length > 0) {
    lines.push(line);
    lines.push(centerText('RESUMO DOS ITENS', width));
    lines.push(justifyText('QTD x DESCRICAO', 'TOTAL', width));
    lines.push(line);

    for (const it of params.items) {
      const desc = `${it.quantity}x ${it.productName}`;
      const price = `R$ ${formatCurrency(it.totalPrice)}`;
      lines.push(justifyText(desc, price, width));
    }
  }

  lines.push(line);
  lines.push(justifyText('VALOR TOTAL DA VENDA:', `R$ ${formatCurrency(params.totalAmount)}`, width));
  lines.push(line);

  // Detalhamento das Parcelas com Vencimentos
  lines.push(centerText('PLANO DE PAGAMENTO / VENCIMENTOS', width));
  lines.push(line);

  for (const inst of params.installments) {
    const parcDesc = `Parc ${inst.installmentNumber}/${inst.totalInstallments} (Venc: ${formatDateBr(inst.dueDate)})`;
    const parcVal = `R$ ${formatCurrency(inst.amount)}`;
    lines.push(justifyText(parcDesc, parcVal, width));
  }
  lines.push(line);

  // Termo Jurídico de Confissão de Dívida
  lines.push(truncateOrFit('TERMO DE CONFISSÃO E PROMESSA DE PAGAMENTO:', width));
  const legalText =
    'Reconheço(emos) a exatidão desta dívida decorrente da aquisição dos produtos acima descritos e prometo(emos) pagar à FarmaCore ou à sua ordem a quantia supra discriminada nas datas de vencimento avençadas, constituindo título executivo extrajudicial nos termos do art. 784, III, do Código de Processo Civil (CPC).';
  const wrappedLegal = wrapText(legalText, width);
  lines.push(...wrappedLegal);
  lines.push(line);

  // Linha de Assinatura
  lines.push('');
  lines.push(centerText('_'.repeat(Math.min(40, width)), width));
  lines.push(centerText('Assinatura do Devedor / Emitente', width));
  lines.push(centerText(`Nome: ${params.customer.name}`, width));
  lines.push(centerText(`CPF: ${params.customer.cpf}`, width));
  lines.push(doubleLine);

  const textReceipt = lines.join('\n');

  // Montagem do fluxo ESC/POS
  const escPosCommands: string[] = [
    ESC_INIT, // \x1B\x40
    ESC_ALIGN_CENTER,
    ESC_BOLD_ON,
    `${store.name}\n`,
    ESC_BOLD_OFF,
    `CNPJ: ${store.cnpj}\n`,
    `${store.address} - ${store.city}\n`,
    `${line}\n`,
    ESC_BOLD_ON,
    'NOTA PROMISSÓRIA / CONFISSÃO DE DÍVIDA\n',
    ESC_BOLD_OFF,
    `${doubleLine}\n`,
    ESC_ALIGN_LEFT,
  ];

  // Adiciona o corpo do texto formatado
  for (let i = 6; i < lines.length - 6; i++) {
    escPosCommands.push(`${lines[i]}\n`);
  }

  // Bloco de assinatura centralizado
  escPosCommands.push(
    ESC_ALIGN_CENTER,
    '\n\n',
    `${'_'.repeat(Math.min(40, width))}\n`,
    ESC_BOLD_ON,
    'Assinatura do Devedor / Emitente\n',
    ESC_BOLD_OFF,
    `Nome: ${params.customer.name}\n`,
    `CPF: ${params.customer.cpf}\n`,
    `${doubleLine}\n`,
    '\n\n\n\n',
    ESC_CUT // \x1D\x56\x41\x10
  );

  const fullEscPos = escPosCommands.join('');

  return { textReceipt, fullEscPos };
}

// =========================================================================
// 2. RECIBO DE QUITAÇÃO DE CREDIÁRIO (formatPaymentReceipt)
// =========================================================================

export function formatPaymentReceipt(params: PaymentReceiptParams): FormattedReceipt {
  const width = params.columnWidth ?? 48;
  const line = '-'.repeat(width);
  const doubleLine = '='.repeat(width);

  const store = {
    name: params.store?.storeName ?? params.store?.name ?? DEFAULT_STORE.storeName,
    cnpj: params.store?.cnpj ?? DEFAULT_STORE.cnpj,
    address: params.store?.address ?? DEFAULT_STORE.address,
    city: params.store?.city ?? DEFAULT_STORE.city,
    phone: params.store?.phone ?? DEFAULT_STORE.phone,
  };

  const lines: string[] = [];

  // Cabeçalho da Farmácia
  lines.push(doubleLine);
  lines.push(centerText(store.name!, width));
  if (store.cnpj) lines.push(centerText(`CNPJ: ${store.cnpj}`, width));
  lines.push(doubleLine);

  // Título
  lines.push(centerText('RECIBO DE QUITAÇÃO DE CREDIÁRIO', width));
  lines.push(doubleLine);

  // Data/Hora, Sessão e Operador
  const paidAtStr = formatDateTimeBr(params.paidAt);
  const sessionStr = params.cashSessionId ? `Sessao: #${params.cashSessionId}` : '';
  lines.push(justifyText(`Data/Hora: ${paidAtStr}`, sessionStr, width));
  if (params.operatorName) {
    lines.push(truncateOrFit(`Operador: ${params.operatorName}`, width));
  }
  lines.push(line);

  // Cliente
  lines.push(truncateOrFit('CLIENTE:', width));
  lines.push(truncateOrFit(`Nome: ${params.customer.name}`, width));
  lines.push(truncateOrFit(`CPF: ${params.customer.cpf}`, width));
  lines.push(line);

  // Parcelas Liquidadas
  lines.push(centerText('PARCELAS LIQUIDADAS', width));
  lines.push(line);

  for (const rec of params.paidReceivables) {
    const desc = `Parc ${rec.installmentNumber}/${rec.totalInstallments} (Venc: ${formatDateBr(rec.dueDate)})`;
    const val = `R$ ${formatCurrency(rec.paidAmount || rec.originalAmount)}`;
    lines.push(justifyText(desc, val, width));
  }
  lines.push(line);

  // Totais e Forma de Pagamento
  lines.push(justifyText('TOTAL PAGO:', `R$ ${formatCurrency(params.totalPaid)}`, width));
  lines.push(justifyText('Forma de Pagamento:', params.paymentMethod, width));
  lines.push(line);

  // Saldos
  lines.push(justifyText('Saldo Devedor Restante:', `R$ ${formatCurrency(params.remainingDebt)}`, width));
  lines.push(justifyText('Limite Disponivel:', `R$ ${formatCurrency(params.availableLimit)}`, width));
  lines.push(doubleLine);
  lines.push(centerText('Guarde este comprovante para seu controle', width));
  lines.push(doubleLine);

  const textReceipt = lines.join('\n');

  // Fluxo ESC/POS
  const escPosCommands: string[] = [
    ESC_INIT, // \x1B\x40
    ESC_ALIGN_CENTER,
    ESC_BOLD_ON,
    `${store.name}\n`,
    ESC_BOLD_OFF,
    `CNPJ: ${store.cnpj}\n`,
    `${line}\n`,
    ESC_BOLD_ON,
    'RECIBO DE QUITAÇÃO DE CREDIÁRIO\n',
    ESC_BOLD_OFF,
    `${doubleLine}\n`,
    ESC_ALIGN_LEFT,
  ];

  for (let i = 5; i < lines.length - 2; i++) {
    escPosCommands.push(`${lines[i]}\n`);
  }

  escPosCommands.push(
    ESC_ALIGN_CENTER,
    'Guarde este comprovante para seu controle\n',
    `${doubleLine}\n`,
    '\n\n\n\n',
    ESC_CUT // \x1D\x56\x41\x10
  );

  const fullEscPos = escPosCommands.join('');

  return { textReceipt, fullEscPos };
}

// =========================================================================
// 3. EXTRATO DE RH / DESCONTO EM FOLHA (formatPayrollReport)
// =========================================================================

export function formatPayrollReport(
  invoice: AgreementInvoiceWithDetails,
  options?: PayrollReportOptions
): FormattedPayrollReport {
  const width = options?.columnWidth ?? 48;
  const line = '-'.repeat(width);
  const doubleLine = '='.repeat(width);

  const lines: string[] = [];

  // Cabeçalho
  lines.push(doubleLine);
  lines.push(centerText('EXTRATO DE RH - DESCONTO EM FOLHA', width));
  lines.push(doubleLine);

  // Dados da Empresa Parceira (Convênio)
  lines.push(truncateOrFit('EMPRESA CONVENIADA:', width));
  lines.push(truncateOrFit(`Razao Social: ${invoice.agreement.companyName}`, width));
  lines.push(truncateOrFit(`Nome Fantasia: ${invoice.agreement.tradeName}`, width));
  lines.push(justifyText(`CNPJ: ${invoice.agreement.cnpj}`, `Cod: ${invoice.agreement.code}`, width));
  lines.push(line);

  // Dados do Fechamento / Fatura
  lines.push(centerText('DADOS DO FECHAMENTO', width));
  lines.push(justifyText('Fatura No:', invoice.invoiceNumber, width));
  lines.push(
    justifyText(
      'Periodo:',
      `${formatDateBr(invoice.periodStart)} a ${formatDateBr(invoice.periodEnd)}`,
      width
    )
  );
  lines.push(justifyText('Vencimento:', formatDateBr(invoice.dueDate), width));
  lines.push(justifyText('Status:', invoice.status === 'PAID' ? 'QUITADO' : 'ABERTO / EMITIDA', width));
  lines.push(line);

  // Totais do Convênio
  lines.push(centerText('TOTAIS DO CONVENIO', width));
  lines.push(justifyText('Total Faturado:', `R$ ${formatCurrency(invoice.totalAmount)}`, width));
  lines.push(justifyText('Total de Colaboradores:', String(invoice.totalEmployeesCount), width));
  lines.push(justifyText('Total de Compras/Vendas:', String(invoice.totalSalesCount), width));
  lines.push(line);

  // Listagem de Colaboradores para Desconto em Folha
  lines.push(centerText('RELAÇÃO DE COLABORADORES PARA DESCONTO', width));
  lines.push(line);

  if (invoice.items && invoice.items.length > 0) {
    invoice.items.forEach((emp, idx) => {
      lines.push(`${idx + 1}. Colaborador: ${emp.customerName}`);
      lines.push(`   CPF: ${emp.cpf}`);
      const reg = emp.registrationNumber ? `Matricula: ${emp.registrationNumber}` : '';
      const dep = emp.department ? `Depto: ${emp.department}` : '';
      if (reg || dep) {
        lines.push(`   ${[reg, dep].filter(Boolean).join('   ')}`);
      }
      lines.push(`   Compras: ${emp.salesCount}`);
      lines.push(justifyText('   Valor a descontar em folha:', `R$ ${formatCurrency(emp.totalAmount)}`, width));
      lines.push(line);
    });
  } else {
    lines.push(centerText('(Nenhum colaborador com compras no período)', width));
    lines.push(line);
  }

  lines.push(doubleLine);
  lines.push(justifyText('TOTAL GERAL A RECOLHER:', `R$ ${formatCurrency(invoice.totalAmount)}`, width));
  lines.push(doubleLine);

  const textReport = lines.join('\n');

  // ESC/POS
  const escPosCommands: string[] = [
    ESC_INIT, // \x1B\x40
    ESC_ALIGN_CENTER,
    ESC_BOLD_ON,
    'EXTRATO DE RH - DESCONTO EM FOLHA\n',
    ESC_BOLD_OFF,
    `${invoice.agreement.companyName}\n`,
    `CNPJ: ${invoice.agreement.cnpj}\n`,
    `${line}\n`,
    ESC_ALIGN_LEFT,
  ];

  for (let i = 5; i < lines.length - 2; i++) {
    escPosCommands.push(`${lines[i]}\n`);
  }

  escPosCommands.push(
    ESC_ALIGN_CENTER,
    ESC_BOLD_ON,
    `TOTAL GERAL: R$ ${formatCurrency(invoice.totalAmount)}\n`,
    ESC_BOLD_OFF,
    `${doubleLine}\n`,
    '\n\n\n\n',
    ESC_CUT // \x1D\x56\x41\x10
  );

  const fullEscPos = escPosCommands.join('');

  return {
    textReport,
    textReceipt: textReport,
    fullEscPos,
  };
}
