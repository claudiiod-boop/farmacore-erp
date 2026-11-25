import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { PharmacovigilancePage } from '../../src/pages/PharmacovigilancePage';
import { pharmacovigilanceApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  pharmacovigilanceApi: {
    getSummary: vi.fn(),
    getAdrs: vi.fn(),
    createAdr: vi.fn(),
    getComplaints: vi.fn(),
    createComplaint: vi.fn(),
    submitToNotivisa: vi.fn(),
  },
}));

describe('PharmacovigilancePage (RDC 406/2020 & NOTIVISA)', () => {
  afterEach(() => {
    cleanup();
  });

  const mockSummary = {
    totalRams: 5,
    severeRams: 1,
    totalComplaints: 3,
    pendingSubmissionCount: 2,
    recentAdrs: [],
    recentComplaints: [],
  };

  const mockAdrs = [
    {
      id: 1,
      store_id: 1,
      protocol_code: 'RAM-2026-0001',
      patient_initials: 'J.D.S.',
      patient_age: 45,
      patient_gender: 'M' as const,
      is_pregnant: 0,
      suspected_drug_name: 'Amoxicilina + Clavulanato 875mg',
      suspected_drug_batch: 'L-AMX-9988',
      suspected_drug_manufacturer: 'EMS S/A',
      daily_dose: '1 cp 12/12h',
      treatment_start_date: '2026-11-20',
      treatment_end_date: '2026-11-23',
      therapeutic_indication: 'Sinusite bacteriana',
      concomitant_drugs: null,
      reaction_description: 'Erupção cutânea eritematosa e prurido disseminado',
      reaction_onset_date: '2026-11-22',
      severity_level: 'MODERATE' as const,
      serious_criteria: null,
      dechallenge_status: 'IMPROVED' as const,
      rechallenge_status: 'NOT_REEXPOSED' as const,
      outcome: 'RECOVERING' as const,
      notifier_pharmacist_name: 'Dra. Gabriela Ramos',
      notifier_pharmacist_crf: 'CRF-SP 65432',
      notivisa_submission_status: 'DRAFT' as const,
      notivisa_protocol: null,
      notivisa_submitted_at: null,
      created_at: '2026-11-24T10:00:00Z',
      updated_at: '2026-11-24T10:00:00Z',
    },
  ];

  const mockComplaints = [
    {
      id: 1,
      store_id: 1,
      protocol_code: 'QT-2026-0001',
      product_name: 'Dipirona Gotas 500mg/ml',
      product_ean: '7891234567890',
      batch_number: 'L-DIP-4455',
      manufacturer: 'Medley',
      expiration_date: '2027-10-31',
      complaint_type: 'FOREIGN_PARTICLE_OR_CONTAMINATION' as const,
      description: 'Presença de precipitado e partículas sólidas em suspensão no frasco lacrado.',
      sample_available_for_pickup: 1,
      quarantine_auto_blocked: 1,
      reporter_type: 'CUSTOMER' as const,
      reporter_name: 'Mariana Lima',
      notifier_pharmacist_crf: 'CRF-SP 65432',
      notivisa_submission_status: 'DRAFT' as const,
      notivisa_protocol: null,
      notivisa_submitted_at: null,
      created_at: '2026-11-24T11:00:00Z',
      updated_at: '2026-11-24T11:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (pharmacovigilanceApi.getSummary as any).mockResolvedValue(mockSummary);
    (pharmacovigilanceApi.getAdrs as any).mockResolvedValue(mockAdrs);
    (pharmacovigilanceApi.getComplaints as any).mockResolvedValue(mockComplaints);
  });

  it('deve renderizar os indicadores de farmacovigilância e a listagem de RAMs', async () => {
    render(<PharmacovigilancePage />);

    await waitFor(() => {
      expect(screen.getByText('RAM-2026-0001')).toBeDefined();
      expect(screen.getByText('Amoxicilina + Clavulanato 875mg')).toBeDefined();
      expect(screen.getByText('Total de RAMs')).toBeDefined();
      expect(screen.getByText('5')).toBeDefined();
    });
  });

  it('deve alternar para a aba de Queixas Técnicas e listar o lote com alerta de quarentena', async () => {
    render(<PharmacovigilancePage />);

    await waitFor(() => {
      expect(screen.getByText('RAM-2026-0001')).toBeDefined();
    });

    const complaintTab = screen.getByRole('button', { name: /Queixas Técnicas & Desvios/ });
    fireEvent.click(complaintTab);

    await waitFor(() => {
      expect(screen.getByText('QT-2026-0001')).toBeDefined();
      expect(screen.getByText('Dipirona Gotas 500mg/ml')).toBeDefined();
      expect(screen.getByText(/Bloqueado/)).toBeDefined();
    });
  });

  it('deve abrir o modal de nova notificação de RAM e submeter com sucesso', async () => {
    const createdAdr = {
      ...mockAdrs[0],
      id: 2,
      protocol_code: 'RAM-2026-0002',
      patient_initials: 'M.F.S.',
    };
    (pharmacovigilanceApi.createAdr as any).mockResolvedValue(createdAdr);

    render(<PharmacovigilancePage />);

    const openModalBtn = screen.getByRole('button', { name: /Notificar RAM/ });
    fireEvent.click(openModalBtn);

    expect(screen.getByText('Notificação de Reação Adversa a Medicamentos (RAM)')).toBeDefined();

    fireEvent.change(screen.getByTestId('patient-initials-input'), { target: { value: 'M.F.S.' } });
    fireEvent.change(screen.getByTestId('patient-age-input'), { target: { value: '38' } });
    fireEvent.change(screen.getByTestId('suspected-drug-input'), { target: { value: 'Dipirona 500mg' } });
    fireEvent.change(screen.getByTestId('suspected-batch-input'), { target: { value: 'L-DIP-99' } });
    fireEvent.change(screen.getByTestId('daily-dose-input'), { target: { value: '1 cp ao dia' } });
    fireEvent.change(screen.getByTestId('treatment-start-input'), { target: { value: '2026-11-20' } });
    fireEvent.change(screen.getByTestId('reaction-onset-input'), { target: { value: '2026-11-22' } });
    fireEvent.change(screen.getByTestId('reaction-desc-input'), { target: { value: 'Urticária aguda facial' } });
    fireEvent.change(screen.getByTestId('pharmacist-name-input'), { target: { value: 'Dra. Gabriela' } });
    fireEvent.change(screen.getByTestId('pharmacist-crf-input'), { target: { value: 'CRF-SP 65432' } });

    const submitBtn = screen.getByText('Registrar Notificação de RAM');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(pharmacovigilanceApi.createAdr).toHaveBeenCalledWith(
        expect.objectContaining({
          patientInitials: 'M.F.S.',
          patientAge: 38,
          suspectedDrugName: 'Dipirona 500mg',
          suspectedDrugBatch: 'L-DIP-99',
          dailyDose: '1 cp ao dia',
          treatmentStartDate: '2026-11-20',
          reactionOnsetDate: '2026-11-22',
          reactionDescription: 'Urticária aguda facial',
          notifierPharmacistName: 'Dra. Gabriela',
          notifierPharmacistCrf: 'CRF-SP 65432',
        })
      );
      expect(screen.getByText(/Notificação de RAM registrada com sucesso/)).toBeDefined();
    });
  });

  it('deve transmitir a notificação ao NOTIVISA ANVISA', async () => {
    (pharmacovigilanceApi.submitToNotivisa as any).mockResolvedValue({
      success: true,
      notivisaProtocol: 'NOTIVISA-2026-999888',
      status: 'SUBMITTED',
    });

    render(<PharmacovigilancePage />);

    await waitFor(() => {
      expect(screen.getByText('Transmitir')).toBeDefined();
    });

    const transmitBtn = screen.getByText('Transmitir');
    fireEvent.click(transmitBtn);

    await waitFor(() => {
      expect(pharmacovigilanceApi.submitToNotivisa).toHaveBeenCalledWith('RAM', 1);
      expect(screen.getByText(/Notificação transmitida ao NOTIVISA ANVISA com sucesso/)).toBeDefined();
    });
  });

  it('deve abrir o dossiê da RAM ao clicar em Dossiê', async () => {
    render(<PharmacovigilancePage />);

    await waitFor(() => {
      expect(screen.getByText('Dossiê')).toBeDefined();
    });

    const dossierBtn = screen.getByText('Dossiê');
    fireEvent.click(dossierBtn);

    await waitFor(() => {
      expect(screen.getByText('DOSSIÊ DE FARMACOVIGILÂNCIA (RAM)')).toBeDefined();
      expect(screen.getByText('Notificação Sanitária ANVISA')).toBeDefined();
    });

    const closeBtn = screen.getByRole('button', { name: 'Fechar' });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('DOSSIÊ DE FARMACOVIGILÂNCIA (RAM)')).toBeNull();
    });
  });
});
