import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { Database, getDatabase } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fiscal Fastify REST API (/api/fiscal/*)', () => {
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

  const sampleProfile = {
    cnpj: '12.345.678/0001-90',
    ie: '123.456.789.111',
    razaoSocial: 'DROGARIA POPULAR FARMACORE LTDA',
    nomeFantasia: 'DROGARIA POPULAR',
    crt: 1,
    cUf: 35,
    municipio: 'São Paulo',
    cMun: 3550308,
    logradouro: 'Av. Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    cep: '01310-100',
    serie: 1,
    nextNnf: 1,
    cscToken: 'TEST-TOKEN-123456',
    cscId: '000001',
    environment: 'HOMOLOGACAO' as const,
  };

  function seedSale(options?: { customerCpf?: string | null }): number {
    const productResult = db
      .prepare(
        `INSERT INTO products (
          ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price,
          ncm, cest, cfop, csosn_icms, cst_pis, cst_cofins, origin
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        '7891234567890',
        'Dipirona 500mg 10 comprimidos',
        'Dipirona',
        '100000001',
        'SEM_TARJA',
        'LIBERADO',
        15.0,
        7.0,
        10.0,
        '30049099',
        '1300100',
        '5405',
        '500',
        '04',
        '04',
        0
      );
    const productId = Number(productResult.lastInsertRowid);

    const batchResult = db
      .prepare(
        `INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(productId, 'LOTE123', '2026-01-01', '2027-12-31', 100);
    const batchId = Number(batchResult.lastInsertRowid);

    const preSaleResult = db
      .prepare(
        `INSERT INTO pre_sales (code, status, customer_name, customer_cpf, total_amount)
         VALUES (?, 'CLOSED', ?, ?, ?)`
      )
      .run('PV-001-' + Math.random(), 'Cliente Teste', options?.customerCpf ?? '123.456.789-00', 20.0);
    const preSaleId = Number(preSaleResult.lastInsertRowid);

    const saleResult = db
      .prepare(
        `INSERT INTO sales (pre_sale_id, status, total_amount, discount_amount, change_amount)
         VALUES (?, 'COMPLETED', ?, ?, ?)`
      )
      .run(preSaleId, 20.0, 0, 5.0);
    const saleId = Number(saleResult.lastInsertRowid);

    db.prepare(
      `INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(saleId, productId, batchId, 2, 10.0, 20.0);

    db.prepare(
      `INSERT INTO sale_payments (sale_id, method, amount)
       VALUES (?, ?, ?)`
    ).run(saleId, 'CASH', 25.0);

    return saleId;
  }

  describe('Fiscal Profile Endpoints', () => {
    it('GET /api/fiscal/profile should return 200 with null when not configured', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/fiscal/profile',
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json === null || json.profile === null).toBe(true);
    });

    it('PUT /api/fiscal/profile should save and return updated profile', async () => {
      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/fiscal/profile',
        payload: sampleProfile,
      });

      expect(putRes.statusCode).toBe(200);
      const putJson = JSON.parse(putRes.body);
      expect(putJson.cnpj).toBe('12.345.678/0001-90');
      expect(putJson.razaoSocial).toBe('DROGARIA POPULAR FARMACORE LTDA');

      const getRes = await app.inject({
        method: 'GET',
        url: '/api/fiscal/profile',
      });

      expect(getRes.statusCode).toBe(200);
      const getJson = JSON.parse(getRes.body);
      expect(getJson.cnpj).toBe('12.345.678/0001-90');
    });
  });

  describe('NFC-e Issuance (POST /api/fiscal/nfce/issue)', () => {
    it('should return 400 when fiscal profile is not configured', async () => {
      const saleId = seedSale();
      const res = await app.inject({
        method: 'POST',
        url: '/api/fiscal/nfce/issue',
        payload: { saleId },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('FISCAL_PROFILE_NOT_CONFIGURED');
    });

    it('should return 404 when sale does not exist', async () => {
      await app.inject({
        method: 'PUT',
        url: '/api/fiscal/profile',
        payload: sampleProfile,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/fiscal/nfce/issue',
        payload: { saleId: 999999 },
      });

      expect(res.statusCode).toBe(404);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('SALE_NOT_FOUND');
    });

    it('should return 400 when saleId is invalid or missing', async () => {
      await app.inject({
        method: 'PUT',
        url: '/api/fiscal/profile',
        payload: sampleProfile,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/fiscal/nfce/issue',
        payload: { saleId: -1 },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should successfully issue normal NFC-e for a completed sale', async () => {
      await app.inject({
        method: 'PUT',
        url: '/api/fiscal/profile',
        payload: sampleProfile,
      });

      const saleId = seedSale();

      const res = await app.inject({
        method: 'POST',
        url: '/api/fiscal/nfce/issue',
        payload: { saleId },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.invoice).toBeDefined();
      expect(json.invoice.status).toBe('AUTORIZADA');
      expect(json.invoice.protocolNumber).toBeDefined();
      expect(json.invoice.chNFe).toHaveLength(44);
      expect(json.danfeText).toContain('DANFE NFC-e');
      expect(json.invoice.qrCodeUrl).toBeDefined();
      expect(json.items).toHaveLength(1);
      expect(json.payments).toHaveLength(1);
      expect(json.taxes).toBeDefined();
    });

    it('should successfully issue offline contingency NFC-e', async () => {
      await app.inject({
        method: 'PUT',
        url: '/api/fiscal/profile',
        payload: sampleProfile,
      });

      const saleId = seedSale();

      const res = await app.inject({
        method: 'POST',
        url: '/api/fiscal/nfce/issue',
        payload: { saleId, offlineContingency: true },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.invoice.status).toBe('CONTINGENCIA');
      expect(json.invoice.tpEmis).toBe(9);
      expect(json.danfeText).toContain('EMITIDA EM CONTINGÊNCIA');
    });

    it('should reject duplicate issuance for the same sale', async () => {
      await app.inject({
        method: 'PUT',
        url: '/api/fiscal/profile',
        payload: sampleProfile,
      });

      const saleId = seedSale();

      const firstRes = await app.inject({
        method: 'POST',
        url: '/api/fiscal/nfce/issue',
        payload: { saleId },
      });
      expect(firstRes.statusCode).toBe(201);

      const secondRes = await app.inject({
        method: 'POST',
        url: '/api/fiscal/nfce/issue',
        payload: { saleId },
      });
      expect(secondRes.statusCode).toBe(400);
      const json = JSON.parse(secondRes.body);
      expect(json.error).toBe('NFCE_ALREADY_ISSUED');
    });
  });

  describe('NFC-e Retrieval Endpoints', () => {
    it('GET /api/fiscal/nfce/:saleId should return 404 if NFC-e not found', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/fiscal/nfce/999999',
      });

      expect(res.statusCode).toBe(404);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('NFCE_NOT_FOUND');
    });

    it('GET /api/fiscal/nfce/:saleId should return 200 with details for issued NFC-e', async () => {
      await app.inject({
        method: 'PUT',
        url: '/api/fiscal/profile',
        payload: sampleProfile,
      });

      const saleId = seedSale();
      await app.inject({
        method: 'POST',
        url: '/api/fiscal/nfce/issue',
        payload: { saleId },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/fiscal/nfce/${saleId}`,
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.invoice).toBeDefined();
      expect(json.invoice.saleId).toBe(saleId);
      expect(json.danfeText).toBeDefined();
    });

    it('GET /api/fiscal/nfce/:saleId/xml should return raw XML with application/xml header', async () => {
      await app.inject({
        method: 'PUT',
        url: '/api/fiscal/profile',
        payload: sampleProfile,
      });

      const saleId = seedSale();
      await app.inject({
        method: 'POST',
        url: '/api/fiscal/nfce/issue',
        payload: { saleId },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/fiscal/nfce/${saleId}/xml`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/xml');
      expect(res.body).toContain('<NFe');
    });

    it('GET /api/fiscal/nfce/:saleId/xml should return 404 for non-existent sale', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/fiscal/nfce/999999/xml',
      });

      expect(res.statusCode).toBe(404);
    });

    it('GET /api/fiscal/nfce/:saleId/danfe should return plain text with text/plain header', async () => {
      await app.inject({
        method: 'PUT',
        url: '/api/fiscal/profile',
        payload: sampleProfile,
      });

      const saleId = seedSale();
      await app.inject({
        method: 'POST',
        url: '/api/fiscal/nfce/issue',
        payload: { saleId },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/fiscal/nfce/${saleId}/danfe`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.body).toContain('DANFE NFC-e');
    });

    it('GET /api/fiscal/nfce/:saleId/danfe should return 404 for non-existent sale', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/fiscal/nfce/999999/danfe',
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('NFC-e Cancellation (POST /api/fiscal/nfce/:saleId/cancel)', () => {
    it('should reject reason with less than 15 characters with 400', async () => {
      await app.inject({
        method: 'PUT',
        url: '/api/fiscal/profile',
        payload: sampleProfile,
      });

      const saleId = seedSale();
      await app.inject({
        method: 'POST',
        url: '/api/fiscal/nfce/issue',
        payload: { saleId },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/fiscal/nfce/${saleId}/cancel`,
        payload: { reason: 'Curto demais' },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('INVALID_CANCELLATION_REASON');
    });

    it('should return 404 if sale does not have an NFC-e', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/fiscal/nfce/999999/cancel',
        payload: { reason: 'Cancelamento por desistência do cliente na compra' },
      });

      expect(res.statusCode).toBe(404);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('NFCE_NOT_FOUND');
    });

    it('should reject cancelling non-authorized invoice with 400', async () => {
      await app.inject({
        method: 'PUT',
        url: '/api/fiscal/profile',
        payload: sampleProfile,
      });

      const saleId = seedSale();
      await app.inject({
        method: 'POST',
        url: '/api/fiscal/nfce/issue',
        payload: { saleId, offlineContingency: true },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/fiscal/nfce/${saleId}/cancel`,
        payload: { reason: 'Cancelamento por desistência do cliente na compra' },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('INVOICE_NOT_CANCELLABLE');
    });

    it('should successfully cancel authorized NFC-e', async () => {
      await app.inject({
        method: 'PUT',
        url: '/api/fiscal/profile',
        payload: sampleProfile,
      });

      const saleId = seedSale();
      await app.inject({
        method: 'POST',
        url: '/api/fiscal/nfce/issue',
        payload: { saleId },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/fiscal/nfce/${saleId}/cancel`,
        payload: { reason: 'Cancelamento por desistência do cliente na compra' },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.cStat).toBe(135);

      // Check that GET /api/fiscal/nfce/:saleId now shows CANCELADA
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/fiscal/nfce/${saleId}`,
      });
      const getJson = JSON.parse(getRes.body);
      expect(getJson.invoice.status).toBe('CANCELADA');
    });
  });
});
