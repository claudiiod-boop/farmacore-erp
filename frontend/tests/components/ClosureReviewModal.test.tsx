import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import ClosureReviewModal from '../../src/components/pos/ClosureReviewModal';
import { api } from '../../src/services/api';
import type { BlindCashClosure } from '../../src/types';

const mockPendingClosure: BlindCashClosure = {
  id: 15,
  cashSessionId: 2,
  operatorName: 'Mariana Caixa',
  closedAt: '2026-11-18T19:00:00.000Z',
  systemCash: 200.0,
  systemCredit: 300.0,
  systemDebit: 150.0,
  systemPix: 80.0,
  systemPbm: 40.0,
  systemTotal: 770.0,
  declaredCash: 200.0,
  declaredCredit: 300.0,
  declaredDebit: 150.0,
  declaredPix: 80.0,
  declaredPbm: 40.0,
  declaredTotal: 770.0,
  cashDifference: 0.0,
  totalDifference: 0.0,
  differenceStatus: 'EXACT',
  status: 'PENDING_REVIEW',
  operatorNotes: 'Caixa conferido sem problemas',
  createdAt: '2026-11-18T19:00:00.000Z',
};

const mockShortageClosure: BlindCashClosure = {
  ...mockPendingClosure,
  id: 16,
  declaredCash: 190.0,
  declaredTotal: 760.0,
  cashDifference: -10.0,
  totalDifference: -10.0,
  differenceStatus: 'SHORTAGE',
};

describe('ClosureReviewModal Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should not render anything when isOpen is false', () => {
    render(
      <ClosureReviewModal
        isOpen={false}
        closure={mockPendingClosure}
        onClose={vi.fn()}
        onReviewed={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should render confrontation table comparing system vs declared values', () => {
    render(
      <ClosureReviewModal
        isOpen={true}
        closure={mockPendingClosure}
        onClose={vi.fn()}
        onReviewed={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Auditoria & Homologação de Fechamento de Caixa/i)).toBeDefined();
    expect(screen.getByText(/Mariana Caixa/i)).toBeDefined();
    expect(screen.getByText(/Pendente de Homologação/i)).toBeDefined();
    expect(screen.getByText(/Conferência Exata \(0,00\)/i)).toBeDefined();
    expect(screen.getByText(/Caixa conferido sem problemas/i)).toBeDefined();
  });

  it('should render shortage difference badge and negative values correctly', () => {
    render(
      <ClosureReviewModal
        isOpen={true}
        closure={mockShortageClosure}
        onClose={vi.fn()}
        onReviewed={vi.fn()}
      />
    );

    expect(screen.getByText(/Quebra de Caixa/i)).toBeDefined();
  });

  it('should call api.reviewClosure and onReviewed when approving', async () => {
    const reviewSpy = vi.spyOn(api, 'reviewClosure').mockResolvedValue({
      ...mockPendingClosure,
      status: 'APPROVED',
      managerName: 'Gerente Roberto',
      managerNotes: 'Homologado OK',
      reviewedAt: '2026-11-18T19:15:00.000Z',
    });
    const onReviewed = vi.fn();

    render(
      <ClosureReviewModal
        isOpen={true}
        closure={mockPendingClosure}
        onClose={vi.fn()}
        onReviewed={onReviewed}
      />
    );

    fireEvent.change(screen.getByTestId('input-manager-name'), { target: { value: 'Gerente Roberto' } });
    fireEvent.change(screen.getByTestId('input-manager-notes'), { target: { value: 'Homologado OK' } });
    fireEvent.click(screen.getByTestId('btn-approve-closure'));

    await waitFor(() => {
      expect(reviewSpy).toHaveBeenCalledWith(15, {
        managerName: 'Gerente Roberto',
        approved: true,
        managerNotes: 'Homologado OK',
      });
      expect(onReviewed).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'APPROVED',
          managerName: 'Gerente Roberto',
        })
      );
    });
  });

  it('should call api.reviewClosure with approved false when rejecting', async () => {
    const reviewSpy = vi.spyOn(api, 'reviewClosure').mockResolvedValue({
      ...mockShortageClosure,
      status: 'REJECTED',
      managerName: 'Gerente de Loja',
      managerNotes: 'Divergência injustificada',
    });
    const onReviewed = vi.fn();

    render(
      <ClosureReviewModal
        isOpen={true}
        closure={mockShortageClosure}
        onClose={vi.fn()}
        onReviewed={onReviewed}
      />
    );

    fireEvent.change(screen.getByTestId('input-manager-notes'), { target: { value: 'Divergência injustificada' } });
    fireEvent.click(screen.getByTestId('btn-reject-closure'));

    await waitFor(() => {
      expect(reviewSpy).toHaveBeenCalledWith(16, {
        managerName: 'Gerente de Loja',
        approved: false,
        managerNotes: 'Divergência injustificada',
      });
      expect(onReviewed).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'REJECTED',
        })
      );
    });
  });

  it('should fetch and display thermal ESC/POS receipt preview when clicking print', async () => {
    vi.spyOn(api, 'getClosureReceipt').mockResolvedValue({
      textReceipt: '================================================\nCOMPROVANTE DE FECHAMENTO DE CAIXA\n================================================',
      fullEscPos: '\x1b\x40...',
    });

    render(
      <ClosureReviewModal
        isOpen={true}
        closure={mockPendingClosure}
        onClose={vi.fn()}
        onReviewed={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-print-closure-receipt'));

    await waitFor(() => {
      expect(screen.getByTestId('receipt-text-preview')).toBeDefined();
      expect(screen.getByText(/COMPROVANTE DE FECHAMENTO DE CAIXA/i)).toBeDefined();
    });
  });
});
