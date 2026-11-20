import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import InventoryPage from '../../src/pages/InventoryPage';
import StoreProvider from '../../src/contexts/StoreContext';
import { api } from '../../src/services/api';
import type {
  Store,
  InventorySessionWithItems,
  InventoryItem,
  InventoryReportResult,
} from '../../src/types';

const mockStores: Store[] = [
  {
    id: 1,
    code: 'LJ01',
    name: 'FarmaCore Matriz Centro',
    companyName: 'FarmaCore Drogaria Ltda',
    cnpj: '12.345.678/0001-90',
    ie: '123.456.789.111',
    isHeadquarters: true,
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
    companyName: 'FarmaCore Drogaria Ltda',
    cnpj: '12.345.678/0002-71',
    ie: '987.654.321.222',
    isHeadquarters: false,
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

const mockItems: InventoryItem[] = [
  {
    id: 101,
    sessionId: 1,
    productId: 10,
    productName: 'Amoxicilina 500mg',
    productEan: '7891058001111',
    batchId: 50,
    batchNumber: 'LOTE-AMX-01',
    expirationDate: '2027-12-31',
    expectedQuantity: 50,
    countedQuantity: 50,
    differenceQuantity: 0,
    differenceStatus: 'EXACT',
    unitCost: 15.0,
    totalCostDifference: 0,
    sngpcAdjusted: false,
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: '2026-11-20T10:00:00Z',
  },
  {
    id: 102,
    sessionId: 1,
    productId: 20,
    productName: 'Clonazepam 2mg (Rivotril)',
    productEan: '7891058002222',
    batchId: 60,
    batchNumber: 'LOTE-CLO-02',
    expirationDate: '2026-08-30',
    expectedQuantity: 20,
    countedQuantity: 18,
    differenceQuantity: -2,
    differenceStatus: 'SHORTAGE',
    unitCost: 25.0,
    totalCostDifference: -50.0,
    adjustmentReason: 'AJUSTE_INVENTARIO',
    sngpcAdjusted: true,
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: '2026-11-20T10:00:00Z',
  },
  {
    id: 103,
    sessionId: 1,
    productId: 30,
    productName: 'Dipirona Monoidratada 500mg',
    productEan: '7891058003333',
    batchId: 70,
    batchNumber: 'LOTE-DIP-03',
    expirationDate: '2028-05-15',
    expectedQuantity: 100,
    countedQuantity: 105,
    differenceQuantity: 5,
    differenceStatus: 'SURPLUS',
    unitCost: 4.0,
    totalCostDifference: 20.0,
    adjustmentReason: 'SOBRA_NAO_IDENTIFICADA',
    sngpcAdjusted: false,
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: '2026-11-20T10:00:00Z',
  },
];

const mockSessions: InventorySessionWithItems[] = [
  {
    id: 1,
    sessionCode: 'INV-202611-0001',
    storeId: 1,
    inventoryType: 'CONTROLADOS_SNGPC',
    status: 'OPEN',
    openedBy: 'Dra. Maria Farmacêutica',
    totalProductsExpected: 3,
    totalProductsCounted: 3,
    totalBatchesExpected: 3,
    totalBatchesCounted: 3,
    accuracyRate: 66.7,
    totalSurplusCost: 20.0,
    totalShortageCost: 50.0,
    netFinancialDifference: -30.0,
    startedAt: '2026-11-20T09:00:00Z',
    createdAt: '2026-11-20T09:00:00Z',
    updatedAt: '2026-11-20T09:00:00Z',
    items: mockItems,
    store: mockStores[0],
  },
  {
    id: 2,
    sessionCode: 'INV-202611-0002',
    storeId: 1,
    inventoryType: 'GERAL',
    status: 'COUNTED',
    openedBy: 'Carlos Auditor',
    totalProductsExpected: 10,
    totalProductsCounted: 10,
    totalBatchesExpected: 15,
    totalBatchesCounted: 15,
    accuracyRate: 95.0,
    totalSurplusCost: 100.0,
    totalShortageCost: 40.0,
    netFinancialDifference: 60.0,
    startedAt: '2026-11-19T08:00:00Z',
    createdAt: '2026-11-19T08:00:00Z',
    updatedAt: '2026-11-19T12:00:00Z',
    items: mockItems,
    store: mockStores[0],
  },
  {
    id: 3,
    sessionCode: 'INV-202611-0003',
    storeId: 2,
    inventoryType: 'ROTATIVO',
    categoryFilter: 'Dermocosméticos',
    status: 'APPLIED',
    openedBy: 'Ana Gerente',
    appliedBy: 'Dra. Maria Farmacêutica',
    responsiblePharmacistCrf: '54321',
    responsiblePharmacistUf: 'SP',
    totalProductsExpected: 5,
    totalProductsCounted: 5,
    totalBatchesExpected: 8,
    totalBatchesCounted: 8,
    accuracyRate: 100.0,
    totalSurplusCost: 0,
    totalShortageCost: 0,
    netFinancialDifference: 0,
    startedAt: '2026-11-18T10:00:00Z',
    closedAt: '2026-11-18T16:00:00Z',
    createdAt: '2026-11-18T10:00:00Z',
    updatedAt: '2026-11-18T16:00:00Z',
    items: [],
    store: mockStores[1],
  },
];

const mockReportResult: InventoryReportResult = {
  textSlip: `
================================================================================
           FARMACORE ERP - TERMO DE CONCILIACAO E BALANCO PATRIMONIAL
================================================================================
Sessao: INV-202611-0003
Filial: FarmaCore Filial Jardins
CNPJ: 12.345.678/0002-71
Modalidade: ROTATIVO (Dermocosmeticos)
Status: HOMOLOGADO E APLICADO
Acuracia Patrimonial: 100.0%
Diferenca Financeira Liquida: R$ 0,00
--------------------------------------------------------------------------------
TERMO HOMOLOGADO POR: Dra. Maria Farmaceutica (CRF-SP 54321)
================================================================================
`.trim(),
  fullEscPos: 'ESCPOS_BYTES',
  session: mockSessions[2],
  store: mockStores[1],
};

function renderInventoryPage() {
  return render(
    <StoreProvider>
      <InventoryPage />
    </StoreProvider>
  );
}

describe('InventoryPage — Módulo de Inventário, Contagem Cega e Parecer SNGPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'getStores').mockResolvedValue(mockStores);
    vi.spyOn(api, 'getInventorySessions').mockResolvedValue({
      sessions: mockSessions,
      total: mockSessions.length,
    });
    vi.spyOn(api, 'getInventorySessionById').mockImplementation(async (id: number) => {
      const found = mockSessions.find((s) => s.id === id);
      if (!found) throw new Error('Sessão não encontrada');
      return found;
    });
    vi.spyOn(api, 'createInventorySession').mockResolvedValue({
      ...mockSessions[0],
      id: 99,
      sessionCode: 'INV-202611-0099',
      items: [],
    });
    vi.spyOn(api, 'addInventoryCount').mockResolvedValue({
      ...mockItems[0],
      id: 201,
      countedQuantity: 1,
    });
    vi.spyOn(api, 'finishInventoryCount').mockResolvedValue({
      ...mockSessions[0],
      status: 'COUNTED',
    });
    vi.spyOn(api, 'recountInventoryItem').mockResolvedValue({
      ...mockItems[1],
      recountQuantity: 19,
      countedQuantity: 19,
      differenceQuantity: -1,
    });
    vi.spyOn(api, 'applyInventoryAdjustments').mockResolvedValue({
      ...mockSessions[1],
      status: 'APPLIED',
    });
    vi.spyOn(api, 'cancelInventorySession').mockResolvedValue({
      ...mockSessions[0],
      status: 'CANCELLED',
    });
    vi.spyOn(api, 'getInventoryReport').mockResolvedValue(mockReportResult);
    vi.spyOn(api, 'getProductByEan').mockResolvedValue(null);

    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the inventory page header, new inventory button, and sessions table', async () => {
    renderInventoryPage();

    expect(screen.getByText(/Módulo de Auditoria & Inventário Físico/i)).toBeDefined();
    expect(screen.getByTestId('new-inventory-button')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('INV-202611-0001')).toBeDefined();
      expect(screen.getByText('INV-202611-0002')).toBeDefined();
      expect(screen.getByText('INV-202611-0003')).toBeDefined();
    });
  });

  it('filters sessions by status when clicking status filter buttons', async () => {
    renderInventoryPage();

    await waitFor(() => {
      expect(screen.getByText('INV-202611-0001')).toBeDefined();
    });

    const openFilterBtn = screen.getByTestId('filter-open');
    fireEvent.click(openFilterBtn);

    await waitFor(() => {
      expect(api.getInventorySessions).toHaveBeenCalledWith({ status: 'OPEN' });
    });
  });

  it('opens New Inventory modal and submits a new session', async () => {
    renderInventoryPage();

    const newBtn = screen.getByTestId('new-inventory-button');
    fireEvent.click(newBtn);

    expect(screen.getByTestId('new-inventory-modal')).toBeDefined();
    expect(screen.getByTestId('new-inventory-type-select')).toBeDefined();

    // Select ROTATIVO to see category input
    const typeSelect = screen.getByTestId('new-inventory-type-select');
    fireEvent.change(typeSelect, { target: { value: 'ROTATIVO' } });

    expect(screen.getByTestId('new-inventory-category-input')).toBeDefined();
    fireEvent.change(screen.getByTestId('new-inventory-category-input'), {
      target: { value: 'Antibióticos' },
    });

    const openedByInput = screen.getByTestId('new-inventory-opened-by-input');
    fireEvent.change(openedByInput, { target: { value: 'Dr. Roberto RT' } });

    const submitBtn = screen.getByTestId('start-inventory-button');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.createInventorySession).toHaveBeenCalledWith({
        storeId: 1,
        inventoryType: 'ROTATIVO',
        categoryFilter: 'Antibióticos',
        openedBy: 'Dr. Roberto RT',
        notes: null,
      });
      // Should advance into counting panel
      expect(screen.getByText(/Contagem Cega Bip-a-Bip/i)).toBeDefined();
    });
  });

  it('enters Blind Counting Panel and registers a count bip-a-bip', async () => {
    renderInventoryPage();

    await waitFor(() => {
      expect(screen.getByTestId('continue-count-1')).toBeDefined();
    });

    // Click Continuar Contagem on Session 1
    fireEvent.click(screen.getByTestId('continue-count-1'));

    // Verify Blind Counting Panel is displayed
    expect(screen.getByText(/Contagem Cega Bip-a-Bip/i)).toBeDefined();
    expect(screen.getByText('INV-202611-0001')).toBeDefined();
    expect(screen.getByTestId('count-ean-input')).toBeDefined();
    expect(screen.getByTestId('count-batch-input')).toBeDefined();
    expect(screen.getByTestId('count-expiry-input')).toBeDefined();
    expect(screen.getByTestId('count-quantity-input')).toBeDefined();
    expect(screen.getByTestId('count-incremental-toggle')).toBeDefined();

    // Verify expected quantities are BLIND / NOT shown in the table
    expect(screen.queryByText(/Qtd Esperada/i)).toBeNull();

    // Fill count form
    fireEvent.change(screen.getByTestId('count-ean-input'), {
      target: { value: '7891058001111' },
    });
    fireEvent.change(screen.getByTestId('count-batch-input'), {
      target: { value: 'LOTE-AMX-01' },
    });
    fireEvent.change(screen.getByTestId('count-expiry-input'), {
      target: { value: '2027-12-31' },
    });
    fireEvent.change(screen.getByTestId('count-quantity-input'), {
      target: { value: '5' },
    });

    // Submit count
    fireEvent.click(screen.getByTestId('submit-count-button'));

    await waitFor(() => {
      expect(api.addInventoryCount).toHaveBeenCalledWith(1, {
        ean: '7891058001111',
        batchNumber: 'LOTE-AMX-01',
        expirationDate: '2027-12-31',
        quantity: 5,
        isIncremental: true,
      });
      expect(screen.getByTestId('count-success-alert')).toBeDefined();
    });

    // Click Finalizar Contagens Físicas
    const finishBtn = screen.getByTestId('finish-counting-button');
    fireEvent.click(finishBtn);

    await waitFor(() => {
      expect(api.finishInventoryCount).toHaveBeenCalledWith(1);
      // Transitions to Reconciliation panel
      expect(screen.getByText(/Conciliação & Homologação de Inventário/i)).toBeDefined();
    });
  });

  it('enters Reconciliation Panel, displays KPIs, changes reasons, recounts item, and applies adjustments with SNGPC CRF/UF', async () => {
    renderInventoryPage();

    await waitFor(() => {
      expect(screen.getByTestId('reconcile-2')).toBeDefined();
    });

    // Click Conciliar & Homologar on Session 2
    fireEvent.click(screen.getByTestId('reconcile-2'));

    // Check Reconciliation header and KPI cards
    expect(screen.getByText(/Conciliação & Homologação de Inventário/i)).toBeDefined();
    expect(screen.getByText(/Acurácia Patrimonial/i)).toBeDefined();
    expect(screen.getByText('95.0%')).toBeDefined();
    expect(screen.getByText(/Custo Sobras/i)).toBeDefined();
    expect(screen.getByText(/Custo Faltas/i)).toBeDefined();

    // Check comparative table contains items and divergence statuses
    expect(screen.getByText('Clonazepam 2mg (Rivotril)')).toBeDefined();
    expect(screen.getByText('LOTE-CLO-02')).toBeDefined();
    expect(screen.getByText('FALTA')).toBeDefined();
    expect(screen.getByText('SOBRA')).toBeDefined();
    expect(screen.getByText('EXACT')).toBeDefined();

    // Select reason for divergence
    const reasonSelect = screen.getByTestId('select-reason-102');
    fireEvent.change(reasonSelect, { target: { value: 'FURTO_EXTRAVIO' } });
    expect((reasonSelect as HTMLSelectElement).value).toBe('FURTO_EXTRAVIO');

    // Recount item 102
    const recountBtn = screen.getByTestId('recount-button-102');
    fireEvent.click(recountBtn);

    expect(screen.getByTestId('recount-modal')).toBeDefined();
    const recountInput = screen.getByTestId('recount-quantity-input');
    fireEvent.change(recountInput, { target: { value: '19' } });

    const confirmRecountBtn = screen.getByTestId('confirm-recount-button');
    fireEvent.click(confirmRecountBtn);

    await waitFor(() => {
      expect(api.recountInventoryItem).toHaveBeenCalledWith(2, 102, 19);
    });

    // Check SNGPC regulatory banner is present due to Clonazepam divergence
    expect(screen.getByTestId('sngpc-divergence-warning')).toBeDefined();
    const crfInput = screen.getByTestId('pharmacist-crf-input');
    const ufInput = screen.getByTestId('pharmacist-uf-input');
    fireEvent.change(crfInput, { target: { value: '98765' } });
    fireEvent.change(ufInput, { target: { value: 'SP' } });

    // Apply adjustments
    const applyBtn = screen.getByTestId('apply-adjustments-button');
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(api.applyInventoryAdjustments).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          appliedBy: expect.any(String),
          responsiblePharmacistCrf: '98765',
          responsiblePharmacistUf: 'SP',
          itemReasons: expect.objectContaining({
            102: expect.objectContaining({ reason: 'FURTO_EXTRAVIO' }),
          }),
        })
      );
    });
  });

  it('views balance slip modal on an applied inventory session', async () => {
    renderInventoryPage();

    await waitFor(() => {
      expect(screen.getByTestId('view-slip-3')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('view-slip-3'));

    await waitFor(() => {
      expect(api.getInventoryReport).toHaveBeenCalledWith(3);
      expect(screen.getByTestId('inventory-slip-modal')).toBeDefined();
      expect(
        screen.getByText(/TERMO DE CONCILIACAO E BALANCO PATRIMONIAL/i)
      ).toBeDefined();
    });

    // Copy button test
    const copyBtn = screen.getByTestId('copy-slip-button');
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(mockReportResult.textSlip);
    });
  });

  it('cancels an open session with reason', async () => {
    renderInventoryPage();

    await waitFor(() => {
      expect(screen.getByTestId('cancel-session-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('cancel-session-1'));

    expect(screen.getByTestId('cancel-inventory-modal')).toBeDefined();
    const reasonInput = screen.getByTestId('cancel-reason-input');
    fireEvent.change(reasonInput, {
      target: { value: 'Queda de energia no galpão central' },
    });

    const confirmCancelBtn = screen.getByTestId('confirm-cancel-button');
    fireEvent.click(confirmCancelBtn);

    await waitFor(() => {
      expect(api.cancelInventorySession).toHaveBeenCalledWith(
        1,
        'Queda de energia no galpão central'
      );
    });
  });
});
