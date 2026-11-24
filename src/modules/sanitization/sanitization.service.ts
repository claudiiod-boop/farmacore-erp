import { Database } from '../../database/connection';
import {
  SanitizationLog,
  CreateSanitizationLogInput,
  PestControlCertificate,
  CreatePestControlInput,
  WaterTankCleaningLog,
  CreateWaterTankCleaningInput,
  StandardOperatingProcedure,
  CreateSopInput,
  SanitaryComplianceOverview,
  ComplianceValidityStatus,
  SopStatus,
  SanitizationStatus,
} from './sanitization.types';

export class SanitizationService {
  constructor(private db: Database) {}

  private calculateDaysDifference(targetDateIso: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDateIso);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private addDays(dateIso: string, days: number): string {
    const d = new Date(dateIso);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  private resolveValidityStatus(expirationDate: string): ComplianceValidityStatus {
    const diff = this.calculateDaysDifference(expirationDate);
    if (diff < 0) return 'EXPIRED';
    if (diff <= 30) return 'EXPIRING_SOON';
    return 'VALID';
  }

  // --- 1. HIGIENIZAÇÃO DE AMBIENTES ---
  createSanitizationLog(input: CreateSanitizationLogInput): SanitizationLog {
    if (!input.sectorName || !input.sectorName.trim()) {
      throw new Error('Nome do setor é obrigatório para registro de higienização');
    }
    if (!input.chemicalProduct || !input.chemicalProduct.trim()) {
      throw new Error('Produto químico utilizado é obrigatório');
    }
    if (!input.performedBy || !input.performedBy.trim()) {
      throw new Error('Identificação do executor da limpeza é obrigatória');
    }

    const executionTimestamp = input.executionTimestamp || new Date().toISOString();
    const status = input.status || 'COMPLETED';

    const stmt = this.db.prepare(`
      INSERT INTO sanitization_logs (
        store_id, sector_name, cleaning_type, scheduled_date,
        execution_timestamp, chemical_product, dilution_or_batch,
        performed_by, verified_by_pharmacist, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.storeId || 1,
      input.sectorName.trim(),
      input.cleaningType,
      input.scheduledDate,
      executionTimestamp,
      input.chemicalProduct.trim(),
      input.dilutionOrBatch || null,
      input.performedBy.trim(),
      input.verifiedByPharmacist || null,
      status,
      input.notes || null
    );

    return this.getSanitizationLogById(Number(result.lastInsertRowid));
  }

  getSanitizationLogById(id: number): SanitizationLog {
    const row = this.db.prepare('SELECT * FROM sanitization_logs WHERE id = ?').get(id) as SanitizationLog | undefined;
    if (!row) {
      throw new Error(`Registro de higienização id ${id} não encontrado`);
    }
    return row;
  }

  verifySanitizationLog(id: number, pharmacistCrf: string): SanitizationLog {
    if (!pharmacistCrf || !pharmacistCrf.trim()) {
      throw new Error('CRF do Farmacêutico RT é obrigatório para homologar higienização');
    }

    const log = this.getSanitizationLogById(id);
    const verifiedAt = new Date().toISOString();

    this.db.prepare(`
      UPDATE sanitization_logs
      SET verified_by_pharmacist = ?, verified_at = ?
      WHERE id = ?
    `).run(pharmacistCrf.trim(), verifiedAt, log.id);

    return this.getSanitizationLogById(id);
  }

  listSanitizationLogs(filter?: {
    storeId?: number;
    sectorName?: string;
    startDate?: string;
    endDate?: string;
    status?: SanitizationStatus;
  }): SanitizationLog[] {
    let query = 'SELECT * FROM sanitization_logs WHERE 1=1';
    const params: any[] = [];

    if (filter?.storeId) {
      query += ' AND store_id = ?';
      params.push(filter.storeId);
    }
    if (filter?.sectorName) {
      query += ' AND sector_name = ?';
      params.push(filter.sectorName);
    }
    if (filter?.startDate) {
      query += ' AND scheduled_date >= ?';
      params.push(filter.startDate);
    }
    if (filter?.endDate) {
      query += ' AND scheduled_date <= ?';
      params.push(filter.endDate);
    }
    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }

    query += ' ORDER BY scheduled_date DESC, id DESC';
    return this.db.prepare(query).all(...params) as SanitizationLog[];
  }

  // --- 2. CONTROLE DE VETORES E PRAGAS (DEDETIZAÇÃO) ---
  registerPestControlCertificate(input: CreatePestControlInput): PestControlCertificate {
    if (!input.serviceProviderName?.trim() || !input.certificateNumber?.trim()) {
      throw new Error('Nome da empresa e número do certificado de dedetização são obrigatórios');
    }
    if (!input.pharmacistApprovalCrf?.trim()) {
      throw new Error('Homologação pelo Farmacêutico RT (CRF) é obrigatória para aceitação de laudo');
    }

    const expirationDate = input.expirationDate || this.addDays(input.applicationDate, 180);
    const status = this.resolveValidityStatus(expirationDate);

    const stmt = this.db.prepare(`
      INSERT INTO pest_control_certificates (
        store_id, service_provider_name, service_provider_cnpj,
        sanitary_license_number, certificate_number, application_date,
        expiration_date, target_pests, chemical_agents_used,
        antidote_information, technical_responsible_pest, pharmacist_approval_crf,
        status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.storeId || 1,
      input.serviceProviderName.trim(),
      input.serviceProviderCnpj.trim(),
      input.sanitaryLicenseNumber.trim(),
      input.certificateNumber.trim(),
      input.applicationDate,
      expirationDate,
      input.targetPests.trim(),
      input.chemicalAgentsUsed.trim(),
      input.antidoteInformation?.trim() || null,
      input.technicalResponsiblePest.trim(),
      input.pharmacistApprovalCrf.trim(),
      status,
      input.notes?.trim() || null
    );

    return this.getPestControlById(Number(result.lastInsertRowid));
  }

  getPestControlById(id: number): PestControlCertificate {
    const row = this.db.prepare('SELECT * FROM pest_control_certificates WHERE id = ?').get(id) as PestControlCertificate | undefined;
    if (!row) {
      throw new Error(`Certificado de dedetização id ${id} não encontrado`);
    }
    return row;
  }

  getActivePestControlCertificate(storeId?: number): PestControlCertificate | null {
    const query = `
      SELECT * FROM pest_control_certificates
      WHERE store_id = ?
      ORDER BY application_date DESC, id DESC
      LIMIT 1
    `;
    const row = this.db.prepare(query).get(storeId || 1) as PestControlCertificate | undefined;
    if (!row) return null;

    // Atualiza status dinamicamente conforme data atual
    const dynamicStatus = this.resolveValidityStatus(row.expiration_date);
    if (dynamicStatus !== row.status) {
      this.db.prepare('UPDATE pest_control_certificates SET status = ? WHERE id = ?').run(dynamicStatus, row.id);
      row.status = dynamicStatus;
    }
    return row;
  }

  listPestControlCertificates(storeId?: number): PestControlCertificate[] {
    const rows = this.db.prepare(`
      SELECT * FROM pest_control_certificates
      WHERE store_id = ?
      ORDER BY application_date DESC, id DESC
    `).all(storeId || 1) as PestControlCertificate[];

    // Atualiza status dinâmicos
    return rows.map((r) => {
      const status = this.resolveValidityStatus(r.expiration_date);
      if (status !== r.status) {
        this.db.prepare('UPDATE pest_control_certificates SET status = ? WHERE id = ?').run(status, r.id);
        r.status = status;
      }
      return r;
    });
  }

  // --- 3. RESERVATÓRIO DE ÁGUA (CAIXA D'ÁGUA) ---
  registerWaterTankCleaning(input: CreateWaterTankCleaningInput): WaterTankCleaningLog {
    if (!input.serviceProvider?.trim()) {
      throw new Error('Prestador de serviço para limpeza de caixa d água é obrigatório');
    }
    if (!input.pharmacistCrf?.trim()) {
      throw new Error('CRF do Farmacêutico RT é obrigatório para registrar desinfecção de reservatório');
    }

    const expirationDate = input.expirationDate || this.addDays(input.cleaningDate, 180);
    const potabilityStatus = input.potabilityStatus || 'POTABLE_COMPLIANT';
    let status = this.resolveValidityStatus(expirationDate);
    if (potabilityStatus === 'NON_POTABLE_CONTAMINATED') {
      status = 'EXPIRED'; // Água contaminada invalida a regularidade imediatamente
    }

    const stmt = this.db.prepare(`
      INSERT INTO water_tank_cleaning_logs (
        store_id, service_provider, cleaning_date, expiration_date,
        potability_report_number, potability_status, responsible_cleaner,
        pharmacist_crf, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.storeId || 1,
      input.serviceProvider.trim(),
      input.cleaningDate,
      expirationDate,
      input.potabilityReportNumber?.trim() || null,
      potabilityStatus,
      input.responsibleCleaner.trim(),
      input.pharmacistCrf.trim(),
      status,
      input.notes?.trim() || null
    );

    return this.getWaterTankCleaningById(Number(result.lastInsertRowid));
  }

  getWaterTankCleaningById(id: number): WaterTankCleaningLog {
    const row = this.db.prepare('SELECT * FROM water_tank_cleaning_logs WHERE id = ?').get(id) as WaterTankCleaningLog | undefined;
    if (!row) {
      throw new Error(`Registro de limpeza de caixa d água id ${id} não encontrado`);
    }
    return row;
  }

  getActiveWaterTankCleaning(storeId?: number): WaterTankCleaningLog | null {
    const row = this.db.prepare(`
      SELECT * FROM water_tank_cleaning_logs
      WHERE store_id = ?
      ORDER BY cleaning_date DESC, id DESC
      LIMIT 1
    `).get(storeId || 1) as WaterTankCleaningLog | undefined;

    if (!row) return null;

    let dynamicStatus = this.resolveValidityStatus(row.expiration_date);
    if (row.potability_status === 'NON_POTABLE_CONTAMINATED') {
      dynamicStatus = 'EXPIRED';
    }
    if (dynamicStatus !== row.status) {
      this.db.prepare('UPDATE water_tank_cleaning_logs SET status = ? WHERE id = ?').run(dynamicStatus, row.id);
      row.status = dynamicStatus;
    }
    return row;
  }

  listWaterTankCleanings(storeId?: number): WaterTankCleaningLog[] {
    const rows = this.db.prepare(`
      SELECT * FROM water_tank_cleaning_logs
      WHERE store_id = ?
      ORDER BY cleaning_date DESC, id DESC
    `).all(storeId || 1) as WaterTankCleaningLog[];

    return rows.map((r) => {
      let status = this.resolveValidityStatus(r.expiration_date);
      if (r.potability_status === 'NON_POTABLE_CONTAMINATED') {
        status = 'EXPIRED';
      }
      if (status !== r.status) {
        this.db.prepare('UPDATE water_tank_cleaning_logs SET status = ? WHERE id = ?').run(status, r.id);
        r.status = status;
      }
      return r;
    });
  }

  // --- 4. PROCEDIMENTOS OPERACIONAIS PADRÃO (POPs) ---
  createOrUpdateSop(input: CreateSopInput): StandardOperatingProcedure {
    if (!input.sopCode?.trim() || !input.title?.trim()) {
      throw new Error('Código do POP e Título são obrigatórios');
    }
    if (!input.reviewerPharmacistCrf?.trim()) {
      throw new Error('CRF do Farmacêutico RT revisor é obrigatório para validar o POP');
    }

    const nextReviewDate = input.nextReviewDate || this.addDays(input.effectiveDate, 365);
    const diff = this.calculateDaysDifference(nextReviewDate);
    const status: SopStatus = diff < 0 ? 'NEEDS_REVISION' : 'ACTIVE';
    const now = new Date().toISOString();

    const existing = this.db.prepare('SELECT id FROM standard_operating_procedures WHERE sop_code = ?').get(input.sopCode.trim()) as { id: number } | undefined;

    if (existing) {
      this.db.prepare(`
        UPDATE standard_operating_procedures
        SET title = ?, category = ?, version = ?, effective_date = ?,
            next_review_date = ?, author_name = ?, reviewer_pharmacist_crf = ?,
            content_summary = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(
        input.title.trim(),
        input.category,
        input.version || '1.0',
        input.effectiveDate,
        nextReviewDate,
        input.authorName.trim(),
        input.reviewerPharmacistCrf.trim(),
        input.contentSummary.trim(),
        status,
        now,
        existing.id
      );
      return this.getSopById(existing.id);
    }

    const stmt = this.db.prepare(`
      INSERT INTO standard_operating_procedures (
        store_id, sop_code, title, category, version,
        effective_date, next_review_date, author_name,
        reviewer_pharmacist_crf, content_summary, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.storeId || 1,
      input.sopCode.trim(),
      input.title.trim(),
      input.category,
      input.version || '1.0',
      input.effectiveDate,
      nextReviewDate,
      input.authorName.trim(),
      input.reviewerPharmacistCrf.trim(),
      input.contentSummary.trim(),
      status
    );

    return this.getSopById(Number(result.lastInsertRowid));
  }

  getSopById(id: number): StandardOperatingProcedure {
    const row = this.db.prepare('SELECT * FROM standard_operating_procedures WHERE id = ?').get(id) as StandardOperatingProcedure | undefined;
    if (!row) {
      throw new Error(`Procedimento Operacional Padrão id ${id} não encontrado`);
    }
    return row;
  }

  listSops(filter?: { storeId?: number; category?: string; status?: SopStatus }): StandardOperatingProcedure[] {
    let query = 'SELECT * FROM standard_operating_procedures WHERE 1=1';
    const params: any[] = [];

    if (filter?.storeId) {
      query += ' AND store_id = ?';
      params.push(filter.storeId);
    }
    if (filter?.category) {
      query += ' AND category = ?';
      params.push(filter.category);
    }
    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }

    query += ' ORDER BY sop_code ASC';
    const rows = this.db.prepare(query).all(...params) as StandardOperatingProcedure[];

    return rows.map((sop) => {
      const diff = this.calculateDaysDifference(sop.next_review_date);
      if (diff < 0 && sop.status === 'ACTIVE') {
        this.db.prepare("UPDATE standard_operating_procedures SET status = 'NEEDS_REVISION' WHERE id = ?").run(sop.id);
        sop.status = 'NEEDS_REVISION';
      }
      return sop;
    });
  }

  // --- 5. COMPLIANCE SANITÁRIO GERAL (AUDITORIA ANVISA / CRF) ---
  getComplianceOverview(storeId?: number): SanitaryComplianceOverview {
    const store = storeId || 1;

    // 1. Dedetização
    const pestCert = this.getActivePestControlCertificate(store);
    const pestDaysRemaining = pestCert ? this.calculateDaysDifference(pestCert.expiration_date) : -999;
    const pestStatus = pestCert ? pestCert.status : 'EXPIRED';

    // 2. Caixa d'Água
    const waterLog = this.getActiveWaterTankCleaning(store);
    const waterDaysRemaining = waterLog ? this.calculateDaysDifference(waterLog.expiration_date) : -999;
    const waterStatus = waterLog ? waterLog.status : 'EXPIRED';

    // 3. Higienização mensal
    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM
    const sanitizations = this.listSanitizationLogs({ storeId: store, startDate: `${currentMonthPrefix}-01` });
    const totalCompleted = sanitizations.filter((s) => s.status === 'COMPLETED').length;
    const pendingOrNonConforming = sanitizations.filter((s) => s.status !== 'COMPLETED').length;

    // 4. POPs
    const sops = this.listSops({ storeId: store });
    const totalActive = sops.filter((s) => s.status === 'ACTIVE').length;
    const needsRevisionCount = sops.filter((s) => s.status === 'NEEDS_REVISION').length;

    // Pontuação de Compliance (0 - 100)
    let score = 0;
    if (pestStatus === 'VALID') score += 30;
    else if (pestStatus === 'EXPIRING_SOON') score += 15;

    if (waterStatus === 'VALID' && waterLog?.potability_status === 'POTABLE_COMPLIANT') score += 30;
    else if (waterStatus === 'EXPIRING_SOON') score += 15;

    if (totalCompleted > 0 && pendingOrNonConforming === 0) score += 20;
    else if (totalCompleted > 0) score += 10;

    if (totalActive > 0 && needsRevisionCount === 0) score += 20;
    else if (totalActive > 0) score += 10;

    const overallCompliant = score >= 80;

    return {
      overallCompliant,
      score,
      pestControl: {
        activeCertificate: pestCert,
        status: pestStatus,
        daysRemaining: pestDaysRemaining,
      },
      waterTank: {
        activeLog: waterLog,
        status: waterStatus,
        daysRemaining: waterDaysRemaining,
      },
      sanitizationsMonth: {
        totalCompleted,
        pendingOrNonConforming,
      },
      sops: {
        totalActive,
        needsRevisionCount,
      },
    };
  }
}
