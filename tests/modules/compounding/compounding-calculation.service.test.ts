import { describe, it, expect } from 'vitest';
import { CompoundingCalculationService } from '../../../src/modules/compounding/compounding-calculation.service';

describe('CompoundingCalculationService — Farmacotécnica & Cálculos Magistrais (RDC 67/2007)', () => {
  const service = new CompoundingCalculationService();

  describe('Fator de Correção (FC) & Fator de Equivalência (FEq)', () => {
    it('should calculate FC correctly for pure raw material (100% potency, 0% moisture)', () => {
      const fc = service.calculateCorrectionFactor(100.0, 0.0);
      expect(fc).toBe(1.0);
    });

    it('should calculate FC accounting for potency and moisture', () => {
      // Teor 98.0%, Umidade 2.0%
      // FC = (100 / 98) * (100 / 98) = 1.020408 * 1.020408 = 1.0412
      const fc = service.calculateCorrectionFactor(98.0, 2.0);
      expect(fc).toBe(1.0412);
    });

    it('should calculate FEq based on molecular weight ratio (Salt vs Base)', () => {
      // Ciprofloxacino Cloridrato Monoidratado (385.8) vs Ciprofloxacino Base (331.3)
      // FEq = 385.8 / 331.3 = 1.1645
      const feq = service.calculateEquivalenceFactor(385.8, 331.3);
      expect(feq).toBe(1.1645);
    });

    it('should compute complete dose correction per unit and total batch weigh mass', () => {
      // Prescrito: 500mg, 60 cápsulas, teor 99.0%, umidade 1.0%, FEq 1.1645
      const res = service.calculateDoses(500, 60, 99.0, 1.0, 385.8, 331.3);
      expect(res.factorCorrection).toBe(1.0203);
      expect(res.factorEquivalence).toBe(1.1645);
      expect(res.correctedDosePerUnitMg).toBeGreaterThan(500);
      expect(res.totalDoseToWeighG).toBeGreaterThan(30); // 500mg * 60 = 30g + correções
    });
  });

  describe('Dimensionamento de Cápsulas (Cubagem & Excipiente)', () => {
    it('should select capsule size 3 for small powder volume and calculate required excipient', () => {
      // 1 ativo de 100mg com densidade 0.60 -> 100 / 600 = 0.166 mL
      // Cápsula 4 tem 0.21 mL -> comporta!
      const result = service.calculateCapsuleDimensions([
        { massMg: 100, apparentDensity: 0.60 },
      ], 30);

      expect(result.selectedCapsuleSize).toBe('4');
      expect(result.capsuleCapacityMl).toBe(0.21);
      expect(result.excipientMassPerCapsuleMg).toBeGreaterThan(0);
      expect(result.targetCapsuleWeightMg).toBeGreaterThan(100);
      expect(result.totalExcipientToWeighG).toBeGreaterThan(0);
    });

    it('should select capsule size 0 for larger formulations', () => {
      // Ativo 1: 350mg (densidade 0.60) -> 0.583 mL -> precisa de cápsula 0 (0.68 mL)
      const result = service.calculateCapsuleDimensions([
        { massMg: 350, apparentDensity: 0.60 },
      ], 60);

      expect(result.selectedCapsuleSize).toBe('0');
      expect(result.capsuleCapacityMl).toBe(0.68);
    });

    it('should throw error when formula volume exceeds maximum capsule 00', () => {
      expect(() =>
        service.calculateCapsuleDimensions([
          { massMg: 1000, apparentDensity: 0.50 }, // 1000 / 500 = 2.0 mL > 0.95 mL
        ])
      ).toThrow(/excede a capacidade máxima da maior cápsula/i);
    });
  });

  describe('Controle de Qualidade (Farmacopeia Brasileira - Peso Médio)', () => {
    it('should approve capsule < 300mg within ±10% tolerance', () => {
      // Teórico 200mg, Real 215mg -> desvio 7.5% (aprovado)
      const evalResult = service.evaluateAverageWeight(200, 215);
      expect(evalResult.approved).toBe(true);
      expect(evalResult.maxAllowedDeviationPercent).toBe(10.0);
    });

    it('should reject capsule < 300mg exceeding ±10% tolerance', () => {
      // Teórico 200mg, Real 225mg -> desvio 12.5% (reprovado)
      const evalResult = service.evaluateAverageWeight(200, 225);
      expect(evalResult.approved).toBe(false);
      expect(evalResult.deviationPercent).toBe(12.5);
    });

    it('should approve capsule >= 300mg within ±7.5% tolerance', () => {
      // Teórico 500mg, Real 530mg -> desvio 6.0% (aprovado)
      const evalResult = service.evaluateAverageWeight(500, 530);
      expect(evalResult.approved).toBe(true);
      expect(evalResult.maxAllowedDeviationPercent).toBe(7.5);
    });
  });
});
