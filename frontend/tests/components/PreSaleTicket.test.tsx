import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PreSaleTicket from '../../src/components/PreSaleTicket';
import { CartItem } from '../../src/components/CartTable';
import { PrescriptionDTO, Product, Batch } from '../../src/services/api';

const mockProductOtc: Product = {
  id: 1,
  ean: '7891234567890',
  name: 'Dipirona Monoidratada 500mg 20 Comprimidos',
  activeIngredient: 'Dipirona Sódica',
  msRegistration: '1.0001.0001.001-1',
  stripe: 'SEM_TARJA',
  controlType: 'ISENTO',
  price: 15.0,
  pmc: 18.0,
  pf: 12.0,
  isActive: true,
  createdAt: '2026-11-01T00:00:00.000Z',
};

const mockBatchOtc: Batch = {
  id: 101,
  productId: 1,
  batchNumber: 'LOTE-DIP-01',
  manufacturingDate: '2025-01-01T00:00:00.000Z',
  expirationDate: '2027-12-31T00:00:00.000Z',
  quantity: 50,
  reservedQuantity: 0,
  availableQuantity: 50,
  createdAt: '2025-01-01T00:00:00.000Z',
};

const mockProductControlled: Product = {
  id: 2,
  ean: '7891234567891',
  name: 'Clonazepam 2mg 30 Comprimidos',
  activeIngredient: 'Clonazepam',
  msRegistration: '1.0002.0002.002-2',
  stripe: 'PRETA',
  controlType: 'B1',
  price: 32.5,
  pmc: 38.0,
  pf: 25.0,
  isActive: true,
  createdAt: '2026-11-01T00:00:00.000Z',
};

const mockBatchControlled: Batch = {
  id: 102,
  productId: 2,
  batchNumber: 'LOTE-CNZ-99',
  manufacturingDate: '2025-02-01T00:00:00.000Z',
  expirationDate: '2027-08-15T00:00:00.000Z',
  quantity: 20,
  reservedQuantity: 0,
  availableQuantity: 20,
  createdAt: '2025-02-01T00:00:00.000Z',
};

const mockCartItemsOtc: CartItem[] = [
  {
    product: mockProductOtc,
    batch: mockBatchOtc,
    quantity: 2,
    unitPrice: 15.0,
    totalPrice: 30.0,
  },
];

const mockCartItemsControlled: CartItem[] = [
  {
    product: mockProductControlled,
    batch: mockBatchControlled,
    quantity: 1,
    unitPrice: 32.5,
    totalPrice: 32.5,
  },
];

const mockPrescription: PrescriptionDTO = {
  doctorName: 'Dr. Paulo Roberto',
  doctorCrm: '123456',
  doctorUf: 'SP',
  prescriptionType: 'B1_AZUL',
  prescriptionDate: '2026-10-25',
  patientName: 'Mariana Lima de Souza',
  buyerName: 'Mariana Lima de Souza',
  buyerCpf: '123.456.789-00',
};

describe('PreSaleTicket Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should not render anything when isOpen is false', () => {
    render(
      <PreSaleTicket
        isOpen={false}
        onClose={vi.fn()}
        preSale={{ code: 'PV-1001', totalAmount: 30.0 }}
        items={mockCartItemsOtc}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/PV-1001/i)).toBeNull();
  });

  it('should render 80mm thermal receipt with prominent pre-sale code #PV-XXXX', () => {
    render(
      <PreSaleTicket
        isOpen={true}
        onClose={vi.fn()}
        preSale={{
          code: 'PV-1001',
          createdAt: '2026-11-02T10:30:00.000Z',
          totalAmount: 30.0,
        }}
        items={mockCartItemsOtc}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    // Pre-Sale Code with prominent #PV-XXXX format
    expect(screen.getByText('#PV-1001')).toBeDefined();
    // Pharmacy header
    expect(screen.getByText(/FarmaCore/i)).toBeDefined();
    expect(screen.getByText(/Comprovante de Pré-Venda/i)).toBeDefined();
  });

  it('should display item details, batch number, formatted expiration date, and pricing', () => {
    render(
      <PreSaleTicket
        isOpen={true}
        onClose={vi.fn()}
        preSale={{
          code: 'PV-1001',
          totalAmount: 30.0,
        }}
        items={mockCartItemsOtc}
      />
    );

    // Product name
    expect(screen.getByText(/Dipirona Monoidratada 500mg/i)).toBeDefined();
    // Batch and expiration date (DD/MM/YYYY)
    expect(screen.getByText(/LOTE-DIP-01/i)).toBeDefined();
    expect(screen.getByText(/31\/12\/2027/i)).toBeDefined();
    // Quantity, unit price and subtotal
    expect(screen.getByText(/2\s*un x/i)).toBeDefined();
    expect(screen.getAllByText(/R\$\s*30,00/i).length).toBeGreaterThanOrEqual(1);
  });

  it('should display clear notice instructing customer to proceed to cashier', () => {
    render(
      <PreSaleTicket
        isOpen={true}
        onClose={vi.fn()}
        preSale={{
          code: 'PV-1001',
          totalAmount: 30.0,
        }}
        items={mockCartItemsOtc}
      />
    );

    expect(screen.getByText(/dirija-se ao caixa/i)).toBeDefined();
  });

  it('should display customer name and CPF when provided in preSale data', () => {
    render(
      <PreSaleTicket
        isOpen={true}
        onClose={vi.fn()}
        preSale={{
          code: 'PV-1001',
          totalAmount: 30.0,
          customerName: 'Carlos Drummond',
          customerCpf: '111.222.333-44',
        }}
        items={mockCartItemsOtc}
      />
    );

    expect(screen.getByText(/Carlos Drummond/i)).toBeDefined();
    expect(screen.getByText(/111\.222\.333-44/i)).toBeDefined();
  });

  it('should display controlled prescription retention section when prescription is present', () => {
    render(
      <PreSaleTicket
        isOpen={true}
        onClose={vi.fn()}
        preSale={{
          code: 'PV-2002',
          totalAmount: 32.5,
        }}
        items={mockCartItemsControlled}
        prescription={mockPrescription}
      />
    );

    // Section title
    expect(screen.getByText(/Receita Retida|Portaria 344\/98/i)).toBeDefined();
    // Doctor details
    expect(screen.getByText(/Dr\. Paulo Roberto/i)).toBeDefined();
    expect(screen.getByText(/123456/i)).toBeDefined();
    expect(screen.getByText(/CRM\/SP/i)).toBeDefined();
    // Patient details
    expect(screen.getAllByText(/Mariana Lima de Souza/i).length).toBeGreaterThanOrEqual(1);
  });

  it('should not display prescription section when prescription is null or undefined', () => {
    render(
      <PreSaleTicket
        isOpen={true}
        onClose={vi.fn()}
        preSale={{
          code: 'PV-1001',
          totalAmount: 30.0,
        }}
        items={mockCartItemsOtc}
        prescription={null}
      />
    );

    expect(screen.queryByText(/Receita Retida/i)).toBeNull();
    expect(screen.queryByText(/Portaria 344\/98/i)).toBeNull();
  });

  it('should trigger print when clicking "Imprimir Ticket" button', () => {
    const onPrint = vi.fn();
    render(
      <PreSaleTicket
        isOpen={true}
        onClose={vi.fn()}
        onPrint={onPrint}
        preSale={{
          code: 'PV-1001',
          totalAmount: 30.0,
        }}
        items={mockCartItemsOtc}
      />
    );

    const printBtn = screen.getByRole('button', { name: /imprimir/i });
    fireEvent.click(printBtn);

    expect(onPrint).toHaveBeenCalledTimes(1);
  });

  it('should call window.print when no onPrint prop is provided', () => {
    const originalPrint = window.print;
    const windowPrintMock = vi.fn();
    window.print = windowPrintMock;

    try {
      render(
        <PreSaleTicket
          isOpen={true}
          onClose={vi.fn()}
          preSale={{
            code: 'PV-1001',
            totalAmount: 30.0,
          }}
          items={mockCartItemsOtc}
        />
      );

      const printBtn = screen.getByRole('button', { name: /imprimir/i });
      fireEvent.click(printBtn);

      expect(windowPrintMock).toHaveBeenCalledTimes(1);
    } finally {
      window.print = originalPrint;
    }
  });

  it('should call onNewOrder when clicking "Novo Atendimento" button', () => {
    const onNewOrder = vi.fn();
    render(
      <PreSaleTicket
        isOpen={true}
        onClose={vi.fn()}
        onNewOrder={onNewOrder}
        preSale={{
          code: 'PV-1001',
          totalAmount: 30.0,
        }}
        items={mockCartItemsOtc}
      />
    );

    const newOrderBtn = screen.getByRole('button', { name: /novo atendimento/i });
    fireEvent.click(newOrderBtn);

    expect(onNewOrder).toHaveBeenCalledTimes(1);
  });

  it('should trigger onNewOrder when pressing F9 key', () => {
    const onNewOrder = vi.fn();
    render(
      <PreSaleTicket
        isOpen={true}
        onClose={vi.fn()}
        onNewOrder={onNewOrder}
        preSale={{
          code: 'PV-1001',
          totalAmount: 30.0,
        }}
        items={mockCartItemsOtc}
      />
    );

    fireEvent.keyDown(window, { key: 'F9' });
    expect(onNewOrder).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when clicking close button or pressing Escape key', () => {
    const onClose = vi.fn();
    render(
      <PreSaleTicket
        isOpen={true}
        onClose={onClose}
        preSale={{
          code: 'PV-1001',
          totalAmount: 30.0,
        }}
        items={mockCartItemsOtc}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByLabelText(/fechar/i);
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
