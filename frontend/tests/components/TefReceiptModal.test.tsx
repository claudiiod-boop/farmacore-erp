import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import TefReceiptModal from '../../src/components/tef/TefReceiptModal';
import { api } from '../../src/services/api';
import type { TefReceiptResult } from '../../src/types/tef';

describe('TefReceiptModal Component', () => {
  const mockReceipt: TefReceiptResult = {
    customerReceipt: '=== VIA DO CLIENTE ===\nCIELO MASTERCARD CREDITO\nR$ 120,00',
    merchantReceipt: '=== VIA DO ESTABELECIMENTO ===\nCONTROLE INTERNO TEF\nDOC/NSU: 654321',
    fullEscPos: 'FULL ESC POS TEF RECEIPT',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should not render anything when isOpen is false', () => {
    render(<TefReceiptModal isOpen={false} onClose={vi.fn()} receiptData={mockReceipt} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should render modal with receipt tabs and formatted monospaced content', () => {
    render(
      <TefReceiptModal
        isOpen={true}
        onClose={vi.fn()}
        receiptData={mockReceipt}
        nsu="654321"
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Comprovante de Pagamento TEF/i)).toBeDefined();
    expect(screen.getByText(/654321/i)).toBeDefined();

    // Default tab is 1ª Via — Cliente
    expect(screen.getByText(/=== VIA DO CLIENTE ===/i)).toBeDefined();

    // Switch to 2ª Via — Estabelecimento
    const merchantTab = screen.getByRole('button', { name: /2ª Via/i });
    fireEvent.click(merchantTab);

    expect(screen.getByText(/=== VIA DO ESTABELECIMENTO ===/i)).toBeDefined();
  });

  it('should fetch receipt from API if nsu is provided and receiptData is omitted', async () => {
    const receiptSpy = vi.spyOn(api.tef, 'getReceipt').mockResolvedValue(mockReceipt);

    render(<TefReceiptModal isOpen={true} onClose={vi.fn()} nsu="999888" />);

    await waitFor(() => {
      expect(receiptSpy).toHaveBeenCalledWith('999888');
    });

    await waitFor(() => {
      expect(screen.getByText(/=== VIA DO CLIENTE ===/i)).toBeDefined();
    });
  });

  it('should close when Escape key is pressed', () => {
    const onCloseMock = vi.fn();
    render(<TefReceiptModal isOpen={true} onClose={onCloseMock} receiptData={mockReceipt} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
