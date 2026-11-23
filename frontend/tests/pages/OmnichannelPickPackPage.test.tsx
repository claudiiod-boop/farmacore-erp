import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { OmnichannelPickPackPage } from '../../src/pages/OmnichannelPickPackPage';
import { omnichannelApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  omnichannelApi: {
    listOrders: vi.fn(),
    getOrder: vi.fn(),
    startPicking: vi.fn(),
    scanBarcode: vi.fn(),
    dispatchOrder: vi.fn(),
    listChannels: vi.fn(),
    saveChannel: vi.fn(),
    listConversations: vi.fn(),
    getConversationMessages: vi.fn(),
    replyConversation: vi.fn(),
  },
}));

describe('OmnichannelPickPackPage (Hub Omnichannel & Atendimento WhatsApp)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(omnichannelApi.listOrders).mockResolvedValue([
      {
        id: 1,
        store_id: 1,
        channel_id: 1,
        channel_order_code: 'WPP-202611-0001',
        customer_name: 'Juliana Costa',
        customer_phone: '5511998765432',
        delivery_type: 'DELIVERY',
        delivery_address: 'Rua Bela Cintra, 450 - SP',
        status: 'NEW',
        subtotal: 24.0,
        delivery_fee: 5.0,
        total_amount: 29.0,
        payment_method: 'PIX_ENTREGA',
        created_at: '2026-11-23T19:00:00Z',
        items: [
          {
            id: 1,
            order_id: 1,
            product_id: 10,
            ean: '7891111222233',
            product_name: 'Paracetamol 750mg 20cpr',
            quantity_ordered: 1,
            quantity_picked: 0,
            unit_price: 24.0,
            total_price: 24.0,
            status: 'PENDING',
          },
        ],
      },
    ]);

    vi.mocked(omnichannelApi.listConversations).mockResolvedValue([
      {
        id: 10,
        channel_id: 1,
        contact_phone: '5511998765432',
        contact_name: 'Juliana Costa',
        state: 'HUMAN_ESCALATION',
        last_message_at: '2026-11-23T19:10:00Z',
        is_open: 1,
      },
    ]);

    vi.mocked(omnichannelApi.getConversationMessages).mockResolvedValue([
      {
        id: 101,
        conversation_id: 10,
        direction: 'INBOUND',
        message_type: 'TEXT',
        content: 'Boa noite, você teria Dipirona gotas?',
        status: 'RECEIVED',
        created_at: '2026-11-23T19:09:00Z',
      },
      {
        id: 102,
        conversation_id: 10,
        direction: 'OUTBOUND',
        message_type: 'TEXT',
        content: 'Olá Juliana! Temos sim, R$ 8,50 com estoque imediato.',
        status: 'SENT',
        created_at: '2026-11-23T19:10:00Z',
      },
    ]);

    vi.mocked(omnichannelApi.listChannels).mockResolvedValue([
      {
        id: 1,
        store_id: 1,
        channel_type: 'WHATSAPP_OPENWA',
        name: 'WhatsApp FarmaCore',
        base_url: 'http://localhost:8080',
        session_id: 'farmacia-matriz',
        phone_number: '5511999998888',
        is_active: 1,
        bot_enabled: 1,
      },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it('should render header, order counters and all 3 tabs', async () => {
    render(<OmnichannelPickPackPage />);

    expect(screen.getByText('Hub Omnichannel & Atendimento WhatsApp')).toBeDefined();
    expect(screen.getByText(/Gateway OpenWA Integrado/i)).toBeDefined();

    expect(screen.getByRole('button', { name: /1\. Esteira de Pick-and-Pack/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /2\. Central de Atendimento WhatsApp/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /3\. Configuração do Gateway OpenWA/i })).toBeDefined();

    await waitFor(() => {
      expect(screen.getAllByText('WPP-202611-0001').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Juliana Costa').length).toBeGreaterThan(0);
    });
  });

  it('should start picking and allow barcode scanning for item confirmation', async () => {
    const pickingOrder = {
      id: 1,
      store_id: 1,
      channel_id: 1,
      channel_order_code: 'WPP-202611-0001',
      customer_name: 'Juliana Costa',
      customer_phone: '5511998765432',
      delivery_type: 'DELIVERY' as const,
      status: 'IN_SEPARATION' as const,
      subtotal: 24.0,
      delivery_fee: 5.0,
      total_amount: 29.0,
      payment_method: 'PIX_ENTREGA',
      created_at: '2026-11-23T19:00:00Z',
      items: [
        {
          id: 1,
          order_id: 1,
          product_id: 10,
          ean: '7891111222233',
          product_name: 'Paracetamol 750mg 20cpr',
          quantity_ordered: 1,
          quantity_picked: 0,
          unit_price: 24.0,
          total_price: 24.0,
          status: 'PENDING' as const,
        },
      ],
    };

    vi.mocked(omnichannelApi.startPicking).mockResolvedValue(pickingOrder);
    vi.mocked(omnichannelApi.getOrder).mockResolvedValue({
      ...pickingOrder,
      status: 'CHECKED',
      items: [
        {
          ...pickingOrder.items[0],
          quantity_picked: 1,
          status: 'PICKED',
        },
      ],
    });
    vi.mocked(omnichannelApi.scanBarcode).mockResolvedValue({
      success: true,
      allItemsPicked: true,
      message: 'Item conferido (1/1)',
    });

    render(<OmnichannelPickPackPage />);

    await waitFor(() => {
      expect(screen.getAllByText('WPP-202611-0001').length).toBeGreaterThan(0);
    });

    const startButtons = screen.getAllByRole('button', { name: /Iniciar Separação/i });
    fireEvent.click(startButtons[0]);

    await waitFor(() => {
      expect(omnichannelApi.startPicking).toHaveBeenCalledWith(1, 1, 'OPERADOR_BALCAO');
      expect(screen.getByTestId('barcode-scanner-input')).toBeDefined();
    });

    // Bipagem de item
    const scanInput = screen.getByTestId('barcode-scanner-input');
    fireEvent.change(scanInput, { target: { value: '7891111222233' } });
    fireEvent.click(screen.getByRole('button', { name: /Conferir Item/i }));

    await waitFor(() => {
      expect(omnichannelApi.scanBarcode).toHaveBeenCalledWith(1, '7891111222233', 'OPERADOR_BALCAO');
    });
  });

  it('should switch to WhatsApp chat tab and display messages with reply form', async () => {
    vi.mocked(omnichannelApi.replyConversation).mockResolvedValue({
      success: true,
      messageId: 'msg-999',
    });

    render(<OmnichannelPickPackPage />);

    await waitFor(() => {
      expect(screen.getAllByText('WPP-202611-0001').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /2\. Central de Atendimento WhatsApp/i }));

    await waitFor(() => {
      expect(omnichannelApi.listConversations).toHaveBeenCalledWith(1);
      expect(screen.getByText('Boa noite, você teria Dipirona gotas?')).toBeDefined();
      expect(screen.getByText(/Olá Juliana! Temos sim/i)).toBeDefined();
    });

    const replyInput = screen.getByPlaceholderText(/Digite a resposta do farmacêutico/i);
    fireEvent.change(replyInput, { target: { value: 'Posso separar o pedido para você?' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar Mensagem/i }));

    await waitFor(() => {
      expect(omnichannelApi.replyConversation).toHaveBeenCalledWith(
        10,
        'Posso separar o pedido para você?',
        'FARMACEUTICO'
      );
    });
  });

  it('should switch to config tab and save gateway settings', async () => {
    vi.mocked(omnichannelApi.saveChannel).mockResolvedValue({
      id: 1,
      store_id: 1,
      channel_type: 'WHATSAPP_OPENWA',
      name: 'WhatsApp FarmaCore',
      base_url: 'http://localhost:8080',
      session_id: 'farmacia-matriz',
      phone_number: '5511999998888',
      is_active: 1,
      bot_enabled: 1,
    });

    render(<OmnichannelPickPackPage />);

    await waitFor(() => {
      expect(screen.getAllByText('WPP-202611-0001').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /3\. Configuração do Gateway OpenWA/i }));

    await waitFor(() => {
      expect(screen.getByText('Parâmetros do Gateway WhatsApp (OpenWA / WPPConnect)')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Salvar Configurações do Gateway/i }));

    await waitFor(() => {
      expect(omnichannelApi.saveChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          store_id: 1,
          channel_type: 'WHATSAPP_OPENWA',
          base_url: 'http://localhost:8080',
          session_id: 'farmacia-matriz',
        })
      );
    });
  });
});
