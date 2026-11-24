import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { PgrssDisposalService } from '../../../src/modules/pgrss/pgrss.service';

describe('PgrssDisposalService (Descarte Sanitário & PGRSS RDC 222/2018)', () => {
  let db: Database;
  let service: PgrssDisposalService;
  let storeId: number;
  let productId: number;
  let batchId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new PgrssDisposalService(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    // Inserir produto
    const prodRes = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7891234567890', 'Clavulin BD 875mg', 'Amoxicilina + Clavulanato', '1.0001.0002', 'RED', 'ANTIMICROBIANO', 85.0, 45.0, 72.0)
    `).run();
    productId = Number(prodRes.lastInsertRowid);

    // Inserir lote com 20 unidades
    const batchRes = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (?, 'L-CLAV-01', '2024-01-01', '2025-10-01', 20, ?)
    `).run(productId, storeId);
    batchId = Number(batchRes.lastInsertRowid);
  });

  afterEach(() => {
    db.close();
  });

  it('should segregate medicine for disposal, deduct batch quantity and create STORED record', () => {
    const record = service.segregateWaste({
      store_id: storeId,
      product_id: productId,
      batch_id: batchId,
      waste_group: 'GRUPO_B_QUIMICO',
      reason: 'VENCIDO',
      quantity: 5,
      weight_kg: 0.35,
      pharmacist_name: 'Dr. Lucas Medeiros',
      pharmacist_crf: 'CRF-SP 55443',
      notes: 'Vencimento ocorrido no mês anterior',
    });

    expect(record.id).toBeDefined();
    expect(record.status).toBe('STORED');
    expect(record.quantity).toBe(5);
    expect(record.weight_kg).toBe(0.35);
    expect(record.product_name).toContain('Clavulin BD');
    expect(record.batch_number).toBe('L-CLAV-01');

    // Verificar se o estoque do lote foi deduzido (20 - 5 = 15)
    const updatedBatch = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(batchId) as { quantity: number };
    expect(updatedBatch.quantity).toBe(15);
  });

  it('should throw error when segregating more quantity than available in batch', () => {
    expect(() => {
      service.segregateWaste({
        store_id: storeId,
        product_id: productId,
        batch_id: batchId,
        waste_group: 'GRUPO_B_QUIMICO',
        reason: 'AVARIADO',
        quantity: 25, // Disponível é 20
        weight_kg: 1.5,
        pharmacist_name: 'Dra. Ana',
        pharmacist_crf: 'CRF-SP 12345',
      });
    }).toThrow(/Saldo insuficiente/);
  });

  it('should list waste records by store and status filters', () => {
    service.segregateWaste({
      store_id: storeId,
      product_id: productId,
      batch_id: batchId,
      waste_group: 'GRUPO_B_QUIMICO',
      reason: 'VENCIDO',
      quantity: 2,
      weight_kg: 0.14,
      pharmacist_name: 'Dr. Lucas',
      pharmacist_crf: 'CRF-SP 55443',
    });

    const storedList = service.listWasteRecords({ store_id: storeId, status: 'STORED' });
    expect(storedList.length).toBe(1);

    const dispatchedList = service.listWasteRecords({ store_id: storeId, status: 'DISPATCHED' });
    expect(dispatchedList.length).toBe(0);
  });

  it('should create MTR manifest, update record statuses to DISPATCHED and generate official document', () => {
    const rec1 = service.segregateWaste({
      store_id: storeId,
      product_id: productId,
      batch_id: batchId,
      waste_group: 'GRUPO_B_QUIMICO',
      reason: 'VENCIDO',
      quantity: 3,
      weight_kg: 0.21,
      pharmacist_name: 'Dr. Lucas',
      pharmacist_crf: 'CRF-SP 55443',
    });

    const manifest = service.createMtrManifest({
      store_id: storeId,
      collector_name: 'EcoLog Resíduos Hospitalares',
      collector_cnpj: '11.222.333/0001-44',
      environmental_license: 'LO-CETESB-2026/099',
      vehicle_plate: 'PQR-9876',
      driver_name: 'Marcos Silva',
      disposal_record_ids: [rec1.id],
    });

    expect(manifest.id).toBeDefined();
    expect(manifest.manifest_number).toContain('MTR-');
    expect(manifest.status).toBe('DISPATCHED');
    expect(manifest.total_weight_kg).toBe(0.21);
    expect(manifest.total_items).toBe(1);

    // O registro individual agora deve estar DISPATCHED
    const updatedRec = service.getRecordById(rec1.id);
    expect(updatedRec.status).toBe('DISPATCHED');

    // Documento espelho
    const doc = service.generateMtrDocument(manifest.id);
    expect(doc).toContain('MANIFESTO DE TRANSPORTE DE RESÍDUOS (MTR)');
    expect(doc).toContain('EcoLog Resíduos Hospitalares');
    expect(doc).toContain('PQR-9876');
  });

  it('should finalize MTR manifest with CDF (Certificado de Destinação Final) and mark items INCINERATED', () => {
    const rec = service.segregateWaste({
      store_id: storeId,
      product_id: productId,
      batch_id: batchId,
      waste_group: 'GRUPO_B_QUIMICO',
      reason: 'VENCIDO',
      quantity: 4,
      weight_kg: 0.28,
      pharmacist_name: 'Dr. Lucas',
      pharmacist_crf: 'CRF-SP 55443',
    });

    const manifest = service.createMtrManifest({
      store_id: storeId,
      collector_name: 'EcoLog Resíduos Hospitalares',
      collector_cnpj: '11.222.333/0001-44',
      environmental_license: 'LO-CETESB-2026/099',
      vehicle_plate: 'PQR-9876',
      driver_name: 'Marcos Silva',
      disposal_record_ids: [rec.id],
    });

    const finalized = service.finalizeWithCdf(manifest.id, {
      cdf_number: 'CDF-2026-998877',
      certificate_date: '2026-11-24',
      incineration_plant: 'Usina Termo-Ambiental SP-01',
    });

    expect(finalized.status).toBe('DESTINED');
    expect(finalized.cdf_number).toBe('CDF-2026-998877');

    const finalizedRec = service.getRecordById(rec.id);
    expect(finalizedRec.status).toBe('INCINERATED');
  });

  it('should calculate accurate PGRSS KPIs', () => {
    service.segregateWaste({
      store_id: storeId,
      product_id: productId,
      batch_id: batchId,
      waste_group: 'GRUPO_B_QUIMICO',
      reason: 'AVARIADO',
      quantity: 2,
      weight_kg: 0.15,
      pharmacist_name: 'Dr. Lucas',
      pharmacist_crf: 'CRF-SP 55443',
    });

    const kpis = service.getPgrssKpis(storeId);
    expect(kpis.stored_records_count).toBe(1);
    expect(kpis.stored_weight_kg).toBe(0.15);
    expect(kpis.dispatched_records_count).toBe(0);
    expect(kpis.incinerated_records_count).toBe(0);
  });
});
