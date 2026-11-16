import { randomUUID } from 'node:crypto';
import type {
  PbmProvider,
  PbmAuthorizeParams,
  PbmAuthorizationResult,
  PbmConfirmParams,
  PbmConfirmResult,
  PbmCancelResult,
  PbmItemResult,
} from '../types';

/**
 * Provedor Simulador Oficial do Datasus / Farmácia Popular do Brasil.
 * Reproduz as regras de negócio regulatórias da Portaria MS nº 184/2011 e Portaria MS nº 675/2023.
 */
export class DatasusMockProvider implements PbmProvider {
  public readonly providerId = 'FARMACIA_POPULAR';
  public readonly providerName = 'Farmácia Popular do Brasil (Mock Datasus)';

  private sequence = 1;

  /**
   * Validação algorítmica de CPF segundo o critério oficial da Receita Federal (Módulo 11).
   */
  public isValidCpf(cpf: string): boolean {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return false;
    }

    // Rejeita CPFs com todos os dígitos iguais (ex: 111.111.111-11)
    if (/^(\d)\1{10}$/.test(cleanCpf)) {
      return false;
    }

    // 1º dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCpf[i], 10) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    let digit1 = remainder === 10 || remainder === 11 ? 0 : remainder;
    if (digit1 !== parseInt(cleanCpf[9], 10)) {
      return false;
    }

    // 2º dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCpf[i], 10) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    let digit2 = remainder === 10 || remainder === 11 ? 0 : remainder;
    if (digit2 !== parseInt(cleanCpf[10], 10)) {
      return false;
    }

    return true;
  }

  /**
   * Calcula a idade do paciente com base na data de nascimento.
   */
  private calculateAge(birthDateStr: string): number {
    const birth = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Verifica se o produto é classificado como anticoncepcional.
   */
  private isContraceptive(productName: string): boolean {
    return /anticoncepcional|contraceptiv|etinilestradiol|levonorgestrel|desogestrel|gestodeno|ciproterona|dienogest|drospirenona|noretisterona/i.test(
      productName
    );
  }

  /**
   * Verifica se o produto é fralda geriátrica.
   */
  private isDiaper(productName: string): boolean {
    return /fralda|geriatric/i.test(productName);
  }

  /**
   * Identifica se o medicamento faz parte do elenco de 100% de gratuidade do MS
   * (Hipertensão, Diabetes, Asma, Osteoporose, Anticoncepcionais).
   */
  private isGratuito(productName: string): boolean {
    return /losartana|atenolol|enalapril|captopril|hidroclorotiazida|propranolol|metformina|glibenclamida|insulina|salbutamol|ipratr|beclometasona|alendronato|anticoncepcional|contraceptiv|etinilestradiol|levonorgestrel|noretisterona/i.test(
      productName
    );
  }

  /**
   * Realiza a pré-autorização da transação Farmácia Popular.
   */
  public async authorize(params: PbmAuthorizeParams): Promise<PbmAuthorizationResult> {
    const cleanCpf = params.patientCpf.replace(/\D/g, '');

    // Simulação regulatória: CPF terminado em 99 indica bloqueio temporal de 30 dias
    if (cleanCpf.endsWith('99')) {
      return {
        success: false,
        transactionUuid: randomUUID(),
        authorizationProtocol: '',
        providerId: this.providerId,
        patientCpf: params.patientCpf,
        patientName: params.patientName,
        totalGrossAmount: 0,
        subsidyAmount: 0,
        patientCopayAmount: 0,
        items: [],
        errorMessage: '71: QUANTIDADE MAXIMA MENSAL ATINGIDA - BLOQUEIO DE INTERVALO DE 30 DIAS',
      };
    }

    // Simulação regulatória: CPF terminado em 88 indica receita vencida
    if (cleanCpf.endsWith('88')) {
      return {
        success: false,
        transactionUuid: randomUUID(),
        authorizationProtocol: '',
        providerId: this.providerId,
        patientCpf: params.patientCpf,
        patientName: params.patientName,
        totalGrossAmount: 0,
        subsidyAmount: 0,
        patientCopayAmount: 0,
        items: [],
        errorMessage: 'RECEITA MEDICA VENCIDA: Validade prescricional expirada',
      };
    }

    // Validação formal do CPF
    if (!this.isValidCpf(cleanCpf)) {
      return {
        success: false,
        transactionUuid: randomUUID(),
        authorizationProtocol: '',
        providerId: this.providerId,
        patientCpf: params.patientCpf,
        patientName: params.patientName,
        totalGrossAmount: 0,
        subsidyAmount: 0,
        patientCopayAmount: 0,
        items: [],
        errorMessage: 'CPF DO PACIENTE INVALIDO: Digitos verificadores inconsistentes',
      };
    }

    // Validação da data da receita médica
    const prescDate = new Date(params.prescriptionDate);
    const today = new Date();
    const diffTime = today.getTime() - prescDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    for (const item of params.items) {
      const isContra = this.isContraceptive(item.productName);
      const maxValidityDays = isContra ? 365 : 180;

      if (diffDays > maxValidityDays) {
        return {
          success: false,
          transactionUuid: randomUUID(),
          authorizationProtocol: '',
          providerId: this.providerId,
          patientCpf: params.patientCpf,
          patientName: params.patientName,
          totalGrossAmount: 0,
          subsidyAmount: 0,
          patientCopayAmount: 0,
          items: [],
          errorMessage: `RECEITA MEDICA VENCIDA: Receita emitida ha ${diffDays} dias excede o limite legal de ${maxValidityDays} dias`,
        };
      }
    }

    // Validação etária para fraldas geriátricas (>= 60 anos ou laudo com CID)
    if (params.patientBirthDate) {
      const age = this.calculateAge(params.patientBirthDate);
      for (const item of params.items) {
        if (this.isDiaper(item.productName)) {
          const hasCid = params.cidLaudo && params.cidLaudo.trim().length > 0;
          if (age < 60 && !hasCid) {
            return {
              success: false,
              transactionUuid: randomUUID(),
              authorizationProtocol: '',
              providerId: this.providerId,
              patientCpf: params.patientCpf,
              patientName: params.patientName,
              totalGrossAmount: 0,
              subsidyAmount: 0,
              patientCopayAmount: 0,
              items: [],
              errorMessage: 'RESTRICAO ETARIA: Fraldas geriatricas exigem idade minima de 60 anos ou laudo medico com CID',
            };
          }
        }
      }
    }

    // Processamento e cálculo de subsídios dos itens autorizados
    const itemsResult: PbmItemResult[] = [];

    for (const item of params.items) {
      const unitGrossPrice = item.unitPrice;
      const totalGrossPrice = Math.round(unitGrossPrice * item.quantity * 100) / 100;
      const referenceUnitPrice = item.unitPrice; // Preço de referência oficial

      let subsidyUnitPrice = 0;
      let subsidyTotalPrice = 0;
      let patientUnitPrice = 0;
      let patientTotalPrice = 0;
      let programType: 'GRATUITO' | 'CO_PAGAMENTO' = 'GRATUITO';

      if (params.isBolsaFamilia) {
        // Beneficiários do Bolsa Família têm 100% de gratuidade em TODOS os itens
        programType = 'GRATUITO';
        subsidyUnitPrice = unitGrossPrice;
        subsidyTotalPrice = totalGrossPrice;
        patientUnitPrice = 0;
        patientTotalPrice = 0;
      } else if (this.isGratuito(item.productName)) {
        // Elenco oficial de gratuidade (Hipertensão, Diabetes, Asma, Anticoncepcionais)
        programType = 'GRATUITO';
        subsidyUnitPrice = unitGrossPrice;
        subsidyTotalPrice = totalGrossPrice;
        patientUnitPrice = 0;
        patientTotalPrice = 0;
      } else {
        // Elenco de co-pagamento (Dislipidemia, Parkinson, Glaucoma, Rinite, Fraldas)
        // O Ministério da Saúde subsidia até 90% do valor de referência
        programType = 'CO_PAGAMENTO';
        subsidyUnitPrice = Math.round(referenceUnitPrice * 0.9 * 100) / 100;
        subsidyTotalPrice = Math.round(subsidyUnitPrice * item.quantity * 100) / 100;
        patientUnitPrice = Math.max(0, Math.round((unitGrossPrice - subsidyUnitPrice) * 100) / 100);
        patientTotalPrice = Math.max(0, Math.round((totalGrossPrice - subsidyTotalPrice) * 100) / 100);
      }

      itemsResult.push({
        productId: item.productId,
        ean: item.ean,
        msRegistration: item.msRegistration,
        productName: item.productName,
        batchId: item.batchId,
        dailyDose: item.dailyDose ?? 1,
        authorizedQuantity: item.quantity,
        unitGrossPrice,
        totalGrossPrice,
        referenceUnitPrice,
        subsidyUnitPrice,
        subsidyTotalPrice,
        patientUnitPrice,
        patientTotalPrice,
        programType,
        status: 'APROVADO',
      });
    }

    const totalGrossAmount = itemsResult.reduce((acc, it) => acc + it.totalGrossPrice, 0);
    const subsidyAmount = itemsResult.reduce((acc, it) => acc + it.subsidyTotalPrice, 0);
    const patientCopayAmount = Math.max(0, Math.round((totalGrossAmount - subsidyAmount) * 100) / 100);

    // Geração do protocolo Datasus no formato FP{YYYYMMDD}{SEQ6}
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seqStr = String(this.sequence++).padStart(6, '0');
    const authorizationProtocol = `FP${todayStr}${seqStr}`;

    return {
      success: true,
      transactionUuid: randomUUID(),
      authorizationProtocol,
      providerId: this.providerId,
      patientCpf: params.patientCpf,
      patientName: params.patientName,
      totalGrossAmount,
      subsidyAmount,
      patientCopayAmount,
      items: itemsResult,
    };
  }

  /**
   * Confirmação da autorização Datasus no fechamento do cupom fiscal.
   */
  public async confirm(params: PbmConfirmParams): Promise<PbmConfirmResult> {
    const receiptNumber = String(Math.floor(100000000 + Math.random() * 900000000));
    return {
      success: true,
      authorizationProtocol: params.authorizationProtocol,
      receiptNumber,
      confirmedAt: new Date().toISOString(),
    };
  }

  /**
   * Cancelamento / estorno de autorização no Datasus.
   */
  public async cancel(protocol: string, reason: string): Promise<PbmCancelResult> {
    return {
      success: true,
      cancellationProtocol: `CANC-${protocol}`,
      message: `Transação PBM ${protocol} cancelada com sucesso no Datasus: ${reason}`,
    };
  }
}
