import { describe, it, expect } from 'vitest';
import { BankReconciliationFormatter } from '../../../src/modules/financial/bank-reconciliation-formatter';
import {
  BankStatementBatch,
  BankStatementEntry,
  CashFlowOverview
} from '../../../src/modules/financial/bank-reconciliation.types';

describe('BankReconciliationFormatter', () => {
  const storeInfo = {
    name: 'Magnos Farma Matriz',
    cnpj: '12.345.678/0001-95'
  };

  it('should format 48-column thermal slip for bank statement reconciliation', () => {
    const batch: BankStatementBatch = {
      id: 1,
      bankAccountId: 10,
      batchCode: 'OFX-202606-001',
      fileName: 'extrato_itau.ofx',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-05',
      ledgerBalance: 12500.00,
      totalEntries: 2,
      matchedEntries: 2,
      unmatchedEntries: 0,
      importedAt: '2026-06-05 10:00:00',
      account: {
        id: 10,
        storeId: 1,
        bankCode: '341',
        bankName: 'Banco Itaú',
        agencyNumber: '0057',
        accountNumber: '12345-6',
        accountType: 'CHECKING',
        initialBalance: 10000.0,
        currentBalance: 12500.0,
        isActive: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      }
    };

    const entries: BankStatementEntry[] = [
      {
        id: 101,
        batchId: 1,
        bankAccountId: 10,
        fitid: 'FIT-01',
        transactionType: 'CREDIT',
        postedDate: '2026-06-02',
        amount: 2500.00,
        memo: 'LIQ STONE CARTAO',
        reconciliationStatus: 'MATCHED',
        reconciliationType: 'TEF_SETTLEMENT',
        matchedNotes: 'Conciliado com TEF #1',
        createdAt: '2026-06-05 10:00:00'
      }
    ];

    const slip = BankReconciliationFormatter.formatBankStatementSlip(batch, entries, storeInfo);

    expect(slip).toContain('MAGNOS FARMA MATRIZ');
    expect(slip).toContain('EXTRATO DE CONCILIACAO BANCARIA OFX');
    expect(slip).toContain('BANCO: BANCO ITAÚ');
    expect(slip).toContain('AG: 0057  CC: 12345-6');
    expect(slip).toContain('LIQ STONE CARTAO');
    expect(slip).toContain('R$ 2.500,00');
    expect(slip).toContain('[TEF_SETTLEMENT]');
  });

  it('should format 48-column thermal slip for cash flow liquidity overview', () => {
    const overview: CashFlowOverview = {
      currentBankBalances: [
        { accountId: 1, bankName: 'Itaú', accountNumber: '12345-6', balance: 15000.00 },
        { accountId: 2, bankName: 'Banco do Brasil', accountNumber: '99999-0', balance: 5000.00 }
      ],
      totalLiquidBankBalance: 20000.00,
      totalCashDrawerBalance: 1500.00,
      totalCurrentAssets: 21500.00,
      projections30Days: [
        {
          date: '2026-06-02',
          openingBalance: 21500.00,
          realizedInflow: 0,
          realizedOutflow: 0,
          realizedNet: 0,
          closingBalance: 24500.00,
          projectedInflow: 3000.00,
          projectedOutflow: 0,
          projectedClosingBalance: 24500.00,
          status: 'SURPLUS'
        }
      ]
    };

    const slip = BankReconciliationFormatter.formatCashFlowDailySlip(overview, storeInfo);

    expect(slip).toContain('POSICAO CONSOLIDADA DE CAIXA E LIQUIDEZ');
    expect(slip).toContain('Saldo Total em Bancos: R$ 20.000,00');
    expect(slip).toContain('Saldo em Gaveta (PDV): R$ 1.500,00');
    expect(slip).toContain('Ativo Circulante Imediato: R$ 21.500,00');
  });
});
