import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { PrecisionScalePage } from '../../src/pages/PrecisionScalePage';
import { scaleApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  scaleApi: {
    getKpis: vi.fn(),
    readWeight: vi.fn(),
    decodeBarcode: vi.fn(),
    generateLabel: vi.fn(),
    registerDevice: vi.fn(),
  }
}));

describe('PrecisionScalePage Component', () => {
  const mockKpis = {
    total_scales: 3,
    active_scales: 2,
    total_weighings_today: 45,
    total_weight_kg_today: 14.580,
    total_weighted_sales_amount_today: 685.50
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (scaleApi.getKpis as any).mockResolvedValue({
      success: true,
      data: mockKpis
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Renderiza cabeçalho, normas INMETRO e cards de KPIs metrológicos', async () => {
    render(<PrecisionScalePage />);

    expect(screen.getByText('Balança de Precisão & Checkout Pesável')).toBeDefined();
    expect(screen.getByText('INMETRO Portaria 236/1994')).toBeDefined();
    expect(screen.getByText('RDC 67/2007 Manipulados & Fracionados')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-scales').textContent).toContain('2');
      expect(screen.getByTestId('kpi-weighings-today').textContent).toContain('45');
      expect(screen.getByTestId('kpi-weight-today').textContent).toContain('14.580');
    });
  });

  it('2. Executa leitura serial simulada com tara e estabilidade metrológica', async () => {
    (scaleApi.readWeight as any).mockResolvedValue({
      success: true,
      data: {
        device_id: 1,
        device_name: 'Toledo Prix 3 Fit',
        protocol: 'TOLEDO_PR4',
        is_stable: true,
        gross_weight_grams: 350,
        tare_grams: 20,
        net_weight_grams: 330,
        timestamp: '2026-11-25T12:00:00.000Z'
      }
    });

    render(<PrecisionScalePage />);

    const readBtn = screen.getByTestId('read-scale-btn');
    fireEvent.click(readBtn);

    await waitFor(() => {
      expect(scaleApi.readWeight).toHaveBeenCalledWith(1, 350, 20);
      expect(screen.getByTestId('display-net-weight').textContent).toContain('0.330 kg');
      expect(screen.getByTestId('display-tare-weight').textContent).toContain('20 g');
      expect(screen.getByTestId('display-stability-status').textContent).toContain('ESTÁVEL');
    });
  });

  it('3. Decodifica código de barras pesável EAN-13 GS1 no checkout do PDV', async () => {
    (scaleApi.decodeBarcode as any).mockResolvedValue({
      success: true,
      data: {
        is_weighted: true,
        product_id: 42,
        product_name: 'Chá de Camomila Granel 1kg',
        product_ean: '7890000000042',
        price_per_kg: 80.0,
        net_weight_grams: 200,
        total_price: 16.0,
        calculated_quantity: 0.2,
        payload_type: 'TOTAL_VALUE',
        raw_value: 1600
      }
    });

    render(<PrecisionScalePage />);

    const decodeBtn = screen.getByTestId('decode-barcode-btn');
    fireEvent.click(decodeBtn);

    await waitFor(() => {
      expect(scaleApi.decodeBarcode).toHaveBeenCalledWith('2000420016009', 1);
      expect(screen.getByTestId('decoded-product-name').textContent).toContain('Chá de Camomila Granel 1kg');
      expect(screen.getByTestId('decoded-calculated-weight').textContent).toContain('0.200 kg');
    });
  });

  it('4. Gera etiqueta térmica ZPL para produto pesado com código EAN-13', async () => {
    (scaleApi.generateLabel as any).mockResolvedValue({
      success: true,
      data: {
        log_id: 101,
        product_id: 42,
        product_name: 'Composto Antioxidante Manipulado',
        barcode: '2000420018408',
        net_weight_grams: 230,
        price_per_kg: 80.0,
        total_price: 18.40,
        tare_grams: 20,
        expiration_date: '2027-01-01',
        thermal_label_zpl: '^XA^FO50,50^A0N,30,30^FDComposto Antioxidante^FS^XZ'
      }
    });

    render(<PrecisionScalePage />);

    const genBtn = screen.getByTestId('generate-label-btn');
    fireEvent.click(genBtn);

    await waitFor(() => {
      expect(scaleApi.generateLabel).toHaveBeenCalled();
      expect(screen.getByTestId('label-generated-barcode').textContent).toContain('2000420018408');
      expect(screen.getByTestId('label-net-weight').textContent).toContain('230 g');
      expect(screen.getByTestId('label-zpl-code').textContent).toContain('^XA');
    });
  });

  it('5. Abre modal e cadastra nova balança serial com selo INMETRO', async () => {
    (scaleApi.registerDevice as any).mockResolvedValue({
      success: true,
      data: {
        id: 3,
        store_id: 1,
        name: 'Urano Pop-Z - Balcão 2',
        serial_port: 'COM2',
        baud_rate: 9600,
        protocol: 'URANO',
        inmetro_seal_number: 'INMETRO-SP-2026-9988',
        capacity_kg: 15.0,
        precision_grams: 5.0,
        is_active: 1
      }
    });

    render(<PrecisionScalePage />);

    // Abrir modal
    const openModalBtn = screen.getByTestId('open-register-scale-modal');
    fireEvent.click(openModalBtn);

    expect(screen.getByText('Cadastrar Balança Serial INMETRO')).toBeDefined();

    // Preencher e submeter
    const saveBtn = screen.getByTestId('save-device-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(scaleApi.registerDevice).toHaveBeenCalled();
      expect(screen.getByTestId('scales-success-alert').textContent).toContain('Urano Pop-Z - Balcão 2');
    });
  });
});
