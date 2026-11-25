import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { SanitaryAuditService } from '../../../src/modules/sanitary-audit/sanitary-audit.service';

describe('SanitaryAuditService (Autoinspeção e Dossiê Sanitário ANVISA/VISA)', () => {
  let db: Database;
  let service: SanitaryAuditService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new SanitaryAuditService(db);

    // Loja padrão
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj)
      VALUES (1, 'Drogaria Magnos Farma Matriz', '98.765.432/0001-88')
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('1. Realiza autoinspeção com conformidade sanitária plena (Score 100 / EXCELLENT)', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // 1. Temperatura hoje
    db.prepare(`
      INSERT INTO temperature_sensors (id, store_id, name, location_type, min_allowed_temp, max_allowed_temp)
      VALUES (1, 1, 'Geladeira Termolábeis', 'REFRIGERATOR_COLD_CHAIN', 2.0, 8.0)
    `).run();
    db.prepare(`
      INSERT INTO temperature_readings (id, sensor_id, store_id, temperature, humidity, recorded_by, recorded_at)
      VALUES (1, 1, 1, 4.5, 55.0, 'Farmacêutico', datetime('now'))
    `).run();

    // 2. SNGPC confirmado
    db.prepare(`
      INSERT INTO sngpc_transmissions (id, start_date, end_date, pharmacist_name, pharmacist_cpf, pharmacist_crf, pharmacist_crf_uf, xml_content, hash_xml, status)
      VALUES (1, '2026-11-01', '2026-11-07', 'Dra. Vanessa', '12345678900', '12345', 'SP', '<xml></xml>', 'hash-123', 'CONFIRMADO')
    `).run();
    db.prepare(`
      INSERT INTO regulatory_reports (id, store_id, report_type, period_year, period_quarter, pharmacist_name, pharmacist_crf, status)
      VALUES (1, 1, 'BMPO_TRIMESTRAL', 2026, 4, 'Dra. Vanessa', '12345', 'CONCLUDED')
    `).run();

    // 3. Certificados e POPs
    db.prepare(`
      INSERT INTO pest_control_certificates (id, store_id, service_provider_name, service_provider_cnpj, sanitary_license_number, certificate_number, application_date, expiration_date, target_pests, chemical_agents_used, technical_responsible_pest, pharmacist_approval_crf)
      VALUES (1, 1, 'Dedetizadora BioSafe', '11.222.333/0001-44', 'VISA-SP-9988', 'CERT-2026-001', '2026-10-01', '2027-04-01', 'Baratas, Roedores', 'Deltametrina', 'Biólogo João CRBio 9988', 'CRF-SP 45.678')
    `).run();
    db.prepare(`
      INSERT INTO water_tank_cleaning_logs (id, store_id, service_provider, cleaning_date, expiration_date, responsible_cleaner, pharmacist_crf)
      VALUES (1, 1, 'AcquaClean', '2026-10-01', '2027-04-01', 'Carlos Técnico', 'CRF-SP 45.678')
    `).run();
    db.prepare(`
      INSERT INTO standard_operating_procedures (id, store_id, sop_code, title, category, effective_date, next_review_date, author_name, reviewer_pharmacist_crf, content_summary, status)
      VALUES
        (1, 1, 'POP-01', 'Dispensação de Medicamentos', 'DISPENSACAO', '2026-01-01', '2027-01-01', 'Dra. Vanessa', '12345', 'Resumo', 'ACTIVE'),
        (2, 1, 'POP-02', 'Cadeia de Frio e Termolábeis', 'TERMOLABEIS', '2026-01-01', '2027-01-01', 'Dra. Vanessa', '12345', 'Resumo', 'ACTIVE'),
        (3, 1, 'POP-03', 'Higienização e Descarte', 'HIGIENE_AMBIENTAL', '2026-01-01', '2027-01-01', 'Dra. Vanessa', '12345', 'Resumo', 'ACTIVE')
    `).run();

    // 4. PGRSS
    db.prepare(`
      INSERT INTO pgrss_manifests (id, store_id, manifest_number, collector_name, collector_cnpj, environmental_license, vehicle_plate, driver_name, total_weight_kg, total_items, dispatch_date, status)
      VALUES (1, 1, 'MTR-2026-001', 'EcoResíduos Ambientais', '11.222.333/0001-99', 'CETESB-998', 'ABC-1234', 'Marcos', 15.5, 2, '2026-11-20', 'DISPATCHED')
    `).run();

    // 5. Injetáveis
    db.prepare(`
      INSERT INTO injectable_administration_logs (
        id, store_id, declaration_number, patient_name, patient_cpf, medication_name, medication_dosage,
        medication_batch, medication_expiration_date, syringe_needle_batch, administration_route,
        anatomical_site, prescriber_name, prescriber_crm, prescriber_uf, pharmacist_name, pharmacist_crf, administered_at
      ) VALUES (
        1, 1, 'DECL-2026-001', 'João da Silva', '123.456.789-00', 'Ceftriaxona 1g', '1g IM',
        'LOTE-A1', '2027-10-01', 'AG-01', 'INTRAMUSCULAR',
        'DELTOIDE_DIREITO', 'Dr. Roberto', 'CRM-SP 9988', 'SP', 'Dra. Vanessa', 'CRF-SP 45.678', '2026-11-20 14:00:00'
      )
    `).run();

    const audit = await service.runSanitaryScan({
      store_id: '1',
      responsible_pharmacist_crf: 'CRF-SP 45.678',
      responsible_pharmacist_name: 'Dra. Vanessa Farmacêutica RT'
    });

    expect(audit.overall_score).toBe(100);
    expect(audit.compliance_status).toBe('EXCELLENT');
    expect(audit.items).toHaveLength(10);
    const nonCompliant = audit.items?.filter((i) => i.status === 'NON_COMPLIANT');
    expect(nonCompliant).toHaveLength(0);
  });

  it('2. Detecta não conformidades e penaliza pontuação gerando ações corretivas', async () => {
    // Banco vazio: sem temperatura hoje, sem SNGPC, sem certificados
    const audit = await service.runSanitaryScan({
      store_id: '1',
      responsible_pharmacist_crf: 'CRF-SP 45.678',
      responsible_pharmacist_name: 'Dra. Vanessa Farmacêutica RT'
    });

    expect(audit.overall_score).toBeLessThan(70);
    expect(audit.compliance_status).toBe('CRITICAL_RISK');

    const nonCompliant = audit.items?.filter((i) => i.status === 'NON_COMPLIANT');
    expect(nonCompliant!.length).toBeGreaterThan(0);
    expect(nonCompliant![0].corrective_action).toBeDefined();
  });

  it('3. Gera Dossiê Consolidado de Inspeção Sanitária pronto para impressão fiscal', async () => {
    const audit = await service.runSanitaryScan({
      store_id: '1',
      responsible_pharmacist_crf: 'CRF-SP 45.678',
      responsible_pharmacist_name: 'Dra. Vanessa Farmacêutica RT'
    });

    const dossier = await service.generateInspectionDossier(audit.id);

    expect(dossier.dossierSummary.storeName).toBe('FarmaCore Matriz Centro');
    expect(dossier.dossierSummary.pillars).toHaveLength(6);
    expect(dossier.officialReportText).toContain('DOSSIÊ OFICIAL DE AUTOINSPEÇÃO SANITÁRIA');
    expect(dossier.officialReportText).toContain('Dra. Vanessa Farmacêutica RT');
  });

  it('4. Atualiza Plano de Ação (CAPA) e busca dashboard de saúde sanitária', async () => {
    const audit = await service.runSanitaryScan({
      store_id: '1',
      responsible_pharmacist_crf: 'CRF-SP 45.678',
      responsible_pharmacist_name: 'Dra. Vanessa Farmacêutica RT'
    });

    const updated = await service.updateActionPlan(
      audit.id,
      'Providenciado agendamento da dedetização para sexta-feira e aferição térmica realizada.'
    );
    expect(updated.action_plan_notes).toContain('Providenciado agendamento');

    const dashboard = await service.getSanitaryDashboard('1');
    expect(dashboard.total_audits_performed).toBe(1);
    expect(dashboard.last_audit_score).toBe(audit.overall_score);
  });
});
