import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import CardReconciliationPage from '../../src/pages/CardReconciliationPage';
import { cardReconciliationApi } from '../../src/services/api';
import type {
  AcquirerContract,
  ReceivablesCalendarDay,
  DivergenceReport
} from '../../src/types/card-reconciliation';

const mockContracts: AcquirerContract[] = [
  {
    id: 1,
    storeId: 1,
    acquirerName: 'STONE',
    acquirerCnpj: '16.501.555/0001-57',
    merchantCode: 'STONE_001',
    defaultBankName: 'Banco Itaú',
    defaultBankAgency: '0057',
    defaultBankAccount: '12345-6',
    debitSettlementDays: 1,
    creditSettlementDays: 30,
    pixSettlementDays: 0,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    rules: [
      {
        id: 101,
        contractId: 1,
        brandName: 'VISA',
        operationType: 'DEBIT',
        installmentMin: 1,
        installmentMax: 1,
        mdrRate: 1.25,
        fixedFee: 0.10,
        settlementDays: 1,
        isActive: true
      }
    ]
  }
];

const mockCalendar: ReceivablesCalendarDay[] = [
  {
    date: '2026-06-02',
    totalGross: 500.00,
    totalFee: 10.00,
    totalNet: 490.00,
    transactionCount: 4,
    byAcquirer: {
      STONE: { gross: 500.00, net: 490.00, count: 4 }
    }
  }
];

const mockDivergences: DivergenceReport = {
  totalDivergentCount: 1,
  totalOverchargedAmount: 12.50,
  items: [
    {
      id: 501,
      batchId: 20,
      batchCode: 'CONC-202606-001',
      nsu: '99887766',
      authorizationCode: 'AUTH55',
      transactionDate: '2026-06-01 14:00:00',
      settlementDate: '2026-06-02',
      acquirerName: 'STONE',
      brandName: 'VISA',
      grossAmount: 300.00,
      chargedMdrRate: 4.50,
      contractMdrRate: 1.25,
      chargedFeeAmount: 13.50,
      expectedFeeAmount: 3.85,
      divergenceAmount: 9.65
    }
  ]
};

describe('CardReconciliationPage', () => {
  beforeEach(() => {
    vi.spyOn(cardReconciliationApi, 'listContracts').mockResolvedValue(mockContracts);
    vi.spyOn(cardReconciliationApi, 'getReceivablesCalendar').mockResolvedValue(mockCalendar);
    vi.spyOn(cardReconciliationApi, 'getDivergences').mockResolvedValue(mockDivergences);
    vi.spyOn(cardReconciliationApi, 'printCalendarSlip').mockResolvedValue({
      slipText: '=== EXTRATO DE LIQUIDACAO DE CARTOES ===\nDATA: 02/06/2026\nLIQUIDO: R$ 490,00',
      date: '2026-06-02'
    });
    vi.spyOn(cardReconciliationApi, 'printDivergenceSlip').mockResolvedValue({
      slipText: '=== AUDITORIA DE DIVERGENCIAS DE TAXA MDR ===\nVALOR COBRADO A MAIOR: R$ 12,50',
      totalOvercharged: 12.50,
      totalItems: 1
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render header, tabs, and calendar overview with KPIs', async () => {
    render(<CardReconciliationPage />);

    expect(screen.getByText(/Conciliação de Cartões, TEF & Taxas MDR/i)).toBeDefined();
    expect(screen.getByText(/Calendário de Recebíveis \(D\+1 \/ D\+30\)/i)).toBeDefined();
    expect(screen.getByText(/Auditoria de Divergências MDR/i)).toBeDefined();
    expect(screen.getByText(/Contratos & Taxas Contratuais/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getAllByText(/R\$ 500,00/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/R\$ 490,00/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/4 transações no período/i)).toBeDefined();
    });
  });

  it('should navigate to Divergences tab and show overcharged amount and print button', async () => {
    render(<CardReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByText(/Auditoria de Divergências MDR/i)).toBeDefined();
    });

    const divTabBtn = screen.getByText(/Auditoria de Divergências MDR/i);
    fireEvent.click(divTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Cobrança Indevida de Taxas MDR Identificada/i)).toBeDefined();
      expect(screen.getByText(/R\$ 12,50/i)).toBeDefined();
      expect(screen.getByText(/NSU: 99887766/i)).toBeDefined();
    });

    // Clica no botão de emitir comprovante
    const printBtn = screen.getByText(/Emitir Comprovante de Contestação/i);
    fireEvent.click(printBtn);

    await waitFor(() => {
      expect(screen.getByText(/Comprovante Térmico ESC\/POS/i)).toBeDefined();
      expect(screen.getByText(/AUDITORIA DE DIVERGENCIAS DE TAXA MDR/i)).toBeDefined();
    });
  });

  it('should navigate to Contracts tab and list acquirer contract and MDR rules', async () => {
    render(<CardReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByText(/Contratos & Taxas Contratuais/i)).toBeDefined();
    });

    const contractsTabBtn = screen.getByText(/Contratos & Taxas Contratuais/i);
    fireEvent.click(contractsTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Contratos de Adquirentes e Taxas Negociadas/i)).toBeDefined();
      expect(screen.getByText(/CNPJ: 16\.501\.555\/0001-57/i)).toBeDefined();
      expect(screen.getByText(/DEBIT \(VISA\) - 1x a 1x/i)).toBeDefined();
      expect(screen.getByText(/1\.25% \+ R\$ 0\.10/i)).toBeDefined();
    });
  });

  it('should open new contract modal when clicking button', async () => {
    render(<CardReconciliationPage />);

    const newContractBtn = screen.getByText(/Novo Contrato Adquirente/i);
    fireEvent.click(newContractBtn);

    expect(screen.getByText(/Novo Contrato com Adquirente/i)).toBeDefined();
    expect(screen.getByText(/Salvar Contrato/i)).toBeDefined();
  });
});
