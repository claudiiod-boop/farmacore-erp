import { CapsuleCalculationResult } from './compounding.types';

export interface CapsuleStandardSize {
  size: string;
  volumeMl: number;
}

export const CAPSULE_STANDARD_SIZES: CapsuleStandardSize[] = [
  { size: '4', volumeMl: 0.21 },
  { size: '3', volumeMl: 0.30 },
  { size: '2', volumeMl: 0.37 },
  { size: '1', volumeMl: 0.50 },
  { size: '0', volumeMl: 0.68 },
  { size: '00', volumeMl: 0.95 },
];

export class CompoundingCalculationService {
  /**
   * Calcula o Fator de Correção (FC) baseado no Teor (potência) e Umidade do Laudo Analítico
   * FC = (100 / Teor) * (100 / (100 - Umidade))
   */
  public calculateCorrectionFactor(potencyPercent: number, moisturePercent: number = 0.0): number {
    if (potencyPercent <= 0) {
      throw new Error('O teor da matéria-prima deve ser maior que zero.');
    }

    if (moisturePercent >= 100 || moisturePercent < 0) {
      throw new Error('A umidade deve estar entre 0% e 99.9%.');
    }

    const factorPotency = 100 / potencyPercent;
    const factorMoisture = 100 / (100 - moisturePercent);

    const fc = factorPotency * factorMoisture;
    return Number(fc.toFixed(4));
  }

  /**
   * Calcula o Fator de Equivalência (FEq) entre a forma salina/hidratada e a base ativa
   * FEq = Peso Molecular do Sal / Peso Molecular da Base
   */
  public calculateEquivalenceFactor(
    molecularWeightSalt?: number | null,
    molecularWeightBase?: number | null
  ): number {
    if (!molecularWeightSalt || !molecularWeightBase || molecularWeightBase <= 0) {
      return 1.0;
    }

    const feq = molecularWeightSalt / molecularWeightBase;
    return Number(feq.toFixed(4));
  }

  /**
   * Calcula a dose individual corrigida e a dose total do lote a ser pesada
   */
  public calculateDoses(
    prescribedDoseMg: number,
    totalUnits: number,
    potencyPercent: number = 100.0,
    moisturePercent: number = 0.0,
    molecularWeightSalt?: number | null,
    molecularWeightBase?: number | null
  ): {
    factorCorrection: number;
    factorEquivalence: number;
    correctedDosePerUnitMg: number;
    totalDoseToWeighG: number;
  } {
    const factorCorrection = this.calculateCorrectionFactor(potencyPercent, moisturePercent);
    const factorEquivalence = this.calculateEquivalenceFactor(
      molecularWeightSalt,
      molecularWeightBase
    );

    const correctedDosePerUnitMg = Number(
      (prescribedDoseMg * factorCorrection * factorEquivalence).toFixed(4)
    );
    const totalDoseToWeighMg = correctedDosePerUnitMg * totalUnits;
    const totalDoseToWeighG = Number((totalDoseToWeighMg / 1000).toFixed(4));

    return {
      factorCorrection,
      factorEquivalence,
      correctedDosePerUnitMg,
      totalDoseToWeighG,
    };
  }

  /**
   * Dimensionamento de cápsulas (Cubagem farmacotécnica e cálculo de excipiente q.s.p.)
   */
  public calculateCapsuleDimensions(
    components: Array<{ massMg: number; apparentDensity?: number }>,
    totalUnits: number = 30,
    excipientDensity: number = 0.60
  ): CapsuleCalculationResult {
    let totalMassPerCapsuleMg = 0;
    let totalVolumePerCapsuleMl = 0;

    for (const comp of components) {
      totalMassPerCapsuleMg += comp.massMg;
      const density = comp.apparentDensity && comp.apparentDensity > 0 ? comp.apparentDensity : 0.60;
      // Volume = Massa(g) / Densidade(g/mL) -> Massa(mg) / (Densidade * 1000)
      const volumeMl = comp.massMg / (density * 1000);
      totalVolumePerCapsuleMl += volumeMl;
    }

    // Encontra o menor tamanho de cápsula que comporta o volume
    const selectedCapsule = CAPSULE_STANDARD_SIZES.find(
      (cap) => cap.volumeMl >= totalVolumePerCapsuleMl
    );

    if (!selectedCapsule) {
      // Se exceder a cápsula '00', lança aviso técnico
      throw new Error(
        `Volume total da fórmula (${totalVolumePerCapsuleMl.toFixed(3)} mL) excede a capacidade máxima da maior cápsula (00 = 0.95 mL). A fórmula deve ser dividida em 2 cápsulas por tomada.`
      );
    }

    const excipientVolumePerCapsuleMl = Math.max(
      0,
      selectedCapsule.volumeMl - totalVolumePerCapsuleMl
    );

    // Massa do excipiente = Volume * Densidade * 1000
    const excipientMassPerCapsuleMg = Number(
      (excipientVolumePerCapsuleMl * excipientDensity * 1000).toFixed(2)
    );

    const totalExcipientToWeighG = Number(
      ((excipientMassPerCapsuleMg * totalUnits) / 1000).toFixed(3)
    );

    const targetCapsuleWeightMg = Number(
      (totalMassPerCapsuleMg + excipientMassPerCapsuleMg).toFixed(2)
    );

    return {
      totalMassPerCapsuleMg: Number(totalMassPerCapsuleMg.toFixed(2)),
      totalVolumePerCapsuleMl: Number(totalVolumePerCapsuleMl.toFixed(4)),
      selectedCapsuleSize: selectedCapsule.size,
      capsuleCapacityMl: selectedCapsule.volumeMl,
      excipientVolumePerCapsuleMl: Number(excipientVolumePerCapsuleMl.toFixed(4)),
      excipientMassPerCapsuleMg,
      totalExcipientToWeighG,
      targetCapsuleWeightMg,
    };
  }

  /**
   * Avaliação do Controle de Qualidade de Peso Médio (Farmacopeia Brasileira / RDC 67)
   * Cápsulas < 300mg: variação tolerada de ± 10%
   * Cápsulas >= 300mg: variação tolerada de ± 7.5%
   */
  public evaluateAverageWeight(
    targetWeightMg: number,
    actualWeightMg: number
  ): {
    approved: boolean;
    deviationPercent: number;
    maxAllowedDeviationPercent: number;
    message: string;
  } {
    const maxAllowedDeviationPercent = targetWeightMg < 300 ? 10.0 : 7.5;
    const deviationPercent = Number(
      (Math.abs((actualWeightMg - targetWeightMg) / targetWeightMg) * 100).toFixed(2)
    );

    const approved = deviationPercent <= maxAllowedDeviationPercent;

    return {
      approved,
      deviationPercent,
      maxAllowedDeviationPercent,
      message: approved
        ? `Peso médio aprovado (Desvio: ${deviationPercent}% | Máx permitido: ±${maxAllowedDeviationPercent}%)`
        : `Peso médio REPROVADO (Desvio: ${deviationPercent}% excede a tolerância de ±${maxAllowedDeviationPercent}%)`,
    };
  }
}
