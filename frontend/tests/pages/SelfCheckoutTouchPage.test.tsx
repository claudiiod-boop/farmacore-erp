import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { SelfCheckoutTouchPage } from '../../src/pages/SelfCheckoutTouchPage';
import { selfCheckoutApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  selfCheckoutApi: {
    startSession: vi.fn(),
    scanItem: vi.fn(),
    removeItem: vi.fn(),
    initiatePayment: vi.fn(),
    finalizeSale: vi.fn(),
    getKpis: vi.fn()
  }
}));

describe('SelfCheckoutTouchPage Component', () => {
  const mockInitialSession = {
    id: 'sess-123',
    terminal_id: 'TOTEM-TOUCH-01',
    status: 'ACTIVE' as const,
    subtotal_amount: 0,
    discount_amount: 0,
    total_amount: 0,
    items: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const mockKpis = {
    total_sessions: 10,
    completed_sessions: 8,
    blocked_sessions: 2,
    total_amount_completed: 480.50
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selfCheckoutApi.startSession).mockResolvedValue({
      success: true,
      data: mockInitialSession
    });
    vi.mocked(selfCheckoutApi.getKpis).mockResolvedValue({
      success: true,
      data: mockKpis
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders totem header, initial session info, and empty cart state', async () => {
    render(<SelfCheckoutTouchPage />);

    expect(screen.getByText(/Totem Farmacêutico Touch/i)).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText(/Terminal Autônomo ID: TOTEM-TOUCH-01/i)).toBeDefined();
    });
    expect(screen.getByText(/Carrinho vazio no momento/i)).toBeDefined();
    expect(screen.getByTestId('scanner-barcode-input')).toBeDefined();
  });

  it('scans an OTC product successfully and updates cart and total', async () => {
    const updatedSession = {
      ...mockInitialSession,
      subtotal_amount: 19.90,
      total_amount: 19.90,
      items: [
        {
          id: 'item-1',
          session_id: 'sess-123',
          product_id: 'prod-1',
          product_name: 'Dipirona Monoidratada 500mg c/ 20 Comprimidos',
          barcode: '7891058001234',
          quantity: 1,
          unit_price: 19.90,
          total_price: 19.90,
          created_at: new Date().toISOString()
        }
      ]
    };

    vi.mocked(selfCheckoutApi.scanItem).mockResolvedValue({
      success: true,
      data: {
        status: 'SUCCESS',
        session: updatedSession
      }
    });

    render(<SelfCheckoutTouchPage />);

    await waitFor(() => {
      expect(screen.getByTestId('scanner-barcode-input')).toBeDefined();
    });

    const input = screen.getByTestId('scanner-barcode-input');
    fireEvent.change(input, { target: { value: '7891058001234' } });
    fireEvent.click(screen.getByTestId('btn-scan-submit'));

    await waitFor(() => {
      expect(selfCheckoutApi.scanItem).toHaveBeenCalledWith('sess-123', '7891058001234', 1);
      expect(screen.getByText('Dipirona Monoidratada 500mg c/ 20 Comprimidos')).toBeDefined();
      expect(screen.getByTestId('session-total-amount').textContent).toContain('19,90');
    });
  });

  it('displays regulatory warning and queue ticket when scanning a prescription drug', async () => {
    vi.mocked(selfCheckoutApi.scanItem).mockResolvedValue({
      success: true,
      data: {
        status: 'BLOCKED_REQUIRES_PHARMACIST',
        message: 'Medicamento Amoxicilina 500mg exige retenção de receita médica por farmacêutico.',
        queueTicketNumber: 'FARMA-042'
      }
    });

    render(<SelfCheckoutTouchPage />);

    await waitFor(() => {
      expect(screen.getByTestId('scanner-barcode-input')).toBeDefined();
    });

    const input = screen.getByTestId('scanner-barcode-input');
    fireEvent.change(input, { target: { value: '7891058009999' } });
    fireEvent.click(screen.getByTestId('btn-scan-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-regulatory-block')).toBeDefined();
      expect(screen.getByTestId('queue-ticket-display').textContent).toBe('FARMA-042');
      expect(screen.getByText(/Medicamento Amoxicilina 500mg exige retenção/i)).toBeDefined();
    });

    // Dismiss warning
    fireEvent.click(screen.getByTestId('btn-dismiss-warning'));
    expect(screen.queryByTestId('alert-regulatory-block')).toBeNull();
  });

  it('completes dynamic PIX payment flow and displays NFC-e access key', async () => {
    const sessionWithItems = {
      ...mockInitialSession,
      total_amount: 35.50,
      items: [
        {
          id: 'item-1',
          session_id: 'sess-123',
          product_id: 'prod-1',
          product_name: 'Vitamina C 1g Efervescente',
          barcode: '7891058005555',
          quantity: 1,
          unit_price: 35.50,
          total_price: 35.50,
          created_at: new Date().toISOString()
        }
      ]
    };

    vi.mocked(selfCheckoutApi.startSession).mockResolvedValue({
      success: true,
      data: sessionWithItems
    });

    vi.mocked(selfCheckoutApi.initiatePayment).mockResolvedValue({
      success: true,
      data: {
        method: 'PIX',
        amount: 35.50,
        pixQrCode: '00020126580014br.gov.bcb.pix...',
        pixCopyPaste: '00020126580014br.gov.bcb.pix2536farmacore-pix-key520400005303986540535.505802BR'
      }
    });

    vi.mocked(selfCheckoutApi.finalizeSale).mockResolvedValue({
      success: true,
      data: {
        saleId: 'sale-abc-123',
        nfceKey: '35261112345678000199650010000001231009876543',
        total: 35.50,
        paymentMethod: 'PIX',
        receiptHtml: '<div>Recibo</div>'
      }
    });

    render(<SelfCheckoutTouchPage />);

    // Abrir pagamento PIX
    await waitFor(() => {
      expect(screen.getByTestId('btn-pay-pix')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('btn-pay-pix'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-payment')).toBeDefined();
      expect(screen.getByTestId('pix-qrcode-image')).toBeDefined();
      expect(screen.getByTestId('pix-copy-paste').textContent).toContain('00020126580014br.gov.bcb.pix');
    });

    // Confirmar pagamento
    fireEvent.click(screen.getByTestId('btn-confirm-payment-success'));

    await waitFor(() => {
      expect(screen.getByTestId('screen-sale-success')).toBeDefined();
      expect(screen.getByTestId('nfce-access-key-display').textContent).toBe('35261112345678000199650010000001231009876543');
    });
  });
});
