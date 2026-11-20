// FarmaCore ERP — Formatador Térmico ESC/POS para CRM, Extratos de Cashback e Adesão a Tratamento (Fase 12)

import type {
  LoyaltyProgram,
  LoyaltyWallet,
  LoyaltyTransaction,
  PatientTreatment,
  UpcomingRefillItem,
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
  companyName?: string;
  cnpj?: string;
  address?: string;
  city?: string;
  phone?: string;
}

export interface CashbackCustomerInfo {
  id?: number;
  name: string;
  cpf: string;
  phone?: string | null;
}

export interface CashbackStatementParams {
  store?: StoreInfo;
  customer: CashbackCustomerInfo;
  wallet: LoyaltyWallet;
  transactions?: LoyaltyTransaction[];
  program?: LoyaltyProgram | null;
  columnWidth?: number;
  printedAt?: string;
}

export interface TreatmentRefillSlipCustomer {
  id?: number;
  name: string;
  cpf?: string;
  phone?: string | null;
}

export interface TreatmentRefillSlipProduct {
  id?: number;
  name: string;
  dosage?: string | null;
  activeIngredient?: string | null;
}

export interface TreatmentRefillSlipParams {
  store?: StoreInfo;
  treatment: PatientTreatment | UpcomingRefillItem | any;
  customer?: TreatmentRefillSlipCustomer;
  product?: TreatmentRefillSlipProduct;
  pharmacistName?: string;
  columnWidth?: number;
  printedAt?: string;
}

export interface FormattedReceipt {
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
// 1. EXTRATO DE CASHBACK (formatCashbackStatement)
// =========================================================================

export function formatCashbackStatement(params: CashbackStatementParams): FormattedReceipt {
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
  if (store.phone) lines.push(centerText(`Fone: ${store.phone}`, width));
  lines.push(doubleLine);

  // Título do Documento
  lines.push(centerText('CLUBE FARMACORE - EXTRATO DE CASHBACK', width));
  lines.push(centerText(`Impresso em: ${formatDateTimeBr(params.printedAt)}`, width));
  lines.push(line);

  // Dados do Titular
  lines.push(truncateOrFit(`CLIENTE: ${params.customer.name}`, width));
  lines.push(truncateOrFit(`CPF: ${params.customer.cpf}`, width));
  if (params.customer.phone) {
    lines.push(truncateOrFit(`TELEFONE: ${params.customer.phone}`, width));
  }
  lines.push(line);

  // Resumo de Saldos
  lines.push(centerText('RESUMO DE SALDOS E CRÉDITOS', width));
  lines.push(
    justifyText('SALDO DISPONÍVEL:', `R$ ${formatCurrency(params.wallet.currentBalance)}`, width)
  );
  lines.push(
    justifyText('Total Acumulado:', `R$ ${formatCurrency(params.wallet.totalEarned)}`, width)
  );
  lines.push(
    justifyText('Total Resgatado:', `R$ ${formatCurrency(params.wallet.totalRedeemed)}`, width)
  );
  if (params.wallet.totalExpired && params.wallet.totalExpired > 0) {
    lines.push(
      justifyText('Total Expirado:', `R$ ${formatCurrency(params.wallet.totalExpired)}`, width)
    );
  }
  lines.push(line);

  // Histórico de Transações
  lines.push(centerText('HISTÓRICO RECENTE DE TRANSAÇÕES', width));
  const txList = params.transactions ?? [];
  if (txList.length === 0) {
    lines.push(centerText('Nenhuma transação registrada.', width));
  } else {
    for (const tx of txList) {
      const typeLabel =
        tx.type === 'EARN'
          ? 'ACÚMULO'
          : tx.type === 'REDEEM'
            ? 'RESGATE'
            : tx.type === 'EXPIRE'
              ? 'EXPIRAÇÃO'
              : 'AJUSTE';
      const sign = tx.type === 'REDEEM' || tx.type === 'EXPIRE' ? '-' : '+';
      const dateText = formatDateBr(tx.createdAt);

      const headerRow = justifyText(
        `${dateText} [${typeLabel}]`,
        `${sign}R$ ${formatCurrency(tx.amount)}`,
        width
      );
      lines.push(headerRow);

      const balanceText = `Saldo após: R$ ${formatCurrency(tx.balanceAfter)}`;
      if (tx.notes) {
        lines.push(justifyText(`  ${truncateOrFit(tx.notes, width - 25)}`, balanceText, width));
      } else {
        lines.push(justifyText('  ', balanceText, width));
      }
    }
  }
  lines.push(line);

  // Termos Informativos de Validade
  const validityDays = params.program?.validityDays ?? 90;
  lines.push(truncateOrFit('TERMOS E CONDIÇÕES DO PROGRAMA DE CASHBACK:', width));
  const termsText =
    `Os créditos de cashback do Clube FarmaCore possuem validade improrrogável de ${validityDays} dias a contar da data de sua concessão. ` +
    `Créditos não utilizados dentro do prazo estipulado serão expirados automaticamente. O resgate é pessoal, intransferível e aplicável como desconto em compras futuras ` +
    `diretamente no caixa, mediante identificação do CPF do titular cadastrado.`;
  const wrappedTerms = wrapText(termsText, width);
  lines.push(...wrappedTerms);
  lines.push(line);

  // Rodapé
  lines.push(centerText('Obrigado por fazer parte do Clube FarmaCore!', width));
  lines.push(centerText('Cuidando da sua saúde e do seu bolso.', width));
  lines.push(doubleLine);

  const textReceipt = lines.join('\n');

  // Montagem do fluxo ESC/POS binário
  const escPosCommands: string[] = [
    ESC_INIT, // \x1B\x40
    ESC_ALIGN_CENTER,
    ESC_BOLD_ON,
    `${store.name}\n`,
    ESC_BOLD_OFF,
    store.cnpj ? `CNPJ: ${store.cnpj}\n` : '',
    store.address ? `${store.address}\n` : '',
    `${line}\n`,
    ESC_BOLD_ON,
    'CLUBE FARMACORE - EXTRATO DE CASHBACK\n',
    ESC_BOLD_OFF,
    `${line}\n`,
    ESC_ALIGN_LEFT,
  ];

  // Adiciona o miolo do extrato
  for (let i = 7; i < lines.length - 3; i++) {
    escPosCommands.push(`${lines[i]}\n`);
  }

  // Rodapé e corte
  escPosCommands.push(
    ESC_ALIGN_CENTER,
    '\n',
    'Obrigado por fazer parte do Clube FarmaCore!\n',
    `${doubleLine}\n`,
    '\n\n\n\n',
    ESC_CUT // \x1D\x56\x41\x10
  );

  const fullEscPos = escPosCommands.join('');

  return { textReceipt, fullEscPos };
}

// =========================================================================
// 2. FILIPETA DE ALERTA DE RECOMPRA PREDITIVA (formatTreatmentRefillSlip)
// =========================================================================

export function formatTreatmentRefillSlip(params: TreatmentRefillSlipParams): FormattedReceipt {
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

  const t = params.treatment;
  const patientName =
    params.customer?.name ??
    t.customerName ??
    t.customer_name ??
    'Paciente não identificado';
  const patientPhone =
    params.customer?.phone ??
    t.customerPhone ??
    t.customer_phone ??
    null;

  const productName =
    params.product?.name ??
    t.productName ??
    t.product_name ??
    'Medicamento de Uso Contínuo';
  const dosage =
    params.product?.dosage ??
    t.dosage ??
    t.productDosage ??
    t.product_dosage ??
    t.activeIngredient ??
    'Dosagem padrão';

  const dailyDose = t.dailyDose ?? t.daily_dose ?? 1;
  const unitsPerBox = t.unitsPerBox ?? t.units_per_box ?? 30;
  const boxesPurchased = t.boxesPurchased ?? t.boxes_purchased ?? 1;
  const totalDaysSupply = t.totalDaysSupply ?? t.total_days_supply ?? 30;
  const startDate = t.startDate ?? t.start_date ?? '';
  const expectedRefillDate = t.expectedRefillDate ?? t.expected_refill_date ?? '';

  let daysUntilRefill = t.daysUntilRefill ?? t.days_until_refill;
  if (daysUntilRefill === undefined && expectedRefillDate) {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const msDiff = new Date(expectedRefillDate).getTime() - new Date(todayStr).getTime();
    daysUntilRefill = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
  }

  const lines: string[] = [];

  // Cabeçalho da Farmácia
  lines.push(doubleLine);
  lines.push(centerText(store.name!, width));
  if (store.cnpj) lines.push(centerText(`CNPJ: ${store.cnpj}`, width));
  if (store.address) lines.push(centerText(store.address, width));
  lines.push(doubleLine);

  // Título
  lines.push(centerText('ALERTA DE RECOMPRA PREDITIVA', width));
  lines.push(centerText('ATENÇÃO FARMACÊUTICA & ADESÃO A TRATAMENTO', width));
  lines.push(centerText(`Emissão: ${formatDateTimeBr(params.printedAt)}`, width));
  lines.push(line);

  // Dados do Paciente
  lines.push(truncateOrFit(`PACIENTE: ${patientName}`, width));
  lines.push(truncateOrFit(`TELEFONE: ${patientPhone || 'Não informado'}`, width));
  lines.push(line);

  // Dados do Medicamento e Posologia
  lines.push(centerText('MEDICAMENTO DE USO CONTÍNUO', width));
  lines.push(truncateOrFit(`Produto: ${productName}`, width));
  lines.push(truncateOrFit(`Dosagem: ${dosage}`, width));
  lines.push(
    justifyText(
      `Posologia: ${dailyDose} dose(s)/dia`,
      `(${unitsPerBox} un/cx)`,
      width
    )
  );
  lines.push(
    justifyText(
      `Comprado: ${boxesPurchased} cx (${totalDaysSupply} dias)`,
      `Início: ${formatDateBr(startDate)}`,
      width
    )
  );
  lines.push(line);

  // Previsão de Término e Dias Restantes
  lines.push(centerText('PREVISÃO DE RECOMPRA E TÉRMINO', width));
  lines.push(
    justifyText(
      'Término Estimado:',
      formatDateBr(expectedRefillDate),
      width
    )
  );
  lines.push(
    justifyText(
      'Dias Restantes:',
      `${daysUntilRefill !== undefined ? daysUntilRefill : '--'} dia(s)`,
      width
    )
  );
  lines.push(line);

  // Campo de Anotações do Farmacêutico
  lines.push(centerText('ANOTAÇÕES DO FARMACÊUTICO', width));
  if (t.notes) {
    lines.push(truncateOrFit(`Obs anterior: ${t.notes}`, width));
  }
  lines.push('Data: ___/___/____  Farmacêutico: ______________');
  lines.push('[ ] Contatado com sucesso - Recompra agendada');
  lines.push('[ ] Interrompeu tratamento por prescrição médica');
  lines.push('[ ] Paciente sem resposta / Número ocupado');
  lines.push('Observações clínicas / Posologia:');
  lines.push('________________________________________________');
  lines.push('________________________________________________');

  if (params.pharmacistName) {
    lines.push(line);
    lines.push(centerText(params.pharmacistName, width));
  }

  lines.push(doubleLine);

  const textReceipt = lines.join('\n');

  // Montagem do fluxo ESC/POS
  const escPosCommands: string[] = [
    ESC_INIT, // \x1B\x40
    ESC_ALIGN_CENTER,
    ESC_BOLD_ON,
    `${store.name}\n`,
    ESC_BOLD_OFF,
    store.cnpj ? `CNPJ: ${store.cnpj}\n` : '',
    `${line}\n`,
    ESC_BOLD_ON,
    'ALERTA DE RECOMPRA PREDITIVA\n',
    ESC_BOLD_OFF,
    'Atenção Farmacêutica\n',
    `${doubleLine}\n`,
    ESC_ALIGN_LEFT,
  ];

  for (let i = 6; i < lines.length - 2; i++) {
    escPosCommands.push(`${lines[i]}\n`);
  }

  escPosCommands.push(
    ESC_ALIGN_CENTER,
    '\n',
    `${doubleLine}\n`,
    '\n\n\n\n',
    ESC_CUT // \x1D\x56\x41\x10
  );

  const fullEscPos = escPosCommands.join('');

  return { textReceipt, fullEscPos };
}
