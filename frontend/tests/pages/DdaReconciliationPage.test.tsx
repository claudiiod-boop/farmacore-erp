import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { DdaReconciliationPage } from '../../src/pages/DdaReconciliationPage';
import { ddaApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  ddaApi: {
    getInvoices: vi.fn(),
    getKpis: vi.fn(),
    reconcileAuto: vi.fn(),
    importFile: vi.fn(),
    settleInvoice: vi.fn(),
    manualMatch: vi.fn()
  }
}));

describe('DdaReconciliationPage Component', () => {
  const mockInvoices = [
    {
      id: 'dda-1',
      store_id: '1',
      bank_code: '001',
      bank_name: 'Banco do Brasil',
      barcode: '00191234567890123456789012345678901234567890',
      digitable_line: '00190.00009 01234.567890 12345.678901 2 89012345678901',
      beneficiary_cnpj: '12345678000199',
      beneficiary_name: 'Distribuidora Panpharma Medicamentos',
      payer_cnpj: '98765432000188',
      due_date: '2026-12-15',
      issue_date: '2026-11-20',
      nominal_amount: 3200.00,
      discount_amount: 0,
      interest_amount: 0,
      final_amount: 3200.00,
      status: 'MATCHED' as const,
      matched_purchase_invoice_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'dda-2',
      store_id: '1',
      bank_code: '341',
      bank_name: 'Itaú',
      barcode: '34191234567890123456789012345678901234567890',
      digitable_line: '34190.00009 01234.567890 12345.678901 2 89012345678901',
      beneficiary_cnpj: '99888777000166',
      beneficiary_name: 'Distribuidora Suspeita LTDA',
      payer_cnpj: '98765432000188',
      due_date: '2026-12-25',
      issue_date: '2026-11-25',
      nominal_amount: 850.00,
      discount_amount: 0,
      interest_amount: 0,
      final_amount: 850.00,
      status: 'UNMATCHED' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const mockKpis = {
    total_invoices: 2,
    pending_invoices: 0,
    matched_invoices: 1,
    paid_invoices: 0,
    unmatched_invoices: 1,
    total_amount_pending: 850.00,
    total_amount_matched: 3200.00,
    reconciliation_rate_percent: 50
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ddaApi.getInvoices).mockResolvedValue({
      success: true,
      data: mockInvoices
    });
    vi.mocked(ddaApi.getKpis).mockResolvedValue({
      success: true,
      data: mockKpis
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Renderiza header, KPIs de conciliação DDA e tabela de títulos', async () => {
    render(<DdaReconciliationPage />);

    expect(screen.getByText(/Conciliação DDA & Boletos de Fornecedores/i)).toBeDefined();
    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-invoices').textContent).toBe('2');
      expect(screen.getByTestId('kpi-matched-invoices').textContent).toContain('1');
      expect(screen.getByTestId('kpi-unmatched-invoices').textContent).toBe('1');
    });

    expect(screen.getByText('Distribuidora Panpharma Medicamentos')).toBeDefined();
    expect(screen.getByText('Distribuidora Suspeita LTDA')).toBeDefined();
    expect(screen.getByText('NF-e Compra #1')).toBeDefined();
  });

  it('2. Dispara conciliação automática com compras ao clicar no botão', async () => {
    vi.mocked(ddaApi.reconcileAuto).mockResolvedValue({
      success: true,
      data: {
        totalProcessed: 2,
        matchedCount: 1,
        mismatchValueCount: 0,
        unmatchedCount: 1,
        invoices: []
      }
    });

    render(<DdaReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-invoices').textContent).toBe('2');
    });

    const autoBtn = screen.getByTestId('btn-auto-reconcile');
    fireEvent.click(autoBtn);

    await waitFor(() => {
      expect(ddaApi.reconcileAuto).toHaveBeenCalledWith('1');
      expect(screen.getByTestId('alert-feedback-message')).toBeDefined();
      expect(screen.getByText(/Conciliação finalizada: 1 títulos conciliados com sucesso/i)).toBeDefined();
    });
  });

  it('3. Abre modal de importação e envia novo título DDA', async () => {
    vi.mocked(ddaApi.importFile).mockResolvedValue({
      success: true,
      data: [mockInvoices[0]]
    });

    render(<DdaReconciliationPage />);

    const openModalBtn = screen.getByTestId('btn-import-dda-modal');
    fireEvent.click(openModalBtn);

    await waitFor(() => {
      expect(screen.getByTestId('modal-import-dda')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Importar$/i }));

    await waitFor(() => {
      expect(ddaApi.importFile).toHaveBeenCalled();
    });
  });

  it('4. Abre modal de liquidação e confirma quitação do boleto', async () => {
    vi.mocked(ddaApi.settleInvoice).mockResolvedValue({
      success: true,
      data: { ...mockInvoices[0], status: 'PAID' }
    });

    render(<DdaReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-settle-dda-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('btn-settle-dda-1'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-settle-dda')).toBeDefined();
      expect(screen.getByText(/Confirmar Liquidação de Boleto/i)).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('btn-confirm-settle'));

    await waitFor(() => {
      expect(ddaApi.settleInvoice).toHaveBeenCalledWith('dda-1', 3200, expect.any(String));
    });
  });
});
