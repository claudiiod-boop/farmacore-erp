import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import B2bQuotationsPage from '../../src/pages/B2bQuotationsPage';
import { b2bApi } from '../../src/services/api';
import type {
  B2bSupplier,
  ReplenishmentSuggestion,
  B2bQuotationCampaign,
  QuotationOptimizationResult,
  EdiExportResponse,
} from '../../src/types/b2b';

const mockSuppliers: B2bSupplier[] = [
  {
    id: 1,
    code: 'SUPP-SC',
    name: 'Distribuidora Santa Cruz',
    tradeName: 'Santa Cruz',
    cnpj: '11222333000199',
    minOrderValue: 400.0,
    leadTimeDays: 1,
    paymentTerms: '28 DDL',
  },
  {
    id: 2,
    code: 'SUPP-PAN',
    name: 'Panpharma Medicamentos',
    tradeName: 'Panpharma',
    cnpj: '44555666000188',
    minOrderValue: 300.0,
    leadTimeDays: 2,
    paymentTerms: '21 DDL',
  },
];

const mockSuggestions: ReplenishmentSuggestion[] = [
  {
    productId: 1,
    ean: '7891234567890',
    productName: 'Dipirona 500mg Gotas',
    currentStock: 2,
    inTransitStock: 0,
    averageDailySales: 4.5,
    leadTimeDays: 2,
    safetyStock: 5,
    reorderPoint: 14,
    suggestedQuantity: 30,
    ruptureRisk: 'MEDIUM',
    estimatedDaysUntilRupture: 0,
    currentCost: 4.50,
    abcClass: 'A',
  },
  {
    productId: 2,
    ean: '7899876543210',
    productName: 'Amoxicilina 500mg 21 caps',
    currentStock: 0,
    inTransitStock: 0,
    averageDailySales: 2.0,
    leadTimeDays: 2,
    safetyStock: 4,
    reorderPoint: 8,
    suggestedQuantity: 20,
    ruptureRisk: 'HIGH',
    estimatedDaysUntilRupture: 0,
    currentCost: 18.00,
    abcClass: 'A',
  },
];

const mockCampaign: B2bQuotationCampaign = {
  id: 10,
  campaignCode: 'COT-2026-0001',
  storeId: 1,
  title: 'Cotação Semanal de Reposição',
  status: 'OPEN',
  createdAt: '2026-11-23 18:00:00',
  items: [
    {
      id: 101,
      campaignId: 10,
      productId: 1,
      productName: 'Dipirona 500mg Gotas',
      ean: '7891234567890',
      currentStock: 2,
      suggestedQuantity: 30,
      requestedQuantity: 30,
      targetPrice: 4.50,
    },
  ],
  proposals: [
    {
      id: 201,
      campaignId: 10,
      supplierId: 1,
      supplierName: 'Distribuidora Santa Cruz',
      proposalCode: 'PROP-SC-01',
      totalAmount: 135.0,
      discountAmount: 0,
      netAmount: 135.0,
      status: 'SUBMITTED',
      paymentTerms: '28 DDL',
      deliveryDays: 1,
    },
  ],
};

const mockOptimizationResult: QuotationOptimizationResult = {
  campaignId: 10,
  optimizationMode: 'SPLIT_ORDER',
  totalCampaignSavings: 45.0,
  awardedOrders: [
    {
      supplierId: 1,
      supplierName: 'Distribuidora Santa Cruz',
      supplierCnpj: '11222333000199',
      minOrderValue: 400.0,
      itemsCount: 1,
      totalOrderAmount: 135.0,
      meetsMinOrder: false,
      items: [
        {
          productId: 1,
          productName: 'Dipirona 500mg Gotas',
          ean: '7891234567890',
          quantity: 30,
          unitPrice: 4.50,
          totalAmount: 135.0,
        },
      ],
    },
  ],
  unattendedItems: [],
};

const mockEdiExport: EdiExportResponse = {
  campaignCode: 'COT-2026-0001',
  fileName: 'COT-2026-0001_EDI_COTACAO.txt',
  content: 'HDR|COT-2026-0001|12345678000190|Drogaria FarmaCore\nITM|7891234567890|Dipirona|30|4.50\nTRL|1|30',
};

describe('B2bQuotationsPage (Cotação Eletrônica B2B, Reposição e EDI Farma)', () => {
  beforeEach(() => {
    vi.spyOn(b2bApi, 'getReplenishmentSuggestions').mockResolvedValue(mockSuggestions);
    vi.spyOn(b2bApi, 'getSuppliers').mockResolvedValue(mockSuppliers);
    vi.spyOn(b2bApi, 'listCampaigns').mockResolvedValue([mockCampaign]);
    vi.spyOn(b2bApi, 'getCampaign').mockResolvedValue(mockCampaign);
    vi.spyOn(b2bApi, 'createCampaign').mockResolvedValue(mockCampaign);
    vi.spyOn(b2bApi, 'exportEdiQuotation').mockResolvedValue(mockEdiExport);
    vi.spyOn(b2bApi, 'optimizeCampaign').mockResolvedValue(mockOptimizationResult);
    vi.spyOn(b2bApi, 'registerSupplier').mockResolvedValue(mockSuppliers[0]);
    vi.spyOn(b2bApi, 'importEdiProposals').mockResolvedValue({ id: 1 } as any);
    vi.spyOn(b2bApi, 'generatePurchaseOrders').mockResolvedValue({
      generatedOrdersCount: 1,
      message: 'Pedidos de compra gerados com sucesso!',
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render header, badge and all 5 navigation tabs', async () => {
    render(<B2bQuotationsPage />);

    expect(screen.getByText('Cotação B2B & Reposição Inteligente')).toBeDefined();
    expect(screen.getByText('EDI Farma & Split Order')).toBeDefined();

    expect(screen.getByText(/1\. Sugestões de Reposição/i)).toBeDefined();
    expect(screen.getByText(/2\. Campanhas de Cotação Ativas/i)).toBeDefined();
    expect(screen.getByText(/3\. Comparador Split Order/i)).toBeDefined();
    expect(screen.getByText(/4\. Central EDI Farma/i)).toBeDefined();
    expect(screen.getByText(/5\. Cadastro de Distribuidoras/i)).toBeDefined();
  });

  it('should load replenishment suggestions with rupture risks and reorder points', async () => {
    render(<B2bQuotationsPage />);

    await waitFor(() => {
      expect(b2bApi.getReplenishmentSuggestions).toHaveBeenCalledWith(1);
    });

    expect(screen.getByText('Dipirona 500mg Gotas')).toBeDefined();
    expect(screen.getByText('Amoxicilina 500mg 21 caps')).toBeDefined();
    expect(screen.getByText('HIGH')).toBeDefined();
    expect(screen.getByText('MEDIUM')).toBeDefined();
  });

  it('should select critical items and create a quotation campaign', async () => {
    render(<B2bQuotationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Dipirona 500mg Gotas')).toBeDefined();
    });

    const selectCriticalBtn = screen.getByRole('button', { name: /Selecionar Ruptura Imediata/i });
    fireEvent.click(selectCriticalBtn);

    const createBtn = screen.getByRole('button', { name: /Criar Cotação com 2 Itens/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(b2bApi.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: 1,
          items: expect.any(Array),
        })
      );
    });
  });

  it('should switch to campaigns tab and export EDI Farma file', async () => {
    render(<B2bQuotationsPage />);

    fireEvent.click(screen.getByText(/2\. Campanhas de Cotação Ativas/i));

    await waitFor(() => {
      expect(screen.getByText('COT-2026-0001')).toBeDefined();
    });

    fireEvent.click(screen.getByText('COT-2026-0001'));

    await waitFor(() => {
      expect(b2bApi.getCampaign).toHaveBeenCalledWith(10);
      expect(screen.getByRole('button', { name: /Exportar Espelho EDI/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Exportar Espelho EDI/i }));

    await waitFor(() => {
      expect(b2bApi.exportEdiQuotation).toHaveBeenCalledWith(10);
      expect(screen.getByText('Espelho de Cotação EDI Farma')).toBeDefined();
      expect(screen.getAllByText(/COT-2026-0001_EDI_COTACAO\.txt/i).length).toBeGreaterThan(0);
    });
  });

  it('should switch to optimizer tab and display split order results with savings', async () => {
    render(<B2bQuotationsPage />);

    // Seleciona campanha e clica em otimizar
    fireEvent.click(screen.getByText(/2\. Campanhas de Cotação Ativas/i));
    await waitFor(() => expect(screen.getByText('COT-2026-0001')).toBeDefined());
    fireEvent.click(screen.getByText('COT-2026-0001'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Otimizar Split Order/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Otimizar Split Order/i }));

    await waitFor(() => {
      expect(b2bApi.optimizeCampaign).toHaveBeenCalledWith(10, 'SPLIT_ORDER');
    });

    // Deve alternar para aba do otimizador e exibir economia
    await waitFor(() => {
      expect(screen.getByText('R$ 45.00')).toBeDefined();
      expect(screen.getByText(/Economia Total Gerada na Cotação/i)).toBeDefined();
    });
  });

  it('should switch to suppliers tab and register a new distributor', async () => {
    render(<B2bQuotationsPage />);

    fireEvent.click(screen.getByText(/5\. Cadastro de Distribuidoras/i));

    await waitFor(() => {
      expect(screen.getByText('Cadastrar Nova Distribuidora Farmacêutica')).toBeDefined();
      expect(screen.getByText('Distribuidora Santa Cruz')).toBeDefined();
    });

    fireEvent.change(screen.getByPlaceholderText('Ex: SUPP-SC'), {
      target: { value: 'SUPP-GAM' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex: Santa Cruz Distribuidora de Medicamentos Ltda'), {
      target: { value: 'GAM Distribuidora de Medicamentos' },
    });
    fireEvent.change(screen.getByPlaceholderText('00.000.000/0000-00'), {
      target: { value: '99888777000155' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Cadastrar Distribuidora/i }));

    await waitFor(() => {
      expect(b2bApi.registerSupplier).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SUPP-GAM',
          name: 'GAM Distribuidora de Medicamentos',
          cnpj: '99888777000155',
        })
      );
    });
  });
});
