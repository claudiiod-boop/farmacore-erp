import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { DreAnalyticsPage } from '../../src/pages/DreAnalyticsPage';
import { dreApi, storesApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  dreApi: {
    getReport: vi.fn(),
    saveSnapshot: vi.fn(),
    listSnapshots: vi.fn(),
    listCostCenters: vi.fn(),
    createCostCenter: vi.fn(),
    listExpenses: vi.fn(),
    createExpense: vi.fn(),
    payExpense: vi.fn(),
    getBranchRanking: vi.fn(),
    getKpis: vi.fn(),
  },
  storesApi: {
    listStores: vi.fn(),
  },
}));

describe('DreAnalyticsPage (Demonstração Contábil & Centros de Custos)', () => {
  const originalAlert = window.alert;

  afterEach(() => {
    window.alert = originalAlert;
    cleanup();
  });

  const mockReport = {
    period_month: '2026-11',
    store_id: null,
    store_name: undefined,
    regime: 'COMPETENCIA' as const,
    gross_revenue: 120000.0,
    revenue_breakdown: {
      medicamentos_balcao: 80000.0,
      perfumaria_conveniencia: 25000.0,
      manipulacao_magistral: 10000.0,
      servicos_clinicos: 3000.0,
      taxas_tele_entrega: 2000.0,
      outras_receitas: 0,
      total_bruto: 120000.0,
    },
    deductions_amount: 12000.0,
    deductions_breakdown: {
      descontos_concedidos: 5400.0,
      cancelamentos_devolucoes: 0,
      impostos_vendas: 6600.0,
      total_deducoes: 12000.0,
    },
    net_revenue: 108000.0,
    cmv_amount: 54000.0,
    gross_profit: 54000.0,
    gross_margin_percent: 50.0,
    operating_expenses_amount: 25000.0,
    commissions_amount: 4500.0,
    total_operating_expenses: 29500.0,
    expenses_by_cost_center: [
      {
        cost_center_id: 1,
        code: 'CC-BALCAO',
        name: 'Balcão de Medicamentos',
        department_type: 'BALCAO' as const,
        amount: 15000.0,
        percentage_of_expenses: 50.85,
      },
      {
        cost_center_id: 6,
        code: 'CC-ADMIN',
        name: 'Administração Geral',
        department_type: 'ADMINISTRATIVO' as const,
        amount: 10000.0,
        percentage_of_expenses: 33.9,
      },
    ],
    ebitda_amount: 24500.0,
    ebitda_margin_percent: 22.69,
    financial_expenses_amount: 1500.0,
    net_profit: 23000.0,
    net_margin_percent: 21.3,
    break_even_point: 50400.0,
    contribution_margin_percent: 45.83,
  };

  const mockCostCenters = [
    {
      id: 1,
      code: 'CC-BALCAO',
      name: 'Balcão de Medicamentos',
      department_type: 'BALCAO' as const,
      is_active: 1,
      created_at: '2026-01-01',
    },
    {
      id: 6,
      code: 'CC-ADMIN',
      name: 'Administração Geral',
      department_type: 'ADMINISTRATIVO' as const,
      is_active: 1,
      created_at: '2026-01-01',
    },
  ];

  const mockExpenses = [
    {
      id: 10,
      store_id: 1,
      cost_center_id: 1,
      expense_type: 'PESSOAL' as const,
      description: 'Folha de Pagamento Balcão',
      amount: 15000.0,
      due_date: '2026-11-05',
      payment_date: '2026-11-05',
      status: 'PAID' as const,
      created_at: '2026-11-01',
      cost_center_name: 'Balcão de Medicamentos',
      cost_center_code: 'CC-BALCAO',
      department_type: 'BALCAO' as const,
    },
    {
      id: 11,
      store_id: 1,
      cost_center_id: 6,
      expense_type: 'ADMINISTRATIVA' as const,
      description: 'Aluguel do Ponto Comercial',
      amount: 10000.0,
      due_date: '2026-11-10',
      status: 'PENDING' as const,
      created_at: '2026-11-01',
      cost_center_name: 'Administração Geral',
      cost_center_code: 'CC-ADMIN',
      department_type: 'ADMINISTRATIVO' as const,
    },
  ];

  const mockBranchRanking = [
    {
      store_id: 1,
      store_name: 'FarmaCore Matriz Centro',
      gross_revenue: 120000.0,
      net_revenue: 108000.0,
      cmv_amount: 54000.0,
      operating_expenses: 29500.0,
      ebitda: 24500.0,
      ebitda_margin_percent: 22.7,
      net_profit: 23000.0,
      net_margin_percent: 21.3,
    },
  ];

  beforeEach(() => {
    window.alert = vi.fn();
    vi.clearAllMocks();

    vi.mocked(dreApi.getReport).mockResolvedValue(mockReport);
    vi.mocked(dreApi.listCostCenters).mockResolvedValue(mockCostCenters);
    vi.mocked(dreApi.listExpenses).mockResolvedValue(mockExpenses);
    vi.mocked(dreApi.getBranchRanking).mockResolvedValue(mockBranchRanking);
    vi.mocked(storesApi.listStores).mockResolvedValue([
      { id: 1, name: 'FarmaCore Matriz Centro' },
      { id: 2, name: 'FarmaCore Filial Bairro' },
    ]);
  });

  it('renders DRE dashboard header, KPI cards and structured DRE table', async () => {
    render(<DreAnalyticsPage />);

    expect(screen.getByText(/DRE Gerencial & Lucratividade Farmacêutica/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId('kpi-net-revenue').textContent).toContain('108.000,00');
      expect(screen.getByTestId('kpi-gross-profit').textContent).toContain('54.000,00');
      expect(screen.getByTestId('kpi-ebitda').textContent).toContain('24.500,00');
      expect(screen.getByTestId('kpi-net-profit').textContent).toContain('23.000,00');
      expect(screen.getByTestId('kpi-break-even').textContent).toContain('50.400,00');
    });

    // Linhas da tabela de DRE
    expect(screen.getByTestId('dre-gross-revenue').textContent).toContain('120000.00');
    expect(screen.getByTestId('dre-net-revenue').textContent).toContain('108000.00');
    expect(screen.getByTestId('dre-cmv').textContent).toContain('54000.00');
    expect(screen.getByTestId('dre-gross-profit').textContent).toContain('54000.00');
    expect(screen.getByTestId('dre-ebitda').textContent).toContain('24500.00');
  });

  it('navigates to Cost Centers & Expenses tab and pays an expense', async () => {
    vi.mocked(dreApi.payExpense).mockResolvedValue({
      ...mockExpenses[1],
      status: 'PAID',
      payment_date: '2026-11-10',
    });

    render(<DreAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-expenses')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('tab-expenses'));

    expect(screen.getByText('Folha de Pagamento Balcão')).toBeDefined();
    expect(screen.getByText('Aluguel do Ponto Comercial')).toBeDefined();

    // Clica no botão de dar baixa
    const payBtn = screen.getByTestId('pay-expense-button-11');
    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(dreApi.payExpense).toHaveBeenCalledWith(11);
    });
  });

  it('navigates to Branch Ranking tab', async () => {
    render(<DreAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-branches')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('tab-branches'));

    expect(screen.getByText(/Ranking de Rentabilidade e Margem EBITDA por Filial/i)).toBeDefined();
    expect(screen.getAllByText('FarmaCore Matriz Centro').length).toBeGreaterThanOrEqual(1);
  });

  it('switches between accrual (Competência) and cash (Caixa) regimes', async () => {
    render(<DreAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('regime-caixa-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('regime-caixa-button'));

    await waitFor(() => {
      expect(dreApi.getReport).toHaveBeenCalledWith('2026-11', undefined, 'CAIXA');
    });
  });

  it('freezes official monthly snapshot on button click', async () => {
    vi.mocked(dreApi.saveSnapshot).mockResolvedValue({} as any);

    render(<DreAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('save-snapshot-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('save-snapshot-button'));

    await waitFor(() => {
      expect(dreApi.saveSnapshot).toHaveBeenCalledWith('2026-11', undefined, 'COMPETENCIA');
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('congelado com sucesso'));
    });
  });

  it('opens new expense modal and creates expense', async () => {
    vi.mocked(dreApi.createExpense).mockResolvedValue({} as any);

    render(<DreAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('open-expense-modal-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('open-expense-modal-button'));

    expect(screen.getByText('Lançar Despesa Operacional')).toBeDefined();

    fireEvent.change(screen.getByTestId('expense-description-input'), {
      target: { value: 'Material de Escritório e Bobinas PDV' },
    });
    fireEvent.change(screen.getByTestId('expense-amount-input'), {
      target: { value: '350.50' },
    });

    fireEvent.click(screen.getByTestId('expense-submit-button'));

    await waitFor(() => {
      expect(dreApi.createExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Material de Escritório e Bobinas PDV',
          amount: 350.5,
        })
      );
    });
  });
});
