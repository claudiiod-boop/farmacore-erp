import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SmartReplenishmentPage } from '../../src/pages/SmartReplenishmentPage';
import { replenishmentApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  replenishmentApi: {
    getKpis: vi.fn(),
    getPurchaseSuggestions: vi.fn(),
    createOrder: vi.fn(),
    listOrders: vi.fn(),
    getOrder: vi.fn(),
    updateOrderStatus: vi.fn(),
  },
}));

describe('SmartReplenishmentPage (Reposição Inteligente de Estoque & Ponto de Pedido)', () => {
  const originalAlert = window.alert;

  afterEach(() => {
    window.alert = originalAlert;
    cleanup();
  });

  const mockKpis = {
    total_suggestions: 3,
    out_of_stock_count: 1,
    critical_count: 1,
    reorder_needed_count: 1,
    total_estimated_cost: 1250.50,
  };

  const mockSuggestions = [
    {
      productId: 1,
      productName: 'Dipirona 500mg 20 comprimidos',
      ean: '7891234567890',
      abcClass: 'A' as const,
      dailyDemand: 12.5,
      currentStock: 0,
      leadTimeDays: 2,
      safetyStock: 25,
      reorderPoint: 50,
      daysOfCover: 0,
      suggestedQuantity: 100,
      unitCost: 5.50,
      estimatedCost: 550.00,
      status: 'OUT_OF_STOCK' as const,
      urgencyPriority: 100,
    },
    {
      productId: 2,
      productName: 'Amoxicilina 500mg 21 cápsulas',
      ean: '7899876543210',
      abcClass: 'B' as const,
      dailyDemand: 4.0,
      currentStock: 6,
      leadTimeDays: 3,
      safetyStock: 12,
      reorderPoint: 24,
      daysOfCover: 1.5,
      suggestedQuantity: 40,
      unitCost: 17.50,
      estimatedCost: 700.50,
      status: 'CRITICAL' as const,
      urgencyPriority: 80,
    },
  ];

  const mockOrders = [
    {
      id: 1,
      store_id: 1,
      distributor_name: 'Panpharma Distribuidora',
      status: 'DRAFT',
      total_items: 2,
      estimated_total: 1250.50,
      created_at: '2026-11-24T10:00:00Z',
      items: [
        {
          id: 1,
          order_id: 1,
          product_id: 1,
          order_quantity: 100,
          unit_cost: 5.50,
          total_cost: 550.00,
        },
      ],
    },
  ];

  beforeEach(() => {
    window.alert = vi.fn();
    vi.clearAllMocks();

    vi.mocked(replenishmentApi.getKpis).mockResolvedValue(mockKpis);
    vi.mocked(replenishmentApi.getPurchaseSuggestions).mockResolvedValue(mockSuggestions);
    vi.mocked(replenishmentApi.listOrders).mockResolvedValue(mockOrders);
    vi.mocked(replenishmentApi.createOrder).mockResolvedValue({ orderId: 2, status: 'DRAFT' });
    vi.mocked(replenishmentApi.updateOrderStatus).mockResolvedValue({ success: true, status: 'SUBMITTED' });
  });

  it('renders KPIs and suggestions table on mount', async () => {
    render(<SmartReplenishmentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('kpi-out-of-stock').textContent).toBe('1');
      expect(screen.getByTestId('kpi-critical').textContent).toBe('1');
      expect(screen.getByTestId('kpi-reorder-needed').textContent).toBe('1');
      expect(screen.getByTestId('kpi-total-suggestions').textContent).toBe('3');
      expect(screen.getByTestId('kpi-estimated-cost').textContent).toContain('1250.50');
    });

    expect(screen.getByText('Dipirona 500mg 20 comprimidos')).toBeDefined();
    expect(screen.getByText('Amoxicilina 500mg 21 cápsulas')).toBeDefined();
    expect(screen.getByText('Curva A')).toBeDefined();
    expect(screen.getByText('Curva B')).toBeDefined();
  });

  it('allows selecting items and generating a replenishment order', async () => {
    render(<SmartReplenishmentPage />);

    await waitFor(() => {
      expect(screen.getByText('Dipirona 500mg 20 comprimidos')).toBeDefined();
    });

    const rowDipirona = screen.getByTestId('row-suggestion-1');
    fireEvent.click(rowDipirona);

    const distributorInput = screen.getByTestId('distributor-name-input');
    fireEvent.change(distributorInput, { target: { value: 'SantaCruz Distribuidora' } });

    const generateBtn = screen.getByTestId('generate-order-button');
    expect(generateBtn.getAttribute('disabled')).toBeNull();

    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(replenishmentApi.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: 1,
          distributorName: 'SantaCruz Distribuidora',
          items: expect.arrayContaining([
            expect.objectContaining({
              productId: 1,
              orderQuantity: 100,
            }),
          ]),
        })
      );
    });
  });

  it('allows switching to orders tab and updating order status', async () => {
    render(<SmartReplenishmentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-orders-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('tab-orders-button'));

    await waitFor(() => {
      expect(screen.getByText('Panpharma Distribuidora')).toBeDefined();
      expect(screen.getByTestId('submit-order-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('submit-order-1'));

    await waitFor(() => {
      expect(replenishmentApi.updateOrderStatus).toHaveBeenCalledWith(1, 'SUBMITTED');
    });
  });

  it('filters suggestions by status when selector changes', async () => {
    render(<SmartReplenishmentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('filter-status-select')).toBeDefined();
    });

    fireEvent.change(screen.getByTestId('filter-status-select'), {
      target: { value: 'OUT_OF_STOCK' },
    });

    await waitFor(() => {
      expect(replenishmentApi.getPurchaseSuggestions).toHaveBeenCalledWith(1, 30, 'OUT_OF_STOCK');
    });
  });
});
