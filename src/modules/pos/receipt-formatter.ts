import { SaleDetails } from './types';

export interface ReceiptFormatOptions {
  storeName?: string;
  cnpj?: string;
  address?: string;
  city?: string;
  columnWidth?: number;
  taxRate?: number;
}

const DEFAULT_STORE_NAME = 'FARMACORE DROGARIA & FARMACIA';
const DEFAULT_CNPJ = '12.345.678/0001-90';
const DEFAULT_ADDRESS = 'Av. Paulista, 1000 - Bela Vista';
const DEFAULT_CITY = 'Sao Paulo - SP';
const DEFAULT_WIDTH = 48;
const DEFAULT_TAX_RATE = 0.3145; // 31.45% approx

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

function formatDateTime(dateStr?: string): string {
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

  // Handle ISO strings: 2026-11-02T10:30:00.000Z or SQLite format: 2026-11-02 10:30:00
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

export function formatReceipt(sale: SaleDetails, options?: ReceiptFormatOptions): string {
  const width = options?.columnWidth ?? DEFAULT_WIDTH;
  const storeName = options?.storeName ?? DEFAULT_STORE_NAME;
  const cnpj = options?.cnpj ?? DEFAULT_CNPJ;
  const address = options?.address ?? DEFAULT_ADDRESS;
  const city = options?.city ?? DEFAULT_CITY;
  const taxRate = options?.taxRate ?? DEFAULT_TAX_RATE;

  const lines: string[] = [];

  // 1. Header
  lines.push('='.repeat(width));
  lines.push(centerText(storeName, width));
  lines.push(centerText(`CNPJ: ${cnpj}`, width));
  lines.push(centerText(`${address} - ${city}`, width));
  lines.push('-'.repeat(width));

  const saleNumber = String(sale.sale.id).padStart(6, '0');
  const dateStr = formatDateTime(sale.sale.createdAt);
  lines.push(justifyText(`EXTRATO No ${saleNumber}`, dateStr, width));
  lines.push(centerText('EXTRATO DE VENDA AO CONSUMIDOR', width));
  if (sale.preSaleCode) {
    lines.push(justifyText(`PRE-VENDA: ${sale.preSaleCode}`, `STATUS: ${sale.sale.status}`, width));
  }
  lines.push('-'.repeat(width));

  // 2. Items Header & List
  lines.push(justifyText('# COD DESCRICAO', 'QTD x UNIT   TOTAL', width));
  lines.push('-'.repeat(width));

  for (const [index, item] of sale.items.entries()) {
    const itemNum = String(index + 1).padStart(3, '0');
    const prodLine = `${itemNum} ${item.productName}`;
    lines.push(truncateOrFit(prodLine, width));

    const qtyAndUnit = `    ${item.quantity} UN x R$ ${formatCurrency(item.unitPrice)}`;
    const totalItem = `R$ ${formatCurrency(item.totalPrice)}`;
    lines.push(justifyText(qtyAndUnit, totalItem, width));

    const expStr = item.expirationDate ? ` VAL: ${item.expirationDate}` : '';
    const lotLine = `    LOTE: ${item.batchNumber}${expStr}`;
    lines.push(truncateOrFit(lotLine, width));
  }

  // 3. Totals Section
  lines.push('-'.repeat(width));
  const subtotal = sale.sale.totalAmount + (sale.sale.discountAmount || 0);
  lines.push(justifyText('SUBTOTAL', `R$ ${formatCurrency(subtotal)}`, width));
  lines.push(justifyText('DESCONTO', `R$ ${formatCurrency(sale.sale.discountAmount || 0)}`, width));
  lines.push(justifyText('TOTAL R$', `R$ ${formatCurrency(sale.sale.totalAmount)}`, width));
  lines.push('-'.repeat(width));

  // 4. Payments Section
  lines.push(justifyText('FORMA DE PAGAMENTO', 'VALOR PAGO', width));
  for (const p of sale.payments) {
    const methodClean = p.method.replace(/_/g, ' ');
    lines.push(justifyText(methodClean, `R$ ${formatCurrency(p.amount)}`, width));
  }

  lines.push(justifyText('TROCO R$', `R$ ${formatCurrency(sale.sale.changeAmount || 0)}`, width));

  // 5. Controlled Substance Section (Portaria 344/98 / Antimicrobianos)
  if (sale.prescription) {
    const rx = sale.prescription;
    lines.push('-'.repeat(width));
    lines.push(centerText('*** DISPENSACAO SOB CONTROLE ESPECIAL ***', width));

    const rxLine = `RECEITA: ${rx.prescriptionType}   DATA: ${rx.prescriptionDate}`;
    lines.push(truncateOrFit(rxLine, width));

    const docLine = `MEDICO:  ${rx.doctorName}`;
    const crmLine = `CRM: ${rx.doctorCrm}/${rx.doctorUf}`;
    if (`${docLine}   ${crmLine}`.length <= width) {
      lines.push(`${docLine}   ${crmLine}`);
    } else {
      lines.push(truncateOrFit(docLine, width));
      lines.push(truncateOrFit(crmLine, width));
    }

    lines.push(truncateOrFit(`PACIENTE: ${rx.patientName}`, width));

    const buyerName = rx.buyerName || rx.patientName;
    const buyerCpf = rx.buyerCpf || 'N/I';
    const buyerLine = `COMPRADOR: ${buyerName}`;
    const cpfLine = `CPF: ${buyerCpf}`;
    if (`${buyerLine}   ${cpfLine}`.length <= width) {
      lines.push(`${buyerLine}   ${cpfLine}`);
    } else {
      lines.push(truncateOrFit(buyerLine, width));
      lines.push(truncateOrFit(cpfLine, width));
    }
    lines.push('-'.repeat(width));
  }

  // 6. Taxes & Fiscal Disclaimer (Lei 12.741/2012)
  const approxTax = Number((sale.sale.totalAmount * taxRate).toFixed(2));
  lines.push('-'.repeat(width));
  lines.push(
    truncateOrFit(
      `Trib. Aprox. (Lei 12.741/2012): R$ ${formatCurrency(approxTax)} (${(taxRate * 100).toFixed(2)}%)`,
      width
    )
  );
  lines.push(centerText('SIMULACAO DE CUPOM FISCAL - SEM VALOR FISCAL', width));
  lines.push(centerText('OBRIGADO PELA PREFERENCIA!', width));
  lines.push('='.repeat(width));

  // Final validation to guarantee no line exceeds width
  return lines.map((l) => truncateOrFit(l, width)).join('\n');
}
