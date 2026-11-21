import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { AnvisaRecallService } from '../../../src/modules/sanitary/anvisa-recall.service';

describe('AnvisaRecallService - Recolhimento Sanitário e Rastreabilidade Reversa', () => {
  let db: Database;
  let service: AnvisaRecallService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new AnvisaRecallService(db);
  });

  afterEach(() => {
    db.close();
  });

  function seedSalesAndBatches() {
    // 1. Product
    const prodRes = db
      .prepare(`
        INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
        VALUES ('7891111222333', 'Paracetamol 750mg 20 comp', 'Paracetamol', '1018000000000', 'SEM_TARJA', 'ISENTO', 18.0, 7.0, 14.0)
      `)
      .run();
    const productId = prodRes.lastInsertRowid as number;

    // 2. Batch affected by recall
    const batchRes = db
      .prepare(`
        INSERT INTO batches (store_id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity, is_blocked)
        VALUES (1, ?, 'LOTE-PAR-999', '2025-01-01', '2027-01-01', 40, 0, 0)
      `)
      .run(productId);
    const batchId = batchRes.lastInsertRowid as number;

    // 3. Customer
    const custRes = db
      .prepare(`
        INSERT INTO customers (store_id, name, cpf, phone, street, number, neighborhood, city, state, zip_code)
        VALUES (1, 'Maria Oliveira', '12345678901', '11988887777', 'Rua das Flores', '123', 'Jardins', 'São Paulo', 'SP', '01400-000')
      `)
      .run();
    const customerId = custRes.lastInsertRowid as number;

    // 4. PreSale with customer CPF
    const preSaleRes = db
      .prepare(`
        INSERT INTO pre_sales (store_id, code, customer_name, customer_cpf, total_amount)
        VALUES (1, 'PV-RECALL-01', 'Maria Oliveira', '12345678901', 28.0)
      `)
      .run();
    const preSaleId = preSaleRes.lastInsertRowid as number;

    // 5. Prescription for preSale
    db.prepare(`
      INSERT INTO prescriptions (pre_sale_id, doctor_name, doctor_crm, doctor_uf, prescription_type, prescription_date, patient_name)
      VALUES (?, 'Dr. Carlos Médico', '98765', 'SP', 'RECEITA_BRANCA', '2026-11-15', 'Maria Oliveira')
    `).run(preSaleId);

    // 6. Cash session
    const cashSessionRes = db
      .prepare(`
        INSERT INTO cash_sessions (operator_name, initial_cash, current_cash)
        VALUES ('Operador PDV', 100.0, 128.0)
      `)
      .run();
    const cashSessionId = cashSessionRes.lastInsertRowid as number;

    // 7. Completed Sale
    const saleRes = db
      .prepare(`
        INSERT INTO sales (store_id, pre_sale_id, cash_session_id, status, total_amount, discount_amount, change_amount)
        VALUES (1, ?, ?, 'COMPLETED', 28.0, 0, 0)
      `)
      .run(preSaleId, cashSessionId);
    const saleId = saleRes.lastInsertRowid as number;

    // 8. Sale items
    db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, 2, 14.0, 28.0)
    `).run(saleId, productId, batchId);

    return { productId, batchId, customerId, saleId };
  }

  describe('registerRecall', () => {
    it('should register Anvisa resolution, atomically block batches, and record recall items', () => {
      const { productId, batchId } = seedSalesAndBatches();

      const recall = service.registerRecall({
        resolutionNumber: 'RE 1.555/2026',
        resolutionDate: '2026-11-20',
        publicationDate: '2026-11-21',
        reason: 'Suspeita de contaminação por partículas estranhas',
        notes: 'Publicado no DOU Seção 1',
        items: [
          {
            productId,
            batchNumber: 'LOTE-PAR-999',
          },
        ],
      });

      expect(recall.id).toBeGreaterThan(0);
      expect(recall.resolutionNumber).toBe('RE 1.555/2026');
      expect(recall.status).toBe('ACTIVE');
      expect(recall.items).toHaveLength(1);
      expect(recall.items[0].batchNumber).toBe('LOTE-PAR-999');
      expect(recall.items[0].actionTaken).toBe('BLOCKED');
      expect(recall.items[0].totalStockBlocked).toBe(40);

      // Verify batch in database is now blocked
      const batchRow = db
        .prepare<{ is_blocked: number; block_reason: string }>('SELECT is_blocked, block_reason FROM batches WHERE id = ?')
        .get(batchId);
      expect(batchRow?.is_blocked).toBe(1);
      expect(batchRow?.block_reason).toContain('RE 1.555/2026');
    });

    it('should throw error when registering duplicate resolution number', () => {
      const { productId } = seedSalesAndBatches();

      service.registerRecall({
        resolutionNumber: 'RE 2.000/2026',
        resolutionDate: '2026-11-20',
        publicationDate: '2026-11-21',
        reason: 'Motivo 1',
        items: [{ productId, batchNumber: 'LOTE-PAR-999' }],
      });

      expect(() => {
        service.registerRecall({
          resolutionNumber: 'RE 2.000/2026',
          resolutionDate: '2026-11-20',
          publicationDate: '2026-11-21',
          reason: 'Outro motivo',
          items: [{ productId, batchNumber: 'LOTE-PAR-999' }],
        });
      }).toThrow(/já cadastrada/i);
    });
  });

  describe('getAffectedPatients', () => {
    it('should perform reverse traceability and list patients who bought from recalled batches', () => {
      const { productId, saleId } = seedSalesAndBatches();

      const recall = service.registerRecall({
        resolutionNumber: 'RE 3.000/2026',
        resolutionDate: '2026-11-20',
        publicationDate: '2026-11-21',
        reason: 'Recolhimento voluntário',
        items: [{ productId, batchNumber: 'LOTE-PAR-999' }],
      });

      const affected = service.getAffectedPatients(recall.id);
      expect(affected).toHaveLength(1);

      const patient = affected[0];
      expect(patient.customerName).toBe('Maria Oliveira');
      expect(patient.cpf).toBe('12345678901');
      expect(patient.phone).toBe('11988887777');
      expect(patient.saleId).toBe(saleId);
      expect(patient.quantity).toBe(2);
      expect(patient.hasPrescription).toBe(true);
      expect(patient.prescriptionDoctor).toContain('Dr. Carlos Médico');
    });

    it('should return empty list when no sales exist for recalled batch', () => {
      // Product and batch without sales
      const prodRes = db
        .prepare(`
          INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
          VALUES ('7899999888877', 'Ibuprofeno 400mg', 'Ibuprofeno', '1018000000001', 'SEM_TARJA', 'ISENTO', 15.0, 5.0, 10.0)
        `)
        .run();
      db.prepare(`
        INSERT INTO batches (store_id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity)
        VALUES (1, ?, 'LOTE-IBU-123', '2025-01-01', '2027-01-01', 50, 0)
      `).run(prodRes.lastInsertRowid);

      const recall = service.registerRecall({
        resolutionNumber: 'RE 4.000/2026',
        resolutionDate: '2026-11-20',
        publicationDate: '2026-11-21',
        reason: 'Recolhimento',
        items: [{ productId: prodRes.lastInsertRowid as number, batchNumber: 'LOTE-IBU-123' }],
      });

      const affected = service.getAffectedPatients(recall.id);
      expect(affected).toHaveLength(0);
    });
  });

  describe('resolveRecall', () => {
    it('should update recall status to COMPLETED and update items actionTaken', () => {
      const { productId } = seedSalesAndBatches();

      const recall = service.registerRecall({
        resolutionNumber: 'RE 5.000/2026',
        resolutionDate: '2026-11-20',
        publicationDate: '2026-11-21',
        reason: 'Recolhimento concluído',
        items: [{ productId, batchNumber: 'LOTE-PAR-999' }],
      });

      const resolved = service.resolveRecall(recall.id, {
        actionTaken: 'RETURNED_TO_SUPPLIER',
        notes: 'Medicamentos devolvidos com NF de devolução 5543',
      });

      expect(resolved.status).toBe('COMPLETED');
      expect(resolved.items[0].actionTaken).toBe('RETURNED_TO_SUPPLIER');
      expect(resolved.notes).toContain('NF de devolução 5543');
    });
  });
});
