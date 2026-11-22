import type { SpedGenerationRecord } from './sped.types';

export class SpedFiscalFormatter {
  public static formatSpedSummarySlip(record: SpedGenerationRecord, storeName: string = 'DROGARIA FARMACORE'): string {
    const pad = (str: string, len: number, align: 'left' | 'right' | 'center' = 'left') => {
      const s = str.slice(0, len);
      if (align === 'center') {
        const left = Math.floor((len - s.length) / 2);
        const right = len - s.length - left;
        return ' '.repeat(left) + s + ' '.repeat(right);
      }
      return align === 'right' ? s.padStart(len, ' ') : s.padEnd(len, ' ');
    };

    const formatCurrency = (val: number) => {
      return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDate = (dStr: string) => {
      const parts = dStr.split('-');
      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dStr;
    };

    const lines: string[] = [];
    lines.push('================================================');
    lines.push(pad(storeName.toUpperCase(), 48, 'center'));
    lines.push(pad('DEMONSTRATIVO DE FECHAMENTO FISCAL', 48, 'center'));
    lines.push(pad(record.generationType === 'SPED_EFD' ? 'SPED FISCAL EFD ICMS/IPI & BLOCO H' : 'SINTEGRA CONVENIO ICMS 57/95', 48, 'center'));
    lines.push('================================================');
    lines.push(`ARQUIVO: ${record.fileName}`);
    lines.push(`PERIODO: ${formatDate(record.periodStart)} A ${formatDate(record.periodEnd)}`);
    lines.push(`FINALIDADE: ${record.purpose === 0 ? '0 - ORIGINAL' : '1 - RETIFICADORA'}`);
    lines.push(`STATUS: ${record.status}`);
    lines.push(`TOTAL DE LINHAS: ${record.totalLines.toLocaleString('pt-BR')}`);
    lines.push('------------------------------------------------');
    lines.push('RESUMO DE DOCUMENTOS ESCRITURADOS:');
    lines.push(`  TOTAL DE DOCUMENTOS FISCAIS: ${record.totalDocuments}`);
    lines.push(`  DEBITO DE ICMS PROPRIO:      ${formatCurrency(record.totalIcmsDebit)}`);
    lines.push(`  CREDITO DE ICMS DE ENTRADA:  ${formatCurrency(record.totalIcmsCredit)}`);
    lines.push(`  ICMS RETIDO POR ST (FARMACIA): ${formatCurrency(record.totalIcmsSt)}`);
    lines.push('------------------------------------------------');

    if (record.inventoryDate) {
      lines.push('INVENTARIO FISICO / CONTABIL (BLOCO H):');
      lines.push(`  DATA POSICAO ESTOQUE:        ${formatDate(record.inventoryDate)}`);
      lines.push(`  VALOR TOTAL ESTOQUE (CUSTO): ${formatCurrency(record.totalInventoryValue)}`);
      lines.push('------------------------------------------------');
    }

    if (record.divergences && record.divergences.length > 0) {
      const errors = record.divergences.filter(d => d.severity === 'ERROR').length;
      const warnings = record.divergences.filter(d => d.severity === 'WARNING').length;
      lines.push(`AUDITORIA PREVIA: ${errors} ERROS | ${warnings} ADVERTENCIAS`);
      lines.push('------------------------------------------------');
    }

    lines.push(pad(`GERADO EM: ${record.createdAt.replace('T', ' ').substring(0, 19)}`, 48, 'center'));
    lines.push(pad('SISTEMA FARMACORE ERP - MODULO FISCAL', 48, 'center'));
    lines.push('================================================');

    return lines.join('\n');
  }
}
