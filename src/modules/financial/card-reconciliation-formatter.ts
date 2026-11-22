import { DivergenceReport, ReceivablesCalendarDay } from './card-reconciliation.types';

export class CardReconciliationFormatter {
  private static readonly LINE_WIDTH = 48;

  private static formatCurrency(val: number): string {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private static formatDateBR(isoDate: string): string {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
  }

  private static padCenter(text: string, width = CardReconciliationFormatter.LINE_WIDTH): string {
    if (text.length >= width) return text.substring(0, width);
    const leftPad = Math.floor((width - text.length) / 2);
    return ' '.repeat(leftPad) + text;
  }

  private static line(char = '-'): string {
    return char.repeat(this.LINE_WIDTH);
  }

  /**
   * Formata relatório térmico ESC/POS de 48 colunas para auditoria e contestação de divergências.
   */
  static formatDivergenceAuditSlip(
    report: DivergenceReport,
    storeInfo: { name: string; cnpj: string }
  ): string {
    const lines: string[] = [];

    lines.push(this.line('='));
    lines.push(this.padCenter(storeInfo.name.toUpperCase()));
    lines.push(this.padCenter(`CNPJ: ${storeInfo.cnpj}`));
    lines.push(this.line('-'));
    lines.push(this.padCenter('AUDITORIA DE DIVERGENCIAS DE TAXA MDR'));
    lines.push(this.padCenter('COMPROVANTE PARA CONTESTACAO DE TARIFAS'));
    lines.push(this.line('='));
    lines.push(`EMISSAO: ${new Date().toLocaleString('pt-BR')}`);
    lines.push(`TOTAL DE DIVERGENCIAS: ${report.totalDivergentCount}`);
    lines.push(`VALOR COBRADO A MAIOR: R$ ${this.formatCurrency(report.totalOverchargedAmount)}`);
    lines.push(this.line('-'));
    lines.push('ITENS DIVERGENTES (TAXA COBRADA > CONTRATUAL):');
    lines.push(this.line('-'));

    for (const item of report.items) {
      lines.push(`NSU: ${item.nsu}  AUTH: ${item.authorizationCode || 'N/A'}`);
      lines.push(`Data Venda: ${item.transactionDate}`);
      lines.push(`Adq/Bandeira: ${item.acquirerName} / ${item.brandName}`);
      lines.push(`Valor Bruto: R$ ${this.formatCurrency(item.grossAmount)}`);
      lines.push(`Taxa Cobrada: ${item.chargedMdrRate.toFixed(2)}% (R$ ${this.formatCurrency(item.chargedFeeAmount)})`);
      lines.push(`Taxa Contrato: ${item.contractMdrRate.toFixed(2)}% (R$ ${this.formatCurrency(item.expectedFeeAmount)})`);
      lines.push(`Diferenca a ressarcir: R$ ${this.formatCurrency(item.divergenceAmount)}`);
      lines.push(this.line('.'));
    }

    lines.push(this.line('='));
    lines.push(this.padCenter('FarmaCore ERP & PDV - Modulo Financeiro'));
    lines.push(this.padCenter('Documento de Suporte para Abertura de Chamado'));
    lines.push(this.line('='));
    lines.push('\n\n\n'); // Espaçamento de corte guilhotina

    return lines.join('\n');
  }

  /**
   * Formata extrato térmico ESC/POS de 48 colunas para fechamento e conciliação de recebíveis diários.
   */
  static formatDailySettlementSlip(
    day: ReceivablesCalendarDay,
    storeInfo: { name: string; cnpj: string }
  ): string {
    const lines: string[] = [];

    lines.push(this.line('='));
    lines.push(this.padCenter(storeInfo.name.toUpperCase()));
    lines.push(this.padCenter(`CNPJ: ${storeInfo.cnpj}`));
    lines.push(this.line('-'));
    lines.push(this.padCenter('EXTRATO DE LIQUIDACAO DE CARTOES'));
    lines.push(this.padCenter(`DATA PREVISTA: ${this.formatDateBR(day.date)}`));
    lines.push(this.line('='));
    lines.push(`Total de Transacoes: ${day.transactionCount}`);
    lines.push(`Bruto Previsto: R$ ${this.formatCurrency(day.totalGross)}`);
    lines.push(`Taxas Totais: R$ ${this.formatCurrency(day.totalFee)}`);
    lines.push(`Liquido a Depositar: R$ ${this.formatCurrency(day.totalNet)}`);
    lines.push(this.line('-'));
    lines.push('DETALHAMENTO POR ADQUIRENTE:');
    lines.push(this.line('-'));

    for (const [acquirer, data] of Object.entries(day.byAcquirer)) {
      lines.push(`* ${acquirer}:`);
      lines.push(`  Transacoes: ${data.count}`);
      lines.push(`  Bruto: R$ ${this.formatCurrency(data.gross)}`);
      lines.push(`  Liquido: R$ ${this.formatCurrency(data.net)}`);
    }

    lines.push(this.line('='));
    lines.push(this.padCenter('Conferir extrato bancario correspondente'));
    lines.push(this.line('='));
    lines.push('\n\n\n');

    return lines.join('\n');
  }
}
