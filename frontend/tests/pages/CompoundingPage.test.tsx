import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CompoundingPage } from '../../src/pages/CompoundingPage';
import { compoundingApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  compoundingApi: {
    listRawMaterials: vi.fn(),
    createRawMaterial: vi.fn(),
    listBatches: vi.fn(),
    createBatch: vi.fn(),
    releaseBatch: vi.fn(),
    rejectBatch: vi.fn(),
    calculateCapsule: vi.fn(),
    listOrders: vi.fn(),
    getOrder: vi.fn(),
    createOrder: vi.fn(),
    weighItem: vi.fn(),
    evaluateQualityControl: vi.fn(),
    getLabel: vi.fn(),
  },
}));

describe('CompoundingPage (Farmácia Magistral & RDC 67/2007)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(compoundingApi.listRawMaterials).mockResolvedValue([
      {
        id: 1,
        name: 'Vitamina C (Acido Ascorbico)',
        dcb: '03215',
        apparent_density: 0.70,
        default_unit: 'mg',
        cost_per_unit: 0.02,
        is_active: 1,
      },
    ]);

    vi.mocked(compoundingApi.listBatches).mockResolvedValue([
      {
        id: 10,
        raw_material_id: 1,
        raw_material_name: 'Vitamina C (Acido Ascorbico)',
        batch_number: 'LOTE-VITC-01',
        supplier: 'Fagron',
        potency_percent: 98.0,
        moisture_percent: 2.0,
        report_number: 'LAUDO-9988',
        expiration_date: '2028-12-31',
        status: 'QUARANTINE',
        current_stock: 500,
      },
    ]);

    vi.mocked(compoundingApi.listOrders).mockResolvedValue([
      {
        id: 100,
        store_id: 1,
        order_number: 'OM-202611-0001',
        patient_name: 'Mariana Silva',
        prescriber_name: 'Dr. Carlos Eduardo',
        prescriber_crm: '123456',
        prescriber_uf: 'SP',
        pharmaceutical_form: 'CAPSULA',
        total_units: 30,
        capsule_size: '1',
        target_weight_per_unit: 320.0,
        actual_average_weight: null,
        quality_status: 'PENDING',
        status: 'AWAITING_WEIGHING',
        subtotal: 35.0,
        packaging_cost: 5.0,
        pharmaceutical_fee: 15.0,
        total_amount: 55.0,
        directions: 'Tomar 1 cápsula pela manhã',
        created_at: '2026-11-23T19:00:00Z',
        items: [
          {
            id: 501,
            order_id: 100,
            raw_material_id: 1,
            raw_material_name: 'Vitamina C (Acido Ascorbico)',
            batch_number: 'LOTE-VITC-01',
            prescribed_dose: 100,
            unit: 'mg',
            factor_correction: 1.0412,
            factor_equivalence: 1.0,
            corrected_dose_per_unit: 104.12,
            total_dose_to_weigh: 3123.6,
            weighed_amount: null,
            status: 'PENDING',
          },
        ],
      },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it('should render header, counters and all 4 tabs', async () => {
    render(<CompoundingPage />);

    expect(screen.getByText('Laboratório Magistral & Manipulação')).toBeDefined();
    expect(screen.getByText(/Boas Práticas de Manipulação \(RDC 67\/2007\)/i)).toBeDefined();

    expect(screen.getByRole('button', { name: /1\. Orçamento & Calculadora de Cápsulas/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /2\. Ficha de Pesagem & Manipulação/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /3\. Quarentena & Laudos de Matéria-Prima/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /4\. Rótulo Magistral Oficial/i })).toBeDefined();

    await waitFor(() => {
      expect(compoundingApi.listRawMaterials).toHaveBeenCalled();
    });
  });

  it('should add component, calculate capsule dimensions and trigger order creation', async () => {
    vi.mocked(compoundingApi.calculateCapsule).mockResolvedValue({
      totalMassPerCapsuleMg: 100,
      totalVolumePerCapsuleMl: 0.1428,
      selectedCapsuleSize: '4',
      capsuleCapacityMl: 0.21,
      excipientVolumePerCapsuleMl: 0.0672,
      excipientMassPerCapsuleMg: 40.32,
      totalExcipientToWeighG: 1.21,
      targetCapsuleWeightMg: 140.32,
    });

    vi.mocked(compoundingApi.createOrder).mockResolvedValue({
      id: 101,
      store_id: 1,
      order_number: 'OM-202611-0002',
      patient_name: 'Mariana Silva',
      prescriber_name: 'Dr. Carlos Eduardo',
      prescriber_crm: '123456',
      prescriber_uf: 'SP',
      pharmaceutical_form: 'CAPSULA',
      total_units: 30,
      capsule_size: '4',
      target_weight_per_unit: 140.32,
      quality_status: 'PENDING',
      status: 'AWAITING_WEIGHING',
      subtotal: 20.0,
      packaging_cost: 5.0,
      pharmaceutical_fee: 15.0,
      total_amount: 40.0,
      directions: 'Tomar 1 cápsula 1x ao dia pela manhã.',
      created_at: '2026-11-23T19:00:00Z',
    });

    render(<CompoundingPage />);

    await waitFor(() => {
      expect(compoundingApi.listRawMaterials).toHaveBeenCalled();
    });

    // Adiciona ativo
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/i }));

    await waitFor(() => {
      expect(screen.getByText('Vitamina C (Acido Ascorbico)')).toBeDefined();
      expect(screen.getByText('100 mg')).toBeDefined();
    });

    // Calcula cubagem
    fireEvent.click(screen.getByRole('button', { name: /Calcular Cubagem Farmacotécnica/i }));

    await waitFor(() => {
      expect(compoundingApi.calculateCapsule).toHaveBeenCalled();
      expect(screen.getAllByText(/Nº 4/i).length).toBeGreaterThan(0);
    });

    // Cria Ordem
    fireEvent.click(screen.getByRole('button', { name: /Gerar Ordem de Manipulação/i }));

    await waitFor(() => {
      expect(compoundingApi.createOrder).toHaveBeenCalled();
    });
  });

  it('should switch to orders tab, confirm item weighing and approve quality control', async () => {
    const mockOrder = {
      id: 100,
      store_id: 1,
      order_number: 'OM-202611-0001',
      patient_name: 'Mariana Silva',
      prescriber_name: 'Dr. Carlos Eduardo',
      prescriber_crm: '123456',
      prescriber_uf: 'SP',
      pharmaceutical_form: 'CAPSULA',
      total_units: 30,
      capsule_size: '1',
      target_weight_per_unit: 320.0,
      actual_average_weight: null,
      quality_status: 'PENDING' as const,
      status: 'QUALITY_CONTROL' as const,
      subtotal: 35.0,
      packaging_cost: 5.0,
      pharmaceutical_fee: 15.0,
      total_amount: 55.0,
      directions: 'Tomar 1 cápsula pela manhã',
      created_at: '2026-11-23T19:00:00Z',
      items: [
        {
          id: 501,
          order_id: 100,
          raw_material_id: 1,
          raw_material_name: 'Vitamina C (Acido Ascorbico)',
          batch_number: 'LOTE-VITC-01',
          prescribed_dose: 100,
          unit: 'mg',
          factor_correction: 1.0412,
          factor_equivalence: 1.0,
          corrected_dose_per_unit: 104.12,
          total_dose_to_weigh: 3123.6,
          weighed_amount: 3124.0,
          status: 'WEIGHED' as const,
        },
      ],
    };

    vi.mocked(compoundingApi.getOrder).mockResolvedValue(mockOrder);
    vi.mocked(compoundingApi.weighItem).mockResolvedValue(mockOrder);
    vi.mocked(compoundingApi.evaluateQualityControl).mockResolvedValue({
      ...mockOrder,
      status: 'READY',
      quality_status: 'APPROVED',
      actual_average_weight: 322.0,
    });

    render(<CompoundingPage />);

    fireEvent.click(screen.getByRole('button', { name: /2\. Ficha de Pesagem & Manipulação/i }));

    await waitFor(() => {
      expect(compoundingApi.listOrders).toHaveBeenCalled();
      expect(screen.getByText('OM-202611-0001')).toBeDefined();
    });

    // Abre Ficha de Pesagem
    fireEvent.click(screen.getByRole('button', { name: /Abrir Ficha de Pesagem/i }));

    await waitFor(() => {
      expect(screen.getByText('Ficha de Pesagem Analítica (Matérias-Primas, FC e FEq)')).toBeDefined();
      expect(screen.getByPlaceholderText('mg')).toBeDefined();
    });

    // Pesa Item
    const weighInput = screen.getByPlaceholderText('mg');
    fireEvent.change(weighInput, { target: { value: '3124' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Pesagem/i }));

    await waitFor(() => {
      expect(compoundingApi.weighItem).toHaveBeenCalledWith(
        100,
        501,
        3124,
        'MANIPULADOR_BALCAO'
      );
    });

    // Controle de Qualidade
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ex: 305')).toBeDefined();
    });

    const qcInput = screen.getByPlaceholderText('Ex: 305');
    fireEvent.change(qcInput, { target: { value: '322' } });
    fireEvent.click(screen.getByRole('button', { name: /Aprovar Controle de Qualidade/i }));

    await waitFor(() => {
      expect(compoundingApi.evaluateQualityControl).toHaveBeenCalledWith(
        100,
        322,
        'FARMACEUTICO_RT'
      );
    });
  });

  it('should switch to quarantine tab and release batch', async () => {
    vi.mocked(compoundingApi.releaseBatch).mockResolvedValue({
      id: 10,
      raw_material_id: 1,
      batch_number: 'LOTE-VITC-01',
      supplier: 'Fagron',
      potency_percent: 98.0,
      moisture_percent: 2.0,
      report_number: 'LAUDO-9988',
      expiration_date: '2028-12-31',
      status: 'APPROVED',
      current_stock: 500,
      released_by: 'FARMACEUTICO_RT',
    });

    render(<CompoundingPage />);

    fireEvent.click(screen.getByRole('button', { name: /3\. Quarentena & Laudos de Matéria-Prima/i }));

    await waitFor(() => {
      expect(compoundingApi.listBatches).toHaveBeenCalled();
      expect(screen.getByText('LOTE-VITC-01')).toBeDefined();
      expect(screen.getByText('LAUDO-9988')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Aprovar Laudo/i }));

    await waitFor(() => {
      expect(compoundingApi.releaseBatch).toHaveBeenCalledWith(10, 'FARMACEUTICO_RT');
    });
  });

  it('should switch to label tab and display official label text', async () => {
    vi.mocked(compoundingApi.getLabel).mockResolvedValue({
      labelText: 'FARMACORE FARMACIA MAGISTRAL\nBOAS PRATICAS DE MANIPULACAO - RDC 67/2007\nPACIENTE: MARIANA SILVA',
    });

    render(<CompoundingPage />);

    // Vai para ordens e abre rótulo
    fireEvent.click(screen.getByRole('button', { name: /2\. Ficha de Pesagem & Manipulação/i }));

    await waitFor(() => {
      expect(screen.getByText('OM-202611-0001')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Abrir Ficha de Pesagem/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Visualizar Rótulo Oficial/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Visualizar Rótulo Oficial/i }));

    await waitFor(() => {
      expect(compoundingApi.getLabel).toHaveBeenCalledWith(100);
      expect(screen.getByText(/PACIENTE: MARIANA SILVA/i)).toBeDefined();
    });
  });
});
