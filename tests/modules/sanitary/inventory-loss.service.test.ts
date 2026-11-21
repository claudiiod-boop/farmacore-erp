import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { InventoryLossService } from '../../../src/modules/sanitary/inventory-loss.service';

describe('InventoryLossService - Baixa Regulatória de Perdas, Avarias & Descarte (Laudo VISA)', () => {
  let db: Database;
  let service: InventoryLossService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new InventoryLossService(db);
  });

  afterEach(() => {
    db.close();
  });

  function seedStock() {
    const prodRes = db
      .prepare(`
        INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
        VALUES ('7891234567899', 'Insulina NPH 100UI/ml', 'Insulina Humana', '1018000000002', 'SEM_TARJA', 'ISENTO', 60.0, 30.0, 50.0)
      `)
      .run();
    const productId = prodRes.lastInsertRowid as number;

    const batchRes = db
      .prepare(`
        INSERT INTO batches (store_id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity, is_blocked)
        VALUES (1, ?, 'LOTE-INS-01', '2025-01-01', '2026-10-31', 20, 0, 0)
      `)
      .run(productId);
    const batchId = batchRes.lastInsertRowid as number;

    return { productId, batchId };
  }

  describe('createLossDraft', () => {
    it('should create a loss draft with sequential number PER-YYYYMM-XXXX and calculated totals', () => {
      const { productId, batchId } = seedStock();

      const loss = service.createLossDraft({
        storeId: 1,
        reason: 'TEMPERATURE_EXCURSION',
        responsiblePharmacistName: 'Dra. Ana Paula Farmacêutica',
        pharmacistCrf: '54321',
        pharmacistCrfUf: 'SP',
        notes: 'Falha no compressor da geladeira de termolábeis',
        items: [
          {
            productId,
            batchId,
            batchNumber: 'LOTE-INS-01',
            expirationDate: '2026-10-31',
            quantity: 5,
            unitCost: 30.0,
            unitSalePrice: 50.0,
          },
        ],
      });

      expect(loss.id).toBeGreaterThan(0);
      expect(loss.lossNumber).toMatch(/^PER-\d{6}-\d{4}$/);
      expect(loss.status).toBe('DRAFT');
      expect(loss.reason).toBe('TEMPERATURE_EXCURSION');
      expect(loss.totalCostAmount).toBe(150.0); // 5 * 30.0
      expect(loss.totalSaleAmount).toBe(250.0); // 5 * 50.0
      expect(loss.items).toHaveLength(1);
      expect(loss.items[0].quantity).toBe(5);

      // Stock should NOT be deducted yet in DRAFT state
      const batchRow = db.prepare<{ quantity: number }>('SELECT quantity FROM batches WHERE id = ?').get(batchId);
      expect(batchRow?.quantity).toBe(20);
    });

    it('should throw error when items array is empty', () => {
      expect(() => {
        service.createLossDraft({
          storeId: 1,
          reason: 'EXPIRED',
          responsiblePharmacistName: 'Dr. Farmacêutico',
          pharmacistCrf: '11111',
          pharmacistCrfUf: 'SP',
          items: [],
        });
      }).toThrow(/ao menos um item/i);
    });
  });

  describe('approveAndDeductStock', () => {
    it('should approve loss and atomically deduct batch quantity from database', () => {
      const { productId, batchId } = seedStock();

      const draft = service.createLossDraft({
        storeId: 1,
        reason: 'EXPIRED',
        responsiblePharmacistName: 'Dra. Ana Paula',
        pharmacistCrf: '54321',
        pharmacistCrfUf: 'SP',
        items: [
          {
            productId,
            batchId,
            batchNumber: 'LOTE-INS-01',
            expirationDate: '2026-10-31',
            quantity: 8,
            unitCost: 30.0,
            unitSalePrice: 50.0,
          },
        ],
      });

      const approved = service.approveAndDeductStock(draft.id, {
        approvedByPharmacistName: 'Dra. Ana Paula',
        pharmacistCrf: '54321',
        pharmacistCrfUf: 'SP',
        notes: 'Baixa homologada pela gerência',
      });

      expect(approved.status).toBe('APPROVED');

      // Verify batch quantity is now 12 (20 - 8)
      const batchRow = db.prepare<{ quantity: number }>('SELECT quantity FROM batches WHERE id = ?').get(batchId);
      expect(batchRow?.quantity).toBe(12);
    });

    it('should throw error when batch has insufficient stock for deduction', () => {
      const { productId, batchId } = seedStock();

      const draft = service.createLossDraft({
        storeId: 1,
        reason: 'BROKEN_DAMAGED',
        responsiblePharmacistName: 'Dra. Ana Paula',
        pharmacistCrf: '54321',
        pharmacistCrfUf: 'SP',
        items: [
          {
            productId,
            batchId,
            batchNumber: 'LOTE-INS-01',
            expirationDate: '2026-10-31',
            quantity: 25, // Only 20 available!
            unitCost: 30.0,
            unitSalePrice: 50.0,
          },
        ],
      });

      expect(() => {
        service.approveAndDeductStock(draft.id, {
          approvedByPharmacistName: 'Dra. Ana Paula',
        });
      }).toThrow(/saldo insuficiente/i);

      // Verify batch quantity was NOT changed
      const batchRow = db.prepare<{ quantity: number }>('SELECT quantity FROM batches WHERE id = ?').get(batchId);
      expect(batchRow?.quantity).toBe(20);
    });

    it('should throw error when approving a loss that is not in DRAFT status', () => {
      const { productId, batchId } = seedStock();

      const draft = service.createLossDraft({
        storeId: 1,
        reason: 'EXPIRED',
        responsiblePharmacistName: 'Dra. Ana Paula',
        pharmacistCrf: '54321',
        pharmacistCrfUf: 'SP',
        items: [
          {
            productId,
            batchId,
            batchNumber: 'LOTE-INS-01',
            expirationDate: '2026-10-31',
            quantity: 2,
            unitCost: 30.0,
            unitSalePrice: 50.0,
          },
        ],
      });

      service.approveAndDeductStock(draft.id, {});

      // Second approval should fail
      expect(() => {
        service.approveAndDeductStock(draft.id, {});
      }).toThrow(/status DRAFT/i);
    });
  });

  describe('recordDisposalCertificate', () => {
    it('should record disposal certificate, MTR and update status to DISPOSED', () => {
      const { productId, batchId } = seedStock();

      const draft = service.createLossDraft({
        storeId: 1,
        reason: 'EXPIRED',
        responsiblePharmacistName: 'Dra. Ana Paula',
        pharmacistCrf: '54321',
        pharmacistCrfUf: 'SP',
        items: [
          {
            productId,
            batchId,
            batchNumber: 'LOTE-INS-01',
            expirationDate: '2026-10-31',
            quantity: 5,
            unitCost: 30.0,
            unitSalePrice: 50.0,
          },
        ],
      });

      service.approveAndDeductStock(draft.id, {});

      const disposed = service.recordDisposalCertificate(draft.id, {
        disposalCompanyName: 'EcoMed Resíduos Hospitalares Ltda',
        disposalCertificateNumber: 'CDF-2026/9876',
        mtrNumber: 'MTR-SP-2026-004455',
        laudoNumber: 'LAUDO-VISA-2026-01',
      });

      expect(disposed.status).toBe('DISPOSED');
      expect(disposed.disposalCompanyName).toBe('EcoMed Resíduos Hospitalares Ltda');
      expect(disposed.disposalCertificateNumber).toBe('CDF-2026/9876');
      expect(disposed.mtrNumber).toBe('MTR-SP-2026-004455');
      expect(disposed.laudoNumber).toBe('LAUDO-VISA-2026-01');
      expect(disposed.disposedAt).toBeDefined();
    });

    it('should throw error when recording certificate on non-APPROVED loss', () => {
      const { productId, batchId } = seedStock();

      const draft = service.createLossDraft({
        storeId: 1,
        reason: 'EXPIRED',
        responsiblePharmacistName: 'Dra. Ana Paula',
        pharmacistCrf: '54321',
        pharmacistCrfUf: 'SP',
        items: [
          {
            productId,
            batchId,
            batchNumber: 'LOTE-INS-01',
            expirationDate: '2026-10-31',
            quantity: 5,
            unitCost: 30.0,
            unitSalePrice: 50.0,
          },
        ],
      });

      // Still in DRAFT
      expect(() => {
        service.recordDisposalCertificate(draft.id, {
          disposalCompanyName: 'EcoMed',
          disposalCertificateNumber: 'CDF-1',
        });
      }).toThrow(/status APPROVED/i);
    });
  });
});
