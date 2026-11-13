import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import SngpcPage from '../../src/pages/SngpcPage';
import { sngpcApi } from '../../src/services/api';
import type {
  SngpcMovement,
  SngpcLivroRegistro,
  SngpcTransmission,
} from '../../src/types';

const mockMovements: SngpcMovement[] = [
  {
    id: 1,
    movementType: 'ENTRADA',
    productId: 10,
    batchId: 2,
    quantity: 50,
    referenceType: 'PURCHASE_INVOICE',
    referenceId: 101,
    movementDate: '2026-11-05',
    msRegistration: '1058300120011',
    isTransmitted: 0,
    createdAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 2,
    movementType: 'SAIDA_VENDA',
    productId: 10,
    batchId: 2,
    quantity: 2,
    referenceType: 'SALE',
    referenceId: 505,
    movementDate: '2026-11-08',
    msRegistration: '1058300120011',
    prescriptionId: 12,
    isTransmitted: 0,
    createdAt: '2026-11-08T15:30:00.000Z',
  },
];

const mockLivro: SngpcLivroRegistro = {
  pharmacyCnpj: '12345678000195',
  pharmacyName: 'DROGARIA POPULAR CENTRAL LTDA',
  pharmacistName: 'DR. CARLOS EDUARDO SILVA',
  pharmacistCrf: '12345',
  pharmacistCrfUf: 'SP',
  startDate: '2026-11-01',
  endDate: '2026-11-10',
  openingTerm: 'TERMO DE ABERTURA: Livro Oficial de Registro de Medicamentos Sujeitos a Controle Especial...',
  closingTerm: 'TERMO DE ENCERRAMENTO: Encerra-se este período com 2 movimentações registradas...',
  items: [
    {
      date: '2026-11-05',
      movementType: 'ENTRADA',
      documentNumber: 'NF 101',
      productName: 'AMOXICILINA 500MG CAPS',
      msRegistration: '1058300120011',
      batchNumber: 'LOTE-AMX-01',
      initialBalance: 0,
      entryQuantity: 50,
      exitQuantity: 0,
      finalBalance: 50,
    },
    {
      date: '2026-11-08',
      movementType: 'SAIDA_VENDA',
      documentNumber: 'VENDA 505',
      productName: 'AMOXICILINA 500MG CAPS',
      msRegistration: '1058300120011',
      batchNumber: 'LOTE-AMX-01',
      initialBalance: 50,
      entryQuantity: 0,
      exitQuantity: 2,
      finalBalance: 48,
      doctorName: 'DRA. ANA BEATRIZ',
      doctorCrm: '98765',
      doctorUf: 'SP',
      buyerName: 'JOAO DA SILVA',
      buyerCpf: '12345678900',
    },
  ],
};

const mockTransmissions: SngpcTransmission[] = [
  {
    id: 1,
    startDate: '2026-11-01',
    endDate: '2026-11-07',
    pharmacistName: 'DR. CARLOS EDUARDO SILVA',
    pharmacistCpf: '12345678901',
    pharmacistCrf: '12345',
    pharmacistCrfUf: 'SP',
    xmlContent: '<mensagemSNGPC></mensagemSNGPC>',
    status: 'GERADO',
    hashXml: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
    createdAt: '2026-11-08T09:00:00.000Z',
  },
];

describe('SngpcPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(sngpcApi, 'getMovements').mockResolvedValue(mockMovements);
    vi.spyOn(sngpcApi, 'getLivroRegistro').mockResolvedValue(mockLivro);
    vi.spyOn(sngpcApi, 'getTransmissions').mockResolvedValue(mockTransmissions);
    vi.spyOn(sngpcApi, 'generateWeeklyXml').mockResolvedValue({
      transmissionId: 2,
      movementsCount: 2,
      hashXml: '8f434346648f6b96df89dda901c5176b10a6d839',
      xmlContent: '<mensagemSNGPC></mensagemSNGPC>',
    });
    vi.spyOn(window, 'print').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render the 3 main tabs and show movements by default', async () => {
    render(<SngpcPage />);

    expect(screen.getByText(/Controle Regulatório SNGPC/i)).toBeDefined();
    expect(screen.getByRole('tab', { name: /Movimentações/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Livro de Registro/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Transmissão Semanal/i })).toBeDefined();

    await waitFor(() => {
      expect(sngpcApi.getMovements).toHaveBeenCalled();
      expect(screen.getAllByText('1058300120011').length).toBeGreaterThan(0);
      expect(screen.getByText('ENTRADA')).toBeDefined();
      expect(screen.getByText('SAIDA_VENDA')).toBeDefined();
    });
  });

  it('should switch to Livro de Registro tab, filter period, display terms, balances and support printing', async () => {
    render(<SngpcPage />);

    const livroTab = screen.getByRole('tab', { name: /Livro de Registro/i });
    await act(async () => {
      fireEvent.click(livroTab);
    });

    // Enter start and end dates
    const startDateInput = screen.getByLabelText(/Data Inicial/i);
    const endDateInput = screen.getByLabelText(/Data Final/i);

    await act(async () => {
      fireEvent.change(startDateInput, { target: { value: '2026-11-01' } });
      fireEvent.change(endDateInput, { target: { value: '2026-11-10' } });
    });

    const searchBtn = screen.getByRole('button', { name: /Gerar Livro|Consultar Livro/i });
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    await waitFor(() => {
      expect(sngpcApi.getLivroRegistro).toHaveBeenCalledWith({
        startDate: '2026-11-01',
        endDate: '2026-11-10',
        productId: undefined,
      });
      expect(screen.getByText(/DROGARIA POPULAR CENTRAL LTDA/i)).toBeDefined();
      expect(screen.getByText(/TERMO DE ABERTURA/i)).toBeDefined();
      expect(screen.getByText(/TERMO DE ENCERRAMENTO/i)).toBeDefined();
      expect(screen.getAllByText('AMOXICILINA 500MG CAPS').length).toBeGreaterThan(0);
    });

    // Test print button
    const printBtn = screen.getByRole('button', { name: /Imprimir Livro/i });
    await act(async () => {
      fireEvent.click(printBtn);
    });

    expect(window.print).toHaveBeenCalled();
  });

  it('should switch to Transmissão Semanal tab, generate weekly XML and list transmissions', async () => {
    render(<SngpcPage />);

    const transmissionTab = screen.getByRole('tab', { name: /Transmissão Semanal/i });
    await act(async () => {
      fireEvent.click(transmissionTab);
    });

    await waitFor(() => {
      expect(sngpcApi.getTransmissions).toHaveBeenCalled();
      expect(screen.getByText(/da39a3ee5e/i)).toBeDefined();
    });

    // Fill form
    const nameInput = screen.getByLabelText(/Nome do Farmacêutico/i);
    const cpfInput = screen.getByLabelText(/CPF do Farmacêutico/i);
    const crfInput = screen.getByLabelText(/^CRF/i);
    const ufInput = screen.getByLabelText(/UF do CRF/i);
    const startInput = screen.getByLabelText(/Data Inicial/i);
    const endInput = screen.getByLabelText(/Data Final/i);

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'DR. CARLOS EDUARDO SILVA' } });
      fireEvent.change(cpfInput, { target: { value: '12345678901' } });
      fireEvent.change(crfInput, { target: { value: '12345' } });
      fireEvent.change(ufInput, { target: { value: 'SP' } });
      fireEvent.change(startInput, { target: { value: '2026-11-01' } });
      fireEvent.change(endInput, { target: { value: '2026-11-07' } });
    });

    const submitBtn = screen.getByRole('button', { name: /Gerar Arquivo SNGPC|Gerar XML/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(sngpcApi.generateWeeklyXml).toHaveBeenCalledWith({
        pharmacistName: 'DR. CARLOS EDUARDO SILVA',
        pharmacistCpf: '12345678901',
        pharmacistCrf: '12345',
        pharmacistCrfUf: 'SP',
        startDate: '2026-11-01',
        endDate: '2026-11-07',
      });
      expect(screen.getByText(/Transmissão gerada com sucesso/i)).toBeDefined();
    });

    // Verify download button or link exists
    const downloadBtns = screen.getAllByRole('button', { name: /Download XML|Baixar XML/i });
    expect(downloadBtns.length).toBeGreaterThan(0);
  });
});
