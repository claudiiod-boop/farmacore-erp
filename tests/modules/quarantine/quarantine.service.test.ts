import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { QuarantineService } from '../../../src/modules/quarantine/quarantine.service';

describe('QuarantineService (Quarentena Sanitária, Lotes Vencidos & Recalls Notivisa)', () => {
  let db: Database;
  let service: QuarantineService;
  let storeId: number;
  let prodId: number;
  let validBatchId: number;
  let expiredBatchId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new QuarantineService(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    // Criar produto
    const p = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7891234567890', 'Amoxicilina 500mg 21 cápsulas', 'Amoxicilina', '1004300011', 'VERMELHA', 'NONE', 30.0, 10.0, 20.0)
    `).run();
    prodId = Number(p.lastInsertRowid);

    // Lote Válido (quantidade 50)
    const b1 = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'L-AMOX-VLD', '2026-01-01', '2028-12-31', 50)
    `).run(prodId);
    validBatchId = Number(b1.lastInsertRowid);

    // Lote Vencido (quantidade 15, validade 2025-10-10)
    const b2 = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'L-AMOX-EXP', '2024-01-01', '2025-10-10', 15)
    `).run(prodId);
    expiredBatchId = Number(b2.lastInsertRowid);
  });

  afterEach(() => {
    db.close();
  });

  it('quarantineBatch deduz estoque vendável e cria registro de quarentena', () => {
    const res = service.quarantineBatch({
      storeId,
      productId: prodId,
      batchId: validBatchId,
      quantity: 10,
      reason: 'DAMAGED',
      origin: 'MANUAL',
      notes: 'Caixas molhadas durante descarregamento',
      quarantinedBy: 'Farmacêutico RT',
    });

    expect(res.quarantineId).toBeGreaterThan(0);
    expect(res.quantity).toBe(10);
    expect(res.status).toBe('QUARANTINED');

    // Saldo vendável do lote deve ter caído de 50 para 40
    const batch = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(validBatchId) as { quantity: number };
    expect(batch.quantity).toBe(40);

    const record = service.getQuarantineById(res.quarantineId);
    expect(record.reason).toBe('DAMAGED');
    expect(record.product_name).toContain('Amoxicilina');
  });

  it('quarantineBatch rejeita transferência quando quantidade excede estoque vendável', () => {
    expect(() => {
      service.quarantineBatch({
        storeId,
        productId: prodId,
        batchId: validBatchId,
        quantity: 99, // Apenas 50 disponíveis
        reason: 'SUSPECTED_ADULTERATION',
        origin: 'INBOUND_INSPECTION',
        quarantinedBy: 'Fiscal de Loja',
      });
    }).toThrow(/excede o saldo disponível/);
  });

  it('sweepExpiredBatches localiza lotes vencidos e transfere para quarentena zerando saldo vendável', () => {
    const sweepRes = service.sweepExpiredBatches(storeId, 'Robô de Varredura Noturna');
    expect(sweepRes.sweptBatchesCount).toBe(1);
    expect(sweepRes.totalUnitsQuarantined).toBe(15);
    expect(sweepRes.records[0].batchNumber).toBe('L-AMOX-EXP');

    // Saldo vendável do lote vencido deve ter sido zerado
    const batch = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(expiredBatchId) as { quantity: number };
    expect(batch.quantity).toBe(0);

    // Deve constar na lista de quarentena
    const list = service.listQuarantine(storeId, { reason: 'EXPIRED' });
    expect(list.length).toBe(1);
    expect(list[0].quantity).toBe(15);
  });

  it('registerRecallAlert cadastra alerta Notivisa e bloqueia estoque vendável automaticamente', () => {
    const recall = service.registerRecallAlert({
      anvisaReNumber: 'RE 1.234/2026',
      publicationDate: '2026-11-24',
      productId: prodId,
      batchNumber: 'L-AMOX-VLD',
      reason: 'Desvio de qualidade / dissolução insatisfatória',
      severity: 'CRITICAL',
      createdBy: 'Farmacovigilância ANVISA',
      autoBlockStock: true,
    });

    expect(recall.recallId).toBeGreaterThan(0);
    expect(recall.unitsBlocked).toBe(50);

    // O lote válido agora deve ter saldo vendável 0
    const batch = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(validBatchId) as { quantity: number };
    expect(batch.quantity).toBe(0);

    // Registro de quarentena gerado
    const list = service.listQuarantine(storeId, { reason: 'RECALL_ANVISA' });
    expect(list.length).toBe(1);
    expect(list[0].quantity).toBe(50);
    expect(list[0].notes).toContain('RE 1.234/2026');
  });

  it('resolveQuarantine com DISPOSED_PGRSS gera descarte no Grupo B e resolve quarentena', () => {
    const quar = service.quarantineBatch({
      storeId,
      productId: prodId,
      batchId: validBatchId,
      quantity: 5,
      reason: 'DAMAGED',
      origin: 'MANUAL',
      quarantinedBy: 'Operador 1',
    });

    const resolved = service.resolveQuarantine(quar.quarantineId, {
      resolution: 'DISPOSED_PGRSS',
      resolvedBy: 'Dra. Julia Santos',
      pharmacistCrf: 'CRF/SP 44556',
      resolutionNotes: 'Frascos quebrados encaminhados para incineração',
    });

    expect(resolved.status).toBe('DISPOSED_PGRSS');
    expect(resolved.pgrss_disposal_id).toBeDefined();

    // Registro na tabela pgrss_disposal_records
    const pgrssRec = db.prepare('SELECT * FROM pgrss_disposal_records WHERE id = ?').get(resolved.pgrss_disposal_id) as any;
    expect(pgrssRec.waste_group).toBe('GRUPO_B_QUIMICO');
    expect(pgrssRec.quantity).toBe(5);
    expect(pgrssRec.pharmacist_crf).toBe('CRF/SP 44556');
  });

  it('resolveQuarantine com RETURNED_TO_SUPPLIER gera chave de NF-e de remessa', () => {
    const quar = service.quarantineBatch({
      storeId,
      productId: prodId,
      batchId: validBatchId,
      quantity: 20,
      reason: 'CUSTOMER_RETURN',
      origin: 'CUSTOMER_RETURN',
      quarantinedBy: 'Operador 1',
    });

    const resolved = service.resolveQuarantine(quar.quarantineId, {
      resolution: 'RETURNED_TO_SUPPLIER',
      resolvedBy: 'Gerente Compras',
      resolutionNotes: 'Devolução ao laboratório para ressarcimento',
    });

    expect(resolved.status).toBe('RETURNED_TO_SUPPLIER');
    expect(resolved.fiscal_nfe_key).toBeDefined();
    expect(resolved.fiscal_nfe_key?.length).toBe(44);
  });

  it('resolveQuarantine com RELEASED exige CRF e restaura saldo vendável no lote', () => {
    const quar = service.quarantineBatch({
      storeId,
      productId: prodId,
      batchId: validBatchId,
      quantity: 10,
      reason: 'SUSPECTED_ADULTERATION',
      origin: 'MANUAL',
      quarantinedBy: 'Operador 1',
    });

    // Sem CRF deve falhar
    expect(() => {
      service.resolveQuarantine(quar.quarantineId, {
        resolution: 'RELEASED',
        resolvedBy: 'Farmacêutico RT',
      });
    }).toThrow(/exige o CRF/);

    // Com CRF deve aprovar e restaurar estoque
    const batchBefore = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(validBatchId) as { quantity: number };
    expect(batchBefore.quantity).toBe(40); // 50 - 10

    const resolved = service.resolveQuarantine(quar.quarantineId, {
      resolution: 'RELEASED',
      resolvedBy: 'Dra. Ana Paula',
      pharmacistCrf: 'CRF/SP 77889',
      resolutionNotes: 'Inspeção analítica atestou integridade do lote',
    });

    expect(resolved.status).toBe('RELEASED');
    expect(resolved.resolved_by).toContain('CRF/SP 77889');

    const batchAfter = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(validBatchId) as { quantity: number };
    expect(batchAfter.quantity).toBe(50); // Restaurado
  });

  it('getKpis calcula métricas de quarentena, valor em risco e recalls', () => {
    service.quarantineBatch({
      storeId,
      productId: prodId,
      batchId: validBatchId,
      quantity: 10,
      reason: 'EXPIRED',
      origin: 'INVENTORY_SWEEP',
      quarantinedBy: 'Operador 1',
    });

    service.registerRecallAlert({
      anvisaReNumber: 'RE 9.999/2026',
      publicationDate: '2026-11-24',
      productId: prodId,
      batchNumber: 'L-AMOX-VLD',
      reason: 'Contaminação cruzada',
      severity: 'CRITICAL',
      createdBy: 'ANVISA',
      autoBlockStock: false,
    });

    const kpis = service.getKpis(storeId);
    expect(kpis.total_quarantined_items).toBe(10);
    expect(kpis.total_quarantined_value).toBe(300.0); // 10 * 30.0 PMC
    expect(kpis.expired_items_in_quarantine).toBe(10);
    expect(kpis.active_recalls_count).toBe(1);
  });
});
