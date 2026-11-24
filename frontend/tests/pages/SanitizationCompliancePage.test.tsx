import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SanitizationCompliancePage } from '../../src/pages/SanitizationCompliancePage';
import { sanitizationApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  sanitizationApi: {
    getComplianceOverview: vi.fn(),
    getLogs: vi.fn(),
    createLog: vi.fn(),
    verifyLog: vi.fn(),
    getPestControlList: vi.fn(),
    getActivePestControl: vi.fn(),
    createPestControl: vi.fn(),
    getWaterTankList: vi.fn(),
    getActiveWaterTank: vi.fn(),
    createWaterTank: vi.fn(),
    getSops: vi.fn(),
    createOrUpdateSop: vi.fn(),
  },
}));

describe('SanitizationCompliancePage', () => {
  afterEach(() => {
    cleanup();
  });

  const mockOverview = {
    overallCompliant: true,
    score: 95,
    pestControl: {
      activeCertificate: {
        id: 1,
        store_id: 1,
        service_provider_name: 'Dedetizadora BioClean',
        service_provider_cnpj: '11.222.333/0001-44',
        sanitary_license_number: 'CEVS-1234',
        certificate_number: 'CERT-2026-99',
        application_date: '2026-11-20',
        expiration_date: '2027-05-19',
        target_pests: 'Baratas e Roedores',
        chemical_agents_used: 'Deltametrina',
        technical_responsible_pest: 'CRBio 5544',
        pharmacist_approval_crf: 'CRF-SP 98765',
        status: 'VALID' as const,
        created_at: '2026-11-20T10:00:00Z',
      },
      status: 'VALID' as const,
      daysRemaining: 176,
    },
    waterTank: {
      activeLog: {
        id: 1,
        store_id: 1,
        service_provider: 'AquaPura',
        cleaning_date: '2026-11-20',
        expiration_date: '2027-05-19',
        potability_report_number: 'LAUDO-1122',
        potability_status: 'POTABLE_COMPLIANT' as const,
        responsible_cleaner: 'João Silva',
        pharmacist_crf: 'CRF-SP 98765',
        status: 'VALID' as const,
        created_at: '2026-11-20T10:00:00Z',
      },
      status: 'VALID' as const,
      daysRemaining: 176,
    },
    sanitizationsMonth: {
      totalCompleted: 15,
      pendingOrNonConforming: 0,
    },
    sops: {
      totalActive: 6,
      needsRevisionCount: 0,
    },
  };

  const mockLogs = [
    {
      id: 10,
      store_id: 1,
      sector_name: 'SALA_INJETAIS',
      cleaning_type: 'TERMINAL' as const,
      scheduled_date: '2026-11-24',
      execution_timestamp: '2026-11-24T08:00:00Z',
      chemical_product: 'Quaternário de Amônio',
      dilution_or_batch: 'Lote 2026-X',
      performed_by: 'Maria Souza',
      verified_by_pharmacist: null,
      status: 'COMPLETED' as const,
      created_at: '2026-11-24T08:05:00Z',
    },
  ];

  const mockPestCerts = [
    mockOverview.pestControl.activeCertificate,
  ];

  const mockWaterLogs = [
    mockOverview.waterTank.activeLog,
  ];

  const mockSops = [
    {
      id: 1,
      store_id: 1,
      sop_code: 'POP-AMB-001',
      title: 'Higienização e Assepsia Geral',
      category: 'HIGIENE_AMBIENTAL' as const,
      version: '1.0',
      effective_date: '2026-11-20',
      next_review_date: '2027-11-20',
      author_name: 'Farm. Lívia',
      reviewer_pharmacist_crf: 'CRF-SP 98765',
      content_summary: 'Procedimento padrão de limpeza de superfícies',
      status: 'ACTIVE' as const,
      created_at: '2026-11-20T00:00:00Z',
      updated_at: '2026-11-20T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (sanitizationApi.getComplianceOverview as any).mockResolvedValue(mockOverview);
    (sanitizationApi.getLogs as any).mockResolvedValue(mockLogs);
    (sanitizationApi.getPestControlList as any).mockResolvedValue(mockPestCerts);
    (sanitizationApi.getWaterTankList as any).mockResolvedValue(mockWaterLogs);
    (sanitizationApi.getSops as any).mockResolvedValue(mockSops);
    (sanitizationApi.createLog as any).mockResolvedValue({ id: 11 });
    (sanitizationApi.verifyLog as any).mockResolvedValue({ id: 10, verified_by_pharmacist: 'CRF-SP 98765' });
  });

  it('1. Renderiza os indicadores de conformidade e a lista de higienizações', async () => {
    render(<SanitizationCompliancePage />);

    await waitFor(() => {
      expect(screen.getByText('95%')).toBeDefined();
      expect(screen.getByText('CONFORME')).toBeDefined();
      expect(screen.getAllByText('176 dias restantes').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('SALA_INJETAIS')).toBeDefined();
      expect(screen.getByText('Maria Souza')).toBeDefined();
    });
  });

  it('2. Permite alternar para as abas Dedetização, Caixa d Água e POPs', async () => {
    render(<SanitizationCompliancePage />);

    await waitFor(() => {
      expect(screen.getByText('95%')).toBeDefined();
    });

    // Clica na aba Dedetização & Pragas
    const pestTab = screen.getByRole('button', { name: /Dedetização & Pragas/ });
    fireEvent.click(pestTab);
    expect(screen.getByText('CERT-2026-99')).toBeDefined();
    expect(screen.getByText('Dedetizadora BioClean')).toBeDefined();

    // Clica na aba Caixa d'Água
    const waterTab = screen.getByRole('button', { name: /Caixa d'Água/ });
    fireEvent.click(waterTab);
    expect(screen.getByText('AquaPura')).toBeDefined();
    expect(screen.getByText('POTABLE_COMPLIANT')).toBeDefined();

    // Clica na aba POPs & Normas
    const sopsTab = screen.getByRole('button', { name: /POPs & Normas/ });
    fireEvent.click(sopsTab);
    expect(screen.getByText('POP-AMB-001')).toBeDefined();
    expect(screen.getByText('Higienização e Assepsia Geral')).toBeDefined();
  });

  it('3. Abre o modal de registrar higienização e envia formulário', async () => {
    render(<SanitizationCompliancePage />);

    await waitFor(() => {
      expect(screen.getByText('Registrar Higienização')).toBeDefined();
    });

    const openBtn = screen.getByText('Registrar Higienização');
    fireEvent.click(openBtn);

    expect(screen.getByText('Registrar Higienização de Setor')).toBeDefined();

    const performedByInput = screen.getByPlaceholderText('Nome do colaborador');
    fireEvent.change(performedByInput, { target: { value: 'Lucas Assistente' } });

    const submitBtn = screen.getByText('Salvar Registro');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(sanitizationApi.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          performedBy: 'Lucas Assistente',
        })
      );
    });
  });

  it('4. Homologa registro de limpeza com assinatura do RT', async () => {
    render(<SanitizationCompliancePage />);

    await waitFor(() => {
      expect(screen.getByText('Assinar RT')).toBeDefined();
    });

    const signBtn = screen.getByText('Assinar RT');
    fireEvent.click(signBtn);

    expect(screen.getByText('Assinatura do Farmacêutico RT')).toBeDefined();

    const crfInput = screen.getByPlaceholderText('Ex: CRF-SP 12345');
    fireEvent.change(crfInput, { target: { value: 'CRF-SP 98765' } });

    const homologarBtn = screen.getByText('Homologar');
    fireEvent.click(homologarBtn);

    await waitFor(() => {
      expect(sanitizationApi.verifyLog).toHaveBeenCalledWith(10, 'CRF-SP 98765');
    });
  });
});
