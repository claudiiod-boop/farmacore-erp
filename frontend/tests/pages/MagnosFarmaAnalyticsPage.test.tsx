import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { MagnosFarmaAnalyticsPage } from '../../src/pages/MagnosFarmaAnalyticsPage';
import { analyticsApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  analyticsApi: {
    getLive: vi.fn(),
    setTarget: vi.fn(),
    createWhatsAppQuotation: vi.fn(),
    listWhatsAppQuotations: vi.fn(),
    updateQuotationStatus: vi.fn(),
  },
}));

describe('MagnosFarmaAnalyticsPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(analyticsApi.getLive).mockResolvedValue({
      storeId: 1,
      storeName: 'Magnos Farma Matriz',
      todaySalesBrl: 3500.5,
      todayReceiptsCount: 42,
      todayAverageTicketBrl: 83.35,
      monthSalesBrl: 89000.0,
      monthReceiptsCount: 1120,
      monthAverageTicketBrl: 79.46,
      monthTotalDiscountBrl: 4200.0,
      monthAverageDiscountPct: 4.5,
      monthTargetBrl: 150000.0,
      monthTargetAchievementPct: 59.3,
      monthProjectedSalesBrl: 142000.0,
      hourlyDistribution: [
        { hour: 9, customersCount: 5, totalAmountBrl: 450.0 },
        { hour: 10, customersCount: 8, totalAmountBrl: 820.0 },
      ],
      categoryDistribution: [
        { category: 'Medicamentos', totalBrl: 54000.0, percentage: 60.67 },
        { category: 'Perfumaria', totalBrl: 21000.0, percentage: 23.6 },
      ],
      employeePerformance: [
        {
          employeeId: 1,
          employeeName: 'Carlos Balconista',
          customersServed: 520,
          totalSalesBrl: 42000.0,
          averageTicketBrl: 80.77,
          targetBrl: 35000.0,
          targetAchievementPct: 120.0,
        },
      ],
      topProducts: [
        {
          productId: 101,
          productName: 'Dipirona 500mg 10cp',
          category: 'Geral',
          quantitySold: 120,
          totalBrl: 1020.0,
        },
      ],
    });

    vi.mocked(analyticsApi.listWhatsAppQuotations).mockResolvedValue([
      {
        id: 1,
        store_id: 1,
        customer_name: 'Dona Helena',
        customer_phone: '11977778888',
        attendant_name: 'Carlos Balcão',
        subtotal_brl: 50.0,
        discount_brl: 5.0,
        total_brl: 45.0,
        status: 'OPEN',
        valid_until: '2026-11-29',
        whatsapp_message_payload: 'Orçamento Farmacêutico para Dona Helena...',
        whatsapp_url: 'https://api.whatsapp.com/send?phone=5511977778888&text=teste',
        created_at: '2026-11-26 12:00:00',
      },
    ]);
  });

  it('renders executive KPIs and employee ranking correctly', async () => {
    render(<MagnosFarmaAnalyticsPage />);

    expect(screen.getByTestId('magnos-farma-analytics-page')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId('kpi-today-sales').textContent).toContain('3500.50');
      expect(screen.getByTestId('kpi-month-sales').textContent).toContain('89000.00');
      expect(screen.getByTestId('kpi-month-projection').textContent).toContain('142000.00');
      expect(screen.getByTestId('employee-row-1')).toBeDefined();
      expect(screen.getByText('Carlos Balconista')).toBeDefined();
    });
  });

  it('switches to WhatsApp tab and renders quotation list', async () => {
    render(<MagnosFarmaAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-whatsapp')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('tab-whatsapp'));

    await waitFor(() => {
      expect(screen.getByTestId('quotation-row-1')).toBeDefined();
      expect(screen.getByText('Dona Helena')).toBeDefined();
      expect(screen.getByText('11977778888')).toBeDefined();
    });
  });

  it('allows creating a new WhatsApp quotation and opening payload modal', async () => {
    vi.mocked(analyticsApi.createWhatsAppQuotation).mockResolvedValue({
      id: 2,
      store_id: 1,
      customer_name: 'Sr. João Silva',
      customer_phone: '11999990000',
      attendant_name: 'Carlos Balcão',
      subtotal_brl: 85.0,
      discount_brl: 5.0,
      total_brl: 80.0,
      status: 'OPEN',
      valid_until: '2026-11-29',
      whatsapp_message_payload: '👋 Olá, Sr. João Silva! Segue seu Orçamento...',
      whatsapp_url: 'https://api.whatsapp.com/send?phone=5511999990000&text=Orçamento',
      created_at: '2026-11-26 15:00:00',
    });

    render(<MagnosFarmaAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-open-quote-modal')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('btn-open-quote-modal'));
    expect(screen.getByTestId('input-quote-name')).toBeDefined();

    fireEvent.change(screen.getByTestId('input-quote-name'), { target: { value: 'Sr. João Silva' } });
    fireEvent.change(screen.getByTestId('input-quote-phone'), { target: { value: '11999990000' } });

    fireEvent.click(screen.getByTestId('btn-submit-quotation'));

    await waitFor(() => {
      expect(analyticsApi.createWhatsAppQuotation).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_name: 'Sr. João Silva',
          customer_phone: '11999990000',
        })
      );
      expect(screen.getByTestId('active-quote-modal')).toBeDefined();
      expect(screen.getByTestId('btn-open-wa-link')).toBeDefined();
    });
  });

  it('allows converting a WhatsApp quotation into confirmed sale', async () => {
    vi.mocked(analyticsApi.updateQuotationStatus).mockResolvedValue({
      id: 1,
      store_id: 1,
      customer_name: 'Dona Helena',
      customer_phone: '11977778888',
      attendant_name: 'Carlos Balcão',
      subtotal_brl: 50.0,
      discount_brl: 5.0,
      total_brl: 45.0,
      status: 'CONVERTED',
      valid_until: '2026-11-29',
      whatsapp_message_payload: 'Orçamento...',
      created_at: '2026-11-26 12:00:00',
    });

    render(<MagnosFarmaAnalyticsPage />);

    fireEvent.click(screen.getByTestId('tab-whatsapp'));

    await waitFor(() => {
      expect(screen.getByTestId('btn-convert-quote-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('btn-convert-quote-1'));

    await waitFor(() => {
      expect(analyticsApi.updateQuotationStatus).toHaveBeenCalledWith(1, 'CONVERTED');
    });
  });
});
