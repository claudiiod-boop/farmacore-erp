import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SanitaryPage } from '../../src/pages/SanitaryPage';
import App from '../../src/App';
import { sanitaryApi } from '../../src/services/api';
import type {
  ExpiryRiskMatrix,
  ExpiringBatchItem,
  AnvisaRecallWithItems,
  AffectedPatientItem,
  InventoryLossWithItems,
} from '../../src/types/sanitary';

const mockMatrix: ExpiryRiskMatrix = {
  referenceDate: '2026-11-20',
  storeId: 1,
  tiers: {
    EXPIRED: {
      category: 'EXPIRED',
      label: 'Vencidos',
      minDays: -Infinity,
      maxDays: -1,
      batchCount: 2,
      unitCount: 25,
      totalCost: 250.0,
      totalSale: 500.0,
    },
    RISK_30_DAYS: {
      category: 'RISK_30_DAYS',
      label: 'Até 30 dias',
      minDays: 0,
      maxDays: 30,
      batchCount: 3,
      unitCount: 45,
      totalCost: 450.0,
      totalSale: 900.0,
    },
    RISK_60_DAYS: {
      category: 'RISK_60_DAYS',
      label: '31 a 60 dias',
      minDays: 31,
      maxDays: 60,
      batchCount: 1,
      unitCount: 15,
      totalCost: 150.0,
      totalSale: 300.0,
    },
    RISK_90_DAYS: {
      category: 'RISK_90_DAYS',
      label: '61 a 90 dias',
      minDays: 61,
      maxDays: 90,
      batchCount: 4,
      unitCount: 80,
      totalCost: 800.0,
      totalSale: 1600.0,
    },
    SAFE: {
      category: 'SAFE',
      label: 'Mais de 90 dias',
      minDays: 91,
      maxDays: Infinity,
      batchCount: 10,
      unitCount: 300,
      totalCost: 3000.0,
      totalSale: 6000.0,
    },
  },
  totalBatches: 20,
  totalUnits: 465,
  totalCostAmount: 4650.0,
  totalSaleAmount: 9300.0,
};

const mockBatches: ExpiringBatchItem[] = [
  {
    batchId: 1,
    batchNumber: 'LOTE-VENC-01',
    productId: 101,
    productName: 'Dipirona 500mg 10cp',
    ean: '7891010101010',
    manufacturer: 'Medley',
    expirationDate: '2026-10-31',
    daysUntilExpiration: -20,
    quantity: 15,
    unitCost: 8.0,
    totalCost: 120.0,
    unitSalePrice: 10.0,
    totalSalePrice: 150.0,
    category: 'EXPIRED',
    suggestedAction: 'DISPOSE',
    isBlocked: false,
  },
  {
    batchId: 2,
    batchNumber: 'LOTE-R30-01',
    productId: 102,
    productName: 'Amoxicilina 500mg 21cps',
    ean: '7892020202020',
    manufacturer: 'EMS',
    expirationDate: '2026-12-10',
    daysUntilExpiration: 20,
    quantity: 30,
    unitCost: 30.0,
    totalCost: 900.0,
    unitSalePrice: 35.0,
    totalSalePrice: 1050.0,
    category: 'RISK_30_DAYS',
    suggestedAction: 'PROMOTION',
    isBlocked: false,
  },
];

const mockRecalls: AnvisaRecallWithItems[] = [
  {
    id: 1,
    resolutionNumber: 'RE 1.234/2026',
    resolutionDate: '2026-11-20',
    publicationDate: '2026-11-21',
    reason: 'Desvio de qualidade teor de princípio ativo',
    status: 'ACTIVE',
    notes: 'Publicado no DOU',
    createdAt: '2026-11-21 10:00:00',
    updatedAt: '2026-11-21 10:00:00',
    items: [
      {
        id: 1,
        recallId: 1,
        productId: 101,
        productName: 'Dipirona 500mg 10cp',
        ean: '7891010101010',
        batchNumber: 'LOTE-DIP-999',
        actionTaken: 'BLOCKED',
        totalStockBlocked: 25,
        blockedAt: '2026-11-21 10:00:00',
      },
    ],
  },
];

const mockAffectedPatients: AffectedPatientItem[] = [
  {
    customerId: 5,
    customerName: 'Carlos Oliveira Santos',
    cpf: '123.456.789-01',
    phone: '(11) 98888-2222',
    saleId: 1050,
    saleFiscalNumber: 'NFCe-1050',
    saleDate: '2026-11-19 14:30',
    quantity: 2,
    hasPrescription: true,
    prescriptionDoctor: 'Dr. Roberto Santos (CRM 12345/SP)',
  },
];

const mockLosses: InventoryLossWithItems[] = [
  {
    id: 1,
    lossNumber: 'PER-202611-0001',
    storeId: 1,
    reason: 'EXPIRED',
    status: 'DRAFT',
    totalCostAmount: 120.0,
    totalSaleAmount: 150.0,
    responsiblePharmacistName: 'Dra. Luiza Farmacêutica',
    pharmacistCrf: '12345',
    pharmacistCrfUf: 'SP',
    laudoNumber: null,
    disposalCompanyName: null,
    disposalCertificateNumber: null,
    mtrNumber: null,
    disposedAt: null,
    notes: 'Produtos segregados na gaveta de avarias',
    createdAt: '2026-11-21 11:00:00',
    updatedAt: '2026-11-21 11:00:00',
    items: [
      {
        id: 1,
        lossId: 1,
        productId: 101,
        productName: 'Dipirona 500mg 10cp',
        batchId: 1,
        batchNumber: 'LOTE-VENC-01',
        expirationDate: '2026-10-31',
        quantity: 15,
        unitCost: 8.0,
        totalCost: 120.0,
        unitSalePrice: 10.0,
        totalSalePrice: 150.0,
        createdAt: '2026-11-21 11:00:00',
      },
    ],
  },
];

describe('SanitaryPage - Posto [F12] Validades & Vigilância Sanitária', () => {
  beforeEach(() => {
    vi.spyOn(sanitaryApi, 'getExpiryMatrix').mockResolvedValue(mockMatrix);
    vi.spyOn(sanitaryApi, 'getExpiringBatches').mockResolvedValue({
      batches: mockBatches,
      total: 2,
    });
    vi.spyOn(sanitaryApi, 'getExpiryAuditSlip').mockResolvedValue({
      text: 'LISTA DE CONFERENCIA DE VALIDADES\n[ ] Dipirona 500mg',
    });
    vi.spyOn(sanitaryApi, 'getRecalls').mockResolvedValue(mockRecalls);
    vi.spyOn(sanitaryApi, 'getAffectedPatients').mockResolvedValue(mockAffectedPatients);
    vi.spyOn(sanitaryApi, 'getRecallPatientReport').mockResolvedValue({
      text: 'RECALL SANITARIO ANVISA\nPaciente: Carlos Oliveira',
    });
    vi.spyOn(sanitaryApi, 'getLosses').mockResolvedValue(mockLosses);
    vi.spyOn(sanitaryApi, 'getLossLaudo').mockResolvedValue({
      text: 'LAUDO OFICIAL DE DESCARTE SANITARIO\nPER-202611-0001',
    });
    vi.spyOn(sanitaryApi, 'createLossDraft').mockResolvedValue(mockLosses[0]);
    vi.spyOn(sanitaryApi, 'approveLoss').mockResolvedValue({
      ...mockLosses[0],
      status: 'APPROVED',
    });
    vi.spyOn(sanitaryApi, 'recordDisposalCertificate').mockResolvedValue({
      ...mockLosses[0],
      status: 'DISPOSED',
      disposalCompanyName: 'EcoMed',
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // 1. RENDERIZAÇÃO INICIAL E ABA VALIDADES
  it('should render SanitaryPage with 5 risk cards and batch table', async () => {
    render(<SanitaryPage currentStoreId={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('sanitary-page')).toBeDefined();
    });

    expect(screen.getByText(/Central de Validades & Vigilância Sanitária/i)).toBeDefined();
    expect(screen.getByTestId('card-risk-expired')).toBeDefined();
    expect(screen.getByTestId('card-risk-30')).toBeDefined();
    expect(screen.getByTestId('card-risk-60')).toBeDefined();
    expect(screen.getByTestId('card-risk-90')).toBeDefined();
    expect(screen.getByTestId('card-risk-safe')).toBeDefined();

    // Batches in table
    expect(screen.getByText('Dipirona 500mg 10cp')).toBeDefined();
    expect(screen.getByText('Amoxicilina 500mg 21cps')).toBeDefined();
    expect(screen.getByText('LOTE-VENC-01')).toBeDefined();
  });

  // 2. FILTRAR POR CATEGORIA DE RISCO
  it('should filter batches when clicking on a risk card', async () => {
    render(<SanitaryPage currentStoreId={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('card-risk-expired')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('card-risk-expired'));

    await waitFor(() => {
      expect(sanitaryApi.getExpiringBatches).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'EXPIRED',
        })
      );
    });
  });

  // 3. IMPRIMIR LISTA DE CONFERÊNCIA
  it('should open print preview modal when clicking Imprimir Lista de Conferência', async () => {
    render(<SanitaryPage currentStoreId={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('print-audit-slip-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('print-audit-slip-button'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-print-preview')).toBeDefined();
    });

    expect(screen.getByText(/LISTA DE CONFERENCIA DE VALIDADES/)).toBeDefined();
  });

  // 4. NAVEGAÇÃO ENTRE ABAS: RECALL ANVISA
  it('should switch to RECALL tab and list active recalls', async () => {
    render(<SanitaryPage currentStoreId={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-recall')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('tab-recall'));

    await waitFor(() => {
      expect(screen.getByTestId('recall-tab-content')).toBeDefined();
    });

    expect(screen.getByText('RE 1.234/2026')).toBeDefined();
    expect(screen.getByText(/Desvio de qualidade/i)).toBeDefined();
  });

  // 5. RASTREABILIDADE REVERSA DE PACIENTES
  it('should open reverse patient traceability modal from recall card', async () => {
    render(<SanitaryPage currentStoreId={1} />);

    fireEvent.click(screen.getByTestId('tab-recall'));

    await waitFor(() => {
      expect(screen.getByTestId('btn-patients-1')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('btn-patients-1'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-affected-patients')).toBeDefined();
    });

    expect(screen.getByText('Carlos Oliveira Santos')).toBeDefined();
    expect(screen.getByText(/Venda #1050/)).toBeDefined();
    expect(screen.getByText('Avisar WhatsApp')).toBeDefined();
  });

  // 6. NAVEGAÇÃO ENTRE ABAS: BAIXAS & LAUDO VISA
  it('should switch to LOSSES tab and allow approving a loss draft', async () => {
    render(<SanitaryPage currentStoreId={1} />);

    fireEvent.click(screen.getByTestId('tab-losses'));

    await waitFor(() => {
      expect(screen.getByTestId('losses-tab-content')).toBeDefined();
    });

    expect(screen.getByText('PER-202611-0001')).toBeDefined();
    expect(screen.getByText('Dra. Luiza Farmacêutica')).toBeDefined();

    const approveBtn = screen.getByTestId('btn-approve-loss-1');
    expect(approveBtn).toBeDefined();
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(sanitaryApi.approveLoss).toHaveBeenCalledWith(1, expect.any(Object));
    });
  });

  // 7. INTEGRAÇÃO NO APP.TSX (BOTÃO TOPBAR E ATALHO F12)
  it('should render Sanitary button in topbar and navigate to SanitaryPage on click', async () => {
    render(<App />);

    const topbarBtn = screen.getByTestId('topbar-sanitary-button');
    expect(topbarBtn).toBeDefined();
    expect(topbarBtn.textContent).toContain('[F12] Validades & VISA');

    fireEvent.click(topbarBtn);

    await waitFor(() => {
      expect(screen.getByTestId('sanitary-page')).toBeDefined();
    });
  });
});
