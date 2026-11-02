import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { Database, getDatabase } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';
import { buildServer } from '../../src/server';

describe('Fastify REST API & Checkout Flow', () => {
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
  });

  describe('Health Check (GET /health)', () => {
    it('should return 200 with status ok and timestamp', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.status).toBe('ok');
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('Product Catalog Endpoints', () => {
    it('should create product successfully (POST /api/products)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: {
          ean: '7891234567890',
          name: 'Ibuprofeno 600mg',
          activeIngredient: 'Ibuprofeno',
          msRegistration: '100000000010',
          stripe: 'SEM_TARJA',
          controlType: 'ISENTO',
          pmc: 25.0,
          pf: 15.0,
          price: 20.0,
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.id).toBeDefined();
      expect(json.name).toBe('Ibuprofeno 600mg');
      expect(json.price).toBe(20.0);
    });

    it('should reject product creation if price exceeds PMC (CMED_PMC_EXCEEDED)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: {
          ean: '7891234567891',
          name: 'Ibuprofeno Caro',
          activeIngredient: 'Ibuprofeno',
          msRegistration: '100000000011',
          stripe: 'SEM_TARJA',
          controlType: 'ISENTO',
          pmc: 20.0,
          pf: 15.0,
          price: 25.0, // > PMC
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('CMED_PMC_EXCEEDED');
    });

    it('should get product by ID (GET /api/products/:id)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: {
          ean: '7891234567892',
          name: 'Dipirona 1g',
          activeIngredient: 'Dipirona Sódica',
          msRegistration: '100000000012',
          stripe: 'SEM_TARJA',
          controlType: 'ISENTO',
          pmc: 18.0,
          pf: 10.0,
          price: 14.0,
        },
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'GET',
        url: `/api/products/${created.id}`,
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.id).toBe(created.id);
      expect(json.name).toBe('Dipirona 1g');
    });

    it('should return 404 for non-existent product ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/products/9999',
      });

      expect(res.statusCode).toBe(404);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('PRODUCT_NOT_FOUND');
    });

    it('should get product by EAN (GET /api/products/ean/:ean)', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: {
          ean: '7891234567893',
          name: 'Omeprazol 20mg',
          activeIngredient: 'Omeprazol',
          msRegistration: '100000000013',
          stripe: 'VERMELHA_SEM_RECEITA',
          controlType: 'ISENTO',
          pmc: 30.0,
          pf: 18.0,
          price: 22.0,
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/products/ean/7891234567893',
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.ean).toBe('7891234567893');
      expect(json.name).toBe('Omeprazol 20mg');
    });

    it('should return 404 for non-existent product EAN', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/products/ean/0000000000000',
      });

      expect(res.statusCode).toBe(404);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('PRODUCT_NOT_FOUND');
    });

    it('should search products by query string (GET /api/products/search?q=...)', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: {
          ean: '7891234567894',
          name: 'Amoxicilina 500mg',
          activeIngredient: 'Amoxicilina',
          msRegistration: '100000000014',
          stripe: 'VERMELHA_COM_RECEITA',
          controlType: 'ANTIMICROBIANO',
          pmc: 40.0,
          pf: 25.0,
          price: 32.0,
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/products/search?q=Amoxi',
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBeGreaterThanOrEqual(1);
      expect(json[0].name).toContain('Amoxicilina');
    });

    it('should update product price (PATCH /api/products/:id/price)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: {
          ean: '7891234567895',
          name: 'Paracetamol 500mg',
          activeIngredient: 'Paracetamol',
          msRegistration: '100000000015',
          stripe: 'SEM_TARJA',
          controlType: 'ISENTO',
          pmc: 15.0,
          pf: 8.0,
          price: 10.0,
        },
      });
      const prod = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/products/${prod.id}/price`,
        payload: { price: 12.5 },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.price).toBe(12.5);

      // Exceeding PMC should fail
      const failRes = await app.inject({
        method: 'PATCH',
        url: `/api/products/${prod.id}/price`,
        payload: { price: 18.0 }, // > PMC 15.0
      });
      expect(failRes.statusCode).toBe(400);
      const failJson = JSON.parse(failRes.body);
      expect(failJson.error).toBe('CMED_PMC_EXCEEDED');
    });
  });

  describe('Inventory & Batch Endpoints', () => {
    let testProductId: number;

    beforeEach(async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: {
          ean: '7895555555555',
          name: 'Loratadina 10mg',
          activeIngredient: 'Loratadina',
          msRegistration: '100000000020',
          stripe: 'SEM_TARJA',
          controlType: 'ISENTO',
          pmc: 20.0,
          pf: 12.0,
          price: 15.0,
        },
      });
      testProductId = JSON.parse(createRes.body).id;
    });

    it('should add batch successfully (POST /api/batches)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/batches',
        payload: {
          productId: testProductId,
          batchNumber: 'LOTE-LORA-01',
          manufacturingDate: '2026-01-01',
          expirationDate: '2028-12-31',
          quantity: 100,
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.id).toBeDefined();
      expect(json.batchNumber).toBe('LOTE-LORA-01');
      expect(json.availableQuantity).toBe(100);
    });

    it('should reject adding expired batch (BATCH_EXPIRED)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/batches',
        payload: {
          productId: testProductId,
          batchNumber: 'LOTE-VENCIDO',
          manufacturingDate: '2020-01-01',
          expirationDate: '2022-01-01',
          quantity: 50,
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('BATCH_EXPIRED');
    });

    it('should list available batches ordered by FEFO (GET /api/inventory/:productId/batches)', async () => {
      // Add later expiring batch
      await app.inject({
        method: 'POST',
        url: '/api/batches',
        payload: {
          productId: testProductId,
          batchNumber: 'LOTE-LATE',
          manufacturingDate: '2026-01-01',
          expirationDate: '2029-12-31',
          quantity: 20,
        },
      });

      // Add earlier expiring batch
      await app.inject({
        method: 'POST',
        url: '/api/batches',
        payload: {
          productId: testProductId,
          batchNumber: 'LOTE-EARLY',
          manufacturingDate: '2026-01-01',
          expirationDate: '2027-06-30',
          quantity: 15,
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/inventory/${testProductId}/batches`,
      });

      expect(res.statusCode).toBe(200);
      const batches = JSON.parse(res.body);
      expect(batches.length).toBe(2);
      expect(batches[0].batchNumber).toBe('LOTE-EARLY');
      expect(batches[1].batchNumber).toBe('LOTE-LATE');
    });
  });

  describe('Counter / Pre-Sale Endpoints', () => {
    let otcProductId: number;
    let otcBatchId: number;
    let ctrlProductId: number;
    let ctrlBatchId: number;

    beforeEach(async () => {
      // Create OTC product & batch
      const otcProdRes = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: {
          ean: '7896666666666',
          name: 'Vitamina D 50000UI',
          activeIngredient: 'Colecalciferol',
          msRegistration: '100000000030',
          stripe: 'SEM_TARJA',
          controlType: 'ISENTO',
          pmc: 50.0,
          pf: 30.0,
          price: 40.0,
        },
      });
      otcProductId = JSON.parse(otcProdRes.body).id;

      const otcBatchRes = await app.inject({
        method: 'POST',
        url: '/api/batches',
        payload: {
          productId: otcProductId,
          batchNumber: 'LOTE-VITD-01',
          manufacturingDate: '2026-01-01',
          expirationDate: '2028-12-31',
          quantity: 10,
        },
      });
      otcBatchId = JSON.parse(otcBatchRes.body).id;

      // Create Controlled product & batch (Portaria 344/98 - C1)
      const ctrlProdRes = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: {
          ean: '7897777777777',
          name: 'Sertralina 50mg',
          activeIngredient: 'Cloridrato de Sertralina',
          msRegistration: '100000000031',
          stripe: 'VERMELHA_COM_RECEITA',
          controlType: 'C1',
          pmc: 60.0,
          pf: 35.0,
          price: 45.0,
        },
      });
      ctrlProductId = JSON.parse(ctrlProdRes.body).id;

      const ctrlBatchRes = await app.inject({
        method: 'POST',
        url: '/api/batches',
        payload: {
          productId: ctrlProductId,
          batchNumber: 'LOTE-SERT-01',
          manufacturingDate: '2026-01-01',
          expirationDate: '2028-06-30',
          quantity: 10,
        },
      });
      ctrlBatchId = JSON.parse(ctrlBatchRes.body).id;
    });

    it('should create pre-sale for OTC product without prescription (POST /api/pre-sales)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pre-sales',
        payload: {
          customerName: 'Cliente Teste',
          items: [{ productId: otcProductId, batchId: otcBatchId, quantity: 2 }],
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.code).toMatch(/^PV-\d{4}$/);
      expect(json.totalAmount).toBe(80.0);
      expect(json.status).toBe('OPEN');
    });

    it('should reject pre-sale for controlled drug if prescription is missing (PRESCRIPTION_REQUIRED)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pre-sales',
        payload: {
          customerName: 'Cliente Sem Receita',
          items: [{ productId: ctrlProductId, batchId: ctrlBatchId, quantity: 1 }],
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('PRESCRIPTION_REQUIRED');
    });

    it('should create pre-sale for controlled drug with valid prescription', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pre-sales',
        payload: {
          customerName: 'Carlos Drummond',
          items: [{ productId: ctrlProductId, batchId: ctrlBatchId, quantity: 1 }],
          prescription: {
            doctorName: 'Dr. Oswaldo Cruz',
            doctorCrm: '45678',
            doctorUf: 'RJ',
            prescriptionType: 'C1',
            prescriptionDate: '2026-11-01',
            patientName: 'Carlos Drummond',
            buyerName: 'Carlos Drummond',
            buyerCpf: '111.222.333-44',
          },
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.code).toBeDefined();

      // Retrieve by code
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/pre-sales/${json.code}`,
      });
      expect(getRes.statusCode).toBe(200);
      const details = JSON.parse(getRes.body);
      expect(details.prescription).toBeDefined();
      expect(details.prescription.doctorName).toBe('Dr. Oswaldo Cruz');
    });

    it('should cancel an open pre-sale (POST /api/pre-sales/:code/cancel)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/pre-sales',
        payload: {
          customerName: 'Cliente Cancelar',
          items: [{ productId: otcProductId, batchId: otcBatchId, quantity: 1 }],
        },
      });
      const code = JSON.parse(createRes.body).code;

      const cancelRes = await app.inject({
        method: 'POST',
        url: `/api/pre-sales/${code}/cancel`,
      });

      expect(cancelRes.statusCode).toBe(200);
      const json = JSON.parse(cancelRes.body);
      expect(json.message).toContain('cancelled');

      // Subsequent cancel should return 400
      const cancelAgain = await app.inject({
        method: 'POST',
        url: `/api/pre-sales/${code}/cancel`,
      });
      expect(cancelAgain.statusCode).toBe(400);
    });
  });

  describe('POS Checkout, Sessions & Receipt Generation', () => {
    let productId: number;
    let batchId: number;
    let controlledProductId: number;
    let controlledBatchId: number;

    beforeEach(async () => {
      const pRes = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: {
          ean: '7898888888888',
          name: 'Neosaldina 30 Drageas',
          activeIngredient: 'Dipirona + Mucato + Cafeína',
          msRegistration: '100000000040',
          stripe: 'SEM_TARJA',
          controlType: 'ISENTO',
          pmc: 35.0,
          pf: 20.0,
          price: 28.0,
        },
      });
      productId = JSON.parse(pRes.body).id;

      const bRes = await app.inject({
        method: 'POST',
        url: '/api/batches',
        payload: {
          productId,
          batchNumber: 'LOTE-NEO-01',
          manufacturingDate: '2026-01-01',
          expirationDate: '2028-10-31',
          quantity: 50,
        },
      });
      batchId = JSON.parse(bRes.body).id;

      const ctrlRes = await app.inject({
        method: 'POST',
        url: '/api/products',
        payload: {
          ean: '7899999999999',
          name: 'Zolpidem 10mg',
          activeIngredient: 'Hemitartarato de Zolpidem',
          msRegistration: '100000000041',
          stripe: 'PRETA',
          controlType: 'B1',
          pmc: 65.0,
          pf: 40.0,
          price: 50.0,
        },
      });
      controlledProductId = JSON.parse(ctrlRes.body).id;

      const bCtrlRes = await app.inject({
        method: 'POST',
        url: '/api/batches',
        payload: {
          productId: controlledProductId,
          batchNumber: 'LOTE-ZOLP-01',
          manufacturingDate: '2026-01-01',
          expirationDate: '2027-11-30',
          quantity: 20,
        },
      });
      controlledBatchId = JSON.parse(bCtrlRes.body).id;
    });

    it('should manage cash sessions (open, current, close)', async () => {
      // 1. Open cash session
      const openRes = await app.inject({
        method: 'POST',
        url: '/api/pos/sessions',
        payload: {
          operatorName: 'Operador Caixa 1',
          initialCash: 150.0,
        },
      });

      expect(openRes.statusCode).toBe(201);
      const session = JSON.parse(openRes.body);
      expect(session.id).toBeDefined();
      expect(session.status).toBe('OPEN');
      expect(session.currentCash).toBe(150.0);

      // 2. Get current session
      const currentRes = await app.inject({
        method: 'GET',
        url: '/api/pos/sessions/current',
      });
      expect(currentRes.statusCode).toBe(200);
      const currentSession = JSON.parse(currentRes.body);
      expect(currentSession.id).toBe(session.id);

      // 3. Close cash session
      const closeRes = await app.inject({
        method: 'POST',
        url: `/api/pos/sessions/${session.id}/close`,
      });
      expect(closeRes.statusCode).toBe(200);
      const summary = JSON.parse(closeRes.body);
      expect(summary.session.status).toBe('CLOSED');
      expect(summary.totalSalesCount).toBe(0);
    });

    it('should complete checkout for pre-sale and return sale details with 48-col ESC/POS receipt', async () => {
      // Open session
      const sessionRes = await app.inject({
        method: 'POST',
        url: '/api/pos/sessions',
        payload: {
          operatorName: 'Operador Caixa 2',
          initialCash: 100.0,
        },
      });
      const session = JSON.parse(sessionRes.body);

      // Create pre-sale (2 x 28.0 = 56.0)
      const pvRes = await app.inject({
        method: 'POST',
        url: '/api/pre-sales',
        payload: {
          customerName: 'Cliente Balcao 1',
          items: [{ productId, batchId, quantity: 2 }],
        },
      });
      const pv = JSON.parse(pvRes.body);

      // Checkout (pay 60.0 in cash, change 4.0)
      const checkoutRes = await app.inject({
        method: 'POST',
        url: '/api/pos/checkout',
        payload: {
          preSaleCode: pv.code,
          payments: [{ method: 'DINHEIRO', amount: 60.0 }],
          cashSessionId: session.id,
        },
      });

      expect(checkoutRes.statusCode).toBe(200);
      const data = JSON.parse(checkoutRes.body);
      expect(data.sale).toBeDefined();
      expect(data.sale.sale.totalAmount).toBe(56.0);
      expect(data.sale.sale.changeAmount).toBe(4.0);
      expect(data.receiptText).toBeDefined();
      expect(typeof data.receiptText).toBe('string');
      expect(data.receiptText).toContain('FARMACORE DROGARIA & FARMACIA');
      expect(data.receiptText).toContain('Neosaldina 30 Drageas');
      expect(data.receiptText).toContain('LOTE: LOTE-NEO-01');
      expect(data.receiptText).toContain('DINHEIRO');

      // Every line in receiptText must not exceed 48 cols
      const lines = data.receiptText.split('\n');
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(48);
      }

      // Fetch receipt via GET /api/sales/:id/receipt
      const receiptRes = await app.inject({
        method: 'GET',
        url: `/api/sales/${data.sale.sale.id}/receipt`,
      });
      expect(receiptRes.statusCode).toBe(200);
      const receiptData = JSON.parse(receiptRes.body);
      expect(receiptData.receiptText).toBe(data.receiptText);
    });

    it('should complete checkout for controlled substance pre-sale and include retention block on receipt', async () => {
      // Create pre-sale with prescription (1 x 50.0)
      const pvRes = await app.inject({
        method: 'POST',
        url: '/api/pre-sales',
        payload: {
          customerName: 'Joaquim Silva',
          items: [{ productId: controlledProductId, batchId: controlledBatchId, quantity: 1 }],
          prescription: {
            doctorName: 'Dra. Ana Maria Nogueira',
            doctorCrm: '98765',
            doctorUf: 'MG',
            prescriptionType: 'B1',
            prescriptionDate: '2026-11-02',
            patientName: 'Joaquim Silva',
            buyerName: 'Joaquim Silva',
            buyerCpf: '999.888.777-66',
          },
        },
      });
      const pv = JSON.parse(pvRes.body);

      // Checkout with exact PIX payment
      const checkoutRes = await app.inject({
        method: 'POST',
        url: '/api/pos/checkout',
        payload: {
          preSaleCode: pv.code,
          payments: [{ method: 'PIX', amount: 50.0 }],
        },
      });

      expect(checkoutRes.statusCode).toBe(200);
      const data = JSON.parse(checkoutRes.body);
      expect(data.receiptText).toContain('*** DISPENSACAO SOB CONTROLE ESPECIAL ***');
      expect(data.receiptText).toContain('RECEITA: B1');
      expect(data.receiptText).toContain('Dra. Ana Maria Nogueira');
      expect(data.receiptText).toContain('CRM: 98765/MG');
      expect(data.receiptText).toContain('Joaquim Silva');
      expect(data.receiptText).toContain('999.888.777-66');

      const lines = data.receiptText.split('\n');
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(48);
      }
    });
  });

  describe('buildServer Factory Helper', () => {
    it('should initialize and return ready Fastify instance with routes registered', async () => {
      const server = await buildServer(db);
      expect(server).toBeDefined();

      const res = await server.inject({
        method: 'GET',
        url: '/health',
      });
      expect(res.statusCode).toBe(200);
      await server.close();
    });
  });
});
