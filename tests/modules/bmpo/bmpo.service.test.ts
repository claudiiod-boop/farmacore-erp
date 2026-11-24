import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { BmpoService } from '../../../src/modules/bmpo/bmpo.service';

describe('BmpoService (Balanços Oficiais BMPO, RMNRA & RMNRB Portaria 344/98)', () => {
  let db: Database;
  let service: BmpoService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new BmpoService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('1. Deve gerar o BMPO trimestral com movimentação de estoque dos produtos controlados', () => {
    // Inserir produto controlado lista B1
    const prodRes = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7891234560001', 'Clonazepam 2mg 30 comp', 'Clonazepam', '1004300010011', 'PRETA', 'B1', 25.0, 10.0, 19.5)
    `).run();
    const prodId = Number(prodRes.lastInsertRowid);

    // Inserir lote com estoque atual de 20 caixas
    const batchRes = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'L-CLONA-01', '2026-01-01', '2028-01-01', 20)
    `).run(prodId);
    const batchId = Number(batchRes.lastInsertRowid);

    // Inserir movimentação de entrada de 10 caixas no 4º trimestre
    db.prepare(`
      INSERT INTO sngpc_movements (
        product_id, batch_id, movement_type, quantity, reference_type, reference_id, movement_date, ms_registration
      ) VALUES (?, ?, 'ENTRADA', 10, 'PURCHASE_INVOICE', 101, '2026-10-15', '1004300010011')
    `).run(prodId, batchId);

    // Inserir movimentação de saída (venda) de 5 caixas no 4º trimestre
    db.prepare(`
      INSERT INTO sngpc_movements (
        product_id, batch_id, movement_type, quantity, reference_type, reference_id, movement_date, ms_registration
      ) VALUES (?, ?, 'SAIDA_VENDA', 5, 'SALE', 202, '2026-11-10', '1004300010011')
    `).run(prodId, batchId);

    const report = service.generateBmpo({
      store_id: 1,
      report_type: 'BMPO_TRIMESTRAL',
      period_year: 2026,
      period_quarter: 4,
      pharmacist_name: 'Dra. Camila Farmacêutica',
      pharmacist_crf: 'CRF-SP 12345',
      observations: 'Fechamento do 4º Trimestre / 2026',
    });

    expect(report).toBeDefined();
    expect(report.report_type).toBe('BMPO_TRIMESTRAL');
    expect(report.period_quarter).toBe(4);
    expect(report.status).toBe('DRAFT');

    const item = report.items.find((it) => it.product_id === prodId);
    expect(item).toBeDefined();
    expect(item?.active_ingredient).toBe('Clonazepam');
    expect(item?.control_list).toBe('B1');
    expect(item?.acquisitions).toBe(10);
    expect(item?.sales).toBe(5);
    expect(item?.final_stock).toBe(20);
  });

  it('2. Deve gerar a Relação Mensal RMNRA e RMNRB a partir de receitas retidas', () => {
    // Inserir produtos das listas A e B
    const prodA = Number(db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('789000000001', 'Morfina 30mg 20 comp', 'Morfina', '1001', 'PRETA', 'A1', 80.0, 40.0, 70.0)
    `).run().lastInsertRowid);

    const prodB = Number(db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('789000000002', 'Bromazepam 3mg 30 comp', 'Bromazepam', '1002', 'PRETA', 'B1', 30.0, 15.0, 22.0)
    `).run().lastInsertRowid);

    // Lotes para os produtos
    const bA = Number(db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'L-MORF-01', '2026-01-01', '2028-01-01', 10)
    `).run(prodA).lastInsertRowid);

    const bB = Number(db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'L-BROM-02', '2026-01-01', '2028-01-01', 10)
    `).run(prodB).lastInsertRowid);

    // Pré-venda e receita Notificação A
    const psA = Number(db.prepare(`
      INSERT INTO pre_sales (code, customer_name, status, total_amount) VALUES ('PV-001', 'Maria Dor', 'COMPLETED', 70.0)
    `).run().lastInsertRowid);

    db.prepare(`
      INSERT INTO pre_sale_items (pre_sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, 1, 70.0, 70.0)
    `).run(psA, prodA, bA);

    db.prepare(`
      INSERT INTO prescriptions (
        pre_sale_id, doctor_name, doctor_crm, doctor_uf, prescription_type, prescription_date, patient_name, notification_number
      ) VALUES (?, 'Dr. Oncologista', 'CRM 11223', 'SP', 'A', '2026-11-05', 'Maria Dor', 'NOTIF-A-5544')
    `).run(psA);

    // Pré-venda e receita Notificação B
    const psB = Number(db.prepare(`
      INSERT INTO pre_sales (code, customer_name, status, total_amount) VALUES ('PV-002', 'João Silva', 'COMPLETED', 22.0)
    `).run().lastInsertRowid);

    db.prepare(`
      INSERT INTO pre_sale_items (pre_sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, 1, 22.0, 22.0)
    `).run(psB, prodB, bB);

    db.prepare(`
      INSERT INTO prescriptions (
        pre_sale_id, doctor_name, doctor_crm, doctor_uf, prescription_type, prescription_date, patient_name, notification_number
      ) VALUES (?, 'Dr. Psiquiatra', 'CRM 99887', 'SP', 'B', '2026-11-12', 'João Silva', 'NOTIF-B-7788')
    `).run(psB);

    // Gera RMNRA
    const rmnra = service.generateRmnr({
      store_id: 1,
      report_type: 'RMNRA',
      period_year: 2026,
      period_month: 11,
      pharmacist_name: 'Dra. Camila',
      pharmacist_crf: 'CRF-SP 12345',
    });

    expect(rmnra.prescriptions.length).toBe(1);
    expect(rmnra.prescriptions[0].prescription_notification_number).toBe('NOTIF-A-5544');
    expect(rmnra.prescriptions[0].patient_name).toBe('Maria Dor');

    // Gera RMNRB
    const rmnrb = service.generateRmnr({
      store_id: 1,
      report_type: 'RMNRB',
      period_year: 2026,
      period_month: 11,
      pharmacist_name: 'Dra. Camila',
      pharmacist_crf: 'CRF-SP 12345',
    });

    expect(rmnrb.prescriptions.length).toBe(1);
    expect(rmnrb.prescriptions[0].prescription_notification_number).toBe('NOTIF-B-7788');
    expect(rmnrb.prescriptions[0].patient_name).toBe('João Silva');
  });

  it('3. Deve protocolar entrega oficial na VISA e bloquear exclusão de relatório protocolado', () => {
    const report = service.generateBmpo({
      store_id: 1,
      report_type: 'BMPO_ANUAL',
      period_year: 2026,
      pharmacist_name: 'Dr. Roberto',
      pharmacist_crf: 'CRF-RJ 99881',
    });

    expect(report.status).toBe('DRAFT');

    const filed = service.fileReportWithVisa({
      report_id: report.id,
      visa_protocol_number: 'VISA-MUNICIPAL-2026-998844',
      visa_filing_date: '2026-11-23',
      observations: 'Entregue com sucesso no balcão da vigilância sanitária',
    });

    expect(filed.status).toBe('FILED_WITH_VISA');
    expect(filed.visa_protocol_number).toBe('VISA-MUNICIPAL-2026-998844');

    // Tentativa de exclusão de relatório protocolado deve falhar
    expect(() => service.deleteReport(report.id)).toThrowError(/CANNOT_DELETE_FILED_REPORT/);
  });

  it('4. Deve permitir excluir rascunho de relatório não protocolado', () => {
    const report = service.generateBmpo({
      store_id: 1,
      report_type: 'BMPO_TRIMESTRAL',
      period_year: 2026,
      period_quarter: 1,
      pharmacist_name: 'Dra. Camila',
      pharmacist_crf: 'CRF-SP 12345',
    });

    expect(service.getReportById(report.id)).not.toBeNull();
    service.deleteReport(report.id);
    expect(service.getReportById(report.id)).toBeNull();
  });

  it('5. Deve calcular KPIs regulatórios com exatidão', () => {
    const kpisInitial = service.getRegulatoryKpis(1);
    expect(kpisInitial.total_reports).toBe(0);

    const r1 = service.generateBmpo({
      store_id: 1,
      report_type: 'BMPO_TRIMESTRAL',
      period_year: 2026,
      period_quarter: 2,
      pharmacist_name: 'Dra. Camila',
      pharmacist_crf: 'CRF-SP 12345',
    });

    service.generateRmnr({
      store_id: 1,
      report_type: 'RMNRA',
      period_year: 2026,
      period_month: 5,
      pharmacist_name: 'Dra. Camila',
      pharmacist_crf: 'CRF-SP 12345',
    });

    service.fileReportWithVisa({
      report_id: r1.id,
      visa_protocol_number: 'PROTO-123',
      visa_filing_date: '2026-06-15',
    });

    const kpisUpdated = service.getRegulatoryKpis(1);
    expect(kpisUpdated.total_reports).toBe(2);
    expect(kpisUpdated.filed_reports).toBe(1);
    expect(kpisUpdated.pending_filings).toBe(1);
    expect(kpisUpdated.rmnra_count).toBe(1);
  });

  it('6. Deve gerar documento oficial formatado para impressão A4 com termos de responsabilidade', () => {
    const report = service.generateBmpo({
      store_id: 1,
      report_type: 'BMPO_TRIMESTRAL',
      period_year: 2026,
      period_quarter: 3,
      pharmacist_name: 'Dra. Renata Sanitarista',
      pharmacist_crf: 'CRF-MG 33221',
    });

    const doc = service.generateOfficialPrintDocument(report.id);
    expect(doc).toContain('REPÚBLICA FEDERATIVA DO BRASIL');
    expect(doc).toContain('PORTARIA SVS/MS Nº 344/1998');
    expect(doc).toContain('BMPO_TRIMESTRAL');
    expect(doc).toContain('Dra. Renata Sanitarista');
    expect(doc).toContain('TERMO DE RESPONSABILIDADE E ENCERRAMENTO');
  });
});
