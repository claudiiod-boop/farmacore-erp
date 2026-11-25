import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MarketplaceHubPage } from '../../src/pages/MarketplaceHubPage';
import { marketplaceApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  marketplaceApi: {
    getKpis: vi.fn(),
    getChannels: vi.fn(),
    getOrders: vi.fn(),
    getCatalog: vi.fn(),
    syncStock: vi.fn(),
    mapCatalog: vi.fn(),
    updateOrderStatus: vi.fn(),
    simulateWebhook: vi.fn(),
  },
}));

describe('MarketplaceHubPage', () => {
  afterEach(() => {
    cleanup();
  });

  const mockKpis = {
    totalOrders: 15,
    pendingOrders: 4,
    dispatchedOrders: 10,
    totalRevenue: 1250.8,
    activeChannelsCount: 3,
    ordersByChannel: [
      { channel: 'IFOOD' as const, count: 8, total: 640.0 },
      { channel: 'RAPPI' as const, count: 5, total: 420.0 },
      { channel: 'CONSULTA_REMEDIOS' as const, count: 2, total: 190.8 },
    ],
  };

  const mockChannels = [
    {
      id: 1,
      store_id: 1,
      channel_name: 'IFOOD' as const,
      merchant_id: 'IF-MERCH-01',
      api_key: 'key-123',
      api_secret: null,
      webhook_secret: null,
      commission_rate: 15.0,
      stock_buffer_percent: 10.0,
      auto_confirm_orders: 1,
      is_active: 1,
      created_at: '2026-11-25 09:00:00',
      updated_at: '2026-11-25 09:00:00',
    },
    {
      id: 2,
      store_id: 1,
      channel_name: 'RAPPI' as const,
      merchant_id: 'RAPPI-02',
      api_key: 'key-456',
      api_secret: null,
      webhook_secret: null,
      commission_rate: 12.0,
      stock_buffer_percent: 5.0,
      auto_confirm_orders: 0,
      is_active: 1,
      created_at: '2026-11-25 09:00:00',
      updated_at: '2026-11-25 09:00:00',
    },
  ];

  const mockOrders = [
    {
      id: 1,
      store_id: 1,
      channel_id: 1,
      channel_name: 'IFOOD' as const,
      external_order_id: 'IF-ORD-9001',
      display_order_id: '#9001',
      customer_name: 'Mariana Duarte',
      customer_document: null,
      customer_phone: '11999998888',
      delivery_address: 'Av. Paulista, 1000 - Apto 82',
      status: 'CONFIRMED' as const,
      subtotal: 60.0,
      delivery_fee: 5.9,
      platform_fee: 0,
      total_amount: 65.9,
      placed_at: '2026-11-25 09:10:00',
      confirmed_at: '2026-11-25 09:11:00',
      dispatched_at: null,
      delivered_at: null,
      cancellation_reason: null,
      created_at: '2026-11-25 09:10:00',
      updated_at: '2026-11-25 09:11:00',
      items: [
        {
          id: 1,
          order_id: 1,
          product_id: 1,
          external_sku: 'SKU-IF-1',
          product_name: 'Dipirona 500mg Gotas',
          quantity: 2,
          unit_price: 30.0,
          total_price: 60.0,
        },
      ],
    },
  ];

  const mockCatalog = [
    {
      id: 1,
      channel_id: 1,
      product_id: 1,
      external_sku: 'SKU-IF-1',
      markup_percent: 15.0,
      custom_price: null,
      is_synced: 1,
      last_stock_synced: 45,
      last_sync_at: '2026-11-25 09:00:00',
      created_at: '2026-11-25 09:00:00',
      updated_at: '2026-11-25 09:00:00',
      product_name: 'Dipirona 500mg Gotas',
      ean: '7891234567890',
      current_price: 20.0,
      calculated_price: 23.0,
      available_stock: 50,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (marketplaceApi.getKpis as any).mockResolvedValue(mockKpis);
    (marketplaceApi.getChannels as any).mockResolvedValue(mockChannels);
    (marketplaceApi.getOrders as any).mockResolvedValue(mockOrders);
    (marketplaceApi.getCatalog as any).mockResolvedValue(mockCatalog);
  });

  it('1. Renderiza os indicadores de marketplace e a listagem de pedidos em tempo real', async () => {
    render(<MarketplaceHubPage />);

    await waitFor(() => {
      expect(screen.getByText('IF-ORD-9001')).toBeDefined();
      expect(screen.getByText('Mariana Duarte')).toBeDefined();
      expect(screen.getByText('15')).toBeDefined();
      expect(screen.getByText('R$ 1250.80')).toBeDefined();
    });
  });

  it('2. Atualiza o status do pedido para Em Separação ao clicar em Separar', async () => {
    (marketplaceApi.updateOrderStatus as any).mockResolvedValue({
      ...mockOrders[0],
      status: 'PREPARING',
    });

    render(<MarketplaceHubPage />);

    await waitFor(() => {
      expect(screen.getByText('Separar')).toBeDefined();
    });

    const separateBtn = screen.getByText('Separar');
    fireEvent.click(separateBtn);

    await waitFor(() => {
      expect(marketplaceApi.updateOrderStatus).toHaveBeenCalledWith(1, 'PREPARING');
      expect(screen.getByText(/Status do pedido atualizado para PREPARING/)).toBeDefined();
    });
  });

  it('3. Alterna para a aba de Catálogo e dispara sincronização de estoque', async () => {
    (marketplaceApi.syncStock as any).mockResolvedValue({
      syncedCount: 1,
      items: [{ productId: 1, externalSku: 'SKU-IF-1', availableStock: 45, bufferDeducted: 5 }],
    });

    render(<MarketplaceHubPage />);

    await waitFor(() => {
      expect(screen.getByText('IF-ORD-9001')).toBeDefined();
    });

    const catalogTab = screen.getByRole('button', { name: /De-Para de Catálogo & Estoque/ });
    fireEvent.click(catalogTab);

    await waitFor(() => {
      expect(screen.getByText('Dipirona 500mg Gotas')).toBeDefined();
      expect(screen.getByText('SKU-IF-1')).toBeDefined();
      expect(screen.getByText('45 un')).toBeDefined();
    });

    const syncBtn = screen.getByRole('button', { name: /Sincronizar Estoque Agora/ });
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(marketplaceApi.syncStock).toHaveBeenCalledWith(1);
      expect(screen.getByText(/Estoque sincronizado com sucesso/)).toBeDefined();
    });
  });

  it('4. Abre modal de detalhes do pedido e fecha', async () => {
    render(<MarketplaceHubPage />);

    await waitFor(() => {
      expect(screen.getByText('Ver')).toBeDefined();
    });

    const viewBtn = screen.getByText('Ver');
    fireEvent.click(viewBtn);

    await waitFor(() => {
      expect(screen.getByText('DETALHES DO PEDIDO DE MARKETPLACE')).toBeDefined();
      expect(screen.getByText('Origem: IFOOD')).toBeDefined();
    });

    const closeBtn = screen.getByRole('button', { name: 'Fechar' });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('DETALHES DO PEDIDO DE MARKETPLACE')).toBeNull();
    });
  });
});
