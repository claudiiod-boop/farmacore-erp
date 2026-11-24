import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QuarantineRegulatoryPage } from '../../src/pages/QuarantineRegulatoryPage';
import { quarantineApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  quarantineApi: {
    getKpis: vi.fn(),
    listQuarantine: vi.fn(),
    listRecalls: vi.fn(),
    sweepExpired: vi.fn(),
    registerRecall: vi.fn(),
    transfer: vi.fn(),
    resolveQuarantine: vi.fn(),
    getQuarantineById: vi.fn(),
  },
}));

describe('QuarantineRegulatoryPage (Quarentena Sanitária & Alertas Notivisa RDC 44/2009)', () => {
  const originalAlert = window.alert;

  afterEach(() => {
    window.alert = originalAlert;
    cleanup();
  });

  const mockKpis = {
    total_quarantined_items: 25,
    total_quarantined_value: 750.00,
    active_recalls_count: 2,
    expired_items_in_quarantine: 15,
    disposed_pgrss_items: 10,
  };

  const mockQuarantineList = [
    {
      id: 1,
      store_id: 1,
      product_id: 10,
      batch_id: 5,
      product_name: 'Amoxicilina 500mg 21 cápsulas',
      ean: '7891234567890',
      batch_number: 'L-AMOX-EXP',
      expiration_date: '2025-10-10',
      pmc: 30.00,
      quantity: 15,
      reason: 'EXPIRED' as const,
      origin: 'INVENTORY_SWEEP' as const,
      status: 'QUARANTINED' as const,
      quarantined_by: 'Varredura Automática',
      quarantined_at: '2026-11-24T08:00:00Z',
      created_at: '2026-11-24T08:00:00Z',
      updated_at: '2026-11-24T08:00:00Z',
    },
  ];

  const mockRecallsList = [
    {
      id: 1,
      anvisa_re_number: 'RE 1.234/2026',
      publication_date: '2026-11-24',
      product_id: 10,
      product_name: 'Amoxicilina 500mg 21 cápsulas',
      ean: '7891234567890',
      batch_number: 'L-AMOX-RECALL',
      reason: 'Desvio de qualidade na dissolução',
      severity: 'CRITICAL' as const,
      is_active: true,
      affected_units_blocked: 30,
      created_by: 'ANVISA',
      created_at: '2026-11-24T09:00:00Z',
      updated_at: '2026-11-24T09:00:00Z',
    },
  ];

  beforeEach(() => {
    window.alert = vi.fn();
    vi.clearAllMocks();

    vi.mocked(quarantineApi.getKpis).mockResolvedValue(mockKpis);
    vi.mocked(quarantineApi.listQuarantine).mockResolvedValue(mockQuarantineList);
    vi.mocked(quarantineApi.listRecalls).mockResolvedValue(mockRecallsList);
    vi.mocked(quarantineApi.sweepExpired).mockResolvedValue({
      sweptBatchesCount: 1,
      totalUnitsQuarantined: 15,
      records: [],
    });
    vi.mocked(quarantineApi.resolveQuarantine).mockResolvedValue({
      id: 1,
      store_id: 1,
      product_id: 10,
      batch_id: 5,
      quantity: 15,
      reason: 'EXPIRED',
      origin: 'INVENTORY_SWEEP',
      status: 'DISPOSED_PGRSS',
      quarantined_by: 'Varredura Automática',
      quarantined_at: '2026-11-24T08:00:00Z',
      created_at: '2026-11-24T08:00:00Z',
      updated_at: '2026-11-24T08:00:00Z',
    });
    vi.mocked(quarantineApi.registerRecall).mockResolvedValue({
      recallId: 2,
      anvisaReNumber: 'RE 9.999/2026',
      unitsBlocked: 40,
    });
  });

  it('renders KPIs and quarantine list on mount', async () => {
    render(<QuarantineRegulatoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('kpi-quarantined-items').textContent).toBe('25 un');
      expect(screen.getByTestId('kpi-quarantined-value').textContent).toContain('750.00');
      expect(screen.getByTestId('kpi-active-recalls').textContent).toBe('2');
      expect(screen.getByTestId('kpi-expired-count').textContent).toBe('15 un');
      expect(screen.getByTestId('kpi-pgrss-disposed').textContent).toBe('10 un');
    });

    expect(screen.getByTestId('sweep-expired-button')).toBeDefined();
    expect(screen.getByText('Amoxicilina 500mg 21 cápsulas')).toBeDefined();
    expect(screen.getByText('L-AMOX-EXP')).toBeDefined();
    expect(screen.getByTestId('resolve-btn-1')).toBeDefined();
  });

  it('triggers sweep expired batches when button is clicked', async () => {
    render(<QuarantineRegulatoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('sweep-expired-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('sweep-expired-button'));

    await waitFor(() => {
      expect(quarantineApi.sweepExpired).toHaveBeenCalledWith(1, expect.any(String));
    });
  });

  it('opens resolve modal and confirms PGRSS disposal', async () => {
    render(<QuarantineRegulatoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('resolve-btn-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('resolve-btn-1'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-resolve-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('confirm-resolve-button'));

    await waitFor(() => {
      expect(quarantineApi.resolveQuarantine).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          resolution: 'DISPOSED_PGRSS',
        })
      );
    });
  });

  it('navigates to recalls tab and registers new recall alert', async () => {
    render(<QuarantineRegulatoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-recalls-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('tab-recalls-button'));

    await waitFor(() => {
      expect(screen.getByText('RE 1.234/2026')).toBeDefined();
      expect(screen.getByTestId('recall-re-input')).toBeDefined();
    });

    fireEvent.change(screen.getByTestId('recall-re-input'), { target: { value: 'RE 9.999/2026' } });
    fireEvent.change(screen.getByTestId('recall-product-input'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('recall-batch-input'), { target: { value: 'L-AMOX-XYZ' } });

    fireEvent.click(screen.getByTestId('new-recall-button'));

    await waitFor(() => {
      expect(quarantineApi.registerRecall).toHaveBeenCalledWith(
        expect.objectContaining({
          anvisaReNumber: 'RE 9.999/2026',
          productId: 10,
          batchNumber: 'L-AMOX-XYZ',
          autoBlockStock: true,
        })
      );
    });
  });
});
