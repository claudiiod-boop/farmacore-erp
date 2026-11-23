import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ClinicalConsultingPage from '../../src/pages/ClinicalConsultingPage';
import { clinicalApi } from '../../src/services/api';
import type {
  ClinicalPharmacist,
  ClinicalAttendance,
  PharmacovigilanceReport,
  DsfSlipResponse,
} from '../../src/types/clinical';

const mockPharmacists: ClinicalPharmacist[] = [
  {
    id: 1,
    storeId: 1,
    name: 'Dr. Lucas Farmacêutico',
    cpf: '11122233344',
    crfNumber: '12345',
    crfUf: 'SP',
    active: true,
  },
];

const mockAttendance: ClinicalAttendance = {
  id: 10,
  attendanceCode: 'AT-2026-T1T2',
  storeId: 1,
  pharmacistId: 1,
  patientName: 'Maria Silva',
  patientCpf: '12345678900',
  patientBirthDate: '1985-04-10',
  patientPhone: '11987654321',
  bloodPressureSystolic: 120,
  bloodPressureDiastolic: 80,
  heartRate: 72,
  temperature: 36.6,
  bloodGlucose: 95,
  oxygenSaturation: 98,
  anamnesisNotes: 'Queixa de dor de cabeça leve',
  pharmacotherapeuticOrientation: 'Hidratação e repouso',
  status: 'IN_PROGRESS',
  totalAmount: 25.0,
  createdAt: '2026-11-23 16:00:00',
  procedures: [],
  rapidTests: [],
};

const mockCompletedAttendance: ClinicalAttendance = {
  ...mockAttendance,
  status: 'COMPLETED',
  dsfNumber: 'DSF-1-2026-00001',
};

const mockDsfSlip: DsfSlipResponse = {
  dsfNumber: 'DSF-1-2026-00001',
  attendanceCode: 'AT-2026-T1T2',
  patientCopy: 'DECLARACAO DE SERVICO FARMACEUTICO\n*** 1a VIA: PACIENTE ***\nMaria Silva',
  pharmacyCopy: 'DECLARACAO DE SERVICO FARMACEUTICO\n*** 2a VIA: ESTABELECIMENTO ***\nMaria Silva',
};

const mockPharmacovigilanceList: PharmacovigilanceReport[] = [
  {
    id: 1,
    storeId: 1,
    pharmacistId: 1,
    patientName: 'João Ferreira',
    patientCpf: '99988877766',
    suspectMedication: 'Amoxicilina 500mg',
    adverseEventDescription: 'Erupção cutânea e prurido generalizado',
    severityLevel: 'MODERATE',
    eventOutcome: 'RECOVERING',
    notivisaProtocolNumber: 'NOTIVISA-2026-1-X1Y2Z3',
    createdAt: '2026-11-23 10:00:00',
  },
];

describe('ClinicalConsultingPage (Consultório Farmacêutico & RDC 777/2023)', () => {
  beforeEach(() => {
    vi.spyOn(clinicalApi, 'getPharmacists').mockResolvedValue(mockPharmacists);
    vi.spyOn(clinicalApi, 'listAttendances').mockResolvedValue([mockCompletedAttendance]);
    vi.spyOn(clinicalApi, 'listPharmacovigilance').mockResolvedValue(mockPharmacovigilanceList);
    vi.spyOn(clinicalApi, 'startAttendance').mockResolvedValue(mockAttendance);
    vi.spyOn(clinicalApi, 'getAttendance').mockResolvedValue(mockAttendance);
    vi.spyOn(clinicalApi, 'addRapidTest').mockResolvedValue({ id: 1 } as any);
    vi.spyOn(clinicalApi, 'addProcedure').mockResolvedValue({ id: 1 } as any);
    vi.spyOn(clinicalApi, 'completeAttendance').mockResolvedValue({
      attendance: mockCompletedAttendance,
      dsfSlip: mockDsfSlip,
    });
    vi.spyOn(clinicalApi, 'getDsfSlip').mockResolvedValue(mockDsfSlip);
    vi.spyOn(clinicalApi, 'registerPharmacovigilance').mockResolvedValue({
      report: mockPharmacovigilanceList[0],
      regulatoryNotice: 'Notificação Sanitária ANVISA',
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render header with sanitary badges, active pharmacist and tabs', async () => {
    render(<ClinicalConsultingPage />);

    expect(screen.getByText('Consultório Farmacêutico & Serviços Clínicos')).toBeDefined();
    expect(screen.getByText('RDC 777/2023 & RDC 44/2009')).toBeDefined();

    await waitFor(() => {
      expect(clinicalApi.getPharmacists).toHaveBeenCalledWith(1);
      expect(screen.getByText(/Dr\. Lucas Farmacêutico/i)).toBeDefined();
    });

    expect(screen.getByText('1. Atendimento & Anamnese')).toBeDefined();
    expect(screen.getByText('2. Testes Rápidos TLR (RDC 777/23)')).toBeDefined();
    expect(screen.getByText('3. Procedimentos & Injetáveis')).toBeDefined();
    expect(screen.getByText('4. Farmacovigilância (Notivisa)')).toBeDefined();
    expect(screen.getByText('5. Histórico & DSF Emitidas')).toBeDefined();
  });

  it('should start a new clinical attendance with anamnesis and vital signs', async () => {
    render(<ClinicalConsultingPage />);

    await waitFor(() => {
      expect(clinicalApi.getPharmacists).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByPlaceholderText('Ex: Maria José de Oliveira'), {
      target: { value: 'Maria Silva' },
    });
    fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), {
      target: { value: '12345678900' },
    });
    fireEvent.change(screen.getByPlaceholderText('120'), {
      target: { value: '120' },
    });
    fireEvent.change(screen.getByPlaceholderText('80'), {
      target: { value: '80' },
    });

    fireEvent.submit(screen.getByTestId('attendance-form'));

    await waitFor(() => {
      expect(clinicalApi.startAttendance).toHaveBeenCalledWith(
        expect.objectContaining({
          patientName: 'Maria Silva',
          patientCpf: '12345678900',
          bloodPressureSystolic: 120,
          bloodPressureDiastolic: 80,
        })
      );
    });

    // Deve exibir o banner de Atendimento em Andamento
    await waitFor(() => {
      expect(screen.getByText('Atendimento em Andamento')).toBeDefined();
      expect(screen.getByText(/Maria Silva \(CPF: 12345678900\)/i)).toBeDefined();
    });
  });

  it('should navigate to TLR rapid tests tab and add a test adhering to RDC 777/2023', async () => {
    render(<ClinicalConsultingPage />);

    // Iniciar atendimento primeiro
    fireEvent.change(screen.getByPlaceholderText('Ex: Maria José de Oliveira'), {
      target: { value: 'Maria Silva' },
    });
    fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), {
      target: { value: '12345678900' },
    });
    fireEvent.submit(screen.getByTestId('attendance-form'));

    await waitFor(() => expect(screen.getByText('Atendimento em Andamento')).toBeDefined());

    // Clicar na aba de Testes Rápidos TLR
    fireEvent.click(screen.getByText('2. Testes Rápidos TLR (RDC 777/23)'));

    expect(screen.getByText(/RDC ANVISA 777\/2023 — Exames de Análises Clínicas em Farmácias/i)).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText('Ex: 92 mg/dL ou Não Reativo'), {
      target: { value: '98 mg/dL' },
    });

    const addTlrBtn = screen.getByRole('button', { name: /Registrar Teste na DSF/i });
    fireEvent.click(addTlrBtn);

    await waitFor(() => {
      expect(clinicalApi.addRapidTest).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          testType: 'GLUCOSE',
          reagentName: 'Accu-Chek Guide',
          resultValue: '98 mg/dL',
          resultInterpretation: 'NORMAL',
        })
      );
    });
  });

  it('should navigate to procedures tab and register an injectable medication with prescriber', async () => {
    render(<ClinicalConsultingPage />);

    // Iniciar atendimento
    fireEvent.change(screen.getByPlaceholderText('Ex: Maria José de Oliveira'), {
      target: { value: 'Maria Silva' },
    });
    fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), {
      target: { value: '12345678900' },
    });
    fireEvent.submit(screen.getByTestId('attendance-form'));
    await waitFor(() => expect(screen.getByText('Atendimento em Andamento')).toBeDefined());

    // Clicar na aba de procedimentos
    fireEvent.click(screen.getByText('3. Procedimentos & Injetáveis'));

    fireEvent.change(screen.getByPlaceholderText('Ex: Citoneurin 5000 UI'), {
      target: { value: 'Benzetacil 1200000 UI' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex: LOTE-CIT-01'), {
      target: { value: 'LOTE-BENZ-44' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex: Dr. Roberto Médici'), {
      target: { value: 'Dra. Camila Médica' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex: CRM-SP 123456'), {
      target: { value: 'CRM-SP 98765' },
    });

    const addProcBtn = screen.getByRole('button', { name: /Registrar Procedimento na DSF/i });
    fireEvent.click(addProcBtn);

    await waitFor(() => {
      expect(clinicalApi.addProcedure).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          procedureType: 'INJECTABLE',
          medicationName: 'Benzetacil 1200000 UI',
          medicationBatch: 'LOTE-BENZ-44',
          prescriberName: 'Dra. Camila Médica',
          prescriberCrm: 'CRM-SP 98765',
        })
      );
    });
  });

  it('should complete attendance and show 2-way DSF modal with print option', async () => {
    render(<ClinicalConsultingPage />);

    // Iniciar atendimento
    fireEvent.change(screen.getByPlaceholderText('Ex: Maria José de Oliveira'), {
      target: { value: 'Maria Silva' },
    });
    fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), {
      target: { value: '12345678900' },
    });
    fireEvent.submit(screen.getByTestId('attendance-form'));
    await waitFor(() => expect(screen.getByText('Atendimento em Andamento')).toBeDefined());

    const finalizeBtn = screen.getByRole('button', { name: /Finalizar & Emitir DSF \(2 Vias\)/i });
    fireEvent.click(finalizeBtn);

    await waitFor(() => {
      expect(clinicalApi.completeAttendance).toHaveBeenCalledWith(10, expect.any(Object));
    });

    // Modal de DSF deve estar visível
    await waitFor(() => {
      expect(screen.getByText('Declaração de Serviço Farmacêutico (DSF)')).toBeDefined();
      expect(screen.getByText(/1a VIA: PACIENTE/i)).toBeDefined();
    });

    // Alternar para 2ª via (Estabelecimento)
    fireEvent.click(screen.getByText('2ª Via: Estabelecimento'));
    expect(screen.getByText(/2a VIA: ESTABELECIMENTO/i)).toBeDefined();

    // Botão de impressão
    expect(screen.getByRole('button', { name: /Imprimir Comprovante Térmico/i })).toBeDefined();
  });

  it('should register and list pharmacovigilance reports with Notivisa protocol', async () => {
    render(<ClinicalConsultingPage />);

    fireEvent.click(screen.getByText('4. Farmacovigilância (Notivisa)'));

    expect(screen.getByText(/Notificação de Farmacovigilância & Queixas Técnicas/i)).toBeDefined();

    // Verifica item existente na lista
    await waitFor(() => {
      expect(screen.getByText('NOTIVISA-2026-1-X1Y2Z3')).toBeDefined();
      expect(screen.getByText('Amoxicilina 500mg')).toBeDefined();
    });

    // Preencher nova notificação
    fireEvent.change(screen.getByPlaceholderText('Nome do paciente'), {
      target: { value: 'Carlos Pereira' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex: Dipirona 500mg Gotas'), {
      target: { value: 'Dipirona 500mg' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Descreva sintomas/i), {
      target: { value: 'Urticária imediata e edema labial após 10 minutos' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Registrar Notificação Sanitária/i }));

    await waitFor(() => {
      expect(clinicalApi.registerPharmacovigilance).toHaveBeenCalledWith(
        expect.objectContaining({
          patientName: 'Carlos Pereira',
          suspectMedication: 'Dipirona 500mg',
          adverseEventDescription: 'Urticária imediata e edema labial após 10 minutos',
        })
      );
    });
  });
});
