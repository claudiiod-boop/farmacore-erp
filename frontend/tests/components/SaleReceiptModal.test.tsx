import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SaleReceiptModal from '../../src/components/pos/SaleReceiptModal';
import { Sale, NfceInvoiceDetails } from '../../src/services/api';

const mockSale: Sale = {
  id: 42,
  cashSessionId: 5,
  status: 'COMPLETED',
  totalAmount: 55.0,
  discountAmount: 0.0,
  changeAmount: 5.0,
  createdAt: '2026-11-02T15:30:00.000Z',
  operatorName: 'Carlos Operador',
  items: [
    {
      id: 1,
      saleId: 42,
      productId: 10,
      productName: 'Dipirona 500mg 20 Comprimidos',
      batchId: 101,
      batchNumber: 'LOTE-DIP-01',
      expirationDate: '2027-12-31T00:00:00.000Z',
      quantity: 2,
      unitPrice: 15.0,
      totalPrice: 30.0,
    },
    {
      id: 2,
      saleId: 42,
      productId: 20,
      productName: 'Shampoo Anticaspa 200ml',
      batchId: 102,
      batchNumber: 'LOTE-SHP-02',
      expirationDate: '2026-11-30T00:00:00.000Z',
      quantity: 1,
      unitPrice: 25.0,
      totalPrice: 25.0,
    },
  ],
  payments: [
    {
      id: 1,
      saleId: 42,
      method: 'DINHEIRO',
      amount: 60.0,
      createdAt: '2026-11-02T15:30:00.000Z',
    },
  ],
};

const mockControlledSale: Sale = {
  ...mockSale,
  id: 43,
  prescription: {
    id: 1,
    preSaleId: 100,
    doctorName: 'Dr. Roberto Souza',
    doctorCrm: '123456',
    doctorUf: 'SP',
    prescriptionType: 'B1_AZUL',
    prescriptionDate: '2026-10-25',
    patientName: 'Mariana Lima',
    buyerName: 'Mariana Lima',
    buyerCpf: '123.456.789-00',
    createdAt: '2026-10-25T10:00:00.000Z',
  },
  items: [
    {
      id: 3,
      saleId: 43,
      productId: 30,
      productName: 'Clonazepam 2mg 30 Comprimidos',
      batchId: 103,
      batchNumber: 'LOTE-CNZ-99',
      expirationDate: '2027-08-15T00:00:00.000Z',
      quantity: 1,
      unitPrice: 32.5,
      totalPrice: 32.5,
      controlType: 'B1',
    },
  ],
  payments: [
    {
      id: 2,
      saleId: 43,
      method: 'PIX',
      amount: 32.5,
      createdAt: '2026-11-02T15:35:00.000Z',
    },
  ],
  changeAmount: 0.0,
  totalAmount: 32.5,
};

describe('SaleReceiptModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should not render anything when isOpen is false', () => {
    render(
      <SaleReceiptModal
        isOpen={false}
        sale={mockSale}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/VENDA/i)).toBeNull();
  });

  it('should render thermal receipt layout with #VENDA-XXXXX, date/time, and cashier name', () => {
    render(
      <SaleReceiptModal
        isOpen={true}
        sale={mockSale}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    // Identifier #VENDA-00042
    expect(screen.getByText(/#VENDA-00042|#VENDA-42/i)).toBeDefined();
    // Cashier name or session
    expect(screen.getByText(/Carlos Operador|Caixa #5/i)).toBeDefined();
  });

  it('should render itemized lines with product name, lot number, expiration date, quantity, unit price, total price', () => {
    render(
      <SaleReceiptModal
        isOpen={true}
        sale={mockSale}
        onClose={vi.fn()}
      />
    );

    // Products
    expect(screen.getByText(/Dipirona 500mg 20 Comprimidos/i)).toBeDefined();
    expect(screen.getByText(/Shampoo Anticaspa 200ml/i)).toBeDefined();

    // Lots
    expect(screen.getByText(/LOTE-DIP-01/i)).toBeDefined();
    expect(screen.getByText(/LOTE-SHP-02/i)).toBeDefined();

    // Prices and quantities
    expect(screen.getAllByText(/30,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/25,00/).length).toBeGreaterThan(0);
  });

  it('should render payment breakdown and change amount', () => {
    render(
      <SaleReceiptModal
        isOpen={true}
        sale={mockSale}
        onClose={vi.fn()}
      />
    );

    // Payment method & amount
    expect(screen.getByText(/DINHEIRO/i)).toBeDefined();
    expect(screen.getAllByText(/60,00/).length).toBeGreaterThan(0);

    // Change amount
    expect(screen.getByText(/Troco/i)).toBeDefined();
    expect(screen.getAllByText(/5,00/).length).toBeGreaterThan(0);
  });

  it('should render sanitary retention section if prescription/controlled items exist', () => {
    render(
      <SaleReceiptModal
        isOpen={true}
        sale={mockControlledSale}
        onClose={vi.fn()}
      />
    );

    // Sanitary Section
    expect(screen.getByText(/Receita Retida|Portaria 344\/98|Controle Especial/i)).toBeDefined();
    expect(screen.getByText(/Dr\. Roberto Souza/i)).toBeDefined();
    expect(screen.getByText(/123456/i)).toBeDefined();
    expect(screen.getAllByText(/Mariana Lima/i).length).toBeGreaterThan(0);
  });

  it('should call onPrint / window.print() on print button or Enter key', () => {
    const handlePrint = vi.fn();
    render(
      <SaleReceiptModal
        isOpen={true}
        sale={mockSale}
        onClose={vi.fn()}
        onPrint={handlePrint}
      />
    );

    // Print button
    const printBtn = screen.getByRole('button', { name: /Imprimir Cupom|Imprimir/i });
    fireEvent.click(printBtn);
    expect(handlePrint).toHaveBeenCalledTimes(1);

    // Enter key
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    expect(handlePrint).toHaveBeenCalledTimes(2);
  });

  it('should call onNewSale / onClose on new sale button or Escape key', () => {
    const handleNewSale = vi.fn();
    const handleClose = vi.fn();

    render(
      <SaleReceiptModal
        isOpen={true}
        sale={mockSale}
        onClose={handleClose}
        onNewSale={handleNewSale}
      />
    );

    // New sale button
    const newSaleBtn = screen.getByRole('button', { name: /Nova Venda|Novo Atendimento/i });
    fireEvent.click(newSaleBtn);
    expect(handleNewSale).toHaveBeenCalledTimes(1);

    // Escape key
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(handleNewSale).toHaveBeenCalledTimes(2);
  });

  const mockNfceInvoice: NfceInvoiceDetails = {
    invoice: {
      id: 1,
      saleId: 42,
      chNFe: '35261112345678000199650010000000011928374652',
      nNF: 1,
      serie: 1,
      tpAmb: 2,
      tpEmis: 1,
      status: 'AUTORIZADA',
      protocolNumber: '135260000012345',
      protocolDate: '2026-11-02T15:30:05.000Z',
      xmlSigned: '<xml></xml>',
      xmlAuthorized: '<xml></xml>',
      qrCodeUrl: 'https://www.fazenda.sp.gov.br/nfce/qrcode?p=35261112345678000199650010000000011928374652|2|2|000001|hash',
      digestValue: 'abc123digest',
      cStat: 100,
      xMotivo: 'Autorizado o uso da NF-e',
      cancellationReason: null,
      createdAt: '2026-11-02T15:30:00.000Z',
    },
    profile: {
      cnpj: '12.345.678/0001-99',
      ie: '123.456.789.111',
      razaoSocial: 'DROGARIA FARMACORE LTDA',
      nomeFantasia: 'FARMACORE DROGARIA',
      crt: 1,
      cUf: 35,
      municipio: 'SAO PAULO',
      cMun: 3550308,
      logradouro: 'AV PAULISTA',
      numero: '1000',
      bairro: 'BELA VISTA',
      cep: '01310-100',
      serie: 1,
      nextNnf: 2,
      cscToken: 'token123',
      cscId: '000001',
      environment: 'HOMOLOGACAO',
    },
    items: [
      {
        name: 'Dipirona 500mg 20 Comprimidos',
        ean: '7891234567890',
        quantity: 2,
        unitPrice: 15.0,
        totalPrice: 30.0,
      },
      {
        name: 'Shampoo Anticaspa 200ml',
        ean: '7899876543210',
        quantity: 1,
        unitPrice: 25.0,
        totalPrice: 25.0,
      },
    ],
    payments: [
      {
        method: 'DINHEIRO',
        amount: 60.0,
      },
    ],
    taxes: {
      vTotTrib: 17.6,
      vICMS: 0,
      vICMSST: 0,
      vPIS: 0,
      vCOFINS: 0,
      items: [],
    },
    customerCpf: null,
    changeAmount: 5.0,
    danfeText: 'DANFE NFC-e...',
  };

  it('should render official DANFE NFC-e header, 44-digit formatted access key, authorization protocol, IBPT taxes and QR Code when nfceInvoice is provided', async () => {
    // Mock navigator.clipboard
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <SaleReceiptModal
        isOpen={true}
        sale={mockSale}
        nfceInvoice={mockNfceInvoice}
        onClose={vi.fn()}
      />
    );

    // Official DANFE NFC-e header
    expect(screen.getByText(/DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica/i)).toBeDefined();
    expect(screen.getByText(/Não permite aproveitamento de crédito de ICMS/i)).toBeDefined();

    // Formatted 44-digit key: 3526 1112 3456 7800 0199 6500 1000 0000 0119 2837 4652
    expect(screen.getByText(/3526 1112 3456 7800 0199 6500 1000 0000 0119 2837 4652/i)).toBeDefined();

    // Protocol
    expect(screen.getByText(/Protocolo de Autorização:/i)).toBeDefined();
    expect(screen.getByText(/135260000012345/i)).toBeDefined();

    // IBPT taxes
    expect(screen.getByText(/Tributos Totais Incidentes \(Lei 12\.741\/2012\):/i)).toBeDefined();
    expect(screen.getByText(/R\$\s*17,60/i)).toBeDefined();

    // Consumer info
    expect(screen.getByText(/CONSUMIDOR NÃO IDENTIFICADO/i)).toBeDefined();

    // QR Code SVG
    expect(screen.getByTestId('nfce-qrcode-svg')).toBeDefined();

    // Copy access key button
    const copyKeyBtn = screen.getByRole('button', { name: /Copiar Chave/i });
    fireEvent.click(copyKeyBtn);
    expect(writeTextMock).toHaveBeenCalledWith('35261112345678000199650010000000011928374652');
  });

  it('should render prominent offline contingency banner when tpEmis is 9 or status is CONTINGENCIA', () => {
    const contingencyInvoice: NfceInvoiceDetails = {
      ...mockNfceInvoice,
      invoice: {
        ...mockNfceInvoice.invoice,
        tpEmis: 9,
        status: 'CONTINGENCIA',
        protocolNumber: null,
      },
    };

    render(
      <SaleReceiptModal
        isOpen={true}
        sale={mockSale}
        nfceInvoice={contingencyInvoice}
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByText(/EMITIDA EM CONTINGÊNCIA - PENDENTE DE AUTORIZAÇÃO/i)
    ).toBeDefined();
  });
});
