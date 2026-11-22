import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SpedFiscalPage from '../../src/pages/SpedFiscalPage';
import { spedApi } from '../../src/services/api';
import type {
  AccountingParameters,
  SpedGenerationRecord,
  SpedValidationResult,
  SpedInventoryResponse
} from '../../src/types/sped';

const mockAccounting: AccountingParameters = {
  id: 1,
  storeId: 1,
  accountantName: 'Contador Silva',
  accountantCpf: '11122233344',
  accountantCrc: 'CRC-SP 123456/O',
  accountantCnpj: '11222333000199',
  accountantEmail: 'silva@contabilidade.com.br',
  accountantPhone: '1133334444',
  accountantCep: '01310000',
  accountantAddress: 'Avenida Paulista, 1000',
  accountantCityCode: 3550308,
  spedProfile: 'A',
  spedVersion: '018',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
};

const mockHistory: SpedGenerationRecord[] = [
  {
    id: 10,
    storeId: 1,
    generationType: 'SPED_EFD',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    purpose: 0,
    fileName: 'SPED_EFD_12345678000199_20260501_20260531.txt',
    fileContent: '|0000|018|0|01052026|31052026|...\n|9999|500|',
    totalLines: 500,
    totalDocuments: 120,
    totalIcmsDebit: 1540.50,
    totalIcmsCredit: 820.00,
    totalIcmsSt: 320.00,
    inventoryDate: '2026-05-31',
    totalInventoryValue: 85400.00,
    status: 'GENERATED',
    notes: 'Maio/2026 Fechamento',
    createdAt: '2026-05-31 23:59:00'
  }
];

const mockInventory: SpedInventoryResponse = {
  storeId: 1,
  date: '2026-05-31',
  totalItems: 2,
  totalValue: 1800.00,
  items: [
    {
      productId: 1,
      internalCode: 'PRD-1',
      description: 'Paracetamol 500mg 20 comp',
      ean: '789100000001',
      unit: 'UN',
      quantity: 100,
      averageCost: 8.00,
      totalValue: 800.00,
      possessionIndicator: '0',
      ncm: '30049099',
      cest: '1300100'
    },
    {
      productId: 2,
      internalCode: 'PRD-2',
      description: 'Amoxicilina 500mg 15 cap',
      ean: '789100000002',
      unit: 'UN',
      quantity: 50,
      averageCost: 20.00,
      totalValue: 1000.00,
      possessionIndicator: '0',
      ncm: '30041011',
      cest: '1300200'
    }
  ]
};

const mockAuditValid: SpedValidationResult = {
  isValid: true,
  totalErrors: 0,
  totalWarnings: 0,
  divergences: []
};

describe('SpedFiscalPage', () => {
  beforeEach(() => {
    vi.spyOn(spedApi, 'getHistory').mockResolvedValue(mockHistory);
    vi.spyOn(spedApi, 'getParameters').mockResolvedValue(mockAccounting);
    vi.spyOn(spedApi, 'getInventory').mockResolvedValue(mockInventory);
    vi.spyOn(spedApi, 'runAudit').mockResolvedValue(mockAuditValid);
    vi.spyOn(spedApi, 'saveParameters').mockResolvedValue(mockAccounting);
    vi.spyOn(spedApi, 'generate').mockResolvedValue(mockHistory[0]);
    vi.spyOn(spedApi, 'printSlip').mockResolvedValue({
      generationId: 10,
      fileName: mockHistory[0].fileName,
      slipText: '=== DEMONSTRATIVO DE FECHAMENTO FISCAL ===\nARQUIVO: SPED_EFD.txt\nTOTAL LINHAS: 500'
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render header, tabs, and load generation history on mount', async () => {
    render(<SpedFiscalPage />);

    expect(screen.getByText(/SPED Fiscal EFD ICMS\/IPI & Sintegra/i)).toBeDefined();
    expect(screen.getByText(/Gerador & Histórico/i)).toBeDefined();
    expect(screen.getByText(/Bloco H \(Inventário Contábil\)/i)).toBeDefined();
    expect(screen.getByText(/Auditoria Pré-PVA/i)).toBeDefined();
    expect(screen.getByText(/Parâmetros do Contabilista/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getAllByText(/SPED_EFD_12345678000199_20260501_20260531\.txt/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/R\$ 85\.400,00/i)).toBeDefined();
    });
  });

  it('should navigate to Bloco H tab and show inventory totals and items', async () => {
    render(<SpedFiscalPage />);

    const invTabBtn = screen.getByText(/Bloco H \(Inventário Contábil\)/i);
    fireEvent.click(invTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Valor Total do Estoque \(Custo\)/i)).toBeDefined();
      expect(screen.getAllByText(/R\$ 1\.800,00/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Paracetamol 500mg 20 comp/i)).toBeDefined();
      expect(screen.getByText(/Amoxicilina 500mg 15 cap/i)).toBeDefined();
    });
  });

  it('should navigate to Auditoria Pré-PVA tab and display audit status', async () => {
    render(<SpedFiscalPage />);

    const auditTabBtn = screen.getByText(/Auditoria Pré-PVA/i);
    fireEvent.click(auditTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Dados Fiscais e Cadastrais Prontos para o PVA/i)).toBeDefined();
      expect(screen.getByText(/Nenhuma divergência encontrada!/i)).toBeDefined();
    });
  });

  it('should navigate to Parâmetros do Contabilista and submit updated form', async () => {
    render(<SpedFiscalPage />);

    const accTabBtn = screen.getByText(/Parâmetros do Contabilista/i);
    fireEvent.click(accTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Cadastro do Contabilista Responsável \(Bloco 0100\)/i)).toBeDefined();
      expect(screen.getByDisplayValue(/Contador Silva/i)).toBeDefined();
    });

    const submitBtn = screen.getByText(/Salvar Parâmetros Contábeis/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(spedApi.saveParameters).toHaveBeenCalled();
    });
  });

  it('should trigger print thermal slip modal', async () => {
    render(<SpedFiscalPage />);

    await waitFor(() => {
      expect(screen.getByTitle(/Imprimir Comprovante Térmico/i)).toBeDefined();
    });

    const printBtn = screen.getByTitle(/Imprimir Comprovante Térmico/i);
    fireEvent.click(printBtn);

    await waitFor(() => {
      expect(screen.getByText(/Comprovante Térmico ESC\/POS/i)).toBeDefined();
      expect(screen.getByText(/=== DEMONSTRATIVO DE FECHAMENTO FISCAL ===/i)).toBeDefined();
    });
  });
});
