import { Database } from '../../database/connection';
import type { PharmacovigilanceReport } from './clinical.types';

export class PharmacovigilanceService {
  constructor(private db: Database) {}

  public reportAdverseReaction(report: PharmacovigilanceReport): PharmacovigilanceReport {
    const result = this.db
      .prepare(`
        INSERT INTO pharmacovigilance_reports (
          store_id, pharmacist_id, attendance_id, patient_name, patient_cpf,
          suspected_medication, manufacturer, batch_number,
          adverse_reaction_description, reaction_date, severity,
          notivisa_notification_number, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        report.storeId,
        report.pharmacistId,
        report.attendanceId || null,
        report.patientName.toUpperCase().trim(),
        report.patientCpf ? report.patientCpf.replace(/\D/g, '') : null,
        report.suspectedMedication.toUpperCase().trim(),
        report.manufacturer ? report.manufacturer.toUpperCase().trim() : null,
        report.batchNumber ? report.batchNumber.trim() : null,
        report.adverseReactionDescription.trim(),
        report.reactionDate,
        report.severity,
        report.notivisaNotificationNumber || null,
        report.status || 'PENDING_NOTIVISA'
      );

    const id = Number(result.lastInsertRowid);
    return this.getReportById(id)!;
  }

  public updateNotivisaProtocol(reportId: number, protocolNumber: string): PharmacovigilanceReport {
    const existing = this.getReportById(reportId);
    if (!existing) throw new Error('Notificação de farmacovigilância não encontrada');

    this.db
      .prepare(`
        UPDATE pharmacovigilance_reports SET
          notivisa_notification_number = ?,
          status = 'REPORTED'
        WHERE id = ?
      `)
      .run(protocolNumber.trim(), reportId);

    return this.getReportById(reportId)!;
  }

  public getReportById(id: number): PharmacovigilanceReport | null {
    const row = this.db.prepare('SELECT * FROM pharmacovigilance_reports WHERE id = ?').get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      storeId: row.store_id,
      pharmacistId: row.pharmacist_id,
      attendanceId: row.attendance_id,
      patientName: row.patient_name,
      patientCpf: row.patient_cpf,
      suspectedMedication: row.suspected_medication,
      manufacturer: row.manufacturer,
      batchNumber: row.batch_number,
      adverseReactionDescription: row.adverse_reaction_description,
      reactionDate: row.reaction_date,
      severity: row.severity,
      notivisaNotificationNumber: row.notivisa_notification_number,
      status: row.status,
      createdAt: row.created_at
    };
  }

  public listReports(storeId: number, filters?: { severity?: string; status?: string }): PharmacovigilanceReport[] {
    let sql = 'SELECT id FROM pharmacovigilance_reports WHERE store_id = ?';
    const params: any[] = [storeId];

    if (filters?.severity) {
      sql += ' AND severity = ?';
      params.push(filters.severity);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    sql += ' ORDER BY id DESC';

    const rows = this.db.prepare(sql).all(...params) as { id: number }[];
    return rows.map(r => this.getReportById(r.id)!).filter(Boolean);
  }

  public generateNotivisaExportData(reportId: number) {
    const report = this.getReportById(reportId);
    if (!report) throw new Error('Notificação não encontrada');

    const pharmacist = this.db.prepare('SELECT * FROM clinical_pharmacists WHERE id = ?').get(report.pharmacistId) as any;
    const store = this.db.prepare('SELECT * FROM stores WHERE id = ?').get(report.storeId) as any;

    return {
      notificationSchemaVersion: '2.0-ANVISA',
      notivisaModule: 'FARMACOVIGILANCIA_DROGARIAS',
      reportingFacility: {
        cnpj: store?.cnpj || '',
        name: store?.name || '',
        cnesOrAfe: 'AFE-ANVISA-FARMACIA'
      },
      notifyingProfessional: {
        name: pharmacist?.name || '',
        cpf: pharmacist?.cpf || '',
        crf: `${pharmacist?.crf_number}/${pharmacist?.crf_uf}`
      },
      patientInfo: {
        name: report.patientName,
        cpf: report.patientCpf
      },
      adverseEvent: {
        suspectedDrug: report.suspectedMedication,
        manufacturer: report.manufacturer,
        batch: report.batchNumber,
        eventDate: report.reactionDate,
        severity: report.severity,
        clinicalDescription: report.adverseReactionDescription
      },
      status: report.status,
      externalProtocol: report.notivisaNotificationNumber
    };
  }
}
