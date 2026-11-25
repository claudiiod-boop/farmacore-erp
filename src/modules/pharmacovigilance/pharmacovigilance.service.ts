import { Database } from '../../database/connection';
import {
  AdverseDrugReaction,
  CreateAdrInput,
  TechnicalComplaint,
  CreateComplaintInput,
  NotivisaSubmissionResult,
  PharmacovigilanceSummary,
  SeverityLevel,
  ComplaintType,
  NotivisaStatus,
} from './pharmacovigilance.types';

export class PharmacovigilanceService {
  constructor(private db: Database) {}

  // --- 1. REAÇÃO ADVERSA A MEDICAMENTOS (RAM) ---
  recordAdr(input: CreateAdrInput): AdverseDrugReaction {
    if (!input.patientInitials?.trim()) {
      throw new Error('Iniciais do paciente são obrigatórias para preservação do sigilo médico');
    }
    if (!input.suspectedDrugName?.trim() || !input.suspectedDrugBatch?.trim()) {
      throw new Error('Nome do medicamento suspeito e lote são obrigatórios');
    }
    if (!input.reactionDescription?.trim() || !input.reactionOnsetDate?.trim()) {
      throw new Error('Descrição detalhada da reação adversa e data de início são obrigatórias');
    }
    if (!input.notifierPharmacistCrf?.trim()) {
      throw new Error('CRF do Farmacêutico notificador é obrigatório');
    }

    const year = new Date().getFullYear();
    const countRow = this.db.prepare(`
      SELECT COUNT(*) as total FROM adverse_drug_reactions
      WHERE protocol_code LIKE ?
    `).get(`RAM-${year}-%`) as { total: number };

    const nextSeq = String((countRow?.total || 0) + 1).padStart(4, '0');
    const protocolCode = `RAM-${year}-${nextSeq}`;

    const isPregnant = input.isPregnant ? 1 : 0;

    const stmt = this.db.prepare(`
      INSERT INTO adverse_drug_reactions (
        store_id, protocol_code, patient_initials, patient_age,
        patient_gender, is_pregnant, suspected_drug_name,
        suspected_drug_batch, suspected_drug_manufacturer, daily_dose,
        treatment_start_date, treatment_end_date, therapeutic_indication,
        concomitant_drugs, reaction_description, reaction_onset_date,
        severity_level, serious_criteria, dechallenge_status,
        rechallenge_status, outcome, notifier_pharmacist_name,
        notifier_pharmacist_crf, notivisa_submission_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')
    `);

    const result = stmt.run(
      input.storeId || 1,
      protocolCode,
      input.patientInitials.trim().toUpperCase(),
      input.patientAge || null,
      input.patientGender,
      isPregnant,
      input.suspectedDrugName.trim(),
      input.suspectedDrugBatch.trim(),
      input.suspectedDrugManufacturer?.trim() || null,
      input.dailyDose.trim(),
      input.treatmentStartDate,
      input.treatmentEndDate || null,
      input.therapeuticIndication?.trim() || null,
      input.concomitantDrugs?.trim() || null,
      input.reactionDescription.trim(),
      input.reactionOnsetDate,
      input.severityLevel,
      input.seriousCriteria || null,
      input.dechallengeStatus,
      input.rechallengeStatus,
      input.outcome,
      input.notifierPharmacistName.trim(),
      input.notifierPharmacistCrf.trim()
    );

    return this.getAdrById(Number(result.lastInsertRowid));
  }

  getAdrById(id: number): AdverseDrugReaction {
    const row = this.db.prepare('SELECT * FROM adverse_drug_reactions WHERE id = ?').get(id) as AdverseDrugReaction | undefined;
    if (!row) {
      throw new Error(`Registro de reação adversa id ${id} não encontrado`);
    }
    return row;
  }

  getAdrByProtocol(protocolCode: string): AdverseDrugReaction | null {
    const row = this.db.prepare('SELECT * FROM adverse_drug_reactions WHERE protocol_code = ?').get(protocolCode) as AdverseDrugReaction | undefined;
    return row || null;
  }

  listAdrs(filter?: {
    storeId?: number;
    severityLevel?: SeverityLevel;
    status?: NotivisaStatus;
    startDate?: string;
    endDate?: string;
  }): AdverseDrugReaction[] {
    let query = 'SELECT * FROM adverse_drug_reactions WHERE 1=1';
    const params: any[] = [];

    if (filter?.storeId) {
      query += ' AND store_id = ?';
      params.push(filter.storeId);
    }
    if (filter?.severityLevel) {
      query += ' AND severity_level = ?';
      params.push(filter.severityLevel);
    }
    if (filter?.status) {
      query += ' AND notivisa_submission_status = ?';
      params.push(filter.status);
    }
    if (filter?.startDate) {
      query += ' AND date(created_at) >= ?';
      params.push(filter.startDate);
    }
    if (filter?.endDate) {
      query += ' AND date(created_at) <= ?';
      params.push(filter.endDate);
    }

    query += ' ORDER BY created_at DESC, id DESC';
    return this.db.prepare(query).all(...params) as AdverseDrugReaction[];
  }

  // --- 2. QUEIXAS TÉCNICAS E DESVIOS DE QUALIDADE (QT) ---
  recordTechnicalComplaint(input: CreateComplaintInput): TechnicalComplaint {
    if (!input.productName?.trim() || !input.batchNumber?.trim()) {
      throw new Error('Nome do produto e lote com queixa técnica são obrigatórios');
    }
    if (!input.description?.trim()) {
      throw new Error('Descrição do desvio de qualidade é obrigatória');
    }
    if (!input.notifierPharmacistCrf?.trim()) {
      throw new Error('CRF do Farmacêutico RT é obrigatório para registrar queixa técnica');
    }

    const year = new Date().getFullYear();
    const countRow = this.db.prepare(`
      SELECT COUNT(*) as total FROM technical_complaints
      WHERE protocol_code LIKE ?
    `).get(`QT-${year}-%`) as { total: number };

    const nextSeq = String((countRow?.total || 0) + 1).padStart(4, '0');
    const protocolCode = `QT-${year}-${nextSeq}`;

    const sampleAvailable = input.sampleAvailableForPickup !== false ? 1 : 0;
    const quarantineBlocked = input.quarantineAutoBlocked ? 1 : 0;

    const stmt = this.db.prepare(`
      INSERT INTO technical_complaints (
        store_id, protocol_code, product_name, product_ean,
        batch_number, manufacturer, expiration_date, complaint_type,
        description, sample_available_for_pickup, quarantine_auto_blocked,
        reporter_type, reporter_name, notifier_pharmacist_crf,
        notivisa_submission_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')
    `);

    const result = stmt.run(
      input.storeId || 1,
      protocolCode,
      input.productName.trim(),
      input.productEan?.trim() || null,
      input.batchNumber.trim(),
      input.manufacturer.trim(),
      input.expirationDate,
      input.complaintType,
      input.description.trim(),
      sampleAvailable,
      quarantineBlocked,
      input.reporterType,
      input.reporterName?.trim() || null,
      input.notifierPharmacistCrf.trim()
    );

    return this.getTechnicalComplaintById(Number(result.lastInsertRowid));
  }

  getTechnicalComplaintById(id: number): TechnicalComplaint {
    const row = this.db.prepare('SELECT * FROM technical_complaints WHERE id = ?').get(id) as TechnicalComplaint | undefined;
    if (!row) {
      throw new Error(`Queixa técnica id ${id} não encontrada`);
    }
    return row;
  }

  getTechnicalComplaintByProtocol(protocolCode: string): TechnicalComplaint | null {
    const row = this.db.prepare('SELECT * FROM technical_complaints WHERE protocol_code = ?').get(protocolCode) as TechnicalComplaint | undefined;
    return row || null;
  }

  listTechnicalComplaints(filter?: {
    storeId?: number;
    complaintType?: ComplaintType;
    status?: NotivisaStatus;
    startDate?: string;
    endDate?: string;
  }): TechnicalComplaint[] {
    let query = 'SELECT * FROM technical_complaints WHERE 1=1';
    const params: any[] = [];

    if (filter?.storeId) {
      query += ' AND store_id = ?';
      params.push(filter.storeId);
    }
    if (filter?.complaintType) {
      query += ' AND complaint_type = ?';
      params.push(filter.complaintType);
    }
    if (filter?.status) {
      query += ' AND notivisa_submission_status = ?';
      params.push(filter.status);
    }
    if (filter?.startDate) {
      query += ' AND date(created_at) >= ?';
      params.push(filter.startDate);
    }
    if (filter?.endDate) {
      query += ' AND date(created_at) <= ?';
      params.push(filter.endDate);
    }

    query += ' ORDER BY created_at DESC, id DESC';
    return this.db.prepare(query).all(...params) as TechnicalComplaint[];
  }

  // --- 3. SUBMISSÃO / SINCRONIZAÇÃO NOTIVISA (ANVISA) ---
  submitToNotivisa(type: 'RAM' | 'TECHNICAL_COMPLAINT', id: number): NotivisaSubmissionResult {
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const notivisaProtocol = `NOTIVISA-${year}-${Date.now().toString().slice(-4)}${rand}`;
    const submittedAt = new Date().toISOString();

    let protocolCode = '';

    if (type === 'RAM') {
      const adr = this.getAdrById(id);
      protocolCode = adr.protocol_code;
      this.db.prepare(`
        UPDATE adverse_drug_reactions
        SET notivisa_submission_status = 'SUBMITTED', notivisa_protocol = ?
        WHERE id = ?
      `).run(notivisaProtocol, adr.id);
    } else {
      const complaint = this.getTechnicalComplaintById(id);
      protocolCode = complaint.protocol_code;
      this.db.prepare(`
        UPDATE technical_complaints
        SET notivisa_submission_status = 'SUBMITTED', notivisa_protocol = ?
        WHERE id = ?
      `).run(notivisaProtocol, complaint.id);
    }

    return {
      recordType: type,
      protocolCode,
      notivisaProtocol,
      submittedAt,
      status: 'SUBMITTED',
    };
  }

  // --- 4. PANORAMA E DASHBOARD DE FARMACOVIGILÂNCIA ---
  getSummary(storeId?: number): PharmacovigilanceSummary {
    const store = storeId || 1;

    const totalRamsRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM adverse_drug_reactions WHERE store_id = ?
    `).get(store) as { count: number };

    const severeRamsRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM adverse_drug_reactions
      WHERE store_id = ? AND severity_level = 'SEVERE'
    `).get(store) as { count: number };

    const totalComplaintsRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM technical_complaints WHERE store_id = ?
    `).get(store) as { count: number };

    const pendingAdrRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM adverse_drug_reactions
      WHERE store_id = ? AND notivisa_submission_status = 'DRAFT'
    `).get(store) as { count: number };

    const pendingComplaintsRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM technical_complaints
      WHERE store_id = ? AND notivisa_submission_status = 'DRAFT'
    `).get(store) as { count: number };

    const recentRams = this.db.prepare(`
      SELECT * FROM adverse_drug_reactions
      WHERE store_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(store) as AdverseDrugReaction[];

    const recentComplaints = this.db.prepare(`
      SELECT * FROM technical_complaints
      WHERE store_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(store) as TechnicalComplaint[];

    return {
      totalRams: totalRamsRow?.count || 0,
      severeRams: severeRamsRow?.count || 0,
      totalComplaints: totalComplaintsRow?.count || 0,
      pendingSubmissionCount: (pendingAdrRow?.count || 0) + (pendingComplaintsRow?.count || 0),
      recentRams,
      recentComplaints,
    };
  }
}
