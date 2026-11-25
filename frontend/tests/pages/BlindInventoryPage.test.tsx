import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { BlindInventoryPage } from '../../src/pages/BlindInventoryPage';
import { blindInventoryApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  blindInventoryApi: {
    listSessions: vi.fn(),
    getKpis: vi.fn(),
    getSessionById: vi.fn(),
    createSession: vi.fn(),
    countItem: vi.fn(),
    reconcileSession: vi.fn(),
    approveControlled: vi.fn(),
    finalizeSession: vi.fn()
  }
}));

describe('BlindInventoryPage Component', () => {
  const mockKpis = {
    total_sessions: 4,
    open_sessions: 1,
    accuracy_rate_percent: 98.5,
    total_divergence_value_month: 240.0,
    pending_controlled_approvals: 1
  };

  const mockSessions = [
    {
      id: 1,
      code: 'INV-202611-0001',
      store_id: 1,
      type: 'CONTROLADOS_SNGPC' as const,
      status: 'COUNTING' as const,
      started_at: '2026-11-25T10:00:00.000Z',
      total_items_counted: 10,
      total_divergences_count: 1,
      total_divergence_value: -50.0,
      created_at: '2026-11-25T10:00:00.000Z',
      updated_at: '2026-11-25T10:00:00.000Z'
    }
  ];

  const mockSessionDetails = {
    ...mockSessions[0],
    items: [
      {
        id: 101,
        inventory_id: 1,
        product_id: 10,
        product_name: 'Morfina 10mg 20 amp',
        product_ean: '7891234567890',
        batch_id: 5,
        batch_number: 'LOTE-MORF-99',
        system_quantity: 0, // Cego
        counted_quantity: 19,
        divergence_quantity: -1,
        unit_cost: 50.0,
        divergence_value: -50.0,
        is_controlled: 1,
        requires_pharmacist_approval: 1,
        pharmacist_approved: 0,
        created_at: '2026-11-25T10:05:00.000Z',
        updated_at: '2026-11-25T10:05:00.000Z'
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (blindInventoryApi.listSessions as any).mockResolvedValue({
      success: true,
      data: mockSessions
    });
    (blindInventoryApi.getKpis as any).mockResolvedValue({
      success: true,
      data: mockKpis
    });
    (blindInventoryApi.getSessionById as any).mockResolvedValue({
      success: true,
      data: mockSessionDetails
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Renderiza cabeçalho, KPIs e tabela de sessões de inventário', async () => {
    render(<BlindInventoryPage />);

    expect(screen.getByText('Balanço Patrimonial & Inventário Rotativo Cego')).toBeDefined();
    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-sessions').textContent).toBe('4');
      expect(screen.getByTestId('kpi-accuracy-rate').textContent).toContain('98.5%');
      expect(screen.getByTestId('kpi-pending-controlled').textContent).toBe('1');
      expect(screen.getByText('INV-202611-0001')).toBeDefined();
      expect(screen.getByText('CONTAGEM CEGA')).toBeDefined();
    });
  });

  it('2. Inicia nova sessão de inventário através do modal', async () => {
    (blindInventoryApi.createSession as any).mockResolvedValue({
      success: true,
      data: {
        id: 2,
        code: 'INV-202611-0002',
        store_id: 1,
        type: 'GERAL_PATRIMONIAL',
        status: 'COUNTING',
        started_at: new Date().toISOString(),
        total_items_counted: 0,
        total_divergences_count: 0,
        total_divergence_value: 0
      }
    });

    render(<BlindInventoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('create-inventory-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('create-inventory-button'));
    expect(screen.getByTestId('create-inventory-modal')).toBeDefined();

    fireEvent.change(screen.getByTestId('inventory-notes-input'), {
      target: { value: 'Balanço Geral Matriz' }
    });

    fireEvent.click(screen.getByTestId('confirm-create-inventory-button'));

    await waitFor(() => {
      expect(blindInventoryApi.createSession).toHaveBeenCalledWith({
        store_id: 1,
        type: 'GERAL_PATRIMONIAL',
        notes: 'Balanço Geral Matriz'
      });
      expect(screen.getByTestId('success-alert')).toBeDefined();
    });
  });

  it('3. Abre detalhes de inventário e lança contagem cega de produto', async () => {
    (blindInventoryApi.countItem as any).mockResolvedValue({
      success: true,
      data: { id: 101, counted_quantity: 20 }
    });

    render(<BlindInventoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('select-inventory-button-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('select-inventory-button-1'));

    await waitFor(() => {
      expect(screen.getByTestId('selected-inventory-panel')).toBeDefined();
      expect(screen.getByText('Morfina 10mg 20 amp')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('open-count-modal-button'));
    expect(screen.getByTestId('count-item-modal')).toBeDefined();

    fireEvent.change(screen.getByTestId('count-product-select'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('count-quantity-input'), { target: { value: '20' } });

    fireEvent.click(screen.getByTestId('confirm-count-button'));

    await waitFor(() => {
      expect(blindInventoryApi.countItem).toHaveBeenCalledWith(1, {
        product_id: 10,
        batch_id: 5,
        counted_quantity: 20
      });
      expect(screen.getByTestId('success-alert')).toBeDefined();
    });
  });

  it('4. Assina justificativa formal do Farmacêutico RT para medicamento controlado', async () => {
    (blindInventoryApi.approveControlled as any).mockResolvedValue({
      success: true,
      data: { id: 101, pharmacist_approved: 1 }
    });

    render(<BlindInventoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('select-inventory-button-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('select-inventory-button-1'));

    await waitFor(() => {
      expect(screen.getByTestId('approve-controlled-button-101')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('approve-controlled-button-101'));
    expect(screen.getByTestId('approve-controlled-modal')).toBeDefined();

    fireEvent.change(screen.getByTestId('pharmacist-crf-input'), { target: { value: 'CRF-SP 98.765' } });
    fireEvent.change(screen.getByTestId('pharmacist-justification-input'), {
      target: { value: 'Quebra de ampola constatada em conferência sanitária' }
    });

    fireEvent.click(screen.getByTestId('confirm-approve-controlled-button'));

    await waitFor(() => {
      expect(blindInventoryApi.approveControlled).toHaveBeenCalledWith(101, {
        pharmacist_crf: 'CRF-SP 98.765',
        justification: 'Quebra de ampola constatada em conferência sanitária'
      });
      expect(screen.getByTestId('success-alert')).toBeDefined();
    });
  });

  it('5. Finaliza sessão de inventário e ajusta estoque', async () => {
    (blindInventoryApi.listSessions as any).mockResolvedValue({
      success: true,
      data: [{ ...mockSessions[0], status: 'AUDITING' }]
    });
    (blindInventoryApi.getSessionById as any).mockResolvedValue({
      success: true,
      data: { ...mockSessionDetails, status: 'AUDITING' }
    });
    (blindInventoryApi.finalizeSession as any).mockResolvedValue({
      success: true,
      data: {
        inventory: { ...mockSessions[0], status: 'FINALIZED' },
        adjustments: [{ id: 1, adjustment_type: 'FALTA', quantity: 1, unit_cost: 50.0, total_cost: 50.0 }]
      }
    });

    render(<BlindInventoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('finalize-button-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('finalize-button-1'));

    await waitFor(() => {
      expect(blindInventoryApi.finalizeSession).toHaveBeenCalledWith(1, { user_id: 1 });
      expect(screen.getByTestId('success-alert')).toBeDefined();
    });
  });
});
