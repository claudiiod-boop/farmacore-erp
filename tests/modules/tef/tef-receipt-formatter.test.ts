import { describe, it, expect } from 'vitest';
import {
  RECEIPT_WIDTH,
  ESC_POS_CUT,
  formatTefReceipt,
  formatTefCancellationReceipt,
  centerText,
  justifyText,
  wrapText,
  maskCardNumber,
  formatCurrency,
  formatDateTime,
  formatOperationDescription,
} from '../../../src/modules/tef/tef-receipt-formatter';
import type { TefTransaction, StoreInfo } from '../../../src/modules/tef/types';

describe('TEF Receipt Formatter (48 Columns ESC/POS)', () => {
  const mockStore: StoreInfo = {
    name: 'DROGARIA FARMACORE BRASIL LTDA',
    cnpj: '12.345.678/0001-90',
    ie: '987654321',
    address: 'RUA DAS FARMACIAS, 123 - CENTRO - CURITIBA/PR',
  };

  const mockTransaction: TefTransaction = {
    id: 1,
    transactionUuid: 'uuid-1234-5678',
    providerId: 'MOCK',
    terminalId: 'SE000001',
    saleId: 456,
    paymentId: 10,
    operationType: 'CREDITO',
    status: 'CONFIRMED',
    amount: 149.9,
    installments: 1,
    installmentType: 'A_VISTA',
    brandName: 'MASTERCARD',
    brandCodeSefaz: '02',
    acquirerName: 'REDE',
    acquirerCnpj: '01425787000104',
    authorizationCode: '987654',
    nsu: '100001',
    hostNsu: '999888777666',
    cardLastFour: '4321',
    createdAt: '2026-11-18T16:00:00.000Z',
    confirmedAt: '2026-11-18T16:00:10.000Z',
  };

  describe('Helpers and Constants', () => {
    it('should define RECEIPT_WIDTH as 48 and ESC_POS_CUT as \\x1b\\x69', () => {
      expect(RECEIPT_WIDTH).toBe(48);
      expect(ESC_POS_CUT).toBe('\x1b\x69');
    });

    it('should center text within 48 columns', () => {
      const centered = centerText('FARMACORE');
      expect(centered.length).toBe(48);
      expect(centered.trim()).toBe('FARMACORE');
    });

    it('should justify text to left and right within 48 columns', () => {
      const justified = justifyText('TOTAL:', 'R$ 10,00');
      expect(justified.length).toBe(48);
      expect(justified.startsWith('TOTAL:')).toBe(true);
      expect(justified.endsWith('R$ 10,00')).toBe(true);
    });

    it('should wrap text without breaking words exceeding 48 columns', () => {
      const longText = 'Esta e uma descricao bastante longa de endereco da farmacia para verificar quebra correta';
      const lines = wrapText(longText, 48);
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(48);
      }
      expect(lines.join(' ')).toBe(longText);
    });

    it('should format currency in Brazilian format (R$ 149,90)', () => {
      expect(formatCurrency(149.9)).toBe('149,90');
      expect(formatCurrency(0)).toBe('0,00');
    });

    it('should mask card number retaining only the last 4 digits', () => {
      expect(maskCardNumber('4321')).toBe('**** **** **** 4321');
      expect(maskCardNumber('123456******4321')).toBe('**** **** **** 4321');
      expect(maskCardNumber(null)).toBe('**** **** **** ****');
    });

    it('should format operation descriptions correctly', () => {
      expect(formatOperationDescription('DEBITO')).toBe('CARTAO DE DEBITO A VISTA');
      expect(formatOperationDescription('CREDITO', 1, 'A_VISTA')).toBe('CARTAO DE CREDITO A VISTA');
      expect(formatOperationDescription('CREDITO', 3, 'PARCELADO_LOJA')).toBe('CARTAO DE CREDITO 3X LOJA');
      expect(formatOperationDescription('CREDITO', 6, 'PARCELADO_ADM')).toBe('CARTAO DE CREDITO 6X ADM');
      expect(formatOperationDescription('VOUCHER')).toBe('VOUCHER REFEICAO/ALIMENTACAO');
      expect(formatOperationDescription('PIX_TEF')).toBe('PIX TEF');
    });
  });

  describe('formatTefReceipt', () => {
    it('should format 1st copy (Cliente) with store info, card data, NSU, auth code, and amount', () => {
      const receipt = formatTefReceipt(mockTransaction, mockStore);

      expect(receipt.customerReceipt).toContain('COMPROVANTE DE PAGAMENTO TEF');
      expect(receipt.customerReceipt).toContain('DROGARIA FARMACORE BRASIL LTDA');
      expect(receipt.customerReceipt).toContain('12.345.678/0001-90');
      expect(receipt.customerReceipt).toContain('1a VIA - CLIENTE');
      expect(receipt.customerReceipt).toContain('OPERACAO: CARTAO DE CREDITO A VISTA');
      expect(receipt.customerReceipt).toContain('BANDEIRA: MASTERCARD');
      expect(receipt.customerReceipt).toContain('CARTAO: **** **** **** 4321');
      expect(receipt.customerReceipt).toContain('REDE: REDE');
      expect(receipt.customerReceipt).toContain('DOC/NSU: 100001');
      expect(receipt.customerReceipt).toContain('AUTORIZACAO: 987654');
      expect(receipt.customerReceipt).toContain('149,90');
      expect(receipt.customerReceipt).toContain('TRANSACAO APROVADA COM SUCESSO');
    });

    it('should format 2nd copy (Estabelecimento) with store control and NFC-e link', () => {
      const receipt = formatTefReceipt(mockTransaction, mockStore);

      expect(receipt.merchantReceipt).toContain('2a VIA - ESTABELECIMENTO (CONTROLE INTERNO)');
      expect(receipt.merchantReceipt).toContain('DOC/NSU: 100001');
      expect(receipt.merchantReceipt).toContain('AUTORIZACAO: 987654');
      expect(receipt.merchantReceipt).toContain('149,90');
      expect(receipt.merchantReceipt).toContain('CUPOM FISCAL / NFC-e: 000000456');
    });

    it('should format installments correctly when transaction is parcelada', () => {
      const installmentTx: TefTransaction = {
        ...mockTransaction,
        amount: 300,
        installments: 3,
        installmentType: 'PARCELADO_LOJA',
      };
      const receipt = formatTefReceipt(installmentTx, mockStore);

      expect(receipt.customerReceipt).toContain('CARTAO DE CREDITO 3X LOJA');
      expect(receipt.merchantReceipt).toContain('CARTAO DE CREDITO 3X LOJA');
    });

    it('should assemble fullEscPos with paper cut commands between and after copies', () => {
      const receipt = formatTefReceipt(mockTransaction, mockStore);

      expect(receipt.fullEscPos).toContain(receipt.customerReceipt);
      expect(receipt.fullEscPos).toContain(receipt.merchantReceipt);
      expect(receipt.fullEscPos.split(ESC_POS_CUT).length - 1).toBe(2);
    });

    it('should strictly respect maximum 48 columns per line', () => {
      const storeWithLongData: StoreInfo = {
        name: 'DROGARIA SUPER MEGA HIPER FARMACORE DO BRASIL DE CURITIBA LTDA ME',
        cnpj: '12.345.678/0001-90',
        ie: '987654321012345',
        address: 'AVENIDA MARECHAL DEODORO DA FONSECA, 99999 - CONJUNTO 101 BLOCO B - CENTRO HISTORICO - CURITIBA/PR',
      };

      const receipt = formatTefReceipt(mockTransaction, storeWithLongData);

      const customerLines = receipt.customerReceipt.split('\n');
      for (const line of customerLines) {
        expect(line.length).toBeLessThanOrEqual(48);
      }

      const merchantLines = receipt.merchantReceipt.split('\n');
      for (const line of merchantLines) {
        expect(line.length).toBeLessThanOrEqual(48);
      }
    });
  });

  describe('formatTefCancellationReceipt', () => {
    const mockCancellationTx: TefTransaction = {
      ...mockTransaction,
      status: 'CANCELLED',
      cancellationNsu: '200002',
      cancellationReason: 'Desistencia do cliente antes da emissao fiscal',
      cancelledAt: '2026-11-18T16:30:00.000Z',
    };

    it('should format cancellation receipt with original NSU, cancellation NSU, and reason', () => {
      const receipt = formatTefCancellationReceipt(mockCancellationTx, mockStore);

      expect(receipt.customerReceipt).toContain('COMPROVANTE DE CANCELAMENTO / ESTORNO');
      expect(receipt.customerReceipt).toContain('1a VIA - CLIENTE');
      expect(receipt.customerReceipt).toContain('DOC/NSU ORIGINAL: 100001');
      expect(receipt.customerReceipt).toContain('NSU CANCELAMENTO: 200002');
      expect(receipt.customerReceipt).toContain('VALOR ESTORNADO:');
      expect(receipt.customerReceipt).toContain('149,90');
      expect(receipt.customerReceipt).toContain('MOTIVO: Desistencia do cliente');
      expect(receipt.customerReceipt).toContain('ESTORNO CONFIRMADO NA REDE ADQUIRENTE');

      expect(receipt.merchantReceipt).toContain('2a VIA - ESTABELECIMENTO (CONTROLE INTERNO)');
      expect(receipt.merchantReceipt).toContain('NSU CANCELAMENTO: 200002');

      expect(receipt.fullEscPos.split(ESC_POS_CUT).length - 1).toBe(2);
    });

    it('should strictly respect maximum 48 columns per line on cancellation receipt', () => {
      const receipt = formatTefCancellationReceipt(mockCancellationTx, mockStore);

      const customerLines = receipt.customerReceipt.split('\n');
      for (const line of customerLines) {
        expect(line.length).toBeLessThanOrEqual(48);
      }

      const merchantLines = receipt.merchantReceipt.split('\n');
      for (const line of merchantLines) {
        expect(line.length).toBeLessThanOrEqual(48);
      }
    });
  });
});
