import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import BlindClosureModal from '../../src/components/pos/BlindClosureModal';
import { api } from '../../src/services/api';
import type { BlindCashClosure } from '../../src/types';

const mockClosure: BlindCashClosure = {
  id: 10,
  cashSessionId: 1,
  operatorName: 'Carlos Operador',
  closedAt: '2026-11-18T18:00:00.000Z',
  systemCash: 150.0,
  systemCredit: 250.0,
  systemDebit: 180.0,
  systemPix: 100.0,
  systemPbm: 50.0,
  systemTotal: 730.0,
  declaredCash: 150.0,
  declaredCredit: 250.0,
  declaredDebit: 180.0,
  declaredPix: 100.0,
  declaredPbm: 50.0,
  declaredTotal: 730.0,
  cashDifference: 0.0,
  totalDifference: 0.0,
  differenceStatus: 'EXACT',
  status: 'PENDING_REVIEW',
  createdAt: '2026-11-18T18:00:00.000Z',
};

describe('BlindClosureModal Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should not render anything when isOpen is false', () => {
    render(
      <BlindClosureModal
        isOpen={false}
        sessionId={1}
        operatorName="Carlos Operador"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/Fechamento Cego de Caixa/i)).toBeNull();
  });

  it('should render modal with blind counting inputs when isOpen is true', () => {
    render(
      <BlindClosureModal
        isOpen={true}
        sessionId={1}
        operatorName="Carlos Operador"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Fechamento Cego de Caixa/i)).toBeDefined();
    expect(screen.getByTestId('input-declared-cash')).toBeDefined();
    expect(screen.getByTestId('input-declared-credit')).toBeDefined();
    expect(screen.getByTestId('input-declared-debit')).toBeDefined();
    expect(screen.getByTestId('input-declared-pix')).toBeDefined();
    expect(screen.getByTestId('input-declared-pbm')).toBeDefined();
    expect(screen.getByTestId('input-operator-notes')).toBeDefined();
    expect(screen.getByTestId('btn-submit-blind-closure')).toBeDefined();
  });

  it('should dynamically update declared total as operator types values', () => {
    render(
      <BlindClosureModal
        isOpen={true}
        sessionId={1}
        operatorName="Carlos Operador"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const cashInput = screen.getByTestId('input-declared-cash');
    const creditInput = screen.getByTestId('input-declared-credit');
    const pixInput = screen.getByTestId('input-declared-pix');

    fireEvent.change(cashInput, { target: { value: '150.50' } });
    fireEvent.change(creditInput, { target: { value: '50.00' } });
    fireEvent.change(pixInput, { target: { value: '25.00' } });

    // 150.50 + 50.00 + 25.00 = 225.50
    expect(screen.getByText(/225,50/)).toBeDefined();
  });

  it('should call api.declareBlindClosure and onSuccess when form is submitted with valid counts', async () => {
    const declareSpy = vi.spyOn(api, 'declareBlindClosure').mockResolvedValue(mockClosure);
    const onSuccess = vi.fn();

    render(
      <BlindClosureModal
        isOpen={true}
        sessionId={1}
        operatorName="Carlos Operador"
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    );

    fireEvent.change(screen.getByTestId('input-declared-cash'), { target: { value: '150' } });
    fireEvent.change(screen.getByTestId('input-declared-credit'), { target: { value: '250' } });
    fireEvent.change(screen.getByTestId('input-declared-debit'), { target: { value: '180' } });
    fireEvent.change(screen.getByTestId('input-declared-pix'), { target: { value: '100' } });
    fireEvent.change(screen.getByTestId('input-declared-pbm'), { target: { value: '50' } });
    fireEvent.change(screen.getByTestId('input-operator-notes'), { target: { value: 'Tudo conferido' } });

    fireEvent.click(screen.getByTestId('btn-submit-blind-closure'));

    await waitFor(() => {
      expect(declareSpy).toHaveBeenCalledWith({
        sessionId: 1,
        operatorName: 'Carlos Operador',
        declaredCash: 150,
        declaredCredit: 250,
        declaredDebit: 180,
        declaredPix: 100,
        declaredPbm: 50,
        operatorNotes: 'Tudo conferido',
      });
      expect(onSuccess).toHaveBeenCalledWith(mockClosure);
    });
  });

  it('should display error alert when declareBlindClosure throws error', async () => {
    vi.spyOn(api, 'declareBlindClosure').mockRejectedValue(new Error('Sessão de caixa já foi encerrada'));

    render(
      <BlindClosureModal
        isOpen={true}
        sessionId={1}
        operatorName="Carlos Operador"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    fireEvent.change(screen.getByTestId('input-declared-cash'), { target: { value: '100' } });
    fireEvent.click(screen.getByTestId('btn-submit-blind-closure'));

    await waitFor(() => {
      expect(screen.getByText(/Sessão de caixa já foi encerrada/i)).toBeDefined();
    });
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <BlindClosureModal
        isOpen={true}
        sessionId={1}
        operatorName="Carlos Operador"
        onClose={onClose}
        onSuccess={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle(/Fechar/i));
    expect(onClose).toHaveBeenCalled();
  });
});
