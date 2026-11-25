import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { CorporateAgreementsBillingPage } from '../../src/pages/CorporateAgreementsBillingPage';
import { agreementsApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  agreementsApi: {
    listInvoices: vi.fn(),
    getKpis: vi.fn(),
    generateBatchBilling: vi.fn(),
    settleInvoice: vi.fn(),
    exportPayrollDiscount: vi.fn()
  }
}));

describe('CorporateAgreementsBillingPage Component', () => {
  const mockKpis = {
    total_agreements_active: 5,
    open_invoices_count: 2,
    total_open_amount: 1450.50,
    paid_invoices_month_count: 8,
    total_paid_month_amount: 9800.00,
    active_employees_count: 120
  };

  const mockInvoices = [
    {
      id: 1,
      invoice_number: 'FAT-202611-0001',
      agreement_id: 10,
      company_name: 'Metalúrgica Paulista LTDA',
      cnpj: '12.345.678/0001-99',
      period_start: '2026-11-01',
      period_end: '2026-11-20',
      due_date: '2026-12-05',
      total_amount: 650.50,
      total_sales_count: 4,
      total_employees_count: 3,
      status: 'OPEN' as const,
      created_at: '2026-11-21 10:00:00',
      updated_at: '2026-11-21 10:00:00'
    },
    {
      id: 2,
      invoice_number: 'FAT-202611-0002',
      agreement_id: 12,
      company_name: 'Logística Express S.A.',
      cnpj: '98.765.432/0001-11',
      period_start: '2026-11-01',
      period_end: '2026-11-20',
      due_date: '2026-12-05',
      total_amount: 800.00,
      total_sales_count: 5,
      total_employees_count: 4,
      status: 'PAID' as const,
      paid_at: '2026-12-01',
      created_at: '2026-11-21 10:15:00',
      updated_at: '2026-12-01 14:00:00'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (agreementsApi.listInvoices as any).mockResolvedValue({
      success: true,
      data: mockInvoices
    });
    (agreementsApi.getKpis as any).mockResolvedValue({
      success: true,
      data: mockKpis
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Renderiza cabeçalho, KPIs e tabela de faturas de convênios', async () => {
    render(<CorporateAgreementsBillingPage />);

    expect(screen.getByText('Gestão de Convênios Empresariais & Faturamento em Lote')).toBeDefined();
    await waitFor(() => {
      expect(screen.getByTestId('kpi-active-agreements').textContent).toBe('5');
      expect(screen.getByTestId('kpi-open-invoices').textContent).toBe('2');
      expect(screen.getByTestId('kpi-active-employees').textContent).toBe('120');
      expect(screen.getByText('FAT-202611-0001')).toBeDefined();
      expect(screen.getByText('Metalúrgica Paulista LTDA')).toBeDefined();
      expect(screen.getByText('Logística Express S.A.')).toBeDefined();
    });
  });

  it('2. Filtra faturas por status selecionado', async () => {
    render(<CorporateAgreementsBillingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('status-filter-select')).toBeDefined();
    });

    fireEvent.change(screen.getByTestId('status-filter-select'), {
      target: { value: 'OPEN' }
    });

    await waitFor(() => {
      expect(agreementsApi.listInvoices).toHaveBeenCalledWith({ status: 'OPEN' });
    });
  });

  it('3. Abre e submete o modal de Fechamento em Lote com sucesso', async () => {
    (agreementsApi.generateBatchBilling as any).mockResolvedValue({
      success: true,
      data: [mockInvoices[0]]
    });

    render(<CorporateAgreementsBillingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('batch-billing-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('batch-billing-button'));
    expect(screen.getByTestId('batch-billing-modal')).toBeDefined();

    fireEvent.change(screen.getByTestId('batch-start-date'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByTestId('batch-end-date'), { target: { value: '2026-11-20' } });
    fireEvent.change(screen.getByTestId('batch-due-date'), { target: { value: '2026-12-05' } });

    fireEvent.click(screen.getByTestId('confirm-batch-billing-button'));

    await waitFor(() => {
      expect(agreementsApi.generateBatchBilling).toHaveBeenCalledWith({
        period_start: '2026-11-01',
        period_end: '2026-11-20',
        due_date: '2026-12-05'
      });
      expect(screen.getByTestId('success-alert')).toBeDefined();
    });
  });

  it('4. Abre e submete o modal de liquidação de fatura', async () => {
    (agreementsApi.settleInvoice as any).mockResolvedValue({
      success: true,
      data: { ...mockInvoices[0], status: 'PAID', paid_at: '2026-12-04' }
    });

    render(<CorporateAgreementsBillingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('settle-invoice-button-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('settle-invoice-button-1'));
    expect(screen.getByTestId('settle-modal')).toBeDefined();

    fireEvent.change(screen.getByTestId('settle-notes'), { target: { value: 'TED Confirmada' } });
    fireEvent.click(screen.getByTestId('confirm-settle-button'));

    await waitFor(() => {
      expect(agreementsApi.settleInvoice).toHaveBeenCalledWith(1, {
        paid_date: expect.any(String),
        notes: 'TED Confirmada'
      });
      expect(screen.getByTestId('success-alert')).toBeDefined();
    });
  });

  it('5. Abre o modal de espelho de desconto em folha para RH', async () => {
    (agreementsApi.exportPayrollDiscount as any).mockResolvedValue({
      success: true,
      data: {
        exportId: 'exp-1',
        invoiceId: 1,
        companyName: 'Metalúrgica Paulista LTDA',
        cnpj: '12.345.678/0001-99',
        period: '2026-11-01 a 2026-11-20',
        totalEmployees: 3,
        totalAmount: 650.50,
        csvContent: 'MATRICULA;CPF;NOME_COLABORADOR;QTD_COMPRAS;VALOR_DESCONTO_FOLHA\n1001;111;Carlos;2;300,00',
        rows: []
      }
    });

    render(<CorporateAgreementsBillingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('export-payroll-button-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('export-payroll-button-1'));

    await waitFor(() => {
      expect(agreementsApi.exportPayrollDiscount).toHaveBeenCalledWith(1);
      expect(screen.getByTestId('payroll-modal')).toBeDefined();
      expect(screen.getByTestId('payroll-csv-content')).toBeDefined();
    });
  });
});
