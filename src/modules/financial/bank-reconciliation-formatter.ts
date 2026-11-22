import {
  BankStatementBatch,
  BankStatementEntry,
  CashFlowOverview
} from './bank-reconciliation.types';

export class BankReconciliationFormatter {
  private static readonly LINE_WIDTH = 48;

  private static formatCurrency(val: number): string {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private static padCenter(text: string, width = BankReconciliationFormatter.LINE_WIDTH): string {
    if (text.length >= width) return text.substring(0, width);
    const leftPad = Math.floor((width - text.length) / 2);
    return ' '.repeat(leftPad) + text;
  }

  private static line(char = '-'): string {
    return char.repeat(this.LINE_WIDTH);
  }

  /**
   * Emite comprovante térmico ESC/POS de conciliação bancária do lote OFX em 48 colunas.
   */
  static formatBankStatementSlip(
    batch: BankStatementBatch,
    entries: BankStatementEntry[],
    storeInfo: { name: string; cnpj: string }
  ): string {
    const lines: string[] = [];

    lines.push(this.line('='));
    lines.push(this.padCenter(storeInfo.name.toUpperCase()));
    lines.push(this.padCenter(`CNPJ: ${storeInfo.cnpj}`));
    lines.push(this.line('-'));
    lines.push(this.padCenter('EXTRATO DE CONCILIACAO BANCARIA OFX'));
    lines.push(this.padCenter(`LOTE: ${batch.batchCode}`));
    lines.push(this.line('='));

    if (batch.account) {
      lines.push(`BANCO: ${batch.account.bankName.toUpperCase()}`);
      lines.push(`AG: ${batch.account.agencyNumber}  CC: ${batch.account.accountNumber}`);
    }
    lines.push(`PERIODO: ${batch.periodStart} a ${batch.periodEnd}`);
    lines.push(`SALDO OFICIAL BANCARIO: R$ ${this.formatCurrency(batch.ledgerBalance)}`);
    lines.push(
      `LANCAMENTOS: ${batch.totalEntries} (Conciliados: ${batch.matchedEntries} | Pendentes: ${batch.unmatchedEntries})`
    );
    lines.push(this.line('-'));
    lines.push('DETALHAMENTO DOS LANCAMENTOS:');
    lines.push(this.line('-'));

    for (const e of entries) {
      const typeTag = e.transactionType === 'CREDIT' ? '(+)' : '(-)';
      lines.push(`${e.postedDate} ${typeTag} R$ ${this.formatCurrency(Math.abs(e.amount))}`);
      lines.push(`  ${e.memo.substring(0, 44)}`);
      if (e.reconciliationType) {
        lines.push(`  Status: [${e.reconciliationType}] - ${e.reconciliationStatus}`);
      } else {
        lines.push(`  Status: [${e.reconciliationStatus}]`);
      }
      lines.push(this.line('.'));
    }

    lines.push(this.line('='));
    lines.push(this.padCenter('FarmaCore ERP & PDV - Modulo Bancario'));
    lines.push(this.line('='));
    lines.push('\n\n\n');

    return lines.join('\n');
  }

  /**
   * Emite comprovante térmico ESC/POS de fluxo de caixa diário e posição de liquidez.
   */
  static formatCashFlowDailySlip(
    overview: CashFlowOverview,
    storeInfo: { name: string; cnpj: string }
  ): string {
    const lines: string[] = [];

    lines.push(this.line('='));
    lines.push(this.padCenter(storeInfo.name.toUpperCase()));
    lines.push(this.padCenter(`CNPJ: ${storeInfo.cnpj}`));
    lines.push(this.line('-'));
    lines.push(this.padCenter('POSICAO CONSOLIDADA DE CAIXA E LIQUIDEZ'));
    lines.push(this.padCenter(`EMISSAO: ${new Date().toLocaleString('pt-BR')}`));
    lines.push(this.line('='));

    lines.push('SALDOS DISPONIVEIS NAS CONTAS BANCARIAS:');
    for (const b of overview.currentBankBalances) {
      lines.push(`* ${b.bankName} (CC: ${b.accountNumber}): R$ ${this.formatCurrency(b.balance)}`);
    }
    lines.push(this.line('-'));
    lines.push(`Saldo Total em Bancos: R$ ${this.formatCurrency(overview.totalLiquidBankBalance)}`);
    lines.push(`Saldo em Gaveta (PDV): R$ ${this.formatCurrency(overview.totalCashDrawerBalance)}`);
    lines.push(this.line('-'));
    lines.push(`Ativo Circulante Imediato: R$ ${this.formatCurrency(overview.totalCurrentAssets)}`);
    lines.push(this.line('='));

    lines.push('PROJECAO DE FLUXO DE CAIXA (PROXIMOS 7 DIAS):');
    lines.push('DATA       ENTRADAS     SAIDAS       SALDO FINAL');
    lines.push(this.line('-'));

    const next7Days = overview.projections30Days.slice(0, 7);
    for (const d of next7Days) {
      const dateShort = d.date.substring(5); // MM-DD
      const inStr = `R$ ${this.formatCurrency(d.projectedInflow)}`.padStart(11);
      const outStr = `R$ ${this.formatCurrency(d.projectedOutflow)}`.padStart(11);
      const balStr = `R$ ${this.formatCurrency(d.projectedClosingBalance)}`.padStart(12);
      lines.push(`${dateShort} ${inStr} ${outStr} ${balStr}`);
    }

    lines.push(this.line('='));
    lines.push(this.padCenter('FarmaCore ERP - Gestao Financeira & Tesouraria'));
    lines.push(this.line('='));
    lines.push('\n\n\n');

    return lines.join('\n');
  }
}
