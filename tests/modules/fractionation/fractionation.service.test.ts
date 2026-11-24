import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { FractionationService } from '../../../src/modules/fractionation/fractionation.service';

describe('FractionationService (Fracionamento de Medicamentos em Blíster - RDC 80/2006)', () => {
  let db: Database;
  let service: FractionationService;
  let storeId: number;
  let productId: number;
  let batchId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new FractionationService(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    // Cadastra produto com embalagem fracionável de 30 comprimidos
    const prodRes = db.prepare(`
      INSERT INTO products (
        name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price,
        is_fractionable, units_per_package, fractional_unit
      ) VALUES (
        'Dipirona Monoidratada 500mg 30 comp', '7891234567800', 'Dipirona', '100000055', 'RED', 'NONE',
        24.0, 12.0, 18.0, 1, 30, 'COMPRIMIDO'
      )
    `).run();
    productId = Number(prodRes.lastInsertRowid);

    // Cadastra lote pai com 10 caixas fechadas
    const batchRes = db.prepare(`
      INSERT INTO batches (
        product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
      ) VALUES (
        ?, 'LOTE-DIP-99', '2026-01-10', '2028-01-10', 10, 0
      )
    `).run(productId);
    batchId = Number(batchRes.lastInsertRowid);
  });

  afterEach(() => {
    db.close();
  });

  it('should list fractionable products and toggle fractionable status', () => {
    const list = service.listFractionableProducts();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].id).toBe(productId);

    // Desabilita fracionamento
    const updated = service.toggleProductFractionable(productId, false, 30, 'COMPRIMIDO');
    expect(updated.is_fractionable).toBe(0);

    const emptyList = service.listFractionableProducts();
    expect(emptyList.some((p) => p.id === productId)).toBe(false);

    // Reabilita
    service.toggleProductFractionable(productId, true, 30, 'COMPRIMIDO');
  });

  it('should reject fractionating non-fractionable product or with insufficient batch stock', () => {
    // 1. Produto não fracionável
    const nonFracProd = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_fractionable)
      VALUES ('Xarope Frasco Único', '789000000001', 'Guaifenesina', '100000002', 'NONE', 'NONE', 20.0, 10.0, 15.0, 0)
    `).run();
    const nonFracBatch = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'LOTE-XAR-01', '2026-01-01', '2027-01-01', 5)
    `).run(nonFracProd.lastInsertRowid);

    expect(() => {
      service.fractionateMedicine({
        store_id: storeId,
        product_id: Number(nonFracProd.lastInsertRowid),
        original_batch_id: Number(nonFracBatch.lastInsertRowid),
        pharmacist_name: 'Dra. Ana',
        pharmacist_crf: '12345',
        pharmacist_crf_uf: 'SP',
        original_packages_opened: 1,
      });
    }).toThrow('PRODUCT_NOT_FRACTIONABLE');

    // 2. Estoque insuficiente no lote pai (tenta abrir 20 caixas tendo apenas 10)
    expect(() => {
      service.fractionateMedicine({
        store_id: storeId,
        product_id: productId,
        original_batch_id: batchId,
        pharmacist_name: 'Dra. Ana',
        pharmacist_crf: '12345',
        pharmacist_crf_uf: 'SP',
        original_packages_opened: 20,
      });
    }).toThrow('INSUFFICIENT_BATCH_STOCK');
  });

  it('should fractionate medicine successfully and deduct original batch stock', () => {
    // Abre 2 caixas de 30 comprimidos = 60 comprimidos
    const record = service.fractionateMedicine({
      store_id: storeId,
      product_id: productId,
      original_batch_id: batchId,
      pharmacist_name: 'Dr. Lucas Ferreira',
      pharmacist_crf: '77665',
      pharmacist_crf_uf: 'SP',
      original_packages_opened: 2,
      notes: 'Blísteres intactos conferidos em bancada',
    });

    expect(record.id).toBeGreaterThan(0);
    expect(record.original_packages_opened).toBe(2);
    expect(record.units_generated).toBe(60);
    expect(record.units_available).toBe(60);
    expect(record.sub_batch_code).toMatch(/^FRAC-LOTE-DIP-99-/);
    expect(record.expiry_date).toBe('2028-01-10');

    // Saldo do lote pai deve cair de 10 para 8
    const updatedBatch = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(batchId) as any;
    expect(updatedBatch.quantity).toBe(8);
  });

  it('should dispense fractioned medicine with prescription and leaflet tracking', () => {
    // 1. Fraciona 1 caixa (30 comprimidos)
    const record = service.fractionateMedicine({
      store_id: storeId,
      product_id: productId,
      original_batch_id: batchId,
      pharmacist_name: 'Dr. Lucas Ferreira',
      pharmacist_crf: '77665',
      pharmacist_crf_uf: 'SP',
      original_packages_opened: 1,
    });

    // 2. Tenta dispensar mais do que o disponível
    expect(() => {
      service.dispenseFractioned({
        fractionation_record_id: record.id,
        patient_name: 'Marcos Silva',
        doctor_name: 'Dr. Pedro',
        doctor_crm: '44556',
        doctor_uf: 'SP',
        units_dispensed: 50, // só tem 30
        posology: 'Tomar 1 comp de 6 em 6 horas',
      });
    }).toThrow('INSUFFICIENT_FRACTIONED_STOCK');

    // 3. Dispensação válida de 10 comprimidos
    // Preço da caixa: 18.00 / 30 = 0.60 por comprimido. 10 comp = 6.00
    const disp = service.dispenseFractioned({
      fractionation_record_id: record.id,
      patient_name: 'Marcos Silva',
      patient_cpf: '333.444.555-66',
      doctor_name: 'Dr. Pedro Pediatra',
      doctor_crm: '44556',
      doctor_uf: 'SP',
      units_dispensed: 10,
      posology: 'Tomar 1 comp em caso de febre ou dor',
      leaflet_supplied: true,
    });

    expect(disp.id).toBeGreaterThan(0);
    expect(disp.units_dispensed).toBe(10);
    expect(disp.unit_price).toBe(0.60);
    expect(disp.total_price).toBe(6.00);
    expect(disp.leaflet_supplied).toBe(1);

    // Verifica saldo remanescente (30 - 10 = 20)
    const refreshed = service.getFractionationRecord(record.id);
    expect(refreshed.units_available).toBe(20);
    expect(refreshed.dispensations).toHaveLength(1);
  });

  it('should generate official thermal label conforming to RDC 80/2006 Art. 8', () => {
    const record = service.fractionateMedicine({
      store_id: storeId,
      product_id: productId,
      original_batch_id: batchId,
      pharmacist_name: 'Dra. Julia Farmacêutica',
      pharmacist_crf: '99112',
      pharmacist_crf_uf: 'SP',
      original_packages_opened: 1,
    });

    const disp = service.dispenseFractioned({
      fractionation_record_id: record.id,
      patient_name: 'Valéria Costa',
      doctor_name: 'Dra. Helena Médica',
      doctor_crm: '88776',
      doctor_uf: 'SP',
      units_dispensed: 8,
      posology: 'Tomar 1 comp a cada 8 horas por 3 dias',
      leaflet_supplied: true,
    });

    const label = service.generateOfficialLabel(disp.id);

    expect(label).toContain('ROTULO DE DISPENSACAO FRACIONADA (RDC 80/2006 ANVISA)');
    expect(label).toContain('MEDICAMENTO: DIPIRONA MONOIDRATADA 500MG 30 COMP');
    expect(label).toContain('LOTE ORIGINAL: LOTE-DIP-99');
    expect(label).toContain(record.sub_batch_code);
    expect(label).toContain('FARMACEUTICO(A) RT: DRA. JULIA FARMACÊUTICA');
    expect(label).toContain('CRF: 99112/SP');
    expect(label).toContain('PACIENTE: VALÉRIA COSTA');
    expect(label).toContain('QTD DISPENSADA: 8 COMPRIMIDO');
    expect(label).toContain('[X] COPIA DA BULA OFICIAL ENTREGUE AO PACIENTE');
  });

  it('should calculate accurate fractionation KPIs', () => {
    const record = service.fractionateMedicine({
      store_id: storeId,
      product_id: productId,
      original_batch_id: batchId,
      pharmacist_name: 'Dra. Julia',
      pharmacist_crf: '99112',
      pharmacist_crf_uf: 'SP',
      original_packages_opened: 1,
    });

    service.dispenseFractioned({
      fractionation_record_id: record.id,
      patient_name: 'Valéria Costa',
      doctor_name: 'Dra. Helena',
      doctor_crm: '88776',
      doctor_uf: 'SP',
      units_dispensed: 10,
      posology: '1 comp/dia',
    });

    const kpis = service.getFractionationKpis();
    expect(kpis.totalFractionations).toBe(1);
    expect(kpis.activeSubBatches).toBe(1);
    expect(kpis.totalUnitsAvailable).toBe(20);
    expect(kpis.totalDispensations).toBe(1);
    expect(kpis.fractionableProductsCount).toBeGreaterThanOrEqual(1);
    expect(kpis.estimatedConsumerSavings).toBeGreaterThan(0);
  });
});
