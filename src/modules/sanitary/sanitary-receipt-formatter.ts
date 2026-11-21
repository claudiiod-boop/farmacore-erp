// FarmaCore ERP — Formatador Térmico ESC/POS para Validades, Recall e Laudo VISA (Fase 14)

export const ESC = '\x1b';
export const GS = '\x1d';
export const ESC_INIT = '\x1b@';
export const ESC_CUT = '\x1d\x56\x41\x10';
export const ESC_BOLD_ON = '\x1bE\x01';
export const ESC_BOLD_OFF = '\x1bE\x00';
export const ESC_ALIGN_LEFT = '\x1ba\x00';
export const ESC_ALIGN_CENTER = '\x1ba\x01';
export const ESC_ALIGN_RIGHT = '\x1ba\x02';

export interface StoreInfo {
  name?: string;
  cnpj?: string;
  address?: string;
  phone?: string;
}

export interface ExpiryAuditSlipItem {
  productName: string;
  ean: string;
  batchNumber: string;
  expirationDate: string;
  daysRemaining: number;
  quantity: number;
  suggestedAction?: string;
}

export interface ExpiryAuditSlipData {
  store?: StoreInfo;
  category?: string;
  printedAt?: string;
  columnWidth?: number;
  items: ExpiryAuditSlipItem[];
}

export interface RecallPatientReportItem {
  customerName: string;
  cpf?: string | null;
  phone?: string | null;
  saleId: number;
  saleDate: string;
  quantity: number;
  hasPrescription: boolean;
  prescriptionDoctor?: string | null;
}

export interface RecallPatientReportData {
  store?: StoreInfo;
  printedAt?: string;
  columnWidth?: number;
  recall: {
    resolutionNumber: string;
    publicationDate: string;
    reason: string;
  };
  affectedPatients: RecallPatientReportItem[];
}

export interface DisposalLaudoItem {
  productName: string;
  batchNumber: string;
  expirationDate: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface DisposalLaudoData {
  store?: StoreInfo;
  columnWidth?: number;
  printedAt?: string;
  loss: {
    lossNumber: string;
    reason: string;
    status: string;
    totalCostAmount: number;
    responsiblePharmacistName: string;
    pharmacistCrf: string;
    pharmacistCrfUf: string;
    laudoNumber?: string | null;
    disposalCompanyName?: string | null;
    disposalCertificateNumber?: string | null;
    mtrNumber?: string | null;
    disposedAt?: string | null;
    notes?: string | null;
    items: DisposalLaudoItem[];
  };
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + '…';
}

function padRight(str: string, len: number): string {
  if (str.length >= len) return str.substring(0, len);
  return str + ' '.repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  if (str.length >= len) return str.substring(0, len);
  return ' '.repeat(len - str.length) + str;
}

function justify(left: string, right: string, width: number): string {
  const available = width - right.length;
  if (available <= 0) return left.substring(0, width);
  return padRight(left, available) + right;
}

export function formatExpiryAuditSlip(data: ExpiryAuditSlipData): string {
  const width = data.columnWidth ?? 48;
  const divider = '='.repeat(width);
  const thinDivider = '-'.repeat(width);
  const lines: string[] = [];

  lines.push(ESC_INIT);
  lines.push(ESC_ALIGN_CENTER);
  lines.push(ESC_BOLD_ON + (data.store?.name ?? 'FARMACORE ERP & PDV') + ESC_BOLD_OFF);
  if (data.store?.cnpj) {
    lines.push(`CNPJ: ${data.store.cnpj}`);
  }
  lines.push(divider);
  lines.push(ESC_BOLD_ON + 'LISTA DE CONFERENCIA DE VALIDADES' + ESC_BOLD_OFF);
  lines.push(ESC_ALIGN_LEFT);
  if (data.category) {
    lines.push(`Faixa: ${data.category}`);
  }
  lines.push(`Data de Emissão: ${data.printedAt ?? new Date().toLocaleString('pt-BR')}`);
  lines.push(thinDivider);
  lines.push('[ ] AUDIT | PRODUTO / LOTE / VENC / QTD');
  lines.push(thinDivider);

  for (const item of data.items) {
    lines.push(`[ ] ${truncate(item.productName, width - 4)}`);
    const batchLine = `    Lote: ${item.batchNumber}  Venc: ${item.expirationDate}`;
    lines.push(batchLine);
    const detailLine = `    EAN: ${item.ean}  Dias: ${item.daysRemaining}  Qtd: ${item.quantity}`;
    lines.push(detailLine);
    if (item.suggestedAction) {
      lines.push(`    Ação Sugerida: ${item.suggestedAction}`);
    }
  }

  lines.push(thinDivider);
  lines.push(justify(`Total de Itens: ${data.items.length}`, '', width));
  lines.push('');
  lines.push('________________________________________________');
  lines.push(ESC_ALIGN_CENTER + 'Assinatura do Conferente / Auditor' + ESC_ALIGN_LEFT);
  lines.push('');
  lines.push(ESC_CUT);

  return lines.join('\n');
}

export function formatRecallPatientReport(data: RecallPatientReportData): string {
  const width = data.columnWidth ?? 48;
  const divider = '='.repeat(width);
  const thinDivider = '-'.repeat(width);
  const lines: string[] = [];

  lines.push(ESC_INIT);
  lines.push(ESC_ALIGN_CENTER);
  lines.push(ESC_BOLD_ON + (data.store?.name ?? 'FARMACORE ERP') + ESC_BOLD_OFF);
  lines.push(divider);
  lines.push(ESC_BOLD_ON + 'RECALL SANITARIO ANVISA' + ESC_BOLD_OFF);
  lines.push(ESC_BOLD_ON + 'RASTREABILIDADE REVERSA DE PACIENTES' + ESC_BOLD_OFF);
  lines.push(ESC_ALIGN_LEFT);
  lines.push(thinDivider);
  lines.push(`Resolução: ${data.recall.resolutionNumber}`);
  lines.push(`Publicação: ${data.recall.publicationDate}`);
  lines.push(`Motivo: ${truncate(data.recall.reason, width - 8)}`);
  lines.push(`Emissão: ${data.printedAt ?? new Date().toLocaleString('pt-BR')}`);
  lines.push(thinDivider);
  lines.push(ESC_BOLD_ON + `PACIENTES AFETADOS IDENTIFICADOS: ${data.affectedPatients.length}` + ESC_BOLD_OFF);
  lines.push(thinDivider);

  for (const p of data.affectedPatients) {
    lines.push(ESC_BOLD_ON + `Paciente: ${p.customerName}` + ESC_BOLD_OFF);
    if (p.cpf) lines.push(`CPF: ${p.cpf}`);
    if (p.phone) lines.push(`Tel: ${p.phone}`);
    lines.push(`Venda #${p.saleId} em ${p.saleDate} (Qtd: ${p.quantity})`);
    if (p.hasPrescription && p.prescriptionDoctor) {
      lines.push(`Prescritor: ${p.prescriptionDoctor}`);
    }
    lines.push('URGENTE: Notificar o paciente e orientar suspensão');
    lines.push(thinDivider);
  }

  lines.push('');
  lines.push(ESC_ALIGN_CENTER + 'Notificação Obrigatória - RDC 658/2022' + ESC_ALIGN_LEFT);
  lines.push('');
  lines.push(ESC_CUT);

  return lines.join('\n');
}

export function formatDisposalLaudoSlip(data: DisposalLaudoData): string {
  const width = data.columnWidth ?? 48;
  const divider = '='.repeat(width);
  const thinDivider = '-'.repeat(width);
  const lines: string[] = [];

  lines.push(ESC_INIT);
  lines.push(ESC_ALIGN_CENTER);
  lines.push(ESC_BOLD_ON + (data.store?.name ?? 'FARMACORE ERP & PDV') + ESC_BOLD_OFF);
  if (data.store?.cnpj) lines.push(`CNPJ: ${data.store.cnpj}`);
  if (data.store?.address) lines.push(data.store.address);
  lines.push(divider);
  lines.push(ESC_BOLD_ON + 'LAUDO OFICIAL DE DESCARTE SANITARIO' + ESC_BOLD_OFF);
  lines.push('TERMO DE INUTILIZACAO E INCINERACAO RSS');
  lines.push('Conforme RDC 306/2004 e Res. CONAMA 358');
  lines.push(ESC_ALIGN_LEFT);
  lines.push(thinDivider);
  lines.push(`Baixa Nº: ${data.loss.lossNumber}`);
  if (data.loss.laudoNumber) lines.push(`Laudo Nº: ${data.loss.laudoNumber}`);
  lines.push(`Motivo da Baixa: ${data.loss.reason}`);
  lines.push(`Farmacêutico RT: ${data.loss.responsiblePharmacistName}`);
  lines.push(`CRF/${data.loss.pharmacistCrfUf} ${data.loss.pharmacistCrf}`);
  lines.push(thinDivider);
  lines.push(ESC_BOLD_ON + 'MEDICAMENTOS E PRODUTOS INUTILIZADOS:' + ESC_BOLD_OFF);

  for (const it of data.loss.items) {
    lines.push(`- ${truncate(it.productName, width - 2)}`);
    lines.push(`  Lote: ${it.batchNumber}  Venc: ${it.expirationDate}`);
    lines.push(`  Qtd: ${it.quantity} un  |  Custo Total: R$ ${it.totalCost.toFixed(2)}`);
  }

  lines.push(thinDivider);
  lines.push(justify('Custo Total das Perdas:', `R$ ${data.loss.totalCostAmount.toFixed(2)}`, width));
  lines.push(thinDivider);

  if (data.loss.disposalCompanyName) {
    lines.push(ESC_BOLD_ON + 'DESTINACAO FINAL E TRATAMENTO RSS:' + ESC_BOLD_OFF);
    lines.push(`Empresa Coletora: ${data.loss.disposalCompanyName}`);
    if (data.loss.disposalCertificateNumber) {
      lines.push(`Certificado CDF: ${data.loss.disposalCertificateNumber}`);
    }
    if (data.loss.mtrNumber) {
      lines.push(`Manifesto MTR: ${data.loss.mtrNumber}`);
    }
    if (data.loss.disposedAt) {
      lines.push(`Data Coleta/Incineração: ${data.loss.disposedAt}`);
    }
    lines.push(thinDivider);
  }

  lines.push('');
  lines.push('Declaro sob as penas da lei que os produtos acima');
  lines.push('relacionados foram devidamente inutilizados e segregados');
  lines.push('para incineração conforme as boas práticas farmacêuticas.');
  lines.push('');
  lines.push('');
  lines.push('________________________________________________');
  lines.push(ESC_ALIGN_CENTER);
  lines.push('Assinatura e Carimbo do RT');
  lines.push(`${data.loss.responsiblePharmacistName} - CRF/${data.loss.pharmacistCrfUf} ${data.loss.pharmacistCrf}`);
  lines.push(ESC_ALIGN_LEFT);
  lines.push('');
  lines.push(ESC_CUT);

  return lines.join('\n');
}
