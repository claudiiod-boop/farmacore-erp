import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { FractionationPage } from '../../src/pages/FractionationPage';
import { fractionationApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  fractionationApi: {
    listFractionableProducts: vi.fn(),
    toggleProductFractionable: vi.fn(),
    fractionateMedicine: vi.fn(),
    listFractionationRecords: vi.fn(),
    getFractionationRecord: vi.fn(),
    dispenseFractioned: vi.fn(),
    getOfficialLabel: vi.fn(),
    getFractionationKpis: vi.fn(),
  },
}));

describe('FractionationPage (Fracionamento de Medicamentos em Blíster - RDC 80/2006)', () => {
  const originalAlert = window.alert;

  afterEach(() => {
    window.alert = originalAlert;
    cleanup();
  });

  beforeEach(() => {
    window.alert = vi.fn();
    vi.clearAllMocks();

    vi.mocked(fractionationApi.getFractionationKpis).mockResolvedValue({
      totalFractionations: 5,
      activeSubBatches: 3,
      totalUnitsAvailable: 78,
      totalDispensations: 14,
      fractionableProductsCount: 8,
      estimatedConsumerSavings: 420.5,
    });

    vi.mocked(fractionationApi.listFractionableProducts).mockResolvedValue([
      {
        id: 1,
        ean: '7891234567800',
        name: 'Amoxicilina 500mg 21 caps',
        active_ingredient: 'Amoxicilina',
        ms_registration: '100000099',
        stripe: 'RED',
        price: 35.0,
        is_fractionable: 1,
        units_per_package: 21,
        fractional_unit: 'CAPSULA',
      },
    ]);

    vi.mocked(fractionationApi.listFractionationRecords).mockResolvedValue([
      {
        id: 10,
        store_id: 1,
        product_id: 1,
        original_batch_id: 1,
        pharmacist_name: 'Dra. Camila Farmacêutica',
        pharmacist_crf: '99887',
        pharmacist_crf_uf: 'SP',
        original_packages_opened: 1,
        units_generated: 21,
        units_available: 15,
        sub_batch_code: 'FRAC-LOTE-AMOX-01',
        fractionation_date: '2026-11-23',
        expiry_date: '2028-01-01',
        notes: null,
        created_at: '2026-11-23',
        product_name: 'Amoxicilina 500mg 21 caps',
        original_batch_number: 'LOTE-AMOX-01',
      },
    ]);
  });

  it('should render header, KPI cards and default fractionation workbench', async () => {
    render(<FractionationPage />);

    await waitFor(() => {
      expect(screen.getByText('Fracionamento Farmacêutico em Blíster')).toBeDefined();
      expect(screen.getByText('Novo Fracionamento')).toBeDefined();
      expect(screen.getByText('R$ 420.50')).toBeDefined();
      expect(screen.getByText('Bancada de Fracionamento & Sublotes')).toBeDefined();
      expect(screen.getByText('Dispensação & Rótulo Oficial RDC 80')).toBeDefined();
      expect(screen.getByText('Catálogo de Embalagens Fracionáveis')).toBeDefined();
      expect(screen.getByText('FRAC-LOTE-AMOX-01')).toBeDefined();
    });
  });

  it('should trigger fractionation from workbench form', async () => {
    vi.mocked(fractionationApi.fractionateMedicine).mockResolvedValue({
      id: 11,
      store_id: 1,
      product_id: 1,
      original_batch_id: 1,
      pharmacist_name: 'Dra. Camila Farmacêutica',
      pharmacist_crf: '99887',
      pharmacist_crf_uf: 'SP',
      original_packages_opened: 1,
      units_generated: 21,
      units_available: 21,
      sub_batch_code: 'FRAC-LOTE-AMOX-02',
      fractionation_date: '2026-11-23',
      expiry_date: '2028-01-01',
      created_at: '2026-11-23',
    } as any);

    render(<FractionationPage />);

    await waitFor(() => {
      expect(screen.getByText('Executar Fracionamento & Gerar Sublote')).toBeDefined();
    });

    const submitBtn = screen.getByText('Executar Fracionamento & Gerar Sublote');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fractionationApi.fractionateMedicine).toHaveBeenCalled();
    });
  });

  it('should switch to dispense tab, submit dispensation and display official thermal label modal', async () => {
    vi.mocked(fractionationApi.dispenseFractioned).mockResolvedValue({
      id: 88,
      fractionation_record_id: 10,
      patient_name: 'Sr. José Ferreira',
      doctor_name: 'Dr. Roberto Santos',
      doctor_crm: '11223',
      doctor_uf: 'SP',
      units_dispensed: 10,
      unit_price: 1.67,
      total_price: 16.7,
      leaflet_supplied: 1,
      posology: 'Tomar 1 cápsula de 8 em 8 horas',
      dispensed_at: '2026-11-23',
    });

    vi.mocked(fractionationApi.getOfficialLabel).mockResolvedValue({
      labelText: 'ROTULO DE DISPENSACAO FRACIONADA (RDC 80/2006 ANVISA)\nMEDICAMENTO: AMOXICILINA 500MG\nPACIENTE: SR. JOSE FERREIRA',
    });

    render(<FractionationPage />);

    await waitFor(() => {
      expect(screen.getByText('Dispensação & Rótulo Oficial RDC 80')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Dispensação & Rótulo Oficial RDC 80'));

    await waitFor(() => {
      expect(screen.getByText('Concluir Dispensação & Emitir Rótulo Térmico')).toBeDefined();
    });

    // Seleciona o sublote
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '10' } });

    const submitBtn = screen.getByText('Concluir Dispensação & Emitir Rótulo Térmico');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fractionationApi.dispenseFractioned).toHaveBeenCalled();
      expect(fractionationApi.getOfficialLabel).toHaveBeenCalledWith(88);
      expect(screen.getByText('Rótulo Térmico Oficial (RDC 80/2006)')).toBeDefined();
      expect(screen.getByText(/ROTULO DE DISPENSACAO FRACIONADA/i)).toBeDefined();
    });
  });

  it('should switch to catalog tab and toggle fractionable status', async () => {
    vi.mocked(fractionationApi.toggleProductFractionable).mockResolvedValue({} as any);

    render(<FractionationPage />);

    await waitFor(() => {
      expect(screen.getByText('Catálogo de Embalagens Fracionáveis')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Catálogo de Embalagens Fracionáveis'));

    await waitFor(() => {
      expect(screen.getByText('Amoxicilina 500mg 21 caps')).toBeDefined();
      expect(screen.getByText('Desativar')).toBeDefined();
    });

    const toggleBtn = screen.getByText('Desativar');
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(fractionationApi.toggleProductFractionable).toHaveBeenCalledWith(1, {
        isFractionable: false,
        unitsPerPackage: 21,
        fractionalUnit: 'CAPSULA',
      });
    });
  });
});
