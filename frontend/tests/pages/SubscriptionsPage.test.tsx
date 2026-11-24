import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SubscriptionsPage } from '../../src/pages/SubscriptionsPage';
import { subscriptionApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  subscriptionApi: {
    listSubscriptions: vi.fn(),
    getSubscription: vi.fn(),
    createSubscription: vi.fn(),
    updateSubscriptionStatus: vi.fn(),
    addSubscriptionItem: vi.fn(),
    removeSubscriptionItem: vi.fn(),
    renewPrescription: vi.fn(),
    getExpiringPrescriptions: vi.fn(),
    processScheduledRefills: vi.fn(),
    getSubscriptionKpis: vi.fn(),
  },
}));

describe('SubscriptionsPage (Clube de Assinatura & Reposição Recorrente)', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(subscriptionApi.getSubscriptionKpis).mockResolvedValue({
      activeSubscriptions: 12,
      pausedSubscriptions: 2,
      cancelledSubscriptions: 1,
      totalMonthlyRecurringRevenue: 1540.5,
      refillsProcessedThisMonth: 8,
      expiringPrescriptionsNext15Days: 3,
    });

    vi.mocked(subscriptionApi.listSubscriptions).mockResolvedValue([
      {
        id: 1,
        customer_id: 101,
        store_id: 1,
        plan_name: 'Plano Hipertensão Familiar',
        interval_days: 30,
        preferred_delivery_day: 10,
        delivery_mode: 'DELIVERY',
        delivery_address: 'Rua das Flores, 123',
        delivery_neighborhood: 'Centro',
        delivery_city: 'São Paulo',
        payment_method: 'PIX_RECURRING',
        payment_card_token: null,
        discount_percentage: 10,
        status: 'ACTIVE',
        next_billing_date: '2026-12-10',
        last_billing_date: '2026-11-10',
        notes: null,
        created_at: '2026-10-01',
        updated_at: '2026-11-10',
        customer_name: 'Dona Maria de Lourdes',
        customer_cpf: '123.456.789-00',
        item_count: 2,
        total_recurring_amount: 85.0,
      },
    ]);

    vi.mocked(subscriptionApi.getExpiringPrescriptions).mockResolvedValue([
      {
        item_id: 55,
        subscription_id: 1,
        customer_id: 101,
        customer_name: 'Dona Maria de Lourdes',
        customer_phone: '(11) 98765-4321',
        product_id: 202,
        product_name: 'Clonazepam 2mg 30 comp',
        prescription_doctor_crm: '123456',
        prescription_doctor_uf: 'SP',
        prescription_expiry_date: '2026-11-20',
        days_until_expiry: -3,
        is_expired: true,
      },
    ]);
  });

  it('should render page header, KPI cards and default subscriptions table', async () => {
    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Clube de Assinaturas & Reposição Recorrente')
      ).toBeDefined();
      expect(screen.getByText('Plano Hipertensão Familiar')).toBeDefined();
      expect(screen.getByText('Dona Maria de Lourdes')).toBeDefined();
      expect(screen.getByText('R$ 1540.50')).toBeDefined();
      expect(screen.getByText('Contratos & Pacientes')).toBeDefined();
      expect(screen.getByText('Esteira de Reposições & Motor Autoship')).toBeDefined();
      expect(screen.getByText('Controle de Receitas de Uso Contínuo')).toBeDefined();
    });
  });

  it('should open new subscription modal and allow form submission', async () => {
    vi.mocked(subscriptionApi.createSubscription).mockResolvedValue({
      id: 2,
      customer_id: 1,
      store_id: 1,
      plan_name: 'Clube Diabetes Control',
      interval_days: 30,
      preferred_delivery_day: 5,
      delivery_mode: 'DELIVERY',
      payment_method: 'PIX_RECURRING',
      discount_percentage: 10,
      status: 'ACTIVE',
      next_billing_date: '2026-12-05',
      created_at: '2026-11-23',
      updated_at: '2026-11-23',
      items: [],
      cycles: [],
    } as any);

    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Nova Assinatura')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Nova Assinatura'));

    expect(screen.getByText('Nova Assinatura de Paciente')).toBeDefined();

    const submitBtn = screen.getByText('Confirmar Assinatura');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(subscriptionApi.createSubscription).toHaveBeenCalled();
    });
  });

  it('should switch to cycles tab and process scheduled refills', async () => {
    vi.mocked(subscriptionApi.processScheduledRefills).mockResolvedValue({
      currentDate: '2026-11-23',
      totalProcessed: 2,
      successCount: 1,
      prescriptionPendingCount: 1,
      failedCount: 0,
      details: [
        {
          subscriptionId: 1,
          customerName: 'Dona Maria de Lourdes',
          status: 'PROCESSED',
          preSaleId: 99,
          preSaleCode: 'PV-SUB-1-0001',
          deliveryOrderId: 77,
          totalAmount: 85.0,
        },
        {
          subscriptionId: 2,
          customerName: 'Seu João',
          status: 'PRESCRIPTION_PENDING',
          totalAmount: 0.0,
          message: 'Receita médica vencida',
        },
      ],
    });

    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Esteira de Reposições & Motor Autoship')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Esteira de Reposições & Motor Autoship'));

    expect(screen.getByText('Executar Varredura Agora')).toBeDefined();

    fireEvent.click(screen.getByText('Executar Varredura Agora'));

    await waitFor(() => {
      expect(subscriptionApi.processScheduledRefills).toHaveBeenCalled();
      expect(screen.getByText('PV-SUB-1-0001')).toBeDefined();
      expect(screen.getByText('PRESCRIPTION_PENDING')).toBeDefined();
    });
  });

  it('should switch to prescriptions tab and open prescription renewal modal', async () => {
    vi.mocked(subscriptionApi.renewPrescription).mockResolvedValue({} as any);

    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Controle de Receitas de Uso Contínuo')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Controle de Receitas de Uso Contínuo'));

    await waitFor(() => {
      expect(screen.getByText('Clonazepam 2mg 30 comp')).toBeDefined();
      expect(screen.getByText(/Vencida há 3 dias/i)).toBeDefined();
    });

    const renewBtn = screen.getByText('Renovar Receita');
    fireEvent.click(renewBtn);

    expect(screen.getByText('Renovar Prescrição Médica')).toBeDefined();
    const saveBtn = screen.getByText('Salvar Renovação');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(subscriptionApi.renewPrescription).toHaveBeenCalledWith(55, {
        prescription_doctor_crm: '123456',
        prescription_doctor_uf: 'SP',
        prescription_expiry_date: '2027-12-31',
      });
    });
  });
});
