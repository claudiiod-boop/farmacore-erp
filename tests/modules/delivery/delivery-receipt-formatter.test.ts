import { describe, it, expect } from 'vitest';
import {
  formatDeliveryDispatchSlip,
  formatDeliveryOrderSlip,
  formatCourierSettlementReceipt,
  ESC,
  GS,
  ESC_INIT,
  ESC_CUT,
  ESC_BOLD_ON,
  ESC_BOLD_OFF,
  ESC_ALIGN_LEFT,
  ESC_ALIGN_CENTER,
  ESC_ALIGN_RIGHT,
  type DeliveryDispatchSlipParams,
  type DeliveryOrderSlipParams,
  type CourierSettlementReceiptParams,
} from '../../../src/modules/delivery/delivery-receipt-formatter';

describe('Delivery Receipt Formatter (ESC/POS & Texto Térmico 48 Colunas)', () => {
  const storeInfo = {
    name: 'DROGARIA FARMACORE MATRIZ',
    cnpj: '12.345.678/0001-90',
    address: 'Av. Paulista, 1500 - Bela Vista',
    city: 'São Paulo - SP',
    phone: '(11) 3200-5000',
  };

  // =========================================================================
  // 1. ROMANEIO DE DESPACHO / TELE-ENTREGA (formatDeliveryDispatchSlip)
  // =========================================================================
  describe('formatDeliveryDispatchSlip', () => {
    const dispatchSlipParams: DeliveryDispatchSlipParams = {
      store: storeInfo,
      dispatch: {
        id: 1,
        dispatchNumber: 'ROM-202611-0001',
        storeId: 1,
        courierId: 10,
        totalOrders: 3,
        totalAmount: 185.5,
        totalChangeProvided: 30.0,
        collectedCash: 80.0,
        collectedCard: 65.5,
        collectedPix: 40.0,
        totalCommission: 15.0,
        status: 'OPEN',
        dispatchedAt: '2026-11-21 15:30:00',
      },
      courier: {
        id: 10,
        name: 'Carlos Oliveira',
        cpf: '123.456.789-00',
        phone: '(11) 98888-7777',
        vehicleType: 'MOTO',
        vehiclePlate: 'ABC-1234',
        commissionPerDelivery: 5.0,
        dailyAllowance: 20.0,
        status: 'ON_DELIVERY',
        isActive: true,
      },
      orders: [
        {
          id: 101,
          orderNumber: 'DEL-202611-0001',
          storeId: 1,
          customerName: 'Ana Paula Souza',
          customerPhone: '(11) 91111-2222',
          customerCpf: '111.222.333-44',
          street: 'Rua das Flores',
          number: '123',
          complement: 'Apto 42',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
          referencePoint: 'Em frente ao mercado Dia',
          subtotalAmount: 50.0,
          deliveryFee: 5.0,
          discountAmount: 0,
          totalAmount: 55.0,
          paymentMethod: 'DINHEIRO',
          changeFor: 100.0,
          status: 'DISPATCHED',
          receivedAt: '2026-11-21 14:00:00',
        },
        {
          id: 102,
          orderNumber: 'DEL-202611-0002',
          storeId: 1,
          customerName: 'Roberto Mendes',
          customerPhone: '(11) 93333-4444',
          street: 'Av. Brigadeiro Luis Antonio',
          number: '800',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
          subtotalAmount: 85.5,
          deliveryFee: 5.0,
          discountAmount: 0,
          totalAmount: 90.5,
          paymentMethod: 'CARTAO_CREDITO',
          changeFor: null,
          status: 'DISPATCHED',
          receivedAt: '2026-11-21 14:15:00',
        },
        {
          id: 103,
          orderNumber: 'DEL-202611-0003',
          storeId: 1,
          customerName: 'Fernanda Lima',
          customerPhone: '(11) 95555-6666',
          street: 'Rua Treze de Maio',
          number: '450',
          complement: 'Casa',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
          subtotalAmount: 35.0,
          deliveryFee: 5.0,
          discountAmount: 0,
          totalAmount: 40.0,
          paymentMethod: 'PIX',
          changeFor: null,
          status: 'DISPATCHED',
          receivedAt: '2026-11-21 14:30:00',
        },
      ],
      columnWidth: 48,
    };

    it('deve gerar texto térmico contendo cabeçalho, título e dados do romaneio e motoboy', () => {
      const result = formatDeliveryDispatchSlip(dispatchSlipParams);
      expect(result).toHaveProperty('textReceipt');
      expect(result).toHaveProperty('fullEscPos');

      const text = result.textReceipt;
      // Cabeçalho da farmácia
      expect(text).toContain('DROGARIA FARMACORE MATRIZ');
      expect(text).toContain('12.345.678/0001-90');
      expect(text).toContain('Av. Paulista, 1500 - Bela Vista');

      // Título
      expect(text).toContain('ROMANEIO DE DESPACHO / TELE-ENTREGA');
      expect(text).toContain('ROM-202611-0001');

      // Dados do Motoboy e Veículo
      expect(text).toContain('Carlos Oliveira');
      expect(text).toContain('(11) 98888-7777');
      expect(text).toContain('MOTO');
      expect(text).toContain('ABC-1234');
    });

    it('deve listar todos os pedidos com endereço, telefone, forma de cobrança e troco a levar', () => {
      const result = formatDeliveryDispatchSlip(dispatchSlipParams);
      const text = result.textReceipt;

      // Pedido 1
      expect(text).toContain('DEL-202611-0001');
      expect(text).toContain('Ana Paula Souza');
      expect(text).toContain('Rua das Flores, 123 - Apto 42');
      expect(text).toContain('(11) 91111-2222');
      expect(text).toContain('DINHEIRO');
      expect(text).toContain('55.00'); // ou 55,00
      expect(text).toContain('Troco p/ 100'); // troco informado

      // Pedido 2
      expect(text).toContain('DEL-202611-0002');
      expect(text).toContain('Roberto Mendes');
      expect(text).toContain('Av. Brigadeiro Luis Antonio, 800');
      expect(text).toContain('CARTAO_CREDITO');

      // Pedido 3
      expect(text).toContain('DEL-202611-0003');
      expect(text).toContain('Fernanda Lima');
      expect(text).toContain('PIX');
    });

    it('deve exibir totais consolidados e linha de assinatura', () => {
      const result = formatDeliveryDispatchSlip(dispatchSlipParams);
      const text = result.textReceipt;

      expect(text).toContain('TOTAL DE PEDIDOS');
      expect(text).toContain('3');
      expect(text).toContain('VALOR TOTAL');
      expect(text).toContain('Assinatura do Entregador');
      expect(text).toContain('Carlos Oliveira');
    });

    it('deve conter comandos ESC/POS válidos de inicialização, alinhamento e corte', () => {
      const result = formatDeliveryDispatchSlip(dispatchSlipParams);
      const esc = result.fullEscPos;

      expect(esc.startsWith(ESC_INIT)).toBe(true); // \x1B\x40
      expect(esc.includes(ESC_BOLD_ON)).toBe(true);
      expect(esc.includes(ESC_ALIGN_CENTER)).toBe(true);
      expect(esc.endsWith(ESC_CUT)).toBe(true); // \x1D\x56\x41\x10
    });
  });

  // =========================================================================
  // 2. ETIQUETA DE PACOTE / PEDIDO INDIVIDUAL (formatDeliveryOrderSlip)
  // =========================================================================
  describe('formatDeliveryOrderSlip', () => {
    const orderSlipParams: DeliveryOrderSlipParams = {
      store: storeInfo,
      order: {
        id: 101,
        orderNumber: 'DEL-202611-0001',
        storeId: 1,
        customerName: 'Juliana Costa',
        customerPhone: '(11) 97777-8888',
        customerCpf: '321.654.987-11',
        street: 'Rua Augusta',
        number: '1500',
        complement: 'Bloco B Apto 34',
        neighborhood: 'Consolação',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01305-100',
        referencePoint: 'Próximo à estação de metrô Consolação',
        subtotalAmount: 115.0,
        deliveryFee: 7.0,
        discountAmount: 10.0,
        totalAmount: 112.0,
        paymentMethod: 'DINHEIRO',
        changeFor: 150.0,
        status: 'READY_FOR_PICKUP',
        receivedAt: '2026-11-21 16:00:00',
        notes: 'Campainha com defeito, favor chamar no interfone ou WhatsApp',
      },
      items: [
        {
          id: 1,
          deliveryOrderId: 101,
          productId: 101,
          productName: 'Dipirona 500mg 10cp Medley',
          quantity: 2,
          unitPrice: 15.0,
          totalPrice: 30.0,
          batchNumber: 'LOTE-DIP-99',
        },
        {
          id: 2,
          deliveryOrderId: 101,
          productId: 102,
          productName: 'Amoxicilina 500mg 21cps EMS',
          quantity: 1,
          unitPrice: 85.0,
          totalPrice: 85.0,
          batchNumber: 'LOTE-AMX-88',
        },
      ],
      courierName: 'Marcos Entregador',
      columnWidth: 48,
    };

    it('deve formatar a etiqueta de pacote com cabeçalho e título oficial', () => {
      const result = formatDeliveryOrderSlip(orderSlipParams);
      const text = result.textReceipt;

      expect(text).toContain('DROGARIA FARMACORE MATRIZ');
      expect(text).toContain('TELE-ENTREGA - ETIQUETA DE PACOTE');
      expect(text).toContain('DEL-202611-0001');
    });

    it('deve conter dados completos do destinatário, endereço e ponto de referência', () => {
      const result = formatDeliveryOrderSlip(orderSlipParams);
      const text = result.textReceipt;

      expect(text).toContain('Juliana Costa');
      expect(text).toContain('(11) 97777-8888');
      expect(text).toContain('321.654.987-11');
      expect(text).toContain('Rua Augusta, 1500');
      expect(text).toContain('Bloco B Apto 34');
      expect(text).toContain('Consolação - São Paulo - SP');
      expect(text).toContain('CEP: 01305-100');
      expect(text).toContain('Próximo à estação de metrô');
      expect(text).toContain('Campainha com defeito');
    });

    it('deve listar os itens conferidos com quantidade, nome, lote e valores', () => {
      const result = formatDeliveryOrderSlip(orderSlipParams);
      const text = result.textReceipt;

      expect(text).toContain('Dipirona 500mg 10cp Medley');
      expect(text).toContain('LOTE-DIP-99');
      expect(text).toContain('Amoxicilina 500mg 21cps EMS');
      expect(text).toContain('LOTE-AMX-88');
    });

    it('deve detalhar os totais financeiros (subtotal, frete, desconto, total e troco)', () => {
      const result = formatDeliveryOrderSlip(orderSlipParams);
      const text = result.textReceipt;

      expect(text).toContain('Subtotal:');
      expect(text).toContain('115.00');
      expect(text).toContain('Taxa de Entrega:');
      expect(text).toContain('7.00');
      expect(text).toContain('Desconto:');
      expect(text).toContain('10.00');
      expect(text).toContain('TOTAL A COBRAR:');
      expect(text).toContain('112.00');
      expect(text).toContain('DINHEIRO');
      expect(text).toContain('Troco para:');
      expect(text).toContain('150.00');
    });

    it('deve incluir comandos ESC/POS com corte automático', () => {
      const result = formatDeliveryOrderSlip(orderSlipParams);
      const esc = result.fullEscPos;

      expect(esc.startsWith(ESC_INIT)).toBe(true);
      expect(esc.endsWith(ESC_CUT)).toBe(true);
    });
  });

  // =========================================================================
  // 3. RECIBO DE ACERTO DE CONTAS COM MOTOBOY (formatCourierSettlementReceipt)
  // =========================================================================
  describe('formatCourierSettlementReceipt', () => {
    const settlementParams: CourierSettlementReceiptParams = {
      store: storeInfo,
      dispatch: {
        id: 5,
        dispatchNumber: 'ROM-202611-0005',
        storeId: 1,
        courierId: 10,
        totalOrders: 4,
        totalAmount: 250.0,
        totalChangeProvided: 50.0,
        collectedCash: 120.0,
        collectedCard: 80.0,
        collectedPix: 50.0,
        totalCommission: 24.0,
        status: 'SETTLED',
        operatorName: 'Gerente João',
        dispatchedAt: '2026-11-21 10:00:00',
        settledAt: '2026-11-21 12:30:00',
      },
      courier: {
        id: 10,
        name: 'Carlos Oliveira',
        cpf: '123.456.789-00',
        phone: '(11) 98888-7777',
        vehicleType: 'MOTO',
        vehiclePlate: 'ABC-1234',
        commissionPerDelivery: 6.0,
        dailyAllowance: 15.0,
        status: 'AVAILABLE',
        isActive: true,
      },
      settlementSummary: {
        totalOrders: 4,
        totalDelivered: 3,
        totalReturned: 1,
        collectedCash: 120.0,
        collectedCard: 80.0,
        collectedPix: 50.0,
        totalCollected: 250.0,
        commissionEarned: 18.0, // 3 entregas * 6.0
        dailyAllowance: 15.0,
        totalPayableToCourier: 33.0,
        cashMovementId: 402,
        cashSessionId: 15,
        operatorName: 'Gerente João',
      },
      columnWidth: 48,
    };

    it('deve gerar comprovante térmico de acerto de contas com cabeçalho e título oficial', () => {
      const result = formatCourierSettlementReceipt(settlementParams);
      const text = result.textReceipt;

      expect(text).toContain('DROGARIA FARMACORE MATRIZ');
      expect(text).toContain('ACERTO DE CONTAS - TELE-ENTREGA');
      expect(text).toContain('ROM-202611-0005');
      expect(text).toContain('Carlos Oliveira');
      expect(text).toContain('Gerente João');
    });

    it('deve discriminar entregas realizadas, devoluções e valores arrecadados por meio', () => {
      const result = formatCourierSettlementReceipt(settlementParams);
      const text = result.textReceipt;

      expect(text).toContain('Total de Pedidos:');
      expect(text).toContain('4');
      expect(text).toContain('Entregues:');
      expect(text).toContain('3');
      expect(text).toContain('Devolvidos:');
      expect(text).toContain('1');

      expect(text).toContain('Dinheiro:');
      expect(text).toContain('120.00');
      expect(text).toContain('Cartão:');
      expect(text).toContain('80.00');
      expect(text).toContain('PIX:');
      expect(text).toContain('50.00');
      expect(text).toContain('Total Arrecadado:');
      expect(text).toContain('250.00');
    });

    it('deve discriminar a comissão / diária do motoboy e o suprimento/registro de caixa', () => {
      const result = formatCourierSettlementReceipt(settlementParams);
      const text = result.textReceipt;

      expect(text).toContain('Comissão das Entregas:');
      expect(text).toContain('18.00');
      expect(text).toContain('Diária do Entregador:');
      expect(text).toContain('15.00');
      expect(text).toContain('Total Pago ao Motoboy:');
      expect(text).toContain('33.00');

      // Entrada no caixa
      expect(text).toContain('MOVIMENTAÇÃO DE CAIXA PDV');
      expect(text).toContain('#402');
      expect(text).toContain('Sessão: #15');
    });

    it('deve incluir linhas de assinatura e comandos ESC/POS com corte', () => {
      const result = formatCourierSettlementReceipt(settlementParams);
      const text = result.textReceipt;
      const esc = result.fullEscPos;

      expect(text).toContain('Assinatura do Entregador');
      expect(text).toContain('Assinatura do Operador / Caixa');

      expect(esc.startsWith(ESC_INIT)).toBe(true);
      expect(esc.endsWith(ESC_CUT)).toBe(true);
    });
  });
});
