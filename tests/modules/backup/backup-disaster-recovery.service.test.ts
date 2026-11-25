import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { BackupDisasterRecoveryService } from '../../../src/modules/backup/backup-disaster-recovery.service';

describe('BackupDisasterRecoveryService', () => {
  let db: Database;
  let service: BackupDisasterRecoveryService;
  const testBackupDir = path.resolve(process.cwd(), 'temp_test_backups');

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new BackupDisasterRecoveryService(db, testBackupDir);

    // Seed de cliente e venda para teste de LGPD
    db.prepare(`
      INSERT INTO pre_sales (id, code, customer_name, customer_cpf, total_amount)
      VALUES (1, 'PV-1001', 'Joao da Silva', '123.456.789-00', 50.0)
    `).run();

    db.prepare(`
      INSERT INTO prescriptions (id, pre_sale_id, patient_name, doctor_name, doctor_crm, doctor_uf, prescription_type, prescription_date, buyer_cpf, buyer_name)
      VALUES (1, 1, 'Joao da Silva', 'Dr. Carlos', '12345', 'SP', 'RECEITA_BRANCA', '2026-11-20', '123.456.789-00', 'Joao da Silva')
    `).run();
  });

  afterEach(() => {
    db.close();
    // Limpeza de pasta temporária
    try {
      if (fs.existsSync(testBackupDir)) {
        fs.rmSync(testBackupDir, { recursive: true, force: true });
      }
    } catch {
      // Ignora
    }
  });

  it('1. Cria backup com sucesso, gerando SHA-256 e criptografia AES-256', () => {
    const backup = service.createBackup({
      backupType: 'FULL',
      destination: 'LOCAL',
      encrypt: true,
      operatorName: 'Farmacêutico RT',
    });

    expect(backup.id).toBeGreaterThan(0);
    expect(backup.filename).toContain('farmacore-backup-');
    expect(backup.filename).toContain('.sqlite.enc');
    expect(backup.sha256_hash.length).toBe(64);
    expect(backup.is_encrypted).toBe(1);
    expect(backup.status).toBe('SUCCESS');
  });

  it('2. Verifica integridade do snapshot com SHA-256 válido', () => {
    const backup = service.createBackup({ encrypt: true });
    const check = service.verifyBackupIntegrity(backup.id, 'Auditor Chefe');

    expect(check.overallStatus).toBe('VALID');
    expect(check.hashValid).toBe(true);
    expect(check.sqliteIntegrityOk).toBe(true);

    const updated = service.getBackupById(backup.id);
    expect(updated?.status).toBe('VERIFIED');
  });

  it('3. Simula restauração de desastre com validação prévia', () => {
    const backup = service.createBackup();
    const result = service.restoreBackup(backup.id, 'Gerente de TI');

    expect(result.success).toBe(true);
    expect(result.message).toContain('restaurado com sucesso');

    // Confirma registro de auditoria
    const auditLogs = service.listAuditLogs(10);
    expect(auditLogs.some((l) => l.action === 'RESTORE_BACKUP')).toBe(true);
  });

  it('4. Atende direito do titular LGPD (Art. 18): Exporta dossiê completo por CPF', () => {
    const dossier = service.exportClientLgpdDossier(
      '123.456.789-00',
      'DPO Farmácia',
      'Direito de acesso solicitado pelo titular'
    );

    expect(dossier.cpf).toBe('123.456.789-00');
    expect(dossier.name).toBe('Joao da Silva');
    expect(dossier.salesCount).toBe(1);
    expect(dossier.prescriptionsCount).toBe(1);
    expect(dossier.details.sales[0].code).toBe('PV-1001');

    const auditLogs = service.listAuditLogs(5);
    expect(auditLogs.some((l) => l.action === 'EXPORT_CLIENT_DATA')).toBe(true);
  });

  it('5. Anonimiza cliente irreversivelmente sob solicitação LGPD', () => {
    const result = service.anonymizeClient(
      '123.456.789-00',
      'DPO Farmácia',
      'Direito ao esquecimento / revogação de consentimento'
    );

    expect(result.anonymized).toBe(true);
    expect(result.affectedTables).toContain('pre_sales');
    expect(result.affectedTables).toContain('prescriptions');

    // Verifica que registros agora estão mascarados
    const sale = db.prepare('SELECT customer_name, customer_cpf FROM pre_sales WHERE id = 1').get() as any;
    expect(sale.customer_name).toBe('[TITULAR ANONIMIZADO LGPD]');
    expect(sale.customer_cpf).toBe('***.***.***-**');

    const presc = db.prepare('SELECT patient_name, buyer_cpf FROM prescriptions WHERE id = 1').get() as any;
    expect(presc.patient_name).toBe('[PACIENTE ANONIMIZADO LGPD]');
    expect(presc.buyer_cpf).toBe('***.***.***-**');
  });

  it('6. Atualiza configurações de agendamento e retorna KPIs', () => {
    service.updateConfig({
      retention_days: 60,
      notify_email: 'ti@farmacore.com.br',
    });

    const config = service.getConfig();
    expect(config.retention_days).toBe(60);
    expect(config.notify_email).toBe('ti@farmacore.com.br');

    service.createBackup();
    const kpis = service.getKpis();
    expect(kpis.totalBackups).toBe(1);
    expect(kpis.retentionDays).toBe(60);
    expect(kpis.autoBackupActive).toBe(true);
  });
});
