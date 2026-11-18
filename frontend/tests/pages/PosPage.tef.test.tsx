import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import PosPage from '../../src/pages/PosPage';
import { api } from '../../src/services/api';
import type { TefPayResult } from '../../src/types/tef';

describe('PosPage TEF Integration', () => {
  const mockApprovedTef: TefPayResult = {
    success: true,
    transactionUuid: 'uuid-tef-pos-999',
    nsu: '998877',
    hostNsu: '445566',
    authorizationCode: 'AUT999',
    brandName: 'VISA',
    brandCodeSefaz: '01',
    acquirerName: 'CIELO',
    acquirerCnpj: '01027058000191',
    cardLastFour: '9876',
    amount: 50.0,
    installments: 1,
    customerReceipt: '=== VIA CLIENTE ===\nCIELO VISA DEBITO\nDOC/NSU: 998877',
    merchantReceipt: '=== VIA LOJA ===\nCIELO VISA DEBITO\nDOC/NSU: 998877',
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock getCurrentSession
    vi.spyOn(api, 'getCurrentSession').mockResolvedValue({
      id: 1,
      operatorName: 'Operador Teste',
      initialCash: 100.0,
      currentCash: 100.0,
      status: 'OPEN',
      openedAt: new Date().toISOString(),
      closedAt: null,
    });

    // Mock checkoutSale
    vi.spyOn(api, 'checkoutSale').mockResolvedValue({
      sale: {
        id: 77,
        preSaleId: null,
        cashSessionId: 1,
        status: 'COMPLETED',
        totalAmount: 50.0,
        discountAmount: 0,
        changeAmount: 0,
        createdAt: new Date().toISOString(),
        payments: [
          {
            id: 1,
            saleId: 77,
            method: 'CARTAO_DEBITO',
            amount: 50.0,
            createdAt: new Date().toISOString(),
            tefNsu: '998877',
          } as any,
        ],
      },
      receiptText: '=== CUPOM FISCAL ===\nTotal: R$ 50,00',
    });

    // Mock issueNfce
    vi.spyOn(api, 'issueNfce').mockResolvedValue({
      invoice: {
        id: 1,
        saleId: 77,
        chNFe: '35261101027058000191650010000000011928374652',
        nNF: 1,
        serie: 1,
        tpAmb: 2,
        tpEmis: 1,
        status: 'AUTORIZADA',
        protocolNumber: '135260000012345',
        protocolDate: new Date().toISOString(),
        xmlSigned: '<xml/>',
        xmlAuthorized: '<xml/>',
        qrCodeUrl: 'https://sefaz.sp.gov.br/qrcode',
        digestValue: 'abc',
        cStat: 100,
        xMotivo: 'Autorizado',
        cancellationReason: null,
        createdAt: new Date().toISOString(),
      },
      profile: {
        cnpj: '01027058000191',
        ie: '123456789',
        razaoSocial: 'DROGARIA FARMACORE LTDA',
        nomeFantasia: 'FARMACORE',
        crt: 1,
        cUf: 35,
        municipio: 'SAO PAULO',
        cMun: 3550308,
        logradouro: 'RUA PRINCIPAL',
        numero: '100',
        bairro: 'CENTRO',
        cep: '01001000',
        serie: 1,
        nextNnf: 2,
        cscToken: 'token',
        cscId: '000001',
        environment: 'SIMULADOR',
      },
      items: [],
      payments: [{ method: 'CARTAO_DEBITO', amount: 50.0 }],
      taxes: {
        vTotTrib: 0,
        vICMS: 0,
        vICMSST: 0,
        vPIS: 0,
        vCOFINS: 0,
        items: [],
      },
      danfeText: '=== DANFE NFC-e ===',
    });

    // Mock tef pay
    vi.spyOn(api.tef, 'pay').mockResolvedValue(mockApprovedTef);
    vi.spyOn(api.tef, 'getReceipt').mockResolvedValue({
      customerReceipt: mockApprovedTef.customerReceipt,
      merchantReceipt: mockApprovedTef.merchantReceipt,
      fullEscPos: 'FULL ESC POS RECEIPT',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('should trigger TEF PinPad modal from PosPage, approve payment and show TEF receipt in SaleReceiptModal', async () => {
    // Mock product lookup for direct input
    vi.spyOn(api, 'getProductByEan').mockResolvedValue({
      id: 10,
      ean: '7891234567890',
      name: 'Paracetamol 750mg',
      activeIngredient: 'Paracetamol',
      msRegistration: '1000000000000',
      stripe: 'SEM_TARJA',
      controlType: 'ISENTO',
      pmc: 50.0,
      pf: 40.0,
      price: 50.0,
      isActive: true,
      createdAt: '',
    });

    vi.spyOn(api, 'getAvailableBatches').mockResolvedValue([
      {
        id: 20,
        productId: 10,
        batchNumber: 'LOTE-PARAC-01',
        manufacturingDate: '2026-01-01',
        expirationDate: '2027-12-31',
        quantity: 10,
        reservedQuantity: 0,
        availableQuantity: 10,
        createdAt: '',
      },
    ]);

    render(<PosPage />);

    // Wait for session to load
    await waitFor(() => {
      expect(screen.getByText(/CAIXA ABERTO/i)).toBeDefined();
    });

    // Add product to cart directly via scanner input
    const eanInput = screen.getByPlaceholderText(/Bipar código de barras/i);
    fireEvent.change(eanInput, { target: { value: '7891234567890' } });
    fireEvent.submit(eanInput.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Paracetamol 750mg/i)).toBeDefined();
    });

    // Open TEF PinPad modal via pos-tef-button
    const tefHeaderBtn = screen.getByTestId('pos-tef-button');
    fireEvent.click(tefHeaderBtn);

    await waitFor(() => {
      expect(screen.getByText(/Pagamento TEF \/ PinPad/i)).toBeDefined();
    });

    // Start payment on PinPad
    const startTefBtn = screen.getByTestId('start-tef-button');
    fireEvent.click(startTefBtn);

    await waitFor(() => {
      expect(screen.getByText(/Transação Aprovada/i)).toBeDefined();
    });

    // Confirm approved payment
    const confirmApprovedBtn = screen.getByTestId('confirm-approved-button');
    await act(async () => {
      fireEvent.click(confirmApprovedBtn);
    });

    // Should finalize sale and show receipt modal with TEF button
    await waitFor(() => {
      expect(screen.getByTestId('print-tef-receipt-btn')).toBeDefined();
    });

    expect(screen.getByText(/Comprovante TEF \(Cartão\)/i)).toBeDefined();

    // Click TEF receipt button to open TefReceiptModal
    const printTefReceiptBtn = screen.getByTestId('print-tef-receipt-btn');
    fireEvent.click(printTefReceiptBtn);

    await waitFor(() => {
      expect(screen.getByText(/Comprovante de Pagamento TEF \(PinPad\)/i)).toBeDefined();
      expect(screen.getByText(/998877/)).toBeDefined();
    });
  });
});
