import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CommissionsPage } from '../../src/pages/CommissionsPage';
import { commissionApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  commissionApi: {
    getCommissionKpis: vi.fn(),
    listSellers: vi.fn(),
    createSeller: vi.fn(),
    listRules: vi.fn(),
    updateRule: vi.fn(),
    listCampaigns: vi.fn(),
    createCampaign: vi.fn(),
    listGoals: vi.fn(),
    setSalesGoal: vi.fn(),
    calculateSaleCommissions: vi.fn(),
    getSellerStatement: vi.fn(),
    closeMonthlyCommissions: vi.fn(),
  },
}));

describe('CommissionsPage (Comissões, Metas & Campanhas de Balcão)', () => {
  const originalAlert = window.alert;

  afterEach(() => {
    window.alert = originalAlert;
    cleanup();
  });

  beforeEach(() => {
    window.alert = vi.fn();
    vi.clearAllMocks();

    vi.mocked(commissionApi.getCommissionKpis).mockResolvedValue({
      totalCommissionsCurrentMonth: 3450.8,
      totalSalesAchievedCurrentMonth: 78500.0,
      globalGoalProgressPercent: 88.5,
      topSellerName: 'Lucas Atendente',
      topSellerCommission: 1250.0,
      activeCampaignsCount: 3,
    });

    vi.mocked(commissionApi.listSellers).mockResolvedValue([
      {
        id: 1,
        store_id: 1,
        name: 'Lucas Atendente',
        cpf: '111.222.333-01',
        role: 'BALCONISTA',
        is_active: 1,
        created_at: '2026-01-01',
        store_name: 'FarmaCore Matriz',
        current_month_sales: 32000.0,
        current_month_commission: 1250.0,
      },
    ]);

    vi.mocked(commissionApi.listGoals).mockResolvedValue([
      {
        id: 10,
        seller_id: 1,
        store_id: 1,
        period_month: '2026-11',
        target_amount: 30000.0,
        achieved_amount: 32000.0,
        accelerator_multiplier: 1.25,
        status: 'ACHIEVED',
        created_at: '2026-11-01',
        seller_name: 'Lucas Atendente',
        progress_percentage: 106.7,
      },
    ]);

    vi.mocked(commissionApi.listCampaigns).mockResolvedValue([
      {
        id: 5,
        name: 'Campanha Eurofarma Inverno',
        manufacturer: 'Eurofarma',
        product_id: null,
        bonus_per_unit: 2.0,
        start_date: '2026-11-01',
        end_date: '2026-11-30',
        is_active: 1,
        created_at: '2026-11-01',
      },
    ]);

    vi.mocked(commissionApi.listRules).mockResolvedValue([
      {
        id: 1,
        category_type: 'GENERICO',
        percentage: 6.0,
        description: 'Genéricos em geral',
        is_active: 1,
        updated_at: '2026-11-01',
      },
    ]);
  });

  it('should render header, KPI cards and sellers table', async () => {
    render(<CommissionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Gestão de Comissões, Metas & Campanhas')).toBeDefined();
      expect(screen.getAllByText('Lucas Atendente').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('R$ 3450.80')).toBeDefined();
      expect(screen.getByText('Ranking de Vendedores & Metas')).toBeDefined();
      expect(screen.getByText('Campanhas por Caixa & Fabricante')).toBeDefined();
      expect(screen.getByText('Regras por Categoria Farmacêutica')).toBeDefined();
      expect(screen.getByText('1.25x')).toBeDefined();
    });
  });

  it('should open seller statement modal and close commissions for payroll', async () => {
    vi.mocked(commissionApi.getSellerStatement).mockResolvedValue([
      {
        id: 99,
        seller_id: 1,
        sale_id: 10,
        product_id: 101,
        category_type: 'GENERICO',
        item_total: 40.0,
        base_commission_percent: 6.0,
        base_commission_amount: 2.4,
        campaign_bonus_amount: 4.0,
        accelerator_multiplier: 1.25,
        final_commission_amount: 8.0,
        period_month: '2026-11',
        status: 'PENDING',
        created_at: '2026-11-23',
        product_name: 'Losartana 50mg Genérico',
      },
    ]);

    vi.mocked(commissionApi.closeMonthlyCommissions).mockResolvedValue({
      updatedCount: 1,
      totalAmount: 8.0,
    });

    render(<CommissionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Extrato')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Extrato'));

    await waitFor(() => {
      expect(screen.getByText('Extrato de Comissões: Lucas Atendente')).toBeDefined();
      expect(screen.getByText('Losartana 50mg Genérico')).toBeDefined();
      expect(screen.getByText('Confirmar Pagamento (Folha)')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Confirmar Pagamento (Folha)'));

    await waitFor(() => {
      expect(commissionApi.closeMonthlyCommissions).toHaveBeenCalledWith({
        sellerId: 1,
        periodMonth: expect.any(String),
        status: 'PAID',
      });
    });
  });

  it('should switch to campaigns tab and open new campaign modal', async () => {
    render(<CommissionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Campanhas por Caixa & Fabricante')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Campanhas por Caixa & Fabricante'));

    await waitFor(() => {
      expect(screen.getByText('Campanha Eurofarma Inverno')).toBeDefined();
      expect(screen.getByText('+ R$ 2.00 / cx')).toBeDefined();
    });

    // Clica no botão Nova Campanha dentro da aba
    const newCampBtns = screen.getAllByText('Nova Campanha');
    fireEvent.click(newCampBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Nova Campanha por Caixa')).toBeDefined();
    });
  });

  it('should switch to rules tab and open edit rule modal', async () => {
    render(<CommissionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Regras por Categoria Farmacêutica')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Regras por Categoria Farmacêutica'));

    await waitFor(() => {
      expect(screen.getByText('GENERICO')).toBeDefined();
      expect(screen.getByText('6.0%')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Editar'));

    await waitFor(() => {
      expect(screen.getByText('Editar Regra: GENERICO')).toBeDefined();
    });
  });
});
