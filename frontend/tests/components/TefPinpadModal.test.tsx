import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import TefPinpadModal from '../../src/components/tef/TefPinpadModal';
import { api } from '../../src/services/api';
import type { TefPayResult } from '../../src/types/tef';

describe('TefPinpadModal Component', () => {
  const mockApprovedResult: TefPayResult = {
    success: true,
    transactionUuid: 'uuid-tef-123',
    nsu: '123456',
    hostNsu: '987654',
    authorizationCode: 'AUT001',
    brandName: 'MASTERCARD',
    brandCodeSefaz: '02',
    acquirerName: 'REDE',
    acquirerCnpj: '01425787000104',
    cardLastFour: '4321',
    amount: 150.0,
    installments: 1,
    customerReceipt: '=== VIA DO CLIENTE ===\nMASTERCARD CREDITO\nR$ 150,00',
    merchantReceipt: '=== VIA DO ESTABELECIMENTO ===\nMASTERCARD CREDITO\nR$ 150,00',
    operationType: 'DEBITO',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should not render anything when isOpen is false', () => {
    render(
      <TefPinpadModal
        isOpen={false}
        onClose={vi.fn()}
        amount={150.0}
        onPaymentApproved={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should render modal with idle/config state when isOpen is true', () => {
    render(
      <TefPinpadModal
        isOpen={true}
        onClose={vi.fn()}
        amount={150.0}
        onPaymentApproved={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Pagamento TEF \/ PinPad/i)).toBeDefined();
    expect(screen.getByText(/R\$\s*150,00/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Débito/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Crédito/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Voucher/i })).toBeDefined();
    expect(screen.getByTestId('start-tef-button')).toBeDefined();
  });

  it('should allow selecting installments when operationType is CREDITO', () => {
    render(
      <TefPinpadModal
        isOpen={true}
        onClose={vi.fn()}
        amount={300.0}
        onPaymentApproved={vi.fn()}
      />
    );

    const creditBtn = screen.getByRole('button', { name: /Crédito/i });
    fireEvent.click(creditBtn);

    const installmentsSelect = screen.getByTestId('tef-installments-select');
    expect(installmentsSelect).toBeDefined();
    fireEvent.change(installmentsSelect, { target: { value: '3' } });
    expect((installmentsSelect as HTMLSelectElement).value).toBe('3');
  });

  it('should trigger pay API and advance through PinPad states to approved', async () => {
    const paySpy = vi.spyOn(api.tef, 'pay').mockResolvedValue(mockApprovedResult);
    const onApprovedMock = vi.fn();

    render(
      <TefPinpadModal
        isOpen={true}
        onClose={vi.fn()}
        amount={150.0}
        onPaymentApproved={onApprovedMock}
      />
    );

    const startBtn = screen.getByTestId('start-tef-button');
    fireEvent.click(startBtn);

    // PinPad state changes to processing/waiting
    expect(paySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 150.0,
        operationType: 'DEBITO',
      })
    );

    await waitFor(() => {
      expect(screen.getByText(/Transação Aprovada/i)).toBeDefined();
    });

    expect(screen.getByText(/123456/)).toBeDefined();
    expect(screen.getByText(/AUT001/)).toBeDefined();
    expect(screen.getByText(/MASTERCARD/i)).toBeDefined();

    // Confirm or finalize
    const confirmBtn = screen.getByTestId('confirm-approved-button');
    fireEvent.click(confirmBtn);

    expect(onApprovedMock).toHaveBeenCalledWith(mockApprovedResult);
  });

  it('should display error when payment is rejected', async () => {
    vi.spyOn(api.tef, 'pay').mockRejectedValue(new Error('Saldo Insuficiente no Cartão'));

    render(
      <TefPinpadModal
        isOpen={true}
        onClose={vi.fn()}
        amount={50.0}
        onPaymentApproved={vi.fn()}
      />
    );

    const startBtn = screen.getByTestId('start-tef-button');
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText(/Transação Recusada/i)).toBeDefined();
    });

    expect(screen.getByText(/Saldo Insuficiente no Cartão/i)).toBeDefined();
    expect(screen.getByTestId('retry-tef-button')).toBeDefined();
  });

  it('should close when Escape key is pressed in IDLE state', () => {
    const onCloseMock = vi.fn();
    render(
      <TefPinpadModal
        isOpen={true}
        onClose={onCloseMock}
        amount={100.0}
        onPaymentApproved={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
