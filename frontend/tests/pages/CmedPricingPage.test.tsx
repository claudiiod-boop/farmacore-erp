import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import CmedPricingPage from '../../src/pages/CmedPricingPage';
import { cmedApi } from '../../src/services/api';
import type {
  CmedProduct,
  CmedPricingRule,
  CmedPricingAuditReport,
} from '../../src/types/cmed';

const mockAuditReport: CmedPricingAuditReport = {
  storeId: 1,
  icmsRate: 18.0,
  totalProductsAudited: 2,
  nonCompliantAbovePmcCount: 1,
  lowMarginCount: 0,
  compliantCount: 1,
  items: [
    {
      productId: 1,
      ean: '7891234567890',
      productName: 'Dipirona 500mg Gotas',
      currentSalePrice: 12.00,
      pmcAllowed: 10.00,
      pfReference: 5.00,
      productType: 'GENERICO',
      listType: 'POSITIVA',
      status: 'ABOVE_PMC',
      priceExcessAmount: 2.00,
      currentMarginPercent: 58.3,
      suggestedSalePrice: 10.00,
    },
    {
      productId: 2,
      ean: '7899876543210',
      productName: 'Amoxicilina 500mg 21 caps',
      currentSalePrice: 28.00,
      pmcAllowed: 35.00,
      pfReference: 20.00,
      productType: 'GENERICO',
      listType: 'NEGATIVA',
      status: 'COMPLIANT',
      priceExcessAmount: 0,
      currentMarginPercent: 28.6,
      suggestedSalePrice: 28.00,
    },
  ],
};

const mockCmedSearchResults: CmedProduct[] = [
  {
    id: 10,
    versionId: 1,
    ean: '7891234567890',
    msRegistration: '1000000000001',
    product_name: 'DIPIRONA',
    presentation: '500MG/ML GOTAS 20ML',
    substance_name: 'DIPIRONA',
    laboratory_name: 'MEDLEY',
    product_type: 'GENERICO',
    list_type: 'POSITIVA',
    pf_18: 5.00,
    pmc_18: 10.00,
  },
];

const mockPricingRules: CmedPricingRule[] = [
  {
    id: 1,
    storeId: 1,
    categoryType: 'GENERICO',
    discountPercentPmc: 35.0,
    minGrossMarginPercent: 20.0,
    enforcePmcCap: true,
  },
];

describe('CmedPricingPage (Tabela Oficial CMED / ANVISA & Trava Regulatória PMC)', () => {
  beforeEach(() => {
    vi.spyOn(cmedApi, 'runAudit').mockResolvedValue(mockAuditReport);
    vi.spyOn(cmedApi, 'getRules').mockResolvedValue(mockPricingRules);
    vi.spyOn(cmedApi, 'searchCmedProducts').mockResolvedValue(mockCmedSearchResults);
    vi.spyOn(cmedApi, 'saveRule').mockResolvedValue(mockPricingRules[0]);
    vi.spyOn(cmedApi, 'applyUpdates').mockResolvedValue({
      updatedCount: 1,
      message: '1 preço(s) de medicamentos atualizados com sucesso.',
    });
    vi.spyOn(cmedApi, 'importCmedFile').mockResolvedValue({
      versionId: 1,
      versionCode: 'CMED-2026-11',
      importedCount: 50,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render header, regulatory badge, ICMS selector and all 4 tabs', async () => {
    render(<CmedPricingPage />);

    expect(screen.getByText('Tabela CMED / ANVISA & Precificação')).toBeDefined();
    expect(screen.getByText(/Trava Sanitária Inviolável \(Lei 10\.742\/2003\)/i)).toBeDefined();

    expect(screen.getByText(/1\. Auditoria Sanitária & Trava PMC/i)).toBeDefined();
    expect(screen.getByText(/2\. Consulta Base Oficial CMED \/ ANVISA/i)).toBeDefined();
    expect(screen.getByText(/3\. Regras de Precificação por Categoria/i)).toBeDefined();
    expect(screen.getByText(/4\. Importador da Tabela CMED \(CSV\)/i)).toBeDefined();
  });

  it('should display audit metrics and trigger bulk correction for items above PMC', async () => {
    render(<CmedPricingPage />);

    await waitFor(() => {
      expect(cmedApi.runAudit).toHaveBeenCalledWith(1, 18.0);
      expect(screen.getByText('Acima do Teto PMC')).toBeDefined();
      expect(screen.getByText('Infração Sanitária Gravíssima')).toBeDefined();
      expect(screen.getByText('Dipirona 500mg Gotas')).toBeDefined();
    });

    const fixBtn = screen.getByRole('button', { name: /Corrigir Todos para o Teto PMC/i });
    fireEvent.click(fixBtn);

    await waitFor(() => {
      expect(cmedApi.applyUpdates).toHaveBeenCalledWith(
        1,
        [
          expect.objectContaining({
            productId: 1,
            newPrice: 10.00,
          }),
        ],
        'FARMACEUTICO_RESP'
      );
    });
  });

  it('should switch to search tab and query official CMED database', async () => {
    render(<CmedPricingPage />);

    await waitFor(() => {
      expect(cmedApi.runAudit).toHaveBeenCalledWith(1, 18.0);
    });

    fireEvent.click(screen.getByText(/2\. Consulta Base Oficial CMED \/ ANVISA/i));

    fireEvent.change(screen.getByPlaceholderText(/Digite o nome do medicamento/i), {
      target: { value: 'DIPIRONA' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Consultar CMED/i }));

    await waitFor(() => {
      expect(cmedApi.searchCmedProducts).toHaveBeenCalledWith('DIPIRONA', 50);
      expect(screen.getAllByText('DIPIRONA').length).toBeGreaterThan(0);
      expect(screen.getByText('MEDLEY')).toBeDefined();
    });
  });

  it('should switch to rules tab and save commercial pricing policy', async () => {
    render(<CmedPricingPage />);

    fireEvent.click(screen.getByText(/3\. Regras de Precificação por Categoria/i));

    await waitFor(() => {
      expect(screen.getByText('Configurar Regra Comercial por Categoria')).toBeDefined();
      expect(screen.getAllByText('GENERICO').length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByPlaceholderText('Ex: 35.0'), {
      target: { value: '40.0' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex: 20.0'), {
      target: { value: '25.0' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Salvar Política de Precificação/i }));

    await waitFor(() => {
      expect(cmedApi.saveRule).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: 1,
          categoryType: 'GENERICO',
          discountPercentPmc: 40.0,
          minGrossMarginPercent: 25.0,
        })
      );
    });
  });

  it('should switch to import tab and execute CMED CSV loading', async () => {
    render(<CmedPricingPage />);

    fireEvent.click(screen.getByText(/4\. Importador da Tabela CMED \(CSV\)/i));

    await waitFor(() => {
      expect(screen.getByText('Carga da Tabela Mensal da ANVISA (CMED)')).toBeDefined();
    });

    fireEvent.change(screen.getByPlaceholderText(/Exemplo de cabeçalho e registros/i), {
      target: {
        value: 'SUBSTANCIA;CNPJ;LABORATORIO;REGISTRO;EAN_1;PRODUTO;PF_18;PMC_18\nDIPIRONA;111;MEDLEY;100;7891;DIPIRONA;5,00;10,00',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /Iniciar Importação e Carga da Base CMED/i }));

    await waitFor(() => {
      expect(cmedApi.importCmedFile).toHaveBeenCalledWith(
        expect.objectContaining({
          versionCode: 'CMED-2026-11',
          fileContent: expect.any(String),
        })
      );
    });
  });
});
