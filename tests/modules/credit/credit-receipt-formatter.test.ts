import { describe, it, expect } from 'vitest';
import {
  formatPromissoryNote,
  formatPaymentReceipt,
  formatPayrollReport,
  type PromissoryNoteParams,
  type PaymentReceiptParams,
} from '../../../src/modules/credit/credit-receipt-formatter';
import type {
  AgreementInvoiceWithDetails,
  CorporateAgreement,
  Customer,
  CustomerReceivable,
} from '../../../src/modules/credit/types';

describe('Credit Receipt Formatter (ESC/POS 48 Colunas)', () => {
  const mockStore = {
    storeName: 'FARMACORE DROGARIA & FARMACIA',
    cnpj: '12.345.678/0001-90',
    address: 'Av. Paulista, 1000 - Bela Vista',
    city: 'Sao Paulo - SP',
    phone: '(11) 3200-0000',
  };

  describe('formatPromissoryNote', () => {
    const mockParams: PromissoryNoteParams = {
      store: mockStore,
      saleId: 101,
      saleDate: '2026-11-20 14:30:00',
      customer: {
        id: 1,
        name: 'Carlos Alberto Silva',
        cpf: '123.456.789-01',
        rg: '12.345.678-9',
        address: 'Rua Augusta, 500, Apto 42 - Consolacao, Sao Paulo - SP',
      },
      dependent: {
        id: 10,
        name: 'Mariana Silva',
        cpf: '987.654.321-99',
        relationship: 'FILHO(A)',
      },
      items: [
        {
          productName: 'Amoxicilina 500mg 21 caps',
          quantity: 2,
          unitPrice: 25.0,
          totalPrice: 50.0,
        },
        {
          productName: 'Dipirona Sodica 500mg 10 comp',
          quantity: 1,
          unitPrice: 10.0,
          totalPrice: 10.0,
        },
      ],
      totalAmount: 60.0,
      installments: [
        {
          installmentNumber: 1,
          totalInstallments: 2,
          dueDate: '2026-12-20',
          amount: 30.0,
        },
        {
          installmentNumber: 2,
          totalInstallments: 2,
          dueDate: '2027-01-20',
          amount: 30.0,
        },
      ],
      agreementName: 'Alpha Tech Ltda',
    };

    it('should format promissory note with header, title, customer, dependent, items, installments, legal text and signature line', () => {
      const result = formatPromissoryNote(mockParams);

      expect(result).toBeDefined();
      expect(result.textReceipt).toBeDefined();
      expect(result.fullEscPos).toBeDefined();

      const text = result.textReceipt;

      // 1. Cabecalho da farmacia
      expect(text).toContain('FARMACORE DROGARIA & FARMACIA');
      expect(text).toContain('12.345.678/0001-90');
      expect(text).toContain('Av. Paulista, 1000');

      // 2. Titulo
      expect(text).toContain('NOTA PROMISSÓRIA / CONFISSÃO DE DÍVIDA');

      // 3. Dados da venda
      expect(text).toContain('Venda #101');
      expect(text).toContain('20/11/2026');

      // 4. Dados do titular
      expect(text).toContain('Carlos Alberto Silva');
      expect(text).toContain('123.456.789-01');

      // 5. Dependente comprador
      expect(text).toContain('Mariana Silva');
      expect(text).toContain('987.654.321-99');
      expect(text).toContain('FILHO(A)');

      // 6. Resumo dos itens
      expect(text).toContain('Amoxicilina 500mg');
      expect(text).toContain('Dipirona Sodica');
      expect(text).toContain('60.00');

      // 7. Detalhamento das parcelas
      expect(text).toContain('Parc 1/2');
      expect(text).toContain('20/12/2026');
      expect(text).toContain('30.00');
      expect(text).toContain('Parc 2/2');
      expect(text).toContain('20/01/2027');

      // 8. Texto juridico de confissao de divida
      expect(text).toMatch(/confiss[aã]o|prometo\(emos\) pagar|reconhe/i);
      expect(text).toContain('CPC');

      // 9. Linha de assinatura
      expect(text).toContain('____');
      expect(text).toContain('Assinatura');

      // 10. Comandos ESC/POS (Reset \x1B\x40 e Corte de papel \x1D\x56\x41\x10)
      expect(result.fullEscPos).toContain('\x1B\x40');
      expect(result.fullEscPos).toContain('\x1D\x56\x41\x10');

      // Largura maxima de 48 colunas por linha
      const lines = text.split('\n');
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(48);
      }
    });

    it('should format promissory note without dependent when buyer is titular', () => {
      const paramsWithoutDependent = {
        ...mockParams,
        dependent: null,
      };

      const result = formatPromissoryNote(paramsWithoutDependent);
      expect(result.textReceipt).not.toContain('Mariana Silva');
      expect(result.textReceipt).toContain('Carlos Alberto Silva');
    });
  });

  describe('formatPaymentReceipt', () => {
    const mockCustomer: Customer = {
      id: 2,
      storeId: 1,
      name: 'Beatriz Ramos',
      cpf: '456.789.012-34',
      creditLimit: 500.0,
      currentDebt: 50.0,
      status: 'ACTIVE',
      allowDependents: true,
    };

    const mockPaidReceivables: CustomerReceivable[] = [
      {
        id: 11,
        customerId: 2,
        installmentNumber: 1,
        totalInstallments: 3,
        dueDate: '2026-11-10',
        originalAmount: 50.0,
        paidAmount: 50.0,
        discountAmount: 0.0,
        interestAmount: 0.0,
        status: 'PAID',
      },
    ];

    const mockPaymentParams: PaymentReceiptParams = {
      store: mockStore,
      customer: mockCustomer,
      paidReceivables: mockPaidReceivables,
      totalPaid: 50.0,
      remainingDebt: 50.0,
      availableLimit: 450.0,
      paymentMethod: 'DINHEIRO',
      cashSessionId: 5,
      operatorName: 'Caixa 01',
      paidAt: '2026-11-20 15:45:00',
    };

    it('should format payment receipt with header, title, installments, total, payment method, balances and ESC/POS', () => {
      const result = formatPaymentReceipt(mockPaymentParams);

      expect(result).toBeDefined();
      expect(result.textReceipt).toBeDefined();
      expect(result.fullEscPos).toBeDefined();

      const text = result.textReceipt;

      // 1. Cabecalho
      expect(text).toContain('FARMACORE DROGARIA & FARMACIA');
      expect(text).toContain('12.345.678/0001-90');

      // 2. Titulo
      expect(text).toContain('RECIBO DE QUITAÇÃO DE CREDIÁRIO');

      // 3. Cliente
      expect(text).toContain('Beatriz Ramos');
      expect(text).toContain('456.789.012-34');

      // 4. Parcelas liquidadas
      expect(text).toContain('Parc 1/3');
      expect(text).toContain('10/11/2026');
      expect(text).toContain('50.00');

      // 5. Total pago e forma de pagamento
      expect(text).toContain('TOTAL PAGO:');
      expect(text).toContain('50.00');
      expect(text).toContain('DINHEIRO');

      // 6. Saldo devedor restante e limite disponivel
      expect(text).toContain('Saldo Devedor Restante:');
      expect(text).toContain('50.00');
      expect(text).toContain('Limite Disponivel:');
      expect(text).toContain('450.00');

      // 7. ESC/POS (Reset \x1B\x40 e Corte de papel \x1D\x56\x41\x10)
      expect(result.fullEscPos).toContain('\x1B\x40');
      expect(result.fullEscPos).toContain('\x1D\x56\x41\x10');

      // Largura maxima de 48 colunas por linha
      const lines = text.split('\n');
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(48);
      }
    });
  });

  describe('formatPayrollReport', () => {
    const mockAgreement: CorporateAgreement = {
      id: 1,
      code: 'CONV-TECH',
      companyName: 'Tech Innovations S.A.',
      tradeName: 'TechCorp',
      cnpj: '99.888.777/0001-66',
      street: 'Av. das Nacoes',
      number: '2000',
      neighborhood: 'Polo Tecnologico',
      city: 'Campinas',
      state: 'SP',
      zipCode: '13000-000',
      closingDay: 20,
      dueDay: 5,
      creditLimit: 50000.0,
      discountPercent: 5.0,
      isActive: true,
    };

    const mockInvoiceWithDetails: AgreementInvoiceWithDetails = {
      id: 5,
      invoiceNumber: 'FAT-202611-0001',
      agreementId: 1,
      periodStart: '2026-10-21',
      periodEnd: '2026-11-20',
      dueDate: '2026-12-05',
      totalAmount: 350.75,
      totalSalesCount: 4,
      totalEmployeesCount: 2,
      status: 'OPEN',
      agreement: mockAgreement,
      items: [
        {
          customerId: 101,
          customerName: 'Eduardo Pereira',
          cpf: '111.222.333-44',
          registrationNumber: 'MAT-9081',
          department: 'Engenharia de Software',
          salesCount: 2,
          totalAmount: 150.5,
          receivables: [],
        },
        {
          customerId: 102,
          customerName: 'Fernanda Lima',
          cpf: '555.666.777-88',
          registrationNumber: 'MAT-9082',
          department: 'Recursos Humanos',
          salesCount: 2,
          totalAmount: 200.25,
          receivables: [],
        },
      ],
    };

    it('should format payroll report with invoice number, period, totals, and employee details for HR deduction', () => {
      const result = formatPayrollReport(mockInvoiceWithDetails);

      expect(result).toBeDefined();
      const report = result.textReport || result.textReceipt;

      // 1. Dados do convenio e fatura
      expect(report).toContain('TechCorp');
      expect(report).toContain('99.888.777/0001-66');
      expect(report).toContain('FAT-202611-0001');

      // 2. Periodo e vencimento
      expect(report).toContain('21/10/2026');
      expect(report).toContain('20/11/2026');
      expect(report).toContain('05/12/2026');

      // 3. Totais
      expect(report).toContain('350.75');
      expect(report).toContain('2'); // total colaboradores

      // 4. Colaboradores com matricula, departamento, CPF e valor a descontar
      expect(report).toContain('Eduardo Pereira');
      expect(report).toContain('111.222.333-44');
      expect(report).toContain('MAT-9081');
      expect(report).toContain('Engenharia de Software');
      expect(report).toContain('150.50');

      expect(report).toContain('Fernanda Lima');
      expect(report).toContain('555.666.777-88');
      expect(report).toContain('MAT-9082');
      expect(report).toContain('Recursos Humanos');
      expect(report).toContain('200.25');

      expect(report).toMatch(/DESCONTO EM FOLHA|EXTRATO DE RH/i);
    });
  });
});
