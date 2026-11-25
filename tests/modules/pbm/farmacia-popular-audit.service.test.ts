import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { FarmaciaPopularAuditService } from '../../../src/modules/pbm/farmacia-popular-audit.service';

describe('FarmaciaPopularAuditService Unit Tests', () => {
  let db: Database;
  let service: FarmaciaPopularAuditService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new FarmaciaPopularAuditService(db);

    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj) VALUES (1, 'FarmaCore Matriz', '12.345.678/0001-99')
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pbm_configs (provider_id, provider_name, environment, is_active)
      VALUES ('FARMACIA_POPULAR', 'Programa Farmácia Popular do Brasil', 'MOCK', 1)
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('1. Importa lote de repasse do FNS e identifica glosa financeira', async () => {
    const batch = await service.importSettlementBatch({
      store_id: 1,
      batch_reference: 'FNS-OUTUBRO-2026',
      competence_month: '2026-10',
      credit_date: '2026-11-15',
      items: [
        {
          authorization_code: 'AUTH-FP-001',
          patient_cpf: '111.222.333-44',
          patient_name: 'Carlos Oliveira',
          prescriber_crm: '12345',
          prescriber_uf: 'SP',
          authorized_ms_amount: 100.0,
          credited_fns_amount: 100.0
        },
        {
          authorization_code: 'AUTH-FP-002',
          patient_cpf: '555.666.777-88',
          patient_name: 'Ana Souza',
          prescriber_crm: '67890',
          prescriber_uf: 'SP',
          authorized_ms_amount: 80.0,
          credited_fns_amount: 50.0,
          gloss_reason: 'Divergência de posologia'
        }
      ]
    });

    expect(batch.id).toBeDefined();
    expect(batch.total_authorized_amount).toBe(180.0);
    expect(batch.total_credited_amount).toBe(150.0);
    expect(batch.total_loss_amount).toBe(30.0);
    expect(batch.status).toBe('DISCREPANT');

    const items = await service.listAuditItems({ settlement_batch_id: batch.id });
    expect(items.length).toBe(2);
    expect(items[0].status).toBe('APPROVED');
    expect(items[1].status).toBe('PARTIALLY_GLOSSED');
    expect(items[1].gloss_amount).toBe(30.0);
  });

  it('2. Registra e calcula período de guarda legal de 5 anos de dossiê digital', async () => {
    const dossier = await service.registerDigitalDossier({
      store_id: 1,
      authorization_code: 'AUTH-FP-001',
      patient_cpf: '111.222.333-44',
      patient_name: 'Carlos Oliveira',
      dispensation_date: '2026-11-25',
      signed_coupon_file_path: '/uploads/fp/cupom_001.pdf',
      prescription_file_path: '/uploads/fp/receita_001.pdf'
    });

    expect(dossier.id).toBeDefined();
    expect(dossier.retention_deadline).toBe('2031-11-25');
    expect(dossier.status).toBe('ARCHIVED');
    expect(dossier.sha256_integrity_hash).toBeDefined();
    expect(dossier.sha256_integrity_hash.length).toBe(64);
  });

  it('3. Marca dossiê como PENDING_DOCS se faltar receita médica anexada', async () => {
    const dossier = await service.registerDigitalDossier({
      store_id: 1,
      authorization_code: 'AUTH-FP-003',
      patient_cpf: '999.888.777-66',
      patient_name: 'Roberto Dias',
      dispensation_date: '2026-11-20',
      signed_coupon_file_path: '/uploads/fp/cupom_003.pdf'
    });

    expect(dossier.status).toBe('PENDING_DOCS');
  });

  it('4. Abre contestação administrativa formal de glosa junto ao Ministério da Saúde', async () => {
    const batch = await service.importSettlementBatch({
      store_id: 1,
      batch_reference: 'FNS-TEST-GLOSS',
      competence_month: '2026-10',
      credit_date: '2026-11-15',
      items: [
        {
          authorization_code: 'AUTH-GLOSS-99',
          patient_cpf: '123.123.123-12',
          patient_name: 'Juliana Lima',
          prescriber_crm: '99887',
          prescriber_uf: 'MG',
          authorized_ms_amount: 150.0,
          credited_fns_amount: 0.0,
          gloss_reason: 'Receita médica ilegível'
        }
      ]
    });

    const items = await service.listAuditItems({ settlement_batch_id: batch.id });
    const auditItemId = items[0].id;

    const contested = await service.contestGloss(auditItemId, {
      justification: 'Receita médica autenticada em anexo e cupom vinculado assinado'
    });

    expect(contested.status).toBe('CONTESTED');
    expect(contested.contest_protocol).toMatch(/^CONTEST-MS-\d+$/);
    expect(contested.contest_justification).toContain('Receita médica autenticada');
  });

  it('5. Reconcilia autorizações cruzando com pbm_transactions', async () => {
    // Insere transação PBM prévia
    db.prepare(`
      INSERT INTO sales (id, total_amount, created_at) VALUES (55, 120.0, '2026-10-15 14:00:00')
    `).run();

    db.prepare(`
      INSERT INTO pbm_transactions (
        transaction_uuid, provider_id, sale_id, authorization_protocol, status,
        patient_cpf, patient_name, doctor_crm, doctor_uf, prescription_date,
        total_gross_amount, subsidy_amount, patient_copay_amount
      ) VALUES (
        'UUID-55', 'FARMACIA_POPULAR', 55, 'AUTH-MATCH-55', 'CONFIRMED',
        '444.555.666-77', 'Marcos Silva', '33221', 'RJ', '2026-10-10',
        120.0, 120.0, 0.0
      )
    `).run();

    const batch = await service.importSettlementBatch({
      store_id: 1,
      batch_reference: 'FNS-MATCH-TEST',
      competence_month: '2026-10',
      credit_date: '2026-11-15',
      items: [
        {
          authorization_code: 'AUTH-MATCH-55',
          patient_cpf: '444.555.666-77',
          patient_name: 'Marcos Silva',
          prescriber_crm: '33221',
          prescriber_uf: 'RJ',
          authorized_ms_amount: 120.0,
          credited_fns_amount: 120.0
        }
      ]
    });

    const reconResult = await service.reconcileAuthorizations(batch.id);
    expect(reconResult.matched_sales_count).toBe(1);
    expect(reconResult.discrepancies_count).toBe(0);

    const items = await service.listAuditItems({ settlement_batch_id: batch.id });
    expect(items[0].sale_id).toBe(55);
  });

  it('6. Retorna KPIs consolidados de repasse, glosas e retenção documental', async () => {
    const kpis = await service.getAuditKpis(1);
    expect(kpis.total_batches).toBeDefined();
    expect(kpis.total_credited_amount).toBeDefined();
    expect(kpis.gloss_rate_percentage).toBeDefined();
    expect(kpis.pending_dossiers_count).toBeDefined();
    expect(kpis.archived_dossiers_count).toBeDefined();
  });
});
