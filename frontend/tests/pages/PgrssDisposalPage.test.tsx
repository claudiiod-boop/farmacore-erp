import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { PgrssDisposalPage } from '../../src/pages/PgrssDisposalPage';
import { pgrssApi, storesApi, searchProducts, getAvailableBatches } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  pgrssApi: {
    segregateWaste: vi.fn(),
    listRecords: vi.fn(),
    createManifest: vi.fn(),
    listManifests: vi.fn(),
    getManifestDocument: vi.fn(),
    finalizeCdf: vi.fn(),
    getKpis: vi.fn(),
  },
  storesApi: {
    listStores: vi.fn(),
  },
  searchProducts: vi.fn(),
  getAvailableBatches: vi.fn(),
}));

describe('PgrssDisposalPage (Descarte Sanitário & PGRSS RDC 222/2018)', () => {
  const originalAlert = window.alert;

  afterEach(() => {
    window.alert = originalAlert;
    cleanup();
  });

  const mockKpis = {
    stored_records_count: 3,
    stored_weight_kg: 1.45,
    dispatched_records_count: 5,
    dispatched_weight_kg: 4.2,
    incinerated_records_count: 12,
    incinerated_weight_kg: 10.8,
    active_manifests_count: 2,
    finalized_manifests_count: 8,
  };

  const mockStoredRecords = [
    {
      id: 1,
      store_id: 1,
      product_id: 10,
      batch_id: 20,
      waste_group: 'GRUPO_B_QUIMICO' as const,
      reason: 'VENCIDO' as const,
      quantity: 5,
      weight_kg: 0.45,
      pharmacist_name: 'Dra. Camila',
      pharmacist_crf: 'CRF-SP 44321',
      status: 'STORED' as const,
      created_at: '2026-11-20',
      product_name: 'Amoxicilina 500mg',
      batch_number: 'L-AMOX-01',
    },
    {
      id: 2,
      store_id: 1,
      product_id: 11,
      batch_id: 21,
      waste_group: 'GRUPO_B_QUIMICO' as const,
      reason: 'AVARIADO' as const,
      quantity: 2,
      weight_kg: 0.2,
      pharmacist_name: 'Dra. Camila',
      pharmacist_crf: 'CRF-SP 44321',
      status: 'STORED' as const,
      created_at: '2026-11-21',
      product_name: 'Omeprazol 20mg',
      batch_number: 'L-OMEP-02',
    },
  ];

  const mockManifests = [
    {
      id: 100,
      store_id: 1,
      manifest_number: 'MTR-202611-0001',
      collector_name: 'Biotrat Ambiental Ltda',
      collector_cnpj: '12.345.678/0001-90',
      environmental_license: 'LO-IBAMA-9988/2025',
      vehicle_plate: 'ABC-1D23',
      driver_name: 'Carlos Motorista',
      total_weight_kg: 4.2,
      total_items: 5,
      dispatch_date: '2026-11-22',
      status: 'DISPATCHED' as const,
      created_at: '2026-11-22',
    },
  ];

  beforeEach(() => {
    window.alert = vi.fn();
    vi.clearAllMocks();

    vi.mocked(pgrssApi.getKpis).mockResolvedValue(mockKpis);
    vi.mocked(pgrssApi.listRecords).mockResolvedValue(mockStoredRecords);
    vi.mocked(pgrssApi.listManifests).mockResolvedValue(mockManifests);
    vi.mocked(storesApi.listStores).mockResolvedValue([
      { id: 1, name: 'FarmaCore Matriz Centro' },
    ]);
  });

  it('renders PGRSS dashboard header, KPI cards and stored waste table', async () => {
    render(<PgrssDisposalPage />);

    expect(screen.getByText(/Descarte Sanitário & PGRSS/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId('kpi-stored-weight').textContent).toContain('1.450 kg');
      expect(screen.getByTestId('kpi-dispatched-weight').textContent).toContain('4.200 kg');
      expect(screen.getByTestId('kpi-incinerated-weight').textContent).toContain('10.800 kg');
    });

    expect(screen.getByText('Amoxicilina 500mg')).toBeDefined();
    expect(screen.getByText('Omeprazol 20mg')).toBeDefined();
  });

  it('selects stored waste item and emits MTR manifest', async () => {
    vi.mocked(pgrssApi.createManifest).mockResolvedValue({
      id: 101,
      manifest_number: 'MTR-202611-0002',
    } as any);

    render(<PgrssDisposalPage />);

    await waitFor(() => {
      expect(screen.getByTestId('select-record-1')).toBeDefined();
    });

    // Marca o checkbox do item 1
    fireEvent.click(screen.getByTestId('select-record-1'));

    // Botão Emitir MTR deve estar habilitado
    const mtrBtn = screen.getByTestId('open-mtr-modal-button');
    expect(mtrBtn).toBeDefined();
    fireEvent.click(mtrBtn);

    expect(screen.getByText('Emitir Manifesto de Transporte de Resíduos (MTR)')).toBeDefined();

    // Submete a emissão do MTR
    fireEvent.click(screen.getByTestId('mtr-submit-button'));

    await waitFor(() => {
      expect(pgrssApi.createManifest).toHaveBeenCalledWith(
        expect.objectContaining({
          disposal_record_ids: [1],
        })
      );
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('emitido com sucesso'));
    });
  });

  it('navigates to Manifests tab, views document and finalizes CDF', async () => {
    vi.mocked(pgrssApi.getManifestDocument).mockResolvedValue({
      document: '================== MTR TESTE DOCUMENTO ==================',
    });
    vi.mocked(pgrssApi.finalizeCdf).mockResolvedValue({} as any);

    render(<PgrssDisposalPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-manifests')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('tab-manifests'));

    expect(screen.getByText('MTR-202611-0001')).toBeDefined();
    expect(screen.getByText('Biotrat Ambiental Ltda')).toBeDefined();

    // Clica em Espelho MTR
    fireEvent.click(screen.getByTestId('view-document-button-100'));
    await waitFor(() => {
      expect(pgrssApi.getManifestDocument).toHaveBeenCalledWith(100);
      expect(screen.getByText(/MTR TESTE DOCUMENTO/)).toBeDefined();
    });

    // Clica em Informar CDF
    fireEvent.click(screen.getByTestId('open-cdf-modal-button-100'));
    expect(screen.getByText('Registrar Certificado de Destinação Final (CDF)')).toBeDefined();

    fireEvent.change(screen.getByTestId('cdf-number-input'), {
      target: { value: 'CDF-2026-TESTE-99' },
    });

    fireEvent.click(screen.getByTestId('cdf-submit-button'));

    await waitFor(() => {
      expect(pgrssApi.finalizeCdf).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          cdf_number: 'CDF-2026-TESTE-99',
        })
      );
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('registrado com sucesso'));
    });
  });

  it('opens segregate waste modal and submits new item to shelter', async () => {
    vi.mocked(searchProducts).mockResolvedValue([
      { id: 99, name: 'Dipirona 500mg', ean: '789999999999' },
    ]);
    vi.mocked(getAvailableBatches).mockResolvedValue([
      { id: 88, batch_number: 'L-DIP-01', quantity: 15, expiration_date: '2025-01-01' },
    ]);
    vi.mocked(pgrssApi.segregateWaste).mockResolvedValue({} as any);

    render(<PgrssDisposalPage />);

    await waitFor(() => {
      expect(screen.getByTestId('open-segregate-modal-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('open-segregate-modal-button'));

    expect(screen.getByText('Segregar Medicamento para Descarte Sanitário')).toBeDefined();

    // Pesquisa produto
    fireEvent.change(screen.getByTestId('segregate-product-search-input'), {
      target: { value: 'Dipirona' },
    });

    await waitFor(() => {
      expect(screen.getByText('Dipirona 500mg')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Dipirona 500mg'));

    // Altera quantidade e peso
    fireEvent.change(screen.getByTestId('segregate-quantity-input'), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByTestId('segregate-weight-input'), {
      target: { value: '0.25' },
    });

    fireEvent.click(screen.getByTestId('segregate-submit-button'));

    await waitFor(() => {
      expect(pgrssApi.segregateWaste).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: 99,
          quantity: 3,
          weight_kg: 0.25,
        })
      );
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('armazenado no abrigo'));
    });
  });
});
