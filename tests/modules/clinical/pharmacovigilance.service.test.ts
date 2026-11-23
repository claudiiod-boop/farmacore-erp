import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { PharmacovigilanceService } from '../../../src/modules/clinical/pharmacovigilance.service';

describe('PharmacovigilanceService (Notivisa & Reações Adversas ANVISA)', () => {
  let db: Database;
  let service: PharmacovigilanceService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new PharmacovigilanceService(db);

    // Cadastrar farmacêutico
    db.prepare(`
      INSERT INTO clinical_pharmacists (id, store_id, name, cpf, crf_number, crf_uf)
      VALUES (1, 1, 'Dra. Vanessa Farmacêutica', '11122233344', '88776', 'SP')
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('should report adverse reaction, update Notivisa protocol, and export notification bundle', () => {
    const report = service.reportAdverseReaction({
      storeId: 1,
      pharmacistId: 1,
      patientName: 'Fernando Oliveira',
      patientCpf: '33344455566',
      suspectedMedication: 'Amoxicilina + Clavulanato 875mg',
      manufacturer: 'Laboratório EMS',
      batchNumber: 'LOTE-AMX-998',
      adverseReactionDescription: 'Edema facial e erupção cutânea 20 minutos após ingestão',
      reactionDate: '2026-11-20',
      severity: 'GRAVE'
    });

    expect(report.id).toBeGreaterThan(0);
    expect(report.status).toBe('PENDING_NOTIVISA');
    expect(report.severity).toBe('GRAVE');

    // Atualizar protocolo Notivisa
    const updated = service.updateNotivisaProtocol(report.id!, 'NOTIVISA-2026-887711');
    expect(updated.status).toBe('REPORTED');
    expect(updated.notivisaNotificationNumber).toBe('NOTIVISA-2026-887711');

    // Exportar estrutura Notivisa
    const exportData = service.generateNotivisaExportData(report.id!);
    expect(exportData.notificationSchemaVersion).toBe('2.0-ANVISA');
    expect(exportData.adverseEvent.suspectedDrug).toBe('AMOXICILINA + CLAVULANATO 875MG');
    expect(exportData.notifyingProfessional.crf).toBe('88776/SP');
    expect(exportData.externalProtocol).toBe('NOTIVISA-2026-887711');
  });

  it('should list and filter pharmacovigilance reports by severity and status', () => {
    service.reportAdverseReaction({
      storeId: 1,
      pharmacistId: 1,
      patientName: 'Paciente A',
      suspectedMedication: 'Dipirona 500mg',
      adverseReactionDescription: 'Náusea leve',
      reactionDate: '2026-11-18',
      severity: 'LEVE'
    });

    service.reportAdverseReaction({
      storeId: 1,
      pharmacistId: 1,
      patientName: 'Paciente B',
      suspectedMedication: 'Diclofenaco 50mg',
      adverseReactionDescription: 'Dor epigástrica severa',
      reactionDate: '2026-11-19',
      severity: 'MODERADA'
    });

    const all = service.listReports(1);
    expect(all).toHaveLength(2);

    const graves = service.listReports(1, { severity: 'GRAVE' });
    expect(graves).toHaveLength(0);

    const moderadas = service.listReports(1, { severity: 'MODERADA' });
    expect(moderadas).toHaveLength(1);
    expect(moderadas[0].suspectedMedication).toBe('DICLOFENACO 50MG');
  });
});
