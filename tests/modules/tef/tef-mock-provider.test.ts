import { describe, it, expect, beforeEach } from 'vitest';
import { TefMockProvider, SEFAZ_CARD_BRANDS } from '../../../src/modules/tef/providers/tef-mock-provider';
import type { TefProvider } from '../../../src/modules/tef/providers/tef-provider.interface';

describe('TefMockProvider (PinPad & Adquirer Simulator)', () => {
  let provider: TefMockProvider;

  beforeEach(() => {
    provider = new TefMockProvider();
  });

  it('should implement TefProvider interface with providerId MOCK and descriptive name', () => {
    const tefProvider: TefProvider = provider;
    expect(tefProvider.providerId).toBe('MOCK');
    expect(tefProvider.providerName).toContain('Simulador');
  });

  describe('pay() - Debit and Credit Authorization', () => {
    it('should authorize debit payment with approved status, NSU, hostNSU, authCode, and receipts', async () => {
      const result = await provider.pay({
        amount: 50.01,
        operationType: 'DEBITO',
      });

      expect(result.success).toBe(true);
      expect(result.transactionUuid).toBeDefined();
      expect(result.transactionUuid).toMatch(/^[0-9a-f-]{36}$/i);
      expect(result.nsu).toMatch(/^\d{6}$/);
      expect(result.hostNsu).toMatch(/^\d{12}$/);
      expect(result.authorizationCode).toMatch(/^\d{6}$/);
      expect(result.cardLastFour).toBe('1234');
      expect(result.amount).toBe(50.01);
      expect(result.installments).toBe(1);
      expect(result.customerReceipt).toContain('COMPROVANTE');
      expect(result.customerReceipt).toContain('1234');
      expect(result.merchantReceipt).toContain('ESTABELECIMENTO');
      expect(result.mdrRate).toBe(1.2);
      expect(result.netAmount).toBeCloseTo(50.01 * (1 - 0.012), 2);
      expect(result.expectedSettlementDate).toBeDefined();
      expect(result.errorMessage).toBeUndefined();
    });

    it('should authorize credit payment with installments and correct settlement calculation (D+30)', async () => {
      const result = await provider.pay({
        amount: 300.00,
        operationType: 'CREDITO',
        installments: 3,
        installmentType: 'PARCELADO_LOJA',
      });

      expect(result.success).toBe(true);
      expect(result.amount).toBe(300.00);
      expect(result.installments).toBe(3);
      expect(result.brandCodeSefaz).toBe('02'); // Default for credit is Master
      expect(result.brandName).toBe('MASTERCARD');
      expect(result.mdrRate).toBe(3.8); // Parcelado > 1x rate
      expect(result.netAmount).toBeCloseTo(300.00 * (1 - 0.038), 2);

      // Verify settlement date is roughly 30 days ahead
      const today = new Date();
      const settlement = new Date(result.expectedSettlementDate!);
      const diffDays = Math.round((settlement.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });

    it('should authorize single installment credit with A_VISTA rate (2.5%)', async () => {
      const result = await provider.pay({
        amount: 100.00,
        operationType: 'CREDITO',
        installments: 1,
        installmentType: 'A_VISTA',
      });

      expect(result.success).toBe(true);
      expect(result.mdrRate).toBe(2.5);
      expect(result.netAmount).toBeCloseTo(97.50, 2);
    });

    it('should authorize voucher payment (ALELO) with voucher rate (3.0%)', async () => {
      const result = await provider.pay({
        amount: 80.00,
        operationType: 'VOUCHER',
      });

      expect(result.success).toBe(true);
      expect(result.brandCodeSefaz).toBe('10');
      expect(result.brandName).toBe('ALELO');
      expect(result.mdrRate).toBe(3.0);
    });

    it('should authorize PIX_TEF with pix rate (0.9%) and D+1 settlement', async () => {
      const result = await provider.pay({
        amount: 45.00,
        operationType: 'PIX_TEF',
      });

      expect(result.success).toBe(true);
      expect(result.mdrRate).toBe(0.9);
      expect(result.netAmount).toBeCloseTo(45.00 * (1 - 0.009), 2);
    });
  });

  describe('SEFAZ Brand Codes & CNPJ Sanitization', () => {
    it('should map all standard card brands and vouchers correctly with exactly 14-digit CNPJ', async () => {
      const testCases = [
        { brand: 'VISA', expectedSefaz: '01', acquirer: 'CIELO', cnpj: '01027058000191' },
        { brand: 'MASTERCARD', expectedSefaz: '02', acquirer: 'REDE', cnpj: '01425787000104' },
        { brand: 'AMERICAN EXPRESS', expectedSefaz: '03', acquirer: 'CIELO', cnpj: '01027058000191' },
        { brand: 'SOROCRED', expectedSefaz: '04', acquirer: 'SOROCRED', cnpj: '60893303000118' },
        { brand: 'DINERS CLUB', expectedSefaz: '05', acquirer: 'REDE', cnpj: '01425787000104' },
        { brand: 'ELO', expectedSefaz: '06', acquirer: 'STONE', cnpj: '16501555000157' },
        { brand: 'HIPERCARD', expectedSefaz: '07', acquirer: 'REDE', cnpj: '01425787000104' },
        { brand: 'ALELO', expectedSefaz: '10', acquirer: 'CIELO', cnpj: '01027058000191' },
        { brand: 'SODEXO', expectedSefaz: '21', acquirer: 'CIELO', cnpj: '01027058000191' },
        { brand: 'TICKET', expectedSefaz: '25', acquirer: 'CIELO', cnpj: '01027058000191' },
        { brand: 'OUTRAS', expectedSefaz: '99', acquirer: 'PAGBANK', cnpj: '08561701000101' },
      ];

      for (const tc of testCases) {
        const result = await provider.pay({
          amount: 50.00,
          operationType: 'CREDITO',
          brandName: tc.brand,
        });

        expect(result.success).toBe(true);
        expect(result.brandCodeSefaz).toBe(tc.expectedSefaz);
        expect(result.acquirerName).toBe(tc.acquirer);
        expect(result.acquirerCnpj).toBe(tc.cnpj);
        expect(result.acquirerCnpj).toHaveLength(14);
        expect(/^\d{14}$/.test(result.acquirerCnpj)).toBe(true);
      }
    });

    it('should export SEFAZ_CARD_BRANDS dictionary', () => {
      expect(SEFAZ_CARD_BRANDS).toBeDefined();
      expect(SEFAZ_CARD_BRANDS['VISA'].sefazCode).toBe('01');
      expect(SEFAZ_CARD_BRANDS['MASTERCARD'].sefazCode).toBe('02');
      expect(SEFAZ_CARD_BRANDS['ELO'].sefazCode).toBe('06');
    });
  });

  describe('Deterministic Refusals & Failures', () => {
    it('should reject payment with WRONG_PIN when amount ends in .02', async () => {
      const result = await provider.pay({
        amount: 25.02,
        operationType: 'DEBITO',
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toMatch(/senha incorreta/i);
    });

    it('should reject payment with INSUFFICIENT_FUNDS when amount ends in .03', async () => {
      const result = await provider.pay({
        amount: 150.03,
        operationType: 'CREDITO',
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toMatch(/saldo insuficiente/i);
    });

    it('should reject payment with USER_CANCELLED when amount ends in .04', async () => {
      const result = await provider.pay({
        amount: 99.04,
        operationType: 'DEBITO',
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toMatch(/cancelad[oa] pelo usu[áa]rio/i);
    });

    it('should reject payment with TIMEOUT when amount ends in .05', async () => {
      const result = await provider.pay({
        amount: 12.05,
        operationType: 'DEBITO',
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toMatch(/timeout|tempo limite/i);
    });

    it('should reject payment via explicit mockScenario even with round amount', async () => {
      const scenarios: Array<{
        scenario: 'WRONG_PIN' | 'INSUFFICIENT_FUNDS' | 'USER_CANCELLED' | 'TIMEOUT';
        match: RegExp;
      }> = [
        { scenario: 'WRONG_PIN', match: /senha incorreta/i },
        { scenario: 'INSUFFICIENT_FUNDS', match: /saldo insuficiente/i },
        { scenario: 'USER_CANCELLED', match: /cancelad[oa] pelo usu[áa]rio/i },
        { scenario: 'TIMEOUT', match: /timeout|tempo limite/i },
      ];

      for (const item of scenarios) {
        const result = await provider.pay({
          amount: 100.00,
          operationType: 'DEBITO',
          mockScenario: item.scenario,
        });

        expect(result.success).toBe(false);
        expect(result.errorMessage).toMatch(item.match);
      }
    });

    it('should allow mockScenario: SUCCESS to override .02 cents', async () => {
      const result = await provider.pay({
        amount: 50.02,
        operationType: 'DEBITO',
        mockScenario: 'SUCCESS',
      });

      expect(result.success).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });
  });

  describe('confirm() - Transaction Confirmation', () => {
    it('should confirm transaction and return confirmedAt ISO timestamp', async () => {
      const confirmRes = await provider.confirm({
        nsu: '123456',
        saleId: 42,
        fiscalKeyNfce: '41261101027058000191650010000000011000000010',
      });

      expect(confirmRes.success).toBe(true);
      expect(confirmRes.nsu).toBe('123456');
      expect(confirmRes.confirmedAt).toBeDefined();
      expect(new Date(confirmRes.confirmedAt).getTime()).not.toBeNaN();
    });
  });

  describe('undo() - Technical Reversal', () => {
    it('should undo transaction returning reversal status and reason', async () => {
      const undoRes = await provider.undo({
        nsu: '123456',
        reason: 'Falha na emissão de NFC-e',
      });

      expect(undoRes.success).toBe(true);
      expect(undoRes.nsu).toBe('123456');
      expect(undoRes.reversedAt).toBeDefined();
      expect(undoRes.reversalReason).toBe('Falha na emissão de NFC-e');
    });
  });

  describe('cancel() - Administrative Cancellation', () => {
    it('should cancel transaction generating cancellation NSU and cancellation receipt', async () => {
      const cancelRes = await provider.cancel({
        nsu: '123456',
        reason: 'Cliente devolveu os produtos',
      });

      expect(cancelRes.success).toBe(true);
      expect(cancelRes.nsu).toBe('123456');
      expect(cancelRes.cancellationNsu).toMatch(/^\d{6}$/);
      expect(cancelRes.cancelledAt).toBeDefined();
      expect(cancelRes.cancellationReceipt).toContain('CANCELAMENTO');
      expect(cancelRes.cancellationReceipt).toContain('123456');
      expect(cancelRes.cancellationReceipt).toContain(cancelRes.cancellationNsu);
      expect(cancelRes.cancellationReceipt).toContain('Cliente devolveu os produtos');
    });
  });
});
