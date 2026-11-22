import { describe, it, expect } from 'vitest';
import { CardReconciliationFormatter } from '../../../src/modules/financial/card-reconciliation-formatter';
import { DivergenceReport, ReceivablesCalendarDay } from '../../../src/modules/financial/card-reconciliation.types';

describe('CardReconciliationFormatter', () => {
  const storeInfo = {
    name: 'Magnos Farma Matriz',
    cnpj: '12.345.678/0001-95'
  };

  describe('formatDivergenceAuditSlip', () => {
    it('should format clean 48-column thermal slip for divergence audit', () => {
      const report: DivergenceReport = {
        totalDivergentCount: 2,
        totalOverchargedAmount: 14.50,
        items: [
          {
            id: 1,
            batchId: 10,
            batchCode: 'CONC-202605-001',
            nsu: '987654321',
            authorizationCode: 'AUTH99',
            transactionDate: '2026-05-15 14:30:00',
            settlementDate: '2026-05-18',
            acquirerName: 'STONE',
            brandName: 'MASTERCARD',
            grossAmount: 200.00,
            chargedMdrRate: 3.50,
            contractMdrRate: 2.00,
            chargedFeeAmount: 7.00,
            expectedFeeAmount: 4.00,
            divergenceAmount: 3.00
          },
          {
            id: 2,
            batchId: 10,
            batchCode: 'CONC-202605-001',
            nsu: '123456789',
            authorizationCode: 'AUTH88',
            transactionDate: '2026-05-15 16:45:00',
            settlementDate: '2026-05-18',
            acquirerName: 'CIELO',
            brandName: 'VISA',
            grossAmount: 500.00,
            chargedMdrRate: 4.30,
            contractMdrRate: 2.00,
            chargedFeeAmount: 21.50,
            expectedFeeAmount: 10.00,
            divergenceAmount: 11.50
          }
        ]
      };

      const slip = CardReconciliationFormatter.formatDivergenceAuditSlip(report, storeInfo);

      expect(slip).toContain('MAGNOS FARMA MATRIZ');
      expect(slip).toContain('12.345.678/0001-95');
      expect(slip).toContain('AUDITORIA DE DIVERGENCIAS DE TAXA MDR');
      expect(slip).toContain('TOTAL DE DIVERGENCIAS: 2');
      expect(slip).toContain('VALOR COBRADO A MAIOR: R$ 14,50');
      expect(slip).toContain('NSU: 987654321');
      expect(slip).toContain('STONE / MASTERCARD');
      expect(slip).toContain('Diferenca a ressarcir: R$ 3,00');
    });
  });

  describe('formatDailySettlementSlip', () => {
    it('should format thermal slip for daily settlement summary', () => {
      const day: ReceivablesCalendarDay = {
        date: '2026-05-18',
        totalGross: 1500.00,
        totalFee: 32.50,
        totalNet: 1467.50,
        transactionCount: 15,
        byAcquirer: {
          STONE: { gross: 1000.00, net: 980.00, count: 10 },
          CIELO: { gross: 500.00, net: 487.50, count: 5 }
        }
      };

      const slip = CardReconciliationFormatter.formatDailySettlementSlip(day, storeInfo);

      expect(slip).toContain('EXTRATO DE LIQUIDACAO DE CARTOES');
      expect(slip).toContain('DATA PREVISTA: 18/05/2026');
      expect(slip).toContain('Bruto Previsto: R$ 1.500,00');
      expect(slip).toContain('Taxas Totais: R$ 32,50');
      expect(slip).toContain('Liquido a Depositar: R$ 1.467,50');
      expect(slip).toContain('STONE');
      expect(slip).toContain('CIELO');
    });
  });
});
