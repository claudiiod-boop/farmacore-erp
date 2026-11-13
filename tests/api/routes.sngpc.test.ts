import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { Database, getDatabase } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify SNGPC Routes (/api/sngpc/*)', () => {
  let app: FastifyInstance;
  let db: Database;
  let productId: number;
  let batchId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    // Setup pharmacy fiscal profile
    db.prepare(`
      INSERT INTO fiscal_profiles (
        cnpj, ie, razao_social, nome_fantasia, crt, c_uf, municipio, c_mun,
        logradouro, numero, bairro, cep, csc_token, environment
      ) VALUES (
        '12345678000195', '123456789', 'Farmacia FarmaCore LTDA', 'FarmaCore Central',
        1, 35, 'São Paulo', 3550308, 'Av Paulista', '1000', 'Bela Vista',
        '01310100', 'CSC123456', 'HOMOLOGACAO'
      )
    `).run();

    // Create a product
    const prodRun = db.prepare(`
      INSERT INTO products (
        ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active
      ) VALUES (
        '7891234567890', 'Clonazepam 2mg', 'Clonazepam', '1.0043.0021.001-4', 'PRETA', 'PORTARIA_344_B1',
        25.0, 15.0, 22.0, 1
      )
    `).run();
    productId = Number(prodRun.lastInsertRowid);

    // Create a batch
    const batchRun = db.prepare(`
      INSERT INTO batches (
        product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
      ) VALUES (?, 'LOT12345', '2023-01-01', '2025-12-31', 100, 0)
    `).run(productId);
    batchId = Number(batchRun.lastInsertRowid);

    // Seed an entry movement
    db.prepare(`
      INSERT INTO sngpc_movements (
        movement_type, product_id, batch_id, quantity, reference_type,
        reference_id, movement_date, ms_registration, is_transmitted
      ) VALUES ('ENTRADA', ?, ?, 50, 'PURCHASE_INVOICE', 1, '2023-10-10', '1.0043.0021.001-4', 0)
    `).run(productId, batchId);

    // Seed a sale movement
    db.prepare(`
      INSERT INTO sngpc_movements (
        movement_type, product_id, batch_id, quantity, reference_type,
        reference_id, movement_date, ms_registration, is_transmitted
      ) VALUES ('SAIDA_VENDA', ?, ?, 2, 'SALE', 10, '2023-10-15', '1.0043.0021.001-4', 0)
    `).run(productId, batchId);

    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/sngpc/movements', () => {
    it('should return 200 with all movements when no filter is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sngpc/movements',
      });

      expect(response.statusCode).toBe(200);
      const movements = response.json();
      expect(Array.isArray(movements)).toBe(true);
      expect(movements).toHaveLength(2);
    });

    it('should filter movements by movementType', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sngpc/movements?movementType=ENTRADA',
      });

      expect(response.statusCode).toBe(200);
      const movements = response.json();
      expect(movements).toHaveLength(1);
      expect(movements[0].movementType).toBe('ENTRADA');
    });

    it('should filter movements by isTransmitted', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sngpc/movements?isTransmitted=0',
      });

      expect(response.statusCode).toBe(200);
      const movements = response.json();
      expect(movements).toHaveLength(2);
    });

    it('should filter movements by date range and productId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/sngpc/movements?startDate=2023-10-12&endDate=2023-10-20&productId=${productId}`,
      });

      expect(response.statusCode).toBe(200);
      const movements = response.json();
      expect(movements).toHaveLength(1);
      expect(movements[0].movementType).toBe('SAIDA_VENDA');
      expect(movements[0].movementDate).toBe('2023-10-15');
    });
  });

  describe('GET /api/sngpc/livro', () => {
    it('should return 400 when startDate or endDate is missing', async () => {
      const resNoDates = await app.inject({
        method: 'GET',
        url: '/api/sngpc/livro',
      });
      expect(resNoDates.statusCode).toBe(400);
      expect(resNoDates.json().code).toBe('INVALID_DATE_RANGE');

      const resNoEnd = await app.inject({
        method: 'GET',
        url: '/api/sngpc/livro?startDate=2023-10-01',
      });
      expect(resNoEnd.statusCode).toBe(400);
      expect(resNoEnd.json().code).toBe('INVALID_DATE_RANGE');
    });

    it('should return 200 with consolidated Livro de Registro for valid date range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sngpc/livro?startDate=2023-10-01&endDate=2023-10-31',
      });

      expect(response.statusCode).toBe(200);
      const livro = response.json();
      expect(livro.pharmacyCnpj).toBe('12345678000195');
      expect(livro.startDate).toBe('2023-10-01');
      expect(livro.endDate).toBe('2023-10-31');
      expect(livro.openingTerm).toContain('Termo de Abertura');
      expect(livro.closingTerm).toContain('Termo de Encerramento');
      expect(livro.items).toHaveLength(2);
      expect(livro.items[0].movementType).toBe('ENTRADA');
      expect(livro.items[0].entryQuantity).toBe(50);
      expect(livro.items[1].movementType).toBe('SAIDA_VENDA');
      expect(livro.items[1].exitQuantity).toBe(2);
    });
  });

  describe('POST /api/sngpc/generate-xml', () => {
    it('should return 400 when required fields are missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sngpc/generate-xml',
        payload: {
          startDate: '2023-10-01',
          endDate: '2023-10-31',
          // missing pharmacist info
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBeDefined();
    });

    it('should return 201 and generate transmission XML with untransmitted movements', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sngpc/generate-xml',
        payload: {
          startDate: '2023-10-01',
          endDate: '2023-10-31',
          pharmacistName: 'Dra. Maria Farmacêutica',
          pharmacistCpf: '12345678901',
          pharmacistCrf: '12345',
          pharmacistCrfUf: 'SP',
        },
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.movementsCount).toBe(2);
      expect(data.transmission).toBeDefined();
      expect(data.transmission.id).toBeGreaterThan(0);
      expect(data.transmission.status).toBe('GERADO');
      expect(data.transmission.hashXml).toHaveLength(40); // SHA-1

      // Verify movements are marked as transmitted in DB
      const unTransmitted = db
        .prepare('SELECT COUNT(*) as c FROM sngpc_movements WHERE is_transmitted = 0')
        .get() as { c: number };
      expect(unTransmitted.c).toBe(0);
    });
  });

  describe('GET /api/sngpc/transmissions', () => {
    it('should return 200 with list of transmissions', async () => {
      // First generate a transmission
      await app.inject({
        method: 'POST',
        url: '/api/sngpc/generate-xml',
        payload: {
          startDate: '2023-10-01',
          endDate: '2023-10-31',
          pharmacistName: 'Dra. Maria Farmacêutica',
          pharmacistCpf: '12345678901',
          pharmacistCrf: '12345',
          pharmacistCrfUf: 'SP',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/sngpc/transmissions',
      });

      expect(response.statusCode).toBe(200);
      const list = response.json();
      expect(Array.isArray(list)).toBe(true);
      expect(list).toHaveLength(1);
      expect(list[0].pharmacistName).toBe('Dra. Maria Farmacêutica');
    });
  });

  describe('GET /api/sngpc/transmissions/:id/xml', () => {
    it('should return 200 with application/xml header and attachment disposition for valid ID', async () => {
      const genRes = await app.inject({
        method: 'POST',
        url: '/api/sngpc/generate-xml',
        payload: {
          startDate: '2023-10-01',
          endDate: '2023-10-31',
          pharmacistName: 'Dra. Maria Farmacêutica',
          pharmacistCpf: '12345678901',
          pharmacistCrf: '12345',
          pharmacistCrfUf: 'SP',
        },
      });
      const txId = genRes.json().transmission.id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/sngpc/transmissions/${txId}/xml`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/xml');
      expect(response.headers['content-disposition']).toBe(`attachment; filename="mensagemSNGPC-${txId}.xml"`);
      expect(response.body).toContain('<mensagemSNGPC');
      expect(response.body).toContain('</mensagemSNGPC>');
    });

    it('should return 404 for non-existent transmission ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sngpc/transmissions/99999/xml',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe('TRANSMISSION_NOT_FOUND');
    });

    it('should return 400 for non-numeric transmission ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sngpc/transmissions/abc/xml',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('INVALID_ID');
    });
  });
});
