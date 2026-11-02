import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import CounterPage from '../../src/pages/CounterPage';
import * as api from '../../src/services/api';
import { Product, Batch, PreSale } from '../../src/services/api';

const mockProductOtc: Product = {
  id: 1,
  ean: '7891234567890',
  name: 'Dipirona Monoidratada 500mg',
  activeIngredient: 'Dipirona Sódica',
  msRegistration: '1.0001.0001.001-1',
  stripe: 'SEM_TARJA',
  controlType: 'ISENTO',
  price: 12.5,
  pmc: 15.0,
  pf: 10.0,
  isActive: true,
  createdAt: '2026-11-01T00:00:00.000Z',
};

const mockProductControlled: Product = {
  id: 2,
  ean: '7891234567892',
  name: 'Clonazepam 2mg 30 Comprimidos',
  activeIngredient: 'Clonazepam',
  msRegistration: '1.0003.0003.003-3',
  stripe: 'PRETA',
  controlType: 'B1',
  price: 22.0,
  pmc: 28.5,
  pf: 18.0,
  isActive: true,
  createdAt: '2026-11-01T00:00:00.000Z',
};

const mockBatchesOtc: Batch[] = [
  {
    id: 10,
    productId: 1,
    batchNumber: 'LOTE-DIP-FEFO',
    manufacturingDate: '2025-01-01T00:00:00.000Z',
    expirationDate: '2026-12-31T00:00:00.000Z',
    quantity: 50,
    reservedQuantity: 0,
    availableQuantity: 50,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 11,
    productId: 1,
    batchNumber: 'LOTE-DIP-SECUNDARIO',
    manufacturingDate: '2025-06-01T00:00:00.000Z',
    expirationDate: '2027-12-31T00:00:00.000Z',
    quantity: 100,
    reservedQuantity: 0,
    availableQuantity: 100,
    createdAt: '2025-06-01T00:00:00.000Z',
  },
];

const mockBatchesControlled: Batch[] = [
  {
    id: 20,
    productId: 2,
    batchNumber: 'LOTE-CNZ-01',
    manufacturingDate: '2025-02-01T00:00:00.000Z',
    expirationDate: '2027-05-30T00:00:00.000Z',
    quantity: 30,
    reservedQuantity: 0,
    availableQuantity: 30,
    createdAt: '2025-02-01T00:00:00.000Z',
  },
  {
    id: 21,
    productId: 2,
    batchNumber: 'LOTE-CNZ-02',
    manufacturingDate: '2025-04-01T00:00:00.000Z',
    expirationDate: '2028-05-30T00:00:00.000Z',
    quantity: 40,
    reservedQuantity: 0,
    availableQuantity: 40,
    createdAt: '2025-04-01T00:00:00.000Z',
  },
];

const mockCreatedPreSaleOtc: PreSale = {
  id: 100,
  code: 'PV-8801',
  status: 'OPEN',
  customerName: 'João da Silva',
  customerCpf: '123.456.789-00',
  totalAmount: 12.5,
  createdAt: '2026-11-02T10:00:00.000Z',
};

const mockCreatedPreSaleControlled: PreSale = {
  id: 101,
  code: 'PV-8802',
  status: 'OPEN',
  customerName: 'Maria Santos',
  customerCpf: '987.654.321-99',
  totalAmount: 22.0,
  createdAt: '2026-11-02T10:05:00.000Z',
};

describe('CounterPage Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render search bar, cart, and keyboard shortcut indicators (F2, F4, F9)', () => {
    render(<CounterPage />);

    expect(screen.getByText(/F2 - Buscar/i)).toBeDefined();
    expect(screen.getByText(/F4 - Gerar Pré-Venda/i)).toBeDefined();
    expect(screen.getByText(/F9 - Novo Atendimento/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/buscar medicamento/i)).toBeDefined();
    expect(screen.getByText(/carrinho vazio/i)).toBeDefined();
  });

  it('should focus search input when F2 shortcut is pressed', () => {
    render(<CounterPage />);

    const searchInput = screen.getByPlaceholderText(/buscar medicamento/i);
    searchInput.blur();
    expect(document.activeElement).not.toBe(searchInput);

    fireEvent.keyDown(window, { key: 'F2' });
    expect(document.activeElement).toBe(searchInput);
  });

  it('should complete integrated OTC flow: search -> select batch -> add to cart -> finalize (F4) -> API call -> display ticket', async () => {
    vi.spyOn(api, 'searchProducts').mockResolvedValue([mockProductOtc]);
    vi.spyOn(api, 'getAvailableBatches').mockResolvedValue(mockBatchesOtc);
    const createPreSaleSpy = vi
      .spyOn(api, 'createPreSale')
      .mockResolvedValue(mockCreatedPreSaleOtc);

    render(<CounterPage />);

    // 1. Search for medication
    const searchInput = screen.getByPlaceholderText(/buscar medicamento/i);
    fireEvent.change(searchInput, { target: { value: 'Dipirona' } });

    await waitFor(() => {
      expect(screen.getByText(/Dipirona Monoidratada 500mg/i)).toBeDefined();
    });

    // 2. Select product from dropdown
    fireEvent.click(screen.getByText(/Dipirona Monoidratada 500mg/i));

    // 3. BatchSelector modal opens for multiple batches
    await waitFor(() => {
      expect(screen.getByText(/Grade de Seleção de Lotes/i)).toBeDefined();
      expect(screen.getByText('LOTE-DIP-FEFO')).toBeDefined();
    });

    // 4. Select FEFO batch
    const selectBatchBtn = screen.getByTestId('select-batch-10');
    fireEvent.click(selectBatchBtn);

    // 5. Item is added to CartTable
    await waitFor(() => {
      expect(screen.getByText(/LOTE-DIP-FEFO/i)).toBeDefined();
      expect(screen.getByTestId('cart-total-amount')).toBeDefined();
    });

    // 6. Enter customer name & CPF
    const customerNameInput = screen.getByPlaceholderText(/Nome do Cliente/i);
    const customerCpfInput = screen.getByPlaceholderText(/CPF do Cliente/i);
    fireEvent.change(customerNameInput, { target: { value: 'João da Silva' } });
    fireEvent.change(customerCpfInput, { target: { value: '123.456.789-00' } });

    // 7. Finalize Pre-Sale via F4
    fireEvent.keyDown(window, { key: 'F4' });

    // 8. Verify API call
    await waitFor(() => {
      expect(createPreSaleSpy).toHaveBeenCalledTimes(1);
    });

    expect(createPreSaleSpy).toHaveBeenCalledWith({
      customerName: 'João da Silva',
      customerCpf: '123.456.789-00',
      items: [
        {
          productId: 1,
          batchId: 10,
          quantity: 1,
        },
      ],
      prescription: undefined,
    });

    // 9. PreSaleTicket opens with code #PV-8801
    await waitFor(() => {
      expect(screen.getByText('#PV-8801')).toBeDefined();
      expect(screen.getByText(/Comprovante de Pré-Venda/i)).toBeDefined();
    });

    // 10. Empty cart after successful pre-sale
    expect(screen.queryByTestId('cart-total-amount')).toBeNull();
  });

  it('should intercept with PrescriptionModal when finalizing cart with controlled medication', async () => {
    vi.spyOn(api, 'searchProducts').mockResolvedValue([mockProductControlled]);
    vi.spyOn(api, 'getAvailableBatches').mockResolvedValue(mockBatchesControlled);
    const createPreSaleSpy = vi
      .spyOn(api, 'createPreSale')
      .mockResolvedValue(mockCreatedPreSaleControlled);

    render(<CounterPage />);

    // 1. Search and select controlled medication
    const searchInput = screen.getByPlaceholderText(/buscar medicamento/i);
    fireEvent.change(searchInput, { target: { value: 'Clonazepam' } });

    await waitFor(() => {
      expect(screen.getByText(/Clonazepam 2mg 30 Comprimidos/i)).toBeDefined();
    });

    fireEvent.click(screen.getByText(/Clonazepam 2mg 30 Comprimidos/i));

    // 2. Select batch
    await waitFor(() => {
      expect(screen.getByText('LOTE-CNZ-01')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('select-batch-20'));

    // 3. Confirm item in cart
    await waitFor(() => {
      expect(screen.getByText(/LOTE-CNZ-01/i)).toBeDefined();
    });

    // 4. Trigger Finalize (F4)
    fireEvent.keyDown(window, { key: 'F4' });

    // 5. PrescriptionModal is intercepted and displayed
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText(/Retenção de Receituário Sanitário/i)).toBeDefined();
      expect(screen.getAllByText(/Clonazepam 2mg 30 Comprimidos/i).length).toBeGreaterThanOrEqual(1);
    });

    // Verify createPreSale has NOT been called yet
    expect(createPreSaleSpy).not.toHaveBeenCalled();

    // 6. Fill in mandatory prescription fields
    fireEvent.change(screen.getByLabelText(/Nome do Médico|Prescritor/i), {
      target: { value: 'Dra. Cristina Yang' },
    });
    fireEvent.change(screen.getByLabelText(/CRM|Registro Profissional/i), {
      target: { value: '554433' },
    });
    fireEvent.change(screen.getByLabelText(/UF do Conselho/i), {
      target: { value: 'SP' },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de Receituário/i), {
      target: { value: 'B1_AZUL' },
    });
    fireEvent.change(screen.getByLabelText(/Data da Receita/i), {
      target: { value: '2026-10-30' },
    });
    fireEvent.change(screen.getByLabelText(/Nome do Paciente/i), {
      target: { value: 'Maria Santos' },
    });

    // 7. Confirm Prescription
    const confirmPrescriptionBtn = screen.getByRole('button', { name: /Confirmar Receita/i });
    fireEvent.click(confirmPrescriptionBtn);

    // 8. API call should now be made with prescription DTO
    await waitFor(() => {
      expect(createPreSaleSpy).toHaveBeenCalledTimes(1);
    });

    expect(createPreSaleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            productId: 2,
            batchId: 20,
            quantity: 1,
          },
        ],
        prescription: expect.objectContaining({
          doctorName: 'Dra. Cristina Yang',
          doctorCrm: '554433',
          doctorUf: 'SP',
          prescriptionType: 'B1_AZUL',
          prescriptionDate: '2026-10-30',
          patientName: 'Maria Santos',
        }),
      })
    );

    // 9. PreSaleTicket opens with code #PV-8802 and prescription section
    await waitFor(() => {
      expect(screen.getByText('#PV-8802')).toBeDefined();
      expect(screen.getByText(/Dra\. Cristina Yang/i)).toBeDefined();
      expect(screen.getByText(/554433/i)).toBeDefined();
    });
  });

  it('should display friendly error alert and preserve cart when API createPreSale fails', async () => {
    vi.spyOn(api, 'searchProducts').mockResolvedValue([mockProductOtc]);
    vi.spyOn(api, 'getAvailableBatches').mockResolvedValue(mockBatchesOtc);
    vi.spyOn(api, 'createPreSale').mockRejectedValue(
      new Error('Estoque insuficiente no lote selecionado')
    );

    render(<CounterPage />);

    // Add item
    const searchInput = screen.getByPlaceholderText(/buscar medicamento/i);
    fireEvent.change(searchInput, { target: { value: 'Dipirona' } });

    await waitFor(() => {
      expect(screen.getByText(/Dipirona Monoidratada 500mg/i)).toBeDefined();
    });
    fireEvent.click(screen.getByText(/Dipirona Monoidratada 500mg/i));

    await waitFor(() => {
      expect(screen.getByText('LOTE-DIP-FEFO')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('select-batch-10'));

    await waitFor(() => {
      expect(screen.getByText(/LOTE-DIP-FEFO/i)).toBeDefined();
    });

    // Finalize
    fireEvent.keyDown(window, { key: 'F4' });

    // Error message displayed
    await waitFor(() => {
      expect(screen.getByText(/Estoque insuficiente no lote selecionado/i)).toBeDefined();
    });

    // Cart items are preserved
    expect(screen.getByText(/LOTE-DIP-FEFO/i)).toBeDefined();
    expect(screen.queryByText(/Comprovante de Pré-Venda/i)).toBeNull();
  });

  it('should reset cart, customer details, and error messages when F9 is pressed', async () => {
    vi.spyOn(api, 'searchProducts').mockResolvedValue([mockProductOtc]);
    vi.spyOn(api, 'getAvailableBatches').mockResolvedValue(mockBatchesOtc);

    render(<CounterPage />);

    // Add customer info
    const customerNameInput = screen.getByPlaceholderText(/Nome do Cliente/i) as HTMLInputElement;
    fireEvent.change(customerNameInput, { target: { value: 'Cliente Teste' } });
    expect(customerNameInput.value).toBe('Cliente Teste');

    // Add item to cart
    const searchInput = screen.getByPlaceholderText(/buscar medicamento/i);
    fireEvent.change(searchInput, { target: { value: 'Dipirona' } });

    await waitFor(() => {
      expect(screen.getByText(/Dipirona Monoidratada 500mg/i)).toBeDefined();
    });
    fireEvent.click(screen.getByText(/Dipirona Monoidratada 500mg/i));

    await waitFor(() => {
      expect(screen.getByText('LOTE-DIP-FEFO')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('select-batch-10'));

    await waitFor(() => {
      expect(screen.getByText(/LOTE-DIP-FEFO/i)).toBeDefined();
    });

    // Press F9 for new order
    fireEvent.keyDown(window, { key: 'F9' });

    // Customer field reset
    expect(customerNameInput.value).toBe('');
    // Cart is empty
    expect(screen.getByText(/carrinho vazio/i)).toBeDefined();
  });

  it('should show notice and not attempt API call when F4 is pressed with empty cart', () => {
    const createPreSaleSpy = vi.spyOn(api, 'createPreSale');
    render(<CounterPage />);

    fireEvent.keyDown(window, { key: 'F4' });

    expect(createPreSaleSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/Adicione ao menos um medicamento/i)).toBeDefined();
  });

  it('should prevent duplicate pre-sale submissions when F4 is pressed multiple times during submission', async () => {
    vi.spyOn(api, 'searchProducts').mockResolvedValue([mockProductOtc]);
    vi.spyOn(api, 'getAvailableBatches').mockResolvedValue(mockBatchesOtc);

    let resolveApiCall!: (val: PreSale) => void;
    const apiPromise = new Promise<PreSale>((res) => {
      resolveApiCall = res;
    });

    const createPreSaleSpy = vi
      .spyOn(api, 'createPreSale')
      .mockImplementation(() => apiPromise);

    render(<CounterPage />);

    // Add item to cart
    const searchInput = screen.getByPlaceholderText(/buscar medicamento/i);
    fireEvent.change(searchInput, { target: { value: 'Dipirona' } });

    await waitFor(() => {
      expect(screen.getByText(/Dipirona Monoidratada 500mg/i)).toBeDefined();
    });
    fireEvent.click(screen.getByText(/Dipirona Monoidratada 500mg/i));

    await waitFor(() => {
      expect(screen.getByText('LOTE-DIP-FEFO')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('select-batch-10'));

    await waitFor(() => {
      expect(screen.getByText(/LOTE-DIP-FEFO/i)).toBeDefined();
    });

    // Press F4 first time
    fireEvent.keyDown(window, { key: 'F4' });
    expect(createPreSaleSpy).toHaveBeenCalledTimes(1);

    // Press F4 second time while isSubmitting is true
    fireEvent.keyDown(window, { key: 'F4' });
    expect(createPreSaleSpy).toHaveBeenCalledTimes(1);

    // Resolve API
    await act(async () => {
      resolveApiCall(mockCreatedPreSaleOtc);
    });

    await waitFor(() => {
      expect(screen.getByText(/Comprovante de Pré-Venda/i)).toBeDefined();
    });
  });
});
