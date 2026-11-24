import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { KioskPage } from '../../src/pages/KioskPage';
import { kioskApi, searchProducts } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  kioskApi: {
    priceCheck: vi.fn(),
    issueQueueTicket: vi.fn(),
    listQueueTickets: vi.fn(),
    callQueueTicket: vi.fn(),
    completeQueueTicket: vi.fn(),
    createExpressPreSale: vi.fn(),
    listTerminals: vi.fn(),
    createTerminal: vi.fn(),
    getKpis: vi.fn(),
  },
  searchProducts: vi.fn(),
}));

describe('KioskPage (Totem de Autoatendimento, Busca-Preço & Pré-Venda)', () => {
  const originalAlert = window.alert;

  afterEach(() => {
    window.alert = originalAlert;
    cleanup();
  });

  const mockKpis = {
    total_tickets_today: 15,
    waiting_tickets: 3,
    avg_waiting_time_minutes: 4,
    express_presales_count: 8,
    express_presales_total: 320.5,
    price_queries_count: 42,
  };

  const mockPriceResult = {
    product_id: 101,
    name: 'Dipirona Sódica 500mg 10 comprimidos',
    ean: '7891234567890',
    active_ingredient: 'Dipirona Sódica',
    original_price: 12.0,
    club_member: true,
    discount_percentage: 15,
    discount_amount: 1.8,
    final_price: 10.2,
    pmc: 14.5,
    requires_prescription: false,
    generic_alternatives: [
      {
        id: 102,
        name: 'Dipirona EMS 500mg',
        price: 8.5,
        savings_percentage: 16.7,
      },
    ],
  };

  const mockQueue = [
    {
      id: 1,
      ticket_number: 'P-001',
      service_type: 'PREFERENCIAL' as const,
      customer_name: 'Dona Maria',
      status: 'WAITING' as const,
      created_at: '2026-11-23T10:00:00Z',
    },
    {
      id: 2,
      ticket_number: 'N-001',
      service_type: 'NORMAL' as const,
      customer_name: 'João Santos',
      status: 'WAITING' as const,
      created_at: '2026-11-23T10:05:00Z',
    },
  ];

  beforeEach(() => {
    window.alert = vi.fn();
    vi.clearAllMocks();

    vi.mocked(kioskApi.getKpis).mockResolvedValue(mockKpis);
    vi.mocked(kioskApi.listQueueTickets).mockResolvedValue(mockQueue);
  });

  it('1. Renderiza a tela de Totem no modo inicial de Consulta de Preço', async () => {
    render(<KioskPage />);

    expect(screen.getByText('FarmaCore Autoatendimento')).toBeDefined();
    expect(screen.getByTestId('mode-price-button')).toBeDefined();
    expect(screen.getByTestId('price-search-input')).toBeDefined();
    expect(screen.getByTestId('price-search-submit-button')).toBeDefined();
  });

  it('2. Realiza consulta de preço e exibe valor, desconto do clube e genéricos sugeridos', async () => {
    vi.mocked(kioskApi.priceCheck).mockResolvedValue(mockPriceResult);

    render(<KioskPage />);

    fireEvent.change(screen.getByTestId('price-search-input'), {
      target: { value: '7891234567890' },
    });
    fireEvent.change(screen.getByTestId('price-cpf-input'), {
      target: { value: '123.456.789-00' },
    });

    fireEvent.click(screen.getByTestId('price-search-submit-button'));

    await waitFor(() => {
      expect(kioskApi.priceCheck).toHaveBeenCalledWith('7891234567890', '123.456.789-00', 1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('queried-product-name').textContent).toContain('Dipirona Sódica');
      expect(screen.getByTestId('queried-final-price').textContent).toContain('10.20');
      expect(screen.getByText('Dipirona EMS 500mg')).toBeDefined();
      expect(screen.getByText('-16.7%')).toBeDefined();
    });
  });

  it('3. Emite senha de atendimento prioritário e exibe comprovante térmico', async () => {
    vi.mocked(kioskApi.issueQueueTicket).mockResolvedValue({
      ticket: {
        id: 10,
        ticket_number: 'P-002',
        service_type: 'PREFERENCIAL',
        status: 'WAITING',
        created_at: '2026-11-23T10:15:00Z',
      },
      receipt: 'FARMACORE\nSENHA: P-002\nPREFERENCIAL',
    });

    render(<KioskPage />);

    // Alterna para o modo de retirar senha
    fireEvent.click(screen.getByTestId('mode-queue-button'));

    expect(screen.getByTestId('ticket-preferential-button')).toBeDefined();
    fireEvent.click(screen.getByTestId('ticket-preferential-button'));

    await waitFor(() => {
      expect(kioskApi.issueQueueTicket).toHaveBeenCalledWith({
        store_id: 1,
        service_type: 'PREFERENCIAL',
        customer_name: undefined,
        customer_cpf: undefined,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('printed-ticket-receipt')).toBeDefined();
      expect(screen.getByTestId('printed-ticket-receipt').textContent).toContain('SENHA: P-002');
    });
  });

  it('4. Realiza fluxo de autoatendimento express (carrinho touch e emissão de pré-venda)', async () => {
    vi.mocked(searchProducts).mockResolvedValue([
      {
        id: 201,
        name: 'Vitamina C 1g Efervescente',
        ean: '78999990001',
        price: 18.5,
        stripe: 'SEM_TARJA',
        control_type: 'NONE',
      } as any,
    ]);

    vi.mocked(kioskApi.createExpressPreSale).mockResolvedValue({
      pre_sale_id: 99,
      ticket_receipt: 'RECIBO PRE-VENDA #99\nTOTAL: R$ 18.50',
      total_amount: 18.5,
      expires_at: '2026-11-23T12:00:00Z',
    });

    render(<KioskPage />);

    // Alterna para o modo Comprar Express
    fireEvent.click(screen.getByTestId('mode-self-order-button'));

    const searchInput = screen.getByTestId('catalog-search-input');
    fireEvent.change(searchInput, { target: { value: 'Vitamina' } });

    await waitFor(() => {
      expect(screen.getByText('Vitamina C 1g Efervescente')).toBeDefined();
    });

    // Adiciona ao carrinho
    const addBtn = screen.getByTestId('add-to-cart-201');
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByTestId('express-subtotal').textContent).toContain('18.50');
    });

    // Preenche CPF para desconto
    fireEvent.change(screen.getByTestId('order-cpf-input'), {
      target: { value: '111.222.333-44' },
    });

    // Emite ticket
    const checkoutBtn = screen.getByTestId('checkout-express-button');
    fireEvent.click(checkoutBtn);

    await waitFor(() => {
      expect(kioskApi.createExpressPreSale).toHaveBeenCalledWith({
        store_id: 1,
        customer_cpf: '111.222.333-44',
        items: [{ productId: 201, quantity: 1 }],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('printed-express-receipt')).toBeDefined();
      expect(screen.getByTestId('printed-express-receipt').textContent).toContain('RECIBO PRE-VENDA #99');
    });
  });

  it('5. Visualiza fila no painel de balcão e chama próxima senha', async () => {
    vi.mocked(kioskApi.callQueueTicket).mockResolvedValue({
      id: 1,
      ticket_number: 'P-001',
      status: 'CALLED',
      called_at: '2026-11-23T10:20:00Z',
      counter_station: 'Balcão Farmacêutico',
    });

    render(<KioskPage />);

    // Alterna para Painel Balcão
    fireEvent.click(screen.getByTestId('mode-call-panel-button'));

    await waitFor(() => {
      expect(screen.getByText('P-001')).toBeDefined();
      expect(screen.getByText('Dona Maria')).toBeDefined();
    });

    const callBtn = screen.getByTestId('call-ticket-1');
    fireEvent.click(callBtn);

    await waitFor(() => {
      expect(kioskApi.callQueueTicket).toHaveBeenCalledWith(1, 'Balcão Farmacêutico');
    });
  });
});
