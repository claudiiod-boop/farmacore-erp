import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchProducts,
  getProductByEan,
  getAvailableBatches,
  createPreSale,
  setBaseUrl,
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
      } as Response);

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
      } as Response);

      await expect(searchProducts('error')).rejects.toThrow('Query inválida');
    });

    it('should fall back to statusText when search request fails without json body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Not JSON');
        },
      } as Response);

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
      } as Response);

      const result = await getProductByEan('7890000000000');
      expect(result).toEqual(mockProduct);
    });

    it('should return null when product is not found (404)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const result = await getProductByEan('0000000000000');
      expect(result).toBeNull();
    });

    it('should throw an error with backend message when EAN request fails with 500', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Error',
        json: async () => ({ message: 'Erro no leitor de código de barras' }),
      } as Response);

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
      } as Response);

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
      } as Response);

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
      } as Response);

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
      } as Response);

      await expect(
        createPreSale({ items: [{ productId: 1, batchId: 1, quantity: 100 }] })
      ).rejects.toThrow('Estoque insuficiente');
    });
  });
});
