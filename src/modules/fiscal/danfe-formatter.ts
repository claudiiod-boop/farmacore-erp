import type {
  CalculatedSaleTaxes,
  FiscalProfile,
  NfceInvoice,
} from './types';

export interface NfceInvoiceItemDetail {
  name: string;
  ean: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface NfceInvoicePaymentDetail {
  method: string;
  amount: number;
}

export interface NfceInvoiceDetails {
  invoice: NfceInvoice;
  profile: FiscalProfile;
  items: NfceInvoiceItemDetail[];
  payments: NfceInvoicePaymentDetail[];
  taxes: CalculatedSaleTaxes;
  customerCpf?: string | null;
  changeAmount?: number;
  danfeText?: string;
}

const WIDTH = 48;

function center(text: string, width = WIDTH): string {
  const trimmed = text.trim();
  if (trimmed.length >= width) {
    return trimmed.substring(0, width);
  }
  const leftPadding = Math.floor((width - trimmed.length) / 2);
  const rightPadding = width - trimmed.length - leftPadding;
  return ' '.repeat(leftPadding) + trimmed + ' '.repeat(rightPadding);
}

function twoColumns(left: string, right: string, width = WIDTH): string {
  const l = left.trim();
  const r = right.trim();
  const availableSpace = width - l.length - r.length;
  if (availableSpace <= 0) {
    const truncatedLeft = l.substring(0, Math.max(1, width - r.length - 1));
    return truncatedLeft + ' ' + r;
  }
  return l + ' '.repeat(availableSpace) + r;
}

function divider(char = '-', width = WIDTH): string {
  return char.repeat(width);
}

function wrapLine(text: string, width = WIDTH): string[] {
  const lines: string[] = [];
  let remaining = text.trim();
  while (remaining.length > width) {
    let splitIdx = remaining.lastIndexOf(' ', width);
    if (splitIdx === -1 || splitIdx < width / 2) {
      splitIdx = width;
    }
    lines.push(remaining.substring(0, splitIdx).trim());
    remaining = remaining.substring(splitIdx).trim();
  }
  if (remaining.length > 0) {
    lines.push(remaining);
  }
  return lines;
}

function formatCurrency(val: number): string {
  return val.toFixed(2).replace('.', ',');
}

export function formatDanfeNfce(details: NfceInvoiceDetails): string {
  const { invoice, profile, items, payments, taxes, customerCpf, changeAmount } = details;
  const lines: string[] = [];

  // 1. Header & Company Data
  if (profile.nomeFantasia) {
    wrapLine(profile.nomeFantasia, WIDTH).forEach((l) => lines.push(center(l)));
  }
  if (profile.razaoSocial) {
    wrapLine(profile.razaoSocial, WIDTH).forEach((l) => lines.push(center(l)));
  }
  lines.push(center(`CNPJ: ${profile.cnpj}  IE: ${profile.ie}`));
  const fullAddress = `${profile.logradouro}, ${profile.numero} - ${profile.bairro}, ${profile.municipio} - CEP: ${profile.cep}`;
  wrapLine(fullAddress, WIDTH).forEach((l) => lines.push(center(l)));

  lines.push(divider('-'));
  lines.push(center('DANFE NFC-e - Documento Auxiliar da'));
  lines.push(center('Nota Fiscal de Consumidor Eletrônica'));
  lines.push(center('NÃO PERMITE APROVEITAMENTO DE CRÉDITO DE ICMS'));
  lines.push(divider('-'));

  // 2. Contingency Warning
  if (invoice.tpEmis === 9) {
    lines.push(divider('='));
    lines.push(center('EMITIDA EM CONTINGÊNCIA - PENDENTE DE'));
    lines.push(center('AUTORIZAÇÃO'));
    lines.push(divider('='));
  }

  // 3. Items Table
  lines.push(twoColumns('ITEM  CÓDIGO  DESCRIÇÃO', ''));
  lines.push(twoColumns('QTD. x VL. UNIT(R$)', 'VALOR TOTAL(R$)'));
  lines.push(divider('-'));

  let totalItemsCount = 0;
  let totalItemsAmount = 0;

  items.forEach((item, index) => {
    totalItemsCount += item.quantity;
    totalItemsAmount += item.totalPrice;

    const itemNum = String(index + 1).padStart(3, '0');
    const eanShort = item.ean ? item.ean.slice(-7) : '0000000';
    const headerLine = `${itemNum}  ${eanShort}  ${item.name}`;
    wrapLine(headerLine, WIDTH).forEach((l) => lines.push(l));

    const qtdPrice = `  ${item.quantity} UN x R$ ${formatCurrency(item.unitPrice)}`;
    const totalStr = `R$ ${formatCurrency(item.totalPrice)}`;
    lines.push(twoColumns(qtdPrice, totalStr));
  });

  lines.push(divider('-'));

  // 4. Totals & Payments
  lines.push(twoColumns('QTD. TOTAL DE ITENS', String(totalItemsCount)));
  lines.push(twoColumns('VALOR TOTAL R$', formatCurrency(totalItemsAmount)));

  lines.push(divider('-'));
  lines.push(twoColumns('FORMA DE PAGAMENTO', 'VALOR PAGO R$'));
  for (const pay of payments) {
    lines.push(twoColumns(pay.method, formatCurrency(pay.amount)));
  }

  if (changeAmount !== undefined && changeAmount > 0) {
    lines.push(twoColumns('Troco R$', formatCurrency(changeAmount)));
  }

  // 5. Tax Breakdown (Lei 12.741/2012)
  lines.push(divider('-'));
  lines.push(center('Tributos Totais Incidentes (Lei 12.741/2012):'));
  lines.push(center(`R$ ${formatCurrency(taxes.vTotTrib)}`));

  // 6. Metadata / Emissão
  lines.push(divider('-'));
  const nNfPadded = String(invoice.nNF).padStart(9, '0');
  const seriePadded = String(invoice.serie).padStart(3, '0');
  lines.push(center(`NFC-e nº ${nNfPadded}  Série ${seriePadded}`));

  const dateFormatted = invoice.createdAt ? invoice.createdAt.replace('T', ' ').substring(0, 19) : '';
  lines.push(center(`Data de Emissão: ${dateFormatted}`));

  if (invoice.status === 'AUTORIZADA' && invoice.protocolNumber) {
    lines.push(center(`Protocolo de Autorização: ${invoice.protocolNumber}`));
  }

  lines.push(divider('-'));
  lines.push(center('CHAVE DE ACESSO'));
  const cleanKey = invoice.chNFe.replace(/\s+/g, '');
  const groups = cleanKey.match(/.{1,4}/g) ?? [cleanKey];
  if (groups.length > 6) {
    const line1 = groups.slice(0, 6).join(' ');
    const line2 = groups.slice(6).join(' ');
    lines.push(center(line1));
    lines.push(center(line2));
  } else {
    lines.push(center(groups.join(' ')));
  }

  lines.push(divider('-'));
  lines.push(center('CONSULTA VIA LEITOR DE QR CODE:'));
  wrapLine(invoice.qrCodeUrl, WIDTH).forEach((l) => lines.push(l));

  lines.push(divider('-'));
  if (customerCpf) {
    lines.push(center(`CONSUMIDOR CPF: ${customerCpf}`));
  } else {
    lines.push(center('CONSUMIDOR NÃO IDENTIFICADO'));
  }

  lines.push(divider('='));

  return lines.join('\n');
}
