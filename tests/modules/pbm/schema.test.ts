import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import type {
  PbmConfig,
  PbmTransaction,
  PbmTransactionItem,
  PbmItemRequest,
  PbmAuthorizeParams,
  PbmItemResult,
  PbmAuthorizationResult,
  PbmConfirmParams,
  PbmConfirmResult,
  PbmProvider,
} from '../../../src/modules/pbm/types';

describe('PBM & Farmacia Popular Schema 005 & Types', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should apply migration 005 and create pbm_configs, pbm_transactions, and pbm_transaction_items tables', () => {
    const tables = db
      .prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((r) => r.name);

    expect(tables).toContain('pbm_configs');
    expect(tables).toContain('pbm_transactions');
    expect(tables).toContain('pbm_transaction_items');
  });

  it('should verify products table has fp_eligible, fp_code, fp_reference_price, and fp_type columns', () => {
    const columns = db
      .prepare<{ name: string; type: string; dflt_value: string | null }>(
        "PRAGMA table_info(products)"
      )
      .all();

    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain('fp_eligible');
    expect(columnNames).toContain('fp_code');
    expect(columnNames).toContain('fp_reference_price');
    expect(columnNames).toContain('fp_type');

    // Insert a product with FP fields
    db.prepare(`
      INSERT INTO products (
        ean, name, active_ingredient, ms_registration, stripe, control_type,
        pmc, pf, price, fp_eligible, fp_code, fp_reference_price, fp_type
      ) VALUES (
        '7891234567890', 'Losartana Potassica 50mg', 'Losartana', '1234567890123',
        'VERMELHA', 'NORMAL', 15.00, 10.00, 12.00, 1, 'FP001', 12.00, 'GRATUITO'
      )
    `).run();

    const product = db.prepare<any>('SELECT * FROM products WHERE ean = ?').get('7891234567890');
    expect(product.fp_eligible).toBe(1);
    expect(product.fp_code).toBe('FP001');
    expect(product.fp_reference_price).toBe(12.00);
    expect(product.fp_type).toBe('GRATUITO');
  });

  it('should verify check constraint on fp_type allows NULL, GRATUITO and CO_PAGAMENTO', () => {
    // NULL should be allowed
    expect(() => {
      db.prepare(`
        INSERT INTO products (
          ean, name, active_ingredient, ms_registration, stripe, control_type,
          pmc, pf, price, fp_type
        ) VALUES (
          '7890000000001', 'Prod Null', 'Ativo', '1000000000000',
          'SEM_TARJA', 'NORMAL', 10, 8, 9, NULL
        )
      `).run();
    }).not.toThrow();

    // CO_PAGAMENTO should be allowed
    expect(() => {
      db.prepare(`
        INSERT INTO products (
          ean, name, active_ingredient, ms_registration, stripe, control_type,
          pmc, pf, price, fp_type
        ) VALUES (
          '7890000000002', 'Prod Copay', 'Ativo', '1000000000001',
          'VERMELHA', 'NORMAL', 20, 15, 18, 'CO_PAGAMENTO'
        )
      `).run();
    }).not.toThrow();

    // Invalid value should throw
    expect(() => {
      db.prepare(`
        INSERT INTO products (
          ean, name, active_ingredient, ms_registration, stripe, control_type,
          pmc, pf, price, fp_type
        ) VALUES (
          '7890000000003', 'Prod Invalid', 'Ativo', '1000000000002',
          'VERMELHA', 'NORMAL', 20, 15, 18, 'INVALIDO'
        )
      `).run();
    }).toThrow();
  });

  it('should verify constraints on pbm_configs', () => {
    // Valid insert
    db.prepare(`
      INSERT INTO pbm_configs (provider_id, provider_name, environment, is_active, credentials_json)
      VALUES ('FARMACIA_POPULAR', 'Aqui Tem Farmacia Popular', 'MOCK', 1, '{}')
    `).run();

    // Duplicate provider_id should throw (UNIQUE)
    expect(() => {
      db.prepare(`
        INSERT INTO pbm_configs (provider_id, provider_name, environment)
        VALUES ('FARMACIA_POPULAR', 'Duplicate', 'PRODUCAO')
      `).run();
    }).toThrow();

    // Invalid environment should throw CHECK constraint
    expect(() => {
      db.prepare(`
        INSERT INTO pbm_configs (provider_id, provider_name, environment)
        VALUES ('VIDALINK', 'Vidalink', 'HOMOLOG')
      `).run();
    }).toThrow();
  });

  it('should verify constraints and relationships on pbm_transactions and pbm_transaction_items', () => {
    // Setup config
    db.prepare(`
      INSERT INTO pbm_configs (provider_id, provider_name, environment)
      VALUES ('FARMACIA_POPULAR', 'Aqui Tem Farmacia Popular', 'MOCK')
    `).run();

    // Insert Product
    const prodResult = db.prepare(`
      INSERT INTO products (
        ean, name, active_ingredient, ms_registration, stripe, control_type,
        pmc, pf, price, fp_eligible, fp_code, fp_reference_price, fp_type
      ) VALUES (
        '7891234567890', 'Losartana Potassica 50mg', 'Losartana', '1234567890123',
        'VERMELHA', 'NORMAL', 15.00, 10.00, 12.00, 1, 'FP001', 12.00, 'GRATUITO'
      )
    `).run();
    const productId = Number(prodResult.lastInsertRowid);

    // Insert Batch
    const batchResult = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'LOTE001', '2026-01-01', '2027-01-01', 100)
    `).run(productId);
    const batchId = Number(batchResult.lastInsertRowid);

    // Insert Transaction
    const transResult = db.prepare(`
      INSERT INTO pbm_transactions (
        transaction_uuid, provider_id, authorization_protocol, status,
        patient_cpf, patient_name, patient_birth_date, doctor_crm, doctor_uf, doctor_name,
        prescription_date, total_gross_amount, subsidy_amount, patient_copay_amount
      ) VALUES (
        'uuid-1234-5678', 'FARMACIA_POPULAR', 'FP20261116000001', 'AUTHORIZED',
        '12345678900', 'Joao da Silva', '1980-05-15', '12345', 'PR', 'Dr. Carlos',
        '2026-11-10', 12.00, 12.00, 0.00
      )
    `).run();
    const transId = Number(transResult.lastInsertRowid);

    // Insert Transaction Item
    const itemResult = db.prepare(`
      INSERT INTO pbm_transaction_items (
        pbm_transaction_id, product_id, batch_id, ean, ms_registration, product_name,
        daily_dose, authorized_quantity, unit_gross_price, total_gross_price,
        reference_unit_price, subsidy_unit_price, subsidy_total_price,
        patient_unit_price, patient_total_price, program_type
      ) VALUES (
        ?, ?, ?, '7891234567890', '1234567890123', 'Losartana Potassica 50mg',
        1.0, 1, 12.00, 12.00, 12.00, 12.00, 12.00, 0.00, 0.00, 'GRATUITO'
      )
    `).run(transId, productId, batchId);
    expect(Number(itemResult.lastInsertRowid)).toBeGreaterThan(0);

    // Unique constraint on transaction_uuid
    expect(() => {
      db.prepare(`
        INSERT INTO pbm_transactions (
          transaction_uuid, provider_id, authorization_protocol, status,
          patient_cpf, patient_name, doctor_crm, doctor_uf, prescription_date,
          total_gross_amount, subsidy_amount, patient_copay_amount
        ) VALUES (
          'uuid-1234-5678', 'FARMACIA_POPULAR', 'FP20261116000002', 'AUTHORIZED',
          '12345678900', 'Joao da Silva', '12345', 'PR', '2026-11-10',
          12.00, 12.00, 0.00
        )
      `).run();
    }).toThrow();

    // Check status constraint
    expect(() => {
      db.prepare(`
        INSERT INTO pbm_transactions (
          transaction_uuid, provider_id, authorization_protocol, status,
          patient_cpf, patient_name, doctor_crm, doctor_uf, prescription_date,
          total_gross_amount, subsidy_amount, patient_copay_amount
        ) VALUES (
          'uuid-9999', 'FARMACIA_POPULAR', 'FP20261116000003', 'STATUS_INVALIDO',
          '12345678900', 'Joao da Silva', '12345', 'PR', '2026-11-10',
          12.00, 12.00, 0.00
        )
      `).run();
    }).toThrow();

    // Cascade delete: Deleting transaction should delete transaction items
    db.prepare('DELETE FROM pbm_transactions WHERE id = ?').run(transId);
    const remainingItems = db
      .prepare('SELECT COUNT(*) as count FROM pbm_transaction_items WHERE pbm_transaction_id = ?')
      .get(transId) as { count: number };
    expect(remainingItems.count).toBe(0);
  });

  it('should correctly type check domain interfaces', () => {
    const config: PbmConfig = {
      id: 1,
      providerId: 'FARMACIA_POPULAR',
      providerName: 'Aqui Tem Farmacia Popular',
      environment: 'MOCK',
      isActive: 1,
      credentialsJson: null,
      createdAt: '2026-11-16 10:00:00',
      updatedAt: '2026-11-16 10:00:00',
    };
    expect(config.providerId).toBe('FARMACIA_POPULAR');

    const itemReq: PbmItemRequest = {
      productId: 1,
      ean: '7891234567890',
      msRegistration: '1234567890123',
      productName: 'Losartana 50mg',
      quantity: 1,
      unitPrice: 12.00,
    };
    expect(itemReq.quantity).toBe(1);

    const authParams: PbmAuthorizeParams = {
      providerId: 'FARMACIA_POPULAR',
      patientCpf: '12345678900',
      patientName: 'Joao da Silva',
      doctorCrm: '12345',
      doctorUf: 'PR',
      prescriptionDate: '2026-11-10',
      items: [itemReq],
    };
    expect(authParams.patientCpf).toBe('12345678900');
  });
});
