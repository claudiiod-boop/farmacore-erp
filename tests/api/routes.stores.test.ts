import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Store REST API Routes (/api/stores/*)', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/stores', () => {
    it('should list all stores including default seeded headquarters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/stores',
      });

      expect(res.statusCode).toBe(200);
      const stores = JSON.parse(res.body);
      expect(Array.isArray(stores)).toBe(true);
      expect(stores.length).toBeGreaterThanOrEqual(1);

      const hq = stores.find((s: any) => s.id === 1);
      expect(hq).toBeDefined();
      expect(hq.code).toBe('LJ01');
      expect(hq.isHeadquarters).toBe(true);
    });

    it('should filter stores by active status when activeOnly=true', async () => {
      // Create an inactive store directly
      db.prepare(`
        INSERT INTO stores (
          code, name, company_name, cnpj, ie, is_headquarters, phone, email,
          street, number, neighborhood, city, state, zip_code, ibge_code,
          tax_regime, is_active
        ) VALUES (
          'LJ99', 'Loja Inativa', 'Empresa Inativa Ltda', '99.888.777/0001-66', 'ISENTO',
          0, null, null, 'Rua X', '10', 'Bairro', 'São Paulo', 'SP', '01001-000', '3550308',
          'SIMPLES_NACIONAL', 0
        )
      `).run();

      const resAll = await app.inject({
        method: 'GET',
        url: '/api/stores',
      });
      const allStores = JSON.parse(resAll.body);
      expect(allStores.some((s: any) => s.code === 'LJ99')).toBe(true);

      const resActive = await app.inject({
        method: 'GET',
        url: '/api/stores?activeOnly=true',
      });
      expect(resActive.statusCode).toBe(200);
      const activeStores = JSON.parse(resActive.body);
      expect(activeStores.some((s: any) => s.code === 'LJ99')).toBe(false);
    });
  });

  describe('GET /api/stores/:id', () => {
    it('should return store by ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/stores/1',
      });

      expect(res.statusCode).toBe(200);
      const store = JSON.parse(res.body);
      expect(store.id).toBe(1);
      expect(store.code).toBe('LJ01');
    });

    it('should return 404 when store does not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/stores/9999',
      });

      expect(res.statusCode).toBe(404);
      const data = JSON.parse(res.body);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for non-numeric ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/stores/invalid-id',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/stores', () => {
    const validBranchPayload = {
      code: 'LJ02',
      name: 'FarmaCore Filial Campinas',
      companyName: 'FarmaCore Drogarias Ltda',
      cnpj: '12.345.678/0002-71',
      ie: '244.555.666.777',
      isHeadquarters: false,
      phone: '(19) 3333-4444',
      email: 'filial2@farmacore.com.br',
      street: 'Av. Francisco Glicério',
      number: '1234',
      neighborhood: 'Centro',
      city: 'Campinas',
      state: 'SP',
      zipCode: '13012-000',
      ibgeCode: '3509502',
      taxRegime: 'LUCRO_PRESUMIDO',
      isActive: true,
    };

    it('should create new branch store and return 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/stores',
        payload: validBranchPayload,
      });

      expect(res.statusCode).toBe(201);
      const created = JSON.parse(res.body);
      expect(created.id).toBeGreaterThan(1);
      expect(created.code).toBe('LJ02');
      expect(created.name).toBe('FarmaCore Filial Campinas');
      expect(created.isHeadquarters).toBe(false);
    });

    it('should also accept snake_case field aliases and return 201', async () => {
      const snakePayload = {
        code: 'LJ03',
        name: 'FarmaCore Filial Ribeirão',
        company_name: 'FarmaCore Drogarias Ltda',
        cnpj: '12.345.678/0003-52',
        ie: '244.555.666.888',
        is_headquarters: false,
        street: 'Rua General Osório',
        number: '500',
        neighborhood: 'Centro',
        city: 'Ribeirão Preto',
        state: 'SP',
        zip_code: '14010-000',
        ibge_code: '3543402',
        tax_regime: 'SIMPLES_NACIONAL',
        is_active: true,
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/stores',
        payload: snakePayload,
      });

      expect(res.statusCode).toBe(201);
      const created = JSON.parse(res.body);
      expect(created.code).toBe('LJ03');
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/stores',
        payload: {
          code: 'LJ99',
          // missing name, cnpj, street, etc.
        },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toBeDefined();
    });

    it('should return 409 when CNPJ is duplicate', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/stores',
        payload: {
          ...validBranchPayload,
          code: 'LJ99',
          cnpj: '12.345.678/0001-90', // CNPJ of Matriz (LJ01)
        },
      });

      expect(res.statusCode).toBe(409);
      const data = JSON.parse(res.body);
      expect(data.message || data.error).toContain('CNPJ');
    });

    it('should return 409 when store code is duplicate', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/stores',
        payload: {
          ...validBranchPayload,
          code: 'LJ01', // code of Matriz
          cnpj: '99.999.999/0001-99',
        },
      });

      expect(res.statusCode).toBe(409);
      const data = JSON.parse(res.body);
      expect(data.message || data.error).toContain('Código de loja');
    });

    it('should return 409 when attempting to create a second headquarters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/stores',
        payload: {
          ...validBranchPayload,
          code: 'LJ98',
          cnpj: '88.888.888/0001-88',
          isHeadquarters: true,
        },
      });

      expect(res.statusCode).toBe(409);
      const data = JSON.parse(res.body);
      expect(data.message || data.error).toContain('Matriz');
    });
  });

  describe('PUT /api/stores/:id', () => {
    it('should update store details and return 200', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/stores/1',
        payload: {
          name: 'FarmaCore Matriz Centro Atualizada',
          phone: '(11) 99999-8888',
        },
      });

      expect(res.statusCode).toBe(200);
      const updated = JSON.parse(res.body);
      expect(updated.id).toBe(1);
      expect(updated.name).toBe('FarmaCore Matriz Centro Atualizada');
      expect(updated.phone).toBe('(11) 99999-8888');
    });

    it('should return 404 when updating non-existent store', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/stores/9999',
        payload: {
          name: 'Fantasma',
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 409 when updating code to one that conflicts with another store', async () => {
      // First create LJ02
      await app.inject({
        method: 'POST',
        url: '/api/stores',
        payload: {
          code: 'LJ02',
          name: 'Filial 2',
          companyName: 'FarmaCore',
          cnpj: '22.222.222/0001-22',
          ie: '123',
          street: 'Rua A',
          number: '1',
          neighborhood: 'B',
          city: 'C',
          state: 'SP',
          zipCode: '00000-000',
          ibgeCode: '3550308',
        },
      });

      // Try updating LJ02's code to LJ01
      const res = await app.inject({
        method: 'PUT',
        url: '/api/stores/2',
        payload: {
          code: 'LJ01',
        },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe('GET /api/stores/network-stock/:productId', () => {
    it('should return aggregated stock across stores for a product', async () => {
      // Create a test product
      const prodResult = db.prepare(`
        INSERT INTO products (name, ean, ncm, pmc, pf, control_type, active_ingredient, ms_registration, stripe, price, is_active)
        VALUES ('Amoxicilina 500mg', '7891234567890', '30041010', 45.0, 30.0, 'ANTIBIOTICO', 'Amoxicilina', '100000001', 'VERMELHA', 35.0, 1)
      `).run();
      const productId = Number(prodResult.lastInsertRowid);

      // Create branch 2
      const branchRes = await app.inject({
        method: 'POST',
        url: '/api/stores',
        payload: {
          code: 'LJ02',
          name: 'Filial 2',
          companyName: 'FarmaCore',
          cnpj: '33.333.333/0001-33',
          ie: '123',
          street: 'Rua A',
          number: '1',
          neighborhood: 'B',
          city: 'Campinas',
          state: 'SP',
          zipCode: '00000-000',
          ibgeCode: '3509502',
        },
      });
      const branch2 = JSON.parse(branchRes.body);

      // Add batch to Matriz (Store 1)
      const futureDate = '2028-12-31';
      db.prepare(`
        INSERT INTO batches (store_id, product_id, batch_number, expiration_date, manufacturing_date, quantity, reserved_quantity)
        VALUES (1, ?, 'LOTE-HQ-1', ?, '2024-01-01', 50, 10)
      `).run(productId, futureDate);

      // Add batch to Branch 2
      db.prepare(`
        INSERT INTO batches (store_id, product_id, batch_number, expiration_date, manufacturing_date, quantity, reserved_quantity)
        VALUES (?, ?, 'LOTE-B2-1', ?, '2024-01-01', 100, 5)
      `).run(branch2.id, productId, futureDate);

      const res = await app.inject({
        method: 'GET',
        url: `/api/stores/network-stock/${productId}`,
      });

      expect(res.statusCode).toBe(200);
      const stockList = JSON.parse(res.body);
      expect(Array.isArray(stockList)).toBe(true);
      expect(stockList.length).toBeGreaterThanOrEqual(2);

      const hqStock = stockList.find((s: any) => s.storeId === 1);
      expect(hqStock).toBeDefined();
      expect(hqStock.totalQuantity).toBe(50);
      expect(hqStock.reservedQuantity).toBe(10);
      expect(hqStock.availableQuantity).toBe(40);

      const b2Stock = stockList.find((s: any) => s.storeId === branch2.id);
      expect(b2Stock).toBeDefined();
      expect(b2Stock.totalQuantity).toBe(100);
      expect(b2Stock.availableQuantity).toBe(95);
    });

    it('should return 400 for invalid product ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/stores/network-stock/not-a-number',
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
