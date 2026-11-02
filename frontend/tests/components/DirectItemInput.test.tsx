import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import DirectItemInput from '../../src/components/pos/DirectItemInput';
import { api, Product, Batch } from '../../src/services/api';

const mockOtcProduct: Product = {
  id: 201,
  ean: '7891234567890',
  name: 'Dipirona Monoidratada 500mg',
  activeIngredient: 'Dipirona',
  msRegistration: '1.0001.0001.001-1',
  stripe: 'SEM_TARJA',
  controlType: 'ISENTO',
  pmc: 12.0,
  pf: 8.0,
  price: 9.5,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockControlledProduct: Product = {
  id: 202,
  ean: '7899999999999',
  name: 'Clonazepam 2.5mg/ml Gotas',
  activeIngredient: 'Clonazepam',
  msRegistration: '1.0002.0002.002-2',
  stripe: 'PRETA',
  controlType: 'B1',
  pmc: 35.0,
  pf: 24.0,
  price: 28.0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockAntimicrobialProduct: Product = {
  id: 203,
  ean: '7898888888888',
  name: 'Amoxicilina 500mg 21 Cápsulas',
  activeIngredient: 'Amoxicilina Tri-hidratada',
  msRegistration: '1.0003.0003.003-3',
  stripe: 'VERMELHA',
  controlType: 'ANTIMICROBIANO',
  pmc: 48.0,
  pf: 32.0,
  price: 39.9,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockBatches: Batch[] = [
  {
    id: 11,
    productId: 201,
    batchNumber: 'LOTE-DIP-LATER',
    manufacturingDate: '2025-01-01T00:00:00.000Z',
    expirationDate: '2027-12-31T00:00:00.000Z',
    quantity: 50,
    reservedQuantity: 0,
    availableQuantity: 30,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 12,
    productId: 201,
    batchNumber: 'LOTE-DIP-EARLIEST',
    manufacturingDate: '2025-01-01T00:00:00.000Z',
    expirationDate: '2026-08-15T00:00:00.000Z', // Menor validade entre os disponíveis (FEFO)
    quantity: 20,
    reservedQuantity: 0,
    availableQuantity: 10,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 13,
    productId: 201,
    batchNumber: 'LOTE-DIP-ZERO-STOCK',
    manufacturingDate: '2024-01-01T00:00:00.000Z',
    expirationDate: '2025-05-01T00:00:00.000Z', // Vencimento anterior, mas sem estoque disponível
    quantity: 10,
    reservedQuantity: 10,
    availableQuantity: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];

describe('DirectItemInput Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render scanner input, placeholder and submit button', () => {
    render(<DirectItemInput onAddDirectItem={vi.fn()} />);

    expect(screen.getByPlaceholderText(/EAN-13|código de barras|conveniência/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Bipar|Adicionar|Buscar/i })).toBeDefined();
  });

  it('should focus input when [F2] keyboard shortcut is pressed', () => {
    render(<DirectItemInput onAddDirectItem={vi.fn()} />);

    const input = screen.getByPlaceholderText(/EAN-13|código de barras|conveniência/i);
    fireEvent.keyDown(window, { key: 'F2' });

    expect(document.activeElement).toBe(input);
  });

  it('should scan EAN, select earliest available expiration batch (FEFO), call onAddDirectItem and clear input', async () => {
    const getProductSpy = vi.spyOn(api, 'getProductByEan').mockResolvedValue(mockOtcProduct);
    const getBatchesSpy = vi.spyOn(api, 'getAvailableBatches').mockResolvedValue(mockBatches);
    const onAddDirectItem = vi.fn();

    render(<DirectItemInput onAddDirectItem={onAddDirectItem} />);

    const input = screen.getByPlaceholderText(/EAN-13|código de barras|conveniência/i);
    const form = input.closest('form')!;

    fireEvent.change(input, { target: { value: '7891234567890' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(getProductSpy).toHaveBeenCalledWith('7891234567890');
      expect(getBatchesSpy).toHaveBeenCalledWith(201);
      // Selected batch must be the earliest valid batch with availableQuantity > 0 (id 12)
      expect(onAddDirectItem).toHaveBeenCalledWith(mockOtcProduct, mockBatches[1]);
      // Input must be cleared after successful addition
      expect((input as HTMLInputElement).value).toBe('');
    });
  });

  it('should block controlled medicine (Portaria 344/98) and show regulatory barrier alert without calling onAddDirectItem', async () => {
    const getProductSpy = vi.spyOn(api, 'getProductByEan').mockResolvedValue(mockControlledProduct);
    const getBatchesSpy = vi.spyOn(api, 'getAvailableBatches');
    const onAddDirectItem = vi.fn();

    render(<DirectItemInput onAddDirectItem={onAddDirectItem} />);

    const input = screen.getByPlaceholderText(/EAN-13|código de barras|conveniência/i);
    fireEvent.change(input, { target: { value: '7899999999999' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(getProductSpy).toHaveBeenCalledWith('7899999999999');
      expect(getBatchesSpy).not.toHaveBeenCalled();
      expect(onAddDirectItem).not.toHaveBeenCalled();
      expect(
        screen.getByText(/controlado|balcão|portaria 344|retenção de receita|não permitid/i)
      ).toBeDefined();
    });
  });

  it('should block antimicrobial medicine and show regulatory barrier alert', async () => {
    vi.spyOn(api, 'getProductByEan').mockResolvedValue(mockAntimicrobialProduct);
    const onAddDirectItem = vi.fn();

    render(<DirectItemInput onAddDirectItem={onAddDirectItem} />);

    const input = screen.getByPlaceholderText(/EAN-13|código de barras|conveniência/i);
    fireEvent.change(input, { target: { value: '7898888888888' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(onAddDirectItem).not.toHaveBeenCalled();
      expect(
        screen.getByText(/controlado|balcão|receita|não permitid/i)
      ).toBeDefined();
    });
  });

  it('should handle product not found by EAN', async () => {
    vi.spyOn(api, 'getProductByEan').mockResolvedValue(null);
    const onAddDirectItem = vi.fn();

    render(<DirectItemInput onAddDirectItem={onAddDirectItem} />);

    const input = screen.getByPlaceholderText(/EAN-13|código de barras|conveniência/i);
    fireEvent.change(input, { target: { value: '7890000000000' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/não encontrado/i)).toBeDefined();
      expect(onAddDirectItem).not.toHaveBeenCalled();
    });
  });

  it('should handle product with zero available stock across all batches', async () => {
    vi.spyOn(api, 'getProductByEan').mockResolvedValue(mockOtcProduct);
    vi.spyOn(api, 'getAvailableBatches').mockResolvedValue([
      {
        ...mockBatches[0],
        availableQuantity: 0,
      },
    ]);
    const onAddDirectItem = vi.fn();

    render(<DirectItemInput onAddDirectItem={onAddDirectItem} />);

    const input = screen.getByPlaceholderText(/EAN-13|código de barras|conveniência/i);
    fireEvent.change(input, { target: { value: '7891234567890' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/sem estoque|estoque indisponível/i)).toBeDefined();
      expect(onAddDirectItem).not.toHaveBeenCalled();
    });
  });

  it('should disable input and button when disabled prop is true', () => {
    render(<DirectItemInput onAddDirectItem={vi.fn()} disabled={true} />);

    const input = screen.getByPlaceholderText(/EAN-13|código de barras|conveniência/i);
    const btn = screen.getByRole('button', { name: /Bipar|Adicionar|Buscar/i });

    expect((input as HTMLInputElement).disabled).toBe(true);
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
