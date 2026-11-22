import { describe, it, expect } from 'vitest';
import { SpedFiscalFormatter } from '../../../src/modules/fiscal/sped-formatter';
import type { SpedGenerationRecord } from '../../../src/modules/fiscal/sped.types';

describe('SpedFiscalFormatter (Cupom Térmico ESC/POS de Fechamento Fiscal)', () => {
  it('should format ESC/POS thermal slip for SPED EFD ICMS/IPI', () => {
    const record: SpedGenerationRecord = {
      id: 1,
      storeId: 1,
      generationType: 'SPED_EFD',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      purpose: 0,
      fileName: 'SPED_EFD_12345678000199_20260501_20260531.txt',
      fileContent: '|0000|...\n|9999|500|',
      totalLines: 500,
      totalDocuments: 120,
      totalIcmsDebit: 1540.50,
      totalIcmsCredit: 820.00,
      totalIcmsSt: 320.00,
      inventoryDate: '2026-05-31',
      totalInventoryValue: 85400.00,
      status: 'GENERATED',
      notes: 'Fechamento Maio/2026',
      createdAt: '2026-05-31 23:59:00',
      divergences: [
        {
          severity: 'WARNING',
          entityType: 'PRODUCT',
          description: 'Produto com CEST vazio'
        }
      ]
    };

    const slip = SpedFiscalFormatter.formatSpedSummarySlip(record, 'Drogaria Central');
    expect(slip).toContain('DEMONSTRATIVO DE FECHAMENTO FISCAL');
    expect(slip).toContain('SPED FISCAL EFD ICMS/IPI & BLOCO H');
    expect(slip).toContain('ARQUIVO: SPED_EFD_12345678000199_20260501_20260531.txt');
    expect(slip).toContain('PERIODO: 01/05/2026 A 31/05/2026');
    expect(slip).toContain('TOTAL DE LINHAS: 500');
    expect(slip).toContain('TOTAL DE DOCUMENTOS FISCAIS: 120');
    expect(slip).toContain('INVENTARIO FISICO / CONTABIL (BLOCO H):');
    expect(slip).toContain('AUDITORIA PREVIA: 0 ERROS | 1 ADVERTENCIAS');
  });

  it('should format ESC/POS thermal slip for Sintegra without inventory', () => {
    const record: SpedGenerationRecord = {
      id: 2,
      storeId: 1,
      generationType: 'SINTEGRA',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      purpose: 1,
      fileName: 'SINTEGRA_12345678000199_20260601_20260630.txt',
      fileContent: '10...\n90...',
      totalLines: 350,
      totalDocuments: 80,
      totalIcmsDebit: 0,
      totalIcmsCredit: 0,
      totalIcmsSt: 0,
      totalInventoryValue: 0,
      status: 'VALIDATED',
      createdAt: '2026-06-30 23:59:00'
    };

    const slip = SpedFiscalFormatter.formatSpedSummarySlip(record, 'FarmaCore Filial');
    expect(slip).toContain('SINTEGRA CONVENIO ICMS 57/95');
    expect(slip).toContain('1 - RETIFICADORA');
    expect(slip).not.toContain('INVENTARIO FISICO / CONTABIL (BLOCO H):');
  });
});
