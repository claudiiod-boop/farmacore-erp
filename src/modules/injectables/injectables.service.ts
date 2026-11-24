import { Database } from '../../database/connection';
import {
  InjectableAdministrationLog,
  CreateInjectableLogInput,
  VaccinationRecord,
  CreateVaccinationInput,
  SipniExportBatchResult,
  InjectablesVaccinationSummary,
  SipniStatus,
} from './injectables.types';

export class InjectableVaccinationService {
  constructor(private db: Database) {}

  // --- 1. ADMINISTRAÇÃO DE MEDICAMENTOS INJETÁVEIS (RDC 44/2009) ---
  recordInjectableAdministration(input: CreateInjectableLogInput): InjectableAdministrationLog {
    if (!input.patientName?.trim() || !input.patientCpf?.trim()) {
      throw new Error('Nome e CPF do paciente são obrigatórios para aplicação de injetáveis');
    }
    if (!input.medicationName?.trim() || !input.medicationBatch?.trim()) {
      throw new Error('Nome do medicamento e lote são obrigatórios');
    }
    if (!input.syringeNeedleBatch?.trim()) {
      throw new Error('Lote da seringa/agulha é obrigatório para rastreabilidade de insumos');
    }
    if (!input.prescriberName?.trim() || !input.prescriberCrm?.trim()) {
      throw new Error('Dados do médico/prescritor (Nome, CRM e UF) são obrigatórios');
    }
    if (!input.pharmacistCrf?.trim()) {
      throw new Error('CRF do Farmacêutico aplicador responsável é obrigatório');
    }

    // Verificar se o medicamento está vencido
    const today = new Date().toISOString().split('T')[0];
    if (input.medicationExpirationDate < today) {
      throw new Error(`Medicamento injetável com lote vencido em ${input.medicationExpirationDate}. Aplicação proibida.`);
    }

    const year = new Date().getFullYear();
    const countRow = this.db.prepare(`
      SELECT COUNT(*) as total FROM injectable_administration_logs
      WHERE declaration_number LIKE ?
    `).get(`DSF-INJ-${year}-%`) as { total: number };

    const nextSeq = String((countRow?.total || 0) + 1).padStart(4, '0');
    const declarationNumber = `DSF-INJ-${year}-${nextSeq}`;

    const administeredAt = input.administeredAt || new Date().toISOString();
    const adverseObserved = input.adverseReactionObserved ? 1 : 0;

    const stmt = this.db.prepare(`
      INSERT INTO injectable_administration_logs (
        store_id, patient_name, patient_cpf, patient_birth_date,
        patient_phone, medication_name, medication_dosage,
        medication_batch, medication_expiration_date,
        syringe_needle_batch, administration_route,
        anatomical_site, prescriber_name, prescriber_crm,
        prescriber_uf, pharmacist_name, pharmacist_crf,
        declaration_number, adverse_reaction_observed, notes,
        administered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.storeId || 1,
      input.patientName.trim(),
      input.patientCpf.trim(),
      input.patientBirthDate || null,
      input.patientPhone || null,
      input.medicationName.trim(),
      input.medicationDosage.trim(),
      input.medicationBatch.trim(),
      input.medicationExpirationDate,
      input.syringeNeedleBatch.trim(),
      input.administrationRoute,
      input.anatomicalSite.trim(),
      input.prescriberName.trim(),
      input.prescriberCrm.trim(),
      input.prescriberUf.trim().toUpperCase(),
      input.pharmacistName.trim(),
      input.pharmacistCrf.trim(),
      declarationNumber,
      adverseObserved,
      input.notes || null,
      administeredAt
    );

    return this.getInjectableLogById(Number(result.lastInsertRowid));
  }

  getInjectableLogById(id: number): InjectableAdministrationLog {
    const row = this.db.prepare('SELECT * FROM injectable_administration_logs WHERE id = ?').get(id) as InjectableAdministrationLog | undefined;
    if (!row) {
      throw new Error(`Registro de aplicação de injetável id ${id} não encontrado`);
    }
    return row;
  }

  getInjectableLogByDeclaration(declarationNumber: string): InjectableAdministrationLog | null {
    const row = this.db.prepare('SELECT * FROM injectable_administration_logs WHERE declaration_number = ?').get(declarationNumber) as InjectableAdministrationLog | undefined;
    return row || null;
  }

  listInjectableLogs(filter?: {
    storeId?: number;
    patientCpf?: string;
    startDate?: string;
    endDate?: string;
  }): InjectableAdministrationLog[] {
    let query = 'SELECT * FROM injectable_administration_logs WHERE 1=1';
    const params: any[] = [];

    if (filter?.storeId) {
      query += ' AND store_id = ?';
      params.push(filter.storeId);
    }
    if (filter?.patientCpf) {
      query += ' AND patient_cpf = ?';
      params.push(filter.patientCpf);
    }
    if (filter?.startDate) {
      query += ' AND date(administered_at) >= ?';
      params.push(filter.startDate);
    }
    if (filter?.endDate) {
      query += ' AND date(administered_at) <= ?';
      params.push(filter.endDate);
    }

    query += ' ORDER BY administered_at DESC, id DESC';
    return this.db.prepare(query).all(...params) as InjectableAdministrationLog[];
  }

  // --- 2. SALA DE VACINAS & IMUNOBIOLÓGICOS (RDC 197/2017) ---
  recordVaccination(input: CreateVaccinationInput): VaccinationRecord {
    if (!input.patientName?.trim() || !input.patientCpf?.trim() || !input.patientBirthDate?.trim()) {
      throw new Error('Nome, CPF e data de nascimento do vacinado são obrigatórios');
    }
    if (!input.vaccineName?.trim() || !input.manufacturer?.trim() || !input.vaccineBatch?.trim()) {
      throw new Error('Vacina, fabricante e lote são obrigatórios');
    }
    if (!input.pharmacistCrf?.trim()) {
      throw new Error('CRF do Farmacêutico responsável pela vacinação é obrigatório');
    }

    const today = new Date().toISOString().split('T')[0];
    if (input.vaccineExpirationDate < today) {
      throw new Error(`Lote da vacina vencido em ${input.vaccineExpirationDate}. Imunização proibida.`);
    }

    const year = new Date().getFullYear();
    const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const certificateCode = `VAC-${year}-${Date.now().toString().slice(-4)}${randSuffix}`;

    const administeredAt = input.administeredAt || new Date().toISOString();
    const route = input.administrationRoute || 'INTRAMUSCULAR';
    const hasFever = input.preTriageFever ? 1 : 0;

    const stmt = this.db.prepare(`
      INSERT INTO vaccination_records (
        store_id, patient_name, patient_cpf, patient_birth_date,
        patient_phone, vaccine_name, manufacturer, vaccine_batch,
        diluent_batch, vaccine_expiration_date, dose_type,
        administration_route, anatomical_site, pre_triage_fever,
        pre_triage_allergies, pharmacist_name, pharmacist_crf,
        certificate_code, sipni_status, administered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `);

    const result = stmt.run(
      input.storeId || 1,
      input.patientName.trim(),
      input.patientCpf.trim(),
      input.patientBirthDate.trim(),
      input.patientPhone || null,
      input.vaccineName.trim(),
      input.manufacturer.trim(),
      input.vaccineBatch.trim(),
      input.diluentBatch || null,
      input.vaccineExpirationDate,
      input.doseType,
      route,
      input.anatomicalSite.trim(),
      hasFever,
      input.preTriageAllergies || null,
      input.pharmacistName.trim(),
      input.pharmacistCrf.trim(),
      certificateCode,
      administeredAt
    );

    return this.getVaccinationById(Number(result.lastInsertRowid));
  }

  getVaccinationById(id: number): VaccinationRecord {
    const row = this.db.prepare('SELECT * FROM vaccination_records WHERE id = ?').get(id) as VaccinationRecord | undefined;
    if (!row) {
      throw new Error(`Registro de vacinação id ${id} não encontrado`);
    }
    return row;
  }

  getVaccinationByCertificate(certificateCode: string): VaccinationRecord | null {
    const row = this.db.prepare('SELECT * FROM vaccination_records WHERE certificate_code = ?').get(certificateCode) as VaccinationRecord | undefined;
    return row || null;
  }

  listVaccinations(filter?: {
    storeId?: number;
    patientCpf?: string;
    sipniStatus?: SipniStatus;
    startDate?: string;
    endDate?: string;
  }): VaccinationRecord[] {
    let query = 'SELECT * FROM vaccination_records WHERE 1=1';
    const params: any[] = [];

    if (filter?.storeId) {
      query += ' AND store_id = ?';
      params.push(filter.storeId);
    }
    if (filter?.patientCpf) {
      query += ' AND patient_cpf = ?';
      params.push(filter.patientCpf);
    }
    if (filter?.sipniStatus) {
      query += ' AND sipni_status = ?';
      params.push(filter.sipniStatus);
    }
    if (filter?.startDate) {
      query += ' AND date(administered_at) >= ?';
      params.push(filter.startDate);
    }
    if (filter?.endDate) {
      query += ' AND date(administered_at) <= ?';
      params.push(filter.endDate);
    }

    query += ' ORDER BY administered_at DESC, id DESC';
    return this.db.prepare(query).all(...params) as VaccinationRecord[];
  }

  // --- 3. EXPORTAÇÃO SI-PNI & EVENTOS ADVERSOS (EAPV) ---
  exportBatchToSipni(storeId?: number): SipniExportBatchResult {
    const store = storeId || 1;
    const pendingRecords = this.db.prepare(`
      SELECT * FROM vaccination_records
      WHERE store_id = ? AND sipni_status = 'PENDING'
      ORDER BY administered_at ASC
    `).all(store) as VaccinationRecord[];

    const batchTimestamp = new Date().toISOString();

    if (pendingRecords.length > 0) {
      const ids = pendingRecords.map((r) => r.id);
      const placeholders = ids.map(() => '?').join(',');
      this.db.prepare(`
        UPDATE vaccination_records
        SET sipni_status = 'EXPORTED', sipni_exported_at = ?
        WHERE id IN (${placeholders})
      `).run(batchTimestamp, ...ids);
    }

    const exportedRecords = pendingRecords.map((r) => ({
      ...r,
      sipni_status: 'EXPORTED' as SipniStatus,
      sipni_exported_at: batchTimestamp,
    }));

    return {
      exportedCount: exportedRecords.length,
      batchTimestamp,
      records: exportedRecords,
      exportPayloadSummary: `Lote SI-PNI gerado com ${exportedRecords.length} vacina(s) imunobiológica(s).`,
    };
  }

  recordEapv(vaccineRecordId: number, description: string): VaccinationRecord {
    if (!description?.trim()) {
      throw new Error('Descrição do Evento Adverso Pós-Vacinação (EAPV) é obrigatória');
    }

    const vac = this.getVaccinationById(vaccineRecordId);

    this.db.prepare(`
      UPDATE vaccination_records
      SET eapv_adverse_event = 1, eapv_description = ?
      WHERE id = ?
    `).run(description.trim(), vac.id);

    return this.getVaccinationById(vac.id);
  }

  // --- 4. PANORAMA & RELATÓRIO DO CONSULTÓRIO / SALA DE INJETÁVEIS ---
  getSummary(storeId?: number): InjectablesVaccinationSummary {
    const store = storeId || 1;
    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7);

    const totalInjectablesRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM injectable_administration_logs
      WHERE store_id = ? AND administered_at LIKE ?
    `).get(store, `${currentMonthPrefix}%`) as { count: number };

    const totalVaccinesRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM vaccination_records
      WHERE store_id = ? AND administered_at LIKE ?
    `).get(store, `${currentMonthPrefix}%`) as { count: number };

    const sipniPendingRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM vaccination_records
      WHERE store_id = ? AND sipni_status = 'PENDING'
    `).get(store) as { count: number };

    const recentInjectables = this.db.prepare(`
      SELECT * FROM injectable_administration_logs
      WHERE store_id = ?
      ORDER BY administered_at DESC
      LIMIT 5
    `).all(store) as InjectableAdministrationLog[];

    const recentVaccinations = this.db.prepare(`
      SELECT * FROM vaccination_records
      WHERE store_id = ?
      ORDER BY administered_at DESC
      LIMIT 5
    `).all(store) as VaccinationRecord[];

    return {
      totalInjectablesMonth: totalInjectablesRow?.count || 0,
      totalVaccinesMonth: totalVaccinesRow?.count || 0,
      sipniPendingCount: sipniPendingRow?.count || 0,
      recentInjectables,
      recentVaccinations,
    };
  }
}
