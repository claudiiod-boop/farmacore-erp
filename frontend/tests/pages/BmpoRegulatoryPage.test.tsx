import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { BmpoRegulatoryPage } from '../../src/pages/BmpoRegulatoryPage';
import { bmpoApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  bmpoApi: {
    listReports: vi.fn(),
    getKpis: vi.fn(),
    getReportById: vi.fn(),
    generateBmpo: vi.fn(),
    generateRmnr: vi.fn(),
    fileWithVisa: vi.fn(),
    deleteReport: vi.fn(),
    getPrintDocument: vi.fn(),
  },
}));

describe('BmpoRegulatoryPage (Balanços Oficiais BMPO, RMNRA & RMNRB Portaria 344/98)', () => {
  const originalAlert = window.alert;

  afterEach(() => {
    window.alert = originalAlert;
    cleanup();
  });

  const mockKpis = {
    total_reports: 5,
    filed_reports: 3,
    pending_filings: 2,
    rmnra_count: 2,
    rmnrb_count: 2,
  };

  const mockReports = [
    {
      id: 1,
      store_id: 1,
      report_type: 'BMPO_TRIMESTRAL' as const,
      period_year: 2026,
      period_quarter: 4,
      period_month: null,
      pharmacist_name: 'Dra. Camila',
      pharmacist_crf: 'CRF-SP 54321',
      status: 'DRAFT' as const,
      visa_protocol_number: null,
      visa_filing_date: null,
      observations: null,
      created_at: '2026-11-23T10:00:00Z',
      updated_at: '2026-11-23T10:00:00Z',
    },
    {
      id: 2,
      store_id: 1,
      report_type: 'RMNRA' as const,
      period_year: 2026,
      period_quarter: null,
      period_month: 11,
      pharmacist_name: 'Dra. Camila',
      pharmacist_crf: 'CRF-SP 54321',
      status: 'FILED_WITH_VISA' as const,
      visa_protocol_number: 'VISA-SP-9988',
      visa_filing_date: '2026-11-20',
      observations: null,
      created_at: '2026-11-20T10:00:00Z',
      updated_at: '2026-11-20T10:00:00Z',
    },
  ];

  const mockBmpoDetails = {
    ...mockReports[0],
    items: [
      {
        id: 101,
        report_id: 1,
        product_id: 10,
        active_ingredient: 'Clonazepam',
        therapeutic_class: 'Psicotrópico',
        control_list: 'B1',
        presentation: 'Clonazepam 2mg 30 comp',
        unit_measure: 'CX',
        initial_stock: 15,
        acquisitions: 10,
        sales: 5,
        losses: 0,
        final_stock: 20,
      },
    ],
    prescriptions: [],
  };

  beforeEach(() => {
    window.alert = vi.fn();
    vi.clearAllMocks();

    vi.mocked(bmpoApi.listReports).mockResolvedValue(mockReports);
    vi.mocked(bmpoApi.getKpis).mockResolvedValue(mockKpis);
    vi.mocked(bmpoApi.getReportById).mockResolvedValue(mockBmpoDetails);
  });

  it('1. Renderiza a tela, KPIs regulatórios e título principal', async () => {
    render(<BmpoRegulatoryPage />);

    expect(screen.getByText('Balanços Oficiais BMPO, RMNRA & RMNRB')).toBeDefined();
    expect(screen.getByTestId('new-report-button')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-reports').textContent).toContain('5');
      expect(screen.getByTestId('kpi-filed-reports').textContent).toContain('3');
      expect(screen.getByTestId('kpi-pending-filings').textContent).toContain('2');
    });
  });

  it('2. Exibe demonstrativo de movimentação do BMPO com saldo inicial, entradas, saídas e estoque final', async () => {
    render(<BmpoRegulatoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('selected-report-title').textContent).toContain('BMPO_TRIMESTRAL');
      expect(screen.getByText('Clonazepam 2mg 30 comp')).toBeDefined();
      expect(screen.getByText('B1')).toBeDefined();
      expect(screen.getByText('15')).toBeDefined();
      expect(screen.getByText('10')).toBeDefined();
      expect(screen.getByText('20')).toBeDefined();
    });
  });

  it('3. Abre modal de geração de novo balanço e envia formulário com sucesso', async () => {
    vi.mocked(bmpoApi.generateBmpo).mockResolvedValue({
      ...mockReports[0],
      id: 3,
      report_type: 'BMPO_ANUAL',
      items: [],
      prescriptions: [],
    });

    render(<BmpoRegulatoryPage />);

    fireEvent.click(screen.getByTestId('new-report-button'));

    expect(screen.getByTestId('form-report-type-select')).toBeDefined();
    fireEvent.change(screen.getByTestId('form-report-type-select'), {
      target: { value: 'BMPO_ANUAL' },
    });

    fireEvent.click(screen.getByTestId('submit-generate-report-button'));

    await waitFor(() => {
      expect(bmpoApi.generateBmpo).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: 1,
          reportType: 'BMPO_ANUAL',
          periodYear: 2026,
        })
      );
    });
  });

  it('4. Abre modal de protocolo VISA e protocola entrega com número de carimbo', async () => {
    vi.mocked(bmpoApi.fileWithVisa).mockResolvedValue({
      ...mockBmpoDetails,
      status: 'FILED_WITH_VISA',
      visa_protocol_number: 'VISA-MUNICIPAL-776655',
      visa_filing_date: '2026-11-23',
    });

    render(<BmpoRegulatoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('open-file-visa-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('open-file-visa-button'));

    const inputProt = screen.getByTestId('visa-protocol-input');
    fireEvent.change(inputProt, { target: { value: 'VISA-MUNICIPAL-776655' } });

    fireEvent.click(screen.getByTestId('submit-file-visa-button'));

    await waitFor(() => {
      expect(bmpoApi.fileWithVisa).toHaveBeenCalledWith({
        reportId: 1,
        visaProtocolNumber: 'VISA-MUNICIPAL-776655',
        visaFilingDate: expect.any(String),
        observations: undefined,
      });
    });
  });

  it('5. Abre modal de documento oficial formatado para impressão padrão A4', async () => {
    vi.mocked(bmpoApi.getPrintDocument).mockResolvedValue({
      document: 'DOCUMENTO OFICIAL BMPO\nMINISTÉRIO DA SAÚDE\nPORTARIA 344/98',
    });

    render(<BmpoRegulatoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('print-report-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('print-report-button'));

    await waitFor(() => {
      expect(screen.getByTestId('official-print-content')).toBeDefined();
      expect(screen.getByTestId('official-print-content').textContent).toContain('PORTARIA 344/98');
    });
  });
});
