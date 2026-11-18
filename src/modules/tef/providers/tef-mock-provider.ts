import { randomUUID } from 'crypto';
import type {
  TefProvider,
  TefPayParams,
  TefPayResult,
  TefConfirmParams,
  TefConfirmResult,
  TefUndoParams,
  TefUndoResult,
  TefCancelParams,
  TefCancelResult,
} from './tef-provider.interface';
import type { TefOperationType } from '../types';

export interface BrandInfo {
  brandName: string;
  sefazCode: string;
  acquirerName: string;
  acquirerCnpj: string;
}

export const SEFAZ_CARD_BRANDS: Record<string, BrandInfo> = {
  VISA: { brandName: 'VISA', sefazCode: '01', acquirerName: 'CIELO', acquirerCnpj: '01027058000191' },
  MASTERCARD: { brandName: 'MASTERCARD', sefazCode: '02', acquirerName: 'REDE', acquirerCnpj: '01425787000104' },
  'AMERICAN EXPRESS': { brandName: 'AMERICAN EXPRESS', sefazCode: '03', acquirerName: 'CIELO', acquirerCnpj: '01027058000191' },
  AMEX: { brandName: 'AMERICAN EXPRESS', sefazCode: '03', acquirerName: 'CIELO', acquirerCnpj: '01027058000191' },
  SOROCRED: { brandName: 'SOROCRED', sefazCode: '04', acquirerName: 'SOROCRED', acquirerCnpj: '60893303000118' },
  'DINERS CLUB': { brandName: 'DINERS CLUB', sefazCode: '05', acquirerName: 'REDE', acquirerCnpj: '01425787000104' },
  DINERS: { brandName: 'DINERS CLUB', sefazCode: '05', acquirerName: 'REDE', acquirerCnpj: '01425787000104' },
  ELO: { brandName: 'ELO', sefazCode: '06', acquirerName: 'STONE', acquirerCnpj: '16501555000157' },
  HIPERCARD: { brandName: 'HIPERCARD', sefazCode: '07', acquirerName: 'REDE', acquirerCnpj: '01425787000104' },
  AURA: { brandName: 'AURA', sefazCode: '08', acquirerName: 'CIELO', acquirerCnpj: '01027058000191' },
  CABAL: { brandName: 'CABAL', sefazCode: '09', acquirerName: 'STONE', acquirerCnpj: '16501555000157' },
  ALELO: { brandName: 'ALELO', sefazCode: '10', acquirerName: 'CIELO', acquirerCnpj: '01027058000191' },
  BANESCARD: { brandName: 'BANESCARD', sefazCode: '11', acquirerName: 'GETNET', acquirerCnpj: '10440482000154' },
  CALCARD: { brandName: 'CALCARD', sefazCode: '12', acquirerName: 'REDE', acquirerCnpj: '01425787000104' },
  CREDZ: { brandName: 'CREDZ', sefazCode: '13', acquirerName: 'CIELO', acquirerCnpj: '01027058000191' },
  DISCOVER: { brandName: 'DISCOVER', sefazCode: '14', acquirerName: 'REDE', acquirerCnpj: '01425787000104' },
  GOODCARD: { brandName: 'GOODCARD', sefazCode: '15', acquirerName: 'GOODCARD', acquirerCnpj: '04874052000160' },
  GREENCARD: { brandName: 'GREENCARD', sefazCode: '16', acquirerName: 'GREENCARD', acquirerCnpj: '92894980000108' },
  SODEXO: { brandName: 'SODEXO', sefazCode: '21', acquirerName: 'CIELO', acquirerCnpj: '01027058000191' },
  VALECARD: { brandName: 'VALECARD', sefazCode: '22', acquirerName: 'VALECARD', acquirerCnpj: '25660854000116' },
  TICKET: { brandName: 'TICKET', sefazCode: '25', acquirerName: 'CIELO', acquirerCnpj: '01027058000191' },
  OUTRAS: { brandName: 'OUTRAS', sefazCode: '99', acquirerName: 'PAGBANK', acquirerCnpj: '08561701000101' },
};

export function sanitizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '').padStart(14, '0').slice(0, 14);
}

export function resolveBrandInfo(brandName?: string, operationType?: TefOperationType): BrandInfo {
  if (brandName) {
    const key = brandName.trim().toUpperCase();
    if (SEFAZ_CARD_BRANDS[key]) {
      return {
        ...SEFAZ_CARD_BRANDS[key],
        acquirerCnpj: sanitizeCnpj(SEFAZ_CARD_BRANDS[key].acquirerCnpj),
      };
    }
    // Search by partial match or sefazCode
    const foundByCode = Object.values(SEFAZ_CARD_BRANDS).find(
      (b) => b.sefazCode === key || b.brandName.toUpperCase() === key
    );
    if (foundByCode) {
      return {
        ...foundByCode,
        acquirerCnpj: sanitizeCnpj(foundByCode.acquirerCnpj),
      };
    }
  }

  // Default based on operation type
  if (operationType === 'VOUCHER') {
    return {
      ...SEFAZ_CARD_BRANDS['ALELO'],
      acquirerCnpj: sanitizeCnpj(SEFAZ_CARD_BRANDS['ALELO'].acquirerCnpj),
    };
  }
  if (operationType === 'PIX_TEF') {
    return {
      ...SEFAZ_CARD_BRANDS['OUTRAS'],
      acquirerCnpj: sanitizeCnpj(SEFAZ_CARD_BRANDS['OUTRAS'].acquirerCnpj),
    };
  }
  if (operationType === 'DEBITO') {
    return {
      ...SEFAZ_CARD_BRANDS['VISA'],
      acquirerCnpj: sanitizeCnpj(SEFAZ_CARD_BRANDS['VISA'].acquirerCnpj),
    };
  }

  // Default CREDITO
  return {
    ...SEFAZ_CARD_BRANDS['MASTERCARD'],
    acquirerCnpj: sanitizeCnpj(SEFAZ_CARD_BRANDS['MASTERCARD'].acquirerCnpj),
  };
}

export class TefMockProvider implements TefProvider {
  readonly providerId = 'MOCK';
  readonly providerName = 'Simulador PinPad & Adquirente FarmaCore';

  private nsuCounter = 100000;

  private generateNsu(): string {
    const nsu = this.nsuCounter++;
    return String(nsu).padStart(6, '0');
  }

  private generateHostNsu(): string {
    const prefix = Date.now().toString().slice(-6);
    const suffix = String(Math.floor(100000 + Math.random() * 900000));
    return `${prefix}${suffix}`.slice(-12);
  }

  private generateAuthCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  async pay(params: TefPayParams): Promise<TefPayResult> {
    const installments = params.installments && params.installments > 0 ? params.installments : 1;
    const cents = Math.round(params.amount * 100) % 100;

    let scenario = params.mockScenario;

    // Cents-based deterministic triggers if mockScenario is not explicitly specified
    if (!scenario) {
      if (cents === 2) {
        scenario = 'WRONG_PIN';
      } else if (cents === 3) {
        scenario = 'INSUFFICIENT_FUNDS';
      } else if (cents === 4) {
        scenario = 'USER_CANCELLED';
      } else if (cents === 5) {
        scenario = 'TIMEOUT';
      } else {
        scenario = 'SUCCESS';
      }
    }

    // Failures
    if (scenario === 'WRONG_PIN') {
      return {
        success: false,
        transactionUuid: randomUUID(),
        nsu: '',
        hostNsu: '',
        authorizationCode: '',
        brandName: '',
        brandCodeSefaz: '',
        acquirerName: '',
        acquirerCnpj: '',
        cardLastFour: '',
        amount: params.amount,
        installments,
        customerReceipt: '',
        merchantReceipt: '',
        errorMessage: 'Transação não autorizada: Senha incorreta (WRONG_PIN)',
      };
    }

    if (scenario === 'INSUFFICIENT_FUNDS') {
      return {
        success: false,
        transactionUuid: randomUUID(),
        nsu: '',
        hostNsu: '',
        authorizationCode: '',
        brandName: '',
        brandCodeSefaz: '',
        acquirerName: '',
        acquirerCnpj: '',
        cardLastFour: '',
        amount: params.amount,
        installments,
        customerReceipt: '',
        merchantReceipt: '',
        errorMessage: 'Transação não autorizada: Saldo insuficiente (INSUFFICIENT_FUNDS)',
      };
    }

    if (scenario === 'USER_CANCELLED') {
      return {
        success: false,
        transactionUuid: randomUUID(),
        nsu: '',
        hostNsu: '',
        authorizationCode: '',
        brandName: '',
        brandCodeSefaz: '',
        acquirerName: '',
        acquirerCnpj: '',
        cardLastFour: '',
        amount: params.amount,
        installments,
        customerReceipt: '',
        merchantReceipt: '',
        errorMessage: 'Operação cancelada pelo usuário no PinPad (USER_CANCELLED)',
      };
    }

    if (scenario === 'TIMEOUT') {
      return {
        success: false,
        transactionUuid: randomUUID(),
        nsu: '',
        hostNsu: '',
        authorizationCode: '',
        brandName: '',
        brandCodeSefaz: '',
        acquirerName: '',
        acquirerCnpj: '',
        cardLastFour: '',
        amount: params.amount,
        installments,
        customerReceipt: '',
        merchantReceipt: '',
        errorMessage: 'Tempo limite de resposta do PinPad excedido (TIMEOUT)',
      };
    }

    // SUCCESS scenario
    const brandInfo = resolveBrandInfo(params.brandName, params.operationType);
    const nsu = this.generateNsu();
    const hostNsu = this.generateHostNsu();
    const authorizationCode = this.generateAuthCode();
    const transactionUuid = randomUUID();
    const cardLastFour = '1234';

    // Calculate MDR rate
    let mdrRate = 1.2; // default DEBITO
    if (params.operationType === 'CREDITO') {
      mdrRate = installments > 1 ? 3.8 : 2.5;
    } else if (params.operationType === 'VOUCHER') {
      mdrRate = 3.0;
    } else if (params.operationType === 'PIX_TEF') {
      mdrRate = 0.9;
    } else if (params.operationType === 'DEBITO') {
      mdrRate = 1.2;
    }

    const netAmount = Number((params.amount * (1 - mdrRate / 100)).toFixed(2));

    // Calculate settlement date
    const settlementDate = new Date();
    if (params.operationType === 'DEBITO' || params.operationType === 'PIX_TEF') {
      settlementDate.setDate(settlementDate.getDate() + 1); // D+1
    } else {
      settlementDate.setDate(settlementDate.getDate() + 30); // D+30
    }
    const expectedSettlementDate = settlementDate.toISOString().split('T')[0];

    const opDesc =
      params.operationType === 'CREDITO'
        ? `CARTAO DE CREDITO ${installments > 1 ? `${installments}X` : 'A VISTA'}`
        : params.operationType === 'DEBITO'
        ? 'CARTAO DE DEBITO A VISTA'
        : params.operationType === 'VOUCHER'
        ? 'VOUCHER REFEICAO/ALIMENTACAO'
        : 'PIX TEF';

    const customerReceipt = [
      '================================================',
      '           COMPROVANTE DE PAGAMENTO TEF         ',
      '================================================',
      '1a VIA - CLIENTE',
      `OPERACAO: ${opDesc}`,
      `BANDEIRA: ${brandInfo.brandName}`,
      `CARTAO: **** **** **** ${cardLastFour}`,
      `REDE: ${brandInfo.acquirerName}`,
      `DOC/NSU: ${nsu}         AUTORIZACAO: ${authorizationCode}`,
      `VALOR TOTAL PAGO:                       R$ ${params.amount.toFixed(2)}`,
      'TRANSACAO APROVADA COM SUCESSO',
      '================================================',
    ].join('\n');

    const merchantReceipt = [
      '================================================',
      '           COMPROVANTE DE PAGAMENTO TEF         ',
      '================================================',
      '2a VIA - ESTABELECIMENTO (CONTROLE INTERNO)',
      `OPERACAO: ${opDesc}`,
      `BANDEIRA: ${brandInfo.brandName}`,
      `CARTAO: **** **** **** ${cardLastFour}`,
      `DOC/NSU: ${nsu}         AUTORIZACAO: ${authorizationCode}`,
      `VALOR: R$ ${params.amount.toFixed(2)}`,
      '================================================',
    ].join('\n');

    return {
      success: true,
      transactionUuid,
      nsu,
      hostNsu,
      authorizationCode,
      brandName: brandInfo.brandName,
      brandCodeSefaz: brandInfo.sefazCode,
      acquirerName: brandInfo.acquirerName,
      acquirerCnpj: brandInfo.acquirerCnpj,
      cardLastFour,
      amount: params.amount,
      installments,
      customerReceipt,
      merchantReceipt,
      mdrRate,
      netAmount,
      expectedSettlementDate,
    };
  }

  async confirm(params: TefConfirmParams): Promise<TefConfirmResult> {
    return {
      success: true,
      nsu: params.nsu,
      confirmedAt: new Date().toISOString(),
    };
  }

  async undo(params: TefUndoParams): Promise<TefUndoResult> {
    return {
      success: true,
      nsu: params.nsu,
      reversedAt: new Date().toISOString(),
      reversalReason: params.reason || 'Desfazimento técnico automático',
    };
  }

  async cancel(params: TefCancelParams): Promise<TefCancelResult> {
    const cancellationNsu = this.generateNsu();
    const cancelledAt = new Date().toISOString();

    const cancellationReceipt = [
      '================================================',
      '       COMPROVANTE DE CANCELAMENTO / ESTORNO     ',
      '================================================',
      `DOC/NSU ORIGINAL: ${params.nsu}`,
      `NSU CANCELAMENTO: ${cancellationNsu}`,
      `DATA/HORA: ${cancelledAt}`,
      `MOTIVO: ${params.reason}`,
      'STATUS: CANCELAMENTO HOMOLOGADO NA REDE',
      '================================================',
    ].join('\n');

    return {
      success: true,
      nsu: params.nsu,
      cancellationNsu,
      cancelledAt,
      cancellationReceipt,
    };
  }
}
