import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import PbmReceiptModal from '../../src/components/pbm/PbmReceiptModal';
import { api } from '../../src/services/api';
import type { PbmReceiptResult } from '../../src/types';

describe('PbmReceiptModal Component', () => {
  const mockReceipt: PbmReceiptResult = {
    consumerCopy: '=== 1a VIA: CONSUMIDOR ===\nFARMACIA POPULAR DO BRASIL\nTotal: R$ 40,00',
    storeCopy: '=== 2a VIA: ESTABELECIMENTO ===\nGUARDA POR 5 ANOS (DENASUS)\nAssinatura: ______________',
    fullEscPos: 'FULL ESC POS RECEIPT DATA',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should not render anything when isOpen is false', () => {
    render(<PbmReceiptModal isOpen={false} onClose={vi.fn()} receiptData={mockReceipt} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should render modal with receipt tabs and formatted monospaced content', () => {
    render(<PbmReceiptModal isOpen={true} onClose={vi.fn()} receiptData={mockReceipt} protocol="FP-123" />);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getAllByText(/Cupom Vinculado/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/FP-123/i)).toBeDefined();

    // Default tab is 1ª Via (Consumidor)
    expect(screen.getByText(/=== 1a VIA: CONSUMIDOR ===/i)).toBeDefined();

    // Switch to 2ª Via (Estabelecimento - 5 Anos)
    const storeTab = screen.getByRole('button', { name: /2ª Via/i });
    fireEvent.click(storeTab);

    expect(screen.getByText(/=== 2a VIA: ESTABELECIMENTO ===/i)).toBeDefined();
  });

  it('should fetch receipt from API if protocol is provided and receiptData is omitted', async () => {
    const couponSpy = vi.spyOn(api.pbm, 'getCoupon').mockResolvedValue(mockReceipt);

    render(<PbmReceiptModal isOpen={true} onClose={vi.fn()} protocol="FP-PROT-999" />);

    await waitFor(() => {
      expect(couponSpy).toHaveBeenCalledWith('FP-PROT-999');
    });

    await waitFor(() => {
      expect(screen.getByText(/=== 1a VIA: CONSUMIDOR ===/i)).toBeDefined();
    });
  });

  it('should close when Escape key is pressed', () => {
    const onCloseMock = vi.fn();
    render(<PbmReceiptModal isOpen={true} onClose={onCloseMock} receiptData={mockReceipt} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
