import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PaymentModal from '../../src/components/pos/PaymentModal';
import { PaymentItem } from '../../src/services/api';

describe('PaymentModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should not render anything when isOpen is false', () => {
    render(
      <PaymentModal
        isOpen={false}
        totalAmount={150.0}
        onClose={vi.fn()}
        onConfirmPayments={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/Recebimento \/ Pagamento/i)).toBeNull();
  });

  it('should open modal displaying the required total amount in BRL', () => {
    render(
      <PaymentModal
        isOpen={true}
        totalAmount={150.5}
        onClose={vi.fn()}
        onConfirmPayments={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    // Check formatted total amount in BRL
    expect(screen.getAllByText(/150,50/).length).toBeGreaterThan(0);
    // Modal title
    expect(screen.getByText(/Recebimento \/ Pagamento|Pagamento PDV|Checkout/i)).toBeDefined();
  });

  it('should add a single cash payment with automatic change calculation', () => {
    render(
      <PaymentModal
        isOpen={true}
        totalAmount={100.0}
        onClose={vi.fn()}
        onConfirmPayments={vi.fn()}
      />
    );

    // Select DINHEIRO method
    const cashTab = screen.getByRole('button', { name: /Dinheiro/i });
    fireEvent.click(cashTab);

    // Enter R$ 120,00
    const amountInput = screen.getByLabelText(/Valor a pagar|Valor do Pagamento|Valor recebido/i);
    fireEvent.change(amountInput, { target: { value: '120.00' } });

    // Add payment
    const addBtn = screen.getByRole('button', { name: /Adicionar Pagamento|Adicionar/i });
    fireEvent.click(addBtn);

    // Change should be R$ 20,00
    expect(screen.getByText(/Troco/i)).toBeDefined();
    expect(screen.getAllByText(/20,00/).length).toBeGreaterThan(0);

    // Total Paid should be R$ 120,00
    expect(screen.getAllByText(/120,00/).length).toBeGreaterThan(0);

    // Submit button should be enabled
    const confirmBtn = screen.getByRole('button', { name: /Finalizar Venda|Confirmar/i });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('should provide quick-cash buttons (+R$ 10, +R$ 20, +R$ 50, +R$ 100, Valor Exato)', () => {
    render(
      <PaymentModal
        isOpen={true}
        totalAmount={75.0}
        onClose={vi.fn()}
        onConfirmPayments={vi.fn()}
      />
    );

    // Cash tab
    const cashTab = screen.getByRole('button', { name: /Dinheiro/i });
    fireEvent.click(cashTab);

    const amountInput = screen.getByLabelText(/Valor a pagar|Valor do Pagamento|Valor recebido/i) as HTMLInputElement;

    // Check presence of quick cash buttons
    const exactBtn = screen.getByRole('button', { name: /Valor Exato/i });
    const plus10Btn = screen.getByRole('button', { name: /\+R\$\s*10$/i });
    const plus20Btn = screen.getByRole('button', { name: /\+R\$\s*20/i });
    const plus50Btn = screen.getByRole('button', { name: /\+R\$\s*50/i });
    const plus100Btn = screen.getByRole('button', { name: /\+R\$\s*100/i });

    expect(exactBtn).toBeDefined();
    expect(plus10Btn).toBeDefined();
    expect(plus20Btn).toBeDefined();
    expect(plus50Btn).toBeDefined();
    expect(plus100Btn).toBeDefined();

    // Clicking Valor Exato sets amount to remaining (75.00)
    fireEvent.click(exactBtn);
    expect(parseFloat(amountInput.value)).toBe(75);

    // Clicking +R$ 10 adds 10 to current amount
    fireEvent.click(plus10Btn);
    expect(parseFloat(amountInput.value)).toBe(85);

    // Clicking +R$ 20 adds 20
    fireEvent.click(plus20Btn);
    expect(parseFloat(amountInput.value)).toBe(105);
  });

  it('should allow splitting payments across multiple methods (e.g., R$ 50 in Dinheiro + R$ 30 in Cartão Débito)', async () => {
    const handleConfirm = vi.fn();
    render(
      <PaymentModal
        isOpen={true}
        totalAmount={80.0}
        onClose={vi.fn()}
        onConfirmPayments={handleConfirm}
      />
    );

    // 1. Dinheiro R$ 50
    fireEvent.click(screen.getByRole('button', { name: /Dinheiro/i }));
    const amountInput = screen.getByLabelText(/Valor a pagar|Valor do Pagamento|Valor recebido/i);
    fireEvent.change(amountInput, { target: { value: '50.00' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Pagamento|Adicionar/i }));

    // Remaining balance should show R$ 30,00
    expect(screen.getByText(/Falta|Saldo Restante/i)).toBeDefined();
    expect(screen.getAllByText(/30,00/).length).toBeGreaterThan(0);

    // 2. Cartão Débito R$ 30
    fireEvent.click(screen.getByRole('button', { name: /Cartão Débito|Débito/i }));
    // Input should suggest remaining balance 30.00 or we can type 30.00
    fireEvent.change(amountInput, { target: { value: '30.00' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Pagamento|Adicionar/i }));

    // Both payments should be listed
    expect(screen.getAllByTestId('payment-item')).toHaveLength(2);
    expect(screen.getAllByText(/DINHEIRO/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/DÉBITO|CARTAO_DEBITO/i).length).toBeGreaterThan(0);

    // Confirm button should be enabled
    const confirmBtn = screen.getByRole('button', { name: /Finalizar Venda|Confirmar/i });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    const passedPayments: PaymentItem[] = handleConfirm.mock.calls[0][0];
    expect(passedPayments).toHaveLength(2);
    expect(passedPayments[0]).toEqual({ method: 'DINHEIRO', amount: 50 });
    expect(passedPayments[1]).toEqual({ method: 'CARTAO_DEBITO', amount: 30 });
  });

  it('should disable finalization when totalPaid < totalAmount showing remaining balance', () => {
    render(
      <PaymentModal
        isOpen={true}
        totalAmount={100.0}
        onClose={vi.fn()}
        onConfirmPayments={vi.fn()}
      />
    );

    // Add partial payment of R$ 60 in Dinheiro
    fireEvent.click(screen.getByRole('button', { name: /Dinheiro/i }));
    const amountInput = screen.getByLabelText(/Valor a pagar|Valor do Pagamento|Valor recebido/i);
    fireEvent.change(amountInput, { target: { value: '60.00' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Pagamento|Adicionar/i }));

    // Should show remaining balance R$ 40,00
    expect(screen.getByText(/Falta|Saldo Restante/i)).toBeDefined();
    expect(screen.getAllByText(/40,00/).length).toBeGreaterThan(0);

    // Confirm button disabled
    const confirmBtn = screen.getByRole('button', { name: /Finalizar Venda|Confirmar/i });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('should display error alert and disable finalization when paying excess with Card/Pix (EXCESS_NON_CASH_PAYMENT)', () => {
    render(
      <PaymentModal
        isOpen={true}
        totalAmount={100.0}
        onClose={vi.fn()}
        onConfirmPayments={vi.fn()}
      />
    );

    // Add R$ 120 in Cartão Crédito
    fireEvent.click(screen.getByRole('button', { name: /Cartão Crédito|Crédito/i }));
    const amountInput = screen.getByLabelText(/Valor a pagar|Valor do Pagamento|Valor recebido/i);
    fireEvent.change(amountInput, { target: { value: '120.00' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Pagamento|Adicionar/i }));

    // Error alert with EXCESS_NON_CASH_PAYMENT
    expect(screen.getByText(/EXCESS_NON_CASH_PAYMENT/i)).toBeDefined();

    // Confirm button must be disabled
    const confirmBtn = screen.getByRole('button', { name: /Finalizar Venda|Confirmar/i });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('should generate dynamic Pix QR Code and copy-paste key with payment waiting indicator', async () => {
    // Mock navigator.clipboard
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <PaymentModal
        isOpen={true}
        totalAmount={45.0}
        onClose={vi.fn()}
        onConfirmPayments={vi.fn()}
      />
    );

    // Select PIX
    const pixTab = screen.getByRole('button', { name: /Pix/i });
    fireEvent.click(pixTab);

    // QR Code SVG
    expect(screen.getByTestId('pix-qrcode')).toBeDefined();

    // Waiting indicator
    expect(screen.getByText(/Aguardando confirmação|Aguardando pagamento/i)).toBeDefined();

    // Copy-paste key
    const copyBtn = screen.getByRole('button', { name: /Copiar Chave|Copiar Pix|Copiar/i });
    expect(copyBtn).toBeDefined();

    fireEvent.click(copyBtn);
    expect(writeTextMock).toHaveBeenCalled();
  });

  it('should allow removing an added payment item before finalization', () => {
    render(
      <PaymentModal
        isOpen={true}
        totalAmount={100.0}
        onClose={vi.fn()}
        onConfirmPayments={vi.fn()}
      />
    );

    // Add R$ 50 in Dinheiro
    fireEvent.click(screen.getByRole('button', { name: /Dinheiro/i }));
    const amountInput = screen.getByLabelText(/Valor a pagar|Valor do Pagamento|Valor recebido/i);
    fireEvent.change(amountInput, { target: { value: '50.00' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Pagamento|Adicionar/i }));

    expect(screen.getByTestId('payment-item')).toBeDefined();

    // Remove payment
    const removeBtn = screen.getByRole('button', { name: /Remover pagamento|Remover/i });
    fireEvent.click(removeBtn);

    // Payment should be gone
    expect(screen.queryByTestId('payment-item')).toBeNull();
    expect(screen.getByText(/Nenhum pagamento registrado/i)).toBeDefined();
    // Remaining balance back to 100
    expect(screen.getAllByText(/100,00/).length).toBeGreaterThan(0);
  });

  it('should call onConfirmPayments on valid completion', () => {
    const handleConfirm = vi.fn();
    render(
      <PaymentModal
        isOpen={true}
        totalAmount={50.0}
        onClose={vi.fn()}
        onConfirmPayments={handleConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Dinheiro/i }));
    const amountInput = screen.getByLabelText(/Valor a pagar|Valor do Pagamento|Valor recebido/i);
    fireEvent.change(amountInput, { target: { value: '50.00' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Pagamento|Adicionar/i }));

    const confirmBtn = screen.getByRole('button', { name: /Finalizar Venda|Confirmar/i });
    fireEvent.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledWith(
      [{ method: 'DINHEIRO', amount: 50 }],
      expect.objectContaining({ emitNfce: true })
    );
  });

  it('should close on Escape key', () => {
    const handleClose = vi.fn();
    render(
      <PaymentModal
        isOpen={true}
        totalAmount={50.0}
        onClose={handleClose}
        onConfirmPayments={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
