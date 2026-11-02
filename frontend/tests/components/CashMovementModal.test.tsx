import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CashMovementModal from '../../src/components/pos/CashMovementModal';

describe('CashMovementModal Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should not render anything when isOpen is false', () => {
    render(
      <CashMovementModal
        isOpen={false}
        currentCash={200}
        operatorName="Carlos Operador"
        onClose={vi.fn()}
        onConfirmMovement={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/Movimentação de Caixa/i)).toBeNull();
  });

  it('should render dialog, operator name, current drawer cash and movement type buttons', () => {
    render(
      <CashMovementModal
        isOpen={true}
        currentCash={250.75}
        operatorName="Carlos Operador"
        onClose={vi.fn()}
        onConfirmMovement={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Movimentação de Caixa/i)).toBeDefined();
    expect(screen.getByText(/Carlos Operador/i)).toBeDefined();
    expect(screen.getByText(/250,75/)).toBeDefined();

    expect(screen.getByRole('button', { name: /Sangria/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Suprimento/i })).toBeDefined();
  });

  it('should toggle between SANGRIA and SUPPLY', () => {
    render(
      <CashMovementModal
        isOpen={true}
        currentCash={200.0}
        operatorName="Carlos Operador"
        onClose={vi.fn()}
        onConfirmMovement={vi.fn()}
      />
    );

    const sangriaBtn = screen.getByRole('button', { name: /Sangria/i });
    const supplyBtn = screen.getByRole('button', { name: /Suprimento/i });

    // Click supply
    fireEvent.click(supplyBtn);
    expect(screen.getByText(/Aporte \/ Entrada de Fundo de Troco/i)).toBeDefined();

    // Click sangria
    fireEvent.click(sangriaBtn);
    expect(screen.getByText(/Retirada \/ Recolhimento de Segurança/i)).toBeDefined();
  });

  it('should disable submit and display warning when SANGRIA exceeds currentCash (Trava de Gaveta)', () => {
    render(
      <CashMovementModal
        isOpen={true}
        currentCash={100.0}
        operatorName="Carlos Operador"
        onClose={vi.fn()}
        onConfirmMovement={vi.fn()}
      />
    );

    const sangriaBtn = screen.getByRole('button', { name: /Sangria/i });
    fireEvent.click(sangriaBtn);

    const amountInput = screen.getByLabelText(/Valor da Movimentação/i);
    const reasonInput = screen.getByLabelText(/Motivo/i);

    fireEvent.change(amountInput, { target: { value: '150.00' } });
    fireEvent.change(reasonInput, { target: { value: 'Recolhimento para cofre' } });

    expect(screen.getByText(/Saldo em dinheiro na gaveta insuficiente/i)).toBeDefined();

    const submitBtn = screen.getByRole('button', { name: /Confirmar Movimentação|Confirmar/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);

    // Now switch to SUPPLY with the same 150.00 amount - should allow it!
    const supplyBtn = screen.getByRole('button', { name: /Suprimento/i });
    fireEvent.click(supplyBtn);

    expect(screen.queryByText(/Saldo em dinheiro na gaveta insuficiente/i)).toBeNull();
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('should validate positive amount and non-empty reason', () => {
    const onConfirmMovement = vi.fn();
    render(
      <CashMovementModal
        isOpen={true}
        currentCash={200.0}
        operatorName="Carlos Operador"
        onClose={vi.fn()}
        onConfirmMovement={onConfirmMovement}
      />
    );

    const amountInput = screen.getByLabelText(/Valor da Movimentação/i);
    const submitBtn = screen.getByRole('button', { name: /Confirmar Movimentação|Confirmar/i });

    // Empty fields
    fireEvent.click(submitBtn);
    expect(onConfirmMovement).not.toHaveBeenCalled();
    expect(screen.getByText(/O valor deve ser maior que zero/i)).toBeDefined();
    expect(screen.getByText(/Motivo da movimentação é obrigatório/i)).toBeDefined();

    // Zero amount
    fireEvent.change(amountInput, { target: { value: '0' } });
    fireEvent.click(submitBtn);
    expect(onConfirmMovement).not.toHaveBeenCalled();
  });

  it('should call onConfirmMovement with type, amount, and reason on valid submission', () => {
    const onConfirmMovement = vi.fn();
    render(
      <CashMovementModal
        isOpen={true}
        currentCash={300.0}
        operatorName="Carlos Operador"
        onClose={vi.fn()}
        onConfirmMovement={onConfirmMovement}
      />
    );

    const amountInput = screen.getByLabelText(/Valor da Movimentação/i);
    const reasonInput = screen.getByLabelText(/Motivo/i);
    const submitBtn = screen.getByRole('button', { name: /Confirmar Movimentação|Confirmar/i });

    fireEvent.change(amountInput, { target: { value: '80.00' } });
    fireEvent.change(reasonInput, { target: { value: 'Sangria de segurança periódica' } });

    fireEvent.click(submitBtn);

    expect(onConfirmMovement).toHaveBeenCalledTimes(1);
    expect(onConfirmMovement).toHaveBeenCalledWith('SANGRIA', 80, 'Sangria de segurança periódica');
  });

  it('should call onConfirmMovement for SUPPLY', () => {
    const onConfirmMovement = vi.fn();
    render(
      <CashMovementModal
        isOpen={true}
        currentCash={50.0}
        operatorName="Carlos Operador"
        onClose={vi.fn()}
        onConfirmMovement={onConfirmMovement}
      />
    );

    const supplyBtn = screen.getByRole('button', { name: /Suprimento/i });
    fireEvent.click(supplyBtn);

    const amountInput = screen.getByLabelText(/Valor da Movimentação/i);
    const reasonInput = screen.getByLabelText(/Motivo/i);
    const submitBtn = screen.getByRole('button', { name: /Confirmar Movimentação|Confirmar/i });

    fireEvent.change(amountInput, { target: { value: '100.00' } });
    fireEvent.change(reasonInput, { target: { value: 'Aporte de moedas e notas miúdas' } });

    fireEvent.click(submitBtn);

    expect(onConfirmMovement).toHaveBeenCalledTimes(1);
    expect(onConfirmMovement).toHaveBeenCalledWith('SUPPLY', 100, 'Aporte de moedas e notas miúdas');
  });

  it('should close when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <CashMovementModal
        isOpen={true}
        currentCash={200.0}
        operatorName="Carlos Operador"
        onClose={onClose}
        onConfirmMovement={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should close when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <CashMovementModal
        isOpen={true}
        currentCash={200.0}
        operatorName="Carlos Operador"
        onClose={onClose}
        onConfirmMovement={vi.fn()}
      />
    );

    const closeBtn = screen.getByRole('button', { name: 'Cancelar' });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
