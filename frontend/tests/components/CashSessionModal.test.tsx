import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CashSessionModal from '../../src/components/pos/CashSessionModal';
import { CashSession, CashSessionSummary } from '../../src/services/api';

const mockOpenSession: CashSession = {
  id: 1,
  operatorName: 'Carlos Operador',
  initialCash: 150.0,
  currentCash: 350.0,
  status: 'OPEN',
  openedAt: '2026-11-02T08:00:00.000Z',
  closedAt: null,
};

const mockSummary: CashSessionSummary = {
  session: mockOpenSession,
  totalSalesCount: 12,
  totalSalesAmount: 850.5,
  totalsByMethod: {
    DINHEIRO: 300.0,
    CARTAO_CREDITO: 250.0,
    CARTAO_DEBITO: 180.5,
    PIX: 120.0,
  },
  totalSupplies: 100.0,
  totalSangrias: 50.0,
  expectedCash: 500.0, // initial (150) + supplies (100) - sangrias (50) + dinheiro (300) = 500
};

describe('CashSessionModal Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should not render anything when isOpen is false', () => {
    render(
      <CashSessionModal
        isOpen={false}
        mode="OPEN"
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/Abertura de Caixa/i)).toBeNull();
  });

  describe('OPEN mode', () => {
    it('should render operator input and initial cash input', () => {
      render(
        <CashSessionModal
          isOpen={true}
          mode="OPEN"
          onClose={vi.fn()}
          onConfirmOpen={vi.fn()}
        />
      );

      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText(/Abertura de Caixa/i)).toBeDefined();
      expect(screen.getByLabelText(/Nome do Operador/i)).toBeDefined();
      expect(screen.getByLabelText(/Fundo de Troco/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /Abrir Caixa/i })).toBeDefined();
    });

    it('should validate required operator name and initial cash', () => {
      const onConfirmOpen = vi.fn();
      render(
        <CashSessionModal
          isOpen={true}
          mode="OPEN"
          onClose={vi.fn()}
          onConfirmOpen={onConfirmOpen}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Abrir Caixa/i });
      fireEvent.click(submitButton);

      expect(onConfirmOpen).not.toHaveBeenCalled();
      expect(screen.getByText(/Nome do operador é obrigatório/i)).toBeDefined();
    });

    it('should validate non-negative initial cash', () => {
      const onConfirmOpen = vi.fn();
      render(
        <CashSessionModal
          isOpen={true}
          mode="OPEN"
          onClose={vi.fn()}
          onConfirmOpen={onConfirmOpen}
        />
      );

      const operatorInput = screen.getByLabelText(/Nome do Operador/i);
      const initialCashInput = screen.getByLabelText(/Fundo de Troco/i);

      fireEvent.change(operatorInput, { target: { value: 'Maria Santos' } });
      fireEvent.change(initialCashInput, { target: { value: '-10' } });

      const submitButton = screen.getByRole('button', { name: /Abrir Caixa/i });
      fireEvent.click(submitButton);

      expect(onConfirmOpen).not.toHaveBeenCalled();
      expect(screen.getByText(/Fundo de troco não pode ser negativo/i)).toBeDefined();
    });

    it('should call onConfirmOpen with operatorName and initialCash on valid submission', () => {
      const onConfirmOpen = vi.fn();
      render(
        <CashSessionModal
          isOpen={true}
          mode="OPEN"
          onClose={vi.fn()}
          onConfirmOpen={onConfirmOpen}
        />
      );

      const operatorInput = screen.getByLabelText(/Nome do Operador/i);
      const initialCashInput = screen.getByLabelText(/Fundo de Troco/i);

      fireEvent.change(operatorInput, { target: { value: 'Carlos Operador' } });
      fireEvent.change(initialCashInput, { target: { value: '150.00' } });

      const submitButton = screen.getByRole('button', { name: /Abrir Caixa/i });
      fireEvent.click(submitButton);

      expect(onConfirmOpen).toHaveBeenCalledTimes(1);
      expect(onConfirmOpen).toHaveBeenCalledWith('Carlos Operador', 150);
    });

    it('should disable submit button when isLoading is true', () => {
      render(
        <CashSessionModal
          isOpen={true}
          mode="OPEN"
          onClose={vi.fn()}
          onConfirmOpen={vi.fn()}
          isLoading={true}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Abrindo\.\.\.|Abrir Caixa/i });
      expect((submitButton as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('CLOSE mode', () => {
    it('should render financial summary breakdown in CLOSE mode', () => {
      render(
        <CashSessionModal
          isOpen={true}
          mode="CLOSE"
          currentSession={mockOpenSession}
          sessionSummary={mockSummary}
          onClose={vi.fn()}
          onConfirmClose={vi.fn()}
        />
      );

      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText(/Fechamento de Caixa/i)).toBeDefined();
      expect(screen.getByText(/Carlos Operador/i)).toBeDefined();

      // Check sales count and total amount
      expect(screen.getByText(/^12$/)).toBeDefined();
      expect(screen.getByText('R$ 850,50')).toBeDefined();

      // Check payment methods breakdown
      expect(screen.getByText('R$ 300,00')).toBeDefined(); // Dinheiro
      expect(screen.getByText('R$ 250,00')).toBeDefined(); // Cartão de Crédito
      expect(screen.getByText('R$ 180,50')).toBeDefined(); // Cartão de Débito
      expect(screen.getByText('R$ 120,00')).toBeDefined(); // Pix

      // Check supplies, sangrias and expected cash
      expect(screen.getByText('R$ 100,00')).toBeDefined(); // Suprimentos
      expect(screen.getByText('R$ 50,00')).toBeDefined(); // Sangrias
      expect(screen.getByText('R$ 500,00')).toBeDefined(); // Dinheiro Esperado na Gaveta
    });

    it('should call onConfirmClose when confirm button is clicked', () => {
      const onConfirmClose = vi.fn();
      render(
        <CashSessionModal
          isOpen={true}
          mode="CLOSE"
          currentSession={mockOpenSession}
          sessionSummary={mockSummary}
          onClose={vi.fn()}
          onConfirmClose={onConfirmClose}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /Confirmar Fechamento|Fechar Caixa/i });
      fireEvent.click(confirmButton);

      expect(onConfirmClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard navigation & modal closing', () => {
    it('should call onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      render(
        <CashSessionModal
          isOpen={true}
          mode="OPEN"
          onClose={onClose}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(
        <CashSessionModal
          isOpen={true}
          mode="OPEN"
          onClose={onClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: 'Cancelar' });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
