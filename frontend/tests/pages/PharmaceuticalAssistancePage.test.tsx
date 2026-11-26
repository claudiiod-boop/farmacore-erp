import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { PharmaceuticalAssistancePage } from '../../src/pages/PharmaceuticalAssistancePage';
import { assistanceApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  assistanceApi: {
    getKpis: vi.fn(),
    getStaff: vi.fn(),
    getShifts: vi.fn(),
    getLogbook: vi.fn(),
    registerStaff: vi.fn(),
    setShifts: vi.fn(),
    recordLogbook: vi.fn(),
    getExtract: vi.fn(),
  },
}));

describe('PharmaceuticalAssistancePage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(assistanceApi.getKpis).mockResolvedValue({
      totalActivePharmacists: 1,
      hasActiveRT: true,
      activeRtName: 'Dra. Gabriela Souza',
      crtCertificateNumber: 'CRT-SP-2026-99',
      crtValidityDate: '2026-12-31',
      crtDaysRemaining: 35,
      totalWeeklyHoursCovered: 44,
      totalLogbookEntries: 2,
      recentInspectionsCount: 1,
    });

    vi.mocked(assistanceApi.getStaff).mockResolvedValue([
      {
        id: 1,
        store_id: 1,
        name: 'Dra. Gabriela Souza',
        cpf: '123.456.789-00',
        crf_number: '12345',
        crf_uf: 'SP',
        role: 'RT_TITULAR',
        crt_certificate_number: 'CRT-SP-2026-99',
        crt_validity_date: '2026-12-31',
        is_active: 1,
        created_at: '2026-11-26 10:00:00',
      },
    ]);

    vi.mocked(assistanceApi.getShifts).mockResolvedValue([
      {
        id: 1,
        store_id: 1,
        staff_id: 1,
        day_of_week: 1,
        start_time: '08:00',
        end_time: '17:00',
        is_active: 1,
        created_at: '2026-11-26 10:00:00',
        staff_name: 'Dra. Gabriela Souza',
        crf: '12345/SP',
      },
    ]);

    vi.mocked(assistanceApi.getLogbook).mockResolvedValue([
      {
        id: 1,
        store_id: 1,
        staff_id: 1,
        entry_type: 'INSPECTION_CRF',
        title: 'Termo de Inspeção Sanitária',
        description: 'Fiscalização CRF/SP concluída sem não conformidades.',
        crf_inspector_name: 'Fiscal Marcos CRF 2099',
        crf_inspection_term_number: 'TERM-9988',
        action_taken: 'Ciência assinada.',
        entry_date: '2026-11-26 11:00:00',
        sha256_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        created_at: '2026-11-26 11:00:00',
        staff_name: 'Dra. Gabriela Souza',
        crf: '12345/SP',
      },
    ]);
  });

  it('renders page header, KPIs and staff list correctly', async () => {
    render(<PharmaceuticalAssistancePage />);

    expect(screen.getByTestId('pharmaceutical-assistance-page')).toBeDefined();
    await waitFor(() => {
      expect(screen.getByTestId('kpi-rt-name').textContent).toContain('Dra. Gabriela Souza');
      expect(screen.getByTestId('kpi-weekly-hours').textContent).toContain('44h / sem');
      expect(screen.getByTestId('staff-row-1')).toBeDefined();
    });
  });

  it('switches between tabs and displays shifts and logbook entries', async () => {
    render(<PharmaceuticalAssistancePage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-shifts')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('tab-shifts'));
    await waitFor(() => {
      expect(screen.getByText('Segunda-feira')).toBeDefined();
      expect(screen.getByText('08:00')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('tab-logbook'));
    await waitFor(() => {
      expect(screen.getByTestId('log-entry-1')).toBeDefined();
      expect(screen.getByText('Termo de Inspeção Sanitária')).toBeDefined();
    });
  });

  it('allows registering a new pharmacist', async () => {
    vi.mocked(assistanceApi.registerStaff).mockResolvedValue({
      id: 2,
      store_id: 1,
      name: 'Dr. Lucas Silveira',
      cpf: '987.654.321-11',
      crf_number: '77889',
      crf_uf: 'SP',
      role: 'RT_SUBSTITUTO',
      is_active: 1,
      created_at: '2026-11-26 12:00:00',
    });

    render(<PharmaceuticalAssistancePage />);

    fireEvent.click(screen.getByTestId('btn-open-staff-modal'));
    expect(screen.getByTestId('input-staff-name')).toBeDefined();

    fireEvent.change(screen.getByTestId('input-staff-name'), { target: { value: 'Dr. Lucas Silveira' } });
    fireEvent.change(screen.getByTestId('input-staff-cpf'), { target: { value: '987.654.321-11' } });
    fireEvent.change(screen.getByTestId('input-staff-crf'), { target: { value: '77889' } });
    fireEvent.change(screen.getByTestId('select-staff-role'), { target: { value: 'RT_SUBSTITUTO' } });

    fireEvent.click(screen.getByTestId('btn-submit-staff'));

    await waitFor(() => {
      expect(assistanceApi.registerStaff).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Dr. Lucas Silveira',
          cpf: '987.654.321-11',
          crf_number: '77889',
          role: 'RT_SUBSTITUTO',
        })
      );
    });
  });

  it('allows registering an occurrence in the electronic logbook', async () => {
    vi.mocked(assistanceApi.recordLogbook).mockResolvedValue({
      id: 2,
      store_id: 1,
      staff_id: 1,
      entry_type: 'TECHNICAL_COMPLAINT',
      title: 'Desvio de Qualidade Frasco',
      description: 'Lote com precipitação no fundo do frasco.',
      entry_date: '2026-11-26 14:00:00',
      sha256_hash: '1122334455667788990011223344556677889900112233445566778899001122',
      created_at: '2026-11-26 14:00:00',
    });

    render(<PharmaceuticalAssistancePage />);

    await waitFor(() => {
      expect(screen.getByTestId('staff-row-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('btn-open-log-modal'));
    expect(screen.getByTestId('input-log-title')).toBeDefined();

    fireEvent.change(screen.getByTestId('select-log-staff'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('input-log-title'), { target: { value: 'Desvio de Qualidade Frasco' } });
    fireEvent.change(screen.getByTestId('input-log-description'), { target: { value: 'Lote com precipitação no fundo do frasco.' } });
    fireEvent.change(screen.getByTestId('select-log-type'), { target: { value: 'TECHNICAL_COMPLAINT' } });

    fireEvent.click(screen.getByTestId('btn-submit-log'));

    await waitFor(() => {
      expect(assistanceApi.recordLogbook).toHaveBeenCalledWith(
        expect.objectContaining({
          staff_id: 1,
          title: 'Desvio de Qualidade Frasco',
          description: 'Lote com precipitação no fundo do frasco.',
          entry_type: 'TECHNICAL_COMPLAINT',
        })
      );
    });
  });

  it('opens and closes official inspection extract modal', async () => {
    vi.mocked(assistanceApi.getExtract).mockResolvedValue({
      store: { id: 1, name: 'Magnos Farma Matriz', cnpj: '11.222.333/0001-44' },
      rtStaff: { id: 1, name: 'Dra. Gabriela Souza', crf_number: '12345', crf_uf: 'SP' },
      entries: [
        {
          id: 1,
          entry_type: 'INSPECTION_CRF',
          title: 'Termo de Inspeção Sanitária',
          description: 'Fiscalização regular.',
          entry_date: '2026-11-26 11:00:00',
          staff_name: 'Dra. Gabriela Souza',
          crf: '12345/SP',
        },
      ],
      totalEntries: 1,
      extractHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      generatedAt: '2026-11-26T15:00:00.000Z',
    });

    render(<PharmaceuticalAssistancePage />);

    fireEvent.click(screen.getByTestId('btn-open-extract'));

    await waitFor(() => {
      expect(screen.getByTestId('extract-modal')).toBeDefined();
      expect(screen.getByText(/Extrato Oficial do Livro de Ocorrências RT/i)).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('btn-close-extract'));
    await waitFor(() => {
      expect(screen.queryByTestId('extract-modal')).toBeNull();
    });
  });
});
