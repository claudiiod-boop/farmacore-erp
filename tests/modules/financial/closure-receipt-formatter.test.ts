import { describe, it, expect } from 'vitest';
import { formatCashClosureReceipt } from '../../../src/modules/financial/closure-receipt-formatter';
import type { CashClosure, StoreInfo } from '../../../src/modules/financial/types';
import type { CashSession } from '../../../src/modules/pos/types';

describe('formatCashClosureReceipt (ESC/POS 48 Columns Thermal Receipt)', () => {
  const mockSession: CashSession = {
    id: 12,
    operatorName: 'Carlos Caixa',
    initialCash: 100.0,
    currentCash: 140.0,
    status: 'CLOSED',
    openedAt: '2026-11-18 08:00:00',
    closedAt: '2026-11-18 18:00:00',
  };

  const mockStoreInfo: StoreInfo = {
    name: 'FARMACIA POPULAR CENTRAL',
    cnpj: '12.345.678/0001-99',
    address: 'Rua das Flores, 123 - Centro',
    city: 'Sao Paulo - SP',
    phone: '(11) 3333-4444',
  };

  it('should format exact match closure with 48 columns fixed width layout', () => {
    const mockClosure: CashClosure = {
      id: 1,
      cashSessionId: 12,
      operatorName: 'Carlos Caixa',
      declaredAt: '2026-11-18 18:00:00',
      declaredCash: 140.0,
      declaredCredit: 250.0,
      declaredDebit: 150.0,
      declaredPix: 80.0,
      declaredPbm: 60.0,
      totalDeclared: 680.0,
      operatorNotes: 'Turno sem ocorrencias',
      systemCash: 140.0,
      systemCredit: 250.0,
      systemDebit: 150.0,
      systemPix: 80.0,
      systemPbm: 60.0,
      systemSupplies: 20.0,
      systemSangrias: 30.0,
      totalSystem: 680.0,
      cashDifference: 0.0,
      totalDifference: 0.0,
      differenceStatus: 'EXACT',
      status: 'APPROVED',
      managerName: 'Ana Gerente',
      managerNotes: 'Conferido e homologado sem divergencias',
      reviewedAt: '2026-11-18 18:15:00',
      createdAt: '2026-11-18 18:00:00',
      updatedAt: '2026-11-18 18:15:00',
    };

    const { textReceipt, fullEscPos } = formatCashClosureReceipt(mockClosure, mockSession, mockStoreInfo);

    // Verify all lines are at most 48 characters
    const lines = textReceipt.split('\n');
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(48);
    }

    // Verify store info and title
    expect(textReceipt).toContain('FARMACIA POPULAR CENTRAL');
    expect(textReceipt).toContain('12.345.678/0001-99');
    expect(textReceipt).toContain('COMPROVANTE DE FECHAMENTO DE CAIXA');
    expect(textReceipt).toContain('Carlos Caixa');

    // Verify breakdown
    expect(textReceipt).toContain('SALDO INICIAL');
    expect(textReceipt).toContain('100.00');
    expect(textReceipt).toContain('TOTAL APURADO SISTEMA');
    expect(textReceipt).toContain('680.00');
    expect(textReceipt).toContain('TOTAL DECLARADO');
    expect(textReceipt).toContain('EXATO');

    // Verify manager review
    expect(textReceipt).toContain('APROVADO');
    expect(textReceipt).toContain('Ana Gerente');

    // Verify ESC/POS codes
    expect(fullEscPos).toContain('\x1b\x40'); // Init
    expect(fullEscPos).toContain('\x1b\x45\x01'); // Bold on
    expect(fullEscPos).toContain('\x1b\x61\x01'); // Center
    expect(fullEscPos).toContain('\x1d\x56\x00'); // Cut
  });

  it('should format shortage (QUEBRA DE CAIXA) receipt clearly highlighting missing money', () => {
    const mockClosure: CashClosure = {
      id: 2,
      cashSessionId: 12,
      operatorName: 'Carlos Caixa',
      declaredAt: '2026-11-18 18:00:00',
      declaredCash: 115.0, // R$ 25 shortage
      declaredCredit: 0.0,
      declaredDebit: 0.0,
      declaredPix: 0.0,
      declaredPbm: 0.0,
      totalDeclared: 115.0,
      operatorNotes: 'Diferenca a apurar',
      systemCash: 140.0,
      systemCredit: 0.0,
      systemDebit: 0.0,
      systemPix: 0.0,
      systemPbm: 0.0,
      systemSupplies: 0.0,
      systemSangrias: 0.0,
      totalSystem: 140.0,
      cashDifference: -25.0,
      totalDifference: -25.0,
      differenceStatus: 'SHORTAGE',
      status: 'PENDING_REVIEW',
      createdAt: '2026-11-18 18:00:00',
      updatedAt: '2026-11-18 18:00:00',
    };

    const { textReceipt } = formatCashClosureReceipt(mockClosure, mockSession);

    expect(textReceipt).toContain('QUEBRA DE CAIXA');
    expect(textReceipt).toContain('-25.00');
    expect(textReceipt).toContain('PENDENTE');
  });

  it('should format surplus (SOBRA DE CAIXA) receipt clearly', () => {
    const mockClosure: CashClosure = {
      id: 3,
      cashSessionId: 12,
      operatorName: 'Carlos Caixa',
      declaredAt: '2026-11-18 18:00:00',
      declaredCash: 160.0, // R$ 20 surplus
      declaredCredit: 0.0,
      declaredDebit: 0.0,
      declaredPix: 0.0,
      declaredPbm: 0.0,
      totalDeclared: 160.0,
      systemCash: 140.0,
      systemCredit: 0.0,
      systemDebit: 0.0,
      systemPix: 0.0,
      systemPbm: 0.0,
      systemSupplies: 0.0,
      systemSangrias: 0.0,
      totalSystem: 140.0,
      cashDifference: 20.0,
      totalDifference: 20.0,
      differenceStatus: 'SURPLUS',
      status: 'APPROVED',
      managerName: 'Roberto Gerente',
      managerNotes: 'Sobra registrada em conta de ajuste',
      reviewedAt: '2026-11-18 18:30:00',
      createdAt: '2026-11-18 18:00:00',
      updatedAt: '2026-11-18 18:30:00',
    };

    const { textReceipt } = formatCashClosureReceipt(mockClosure, mockSession);

    expect(textReceipt).toContain('SOBRA DE CAIXA');
    expect(textReceipt).toContain('20.00');
  });
});
