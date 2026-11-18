import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import FinancialDashboardPage from '../../src/pages/FinancialDashboardPage';
import { api } from '../../src/services/api';
import type { BlindCashClosure, DreReport, AbcCurveReport } from '../../src/types';

const mockClosures: BlindCashClosure[] = [
  {
    id: 1,
    cashSessionId: 101,
    operatorName: 'João Caixa',
    closedAt: '2026-11-18T18:00:00.000Z',
    systemCash: 250.0,
    systemCredit: 300.0,
    systemDebit: 150.0,
    systemPix: 50.0,
    systemPbm: 0.0,
    systemTotal: 750.0,
    declaredCash: 250.0,
    declaredCredit: 300.0,
    declaredDebit: 150.0,
    declaredPix: 50.0,
    declaredPbm: 0.0,
    declaredTotal: 750.0,
    cashDifference: 0.0,
    totalDifference: 0.0,
    differenceStatus: 'EXACT',
    status: 'PENDING_REVIEW',
    createdAt: '2026-11-18T18:00:00.000Z',
  },
];

const mockTefForecast = {
  items: [
    {
      expectedSettlementDate: '2026-11-19',
      acquirerName: 'CIELO',
      operationType: 'DEBITO',
      transactionCount: 5,
      grossAmount: 500.0,
      estimatedFee: 7.5,
      netAmount: 492.5,
    },
  ],
  totalGross: 500.0,
  totalEstimatedFee: 7.5,
  totalNet: 492.5,
  totalTransactions: 5,
};

const mockTefReconciliation = {
  transactions: [
    {
      id: 1,
      transactionUuid: 'uuid-1',
      terminalId: 'TER01',
      operationType: 'DEBITO' as const,
      status: 'CONFIRMED' as const,
      amount: 100.0,
      brandName: 'VISA',
      acquirerName: 'CIELO',
      nsu: 'NSU12345',
      expectedSettlementDate: '2026-11-19',
      settlementStatus: 'PENDING' as const,
      netAmount: 98.5,
      createdAt: '2026-11-18T10:00:00.000Z',
    },
  ],
  summary: {
    totalPending: 98.5,
    totalSettled: 0,
    totalDivergent: 0,
    pendingCount: 1,
    settledCount: 0,
    divergentCount: 0,
  },
};

const mockDre: DreReport = {
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  grossRevenue: 10000.0,
  discounts: 500.0,
  cancellations: 200.0,
  tefFees: 300.0,
  netRevenue: 9000.0,
  cmv: 5000.0,
  grossProfit: 4000.0,
  grossMarginPercent: 44.44,
  operatingExpenses: 1500.0,
  operatingResult: 2500.0,
  operatingMarginPercent: 27.78,
};

const mockAbc: AbcCurveReport = {
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  totalRevenue: 10000.0,
  totalItemsSold: 120,
  items: [
    {
      rank: 1,
      productId: 1,
      ean: '7891234567890',
      productName: 'Amoxicilina 500mg',
      category: 'GENERICO',
      quantitySold: 80,
      grossRevenue: 8000.0,
      revenueSharePercent: 80.0,
      cumulativeSharePercent: 80.0,
      abcClass: 'A',
    },
    {
      rank: 2,
      productId: 2,
      ean: '7899876543210',
      productName: 'Shampoo Anticaspa',
      category: 'PERFUMARIA',
      quantitySold: 40,
      grossRevenue: 2000.0,
      revenueSharePercent: 20.0,
      cumulativeSharePercent: 100.0,
      abcClass: 'B',
    },
  ],
  classCounts: { A: 1, B: 1, C: 0 },
  classRevenues: { A: 8000.0, B: 2000.0, C: 0.0 },
  categoriesSummary: [
    {
      category: 'GENERICO',
      itemCount: 1,
      totalRevenue: 8000.0,
      revenueSharePercent: 80.0,
    },
  ],
};

describe('FinancialDashboardPage Component', () => {
  beforeEach(() => {
    vi.spyOn(api, 'listClosures').mockResolvedValue({ closures: mockClosures, total: 1 });
    vi.spyOn(api, 'getTefForecast').mockResolvedValue(mockTefForecast);
    vi.spyOn(api, 'listTefReconciliation').mockResolvedValue(mockTefReconciliation);
    vi.spyOn(api, 'getDreReport').mockResolvedValue(mockDre);
    vi.spyOn(api, 'getAbcCurveReport').mockResolvedValue(mockAbc);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render the 4 main tabs and show cash closures by default', async () => {
    render(<FinancialDashboardPage />);

    expect(screen.getByText(/Módulo Financeiro & Gestão/i)).toBeDefined();
    expect(screen.getByTestId('tab-closures')).toBeDefined();
    expect(screen.getByTestId('tab-tef')).toBeDefined();
    expect(screen.getByTestId('tab-dre')).toBeDefined();
    expect(screen.getByTestId('tab-abc')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/João Caixa/i)).toBeDefined();
      expect(screen.getByText(/Sessão #101/i)).toBeDefined();
      expect(screen.getByTestId('btn-review-closure-1')).toBeDefined();
    });
  });

  it('should open review modal when clicking Auditar on a cash closure', async () => {
    render(<FinancialDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-review-closure-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('btn-review-closure-1'));

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Auditoria & Homologação de Fechamento de Caixa/i)).toBeDefined();
  });

  it('should switch to Conciliação TEF tab, show forecast cards, and handle manual bank settlement', async () => {
    const settleSpy = vi.spyOn(api, 'settleTefTransaction').mockResolvedValue({
      ...mockTefReconciliation.transactions[0],
      settlementStatus: 'SETTLED',
      settledAmount: 98.5,
    });

    render(<FinancialDashboardPage />);

    fireEvent.click(screen.getByTestId('tab-tef'));

    await waitFor(() => {
      expect(screen.getByText(/Recebíveis Previstos \(Bruto\)/i)).toBeDefined();
      expect(screen.getByText(/NSU12345/i)).toBeDefined();
      expect(screen.getByTestId('btn-settle-NSU12345')).toBeDefined();
    });

    // Open settle modal
    fireEvent.click(screen.getByTestId('btn-settle-NSU12345'));

    expect(screen.getByText(/Baixa e Conciliação Bancária TEF/i)).toBeDefined();

    fireEvent.change(screen.getByTestId('input-settle-bank'), {
      target: { value: 'BANCO BRADESCO AG 1000' },
    });
    fireEvent.click(screen.getByTestId('btn-confirm-settle'));

    await waitFor(() => {
      expect(settleSpy).toHaveBeenCalledWith({
        nsu: 'NSU12345',
        settledAmount: 98.5,
        settledFee: 1.5,
        bankAccount: 'BANCO BRADESCO AG 1000',
      });
      expect(screen.getByText(/baixada com sucesso no extrato bancário/i)).toBeDefined();
    });
  });

  it('should switch to DRE Gerencial tab and display structured financial income statement', async () => {
    render(<FinancialDashboardPage />);

    fireEvent.click(screen.getByTestId('tab-dre'));

    await waitFor(() => {
      expect(screen.getByText(/Demonstração do Resultado do Exercício \(DRE\)/i)).toBeDefined();
      expect(screen.getByText(/\(\+\) RECEITA BRUTA DE VENDAS/i)).toBeDefined();
      expect(screen.getByText(/\(=\) RECEITA OPERACIONAL LÍQUIDA/i)).toBeDefined();
      expect(screen.getByText(/\(=\) LUCRO BRUTO/i)).toBeDefined();
      expect(screen.getByText(/\(=\) RESULTADO OPERACIONAL LÍQUIDO/i)).toBeDefined();
      expect(screen.getByText(/27\.78%/i)).toBeDefined();
    });
  });

  it('should switch to Curva ABC tab, show Pareto classes A/B/C, and filter by pharmaceutical category', async () => {
    render(<FinancialDashboardPage />);

    fireEvent.click(screen.getByTestId('tab-abc'));

    await waitFor(() => {
      expect(screen.getByText(/CLASSE A \(80% Faturamento\)/i)).toBeDefined();
      expect(screen.getByText(/Amoxicilina 500mg/i)).toBeDefined();
      expect(screen.getAllByText(/Classe A/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Shampoo Anticaspa/i)).toBeDefined();
    });

    // Filter by GENERICO
    fireEvent.change(screen.getByTestId('select-abc-category'), { target: { value: 'GENERICO' } });

    await waitFor(() => {
      expect(api.getAbcCurveReport).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'GENERICO'
      );
    });
  });
});
