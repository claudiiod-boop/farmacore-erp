import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { SatFiscalPage } from '../../src/pages/SatFiscalPage';
import { satFiscalApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  satFiscalApi: {
    listCfe: vi.fn(),
    getKpis: vi.fn(),
    registerDevice: vi.fn(),
    getExtrato: vi.fn(),
    cancelCfe: vi.fn(),
    syncContingency: vi.fn()
  }
}));

describe('SatFiscalPage Component', () => {
  const mockKpis = {
    total_cfe_issued: 120,
    total_authorized_amount: 4580.0,
    total_cancelled_count: 2,
    pending_contingency_count: 3,
    active_devices_count: 2
  };

  const mockDocuments = [
    {
      id: 1,
      sale_id: 42,
      store_id: 1,
      sat_device_id: 1,
      access_key: '35261112345678000199590001234560000011234567',
      cfe_number: 1,
      session_random_number: 123456,
      total_amount: 85.50,
      discount_amount: 0.0,
      net_amount: 85.50,
      xml_sent: '<xml/>',
      xml_signed: '<xml/>',
      qr_code_payload: '352611...|qr',
      sefaz_status_code: '06000',
      sefaz_status_message: 'Emitido com sucesso',
      status: 'AUTHORIZED' as const,
      issued_at: '2026-11-25T10:30:00.000Z',
      created_at: '2026-11-25T10:30:00.000Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (satFiscalApi.listCfe as any).mockResolvedValue({
      success: true,
      data: mockDocuments
    });
    (satFiscalApi.getKpis as any).mockResolvedValue({
      success: true,
      data: mockKpis
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Renderiza cabeçalho, KPIs fiscais e tabela de cupons CF-e', async () => {
    render(<SatFiscalPage />);

    expect(screen.getByText('Módulo Fiscal SAT & Contingência Off-line')).toBeDefined();
    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-cfe').textContent).toBe('120');
      expect(screen.getByTestId('kpi-cancelled-count').textContent).toBe('2');
      expect(screen.getByTestId('kpi-pending-contingency').textContent).toBe('3');
      expect(screen.getByTestId('kpi-active-devices').textContent).toBe('2');
      expect(screen.getByText('000001')).toBeDefined();
      expect(screen.getByText('AUTORIZADO')).toBeDefined();
    });
  });

  it('2. Abre modal e cadastra novo módulo fiscal SAT', async () => {
    (satFiscalApi.registerDevice as any).mockResolvedValue({
      success: true,
      data: { id: 2, serial_number: '900005555' }
    });

    render(<SatFiscalPage />);

    await waitFor(() => {
      expect(screen.getByTestId('register-device-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('register-device-button'));
    expect(screen.getByTestId('register-device-modal')).toBeDefined();

    fireEvent.change(screen.getByTestId('device-serial-input'), {
      target: { value: '900005555' }
    });

    fireEvent.click(screen.getByTestId('confirm-register-device-button'));

    await waitFor(() => {
      expect(satFiscalApi.registerDevice).toHaveBeenCalledWith({
        store_id: 1,
        pos_station_id: 'CAIXA_01',
        serial_number: '900005555',
        model: 'BEMATECH_RB2000',
        sign_code: 'FARMACORE_AC_SIGN_2026'
      });
      expect(screen.getByTestId('success-alert')).toBeDefined();
    });
  });

  it('3. Abre modal de Extrato Térmico 80mm com QR Code', async () => {
    (satFiscalApi.getExtrato as any).mockResolvedValue({
      success: true,
      data: { extrato: 'CUPOM FISCAL ELETRONICO - SAT\nExtrato No. 000001\nTOTAL: R$ 85,50' }
    });

    render(<SatFiscalPage />);

    await waitFor(() => {
      expect(screen.getByTestId('view-extrato-button-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('view-extrato-button-1'));

    await waitFor(() => {
      expect(satFiscalApi.getExtrato).toHaveBeenCalledWith(1);
      expect(screen.getByTestId('extrato-modal')).toBeDefined();
      expect(screen.getByTestId('extrato-content').textContent).toContain('CUPOM FISCAL ELETRONICO - SAT');
    });
  });

  it('4. Abre modal e cancela cupom fiscal no prazo legal', async () => {
    (satFiscalApi.cancelCfe as any).mockResolvedValue({
      success: true,
      data: { ...mockDocuments[0], status: 'CANCELLED' }
    });

    render(<SatFiscalPage />);

    await waitFor(() => {
      expect(screen.getByTestId('cancel-cfe-button-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('cancel-cfe-button-1'));
    expect(screen.getByTestId('cancel-cfe-modal')).toBeDefined();

    fireEvent.change(screen.getByTestId('cancel-justification-input'), {
      target: { value: 'Cliente desistiu do pagamento' }
    });

    fireEvent.click(screen.getByTestId('confirm-cancel-cfe-button'));

    await waitFor(() => {
      expect(satFiscalApi.cancelCfe).toHaveBeenCalledWith(1, 'Cliente desistiu do pagamento');
      expect(screen.getByTestId('success-alert')).toBeDefined();
    });
  });

  it('5. Aciona sincronização em lote de contingência off-line com a SEFAZ', async () => {
    (satFiscalApi.syncContingency as any).mockResolvedValue({
      success: true,
      data: { transmitted_count: 3, items: [] }
    });

    render(<SatFiscalPage />);

    await waitFor(() => {
      expect(screen.getByTestId('sync-contingency-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('sync-contingency-button'));

    await waitFor(() => {
      expect(satFiscalApi.syncContingency).toHaveBeenCalledWith(1);
      expect(screen.getByTestId('success-alert')).toBeDefined();
    });
  });
});
