import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import BankReconciliationPage from '../../src/pages/BankReconciliationPage';
import { bankReconciliationApi, cashFlowApi } from '../../src/services/api';
import type {
  BankAccount,
  BankStatementBatch,
  BankStatementEntry,
  CashFlowOverview
} from '../../src/types/bank-reconciliation';

const mockAccounts: BankAccount[] = [
  {
    id: 1,
    storeId: 1,
    bankCode: '341',
    bankName: 'Banco Itaú Unibanco',
    agencyNumber: '0057',
    accountNumber: '12345-6',
    accountType: 'CHECKING',
    initialBalance: 10000.00,
    currentBalance: 15420.50,
    isActive: true,
    notes: 'Conta Matriz Principal',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 2,
    storeId: 1,
    bankCode: '033',
    bankName: 'Banco Santander',
    agencyNumber: '1122',
    accountNumber: '99887-1',
    accountType: 'CHECKING',
    initialBalance: 5000.00,
    currentBalance: 8200.00,
    isActive: true,
    notes: 'Conta Secundária',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
];

const mockCashFlow: CashFlowOverview = {
  currentBankBalances: [
    {
      accountId: 1,
      bankName: 'Banco Itaú Unibanco',
      accountNumber: '12345-6',
      balance: 15420.50
    },
    {
      accountId: 2,
      bankName: 'Banco Santander',
      accountNumber: '99887-1',
      balance: 8200.00
    }
  ],
  totalLiquidBankBalance: 23620.50,
  totalCashDrawerBalance: 6500.00,
  totalCurrentAssets: 30120.50,
  projections30Days: [
    {
      date: '2026-06-02',
      openingBalance: 23620.50,
      realizedInflow: 2500.00,
      realizedOutflow: 35.00,
      realizedNet: 2465.00,
      closingBalance: 26085.50,
      projectedInflow: 1200.00,
      projectedOutflow: 500.00,
      projectedClosingBalance: 26785.50,
      status: 'SURPLUS'
    }
  ]
};

const mockBatch: BankStatementBatch = {
  id: 10,
  bankAccountId: 1,
  batchCode: 'OFX-341-20260602-001',
  fileName: 'extrato_itau_junho.ofx',
  periodStart: '2026-06-01',
  periodEnd: '2026-06-02',
  ledgerBalance: 12465.00,
  totalEntries: 2,
  matchedEntries: 2,
  unmatchedEntries: 0,
  importedAt: '2026-06-02 12:00:00'
};

const mockEntries: BankStatementEntry[] = [
  {
    id: 101,
    batchId: 10,
    bankAccountId: 1,
    fitid: 'OFX-STONE-01',
    transactionType: 'CREDIT',
    postedDate: '2026-06-02 10:00:00',
    amount: 2500.00,
    memo: 'LIQ STONE CARTAO',
    reconciliationStatus: 'MATCHED',
    reconciliationType: 'TEF_SETTLEMENT',
    matchedEntityId: 55,
    reconciledAt: '2026-06-02 10:05:00',
    matchedNotes: 'Batimento automático com TEF Stone',
    createdAt: '2026-06-02 10:00:00'
  },
  {
    id: 102,
    batchId: 10,
    bankAccountId: 1,
    fitid: 'OFX-TAR-02',
    transactionType: 'DEBIT',
    postedDate: '2026-06-02 12:00:00',
    amount: -35.00,
    memo: 'TARIFA MENSALIDADE CONTA',
    reconciliationStatus: 'MATCHED',
    reconciliationType: 'BANK_FEE',
    reconciledAt: '2026-06-02 12:05:00',
    matchedNotes: 'Tarifa bancária detectada',
    createdAt: '2026-06-02 12:00:00'
  }
];

describe('BankReconciliationPage', () => {
  beforeEach(() => {
    vi.spyOn(bankReconciliationApi, 'listAccounts').mockResolvedValue(mockAccounts);
    vi.spyOn(cashFlowApi, 'getOverview').mockResolvedValue(mockCashFlow);
    vi.spyOn(bankReconciliationApi, 'getBatchDetails').mockResolvedValue({
      batch: mockBatch,
      entries: mockEntries
    });
    vi.spyOn(bankReconciliationApi, 'uploadOfx').mockResolvedValue(mockBatch);
    vi.spyOn(bankReconciliationApi, 'createAccount').mockResolvedValue({
      id: 3,
      storeId: 1,
      bankCode: '237',
      bankName: 'Banco Bradesco',
      agencyNumber: '0099',
      accountNumber: '44556-7',
      accountType: 'CHECKING',
      initialBalance: 5000.00,
      currentBalance: 5000.00,
      isActive: true,
      notes: 'Nova conta',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    });
    vi.spyOn(cashFlowApi, 'printCashFlowSlip').mockResolvedValue({
      slipText: '=== DEMONSTRATIVO DE FLUXO DE CAIXA ===\nSALDO REALIZADO: R$ 23.620,50\nPROJETADO FINAL: R$ 30.120,50'
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render header, tabs, and load accounts on mount', async () => {
    render(<BankReconciliationPage />);

    expect(screen.getByText(/Conciliação Bancária OFX & Fluxo de Caixa/i)).toBeDefined();
    expect(screen.getByText(/Extratos & Conciliação OFX/i)).toBeDefined();
    expect(screen.getByText(/Fluxo de Caixa Realizado vs Projetado/i)).toBeDefined();
    expect(screen.getByText(/Contas Bancárias/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getAllByText(/Banco Itaú Unibanco/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Banco Santander/i).length).toBeGreaterThan(0);
    });
  });

  it('should navigate to Fluxo de Caixa tab and show summary KPIs and print slip', async () => {
    render(<BankReconciliationPage />);

    const cfTabBtn = screen.getByText(/Fluxo de Caixa Realizado vs Projetado/i);
    fireEvent.click(cfTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Saldo Total em Bancos/i)).toBeDefined();
      expect(screen.getByText(/Saldo Gaveta PDV \(Dinheiro\)/i)).toBeDefined();
      expect(screen.getByText(/Ativo Circulante Imediato/i)).toBeDefined();
      expect(screen.getAllByText(/R\$ 23\.620,50/i).length).toBeGreaterThan(0);
    });

    // Test print thermal slip
    const printBtn = screen.getByText(/Imprimir Posição Diária/i);
    fireEvent.click(printBtn);

    await waitFor(() => {
      expect(screen.getByText(/Comprovante Térmico ESC\/POS/i)).toBeDefined();
      expect(screen.getByText(/=== DEMONSTRATIVO DE FLUXO DE CAIXA ===/i)).toBeDefined();
    });
  });

  it('should navigate to Contas Bancárias tab and open new account modal', async () => {
    render(<BankReconciliationPage />);

    const accTabBtn = screen.getByText(/Contas Bancárias/i);
    fireEvent.click(accTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Conta Matriz Principal/i)).toBeDefined();
    });

    const newAccBtn = screen.getAllByRole('button', { name: /Nova Conta Bancária/i })[0];
    fireEvent.click(newAccBtn);

    await waitFor(() => {
      expect(screen.getByText(/Cadastrar Conta Bancária/i)).toBeDefined();
      expect(screen.getByText(/Cód\. Banco/i)).toBeDefined();
    });
  });

  it('should open and handle OFX import modal', async () => {
    render(<BankReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByText(/Importar Extrato OFX/i)).toBeDefined();
    });

    const importBtn = screen.getByRole('button', { name: /Importar Extrato OFX/i });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(screen.getByText(/Cole o conteúdo do arquivo \.OFX/i)).toBeDefined();
      expect(screen.getByText(/Nome do Arquivo/i)).toBeDefined();
      expect(screen.getByText(/Processar e Conciliar/i)).toBeDefined();
    });

    const submitImportBtn = screen.getByText(/Processar e Conciliar/i);
    fireEvent.click(submitImportBtn);

    await waitFor(() => {
      expect(bankReconciliationApi.uploadOfx).toHaveBeenCalled();
      expect(bankReconciliationApi.getBatchDetails).toHaveBeenCalledWith(mockBatch.id);
    });
  });
});
