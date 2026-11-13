import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import PurchasesPage from '../../src/pages/PurchasesPage';
import { purchasesApi } from '../../src/services/api';
import type {
  PurchaseInvoiceSummary,
  PurchasePreviewResult,
  PurchaseInvoiceDetails,
} from '../../src/types';

const mockInvoices: PurchaseInvoiceSummary[] = [
  {
    id: 1,
    accessKey: '35260112345678000195550010000000011000000010',
    invoiceNumber: 101,
    invoiceSeries: 1,
    issueDate: '2026-11-10T10:00:00.000Z',
    supplierCnpj: '12345678000195',
    supplierName: 'DISTRIBUIDORA SANTA CRUZ LTDA',
    supplierIe: '123456789',
    totalInvoiceAmount: 1540.5,
    totalProductsAmount: 1500.0,
    totalIcmsSt: 40.5,
    itemsCount: 3,
    createdAt: '2026-11-10T10:30:00.000Z',
  },
];

const mockPreview: PurchasePreviewResult = {
  accessKey: '35260199999999000199550010000000021000000020',
  invoiceNumber: 202,
  invoiceSeries: 1,
  issueDate: '2026-11-12T08:00:00.000Z',
  supplierCnpj: '99999999000199',
  supplierName: 'PANPHARMA DISTRIBUIDORA DE MEDICAMENTOS',
  totalInvoiceAmount: 850.0,
  totalProductsAmount: 850.0,
  totalIcmsSt: 0,
  newProductsCount: 1,
  existingProductsCount: 1,
  hasCmedAlerts: true,
  items: [
    {
      itemIndex: 1,
      supplierProductCode: 'MED001',
      ean: '7891058001234',
      productName: 'AMOXICILINA 500MG 21 CAPSULAS',
      ncm: '30041011',
      cfop: '5102',
      quantity: 20,
      unitCost: 15.0,
      totalCost: 300.0,
      batchNumber: 'LOTE-AMX-01',
      expirationDate: '2027-12-31',
      manufacturingDate: '2025-01-01',
      anvisaRegistration: '1058300120011',
      pmc: 35.5,
      isExistingProduct: true,
      cmedWarning: null,
    },
    {
      itemIndex: 2,
      supplierProductCode: 'MED002',
      ean: '7891058009999',
      productName: 'MEDICAMENTO NOVO ULTRA 100MG',
      ncm: '30049099',
      cfop: '5102',
      quantity: 10,
      unitCost: 55.0,
      totalCost: 550.0,
      batchNumber: 'LOTE-NOV-99',
      expirationDate: '2028-06-30',
      manufacturingDate: '2025-05-01',
      anvisaRegistration: '1058300990019',
      pmc: 45.0,
      isExistingProduct: false,
      cmedWarning: 'Custo unitário (R$ 55,00) excede Preço Máximo ao Consumidor CMED (R$ 45,00)',
    },
  ],
};

const mockInvoiceDetails: PurchaseInvoiceDetails = {
  id: 1,
  accessKey: '35260112345678000195550010000000011000000010',
  invoiceNumber: 101,
  invoiceSeries: 1,
  issueDate: '2026-11-10T10:00:00.000Z',
  supplierCnpj: '12345678000195',
  supplierName: 'DISTRIBUIDORA SANTA CRUZ LTDA',
  supplierIe: '123456789',
  totalInvoiceAmount: 1540.5,
  totalProductsAmount: 1500.0,
  totalIcmsSt: 40.5,
  xmlContent: '<nfeProc></nfeProc>',
  createdAt: '2026-11-10T10:30:00.000Z',
  items: [
    {
      id: 10,
      purchaseInvoiceId: 1,
      productId: 5,
      batchId: 2,
      itemIndex: 1,
      supplierProductCode: 'MED001',
      ean: '7891058001234',
      productName: 'AMOXICILINA 500MG 21 CAPSULAS',
      ncm: '30041011',
      cfop: '5102',
      quantity: 20,
      unitCost: 15.0,
      totalCost: 300.0,
      batchNumber: 'LOTE-AMX-01',
      expirationDate: '2027-12-31',
      manufacturingDate: '2025-01-01',
      anvisaRegistration: '1058300120011',
      pmc: 35.5,
      batch: {
        id: 2,
        batchNumber: 'LOTE-AMX-01',
        manufacturingDate: '2025-01-01',
        expirationDate: '2027-12-31',
        quantity: 20,
      },
    },
  ],
};

describe('PurchasesPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(purchasesApi, 'getInvoices').mockResolvedValue(mockInvoices);
    vi.spyOn(purchasesApi, 'previewXml').mockResolvedValue(mockPreview);
    vi.spyOn(purchasesApi, 'importXml').mockResolvedValue({
      invoiceId: 2,
      accessKey: mockPreview.accessKey,
      batchesCreatedCount: 2,
      productsRegisteredCount: 1,
      totalItems: 2,
    });
    vi.spyOn(purchasesApi, 'getInvoiceById').mockResolvedValue(mockInvoiceDetails);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render XML dropzone and recent invoices table', async () => {
    render(<PurchasesPage />);

    expect(screen.getByText(/Entrada de Notas Fiscais/i)).toBeDefined();
    expect(screen.getByText(/Arraste o arquivo XML da NF-e/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('DISTRIBUIDORA SANTA CRUZ LTDA')).toBeDefined();
      expect(screen.getByText('101 / 1')).toBeDefined();
    });
  });

  it('should upload XML, call previewXml and display preview modal with CMED warning and product badges', async () => {
    render(<PurchasesPage />);

    const sampleXml = '<nfeProc><NFe></NFe></nfeProc>';
    const file = new File([sampleXml], 'nfe-teste.xml', { type: 'text/xml' });
    file.text = () => Promise.resolve(sampleXml);

    const fileInput = screen.getByLabelText(/Selecionar arquivo XML/i, { selector: 'input' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(purchasesApi.previewXml).toHaveBeenCalledWith(sampleXml);
    });

    // Preview modal should be open
    await waitFor(() => {
      expect(screen.getByText(/Conferência de NF-e/i)).toBeDefined();
      expect(screen.getByText(/PANPHARMA DISTRIBUIDORA/i)).toBeDefined();
      expect(screen.getByText(/AMOXICILINA 500MG/i)).toBeDefined();
      expect(screen.getByText(/MEDICAMENTO NOVO ULTRA/i)).toBeDefined();
    });

    // Should indicate existing vs new products
    expect(screen.getByText(/Existente/i)).toBeDefined();
    expect(screen.getByText(/Novo Produto/i)).toBeDefined();

    // Should display CMED warning
    expect(screen.getByText(/Alerta CMED/i)).toBeDefined();
    expect(screen.getByText(/excede Preço Máximo ao Consumidor/i)).toBeDefined();
  });

  it('should confirm entry, call importXml, show success message and refresh invoice list', async () => {
    render(<PurchasesPage />);

    const sampleXml = '<nfeProc><NFe></NFe></nfeProc>';
    const file = new File([sampleXml], 'nfe-teste.xml', { type: 'text/xml' });
    file.text = () => Promise.resolve(sampleXml);

    const fileInput = screen.getByLabelText(/Selecionar arquivo XML/i, { selector: 'input' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(screen.getByText(/Conferência de NF-e/i)).toBeDefined();
    });

    // Toggle auto-register products checkbox
    const autoRegisterCheckbox = screen.getByLabelText(/Cadastrar novos produtos automaticamente/i);
    expect(autoRegisterCheckbox).toBeDefined();

    const confirmBtn = screen.getByRole('button', { name: /Confirmar Entrada|Efetivar Entrada/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(purchasesApi.importXml).toHaveBeenCalledWith(
        expect.objectContaining({
          xmlContent: sampleXml,
          autoRegisterProducts: true,
        })
      );
    });

    // Success alert should appear and getInvoices called again
    await waitFor(() => {
      expect(screen.getByText(/importada com sucesso/i)).toBeDefined();
      expect(purchasesApi.getInvoices).toHaveBeenCalledTimes(2);
    });
  });

  it('should view invoice details when clicking Ver Detalhes', async () => {
    render(<PurchasesPage />);

    await waitFor(() => {
      expect(screen.getByText('DISTRIBUIDORA SANTA CRUZ LTDA')).toBeDefined();
    });

    const detailsBtn = screen.getByRole('button', { name: /Ver Detalhes|Detalhes/i });
    await act(async () => {
      fireEvent.click(detailsBtn);
    });

    await waitFor(() => {
      expect(purchasesApi.getInvoiceById).toHaveBeenCalledWith(1);
      expect(screen.getByText(/Detalhes da Nota Fiscal/i)).toBeDefined();
      expect(screen.getByText('LOTE-AMX-01')).toBeDefined();
      expect(screen.getByText('1058300120011')).toBeDefined();
    });
  });

  it('should allow setting stripe and controlType for new products and pass to importXml', async () => {
    render(<PurchasesPage />);

    const sampleXml = '<nfeProc><NFe></NFe></nfeProc>';
    const file = new File([sampleXml], 'nfe-teste.xml', { type: 'text/xml' });
    file.text = () => Promise.resolve(sampleXml);

    const fileInput = screen.getByLabelText(/Selecionar arquivo XML/i, { selector: 'input' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(screen.getByText(/Conferência de NF-e/i)).toBeDefined();
    });

    const stripeSelect = screen.getByLabelText(/Tarja do item 2/i);
    const controlSelect = screen.getByLabelText(/Tipo de controle do item 2/i);

    await act(async () => {
      fireEvent.change(stripeSelect, { target: { value: 'PRETA' } });
      fireEvent.change(controlSelect, { target: { value: 'A1_AMARELA' } });
    });

    const confirmBtn = screen.getByRole('button', { name: /Confirmar Entrada|Efetivar Entrada/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(purchasesApi.importXml).toHaveBeenCalledWith(
        expect.objectContaining({
          xmlContent: sampleXml,
          autoRegisterProducts: true,
          itemClassifications: expect.objectContaining({
            '7891058009999': {
              stripe: 'PRETA',
              controlType: 'A1_AMARELA',
            },
          }),
        })
      );
    });
  });
});
