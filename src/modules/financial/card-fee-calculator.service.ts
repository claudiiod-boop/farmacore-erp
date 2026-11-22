import { AcquirerFeeRule, CardOperationType } from './card-reconciliation.types';

export interface TransactionCalculationInput {
  saleId: string | number;
  saleDate: string | Date;
  grossAmount: number;
  paymentMethod: CardOperationType;
  brand: string;
  installments: number;
  rules: AcquirerFeeRule[];
  defaultSettlementDays?: number;
}

export interface InstallmentReceivable {
  installmentNumber: number;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  expectedSettlementDate: string;
}

export interface TransactionCalculationResult {
  saleId: string | number;
  paymentMethod: CardOperationType;
  brand: string;
  installmentsCount: number;
  totalGrossAmount: number;
  totalFeeAmount: number;
  totalNetAmount: number;
  mdrRate: number;
  fixedFee: number;
  matchedRuleId: number | null;
  installments: InstallmentReceivable[];
}

export class CardFeeCalculatorService {
  /**
   * Encontra a melhor regra de taxa aplicável para o tipo de operação, bandeira e parcelas.
   * Regras de bandeira específica (ex: VISA, MASTERCARD) têm precedência sobre 'ALL' ou 'OUTROS'.
   */
  static matchFeeRule(
    rules: AcquirerFeeRule[],
    paymentMethod: CardOperationType,
    brand: string,
    installments: number = 1
  ): AcquirerFeeRule | null {
    const activeRules = rules.filter(
      r => (r.isActive === true || (r.isActive as unknown) === 1) &&
           r.operationType.toUpperCase() === paymentMethod.toUpperCase()
    );

    const matchingInstallments = activeRules.filter(
      r => installments >= r.installmentMin && installments <= r.installmentMax
    );

    // 1º: Tenta regra com a bandeira exata
    const specificBrandRule = matchingInstallments.find(
      r => r.brandName.toUpperCase() === brand.toUpperCase()
    );
    if (specificBrandRule) return specificBrandRule;

    // 2º: Fallback para 'ALL' ou 'OUTROS'
    const fallbackRule = matchingInstallments.find(
      r => r.brandName.toUpperCase() === 'ALL' || r.brandName.toUpperCase() === 'OUTROS'
    );
    return fallbackRule || null;
  }

  /**
   * Adiciona dias úteis a uma data base, pulando sábados e domingos.
   */
  static addBusinessDays(startDate: Date, days: number): Date {
    const date = new Date(startDate);
    let added = 0;
    while (added < days) {
      date.setUTCDate(date.getUTCDate() + 1);
      const dayOfWeek = date.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        added++;
      }
    }
    return date;
  }

  /**
   * Ajusta data se cair em fim de semana para o próximo dia útil (segunda-feira).
   */
  static adjustWeekendToNextBusinessDay(date: Date): Date {
    const adjusted = new Date(date);
    const dayOfWeek = adjusted.getUTCDay();
    if (dayOfWeek === 6) {
      // Sábado -> avança 2 dias para Segunda
      adjusted.setUTCDate(adjusted.getUTCDate() + 2);
    } else if (dayOfWeek === 0) {
      // Domingo -> avança 1 dia para Segunda
      adjusted.setUTCDate(adjusted.getUTCDate() + 1);
    }
    return adjusted;
  }

  /**
   * Formata Date para YYYY-MM-DD
   */
  static formatDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Determina os dias de liquidação da regra ou padrão da operação.
   */
  static getSettlementDays(rule: AcquirerFeeRule | null, operationType: CardOperationType): number {
    if (rule && rule.settlementDays != null && rule.settlementDays !== undefined) {
      return rule.settlementDays;
    }
    switch (operationType) {
      case 'DEBIT':
        return 1;
      case 'PIX':
        return 0;
      case 'CREDIT':
      default:
        return 30;
    }
  }

  /**
   * Calcula a data prevista de liquidação com base nas regras contratuais.
   * Débito/PIX operam em dias úteis; Crédito opera em ciclo de 30 dias com liquidação em dia útil.
   */
  static calculateExpectedSettlementDate(
    saleDateInput: string | Date,
    operationType: CardOperationType,
    rule: AcquirerFeeRule | null,
    installmentIndex: number = 1
  ): string {
    const saleDate = new Date(saleDateInput);
    const baseDate = new Date(Date.UTC(saleDate.getUTCFullYear(), saleDate.getUTCMonth(), saleDate.getUTCDate()));
    const days = this.getSettlementDays(rule, operationType);

    if (operationType === 'DEBIT' || operationType === 'PIX') {
      if (days === 0) {
        return this.formatDate(baseDate);
      }
      const targetDate = this.addBusinessDays(baseDate, days * installmentIndex);
      return this.formatDate(targetDate);
    }

    // CREDIT: ciclo de 30 dias corridos por parcela, com liquidação postergada se cair em fim de semana
    const daysToAdd = days * installmentIndex;
    const targetDate = new Date(baseDate);
    targetDate.setUTCDate(targetDate.getUTCDate() + daysToAdd);
    const adjusted = this.adjustWeekendToNextBusinessDay(targetDate);
    return this.formatDate(adjusted);
  }

  /**
   * Calcula o valor da taxa e o valor líquido com precisão de 2 casas decimais.
   */
  static calculateFeeAndNet(
    grossAmount: number,
    rule: AcquirerFeeRule
  ): { feeAmount: number; netAmount: number; mdrRate: number; fixedFee: number } {
    const mdrRate = rule.mdrRate;
    const fixedFee = rule.fixedFee || 0;
    const feeAmount = Math.round((grossAmount * (mdrRate / 100) + fixedFee) * 100) / 100;
    const netAmount = Math.round((grossAmount - feeAmount) * 100) / 100;

    return {
      feeAmount,
      netAmount,
      mdrRate,
      fixedFee
    };
  }

  /**
   * Calcula todo o cronograma de recebíveis de uma transação.
   */
  static calculateTransactionFees(input: TransactionCalculationInput): TransactionCalculationResult {
    const rule = this.matchFeeRule(input.rules, input.paymentMethod, input.brand, input.installments);
    if (!rule) {
      throw new Error(
        `Nenhuma regra de taxa contratual encontrada para ${input.paymentMethod} / ${input.brand} em ${input.installments}x`
      );
    }

    const { feeAmount: totalFeeAmount, netAmount: totalNetAmount, mdrRate, fixedFee } = this.calculateFeeAndNet(
      input.grossAmount,
      rule
    );

    const installmentsCount = Math.max(1, input.installments);
    const installments: InstallmentReceivable[] = [];

    // Distribuição precisa de centavos entre as parcelas
    let remainingGross = input.grossAmount;
    let remainingFee = totalFeeAmount;

    for (let i = 1; i <= installmentsCount; i++) {
      const isLast = i === installmentsCount;
      const installmentGross = isLast
        ? Math.round(remainingGross * 100) / 100
        : Math.round((input.grossAmount / installmentsCount) * 100) / 100;
      remainingGross = Math.round((remainingGross - installmentGross) * 100) / 100;

      const installmentFee = isLast
        ? Math.round(remainingFee * 100) / 100
        : Math.round((totalFeeAmount / installmentsCount) * 100) / 100;
      remainingFee = Math.round((remainingFee - installmentFee) * 100) / 100;

      const installmentNet = Math.round((installmentGross - installmentFee) * 100) / 100;
      const expectedSettlementDate = this.calculateExpectedSettlementDate(
        input.saleDate,
        input.paymentMethod,
        rule,
        i
      );

      installments.push({
        installmentNumber: i,
        grossAmount: installmentGross,
        feeAmount: installmentFee,
        netAmount: installmentNet,
        expectedSettlementDate
      });
    }

    return {
      saleId: input.saleId,
      paymentMethod: input.paymentMethod,
      brand: input.brand,
      installmentsCount,
      totalGrossAmount: input.grossAmount,
      totalFeeAmount,
      totalNetAmount,
      mdrRate,
      fixedFee,
      matchedRuleId: rule.id,
      installments
    };
  }
}
