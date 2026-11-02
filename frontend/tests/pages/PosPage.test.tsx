import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act, within } from '@testing-library/react';
import PosPage from '../../src/pages/PosPage';
import {
  api,
  CashSession,
  CashSessionSummary,
  PreSaleDetails,
  Product,
  Batch,
  Sale,
  CheckoutResponse,
  CashMovement,
} from '../../src/services/api';

describe('PosPage Integration & Cashier Shift Lifecycle', () => {
  const mockClosedSession: CashSession | null = null;

  const mockOpenSession: CashSession = {
    id: 1,
    operatorName: 'Carlos Operador',
    initialCash: 100.0,
    currentCash: 100.0,
    status: 'OPEN',
    openedAt: '2026-11-02T08:00:00.000Z',
    closedAt: null,
  };

  const mockPreSaleDetails: PreSaleDetails = {
    preSale: {
      id: 8801,
      code: 'PV-8801',
      status: 'OPEN',
      customerName: 'João Silva',
      customerCpf: '123.456.789-00',
      totalAmount: 25.0,
      createdAt: '2026-11-02T09:00:00.000Z',
    },
    items: [
      {
        id: 1,
        preSaleId: 8801,
        productId: 10,
        productName: 'Dipirona 500mg Gotas',
        batchId: 101,
        batchNumber: 'LOTE-DIP-01',
        quantity: 2,
        unitPrice: 12.5,
        totalPrice: 25.0,
      },
    ],
    prescription: null,
  };

  const mockShampooProduct: Product = {
    id: 50,
    ean: '7891234567890',
    name: 'Shampoo Anticaspa 200ml',
    activeIngredient: 'Cetoconazol 2%',
    msRegistration: 'ISENTO',
    stripe: 'SEM_TARJA',
    controlType: 'ISENTO',
    price: 25.0,
    pmc: 30.0,
    pf: 20.0,
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
  };

  const mockShampooBatches: Batch[] = [
    {
      id: 501,
      productId: 50,
      batchNumber: 'LOTE-SHA-01',
      manufacturingDate: '2025-01-01T00:00:00.000Z',
      expirationDate: '2027-12-31T00:00:00.000Z',
      quantity: 20,
      reservedQuantity: 0,
      availableQuantity: 20,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ];

  const mockCompletedSale: Sale = {
    id: 1,
    cashSessionId: 1,
    status: 'COMPLETED',
    totalAmount: 50.0,
    discountAmount: 0,
    changeAmount: 0,
    createdAt: '2026-11-02T10:00:00.000Z',
    operatorName: 'Carlos Operador',
    cashierName: 'Carlos Operador',
    items: [
      {
        id: 1,
        saleId: 1,
        productId: 10,
        productName: 'Dipirona 500mg Gotas',
        batchId: 101,
        batchNumber: 'LOTE-DIP-01',
        quantity: 2,
        unitPrice: 12.5,
        totalPrice: 25.0,
      },
      {
        id: 2,
        saleId: 1,
        productId: 50,
        productName: 'Shampoo Anticaspa 200ml',
        batchId: 501,
        batchNumber: 'LOTE-SHA-01',
        quantity: 1,
        unitPrice: 25.0,
        totalPrice: 25.0,
      },
    ],
    payments: [
      {
        id: 1,
        saleId: 1,
        method: 'DINHEIRO',
        amount: 25.0,
        createdAt: '2026-11-02T10:00:00.000Z',
      },
      {
        id: 2,
        saleId: 1,
        method: 'CARTAO_CREDITO',
        amount: 25.0,
        createdAt: '2026-11-02T10:00:00.000Z',
      },
    ],
  };

  const mockCheckoutResponse: CheckoutResponse = {
    sale: mockCompletedSale,
    receiptText: '--- FARMACORE CUPOM FISCAL ---\nVENDA #VENDA-00001\nTOTAL: R$ 50,00',
  };

  const mockSangriaMovement: CashMovement = {
    id: 10,
    cashSessionId: 1,
    type: 'SANGRIA',
    amount: 50.0,
    reason: 'Sangria de segurança',
    operatorName: 'Carlos Operador',
    createdAt: '2026-11-02T11:00:00.000Z',
  };

  const mockClosedSummary: CashSessionSummary = {
    session: {
      ...mockOpenSession,
      currentCash: 75.0,
      status: 'CLOSED',
      closedAt: '2026-11-02T12:00:00.000Z',
    },
    totalSalesCount: 1,
    totalSalesAmount: 50.0,
    totalsByMethod: {
      DINHEIRO: 25.0,
      CARTAO_CREDITO: 25.0,
      CARTAO_DEBITO: 0,
      PIX: 0,
    },
    totalSupplies: 0,
    totalSangrias: 50.0,
    expectedCash: 75.0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'print').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('executes full cashier shift lifecycle from open session to close session', async () => {
    // 1. Initially closed session
    vi.spyOn(api, 'getCurrentSession').mockResolvedValueOnce(mockClosedSession);
    const openSessionSpy = vi.spyOn(api, 'openCashSession').mockResolvedValue({
      ...mockOpenSession,
    });
    vi.spyOn(api, 'getPreSaleByCode').mockResolvedValue(mockPreSaleDetails);
    vi.spyOn(api, 'getProductByEan').mockResolvedValue(mockShampooProduct);
    vi.spyOn(api, 'getAvailableBatches').mockResolvedValue(mockShampooBatches);
    const checkoutSpy = vi.spyOn(api, 'checkoutSale').mockResolvedValue(mockCheckoutResponse);
    const movementSpy = vi.spyOn(api, 'registerCashMovement').mockResolvedValue(mockSangriaMovement);
    const summarySpy = vi.spyOn(api, 'getSessionSummary').mockResolvedValue({
      session: {
        ...mockOpenSession,
        currentCash: 125.0,
      },
      totalSalesCount: 1,
      totalSalesAmount: 50.0,
      totalsByMethod: {
        DINHEIRO: 25.0,
        CARTAO_CREDITO: 25.0,
        CARTAO_DEBITO: 0,
        PIX: 0,
      },
      totalSupplies: 0,
      totalSangrias: 50.0,
      expectedCash: 75.0,
    });
    const closeSpy = vi.spyOn(api, 'closeCashSession').mockResolvedValue(mockClosedSummary);

    render(<PosPage />);

    // Step 1: Prompts operator to open session if closed
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Caixa Fechado/i })).toBeDefined();
    });

    const openBtn = screen.getByRole('button', { name: /Abrir Caixa \[F10\]/i });
    fireEvent.click(openBtn);

    // Modal de abertura de caixa
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    const sessionDialog = screen.getByRole('dialog');
    fireEvent.change(within(sessionDialog).getByLabelText(/Nome do Operador/i), {
      target: { value: 'Carlos Operador' },
    });
    fireEvent.change(within(sessionDialog).getByLabelText(/Fundo de Troco/i), {
      target: { value: '100.00' },
    });

    const submitOpenBtn = within(sessionDialog).getByRole('button', { name: /Abrir Caixa/i });
    await act(async () => {
      fireEvent.click(submitOpenBtn);
    });

    expect(openSessionSpy).toHaveBeenCalledWith('Carlos Operador', 100);

    // Session is now open
    await waitFor(() => {
      expect(screen.getByText(/Carlos Operador/i)).toBeDefined();
      expect(screen.getByText(/CAIXA ABERTO/i)).toBeDefined();
    });

    // Step 2: Rescues pre-sale #PV-8801 via [F5] shortcut and populates grid
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Resgatar Pré-Venda/i })).toBeDefined();
    });

    const preSaleInput = screen.getByLabelText(/Código da Pré-Venda/i);
    fireEvent.change(preSaleInput, { target: { value: '#PV-8801' } });

    const lookupBtn = screen.getByRole('button', { name: /Buscar Pré-Venda/i });
    await act(async () => {
      fireEvent.click(lookupBtn);
    });

    // Pre-sale item should now be in the grid
    await waitFor(() => {
      expect(screen.getByText(/Dipirona 500mg Gotas/i)).toBeDefined();
      expect(screen.getAllByText(/PV-8801/i).length).toBeGreaterThan(0);
    });

    // Step 3: Scans direct OTC convenience item (shampoo EAN) and appends to grid
    const barcodeInput = screen.getByPlaceholderText(/Bipar código de barras/i);
    fireEvent.change(barcodeInput, { target: { value: '7891234567890' } });

    const biparBtn = screen.getByRole('button', { name: /Bipar Item/i });
    await act(async () => {
      fireEvent.click(biparBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Shampoo Anticaspa 200ml/i)).toBeDefined();
      expect(screen.getAllByText(/R\$\s*50,00/i).length).toBeGreaterThan(0);
    });

    // Step 4: Opens payment modal with [F8], splits cash + card, and submits checkout
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F8', bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Recebimento \/ Pagamento PDV/i })).toBeDefined();
    });

    // Add R$ 25.00 Dinheiro
    const paymentAmountInput = screen.getByPlaceholderText('0,00');
    fireEvent.change(paymentAmountInput, { target: { value: '25.00' } });
    const addPaymentBtn = screen.getByRole('button', { name: /Adicionar Pagamento/i });
    fireEvent.click(addPaymentBtn);

    // Add remaining R$ 25.00 Cartão Crédito
    const creditBtn = screen.getByRole('button', { name: /Cartão Crédito/i });
    fireEvent.click(creditBtn);
    fireEvent.change(paymentAmountInput, { target: { value: '25.00' } });
    fireEvent.click(addPaymentBtn);

    // Finalize payment
    const finalizeSaleBtn = screen.getByRole('button', { name: /Finalizar Venda/i });
    await act(async () => {
      fireEvent.click(finalizeSaleBtn);
    });

    expect(checkoutSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cashSessionId: 1,
        preSaleCode: 'PV-8801',
        additionalItems: [
          {
            productId: 50,
            batchId: 501,
            quantity: 1,
          },
        ],
        payments: [
          { method: 'DINHEIRO', amount: 25 },
          { method: 'CARTAO_CREDITO', amount: 25 },
        ],
      })
    );

    // Step 5: Displays thermal sale receipt #VENDA-00001 with print and close options
    await waitFor(() => {
      expect(screen.getAllByText(/#VENDA-00001/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Venda Concluída com Sucesso!/i)).toBeDefined();
    });

    // Print button triggers print
    const printBtn = screen.getByRole('button', { name: /Imprimir Cupom/i });
    fireEvent.click(printBtn);
    expect(window.print).toHaveBeenCalled();

    // Step 6: Clears grid on completion and returns to ready state for next customer
    const newSaleBtn = screen.getByRole('button', { name: /Nova Venda/i });
    fireEvent.click(newSaleBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Venda Concluída com Sucesso!/i)).toBeNull();
      expect(screen.queryByText(/Dipirona 500mg Gotas/i)).toBeNull();
      expect(screen.queryByText(/Shampoo Anticaspa 200ml/i)).toBeNull();
    });

    // Step 7: Performs Sangria via [F10] and updates drawer cash
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Movimentação de Caixa/i })).toBeDefined();
    });

    const movAmountInput = screen.getByLabelText(/Valor da Movimentação/i);
    const movReasonInput = screen.getByLabelText(/Motivo \/ Justificativa/i);

    fireEvent.change(movAmountInput, { target: { value: '50.00' } });
    fireEvent.change(movReasonInput, { target: { value: 'Sangria de segurança' } });

    const confirmMovBtn = screen.getByRole('button', { name: /Confirmar Movimentação/i });
    await act(async () => {
      fireEvent.click(confirmMovBtn);
    });

    expect(movementSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        type: 'SANGRIA',
        amount: 50,
        reason: 'Sangria de segurança',
        operatorName: 'Carlos Operador',
      })
    );

    // Step 8: Closes session via [F12], verifying summary
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12', bubbles: true }));
    });

    await waitFor(() => {
      expect(summarySpy).toHaveBeenCalledWith(1);
      expect(screen.getByRole('heading', { name: /Fechamento de Caixa/i })).toBeDefined();
      expect(screen.getByText(/Dinheiro Esperado na Gaveta/i)).toBeDefined();
    });

    const confirmCloseBtn = screen.getByRole('button', { name: /Confirmar Fechamento/i });
    await act(async () => {
      fireEvent.click(confirmCloseBtn);
    });

    expect(closeSpy).toHaveBeenCalledWith(1);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Caixa Fechado/i })).toBeDefined();
    });
  });

  it('displays empty cart notice when pressing [F8] without items and prevents payment modal', async () => {
    vi.spyOn(api, 'getCurrentSession').mockResolvedValue(mockOpenSession);

    render(<PosPage />);

    await waitFor(() => {
      expect(screen.getByText(/CAIXA ABERTO/i)).toBeDefined();
    });

    // Press F8 with empty cart
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F8', bubbles: true }));
    });

    // Should not open payment modal
    expect(screen.queryByRole('heading', { name: /Recebimento \/ Pagamento PDV/i })).toBeNull();
    // Should display notice/error about empty cart
    expect(screen.getByText(/carrinho está vazio/i)).toBeDefined();
  });

  it('disallows opening F12 close session when items are in cart', async () => {
    vi.spyOn(api, 'getCurrentSession').mockResolvedValue(mockOpenSession);
    vi.spyOn(api, 'getPreSaleByCode').mockResolvedValue(mockPreSaleDetails);
    const summarySpy = vi.spyOn(api, 'getSessionSummary');

    render(<PosPage />);

    await waitFor(() => {
      expect(screen.getByText(/CAIXA ABERTO/i)).toBeDefined();
    });

    // Load pre-sale into cart
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Resgatar Pré-Venda/i })).toBeDefined();
    });

    const preSaleInput = screen.getByLabelText(/Código da Pré-Venda/i);
    fireEvent.change(preSaleInput, { target: { value: 'PV-8801' } });
    const lookupBtn = screen.getByRole('button', { name: /Buscar Pré-Venda/i });
    await act(async () => {
      fireEvent.click(lookupBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Dipirona 500mg Gotas/i)).toBeDefined();
    });

    // Try F12 with items in cart
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12', bubbles: true }));
    });

    // Summary should NOT be fetched and modal should NOT open
    expect(summarySpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: /Fechamento de Caixa/i })).toBeNull();
    expect(screen.getByText(/Não é possível fechar o caixa com itens/i)).toBeDefined();
  });

  it('clears cart and pre-sale on [Escape] when no modal is open', async () => {
    vi.spyOn(api, 'getCurrentSession').mockResolvedValue(mockOpenSession);
    vi.spyOn(api, 'getPreSaleByCode').mockResolvedValue(mockPreSaleDetails);

    render(<PosPage />);

    await waitFor(() => {
      expect(screen.getByText(/CAIXA ABERTO/i)).toBeDefined();
    });

    // Load pre-sale
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Resgatar Pré-Venda/i })).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText(/Código da Pré-Venda/i), {
      target: { value: 'PV-8801' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Buscar Pré-Venda/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Dipirona 500mg Gotas/i)).toBeDefined();
    });

    // Press Escape
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.queryByText(/Dipirona 500mg Gotas/i)).toBeNull();
      expect(screen.getByText(/Venda cancelada/i)).toBeDefined();
    });
  });
});
