import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TemperatureMonitoringPage } from '../../src/pages/TemperatureMonitoringPage';
import { temperatureApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  temperatureApi: {
    getKpis: vi.fn(),
    getSensors: vi.fn(),
    registerSensor: vi.fn(),
    recordReading: vi.fn(),
    getReadings: vi.fn(),
    getExcursions: vi.fn(),
    resolveExcursion: vi.fn(),
  },
}));

describe('TemperatureMonitoringPage (Termômetro & Higrômetro Digital RDC 44/2009 e RDC 430/2020)', () => {
  afterEach(() => {
    cleanup();
  });

  const mockKpis = {
    active_sensors_count: 3,
    open_excursions_count: 1,
    current_fridge_temp: 5.2,
    current_sales_floor_temp: 23.4,
    current_sales_floor_humidity: 58.0,
    cold_chain_status: 'NORMAL' as const,
    ambient_status: 'NORMAL' as const,
  };

  const mockSensors = [
    {
      id: 1,
      store_id: 1,
      name: 'Geladeira Principal 01',
      location_type: 'REFRIGERATOR_COLD_CHAIN' as const,
      min_allowed_temp: 2.0,
      max_allowed_temp: 8.0,
      min_allowed_humidity: 0.0,
      max_allowed_humidity: 100.0,
      serial_number: 'SEN-GEL-01',
      calibration_cert_number: 'RBC-2026-001',
      calibration_due_date: '2027-11-30',
      is_active: true,
      created_at: '2026-11-24T08:00:00Z',
      updated_at: '2026-11-24T08:00:00Z',
      last_reading: {
        id: 101,
        sensor_id: 1,
        store_id: 1,
        temperature: 5.2,
        humidity: null,
        is_excursion: false,
        recorded_by: 'Farmacêutico RT',
        recorded_at: '2026-11-24 08:30:00',
      },
    },
    {
      id: 2,
      store_id: 1,
      name: 'Termo-Higrômetro Balcão',
      location_type: 'SALES_FLOOR' as const,
      min_allowed_temp: 15.0,
      max_allowed_temp: 30.0,
      min_allowed_humidity: 40.0,
      max_allowed_humidity: 70.0,
      serial_number: 'SEN-BALC-01',
      calibration_cert_number: 'RBC-2026-002',
      calibration_due_date: '2027-11-30',
      is_active: true,
      created_at: '2026-11-24T08:00:00Z',
      updated_at: '2026-11-24T08:00:00Z',
      last_reading: {
        id: 102,
        sensor_id: 2,
        store_id: 1,
        temperature: 23.4,
        humidity: 58.0,
        is_excursion: false,
        recorded_by: 'Operador Balcão',
        recorded_at: '2026-11-24 08:30:00',
      },
    },
  ];

  const mockExcursions = [
    {
      id: 1,
      sensor_id: 1,
      store_id: 1,
      reading_id: 103,
      started_at: '2026-11-24 07:15:00',
      resolved_at: null,
      severity: 'CRITICAL' as const,
      peak_temp: 9.8,
      min_temp: 4.0,
      action_taken: null,
      pharmacist_crf: null,
      status: 'OPEN' as const,
      created_at: '2026-11-24T07:15:00Z',
      updated_at: '2026-11-24T07:15:00Z',
      sensor_name: 'Geladeira Principal 01',
      location_type: 'REFRIGERATOR_COLD_CHAIN' as const,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (temperatureApi.getKpis as any).mockResolvedValue(mockKpis);
    (temperatureApi.getSensors as any).mockResolvedValue(mockSensors);
    (temperatureApi.getExcursions as any).mockResolvedValue(mockExcursions);
    (temperatureApi.getReadings as any).mockResolvedValue([]);
  });

  it('1. Renderiza KPIs consolidados e cards dos sensores cadastrados', async () => {
    render(<TemperatureMonitoringPage />);

    await waitFor(() => {
      expect(screen.getByText(/Termômetro & Higrômetro Digital/i)).toBeDefined();
      expect(screen.getAllByText('5.2°C').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('23.4°C').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Geladeira Principal 01')).toBeDefined();
      expect(screen.getByText('Termo-Higrômetro Balcão')).toBeDefined();
    });
  });

  it('2. Alterna entre abas e carrega incidentes de excursão', async () => {
    render(<TemperatureMonitoringPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-excursions')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('tab-excursions'));

    await waitFor(() => {
      expect(screen.getByTestId('btn-resolve-exc-1')).toBeDefined();
      expect(screen.getByText('9.8°C')).toBeDefined();
    });
  });

  it('3. Registra nova leitura diária com sucesso na aba Aferição', async () => {
    (temperatureApi.recordReading as any).mockResolvedValue({
      readingId: 201,
      isExcursion: false,
      temperature: 4.8,
    });

    render(<TemperatureMonitoringPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-reading-entry')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('tab-reading-entry'));

    const tempInput = screen.getByTestId('input-reading-temp');
    fireEvent.change(tempInput, { target: { value: '4.8' } });

    const submitBtn = screen.getByTestId('btn-submit-reading');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(temperatureApi.recordReading).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 4.8,
        })
      );
      expect(screen.getByText(/Leitura de 4.8°C gravada com sucesso/i)).toBeDefined();
    });
  });

  it('4. Abre modal e cadastra novo termômetro/sensor', async () => {
    (temperatureApi.registerSensor as any).mockResolvedValue({
      id: 3,
      name: 'Geladeira 03 - Imunobiológicos',
    });

    render(<TemperatureMonitoringPage />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-add-sensor')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('btn-add-sensor'));

    const nameInput = screen.getByTestId('input-new-sensor-name');
    fireEvent.change(nameInput, { target: { value: 'Geladeira 03 - Imunobiológicos' } });

    fireEvent.click(screen.getByTestId('btn-confirm-add-sensor'));

    await waitFor(() => {
      expect(temperatureApi.registerSensor).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Geladeira 03 - Imunobiológicos',
        })
      );
      expect(screen.getByText(/Sensor cadastrado com sucesso/i)).toBeDefined();
    });
  });

  it('5. Abre modal de resolução de excursão e homologa com CRF do farmacêutico RT', async () => {
    (temperatureApi.resolveExcursion as any).mockResolvedValue({
      id: 1,
      status: 'RESOLVED',
      pharmacist_crf: 'CRF-SP 98765',
    });

    render(<TemperatureMonitoringPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-excursions')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('tab-excursions'));

    await waitFor(() => {
      expect(screen.getByTestId('btn-resolve-exc-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('btn-resolve-exc-1'));

    const actionInput = screen.getByTestId('input-resolve-action');
    fireEvent.change(actionInput, {
      target: {
        value: 'Porta ajustada, termolábeis avaliados sem alteração física ou perda de estabilidade.',
      },
    });

    fireEvent.click(screen.getByTestId('btn-confirm-resolve-excursion'));

    await waitFor(() => {
      expect(temperatureApi.resolveExcursion).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          pharmacistCrf: 'CRF-SP 98765',
          actionTaken: expect.stringContaining('Porta ajustada'),
        })
      );
      expect(screen.getByText(/Incidente #1 resolvido e homologado pelo RT/i)).toBeDefined();
    });
  });
});
