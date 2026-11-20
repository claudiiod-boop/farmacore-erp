import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import DebtPaymentModal from '../../src/components/credit/DebtPaymentModal';
import { api } from '../../src/services/api';
import type { Customer, CustomerReceivable } from '../../src/types';

const mockCustomer: Customer = {
  id: 1,
  storeId: 1,
  name: 'João Pedro',
  cpf: '12345678901',
  creditLimit: 500,
  currentDebt: 150,
  status: 'ACTIVE',
  allowDependents: true,
};

const mockReceivables: CustomerReceivable[] = [
  {
    id: 10,
    customerId: 1,
    saleId: 400,
    installmentNumber: 1,
    totalInstallments: 2,
    dueDate: '2026-11-10',
    originalAmount: 75.0,
    paidAmount: 0,
    discountAmount: 0,
    interestAmount: 0,
    status: 'OPEN',
  },
  {
    id: 11,
    customerId: 1,
    saleId: 400,
    installmentNumber: 2,
    totalInstallments: 2,
    dueDate: '2026-12-10',
    originalAmount: 75.0,
    paidAmount: 0,
    discountAmount: 0,
    interestAmount: 0,
    status: 'OPEN',
  },
];

describe('DebtPaymentModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should not render anything when isOpen is false', () => {
    render(
      <DebtPaymentModal
        isOpen={false}
        customer={mockCustomer}
        receivables={mockReceivables}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should render open receivables and sum selected total', () => {
    render(
      <DebtPaymentModal
        isOpen={true}
        customer={mockCustomer}
        receivables={mockReceivables}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Recebimento & Quitação de Carnê de Crediário/i)).toBeDefined();
    expect(screen.getByText(/João Pedro/i)).toBeDefined();

    // Both open installments selected by default = 150,00
    expect(screen.getAllByText(/150,00/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('confirm-settlement-btn')).toBeDefined();
  });

  it('should call settleReceivables API and render settlement receipt upon confirmation', async () => {
    const settleSpy = vi.spyOn(api.credit, 'settleReceivables').mockResolvedValue({
      paidReceivables: mockReceivables,
      totalPaid: 150.0,
      remainingDebt: 0,
      availableLimit: 500.0,
      customer: { ...mockCustomer, currentDebt: 0 },
      receiptText: '================================\n   RECIBO DE QUITAÇÃO DE CARNÊ\n================================\nCliente: João Pedro\nTotal Pago: R$ 150,00\nSaldo Restante: R$ 0,00\n',
    });

    const onSettlementSuccess = vi.fn();

    render(
      <DebtPaymentModal
        isOpen={true}
        customer={mockCustomer}
        receivables={mockReceivables}
        currentCashSessionId={5}
        onClose={vi.fn()}
        onSettlementSuccess={onSettlementSuccess}
      />
    );

    // Select payment method PIX
    fireEvent.click(screen.getByRole('button', { name: /Pix/i }));

    // Click confirm settlement
    fireEvent.click(screen.getByTestId('confirm-settlement-btn'));

    await waitFor(() => {
      expect(settleSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          receivableIds: [10, 11],
          cashSessionId: 5,
          paymentMethod: 'PIX',
        })
      );
      expect(onSettlementSuccess).toHaveBeenCalled();
    });

    expect(screen.getByText(/Quitação Realizada com Sucesso!/i)).toBeDefined();
    expect(screen.getByTestId('settlement-receipt-content')).toBeDefined();
    expect(screen.getByTestId('print-settlement-btn')).toBeDefined();
  });
});
