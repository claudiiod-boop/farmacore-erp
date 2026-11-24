import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { InjectablesVaccinationPage } from '../../src/pages/InjectablesVaccinationPage';
import { injectablesApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  injectablesApi: {
    getSummary: vi.fn(),
    getInjectables: vi.fn(),
    createInjectable: vi.fn(),
    getByDeclaration: vi.fn(),
    getVaccines: vi.fn(),
    createVaccine: vi.fn(),
    getVaccineByCertificate: vi.fn(),
    exportSipni: vi.fn(),
    recordEapv: vi.fn(),
  },
}));

describe('InjectablesVaccinationPage', () => {
  afterEach(() => {
    cleanup();
  });

  const mockSummary = {
    totalInjectablesMonth: 12,
    totalVaccinesMonth: 8,
    sipniPendingCount: 3,
    recentInjectables: [],
    recentVaccinations: [],
  };

  const mockInjectables = [
    {
      id: 1,
      store_id: 1,
      patient_name: 'Carlos Santos',
      patient_cpf: '123.456.789-00',
      patient_birth_date: '1985-06-15',
      medication_name: 'Benzetacil 1.200.000 UI',
      medication_dosage: '1.200.000 UI',
      medication_batch: 'L-BENZ-01',
      medication_expiration_date: '2027-12-31',
      syringe_needle_batch: 'SER-4455',
      administration_route: 'INTRAMUSCULAR' as const,
      anatomical_site: 'Glúteo Ventro-glúteo',
      prescriber_name: 'Dr. Roberto Santos',
      prescriber_crm: 'CRM 123456',
      prescriber_uf: 'SP',
      pharmacist_name: 'Dra. Vanessa',
      pharmacist_crf: 'CRF-SP 55443',
      declaration_number: 'DSF-INJ-2026-0001',
      adverse_reaction_observed: 0,
      notes: null,
      administered_at: '2026-11-24T10:00:00Z',
      created_at: '2026-11-24T10:00:00Z',
    },
  ];

  const mockVaccines = [
    {
      id: 1,
      store_id: 1,
      patient_name: 'Juliana Lima',
      patient_cpf: '333.444.555-66',
      patient_birth_date: '1995-10-20',
      vaccine_name: 'Influenza Tetravalente',
      manufacturer: 'Sanofi Pasteur',
      vaccine_batch: 'VAC-FLU-88',
      vaccine_expiration_date: '2027-06-30',
      doseType: 'SINGLE_DOSE' as const,
      administration_route: 'INTRAMUSCULAR' as const,
      anatomical_site: 'Deltoide Esquerdo',
      pre_triage_fever: 0,
      pharmacist_name: 'Dra. Vanessa',
      pharmacist_crf: 'CRF-SP 55443',
      certificate_code: 'VAC-2026-9901',
      sipni_status: 'PENDING' as const,
      eapv_adverse_event: 0,
      administered_at: '2026-11-24T11:00:00Z',
      created_at: '2026-11-24T11:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (injectablesApi.getSummary as any).mockResolvedValue(mockSummary);
    (injectablesApi.getInjectables as any).mockResolvedValue(mockInjectables);
    (injectablesApi.getVaccines as any).mockResolvedValue(mockVaccines);
    (injectablesApi.createInjectable as any).mockResolvedValue({
      id: 2,
      declaration_number: 'DSF-INJ-2026-0002',
    });
    (injectablesApi.createVaccine as any).mockResolvedValue({
      id: 2,
      certificate_code: 'VAC-2026-9902',
    });
    (injectablesApi.exportSipni as any).mockResolvedValue({
      exportedCount: 3,
    });
  });

  it('1. Renderiza KPIs consolidados e registros do livro de injetáveis', async () => {
    render(<InjectablesVaccinationPage />);

    await waitFor(() => {
      expect(screen.getByText('12')).toBeDefined();
      expect(screen.getByText('8')).toBeDefined();
      expect(screen.getByText('3')).toBeDefined();
      expect(screen.getByText('DSF-INJ-2026-0001')).toBeDefined();
      expect(screen.getByText('Carlos Santos')).toBeDefined();
    });
  });

  it('2. Alterna entre abas e visualiza dados de vacinação', async () => {
    render(<InjectablesVaccinationPage />);

    await waitFor(() => {
      expect(screen.getByText('DSF-INJ-2026-0001')).toBeDefined();
    });

    const vacTab = screen.getByRole('button', { name: /Sala de Vacinas/ });
    fireEvent.click(vacTab);

    expect(screen.getByText('VAC-2026-9901')).toBeDefined();
    expect(screen.getByText('Juliana Lima')).toBeDefined();
    expect(screen.getByText('Influenza Tetravalente')).toBeDefined();
  });

  it('3. Abre modal de aplicação de injetável e submete formulário', async () => {
    render(<InjectablesVaccinationPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Aplicar Injetável/ })).toBeDefined();
    });

    const openBtn = screen.getByRole('button', { name: /Aplicar Injetável/ });
    fireEvent.click(openBtn);

    expect(screen.getByText('Registrar Aplicação de Medicamento Injetável (RDC 44/2009)')).toBeDefined();

    // Preenche campos
    fireEvent.change(screen.getByTestId('patient-name-input'), { target: { value: 'Paciente Teste' } });
    fireEvent.change(screen.getByTestId('patient-cpf-input'), { target: { value: '000.111.222-33' } });
    fireEvent.change(screen.getByTestId('medication-name-input'), { target: { value: 'Voltaren 75mg' } });
    fireEvent.change(screen.getByTestId('medication-dosage-input'), { target: { value: '75mg/3mL' } });
    fireEvent.change(screen.getByTestId('medication-batch-input'), { target: { value: 'L-VOLT' } });
    fireEvent.change(screen.getByTestId('medication-exp-input'), { target: { value: '2028-10-10' } });
    fireEvent.change(screen.getByTestId('syringe-batch-input'), { target: { value: 'SER-11' } });
    fireEvent.change(screen.getByTestId('anatomical-site-input'), { target: { value: 'Deltoide' } });
    fireEvent.change(screen.getByTestId('prescriber-name-input'), { target: { value: 'Dr. Fernando' } });
    fireEvent.change(screen.getByTestId('prescriber-crm-input'), { target: { value: '12345' } });
    fireEvent.change(screen.getByTestId('prescriber-uf-input'), { target: { value: 'SP' } });
    fireEvent.change(screen.getByTestId('pharmacist-name-input'), { target: { value: 'Dra. Camila' } });
    fireEvent.change(screen.getByTestId('pharmacist-crf-input'), { target: { value: 'CRF-SP 9988' } });

    const submitBtn = screen.getByText('Confirmar e Gerar DSF');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(injectablesApi.createInjectable).toHaveBeenCalledWith(
        expect.objectContaining({
          patientName: 'Paciente Teste',
          medicationName: 'Voltaren 75mg',
        })
      );
    });
  });

  it('4. Exporta lote de vacinas para SI-PNI ao clicar no botão de exportação', async () => {
    render(<InjectablesVaccinationPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Exportar Lote SI-PNI/ })).toBeDefined();
    });

    const exportBtn = screen.getByRole('button', { name: /Exportar Lote SI-PNI/ });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(injectablesApi.exportSipni).toHaveBeenCalled();
    });
  });
});
