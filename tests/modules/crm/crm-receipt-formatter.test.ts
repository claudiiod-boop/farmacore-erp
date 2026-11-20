import { describe, it, expect } from 'vitest';
import {
  formatCashbackStatement,
  formatTreatmentRefillSlip,
  type CashbackStatementParams,
  type TreatmentRefillSlipParams,
  ESC_INIT,
  ESC_CUT,
} from '../../../src/modules/crm/crm-receipt-formatter';
import type { LoyaltyWallet, LoyaltyTransaction, PatientTreatment, UpcomingRefillItem } from '../../../src/modules/crm/types';

describe('CRM Receipt Formatter (ESC/POS 48 Colunas)', () => {
  const mockStore = {
    storeName: 'DROGARIA FARMACORE MATRIZ',
    cnpj: '12.345.678/0001-90',
    address: 'Av. Brasil, 1500 - Centro',
    city: 'Campinas - SP',
    phone: '(19) 3232-1000',
  };

  describe('formatCashbackStatement', () => {
    const mockWallet: LoyaltyWallet = {
      id: 1,
      customerId: 10,
      currentBalance: 45.5,
      totalEarned: 120.0,
      totalRedeemed: 65.0,
      totalExpired: 9.5,
      lastActivityAt: '2026-11-20 10:15:00',
    };

    const mockTransactions: LoyaltyTransaction[] = [
      {
        id: 1,
        walletId: 1,
        type: 'EARN',
        amount: 20.0,
        balanceAfter: 20.0,
        createdAt: '2026-11-01 14:00:00',
        notes: 'Cashback compra #1001',
      },
      {
        id: 2,
        walletId: 1,
        type: 'EARN',
        amount: 50.0,
        balanceAfter: 70.0,
        createdAt: '2026-11-10 11:30:00',
        notes: 'Cashback compra #1045',
      },
      {
        id: 3,
        walletId: 1,
        type: 'REDEEM',
        amount: 24.5,
        balanceAfter: 45.5,
        createdAt: '2026-11-15 16:45:00',
        notes: 'Resgate compra #1102',
      },
    ];

    const mockParams: CashbackStatementParams = {
      store: mockStore,
      customer: {
        id: 10,
        name: 'Maria Clara Oliveira',
        cpf: '123.456.789-00',
        phone: '(19) 99876-5432',
      },
      wallet: mockWallet,
      transactions: mockTransactions,
      program: {
        id: 1,
        name: 'Clube FarmaCore',
        cashbackPercent: 3.0,
        validityDays: 90,
        minPurchaseAmount: 20.0,
        minRedeemAmount: 5.0,
        maxRedeemPercent: 50.0,
        allowWithPromotions: false,
        isActive: true,
      },
      columnWidth: 48,
    };

    it('should format cashback statement with pharmacy header, title, customer info, balances, transaction history, terms and ESC/POS codes', () => {
      const result = formatCashbackStatement(mockParams);

      expect(result).toBeDefined();
      expect(result.textReceipt).toBeDefined();
      expect(result.fullEscPos).toBeDefined();

      const text = result.textReceipt;

      // 1. Cabeçalho da farmácia
      expect(text).toContain('DROGARIA FARMACORE MATRIZ');
      expect(text).toContain('12.345.678/0001-90');
      expect(text).toContain('Av. Brasil, 1500');

      // 2. Título
      expect(text).toContain('CLUBE FARMACORE - EXTRATO DE CASHBACK');

      // 3. Dados do titular
      expect(text).toContain('Maria Clara Oliveira');
      expect(text).toContain('123.456.789-00');

      // 4. Saldos
      expect(text).toContain('45.50'); // Saldo disponível
      expect(text).toContain('120.00'); // Total acumulado
      expect(text).toContain('65.00'); // Total resgatado

      // 5. Histórico de transações
      expect(text).toContain('20.00');
      expect(text).toContain('50.00');
      expect(text).toContain('24.50');
      expect(text).toMatch(/ACÚMULO|CREDITO|EARN/i);
      expect(text).toMatch(/RESGATE|DEBITO|REDEEM/i);

      // 6. Termos informativos de validade
      expect(text).toMatch(/validade/i);
      expect(text).toContain('90'); // 90 dias

      // 7. ESC/POS commands
      expect(result.fullEscPos).toContain(ESC_INIT); // \x1B\x40
      expect(result.fullEscPos).toContain(ESC_CUT); // \x1D\x56\x41\x10
    });

    it('should handle wallet without transactions gracefully', () => {
      const emptyParams: CashbackStatementParams = {
        store: mockStore,
        customer: {
          id: 11,
          name: 'João Pedro Santos',
          cpf: '234.567.890-11',
        },
        wallet: {
          id: 2,
          customerId: 11,
          currentBalance: 0,
          totalEarned: 0,
          totalRedeemed: 0,
          totalExpired: 0,
        },
        transactions: [],
      };

      const result = formatCashbackStatement(emptyParams);
      expect(result.textReceipt).toContain('João Pedro Santos');
      expect(result.textReceipt).toContain('0.00');
      expect(result.fullEscPos).toContain(ESC_INIT);
      expect(result.fullEscPos).toContain(ESC_CUT);
    });
  });

  describe('formatTreatmentRefillSlip', () => {
    const mockRefillItem: UpcomingRefillItem = {
      treatmentId: 101,
      customerId: 42,
      customerName: 'Drauzio Varella',
      customerPhone: '(11) 98765-4321',
      productId: 501,
      productName: 'Losartana Potássica 50mg',
      dosage: '50mg',
      productDosage: '50mg',
      dailyDose: 1,
      unitsPerBox: 30,
      boxesPurchased: 2,
      totalDaysSupply: 60,
      startDate: '2026-10-01',
      expectedRefillDate: '2026-11-30',
      daysUntilRefill: 10,
      status: 'ACTIVE',
      notes: 'Paciente hipertenso em acompanhamento',
    };

    const mockParams: TreatmentRefillSlipParams = {
      store: mockStore,
      treatment: mockRefillItem,
      pharmacistName: 'Farm. Roberto Silva CRF/SP 12345',
      columnWidth: 48,
    };

    it('should format treatment refill slip with header, title, patient, phone, medication, posology, estimated end date, remaining days, pharmacist notes and ESC/POS', () => {
      const result = formatTreatmentRefillSlip(mockParams);

      expect(result).toBeDefined();
      expect(result.textReceipt).toBeDefined();
      expect(result.fullEscPos).toBeDefined();

      const text = result.textReceipt;

      // 1. Cabeçalho da farmácia
      expect(text).toContain('DROGARIA FARMACORE MATRIZ');
      expect(text).toContain('12.345.678/0001-90');

      // 2. Título
      expect(text).toContain('ALERTA DE RECOMPRA PREDITIVA');

      // 3. Dados do paciente e telefone
      expect(text).toContain('Drauzio Varella');
      expect(text).toContain('(11) 98765-4321');

      // 4. Medicamento e dosagem
      expect(text).toContain('Losartana Potássica 50mg');

      // 5. Posologia e tratamento
      expect(text).toMatch(/1\s*(cp|dose|unid|comp)/i);
      expect(text).toContain('60'); // total de dias ou quantidade

      // 6. Data estimada de término
      expect(text).toMatch(/30\/11\/2026|2026-11-30/);

      // 7. Dias restantes
      expect(text).toContain('10');

      // 8. Campo de anotações do farmacêutico
      expect(text).toMatch(/Anotações|Farmacêutico|Observações/i);

      // 9. Comandos ESC/POS
      expect(result.fullEscPos).toContain(ESC_INIT); // \x1B\x40
      expect(result.fullEscPos).toContain(ESC_CUT); // \x1D\x56\x41\x10
    });

    it('should support PatientTreatment object with separate customer and product details', () => {
      const patientTreatment: PatientTreatment = {
        id: 102,
        customerId: 55,
        productId: 602,
        dailyDose: 2,
        unitsPerBox: 60,
        boxesPurchased: 1,
        totalDaysSupply: 30,
        startDate: '2026-11-01',
        expectedRefillDate: '2026-12-01',
        status: 'ACTIVE',
      };

      const params: TreatmentRefillSlipParams = {
        store: mockStore,
        treatment: patientTreatment,
        customer: {
          id: 55,
          name: 'Ana Paula Fagundes',
          phone: '(19) 91122-3344',
        },
        product: {
          id: 602,
          name: 'Metformina 850mg',
          dosage: '850mg',
        },
      };

      const result = formatTreatmentRefillSlip(params);
      expect(result.textReceipt).toContain('ALERTA DE RECOMPRA PREDITIVA');
      expect(result.textReceipt).toContain('Ana Paula Fagundes');
      expect(result.textReceipt).toContain('Metformina 850mg');
      expect(result.fullEscPos).toContain(ESC_INIT);
      expect(result.fullEscPos).toContain(ESC_CUT);
    });
  });
});
