import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import DeliveryPage from '../../src/pages/DeliveryPage';
import App from '../../src/App';
import { deliveryApi, api } from '../../src/services/api';
import type {
  DeliveryOrder,
  Courier,
  DeliveryZone,
  DeliveryDispatch,
  DeliveryDispatchWithOrders,
  SettlementResult,
} from '../../src/types/delivery';

const mockOrders: DeliveryOrder[] = [
  {
    id: 1,
    orderNumber: 'DEL-0001',
    storeId: 1,
    customerName: 'João da Silva',
    customerPhone: '(11) 98888-1111',
    street: 'Rua Augusta',
    number: '100',
    neighborhood: 'Consolação',
    city: 'São Paulo',
    state: 'SP',
    subtotalAmount: 37.0,
    deliveryFee: 8.0,
    discountAmount: 0,
    totalAmount: 45.0,
    paymentMethod: 'DINHEIRO',
    changeFor: 50.0,
    status: 'RECEIVED',
    receivedAt: '2026-11-21T10:00:00.000Z',
  },
  {
    id: 2,
    orderNumber: 'DEL-0002',
    storeId: 1,
    customerName: 'Ana Paula Santos',
    customerPhone: '(11) 97777-2222',
    street: 'Av Paulista',
    number: '1000',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    subtotalAmount: 75.5,
    deliveryFee: 10.0,
    discountAmount: 0,
    totalAmount: 85.5,
    paymentMethod: 'PIX',
    status: 'PREPARING',
    receivedAt: '2026-11-21T10:15:00.000Z',
  },
  {
    id: 3,
    orderNumber: 'DEL-0003',
    storeId: 1,
    customerName: 'Carlos Eduardo',
    customerPhone: '(11) 96666-3333',
    street: 'Rua Bela Cintra',
    number: '500',
    neighborhood: 'Consolação',
    city: 'São Paulo',
    state: 'SP',
    subtotalAmount: 52.0,
    deliveryFee: 8.0,
    discountAmount: 0,
    totalAmount: 60.0,
    paymentMethod: 'CARTAO_CREDITO',
    status: 'READY_FOR_PICKUP',
    receivedAt: '2026-11-21T10:30:00.000Z',
  },
  {
    id: 4,
    orderNumber: 'DEL-0004',
    storeId: 1,
    courierId: 1,
    customerName: 'Beatriz Lima',
    customerPhone: '(11) 95555-4444',
    street: 'Rua Frei Caneca',
    number: '200',
    neighborhood: 'Consolação',
    city: 'São Paulo',
    state: 'SP',
    subtotalAmount: 27.0,
    deliveryFee: 8.0,
    discountAmount: 0,
    totalAmount: 35.0,
    paymentMethod: 'DINHEIRO',
    changeFor: 50.0,
    status: 'DISPATCHED',
    receivedAt: '2026-11-21T10:45:00.000Z',
  },
  {
    id: 5,
    orderNumber: 'DEL-0005',
    storeId: 1,
    customerName: 'Marcos Vinicius',
    customerPhone: '(11) 94444-5555',
    street: 'Rua Haddock Lobo',
    number: '300',
    neighborhood: 'Cerqueira César',
    city: 'São Paulo',
    state: 'SP',
    subtotalAmount: 100.0,
    deliveryFee: 10.0,
    discountAmount: 0,
    totalAmount: 110.0,
    paymentMethod: 'CARTAO_DEBITO',
    status: 'DELIVERED',
    receivedAt: '2026-11-21T09:00:00.000Z',
  },
];

const mockCouriers: Courier[] = [
  {
    id: 1,
    storeId: 1,
    name: 'Lucas Motoboy',
    cpf: '111.222.333-44',
    phone: '(11) 98111-2222',
    vehicleType: 'MOTO',
    vehiclePlate: 'ABC-1234',
    commissionPerDelivery: 5.0,
    dailyAllowance: 30.0,
    status: 'AVAILABLE',
    isActive: true,
  },
  {
    id: 2,
    storeId: 1,
    name: 'Rodrigo Bike',
    cpf: '555.666.777-88',
    phone: '(11) 98333-4444',
    vehicleType: 'BIKE',
    vehiclePlate: null,
    commissionPerDelivery: 4.0,
    dailyAllowance: 25.0,
    status: 'ON_DELIVERY',
    isActive: true,
  },
];

const mockZones: DeliveryZone[] = [
  {
    id: 1,
    storeId: 1,
    name: 'Zona Consolação',
    neighborhood: 'Consolação',
    city: 'São Paulo',
    state: 'SP',
    deliveryFee: 8.0,
    estimatedMinutes: 30,
    freeShippingThreshold: 100.0,
    isActive: true,
  },
  {
    id: 2,
    storeId: 1,
    name: 'Zona Bela Vista',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    deliveryFee: 10.0,
    estimatedMinutes: 40,
    freeShippingThreshold: 120.0,
    isActive: true,
  },
];

const mockDispatches: DeliveryDispatch[] = [
  {
    id: 10,
    dispatchNumber: 'ROM-0010',
    storeId: 1,
    courierId: 1,
    totalOrders: 2,
    totalAmount: 95.0,
    totalChangeProvided: 15.0,
    collectedCash: 0,
    collectedCard: 0,
    collectedPix: 0,
    totalCommission: 10.0,
    status: 'OPEN',
    dispatchedAt: '2026-11-21T11:00:00.000Z',
  },
  {
    id: 9,
    dispatchNumber: 'ROM-0009',
    storeId: 1,
    courierId: 1,
    totalOrders: 1,
    totalAmount: 110.0,
    totalChangeProvided: 0,
    collectedCash: 0,
    collectedCard: 110.0,
    collectedPix: 0,
    totalCommission: 5.0,
    status: 'SETTLED',
    dispatchedAt: '2026-11-21T08:00:00.000Z',
    settledAt: '2026-11-21T09:00:00.000Z',
  },
];

const mockDispatchWithOrders: DeliveryDispatchWithOrders = {
  ...mockDispatches[0],
  courier: mockCouriers[0],
  orders: [mockOrders[2], mockOrders[3]],
};

const mockSettlementResult: SettlementResult = {
  dispatch: { ...mockDispatches[0], status: 'SETTLED' },
  totalDelivered: 2,
  totalReturned: 0,
  collectedCash: 35.0,
  collectedCard: 60.0,
  collectedPix: 0,
  commissionEarned: 10.0,
  receiptText: '=== RECIBO ACERTO CAIXA ===\nRomaneio #ROM-0010\nEntregador: Lucas Motoboy',
};

describe('DeliveryPage & Delivery Module (Posto [F11])', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock Delivery APIs
    vi.spyOn(deliveryApi, 'getOrders').mockResolvedValue(mockOrders);
    vi.spyOn(deliveryApi, 'getCouriers').mockResolvedValue(mockCouriers);
    vi.spyOn(deliveryApi, 'getZones').mockResolvedValue(mockZones);
    vi.spyOn(deliveryApi, 'getDispatches').mockResolvedValue(mockDispatches);
    vi.spyOn(deliveryApi, 'getDispatchById').mockResolvedValue(mockDispatchWithOrders);
    vi.spyOn(deliveryApi, 'getOrderSlip').mockResolvedValue({
      orderId: 1,
      orderNumber: 'DEL-0001',
      order: mockOrders[0],
      textReceipt: '=== ETIQUETA PACOTE 48 COLUNAS ===\nPedido: DEL-0001\nCliente: João da Silva',
      fullEscPos: 'bytes',
    });
    vi.spyOn(deliveryApi, 'getDispatchSlip').mockResolvedValue({
      dispatchId: 10,
      dispatchNumber: 'ROM-0010',
      dispatch: mockDispatchWithOrders,
      textReceipt: '=== ROMANEIO DE DESPACHO ===\nRomaneio: ROM-0010\nMotoboy: Lucas Motoboy',
      fullEscPos: 'bytes',
    });
    vi.spyOn(deliveryApi, 'calculateDeliveryFee').mockResolvedValue({
      zone: mockZones[0],
      deliveryFee: 8.0,
      estimatedMinutes: 30,
      freeShipping: false,
    });
    vi.spyOn(deliveryApi, 'createOrder').mockImplementation(async (input) => ({
      id: 99,
      orderNumber: 'DEL-0099',
      storeId: 1,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      street: input.street,
      number: input.number,
      neighborhood: input.neighborhood,
      city: input.city,
      state: input.state || 'SP',
      subtotalAmount: input.subtotalAmount || 50,
      deliveryFee: input.deliveryFee || 8,
      discountAmount: input.discountAmount || 0,
      totalAmount: input.totalAmount || 58,
      paymentMethod: input.paymentMethod,
      status: 'RECEIVED',
      receivedAt: new Date().toISOString(),
    }));
    vi.spyOn(deliveryApi, 'updateOrderStatus').mockImplementation(async (id, data) => {
      const found = mockOrders.find((o) => o.id === id) || mockOrders[0];
      return { ...found, status: data.status };
    });
    vi.spyOn(deliveryApi, 'cancelOrder').mockImplementation(async (id, reason) => {
      const found = mockOrders.find((o) => o.id === id) || mockOrders[0];
      return { ...found, status: 'CANCELLED', cancellationReason: reason };
    });
    vi.spyOn(deliveryApi, 'createDispatch').mockResolvedValue(mockDispatchWithOrders);
    vi.spyOn(deliveryApi, 'settleDispatch').mockResolvedValue(mockSettlementResult);
    vi.spyOn(deliveryApi, 'createCourier').mockImplementation(async (input) => ({
      id: 99,
      storeId: 1,
      name: input.name,
      cpf: input.cpf,
      phone: input.phone,
      vehicleType: input.vehicleType || 'MOTO',
      commissionPerDelivery: input.commissionPerDelivery || 5,
      dailyAllowance: input.dailyAllowance || 30,
      status: 'AVAILABLE',
      isActive: true,
    }));
    vi.spyOn(deliveryApi, 'createZone').mockImplementation(async (input) => ({
      id: 99,
      storeId: 1,
      name: input.name,
      neighborhood: input.neighborhood,
      city: input.city,
      state: input.state || 'SP',
      deliveryFee: input.deliveryFee,
      estimatedMinutes: input.estimatedMinutes || 30,
      freeShippingThreshold: input.freeShippingThreshold || null,
      isActive: true,
    }));
    vi.spyOn(deliveryApi, 'updateCourierStatus').mockImplementation(async (id, status) => {
      const c = mockCouriers.find((it) => it.id === id) || mockCouriers[0];
      return { ...c, status };
    });
    vi.spyOn(deliveryApi, 'deleteZone').mockResolvedValue({ success: true, message: 'Removido' });

    // Mock generic API methods
    vi.spyOn(api, 'getCurrentSession').mockResolvedValue({
      id: 1,
      operatorName: 'Caixa Teste',
      initialCash: 100,
      currentCash: 100,
      openedAt: new Date().toISOString(),
      closedAt: null,
      status: 'OPEN',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Renderiza a tela DeliveryPage com Posto [F11] e as 4 abas principais', async () => {
    render(<DeliveryPage />);

    expect(screen.getByTestId('delivery-page')).toBeDefined();
    expect(screen.getByText(/Central de Delivery & Tele-Entrega Farmacêutica/i)).toBeDefined();
    expect(screen.getByTestId('tab-kanban')).toBeDefined();
    expect(screen.getByTestId('tab-routing')).toBeDefined();
    expect(screen.getByTestId('tab-settlement')).toBeDefined();
    expect(screen.getByTestId('tab-couriers-zones')).toBeDefined();

    // Aguarda carregamento inicial
    await waitFor(() => {
      expect(deliveryApi.getOrders).toHaveBeenCalled();
      expect(deliveryApi.getCouriers).toHaveBeenCalled();
      expect(deliveryApi.getZones).toHaveBeenCalled();
      expect(deliveryApi.getDispatches).toHaveBeenCalled();
    });
  });

  it('2. Exibe as colunas do Kanban com cards de pedidos e dados de cliente/endereço/valor', async () => {
    render(<DeliveryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('kanban-board')).toBeDefined();
    });

    // Colunas Kanban
    expect(screen.getByTestId('kanban-column-recebidos')).toBeDefined();
    expect(screen.getByTestId('kanban-column-em-separa--o')).toBeDefined();
    expect(screen.getByTestId('kanban-column-pronto-p--despacho')).toBeDefined();
    expect(screen.getByTestId('kanban-column-em-rota--motoboy-')).toBeDefined();

    // Pedidos renderizados nos cards
    expect(screen.getByText('João da Silva')).toBeDefined();
    expect(screen.getByText('Ana Paula Santos')).toBeDefined();
    expect(screen.getByText('Carlos Eduardo')).toBeDefined();
    expect(screen.getByText('Beatriz Lima')).toBeDefined();
  });

  it('3. Avança o status de um pedido no Kanban (ex: RECEBIDO -> EM SEPARAÇÃO)', async () => {
    render(<DeliveryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('order-advance-btn-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('order-advance-btn-1'));

    await waitFor(() => {
      expect(deliveryApi.updateOrderStatus).toHaveBeenCalledWith(1, {
        status: 'PREPARING',
      });
    });
  });

  it('4. Abre o modal de Etiqueta Térmica de Pacote (48 colunas ESC/POS) e exibe o texto formatado', async () => {
    render(<DeliveryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('order-slip-btn-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('order-slip-btn-1'));

    await waitFor(() => {
      expect(screen.getByTestId('order-slip-modal')).toBeDefined();
      expect(deliveryApi.getOrderSlip).toHaveBeenCalledWith(1);
      expect(screen.getByTestId('order-slip-text').textContent).toContain('ETIQUETA PACOTE 48 COLUNAS');
    });
  });

  it('5. Abre o modal de Novo Pedido de Tele-Entrega, calcula frete por bairro e cria pedido', async () => {
    render(<DeliveryPage />);

    const newOrderBtn = screen.getByTestId('new-delivery-order-button');
    fireEvent.click(newOrderBtn);

    await waitFor(() => {
      expect(screen.getByTestId('new-delivery-order-modal')).toBeDefined();
    });

    // Preenche dados do cliente e endereço
    fireEvent.change(screen.getByTestId('delivery-customer-name'), {
      target: { value: 'Mariana Costa' },
    });
    fireEvent.change(screen.getByTestId('delivery-customer-phone'), {
      target: { value: '(11) 91111-2222' },
    });
    fireEvent.change(screen.getByTestId('delivery-street'), {
      target: { value: 'Rua Bela Cintra' },
    });
    fireEvent.change(screen.getByTestId('delivery-number'), {
      target: { value: '250' },
    });
    fireEvent.change(screen.getByTestId('delivery-neighborhood'), {
      target: { value: 'Consolação' },
    });

    // Submete formulário
    const submitBtn = screen.getByTestId('create-order-button');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(deliveryApi.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: 'Mariana Costa',
          customerPhone: '(11) 91111-2222',
          street: 'Rua Bela Cintra',
          neighborhood: 'Consolação',
        })
      );
    });
  });

  it('6. Navega para a aba de Roteirização & Despacho e gera romaneio de motoboy', async () => {
    render(<DeliveryPage />);

    fireEvent.click(screen.getByTestId('tab-routing'));

    await waitFor(() => {
      expect(screen.getByTestId('routing-view')).toBeDefined();
      expect(screen.getByTestId('create-dispatch-button')).toBeDefined();
    });

    // Abre modal de despacho
    fireEvent.click(screen.getByTestId('create-dispatch-button'));

    await waitFor(() => {
      expect(screen.getByTestId('dispatch-modal')).toBeDefined();
    });

    // Seleciona entregador e confirma
    fireEvent.change(screen.getByTestId('dispatch-courier-select'), {
      target: { value: '1' },
    });

    fireEvent.click(screen.getByTestId('confirm-dispatch-button'));

    await waitFor(() => {
      expect(deliveryApi.createDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          courierId: 1,
        })
      );
    });
  });

  it('7. Navega para a aba de Acerto de Contas no Caixa e realiza a liquidação com recibo térmico', async () => {
    render(<DeliveryPage />);

    fireEvent.click(screen.getByTestId('tab-settlement'));

    await waitFor(() => {
      expect(screen.getByTestId('settlement-view')).toBeDefined();
      expect(screen.getByTestId('settle-dispatch-btn-10')).toBeDefined();
    });

    // Abre modal de acerto de contas
    fireEvent.click(screen.getByTestId('settle-dispatch-btn-10'));

    await waitFor(() => {
      expect(screen.getByTestId('settlement-modal')).toBeDefined();
      expect(deliveryApi.getDispatchById).toHaveBeenCalledWith(10);
    });

    // Confirma acerto no caixa
    const confirmSettleBtn = screen.getByTestId('confirm-settlement-button');
    fireEvent.click(confirmSettleBtn);

    await waitFor(() => {
      expect(deliveryApi.settleDispatch).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          cashSessionId: 1,
        })
      );
      expect(screen.getByTestId('settlement-receipt-text').textContent).toContain('RECIBO ACERTO CAIXA');
    });
  });

  it('8. Navega para a aba Entregadores & Zonas e adiciona novo motoboy e nova zona de entrega', async () => {
    render(<DeliveryPage />);

    fireEvent.click(screen.getByTestId('tab-couriers-zones'));

    await waitFor(() => {
      expect(screen.getByTestId('couriers-zones-view')).toBeDefined();
      expect(screen.getByTestId('add-courier-button')).toBeDefined();
      expect(screen.getByTestId('add-zone-button')).toBeDefined();
    });

    // Abre modal de entregador
    fireEvent.click(screen.getByTestId('add-courier-button'));

    await waitFor(() => {
      expect(screen.getByTestId('courier-modal')).toBeDefined();
    });

    fireEvent.change(screen.getByTestId('courier-name-input'), {
      target: { value: 'Marcos Vinicius Motoboy' },
    });
    fireEvent.change(screen.getByTestId('courier-cpf-input'), {
      target: { value: '999.888.777-66' },
    });
    fireEvent.change(screen.getByTestId('courier-phone-input'), {
      target: { value: '(11) 98765-4321' },
    });

    fireEvent.click(screen.getByTestId('save-courier-button'));

    await waitFor(() => {
      expect(deliveryApi.createCourier).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Marcos Vinicius Motoboy',
          cpf: '999.888.777-66',
        })
      );
    });
  });

  it('9. Integração com App.tsx: botão [F11] Delivery na barra superior e atalho de teclado F11', async () => {
    render(<App />);

    const deliveryBtn = screen.getByTestId('topbar-delivery-button');
    expect(deliveryBtn).toBeDefined();

    // Clica no botão [F11] Delivery
    fireEvent.click(deliveryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('delivery-page')).toBeDefined();
    });

    // Testa atalho F11 pelo window
    fireEvent.keyDown(window, { key: 'F1' }); // volta para balcão
    expect(screen.queryByTestId('delivery-page')).toBeNull();

    fireEvent.keyDown(window, { key: 'F11' }); // vai para delivery
    await waitFor(() => {
      expect(screen.getByTestId('delivery-page')).toBeDefined();
    });
  });
});
