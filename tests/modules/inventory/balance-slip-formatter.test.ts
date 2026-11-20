import { describe, it, expect } from 'vitest';
import { formatBalanceSlip } from '../../../src/modules/inventory/balance-slip-formatter';
import type { InventorySessionWithItems } from '../../../src/modules/inventory/audit-types';
import type { Store } from '../../../src/modules/stores/types';

describe('BalanceSlipFormatter (Termo de Balanço e Auditoria)', () => {
  const mockStore: Store = {
    id: 1,
    code: 'LJ01',
    name: 'FarmaCore Matriz Centro',
    companyName: 'FarmaCore Drogaria S/A',
    cnpj: '12.345.678/0001-90',
    ie: '123456789',
    isHeadquarters: true,
    phone: '11999990001',
    email: 'matriz@farmacore.com.br',
    street: 'Rua das Flores',
    number: '100',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01001-000',
    ibgeCode: '3550308',
    taxRegime: 'LUCRO_REAL',
    isActive: true,
  };

  it('formats a complete balance slip with divergences and pharmacist CRF', () => {
    const session: InventorySessionWithItems = {
      id: 1,
      sessionCode: 'INV-20261119-0001',
      storeId: 1,
      inventoryType: 'CONTROLADOS_SNGPC',
      status: 'APPLIED',
      openedBy: 'Carlos Operador',
      appliedBy: 'Dra. Beatriz Farmacêutica',
      responsiblePharmacistCrf: '12345',
      responsiblePharmacistUf: 'SP',
      totalProductsExpected: 10,
      totalProductsCounted: 10,
      totalBatchesExpected: 12,
      totalBatchesCounted: 12,
      accuracyRate: 83.33,
      totalSurplusCost: 150.0,
      totalShortageCost: 200.0,
      netFinancialDifference: -50.0,
      startedAt: '2026-11-19 08:00:00',
      closedAt: '2026-11-19 12:00:00',
      createdAt: '2026-11-19 08:00:00',
      updatedAt: '2026-11-19 12:00:00',
      items: [
        {
          id: 101,
          sessionId: 1,
          productId: 10,
          productName: 'Clonazepam 2mg 30cp',
          batchNumber: 'LOT-CLON-1',
          expirationDate: '2027-12-31',
          manufacturingDate: '2024-01-01',
          expectedQuantity: 50,
          countedQuantity: 45,
          differenceQuantity: -5,
          differenceStatus: 'SHORTAGE',
          unitCost: 10.0,
          totalCostDifference: -50.0,
          adjustmentReason: 'AVARIA',
          sngpcAdjusted: true,
          createdAt: '2026-11-19 08:30:00',
          updatedAt: '2026-11-19 11:00:00',
        },
        {
          id: 102,
          sessionId: 1,
          productId: 20,
          productName: 'Amoxicilina 500mg',
          batchNumber: 'LOT-AMOX-1',
          expirationDate: '2026-10-31',
          manufacturingDate: '2024-02-01',
          expectedQuantity: 20,
          countedQuantity: 25,
          differenceQuantity: 5,
          differenceStatus: 'SURPLUS',
          unitCost: 15.0,
          totalCostDifference: 75.0,
          adjustmentReason: 'SOBRA_NAO_IDENTIFICADA',
          sngpcAdjusted: true,
          createdAt: '2026-11-19 08:40:00',
          updatedAt: '2026-11-19 11:00:00',
        },
        {
          id: 103,
          sessionId: 1,
          productId: 30,
          productName: 'Dipirona 500mg',
          batchNumber: 'LOT-DIPI-01',
          expirationDate: '2028-05-31',
          manufacturingDate: '2024-03-01',
          expectedQuantity: 100,
          countedQuantity: 100,
          differenceQuantity: 0,
          differenceStatus: 'EXACT',
          unitCost: 5.0,
          totalCostDifference: 0.0,
          adjustmentReason: null,
          sngpcAdjusted: false,
          createdAt: '2026-11-19 08:50:00',
          updatedAt: '2026-11-19 11:00:00',
        },
      ],
    };

    const result = formatBalanceSlip(session, mockStore);

    expect(result).toHaveProperty('textSlip');
    expect(result).toHaveProperty('fullEscPos');

    const slip = result.textSlip;

    // Header validations
    expect(slip).toContain('FARMACORE ERP - TERMO DE BALANÇO E AUDITORIA DE ESTOQUE');
    expect(slip).toContain('Nº Inventário: INV-20261119-0001 | Tipo: CONTROLADOS_SNGPC | Status: APPLIED');
    expect(slip).toContain('Filial: [LJ01] FarmaCore Matriz Centro - CNPJ: 12.345.678/0001-90');
    expect(slip).toContain('Data Abertura: 2026-11-19 08:00:00 | Fechamento: 2026-11-19 12:00:00');
    expect(slip).toContain('Responsável: Carlos Operador | Homologado por: Dra. Beatriz Farmacêutica');
    expect(slip).toContain('Farmacêutico RT: 12345/SP');

    // Indicators validations
    expect(slip).toContain('Acurácia Patrimonial: 83.33%');
    expect(slip).toContain('Lotes Esperados: 12 | Lotes com Contagem: 12');
    expect(slip).toContain('Custo Total Sobras (+): R$ 150.00');
    expect(slip).toContain('Custo Total Faltas (-):  R$ 200.00');
    expect(slip).toContain('Diferença Líquida:       R$ -50.00');

    // Divergent items table validations
    expect(slip).toContain('Clonazepam 2mg 30cp');
    expect(slip).toContain('LOT-CLON-1');
    expect(slip).toContain('AVARIA');
    expect(slip).toContain('Amoxicilina 500mg');
    expect(slip).toContain('SOBRA_NAO_ID');

    // Non-divergent item should NOT appear in divergence table
    expect(slip).not.toContain('LOT-DIPI-01');

    // Signatures
    expect(slip).toContain('Farmacêutico Responsável Técnico');
    expect(slip).toContain('CRF: 12345/SP');
    expect(slip).toContain('Gerente da Loja');

    // ESC/POS checks
    expect(result.fullEscPos).toContain('\x1b\x40'); // Init
    expect(result.fullEscPos).toContain('\x1b\x45\x01'); // Bold ON
    expect(result.fullEscPos).toContain('\x1b\x45\x00'); // Bold OFF
    expect(result.fullEscPos).toContain('\x1b\x69'); // Cut
  });

  it('formats slip when there are no divergences (100% accurate)', () => {
    const session: InventorySessionWithItems = {
      id: 2,
      sessionCode: 'INV-20261119-0002',
      storeId: 1,
      inventoryType: 'GERAL',
      status: 'OPEN',
      openedBy: 'Operador Teste',
      appliedBy: null,
      responsiblePharmacistCrf: null,
      responsiblePharmacistUf: null,
      totalProductsExpected: 5,
      totalProductsCounted: 5,
      totalBatchesExpected: 5,
      totalBatchesCounted: 5,
      accuracyRate: 100.0,
      totalSurplusCost: 0,
      totalShortageCost: 0,
      netFinancialDifference: 0,
      startedAt: '2026-11-19 14:00:00',
      closedAt: null,
      createdAt: '2026-11-19 14:00:00',
      updatedAt: '2026-11-19 14:00:00',
      items: [
        {
          id: 201,
          sessionId: 2,
          productId: 10,
          productName: 'Dipirona 500mg',
          batchNumber: 'LOT-DIPI-01',
          expirationDate: '2028-05-31',
          manufacturingDate: '2024-03-01',
          expectedQuantity: 50,
          countedQuantity: 50,
          differenceQuantity: 0,
          differenceStatus: 'EXACT',
          unitCost: 5.0,
          totalCostDifference: 0.0,
          sngpcAdjusted: false,
          createdAt: '2026-11-19 14:05:00',
          updatedAt: '2026-11-19 14:05:00',
        },
      ],
    };

    const result = formatBalanceSlip(session, mockStore);

    expect(result.textSlip).toContain('Fechamento: Em aberto');
    expect(result.textSlip).toContain('Homologado por: Pendente');
    expect(result.textSlip).toContain('Farmacêutico RT: N/A');
    expect(result.textSlip).toContain('Nenhuma divergência apurada. Estoque 100% acurado.');
  });
});
