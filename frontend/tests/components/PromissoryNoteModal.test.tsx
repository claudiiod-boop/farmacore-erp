import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import PromissoryNoteModal from '../../src/components/credit/PromissoryNoteModal';
import { api } from '../../src/services/api';

describe('PromissoryNoteModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should not render anything when isOpen is false', () => {
    render(
      <PromissoryNoteModal
        isOpen={false}
        saleId={100}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should fetch promissory note and render thermal receipt content when saleId is provided', async () => {
    vi.spyOn(api.credit, 'getPromissoryNote').mockResolvedValue({
      saleId: 100,
      customer: {
        id: 1,
        storeId: 1,
        name: 'Maria Oliveira',
        cpf: '11122233344',
        creditLimit: 1000,
        currentDebt: 200,
        status: 'ACTIVE',
        allowDependents: false,
      },
      installments: [
        { installmentNumber: 1, totalInstallments: 2, dueDate: '2026-12-01', amount: 100 },
        { installmentNumber: 2, totalInstallments: 2, dueDate: '2027-01-01', amount: 100 },
      ],
      textReceipt: '================================\n   NOTA PROMISSÓRIA TÉRMICA\n================================\nDevedor: Maria Oliveira\nValor: R$ 200,00\nAssinatura: __________________\n',
    });

    render(
      <PromissoryNoteModal
        isOpen={true}
        saleId={100}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Nota Promissória & Termo de Confissão de Dívida/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId('promissory-receipt-content')).toBeDefined();
      expect(screen.getByTestId('promissory-receipt-content').textContent).toContain('Maria Oliveira');
      expect(screen.getByTestId('promissory-receipt-content').textContent).toContain('NOTA PROMISSÓRIA');
    });

    expect(screen.getByTestId('print-promissory-btn')).toBeDefined();
  });

  it('should call onClose when close button or Escape is triggered', () => {
    const handleClose = vi.fn();
    render(
      <PromissoryNoteModal
        isOpen={true}
        saleId={100}
        onClose={handleClose}
        promissoryData={{
          saleId: 100,
          customer: {
            id: 1,
            storeId: 1,
            name: 'Maria Oliveira',
            cpf: '11122233344',
            creditLimit: 1000,
            currentDebt: 200,
            status: 'ACTIVE',
            allowDependents: false,
          },
          installments: [],
          textReceipt: 'NOTA PROMISSORIA SIMPLES',
        }}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
