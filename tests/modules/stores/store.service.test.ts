import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { StoreService } from '../../../src/modules/stores/store.service';
import type { CreateStoreInput, UpdateStoreInput } from '../../../src/modules/stores/types';

describe('StoreService', () => {
  let db: Database;
  let service: StoreService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new StoreService(db);
  });

  afterEach(() => {
    db.close();
  });

  const sampleStoreInput: CreateStoreInput = {
    code: 'LJ02',
    name: 'FarmaCore Filial Jardins',
    companyName: 'Drogaria FarmaCore Ltda',
    cnpj: '12.345.678/0002-71',
    ie: '987654321',
    isHeadquarters: false,
    phone: '11988880002',
    email: 'jardins@farmacore.com.br',
    street: 'Rua Augusta',
    number: '1500',
    neighborhood: 'Cerqueira César',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01412-000',
    ibgeCode: '3550308',
    taxRegime: 'SIMPLES_NACIONAL',
    isActive: true,
  };

  describe('listStores', () => {
    it('should list all stores ordered by is_headquarters DESC, id ASC', () => {
      // Store 1 is Matriz from migration seed
      service.createStore(sampleStoreInput);
      service.createStore({
        ...sampleStoreInput,
        code: 'LJ03',
        cnpj: '12.345.678/0003-52',
        name: 'FarmaCore Filial Pinheiros',
        isActive: false,
      });

      const allStores = service.listStores();
      expect(allStores.length).toBe(3);
      expect(allStores[0].id).toBe(1);
      expect(allStores[0].isHeadquarters).toBe(true);
      expect(allStores[1].code).toBe('LJ02');
      expect(allStores[2].code).toBe('LJ03');
    });

    it('should list only active stores when activeOnly filter is provided', () => {
      service.createStore(sampleStoreInput);
      service.createStore({
        ...sampleStoreInput,
        code: 'LJ03',
        cnpj: '12.345.678/0003-52',
        name: 'FarmaCore Filial Inativa',
        isActive: false,
      });

      const activeStores = service.listStores({ activeOnly: true });
      expect(activeStores.length).toBe(2);
      expect(activeStores.some((s) => s.code === 'LJ03')).toBe(false);
      expect(activeStores.every((s) => s.isActive)).toBe(true);
    });
  });

  describe('getStoreById', () => {
    it('should return store by id with camelCase and compatibility fields', () => {
      const store = service.getStoreById(1);
      expect(store).not.toBeNull();
      expect(store?.id).toBe(1);
      expect(store?.code).toBe('LJ01');
      expect(store?.name).toBe('FarmaCore Matriz Centro');
      expect(store?.companyName).toBe('Drogaria FarmaCore Ltda');
      expect(store?.cnpj).toBe('12.345.678/0001-90');
      expect(store?.isHeadquarters).toBe(true);
      expect(store?.city).toBe('São Paulo');
      expect(store?.state).toBe('SP');
      expect(store?.taxRegime).toBe('SIMPLES_NACIONAL');
      expect(store?.isActive).toBe(true);
    });

    it('should return null when store does not exist', () => {
      const store = service.getStoreById(999);
      expect(store).toBeNull();
    });
  });

  describe('createStore', () => {
    it('should successfully create a store and return it', () => {
      const created = service.createStore(sampleStoreInput);
      expect(created.id).toBeGreaterThan(1);
      expect(created.code).toBe('LJ02');
      expect(created.name).toBe('FarmaCore Filial Jardins');
      expect(created.isHeadquarters).toBe(false);

      const fetched = service.getStoreById(created.id);
      expect(fetched).toEqual(created);
    });

    it('should support snake_case property inputs', () => {
      const created = service.createStore({
        code: 'LJ04',
        name: 'FarmaCore Filial Moema',
        company_name: 'Drogaria FarmaCore Ltda',
        cnpj: '12.345.678/0004-33',
        ie: '112233445',
        street: 'Av. Moema',
        number: '300',
        neighborhood: 'Moema',
        city: 'São Paulo',
        state: 'SP',
        zip_code: '04077-020',
        ibge_code: '3550308',
      } as any);

      expect(created.code).toBe('LJ04');
      expect(created.companyName).toBe('Drogaria FarmaCore Ltda');
      expect(created.zipCode).toBe('04077-020');
      expect(created.ibgeCode).toBe('3550308');
    });

    it('should throw error when required fields are missing', () => {
      expect(() => {
        service.createStore({ ...sampleStoreInput, code: '' });
      }).toThrow(/obrigatório|code/i);

      expect(() => {
        service.createStore({ ...sampleStoreInput, cnpj: '' });
      }).toThrow(/obrigatório|cnpj/i);

      expect(() => {
        service.createStore({ ...sampleStoreInput, street: '' });
      }).toThrow(/obrigatório|street|endereço/i);
    });

    it('should throw error when CNPJ is duplicate', () => {
      expect(() => {
        service.createStore({
          ...sampleStoreInput,
          cnpj: '12.345.678/0001-90', // CNPJ of Store 1
        });
      }).toThrow(/CNPJ já cadastrado/i);
    });

    it('should throw error when code is duplicate', () => {
      expect(() => {
        service.createStore({
          ...sampleStoreInput,
          code: 'LJ01', // Code of Store 1
        });
      }).toThrow(/código.*já cadastrado/i);
    });

    it('should throw error when trying to create another active headquarters', () => {
      expect(() => {
        service.createStore({
          ...sampleStoreInput,
          isHeadquarters: true,
        });
      }).toThrow(/Já existe uma loja definida como Matriz/i);
    });
  });

  describe('updateStore', () => {
    it('should throw error if store to update does not exist', () => {
      expect(() => {
        service.updateStore(999, { name: 'Inexistente' });
      }).toThrow(/Loja não encontrada/i);
    });

    it('should update store fields including address, tax regime and status', () => {
      const created = service.createStore(sampleStoreInput);

      const updated = service.updateStore(created.id, {
        name: 'FarmaCore Jardins Prime',
        street: 'Alameda Santos',
        number: '2000',
        taxRegime: 'LUCRO_PRESUMIDO',
        isActive: false,
      });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe('FarmaCore Jardins Prime');
      expect(updated.street).toBe('Alameda Santos');
      expect(updated.number).toBe('2000');
      expect(updated.taxRegime).toBe('LUCRO_PRESUMIDO');
      expect(updated.isActive).toBe(false);

      const refetched = service.getStoreById(created.id);
      expect(refetched?.name).toBe('FarmaCore Jardins Prime');
      expect(refetched?.isActive).toBe(false);
    });

    it('should throw error when updating code or CNPJ to already existing values of another store', () => {
      const created = service.createStore(sampleStoreInput);

      // Attempt duplicate code
      expect(() => {
        service.updateStore(created.id, { code: 'LJ01' });
      }).toThrow(/código.*já cadastrado/i);

      // Attempt duplicate CNPJ
      expect(() => {
        service.updateStore(created.id, { cnpj: '12.345.678/0001-90' });
      }).toThrow(/CNPJ já cadastrado/i);
    });

    it('should allow updating existing headquarters without triggering headquarters conflict', () => {
      const updatedHeadquarters = service.updateStore(1, {
        name: 'FarmaCore Matriz Renomeada',
        isHeadquarters: true,
      });

      expect(updatedHeadquarters.name).toBe('FarmaCore Matriz Renomeada');
      expect(updatedHeadquarters.isHeadquarters).toBe(true);
    });

    it('should throw error when setting a branch as headquarters when one already exists', () => {
      const created = service.createStore(sampleStoreInput);

      expect(() => {
        service.updateStore(created.id, { isHeadquarters: true });
      }).toThrow(/Já existe uma loja definida como Matriz/i);
    });
  });

  describe('getNetworkProductStock', () => {
    beforeEach(() => {
      // Create product in products table
      db.prepare(`
        INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
        VALUES (1, '7891234567890', 'Dipirona 500mg 10 comprimidos', 'Dipirona Sódica', '1.0000.0000', 'SEM_TARJA', 'NAO_CONTROLADO', 15.0, 10.0, 12.0)
      `).run();

      // Create Store 2 and Store 3
      service.createStore(sampleStoreInput); // id 2
      service.createStore({
        ...sampleStoreInput,
        code: 'LJ03',
        cnpj: '12.345.678/0003-52',
        name: 'FarmaCore Filial Moema',
        city: 'São Paulo',
      }); // id 3

      // Create Store 4 (inactive)
      service.createStore({
        ...sampleStoreInput,
        code: 'LJ04',
        cnpj: '12.345.678/0004-33',
        name: 'FarmaCore Filial Inativa',
        isActive: false,
      }); // id 4
    });

    it('should return inventory aggregation for all active stores and exclude expired batches', () => {
      const futureDate1 = '2027-06-30';
      const futureDate2 = '2027-03-31';
      const pastDate = '2020-01-01';

      // Store 1:
      // Batch 1: qty 50, reserved 10, valid
      // Batch 2: qty 20, reserved 5, valid (earlier expiry)
      // Batch 3: qty 10, reserved 0, expired
      db.prepare(`
        INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity, store_id)
        VALUES (1, 'LOTE-A1', '2025-01-01', ?, 50, 10, 1)
      `).run(futureDate1);

      db.prepare(`
        INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity, store_id)
        VALUES (1, 'LOTE-A2', '2025-01-01', ?, 20, 5, 1)
      `).run(futureDate2);

      db.prepare(`
        INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity, store_id)
        VALUES (1, 'LOTE-A3', '2019-01-01', ?, 10, 0, 1)
      `).run(pastDate);

      // Store 2:
      // Batch 4: qty 100, reserved 0, valid
      db.prepare(`
        INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity, store_id)
        VALUES (1, 'LOTE-B1', '2025-01-01', '2028-12-31', 100, 0, 2)
      `).run();

      // Store 3: has 0 batches

      // Store 4 (inactive): has 30 units, but should not appear
      db.prepare(`
        INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity, store_id)
        VALUES (1, 'LOTE-INACTIVE', '2025-01-01', '2028-12-31', 30, 0, 4)
      `).run();

      const networkStock = service.getNetworkProductStock(1);

      // Inactive store 4 must not be in the list
      expect(networkStock.some((s) => s.storeId === 4)).toBe(false);

      // Active stores 1, 2, 3 must be present
      expect(networkStock.length).toBe(3);

      const store1Stock = networkStock.find((s) => s.storeId === 1)!;
      expect(store1Stock).toBeDefined();
      expect(store1Stock.storeCode).toBe('LJ01');
      expect(store1Stock.storeName).toBe('FarmaCore Matriz Centro');
      expect(store1Stock.isHeadquarters).toBe(true);
      expect(store1Stock.totalQuantity).toBe(70); // 50 + 20 (expired excluded)
      expect(store1Stock.reservedQuantity).toBe(15); // 10 + 5
      expect(store1Stock.availableQuantity).toBe(55); // 70 - 15
      expect(store1Stock.earliestExpiry).toBe(futureDate2);
      expect(store1Stock.batchCount).toBe(2);

      const store2Stock = networkStock.find((s) => s.storeId === 2)!;
      expect(store2Stock).toBeDefined();
      expect(store2Stock.totalQuantity).toBe(100);
      expect(store2Stock.reservedQuantity).toBe(0);
      expect(store2Stock.availableQuantity).toBe(100);
      expect(store2Stock.earliestExpiry).toBe('2028-12-31');
      expect(store2Stock.batchCount).toBe(1);

      const store3Stock = networkStock.find((s) => s.storeId === 3)!;
      expect(store3Stock).toBeDefined();
      expect(store3Stock.totalQuantity).toBe(0);
      expect(store3Stock.reservedQuantity).toBe(0);
      expect(store3Stock.availableQuantity).toBe(0);
      expect(store3Stock.earliestExpiry).toBeNull();
      expect(store3Stock.batchCount).toBe(0);

      // Stores with stock should appear first
      expect(networkStock[0].availableQuantity).toBeGreaterThan(0);
      expect(networkStock[1].availableQuantity).toBeGreaterThan(0);
      expect(networkStock[2].availableQuantity).toBe(0);
    });
  });
});
