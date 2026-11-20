import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import NetworkStockModal from '../../src/components/NetworkStockModal';
import { api } from '../../src/services/api';
import type { Product, NetworkStockItem } from '../../src/types';

const mockProduct: Product = {
  id: 10,
  ean: '7891234567890',
  name: 'Dipirona Monoidratada 500mg 20 Comprimidos',
  activeIngredient: 'Dipirona Monoidratada',
  msRegistration: '1.0235.0123.001-2',
  stripe: 'SEM_TARJA',
  controlType: 'ISENTO',
  pmc: 12.5,
  pf: 8.0,
  price: 9.9,
  isActive: true,
  createdAt: '2026-11-01',
};

const mockNetworkStock: NetworkStockItem[] = [
  {
    storeId: 1,
    storeCode: 'LJ01',
    storeName: 'FarmaCore Matriz Centro',
    storeCity: 'São Paulo',
    storeState: 'SP',
    storePhone: '(11) 3333-1000',
    isHeadquarters: true,
    totalQuantity: 50,
    reservedQuantity: 5,
    availableQuantity: 45,
    earliestExpiry: '2027-12-31',
  },
  {
    storeId: 2,
    storeCode: 'LJ02',
    storeName: 'FarmaCore Filial Jardins',
    storeCity: 'São Paulo',
    storeState: 'SP',
    storePhone: '(11) 3333-2000',
    isHeadquarters: false,
    totalQuantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
    earliestExpiry: null,
  },
];

describe('NetworkStockModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'getNetworkProductStock').mockResolvedValue(mockNetworkStock);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should not render anything when isOpen is false', () => {
    const { container } = render(
      <NetworkStockModal isOpen={false} onClose={vi.fn()} product={mockProduct} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render dialog, product info and network stock table when isOpen is true', async () => {
    render(<NetworkStockModal isOpen={true} onClose={vi.fn()} product={mockProduct} />);

    expect(screen.getByTestId('network-stock-modal')).toBeDefined();
    expect(screen.getByText(/Consulta de Estoque em Rede/i)).toBeDefined();
    expect(screen.getByText(mockProduct.name)).toBeDefined();
    expect(screen.getByText(mockProduct.ean)).toBeDefined();

    await waitFor(() => {
      expect(api.getNetworkProductStock).toHaveBeenCalledWith(mockProduct.id);
      expect(screen.getByText(/FarmaCore Matriz Centro/i)).toBeDefined();
      expect(screen.getByText(/FarmaCore Filial Jardins/i)).toBeDefined();
      expect(screen.getByText('45')).toBeDefined();
      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    });
  });

  it('should call onInitiateTransfer when clicking Transferir', async () => {
    const handleTransfer = vi.fn();
    render(
      <NetworkStockModal
        isOpen={true}
        onClose={vi.fn()}
        product={mockProduct}
        onInitiateTransfer={handleTransfer}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/FarmaCore Matriz Centro/i)).toBeDefined();
    });

    const transferBtns = screen.getAllByRole('button', { name: /Transferir/i });
    fireEvent.click(transferBtns[0]);

    expect(handleTransfer).toHaveBeenCalledWith(1, mockProduct);
  });

  it('should close when close button or Esc is clicked', async () => {
    const handleClose = vi.fn();
    render(<NetworkStockModal isOpen={true} onClose={handleClose} product={mockProduct} />);

    const closeBtn = screen.getByTestId('close-network-stock-modal');
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
