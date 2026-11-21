import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';
import { ExpiryManagementService } from '../../src/modules/sanitary/expiry-management.service';
import { AnvisaRecallService } from '../../src/modules/sanitary/anvisa-recall.service';
import { InventoryLossService } from '../../src/modules/sanitary/inventory-loss.service';

describe('Sanitary REST API Routes (/api/sanitary/*)', () => {
  let app: FastifyInstance;
  let db: Database;
  let expiryService: ExpiryManagementService;
  let recallService: AnvisaRecallService;
  let lossService: InventoryLossService;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    expiryService = new ExpiryManagementService(db);
    recallService = new AnvisaRecallService(db);
    lossService = new InventoryLossService(db);

    // Seed base products and batches
    db.prepare(`
      INSERT OR IGNORE INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
      VALUES (101, '7891010101010', 'Dipirona 500mg 10cp', 'Dipirona Sódica', '1.0001.0001.001-1', 'SEM_TARJA', 'LIBERADO', 12.0, 8.0, 10.0, 1),
             (102, '7892020202020', 'Amoxicilina 500mg 21cps', 'Amoxicilina Tri-hidratada', '1.0002.0002.002-2', 'VERMELHA', 'ANTIBIOTICO', 45.0, 30.0, 35.0, 1)
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO batches (id, product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (201, 101, 'LOTE-DIP-01', '2025-01-01', '2026-12-10', 50, 1),
             (202, 102, 'LOTE-AMX-01', '2025-02-01', '2026-10-31', 30, 1)
    `).run();

    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  // 1. GESTÃO DE VALIDADES
  describe('Expiry Routes', () => {
    it('GET /api/sanitary/expiry/matrix should return 200 and risk matrix', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sanitary/expiry/matrix?storeId=1&referenceDate=2026-11-20',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.referenceDate).toBe('2026-11-20');
      expect(data.totalBatches).toBe(2);
      expect(data.tiers).toBeDefined();
      expect(data.tiers.EXPIRED.unitCount).toBe(30); // 2026-10-31 is expired
      expect(data.tiers.RISK_30_DAYS.unitCount).toBe(50); // 2026-12-10 is +20 days
    });

    it('GET /api/sanitary/expiry/batches should return 200 and paginated batch list', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sanitary/expiry/batches?storeId=1',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.total).toBe(2);
      expect(data.batches).toHaveLength(2);
      expect(data.batches[0].batchNumber).toBeDefined();
    });

    it('GET /api/sanitary/expiry/audit-slip should return 200 and ESC/POS printable text', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sanitary/expiry/audit-slip?storeId=1',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.text).toContain('CONFERENCIA DE VALIDADES');
      expect(data.text).toContain('[ ]');
    });
  });

  // 2. RECALL SANITÁRIO ANVISA
  describe('Anvisa Recall Routes', () => {
    it('POST /api/sanitary/recalls should return 201 and create recall', async () => {
      const payload = {
        resolutionNumber: 'RE 1.234/2026',
        resolutionDate: '2026-11-20',
        publicationDate: '2026-11-21',
        reason: 'Contaminação de lote',
        items: [
          {
            productId: 101,
            batchNumber: 'LOTE-DIP-01',
          },
        ],
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/sanitary/recalls',
        payload,
      });

      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data.id).toBeGreaterThan(0);
      expect(data.resolutionNumber).toBe('RE 1.234/2026');
      expect(data.status).toBe('ACTIVE');
      expect(data.items).toHaveLength(1);
      expect(data.items[0].totalStockBlocked).toBe(50);
    });

    it('GET /api/sanitary/recalls should return 200 and list recalls', async () => {
      recallService.registerRecall({
        resolutionNumber: 'RE 2.345/2026',
        resolutionDate: '2026-11-20',
        publicationDate: '2026-11-21',
        reason: 'Recolhimento voluntário',
        items: [{ productId: 101, batchNumber: 'LOTE-DIP-01' }],
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/sanitary/recalls',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/sanitary/recalls/:id/patients should return 200 and reverse customer list', async () => {
      const recall = recallService.registerRecall({
        resolutionNumber: 'RE 3.456/2026',
        resolutionDate: '2026-11-20',
        publicationDate: '2026-11-21',
        reason: 'Recolhimento',
        items: [{ productId: 101, batchNumber: 'LOTE-DIP-01' }],
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/sanitary/recalls/${recall.id}/patients`,
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('POST /api/sanitary/recalls/:id/resolve should return 200 and resolve recall', async () => {
      const recall = recallService.registerRecall({
        resolutionNumber: 'RE 4.567/2026',
        resolutionDate: '2026-11-20',
        publicationDate: '2026-11-21',
        reason: 'Recolhimento teste',
        items: [{ productId: 101, batchNumber: 'LOTE-DIP-01' }],
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/sanitary/recalls/${recall.id}/resolve`,
        payload: {
          actionTaken: 'DESTROYED',
          notes: 'Lotes inutilizados',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.status).toBe('COMPLETED');
      expect(data.items[0].actionTaken).toBe('DESTROYED');
    });
  });

  // 3. BAIXAS POR PERDAS, AVARIAS E LAUDO VISA
  describe('Inventory Losses Routes', () => {
    it('POST /api/sanitary/losses should return 201 and create loss draft', async () => {
      const payload = {
        storeId: 1,
        reason: 'EXPIRED',
        responsiblePharmacistName: 'Dra. Luiza Farmacêutica',
        pharmacistCrf: '12345',
        pharmacistCrfUf: 'SP',
        items: [
          {
            productId: 102,
            batchId: 202,
            batchNumber: 'LOTE-AMX-01',
            expirationDate: '2026-10-31',
            quantity: 5,
            unitCost: 30.0,
            unitSalePrice: 35.0,
          },
        ],
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/sanitary/losses',
        payload,
      });

      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data.id).toBeGreaterThan(0);
      expect(data.lossNumber).toMatch(/^PER-\d{6}-\d{4}$/);
      expect(data.status).toBe('DRAFT');
      expect(data.totalCostAmount).toBe(150.0);
    });

    it('POST /api/sanitary/losses/:id/approve should return 200 and deduct stock', async () => {
      const draft = lossService.createLossDraft({
        storeId: 1,
        reason: 'BROKEN_DAMAGED',
        responsiblePharmacistName: 'Dra. Luiza',
        pharmacistCrf: '12345',
        pharmacistCrfUf: 'SP',
        items: [
          {
            productId: 101,
            batchId: 201,
            batchNumber: 'LOTE-DIP-01',
            expirationDate: '2026-12-10',
            quantity: 10,
            unitCost: 8.0,
            unitSalePrice: 10.0,
          },
        ],
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/sanitary/losses/${draft.id}/approve`,
        payload: {
          approvedByPharmacistName: 'Dra. Luiza',
          notes: 'Frascos quebrados no transporte',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.status).toBe('APPROVED');

      // Verify batch quantity in DB
      const batch = db.prepare<{ quantity: number }>('SELECT quantity FROM batches WHERE id = 201').get();
      expect(batch?.quantity).toBe(40); // 50 - 10
    });

    it('POST /api/sanitary/losses/:id/disposal should return 200 and record certificate', async () => {
      const draft = lossService.createLossDraft({
        storeId: 1,
        reason: 'EXPIRED',
        responsiblePharmacistName: 'Dra. Luiza',
        pharmacistCrf: '12345',
        pharmacistCrfUf: 'SP',
        items: [
          {
            productId: 101,
            batchId: 201,
            batchNumber: 'LOTE-DIP-01',
            expirationDate: '2026-12-10',
            quantity: 5,
            unitCost: 8.0,
            unitSalePrice: 10.0,
          },
        ],
      });

      lossService.approveAndDeductStock(draft.id, {});

      const res = await app.inject({
        method: 'POST',
        url: `/api/sanitary/losses/${draft.id}/disposal`,
        payload: {
          disposalCompanyName: 'EcoLimp Tratamento de Resíduos',
          disposalCertificateNumber: 'CDF-9988-2026',
          mtrNumber: 'MTR-2026-112233',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.status).toBe('DISPOSED');
      expect(data.disposalCompanyName).toBe('EcoLimp Tratamento de Resíduos');
    });

    it('GET /api/sanitary/losses/:id/laudo should return 200 and ESC/POS printable laudo', async () => {
      const draft = lossService.createLossDraft({
        storeId: 1,
        reason: 'EXPIRED',
        responsiblePharmacistName: 'Dra. Luiza',
        pharmacistCrf: '12345',
        pharmacistCrfUf: 'SP',
        items: [
          {
            productId: 101,
            batchId: 201,
            batchNumber: 'LOTE-DIP-01',
            expirationDate: '2026-12-10',
            quantity: 5,
            unitCost: 8.0,
            unitSalePrice: 10.0,
          },
        ],
      });

      lossService.approveAndDeductStock(draft.id, {});
      lossService.recordDisposalCertificate(draft.id, {
        disposalCompanyName: 'EcoLimp',
        disposalCertificateNumber: 'CDF-1',
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/sanitary/losses/${draft.id}/laudo`,
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.text).toContain('LAUDO OFICIAL DE DESCARTE SANITARIO');
      expect(data.text).toContain(draft.lossNumber);
    });
  });
});
