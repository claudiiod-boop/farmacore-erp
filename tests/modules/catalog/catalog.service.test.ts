import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database, getDatabase } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CatalogService } from '../../../src/modules/catalog/catalog.service';
import { CreateProductDTO } from '../../../src/modules/catalog/types';

describe('CatalogService', () => {
  let db: Database;
  let service: CatalogService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new CatalogService(db);
  });

  afterEach(() => {
    db.close();
  });

  const validProductDTO: CreateProductDTO = {
    ean: '7891234567890',
    name: 'Amoxicilina 500mg com 21 Cápsulas',
    activeIngredient: 'Amoxicilina',
    msRegistration: '1.0000.0001.001-1',
    stripe: 'VERMELHA',
    controlType: 'ANTIMICROBIANO',
    pmc: 50.0,
    pf: 35.0,
    price: 45.0,
  };

  describe('createProduct', () => {
    it('should create a pharmaceutical product when price is below or equal to PMC', () => {
      const product = service.createProduct(validProductDTO);

      expect(product).toBeDefined();
      expect(product.id).toBeGreaterThan(0);
      expect(product.ean).toBe('7891234567890');
      expect(product.name).toBe('Amoxicilina 500mg com 21 Cápsulas');
      expect(product.activeIngredient).toBe('Amoxicilina');
      expect(product.msRegistration).toBe('1.0000.0001.001-1');
      expect(product.stripe).toBe('VERMELHA');
      expect(product.controlType).toBe('ANTIMICROBIANO');
      expect(product.pmc).toBe(50.0);
      expect(product.pf).toBe(35.0);
      expect(product.price).toBe(45.0);
      expect(product.isActive).toBe(true);
      expect(typeof product.createdAt).toBe('string');
    });

    it('should allow creating a product when price equals PMC exactly', () => {
      const product = service.createProduct({
        ...validProductDTO,
        ean: '7891234567891',
        price: 50.0,
      });

      expect(product.price).toBe(50.0);
      expect(product.pmc).toBe(50.0);
    });

    it('should throw CMED_PMC_EXCEEDED when price is greater than PMC', () => {
      expect(() => {
        service.createProduct({
          ...validProductDTO,
          price: 50.01,
        });
      }).toThrow('CMED_PMC_EXCEEDED');
    });
  });

  describe('getProductByEan and getProductById', () => {
    it('should find product by EAN', () => {
      const created = service.createProduct(validProductDTO);
      const found = service.getProductByEan('7891234567890');

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.ean).toBe(created.ean);
      expect(found?.name).toBe(created.name);
      expect(found?.activeIngredient).toBe(created.activeIngredient);
      expect(found?.msRegistration).toBe(created.msRegistration);
    });

    it('should return null when searching for non-existent EAN', () => {
      const found = service.getProductByEan('0000000000000');
      expect(found).toBeNull();
    });

    it('should find product by ID', () => {
      const created = service.createProduct(validProductDTO);
      const found = service.getProductById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe(created.name);
    });

    it('should return null when searching for non-existent ID', () => {
      const found = service.getProductById(99999);
      expect(found).toBeNull();
    });
  });

  describe('updateProductPrice', () => {
    it('should update price when new price is within PMC ceiling', () => {
      const created = service.createProduct(validProductDTO);
      const updated = service.updateProductPrice(created.id, 49.9);

      expect(updated.id).toBe(created.id);
      expect(updated.price).toBe(49.9);

      const refreshed = service.getProductById(created.id);
      expect(refreshed?.price).toBe(49.9);
    });

    it('should allow updating price to exactly the PMC ceiling', () => {
      const created = service.createProduct(validProductDTO);
      const updated = service.updateProductPrice(created.id, 50.0);

      expect(updated.price).toBe(50.0);
    });

    it('should throw CMED_PMC_EXCEEDED when new price exceeds PMC ceiling', () => {
      const created = service.createProduct(validProductDTO);

      expect(() => {
        service.updateProductPrice(created.id, 50.01);
      }).toThrow('CMED_PMC_EXCEEDED');

      // Ensure price was not updated
      const refreshed = service.getProductById(created.id);
      expect(refreshed?.price).toBe(45.0);
    });

    it('should throw PRODUCT_NOT_FOUND when updating non-existent product', () => {
      expect(() => {
        service.updateProductPrice(99999, 20.0);
      }).toThrow('PRODUCT_NOT_FOUND');
    });
  });

  describe('searchProducts', () => {
    beforeEach(() => {
      service.createProduct({
        ean: '7891234567890',
        name: 'Amoxicilina 500mg com 21 Cápsulas',
        activeIngredient: 'Amoxicilina Tri-hidratada',
        msRegistration: '1.0000.0001.001-1',
        stripe: 'VERMELHA',
        controlType: 'ANTIMICROBIANO',
        pmc: 50.0,
        pf: 35.0,
        price: 45.0,
      });

      service.createProduct({
        ean: '7899876543210',
        name: 'Dipirona Monoidratada 500mg/ml Gotas 20ml',
        activeIngredient: 'Dipirona Sódica',
        msRegistration: '1.0000.0002.001-2',
        stripe: 'SEM_TARJA',
        controlType: 'ISENTO',
        pmc: 15.0,
        pf: 8.0,
        price: 12.0,
      });

      service.createProduct({
        ean: '7895555555555',
        name: 'Clonazepam 2mg com 30 Comprimidos',
        activeIngredient: 'Clonazepam',
        msRegistration: '1.0000.0003.001-3',
        stripe: 'PRETA',
        controlType: 'B1',
        pmc: 30.0,
        pf: 20.0,
        price: 25.0,
      });
    });

    it('should find product by exact EAN', () => {
      const results = service.searchProducts('7891234567890');
      expect(results).toHaveLength(1);
      expect(results[0].ean).toBe('7891234567890');
    });

    it('should find products by partial name match', () => {
      const results = service.searchProducts('Dipirona');
      expect(results).toHaveLength(1);
      expect(results[0].name).toContain('Dipirona');
    });

    it('should find products by partial active ingredient match', () => {
      const results = service.searchProducts('Tri-hidratada');
      expect(results).toHaveLength(1);
      expect(results[0].activeIngredient).toContain('Tri-hidratada');
    });

    it('should return multiple matches when query matches several products', () => {
      const results = service.searchProducts('mg');
      expect(results.length).toBeGreaterThanOrEqual(3);
    });

    it('should not return inactive products in search results', () => {
      // Inactivate a product in database directly
      db.prepare('UPDATE products SET is_active = 0 WHERE ean = ?').run('7891234567890');

      const results = service.searchProducts('Amoxicilina');
      expect(results).toHaveLength(0);

      // But active products should still be returned
      const dipironaResults = service.searchProducts('Dipirona');
      expect(dipironaResults).toHaveLength(1);
    });
  });
});
