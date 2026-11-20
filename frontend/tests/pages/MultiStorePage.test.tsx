import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import MultiStorePage from '../../src/pages/MultiStorePage';
import StoreProvider from '../../src/contexts/StoreContext';
import { api } from '../../src/services/api';
import type { Store, TransferWithItems, NetworkStockItem, TransferSlipResult } from '../../src/types';

const mockStores: Store[] = [
  {
    id: 1,
    code: 'LJ01',
    name: 'FarmaCore Matriz Centro',
    companyName: 'FarmaCore Drogaria e Perfumaria Ltda',
    cnpj: '12.345.678/0001-90',
    ie: '123.456.789.111',
    isHeadquarters: true,
    phone: '(11) 3333-1000',
    email: 'matriz@farmacore.com.br',
    street: 'Avenida Paulista',
    number: '1000',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01310-100',
    ibgeCode: '3550308',
    taxRegime: 'LUCRO_PRESUMIDO',
    isActive: true,
  },
  {
    id: 2,
    code: 'LJ02',
    name: 'FarmaCore Filial Jardins',
    companyName: 'FarmaCore Drogaria e Perfumaria Ltda',
    cnpj: '12.345.678/0002-71',
    ie: '987.654.321.222',
    isHeadquarters: false,
    phone: '(11) 3333-2000',
    email: 'jardins@farmacore.com.br',
    street: 'Rua Oscar Freire',
    number: '500',
    neighborhood: 'Cerqueira César',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01426-001',
    ibgeCode: '3550308',
    taxRegime: 'LUCRO_PRESUMIDO',
    isActive: true,
  },
];

const mockTransfers: TransferWithItems[] = [
  {
    id: 1,
    transferNumber: 'TRF-202611-0001',
    sourceStoreId: 1,
    targetStoreId: 2,
    status: 'DRAFT',
    requestedBy: 'Carlos Farmacêutico',
    cfop: '5.152',
    createdAt: '2026-11-19T10:00:00Z',
    updatedAt: '2026-11-19T10:00:00Z',
    items: [
      {
        id: 101,
        transferId: 1,
        productId: 10,
        productName: 'Dipirona 500mg',
        batchNumber: 'LOTE001',
        expirationDate: '2027-12-31',
        manufacturingDate: '2025-01-01',
        requestedQuantity: 20,
        shippedQuantity: 0,
        receivedQuantity: 0,
        unitCost: 5.5,
        totalCost: 110,
        createdAt: '2026-11-19T10:00:00Z',
      },
    ],
    sourceStore: mockStores[0],
    targetStore: mockStores[1],
  },
  {
    id: 2,
    transferNumber: 'TRF-202611-0002',
    sourceStoreId: 1,
    targetStoreId: 2,
    status: 'IN_TRANSIT',
    requestedBy: 'Carlos Farmacêutico',
    dispatchedBy: 'Expedição Matriz',
    carrierName: 'Log Express',
    trackingCode: 'TRK-9999',
    cfop: '5.152',
    dispatchedAt: '2026-11-19T11:00:00Z',
    createdAt: '2026-11-19T10:30:00Z',
    updatedAt: '2026-11-19T11:00:00Z',
    items: [
      {
        id: 102,
        transferId: 2,
        productId: 20,
        productName: 'Amoxicilina 500mg',
        batchNumber: 'AMX-2026',
        expirationDate: '2026-12-31',
        manufacturingDate: '2024-06-01',
        requestedQuantity: 15,
        shippedQuantity: 15,
        receivedQuantity: 0,
        unitCost: 12.0,
        totalCost: 180,
        createdAt: '2026-11-19T10:30:00Z',
      },
    ],
    sourceStore: mockStores[0],
    targetStore: mockStores[1],
  },
];

const mockNetworkStock: NetworkStockItem[] = [
  {
    storeId: 1,
    storeCode: 'LJ01',
    storeName: 'FarmaCore Matriz Centro',
    storeCity: 'São Paulo',
    storeState: 'SP',
    isHeadquarters: true,
    totalQuantity: 100,
    reservedQuantity: 5,
    availableQuantity: 95,
    earliestExpiry: '2027-12-31',
    batchCount: 2,
  },
  {
    storeId: 2,
    storeCode: 'LJ02',
    storeName: 'FarmaCore Filial Jardins',
    storeCity: 'São Paulo',
    storeState: 'SP',
    isHeadquarters: false,
    totalQuantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
    earliestExpiry: null,
    batchCount: 0,
  },
];

const mockSlip: TransferSlipResult = {
  textSlip: '==============================================\n   FARMACORE ERP - ROMANEIO DE TRANSFERÊNCIA\n==============================================\nTransferência: TRF-202611-0002\nOrigem: FarmaCore Matriz Centro\nDestino: FarmaCore Filial Jardins\nItem: Amoxicilina 500mg - Qtd: 15\n==============================================',
  fullEscPos: '\x1b\x40...',
};

describe('MultiStorePage Component & Tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'getStores').mockResolvedValue(mockStores);
    vi.spyOn(api, 'getTransfers').mockResolvedValue({
      transfers: mockTransfers,
      total: mockTransfers.length,
    });
    vi.spyOn(api, 'getTransferSlip').mockResolvedValue(mockSlip);
    vi.spyOn(api, 'getNetworkProductStock').mockResolvedValue(mockNetworkStock);
    vi.spyOn(api, 'createStore').mockResolvedValue(mockStores[1]);
    vi.spyOn(api, 'createTransfer').mockResolvedValue(mockTransfers[0]);
    vi.spyOn(api, 'dispatchTransfer').mockResolvedValue({
      ...mockTransfers[0],
      status: 'IN_TRANSIT',
    });
    vi.spyOn(api, 'receiveTransfer').mockResolvedValue({
      ...mockTransfers[1],
      status: 'RECEIVED',
    });
    vi.spyOn(api, 'cancelTransfer').mockResolvedValue({
      ...mockTransfers[0],
      status: 'CANCELLED',
    });
    vi.spyOn(api, 'emitTransferNfe').mockResolvedValue({
      transferId: 2,
      nfeKey: '35261112345678000190550010000000021000000025',
      protocol: '135260000000002',
      cfop: '5.152',
      status: 'AUTORIZADA',
      xml: '<nfeProc>...</nfeProc>',
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderComponent = () => {
    return render(
      <StoreProvider>
        <MultiStorePage />
      </StoreProvider>
    );
  };

  it('should render the main header and 3 tabs: Rede & Filiais, Transferências, and Estoque', async () => {
    renderComponent();

    expect(screen.getByText(/Gestão Multi-Loja & Transferências em Rede/i)).toBeDefined();
    expect(screen.getByTestId('tab-stores')).toBeDefined();
    expect(screen.getByTestId('tab-transfers')).toBeDefined();
    expect(screen.getByTestId('tab-stock')).toBeDefined();
  });

  it('should display list of stores with Matriz and Filial badges in Tab 1', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('FarmaCore Matriz Centro')).toBeDefined();
      expect(screen.getByText('FarmaCore Filial Jardins')).toBeDefined();
      expect(screen.getByText('12.345.678/0001-90')).toBeDefined();
      expect(screen.getByText('12.345.678/0002-71')).toBeDefined();
    });
  });

  it('should open NewStoreModal when clicking Nova Loja / Filial', async () => {
    renderComponent();

    const newStoreBtn = screen.getByTestId('new-store-button');
    fireEvent.click(newStoreBtn);

    expect(screen.getByTestId('new-store-modal')).toBeDefined();
    expect(screen.getByText(/Cadastrar Nova Loja \/ Filial/i)).toBeDefined();
  });

  it('should switch to Transferências tab and display list of transfers', async () => {
    renderComponent();

    const tabTransfers = screen.getByTestId('tab-transfers');
    fireEvent.click(tabTransfers);

    await waitFor(() => {
      expect(api.getTransfers).toHaveBeenCalled();
      expect(screen.getByText('TRF-202611-0001')).toBeDefined();
      expect(screen.getByText('TRF-202611-0002')).toBeDefined();
      expect(screen.getByText('Rascunho')).toBeDefined();
      expect(screen.getByText('Em Trânsito')).toBeDefined();
    });
  });

  it('should open NewTransferModal when clicking Nova Transferência', async () => {
    renderComponent();

    fireEvent.click(screen.getByTestId('tab-transfers'));

    await waitFor(() => {
      expect(screen.getByTestId('new-transfer-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('new-transfer-button'));
    expect(screen.getByTestId('new-transfer-modal')).toBeDefined();
    expect(screen.getByText(/Nova Transferência entre Filiais/i)).toBeDefined();
  });

  it('should open Romaneio modal when clicking Romaneio on IN_TRANSIT transfer', async () => {
    renderComponent();

    fireEvent.click(screen.getByTestId('tab-transfers'));

    await waitFor(() => {
      expect(screen.getByText('TRF-202611-0002')).toBeDefined();
    });

    const romaneioBtns = screen.getAllByRole('button', { name: /Romaneio/i });
    fireEvent.click(romaneioBtns[0]);

    await waitFor(() => {
      expect(api.getTransferSlip).toHaveBeenCalledWith(2);
      expect(screen.getByTestId('transfer-slip-modal')).toBeDefined();
      expect(screen.getByText(/FARMACORE ERP - ROMANEIO DE TRANSFERÊNCIA/i)).toBeDefined();
    });
  });

  it('should switch to Consulta Global de Estoque tab', async () => {
    renderComponent();

    fireEvent.click(screen.getByTestId('tab-stock'));

    expect(screen.getByText(/Consulta Global de Estoque em Rede/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Pesquisar medicamento por Nome, EAN/i)).toBeDefined();
  });
});
