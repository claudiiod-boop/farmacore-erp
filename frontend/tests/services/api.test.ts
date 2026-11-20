import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchProducts,
  getProductByEan,
  getAvailableBatches,
  createPreSale,
  setBaseUrl,
  purchasesApi,
  sngpcApi,
  storesApi,
  transfersApi,
  inventoryApi,
} from '../../src/services/api';

describe('API Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setBaseUrl('http://localhost:3000');
  });

  describe('searchProducts', () => {
    it('should query /api/products/search with query string and return products', async () => {
      const mockResult = [{ id: 1, name: 'Paracetamol' }];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      } as unknown as Response);

      const products = await searchProducts('paracetamol');

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3000/api/products/search?q=paracetamol'
      );
      expect(products).toEqual(mockResult);
    });

    it('should throw an error with backend message when search request fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Query inválida' }),
      } as unknown as Response);

      await expect(searchProducts('error')).rejects.toThrow('Query inválida');
    });

    it('should fall back to statusText when search request fails without json body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Not JSON');
        },
      } as unknown as Response);

      await expect(searchProducts('error')).rejects.toThrow(/Falha ao buscar produtos: Internal Server Error/);
    });
  });

  describe('getProductByEan', () => {
    it('should return product when found by EAN', async () => {
      const mockProduct = { id: 2, ean: '7890000000000', name: 'Ibuprofeno' };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockProduct,
      } as unknown as Response);

      const result = await getProductByEan('7890000000000');
      expect(result).toEqual(mockProduct);
    });

    it('should return null when product is not found (404)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
      } as unknown as Response);

      const result = await getProductByEan('0000000000000');
      expect(result).toBeNull();
    });

    it('should throw an error with backend message when EAN request fails with 500', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Error',
        json: async () => ({ message: 'Erro no leitor de código de barras' }),
      } as unknown as Response);

      await expect(getProductByEan('123')).rejects.toThrow('Erro no leitor de código de barras');
    });
  });

  describe('getAvailableBatches', () => {
    it('should query /api/inventory/:productId/batches and return batches', async () => {
      const mockBatches = [
        { id: 10, batchNumber: 'LOTE1', quantity: 50, availableQuantity: 50 },
      ];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockBatches,
      } as unknown as Response);

      const batches = await getAvailableBatches(1);

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3000/api/inventory/1/batches'
      );
      expect(batches).toEqual(mockBatches);
    });

    it('should throw an error with backend message when batches query fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Produto inativo' }),
      } as unknown as Response);

      await expect(getAvailableBatches(99)).rejects.toThrow('Produto inativo');
    });
  });

  describe('createPreSale', () => {
    it('should send POST /api/pre-sales and return created pre-sale', async () => {
      const dto = {
        items: [{ productId: 1, batchId: 10, quantity: 2 }],
      };
      const mockPreSale = { id: 1, code: 'PV-0001', status: 'OPEN', totalAmount: 25.0 };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockPreSale,
      } as unknown as Response);

      const result = await createPreSale(dto);

      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/pre-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      expect(result).toEqual(mockPreSale);
    });

    it('should throw an error with backend message if creation fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Estoque insuficiente' }),
      } as unknown as Response);

      await expect(
        createPreSale({ items: [{ productId: 1, batchId: 1, quantity: 100 }] })
      ).rejects.toThrow('Estoque insuficiente');
    });
  });

  describe('purchasesApi.importXml', () => {
    it('should support object payload with itemClassifications and post to /api/purchases/import-xml', async () => {
      const mockResult = { invoiceId: 1, accessKey: '123', batchesCreatedCount: 1, productsRegisteredCount: 1, totalItems: 1 };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      } as unknown as Response);

      const payload = {
        xmlContent: '<xml></xml>',
        autoRegisterProducts: true,
        itemClassifications: {
          '789000': { stripe: 'VERMELHA', controlType: 'ANTIBIOTICO' },
        },
      };

      const result = await purchasesApi.importXml(payload);

      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/purchases/import-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('sngpcApi.generateWeeklyXml', () => {
    it('should unwrap backend response containing transmission object', async () => {
      const backendResponse = {
        transmission: {
          id: 42,
          startDate: '2026-11-01',
          endDate: '2026-11-07',
          pharmacistName: 'DR. TESTE',
          pharmacistCpf: '12345678901',
          pharmacistCrf: '12345',
          pharmacistCrfUf: 'SP',
          xmlContent: '<mensagemSNGPC></mensagemSNGPC>',
          status: 'GERADO',
          hashXml: 'abcdef1234567890',
        },
        movementsCount: 5,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => backendResponse,
      } as unknown as Response);

      const params = {
        startDate: '2026-11-01',
        endDate: '2026-11-07',
        pharmacistName: 'DR. TESTE',
        pharmacistCpf: '12345678901',
        pharmacistCrf: '12345',
        pharmacistCrfUf: 'SP',
      };

      const result = await sngpcApi.generateWeeklyXml(params);

      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/sngpc/generate-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      expect(result.transmissionId).toBe(42);
      expect(result.movementsCount).toBe(5);
      expect(result.hashXml).toBe('abcdef1234567890');
      expect(result.xmlContent).toBe('<mensagemSNGPC></mensagemSNGPC>');
      expect(result.transmission).toEqual(backendResponse.transmission);
    });
  });

  describe('storesApi', () => {
    it('should query /api/stores and return store list', async () => {
      const mockStores = [{ id: 1, name: 'Loja Matriz' }];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockStores,
      } as unknown as Response);

      const res = await storesApi.getStores();
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/stores');
      expect(res).toEqual(mockStores);
    });

    it('should query /api/stores/network-stock/:productId and return network stock', async () => {
      const mockStock = [{ storeId: 1, storeName: 'Matriz', availableQuantity: 50 }];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockStock,
      } as unknown as Response);

      const res = await storesApi.getNetworkProductStock(10);
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/stores/network-stock/10');
      expect(res).toEqual(mockStock);
    });
  });

  describe('transfersApi', () => {
    it('should query /api/transfers and return transfers', async () => {
      const mockTransfers = { transfers: [{ id: 1, transferNumber: 'TRF-001' }], total: 1 };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockTransfers,
      } as unknown as Response);

      const res = await transfersApi.getTransfers({ status: 'IN_TRANSIT' });
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/transfers?status=IN_TRANSIT');
      expect(res).toEqual(mockTransfers);
    });

    it('should call dispatch transfer endpoint', async () => {
      const mockDispatched = { id: 1, status: 'IN_TRANSIT' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockDispatched,
      } as unknown as Response);

      const res = await transfersApi.dispatchTransfer(1, { dispatchedBy: 'Operador' });
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/transfers/1/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatchedBy: 'Operador' }),
      });
      expect(res).toEqual(mockDispatched);
    });

    it('should query transfer slip endpoint', async () => {
      const mockSlip = { textSlip: 'Romaneio', fullEscPos: '...' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockSlip,
      } as unknown as Response);

      const res = await transfersApi.getTransferSlip(1);
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/transfers/1/slip');
      expect(res).toEqual(mockSlip);
    });
  });

  describe('inventoryApi', () => {
    it('should query /api/inventory/sessions and return sessions', async () => {
      const mockSessions = { sessions: [{ id: 1, sessionCode: 'INV-001' }], total: 1 };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockSessions,
      } as unknown as Response);

      const res = await inventoryApi.getInventorySessions({ status: 'OPEN', inventoryType: 'GERAL' });
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/inventory/sessions?status=OPEN&inventoryType=GERAL');
      expect(res).toEqual(mockSessions);
    });

    it('should get session by id', async () => {
      const mockSession = { id: 1, sessionCode: 'INV-001' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockSession,
      } as unknown as Response);

      const res = await inventoryApi.getInventorySessionById(1);
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/inventory/sessions/1');
      expect(res).toEqual(mockSession);
    });

    it('should create inventory session', async () => {
      const mockCreated = { id: 1, sessionCode: 'INV-001' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockCreated,
      } as unknown as Response);

      const payload = { storeId: 1, inventoryType: 'GERAL' as const, openedBy: 'Auditor' };
      const res = await inventoryApi.createInventorySession(payload);
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/inventory/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      expect(res).toEqual(mockCreated);
    });

    it('should add count item', async () => {
      const mockItem = { id: 10, batchNumber: 'L1', quantity: 5 };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockItem,
      } as unknown as Response);

      const payload = { ean: '789000', batchNumber: 'L1', expirationDate: '2027-12-31', quantity: 5 };
      const res = await inventoryApi.addInventoryCount(1, payload);
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/inventory/sessions/1/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      expect(res).toEqual(mockItem);
    });

    it('should recount item', async () => {
      const mockItem = { id: 10, recountQuantity: 8 };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockItem,
      } as unknown as Response);

      const res = await inventoryApi.recountInventoryItem(1, 10, 8);
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/inventory/sessions/1/items/10/recount', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recountQuantity: 8 }),
      });
      expect(res).toEqual(mockItem);
    });

    it('should finish counting', async () => {
      const mockSession = { id: 1, status: 'COUNTED' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockSession,
      } as unknown as Response);

      const res = await inventoryApi.finishInventoryCount(1);
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/inventory/sessions/1/finish-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res).toEqual(mockSession);
    });

    it('should apply inventory adjustments', async () => {
      const mockSession = { id: 1, status: 'APPLIED' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockSession,
      } as unknown as Response);

      const payload = { appliedBy: 'Farmacêutico RT', responsiblePharmacistCrf: '12345' };
      const res = await inventoryApi.applyInventoryAdjustments(1, payload);
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/inventory/sessions/1/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      expect(res).toEqual(mockSession);
    });

    it('should cancel inventory session', async () => {
      const mockSession = { id: 1, status: 'CANCELLED' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockSession,
      } as unknown as Response);

      const res = await inventoryApi.cancelInventorySession(1, 'Erro de digitação');
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/inventory/sessions/1/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Erro de digitação' }),
      });
      expect(res).toEqual(mockSession);
    });

    it('should get inventory report', async () => {
      const mockReport = { textSlip: 'Parecer', fullEscPos: '...', session: {}, store: {} };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockReport,
      } as unknown as Response);

      const res = await inventoryApi.getInventoryReport(1);
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/api/inventory/sessions/1/report');
      expect(res).toEqual(mockReport);
    });
  });
});
