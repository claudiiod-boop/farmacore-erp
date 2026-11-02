import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import PreSaleLookupModal from '../../src/components/pos/PreSaleLookupModal';
import { api, PreSaleDetails } from '../../src/services/api';

const mockOpenPreSaleDetails: PreSaleDetails = {
  preSale: {
    id: 101,
    code: 'PV-1001',
    status: 'OPEN',
    customerName: 'Maria Silva',
    customerCpf: '123.456.789-00',
    totalAmount: 85.5,
    createdAt: '2026-11-02T10:00:00.000Z',
  },
  items: [
    {
      id: 1,
      preSaleId: 101,
      productId: 50,
      productName: 'Paracetamol 500mg',
      batchId: 10,
      batchNumber: 'LOTE-PAR-01',
      quantity: 2,
      unitPrice: 15.0,
      totalPrice: 30.0,
    },
  ],
  prescription: null,
};

describe('PreSaleLookupModal Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should not render anything when isOpen is false', () => {
    render(
      <PreSaleLookupModal
        isOpen={false}
        onClose={vi.fn()}
        onLoadPreSale={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/Resgatar Pré-Venda/i)).toBeNull();
  });

  it('should render modal with focused input and placeholder when isOpen is true', () => {
    render(
      <PreSaleLookupModal
        isOpen={true}
        onClose={vi.fn()}
        onLoadPreSale={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Resgatar Pré-Venda/i)).toBeDefined();
    const input = screen.getByPlaceholderText(/#PV-XXXX|código/i);
    expect(input).toBeDefined();
  });

  it('should search pre-sale by code with leading hash, trim spaces and load pre-sale', async () => {
    const getPreSaleSpy = vi.spyOn(api, 'getPreSaleByCode').mockResolvedValue(mockOpenPreSaleDetails);
    const onLoadPreSale = vi.fn();
    const onClose = vi.fn();

    render(
      <PreSaleLookupModal
        isOpen={true}
        onClose={onClose}
        onLoadPreSale={onLoadPreSale}
      />
    );

    const input = screen.getByPlaceholderText(/#PV-XXXX|código/i);
    const submitBtn = screen.getByRole('button', { name: /Buscar|Carregar|Resgatar/i });

    // Type with leading # and spaces
    fireEvent.change(input, { target: { value: '  #PV-1001  ' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(getPreSaleSpy).toHaveBeenCalledWith('PV-1001');
      expect(onLoadPreSale).toHaveBeenCalledWith(mockOpenPreSaleDetails);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should search pre-sale by raw code without hash and trim spaces', async () => {
    const getPreSaleSpy = vi.spyOn(api, 'getPreSaleByCode').mockResolvedValue(mockOpenPreSaleDetails);
    const onLoadPreSale = vi.fn();
    const onClose = vi.fn();

    render(
      <PreSaleLookupModal
        isOpen={true}
        onClose={onClose}
        onLoadPreSale={onLoadPreSale}
      />
    );

    const input = screen.getByPlaceholderText(/#PV-XXXX|código/i);
    fireEvent.change(input, { target: { value: 'PV-1001' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(getPreSaleSpy).toHaveBeenCalledWith('PV-1001');
      expect(onLoadPreSale).toHaveBeenCalledWith(mockOpenPreSaleDetails);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should handle 404 error with friendly alert when pre-sale is not found', async () => {
    vi.spyOn(api, 'getPreSaleByCode').mockRejectedValue(new Error('Pré-venda não encontrada'));
    const onLoadPreSale = vi.fn();
    const onClose = vi.fn();

    render(
      <PreSaleLookupModal
        isOpen={true}
        onClose={onClose}
        onLoadPreSale={onLoadPreSale}
      />
    );

    const input = screen.getByPlaceholderText(/#PV-XXXX|código/i);
    const submitBtn = screen.getByRole('button', { name: /Buscar|Carregar|Resgatar/i });

    fireEvent.change(input, { target: { value: '#PV-9999' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/não encontrada|inexistente/i)).toBeDefined();
      expect(onLoadPreSale).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it('should handle closed pre-sale (CONVERTED_TO_SALE) with warning alert', async () => {
    const convertedDetails: PreSaleDetails = {
      ...mockOpenPreSaleDetails,
      preSale: {
        ...mockOpenPreSaleDetails.preSale,
        status: 'CONVERTED_TO_SALE',
      },
    };

    vi.spyOn(api, 'getPreSaleByCode').mockResolvedValue(convertedDetails);
    const onLoadPreSale = vi.fn();
    const onClose = vi.fn();

    render(
      <PreSaleLookupModal
        isOpen={true}
        onClose={onClose}
        onLoadPreSale={onLoadPreSale}
      />
    );

    const input = screen.getByPlaceholderText(/#PV-XXXX|código/i);
    fireEvent.change(input, { target: { value: '#PV-1001' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/já finalizada|já foi finalizada/i)).toBeDefined();
      expect(onLoadPreSale).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it('should handle cancelled pre-sale (CANCELLED) with warning alert', async () => {
    const cancelledDetails: PreSaleDetails = {
      ...mockOpenPreSaleDetails,
      preSale: {
        ...mockOpenPreSaleDetails.preSale,
        status: 'CANCELLED',
      },
    };

    vi.spyOn(api, 'getPreSaleByCode').mockResolvedValue(cancelledDetails);
    const onLoadPreSale = vi.fn();
    const onClose = vi.fn();

    render(
      <PreSaleLookupModal
        isOpen={true}
        onClose={onClose}
        onLoadPreSale={onLoadPreSale}
      />
    );

    const input = screen.getByPlaceholderText(/#PV-XXXX|código/i);
    fireEvent.change(input, { target: { value: '#PV-1001' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/cancelada/i)).toBeDefined();
      expect(onLoadPreSale).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it('should close on Escape key', () => {
    const onClose = vi.fn();
    render(
      <PreSaleLookupModal
        isOpen={true}
        onClose={onClose}
        onLoadPreSale={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('should close when cancel or close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <PreSaleLookupModal
        isOpen={true}
        onClose={onClose}
        onLoadPreSale={vi.fn()}
      />
    );

    const closeBtns = screen.getAllByRole('button', { name: /Cancelar|Fechar/i });
    expect(closeBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
