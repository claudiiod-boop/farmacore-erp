import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CustomerReturnsPage } from '../../src/pages/CustomerReturnsPage';
import { returnsApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  returnsApi: {
    getKpis: vi.fn(),
    listReturns: vi.fn(),
    getEligibleItems: vi.fn(),
    createReturn: vi.fn(),
    approveReturn: vi.fn(),
    rejectReturn: vi.fn(),
    getFiscalSummary: vi.fn(),
    validateStoreCredit: vi.fn(),
    useStoreCredit: vi.fn(),
  },
}));

describe('CustomerReturnsPage (Devoluções, Trocas & Estorno Fiscal RDC 44/2009)', () => {
  const originalAlert = window.alert;

  afterEach(() => {
    window.alert = originalAlert;
    cleanup();
  });

  const mockKpis = {
    total_returns_month: 4,
    total_amount_returned_month: 320.50,
    active_store_credits_balance: 150.00,
    quarantined_items_count: 2,
    disposal_pgrss_items_count: 1,
  };

  const mockReturnsList = [
    {
      id: 1,
      store_id: 1,
      sale_id: 101,
      customer_id: 1,
      code: 'DEV-20261124-1234',
      return_type: 'RETURN' as const,
      refund_method: 'STORE_CREDIT' as const,
      total_amount: 55.00,
      reason: 'WRONG_ITEM',
      status: 'DRAFT' as const,
      cfop: '1.202',
      created_by: 'Operador Balcão',
      created_at: '2026-11-24T10:00:00Z',
      updated_at: '2026-11-24T10:00:00Z',
    },
  ];

  const mockEligibleSale = {
    saleId: 101,
    customerName: 'Maria Silva',
    customerCpf: '12345678900',
    totalAmount: 110.00,
    createdAt: '2026-11-24T09:00:00Z',
    items: [
      {
        saleItemId: 1,
        productId: 10,
        productName: 'Insulina NPH 100UI Termolábil',
        ean: '7891112223334',
        batchId: 5,
        batchNumber: 'L-INS-01',
        soldQuantity: 1,
        returnedQuantity: 0,
        availableQuantity: 1,
        unitPrice: 55.00,
        isThermolabile: true,
        requiresPharmacistAuth: false,
      },
    ],
  };

  beforeEach(() => {
    window.alert = vi.fn();
    vi.clearAllMocks();

    vi.mocked(returnsApi.getKpis).mockResolvedValue(mockKpis);
    vi.mocked(returnsApi.listReturns).mockResolvedValue(mockReturnsList);
    vi.mocked(returnsApi.getEligibleItems).mockResolvedValue(mockEligibleSale);
    vi.mocked(returnsApi.createReturn).mockResolvedValue({
      returnId: 2,
      code: 'DEV-20261124-9999',
      totalAmount: 55.00,
      status: 'DRAFT',
    });
    vi.mocked(returnsApi.approveReturn).mockResolvedValue({
      id: 1,
      store_id: 1,
      sale_id: 101,
      code: 'DEV-20261124-1234',
      return_type: 'RETURN',
      refund_method: 'STORE_CREDIT',
      total_amount: 55.00,
      reason: 'WRONG_ITEM',
      status: 'COMPLETED',
      cfop: '1.202',
      created_by: 'Operador Balcão',
      created_at: '2026-11-24T10:00:00Z',
      updated_at: '2026-11-24T10:00:00Z',
    });
    vi.mocked(returnsApi.validateStoreCredit).mockResolvedValue({
      valid: true,
      balance: 55.00,
      customerId: 1,
      expiresAt: '2027-02-24T00:00:00Z',
      status: 'ACTIVE',
    });
  });

  it('renders KPIs and search box on mount', async () => {
    render(<CustomerReturnsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('kpi-returns-count').textContent).toBe('4');
      expect(screen.getByTestId('kpi-returns-amount').textContent).toContain('320.50');
      expect(screen.getByTestId('kpi-credits-balance').textContent).toContain('150.00');
      expect(screen.getByTestId('kpi-quarantine-count').textContent).toContain('2 un');
      expect(screen.getByTestId('kpi-pgrss-count').textContent).toContain('1 un');
    });

    expect(screen.getByTestId('search-sale-input')).toBeDefined();
    expect(screen.getByTestId('search-sale-button')).toBeDefined();
  });

  it('searches for sale, displays thermolabile alert and submits return', async () => {
    render(<CustomerReturnsPage />);

    const searchInput = screen.getByTestId('search-sale-input');
    fireEvent.change(searchInput, { target: { value: '101' } });

    const searchBtn = screen.getByTestId('search-sale-button');
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(returnsApi.getEligibleItems).toHaveBeenCalledWith(101);
      expect(screen.getByText('Insulina NPH 100UI Termolábil')).toBeDefined();
      expect(screen.getByText('Termolábil (Frio)')).toBeDefined();
    });

    // Clica no checkbox para selecionar o item
    const rowItem = screen.getByTestId('row-eligible-item-1');
    const checkbox = rowItem.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByTestId('submit-return-button')).toBeDefined();
    });

    const submitBtn = screen.getByTestId('submit-return-button');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(returnsApi.createReturn).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: 1,
          saleId: 101,
          refundMethod: 'STORE_CREDIT',
          items: expect.arrayContaining([
            expect.objectContaining({
              saleItemId: 1,
              productId: 10,
              quantity: 1,
              destination: 'QUARANTINE', // Termolábil força Quarentena
            }),
          ]),
        })
      );
    });
  });

  it('navigates to history tab and approves a draft return', async () => {
    render(<CustomerReturnsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-history-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('tab-history-button'));

    await waitFor(() => {
      expect(screen.getByText('DEV-20261124-1234')).toBeDefined();
      expect(screen.getByTestId('approve-return-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('approve-return-1'));

    await waitFor(() => {
      expect(returnsApi.approveReturn).toHaveBeenCalledWith(1, expect.any(Object));
    });
  });

  it('validates store credit code in store credits tab', async () => {
    render(<CustomerReturnsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-store-credits-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('tab-store-credits-button'));

    const creditInput = screen.getByTestId('validate-credit-input');
    fireEvent.change(creditInput, { target: { value: 'CRED-ABC123XYZ' } });

    const validateBtn = screen.getByTestId('validate-credit-button');
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(returnsApi.validateStoreCredit).toHaveBeenCalledWith('CRED-ABC123XYZ');
      expect(screen.getByTestId('credit-balance-display').textContent).toContain('55.00');
      expect(screen.getByText('VALE ATIVO & APTO PARA USO')).toBeDefined();
    });
  });
});
