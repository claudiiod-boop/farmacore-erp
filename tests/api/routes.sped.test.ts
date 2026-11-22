import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('SPED Fiscal, Sintegra & Bloco H REST API Routes (/api/sped/*)', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    // Configurar loja 1
    db.prepare(`
      UPDATE stores SET
        cnpj = '12345678000199',
        ie = '1122334455',
        company_name = 'DROGARIA CENTRAL LTDA',
        name = 'Drogaria Central',
        phone = '11988887777',
        street = 'Rua das Farmacias',
        number = '500',
        neighborhood = 'Centro',
        city = 'São Paulo',
        state = 'SP',
        zip_code = '01310000',
        email = 'fiscal@central.com.br'
      WHERE id = 1
    `).run();

    // Produtos
    db.prepare(`
      INSERT INTO products (
        id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, ncm, cest, cfop, csosn_icms, cst_pis, cst_cofins
      ) VALUES 
        (1, '789100000001', 'Paracetamol 500mg 20 comp', 'Paracetamol', '100000001', 'SEM_TARJA', 'LIBERADO', 18.00, 8.00, 15.00, '30049099', '1300100', '5405', '500', '04', '04')
    `).run();

    // Lote
    db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (1, 'LOTE-PAR-01', '2025-01-01', '2028-12-31', 100, 1)
    `).run();

    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('Accounting Parameters', () => {
    it('POST /api/sped/parameters should configure accountant details', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sped/parameters',
        payload: {
          storeId: 1,
          accountantName: 'Contador Santos',
          accountantCpf: '123.456.789-00',
          accountantCrc: 'CRC-SP 987654/O',
          spedProfile: 'A',
          spedVersion: '018'
        }
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.id).toBeDefined();
      expect(data.accountantName).toBe('Contador Santos');
    });

    it('GET /api/sped/parameters/:storeId should retrieve accountant details', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/sped/parameters',
        payload: {
          storeId: 1,
          accountantName: 'Contador Santos',
          accountantCpf: '12345678900',
          accountantCrc: 'CRC-SP 987654/O',
          spedProfile: 'A',
          spedVersion: '018'
        }
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/sped/parameters/1'
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.accountantCrc).toBe('CRC-SP 987654/O');
    });
  });

  describe('Audit & Inventory', () => {
    it('POST /api/sped/audit should run PVA audit pre-validation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sped/audit',
        payload: { storeId: 1 }
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.isValid).toBeDefined();
      expect(Array.isArray(data.divergences)).toBe(true);
    });

    it('GET /api/sped/inventory should list Block H physical inventory items', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sped/inventory?storeId=1'
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.totalItems).toBe(1);
      expect(data.totalValue).toBeGreaterThan(0);
      expect(data.items[0].description).toContain('Paracetamol');
    });
  });

  describe('SPED & Sintegra Generation', () => {
    it('POST /api/sped/generate should generate SPED EFD ICMS/IPI with Block H', async () => {
      // 1. Cadastra contador
      await app.inject({
        method: 'POST',
        url: '/api/sped/parameters',
        payload: {
          storeId: 1,
          accountantName: 'Contador Santos',
          accountantCpf: '12345678900',
          accountantCrc: 'CRC-SP 987654/O',
          spedProfile: 'A',
          spedVersion: '018'
        }
      });

      // 2. Gera SPED
      const res = await app.inject({
        method: 'POST',
        url: '/api/sped/generate',
        payload: {
          storeId: 1,
          generationType: 'SPED_EFD',
          periodStart: '2026-05-01',
          periodEnd: '2026-05-31',
          purpose: 0,
          includeInventory: true,
          inventoryDate: '2026-05-31',
          notes: 'Fechamento Fiscal Maio/2026'
        }
      });

      expect(res.statusCode).toBe(201);
      const record = JSON.parse(res.body);
      expect(record.id).toBeGreaterThan(0);
      expect(record.fileName).toContain('SPED_EFD_');
      expect(record.fileContent).toContain('|0000|');
      expect(record.fileContent).toContain('|9999|');

      // 3. Testa Download
      const dlRes = await app.inject({
        method: 'GET',
        url: `/api/sped/download/${record.id}`
      });
      expect(dlRes.statusCode).toBe(200);
      expect(dlRes.headers['content-type']).toContain('text/plain');

      // 4. Testa Comprovante Térmico ESC/POS
      const printRes = await app.inject({
        method: 'GET',
        url: `/api/sped/print/${record.id}`
      });
      expect(printRes.statusCode).toBe(200);
      const printData = JSON.parse(printRes.body);
      expect(printData.slipText).toContain('DEMONSTRATIVO DE FECHAMENTO FISCAL');
    });

    it('POST /api/sped/generate should generate Sintegra file', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sped/generate',
        payload: {
          storeId: 1,
          generationType: 'SINTEGRA',
          periodStart: '2026-05-01',
          periodEnd: '2026-05-31',
          purpose: 0,
          includeInventory: true
        }
      });

      expect(res.statusCode).toBe(201);
      const record = JSON.parse(res.body);
      expect(record.fileName).toContain('SINTEGRA_');
      expect(record.generationType).toBe('SINTEGRA');
    });

    it('GET /api/sped/history should return generation history', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sped/history?storeId=1'
      });

      expect(res.statusCode).toBe(200);
      const list = JSON.parse(res.body);
      expect(Array.isArray(list)).toBe(true);
    });
  });
});
