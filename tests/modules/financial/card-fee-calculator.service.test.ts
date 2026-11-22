import { describe, it, expect } from 'vitest';
import { CardFeeCalculatorService } from '../../../src/modules/financial/card-fee-calculator.service';
import { AcquirerFeeRule } from '../../../src/modules/financial/card-reconciliation.types';

describe('CardFeeCalculatorService', () => {
  const sampleRules: AcquirerFeeRule[] = [
    {
      id: 1,
      contractId: 10,
      brandName: 'VISA',
      operationType: 'DEBIT',
      installmentMin: 1,
      installmentMax: 1,
      mdrRate: 1.25,
      fixedFee: 0.10,
      settlementDays: 1,
      isActive: true,
      createdAt: '2026-01-01'
    },
    {
      id: 2,
      contractId: 10,
      brandName: 'ALL',
      operationType: 'DEBIT',
      installmentMin: 1,
      installmentMax: 1,
      mdrRate: 1.40,
      fixedFee: 0.10,
      settlementDays: 1,
      isActive: true,
      createdAt: '2026-01-01'
    },
    {
      id: 3,
      contractId: 10,
      brandName: 'ALL',
      operationType: 'CREDIT',
      installmentMin: 1,
      installmentMax: 1,
      mdrRate: 2.50,
      fixedFee: 0.15,
      settlementDays: 30,
      isActive: true,
      createdAt: '2026-01-01'
    },
    {
      id: 4,
      contractId: 10,
      brandName: 'ALL',
      operationType: 'CREDIT',
      installmentMin: 2,
      installmentMax: 6,
      mdrRate: 3.20,
      fixedFee: 0.20,
      settlementDays: 30,
      isActive: true,
      createdAt: '2026-01-01'
    },
    {
      id: 5,
      contractId: 10,
      brandName: 'ALL',
      operationType: 'PIX',
      installmentMin: 1,
      installmentMax: 1,
      mdrRate: 0.80,
      fixedFee: 0.05,
      settlementDays: 1,
      isActive: true,
      createdAt: '2026-01-01'
    }
  ];

  describe('matchFeeRule', () => {
    it('should match specific brand rule over ALL brand fallback', () => {
      const rule = CardFeeCalculatorService.matchFeeRule(sampleRules, 'DEBIT', 'VISA', 1);
      expect(rule).not.toBeNull();
      expect(rule?.id).toBe(1);
      expect(rule?.mdrRate).toBe(1.25);
    });

    it('should fallback to ALL brand if specific brand has no rule', () => {
      const rule = CardFeeCalculatorService.matchFeeRule(sampleRules, 'DEBIT', 'MASTERCARD', 1);
      expect(rule).not.toBeNull();
      expect(rule?.id).toBe(2);
      expect(rule?.mdrRate).toBe(1.40);
    });

    it('should match installment ranges for credit', () => {
      const rule1x = CardFeeCalculatorService.matchFeeRule(sampleRules, 'CREDIT', 'VISA', 1);
      expect(rule1x?.id).toBe(3);
      expect(rule1x?.mdrRate).toBe(2.50);

      const rule3x = CardFeeCalculatorService.matchFeeRule(sampleRules, 'CREDIT', 'VISA', 3);
      expect(rule3x?.id).toBe(4);
      expect(rule3x?.mdrRate).toBe(3.20);
    });

    it('should return null if no matching rule is found', () => {
      const rule10x = CardFeeCalculatorService.matchFeeRule(sampleRules, 'CREDIT', 'VISA', 10);
      expect(rule10x).toBeNull();
    });
  });

  describe('calculateExpectedSettlementDate', () => {
    it('should calculate D+1 business day for Friday sale to Monday', () => {
      // 2026-05-15 is Friday
      const saleDate = '2026-05-15T14:30:00.000Z';
      const debitRule = sampleRules[0]; // 1 business day
      const settlementDate = CardFeeCalculatorService.calculateExpectedSettlementDate(saleDate, 'DEBIT', debitRule);
      // Monday is 2026-05-18
      expect(settlementDate).toBe('2026-05-18');
    });

    it('should calculate D+1 business day for Thursday sale to Friday', () => {
      // 2026-05-14 is Thursday
      const saleDate = '2026-05-14T10:00:00.000Z';
      const debitRule = sampleRules[0];
      const settlementDate = CardFeeCalculatorService.calculateExpectedSettlementDate(saleDate, 'DEBIT', debitRule);
      expect(settlementDate).toBe('2026-05-15');
    });

    it('should calculate D+30 calendar days for credit sale, shifting to next Monday if landing on weekend', () => {
      // 2026-05-01 is Friday
      // 30 calendar days -> 2026-05-31 (Sunday) -> next business day: Monday 2026-06-01
      const saleDate = '2026-05-01T12:00:00.000Z';
      const creditRule = sampleRules[2];
      const settlementDate = CardFeeCalculatorService.calculateExpectedSettlementDate(saleDate, 'CREDIT', creditRule);
      expect(settlementDate).toBe('2026-06-01');
    });

    it('should calculate multi-installment settlement dates with monthly cycles', () => {
      // Sale on 2026-01-15 (Thursday)
      // Parcela 1 (index 1): 30 days -> 2026-02-14 (Saturday) -> Monday 2026-02-16
      // Parcela 2 (index 2): 60 days -> 2026-03-16 (Monday)
      // Parcela 3 (index 3): 90 days -> 2026-04-15 (Wednesday)
      const saleDate = '2026-01-15T12:00:00.000Z';
      const creditRule = sampleRules[3];

      const p1Date = CardFeeCalculatorService.calculateExpectedSettlementDate(saleDate, 'CREDIT', creditRule, 1);
      const p2Date = CardFeeCalculatorService.calculateExpectedSettlementDate(saleDate, 'CREDIT', creditRule, 2);
      const p3Date = CardFeeCalculatorService.calculateExpectedSettlementDate(saleDate, 'CREDIT', creditRule, 3);

      expect(p1Date).toBe('2026-02-16');
      expect(p2Date).toBe('2026-03-16');
      expect(p3Date).toBe('2026-04-15');
    });
  });

  describe('calculateFeeAndNet', () => {
    it('should accurately calculate MDR percentage and fixed fee', () => {
      const grossAmount = 100.00;
      const rule = sampleRules[0]; // 1.25% + R$ 0.10
      // 100 * 0.0125 = 1.25 + 0.10 = 1.35 fee -> 98.65 net
      const calc = CardFeeCalculatorService.calculateFeeAndNet(grossAmount, rule);
      expect(calc.feeAmount).toBe(1.35);
      expect(calc.netAmount).toBe(98.65);
      expect(calc.mdrRate).toBe(1.25);
      expect(calc.fixedFee).toBe(0.10);
    });

    it('should handle fractional rounding cleanly with cents', () => {
      const grossAmount = 47.89;
      const rule = sampleRules[2]; // 2.50% + 0.15
      // 47.89 * 0.025 = 1.19725 + 0.15 = 1.34725 -> 1.35 fee -> 46.54 net
      const calc = CardFeeCalculatorService.calculateFeeAndNet(grossAmount, rule);
      expect(calc.feeAmount).toBe(1.35);
      expect(calc.netAmount).toBe(46.54);
    });
  });

  describe('calculateTransactionFees', () => {
    it('should return complete settlement schedule for 1x debit sale', () => {
      const schedule = CardFeeCalculatorService.calculateTransactionFees({
        saleId: 'sale-001',
        saleDate: '2026-05-15T10:00:00.000Z',
        grossAmount: 200.00,
        paymentMethod: 'DEBIT',
        brand: 'VISA',
        installments: 1,
        rules: sampleRules
      });

      expect(schedule.installmentsCount).toBe(1);
      expect(schedule.totalGrossAmount).toBe(200.00);
      expect(schedule.totalFeeAmount).toBe(2.60); // 200 * 1.25% (2.50) + 0.10 = 2.60
      expect(schedule.totalNetAmount).toBe(197.40);
      expect(schedule.installments[0].installmentNumber).toBe(1);
      expect(schedule.installments[0].expectedSettlementDate).toBe('2026-05-18');
    });

    it('should split gross amount and compute fee across multiple installments', () => {
      const schedule = CardFeeCalculatorService.calculateTransactionFees({
        saleId: 'sale-002',
        saleDate: '2026-01-15T10:00:00.000Z',
        grossAmount: 300.00,
        paymentMethod: 'CREDIT',
        brand: 'MASTERCARD',
        installments: 3,
        rules: sampleRules
      });

      expect(schedule.installmentsCount).toBe(3);
      expect(schedule.totalGrossAmount).toBe(300.00);
      // 3.20% de 300 = 9.60 + 0.20 taxa fixa = 9.80 total fee
      expect(schedule.totalFeeAmount).toBe(9.80);
      expect(schedule.totalNetAmount).toBe(290.20);
      expect(schedule.installments).toHaveLength(3);
      expect(schedule.installments[0].expectedSettlementDate).toBe('2026-02-16');
      expect(schedule.installments[1].expectedSettlementDate).toBe('2026-03-16');
      expect(schedule.installments[2].expectedSettlementDate).toBe('2026-04-15');
    });
  });
});
