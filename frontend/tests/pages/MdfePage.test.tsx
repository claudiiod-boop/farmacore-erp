import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { MdfePage } from '../../src/pages/MdfePage';
import { mdfeApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  mdfeApi: {
    getKpis: vi.fn(),
    list: vi.fn(),
    createDraft: vi.fn(),
    authorize: vi.fn(),
    close: vi.fn(),
    cancel: vi.fn(),
    getDamdfe: vi.fn(),
  }
}));

describe('MdfePage Component', () => {
  const mockKpis = {
    total_manifests: 8,
    authorized_in_transit: 3,
    closed_count: 4,
    cancelled_count: 1,
    total_transported_cargo_brl: 250000.0,
    total_transported_weight_kg: 1850.5
  };

  const mockMdfes = [
    {
      id: 1,
      store_id: 1,
      mdfe_number: 1,
      series: 1,
      access_key: '35261111222333000144580010000000011000000010',
      emission_type: 'NORMAL' as const,
      uf_start: 'SP',
      uf_end: 'RJ',
      driver_name: 'Antônio Carlos',
      driver_cpf: '123.456.789-00',
      vehicle_plate: 'BRA-2E19',
      vehicle_rntrc: 'RNTRC-SP-998877',
      total_nfe_count: 2,
      total_cargo_value_brl: 80000.0,
      total_weight_kg: 400.5,
      sefaz_status_code: '100',
      status: 'AUTHORIZED' as const,
      created_at: '2026-11-25T08:00:00'
    },
    {
      id: 2,
      store_id: 1,
      mdfe_number: 2,
      series: 1,
      access_key: '35261111222333000144580010000000021000000025',
      emission_type: 'NORMAL' as const,
      uf_start: 'SP',
      uf_end: 'MG',
      driver_name: 'Marcos Souza',
      driver_cpf: '222.333.444-55',
      vehicle_plate: 'LOG-5544',
      total_nfe_count: 1,
      total_cargo_value_brl: 35000.0,
      total_weight_kg: 150.0,
      sefaz_status_code: '100',
      status: 'DRAFT' as const,
      created_at: '2026-11-25T10:00:00'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (mdfeApi.getKpis as any).mockResolvedValue({
      success: true,
      data: mockKpis
    });
    (mdfeApi.list as any).mockResolvedValue({
      success: true,
      data: mockMdfes
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Renderiza cabeçalho, normas SINIEF 21/2010 e KPIs de transporte', async () => {
    render(<MdfePage />);

    expect(screen.getByText('MDF-e Transporte & Manifesto Fiscal (Modelo 58)')).toBeDefined();
    expect(screen.getByText('Ajuste SINIEF 21/2010')).toBeDefined();
    expect(screen.getByText('SEFAZ / ANTT')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-manifests').textContent).toContain('8');
      expect(screen.getByTestId('kpi-in-transit').textContent).toContain('3');
      expect(screen.getByTestId('kpi-closed').textContent).toContain('4');
      expect(screen.getByTestId('kpi-total-cargo').textContent).toContain('250.000,00');
    });
  });

  it('2. Exibe tabela de manifestos com rotas, condutores e valores', async () => {
    render(<MdfePage />);

    await waitFor(() => {
      expect(screen.getByText('MDF-e 000001')).toBeDefined();
      expect(screen.getByText('Antônio Carlos')).toBeDefined();
      expect(screen.getByText('BRA-2E19')).toBeDefined();
      expect(screen.getByText('MDF-e 000002')).toBeDefined();
      expect(screen.getByText('Marcos Souza')).toBeDefined();
    });
  });

  it('3. Autoriza rascunho de MDF-e na SEFAZ', async () => {
    (mdfeApi.authorize as any).mockResolvedValue({
      success: true,
      data: {
        id: 2,
        mdfe_number: 2,
        status: 'AUTHORIZED',
        sefaz_protocol: '1352600009988'
      }
    });

    render(<MdfePage />);

    await waitFor(() => {
      expect(screen.getByTestId('authorize-btn-2')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('authorize-btn-2'));

    await waitFor(() => {
      expect(mdfeApi.authorize).toHaveBeenCalledWith(2);
      expect(screen.getByTestId('mdfe-success-alert').textContent).toContain('1352600009988');
    });
  });

  it('4. Abre modal e visualiza DAMDFE formatado', async () => {
    (mdfeApi.getDamdfe as any).mockResolvedValue({
      success: true,
      data: {
        mdfe_id: 1,
        access_key: '35261111222333000144580010000000011000000010',
        damdfe_text: 'DAMDFE - DOCUMENTO AUXILIAR DE MANIFESTO\nPLACA: BRA-2E19\nTOTAL: R$ 80.000,00'
      }
    });

    render(<MdfePage />);

    await waitFor(() => {
      expect(screen.getByTestId('view-damdfe-btn-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('view-damdfe-btn-1'));

    await waitFor(() => {
      expect(mdfeApi.getDamdfe).toHaveBeenCalledWith(1);
      expect(screen.getByTestId('damdfe-modal')).toBeDefined();
      expect(screen.getByTestId('damdfe-content').textContent).toContain('BRA-2E19');
    });
  });

  it('5. Abre modal e encerra viagem de MDF-e no destino', async () => {
    (mdfeApi.close as any).mockResolvedValue({
      success: true,
      data: {
        id: 1,
        mdfe_number: 1,
        status: 'CLOSED'
      }
    });

    render(<MdfePage />);

    await waitFor(() => {
      expect(screen.getByTestId('close-mdfe-btn-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('close-mdfe-btn-1'));

    expect(screen.getByTestId('close-mdfe-modal')).toBeDefined();
    expect(screen.getByText('Encerrar Viagem de MDF-e')).toBeDefined();

    const confirmBtn = screen.getByTestId('confirm-close-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mdfeApi.close).toHaveBeenCalledWith(1, {
        closure_reason: 'Descarregamento finalizado e recebimento confirmado na filial'
      });
      expect(screen.getByTestId('mdfe-success-alert').textContent).toContain('encerrado no destino');
    });
  });
});
