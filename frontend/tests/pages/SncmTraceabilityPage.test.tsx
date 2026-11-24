import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SncmTraceabilityPage } from '../../src/pages/SncmTraceabilityPage';
import { sncmApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  sncmApi: {
    getKpis: vi.fn(),
    listEvents: vi.fn(),
    parseDataMatrix: vi.fn(),
    getItemBySerial: vi.fn(),
    quarantineItem: vi.fn(),
    registerReceipt: vi.fn(),
    dispenseItem: vi.fn(),
    transmitEvents: vi.fn(),
  },
}));

describe('SncmTraceabilityPage (Rastreabilidade SNCM & DataMatrix Lei 13.410/2016)', () => {
  const originalAlert = window.alert;

  afterEach(() => {
    window.alert = originalAlert;
    cleanup();
  });

  const mockKpis = {
    total_in_stock: 42,
    dispensed_today: 8,
    pending_transmission: 5,
    quarantined_items: 2,
  };

  const mockEvents = [
    {
      id: 1,
      store_id: 1,
      sncm_item_id: 10,
      event_type: 'DISPENSACAO' as const,
      event_date: '2026-11-24T10:30:00Z',
      fiscal_doc_number: 'NFC-e 9988',
      transmission_status: 'CONFIRMED' as const,
      anvisa_protocol: 'SNCM-BR-2026-887766',
      created_at: '2026-11-24T10:30:00Z',
    },
  ];

  const mockItem = {
    id: 10,
    product_id: 1,
    product_name: 'Amoxicilina 500mg 21 cápsulas',
    store_id: 1,
    gtin: '07891234567890',
    serial_number: 'SER-BOX-001',
    expiration_date: '2028-12-31',
    batch_number: 'L-AMOX-99',
    status: 'IN_STOCK' as const,
    created_at: '2026-11-24T08:00:00Z',
    updated_at: '2026-11-24T08:00:00Z',
    is_expired: false,
    events: [
      {
        id: 1,
        store_id: 1,
        sncm_item_id: 10,
        event_type: 'RECEBIMENTO' as const,
        event_date: '2026-11-24T08:00:00Z',
        transmission_status: 'CONFIRMED' as const,
        created_at: '2026-11-24T08:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    window.alert = vi.fn();
    vi.clearAllMocks();

    vi.mocked(sncmApi.getKpis).mockResolvedValue(mockKpis);
    vi.mocked(sncmApi.listEvents).mockResolvedValue(mockEvents);
  });

  it('1. Renderiza a tela, KPIs do SNCM e botões de ação', async () => {
    render(<SncmTraceabilityPage />);

    expect(screen.getByText('Rastreabilidade SNCM & DataMatrix')).toBeDefined();
    expect(screen.getByTestId('transmit-anvisa-button')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId('kpi-in-stock').textContent).toContain('42');
      expect(screen.getByTestId('kpi-dispensed-today').textContent).toContain('8');
      expect(screen.getByTestId('kpi-pending-tx').textContent).toContain('5');
      expect(screen.getByTestId('kpi-quarantine').textContent).toContain('2');
    });
  });

  it('2. Consulta item individual e exibe procedência, validade e histórico sanitário', async () => {
    vi.mocked(sncmApi.getItemBySerial).mockResolvedValue(mockItem);

    render(<SncmTraceabilityPage />);

    const input = screen.getByTestId('sncm-query-input');
    fireEvent.change(input, { target: { value: 'SER-BOX-001' } });

    fireEvent.click(screen.getByTestId('sncm-query-submit-button'));

    await waitFor(() => {
      expect(sncmApi.getItemBySerial).toHaveBeenCalledWith('SER-BOX-001', undefined);
      expect(screen.getByTestId('queried-product-name').textContent).toContain('Amoxicilina 500mg');
      expect(screen.getByTestId('queried-status-badge').textContent).toContain('IN_STOCK');
      expect(screen.getByText('PRODUTO APTO / REGULAR')).toBeDefined();
    });
  });

  it('3. Executa fluxo de recebimento de carga com bipe de código DataMatrix', async () => {
    vi.mocked(sncmApi.parseDataMatrix).mockResolvedValue({
      gtin: '07891234567890',
      serialNumber: 'SER-BOX-002',
      expirationDate: '2028-12-31',
      batchNumber: 'L-AMOX-99',
      raw: '(01)07891234567890(21)SER-BOX-002(17)281231(10)L-AMOX-99',
    });

    vi.mocked(sncmApi.registerReceipt).mockResolvedValue({
      registeredCount: 1,
      items: [mockItem as any],
    });

    render(<SncmTraceabilityPage />);

    // Alterna para aba de recebimento
    fireEvent.click(screen.getByTestId('tab-receipt-button'));

    // Digita chave de acesso
    fireEvent.change(screen.getByTestId('receipt-nfe-key-input'), {
      target: { value: '35261100000000000000550010000000011000000010' },
    });

    // Bipa o código DataMatrix
    const scanInput = screen.getByTestId('receipt-scan-input');
    fireEvent.change(scanInput, {
      target: { value: '(01)07891234567890(21)SER-BOX-002(17)281231(10)L-AMOX-99' },
    });
    fireEvent.click(screen.getByTestId('receipt-add-button'));

    await waitFor(() => {
      expect(screen.getByText('SER-BOX-002')).toBeDefined();
    });

    // Confirma recebimento
    fireEvent.click(screen.getByTestId('confirm-receipt-button'));

    await waitFor(() => {
      expect(sncmApi.registerReceipt).toHaveBeenCalledWith({
        storeId: 1,
        nfeAccessKey: '35261100000000000000550010000000011000000010',
        operatorName: 'Conferente',
        items: [{ rawDataMatrix: '(01)07891234567890(21)SER-BOX-002(17)281231(10)L-AMOX-99' }],
      });
    });
  });

  it('4. Realiza dispensação de unidade no PDV com desativação sanitária', async () => {
    vi.mocked(sncmApi.dispenseItem).mockResolvedValue({
      item: { ...mockItem, status: 'DISPENSED' } as any,
      event: mockEvents[0] as any,
    });

    render(<SncmTraceabilityPage />);

    // Alterna para aba de dispensação
    fireEvent.click(screen.getByTestId('tab-dispense-button'));

    fireEvent.change(screen.getByTestId('dispense-scan-input'), {
      target: { value: 'SER-BOX-001' },
    });
    fireEvent.change(screen.getByTestId('dispense-doc-input'), {
      target: { value: 'NFC-e 5544' },
    });

    fireEvent.click(screen.getByTestId('submit-dispense-button'));

    await waitFor(() => {
      expect(sncmApi.dispenseItem).toHaveBeenCalledWith({
        storeId: 1,
        serialNumber: 'SER-BOX-001',
        fiscalDocNumber: 'NFC-e 5544',
      });
      expect(screen.getByTestId('dispense-success-alert').textContent).toContain('dispensada com sucesso');
    });
  });

  it('5. Sincroniza eventos pendentes com o webservice da ANVISA e exibe protocolo', async () => {
    vi.mocked(sncmApi.transmitEvents).mockResolvedValue({
      transmittedCount: 5,
      protocol: 'SNCM-BR-2026-99887766',
    });

    render(<SncmTraceabilityPage />);

    fireEvent.click(screen.getByTestId('transmit-anvisa-button'));

    await waitFor(() => {
      expect(sncmApi.transmitEvents).toHaveBeenCalledWith(1);
      expect(screen.getByText(/SNCM-BR-2026-99887766/)).toBeDefined();
    });
  });
});
