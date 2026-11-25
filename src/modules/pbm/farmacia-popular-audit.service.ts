import crypto from 'crypto';
import { Database } from '../../database/connection';
import {
  FpSettlementBatch,
  FpAuditItem,
  FpDigitalReceiptDossier,
  ImportSettlementBatchInput,
  RegisterDossierInput,
  ContestGlossInput,
  FpAuditKpis,
  FpAuditItemStatus,
  FpDossierStatus,
} from './fp-audit.types';

export class FarmaciaPopularAuditService {
  constructor(private db: Database) {}

  /**
   * 1. Importação de Lote de Repasse do Fundo Nacional de Saúde (FNS / DataSUS)
   */
  async importSettlementBatch(input: ImportSettlementBatchInput): Promise<FpSettlementBatch> {
    const store = this.db.prepare('SELECT id FROM stores WHERE id = ?').get(input.store_id);
    if (!store) {
      throw new Error('STORE_NOT_FOUND');
    }

    if (!input.batch_reference || !input.competence_month || !input.credit_date) {
      throw new Error('MISSING_REQUIRED_FIELDS');
    }

    let totalAuthorized = 0;
    let totalCredited = 0;

    for (const item of input.items || []) {
      totalAuthorized += Number(item.authorized_ms_amount || 0);
      totalCredited += Number(item.credited_fns_amount || 0);
    }

    totalAuthorized = Number(totalAuthorized.toFixed(2));
    totalCredited = Number(totalCredited.toFixed(2));
    const totalLoss = Math.max(0, Number((totalAuthorized - totalCredited).toFixed(2)));
    const status = totalLoss > 0 ? 'DISCREPANT' : 'RECONCILED';

    const insertBatch = this.db.prepare(`
      INSERT INTO fp_settlement_batches (
        store_id, batch_reference, competence_month, credit_date,
        total_authorized_amount, total_credited_amount, total_loss_amount,
        status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.store_id,
      input.batch_reference,
      input.competence_month,
      input.credit_date,
      totalAuthorized,
      totalCredited,
      totalLoss,
      status,
      input.notes || null
    );

    const batchId = Number(insertBatch.lastInsertRowid);

    // Inserir itens de auditoria vinculados ao lote
    const insertItemStmt = this.db.prepare(`
      INSERT INTO fp_audit_items (
        settlement_batch_id, store_id, authorization_code, sale_id,
        patient_cpf, patient_name, prescriber_crm, prescriber_uf,
        authorized_ms_amount, patient_copay_amount, credited_fns_amount,
        gloss_amount, gloss_reason, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of input.items || []) {
      const authAmount = Number(item.authorized_ms_amount || 0);
      const credAmount = Number(item.credited_fns_amount || 0);
      const glossAmount = Math.max(0, Number((authAmount - credAmount).toFixed(2)));

      let itemStatus: FpAuditItemStatus = 'APPROVED';
      if (glossAmount > 0) {
        itemStatus = credAmount === 0 ? 'TOTALLY_GLOSSED' : 'PARTIALLY_GLOSSED';
      }

      insertItemStmt.run(
        batchId,
        input.store_id,
        item.authorization_code,
        item.sale_id || null,
        item.patient_cpf,
        item.patient_name,
        item.prescriber_crm,
        item.prescriber_uf,
        authAmount,
        Number(item.patient_copay_amount || 0),
        credAmount,
        glossAmount,
        item.gloss_reason || (glossAmount > 0 ? 'Divergência de repasse FNS' : null),
        itemStatus
      );
    }

    return this.db.prepare('SELECT * FROM fp_settlement_batches WHERE id = ?').get(batchId) as FpSettlementBatch;
  }

  /**
   * 2. Conciliação Automática com Vendas e Transações PBM do Caixa
   */
  async reconcileAuthorizations(batchId: number): Promise<{
    batch_id: number;
    reconciled_items_count: number;
    matched_sales_count: number;
    discrepancies_count: number;
  }> {
    const batch = this.db.prepare('SELECT * FROM fp_settlement_batches WHERE id = ?').get(batchId) as FpSettlementBatch;
    if (!batch) {
      throw new Error('BATCH_NOT_FOUND');
    }

    const items = this.db.prepare('SELECT * FROM fp_audit_items WHERE settlement_batch_id = ?').all(batchId) as FpAuditItem[];
    let matchedSales = 0;
    let discrepancies = 0;

    const updateSaleStmt = this.db.prepare('UPDATE fp_audit_items SET sale_id = ? WHERE id = ?');

    for (const item of items) {
      if (item.gloss_amount > 0) {
        discrepancies++;
      }

      if (!item.sale_id) {
        // Tenta cruzar com pbm_transactions
        const pbmTx = this.db.prepare(`
          SELECT sale_id FROM pbm_transactions WHERE authorization_protocol = ?
        `).get(item.authorization_code) as any;

        if (pbmTx && pbmTx.sale_id) {
          updateSaleStmt.run(pbmTx.sale_id, item.id);
          matchedSales++;
        }
      } else {
        matchedSales++;
      }
    }

    return {
      batch_id: batchId,
      reconciled_items_count: items.length,
      matched_sales_count: matchedSales,
      discrepancies_count: discrepancies
    };
  }

  /**
   * 3. Arquivamento de Dossiê Digital de Comprovantes com Retenção de 5 Anos
   */
  async registerDigitalDossier(input: RegisterDossierInput): Promise<FpDigitalReceiptDossier> {
    const store = this.db.prepare('SELECT id FROM stores WHERE id = ?').get(input.store_id);
    if (!store) {
      throw new Error('STORE_NOT_FOUND');
    }

    const existing = this.db.prepare('SELECT id FROM fp_digital_receipt_dossiers WHERE authorization_code = ?').get(input.authorization_code);
    if (existing) {
      throw new Error('DOSSIER_ALREADY_EXISTS');
    }

    // Calcula retenção de 5 anos regulamentar (Portaria GM/MS 5/2017)
    const dispDate = new Date(input.dispensation_date);
    if (isNaN(dispDate.getTime())) {
      throw new Error('INVALID_DISPENSATION_DATE');
    }
    const retentionDate = new Date(dispDate);
    retentionDate.setFullYear(retentionDate.getFullYear() + 5);
    const retentionDeadline = retentionDate.toISOString().split('T')[0];

    // Calcula hash de integridade SHA-256
    const rawPayload = `${input.store_id}|${input.authorization_code}|${input.patient_cpf}|${input.dispensation_date}`;
    const sha256 = crypto.createHash('sha256').update(rawPayload).digest('hex');

    const hasSignedCoupon = !!input.signed_coupon_file_path;
    const hasPrescription = !!input.prescription_file_path;
    const status: FpDossierStatus = (hasSignedCoupon && hasPrescription) ? 'ARCHIVED' : 'PENDING_DOCS';

    const insert = this.db.prepare(`
      INSERT INTO fp_digital_receipt_dossiers (
        store_id, authorization_code, sale_id, patient_cpf, patient_name,
        dispensation_date, retention_deadline, signed_coupon_file_path,
        prescription_file_path, id_document_file_path, legal_representation_file_path,
        sha256_integrity_hash, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.store_id,
      input.authorization_code,
      input.sale_id || null,
      input.patient_cpf,
      input.patient_name,
      input.dispensation_date,
      retentionDeadline,
      input.signed_coupon_file_path || null,
      input.prescription_file_path || null,
      input.id_document_file_path || null,
      input.legal_representation_file_path || null,
      sha256,
      status,
      input.notes || null
    );

    return this.db.prepare('SELECT * FROM fp_digital_receipt_dossiers WHERE id = ?').get(insert.lastInsertRowid) as FpDigitalReceiptDossier;
  }

  /**
   * 4. Contestação Administrativa de Glosa junto ao Ministério da Saúde
   */
  async contestGloss(auditItemId: number, input: ContestGlossInput): Promise<FpAuditItem> {
    const item = this.db.prepare('SELECT * FROM fp_audit_items WHERE id = ?').get(auditItemId) as FpAuditItem;
    if (!item) {
      throw new Error('AUDIT_ITEM_NOT_FOUND');
    }
    if (item.gloss_amount <= 0) {
      throw new Error('ITEM_HAS_NO_GLOSS');
    }

    const contestProtocol = `CONTEST-MS-${Date.now()}`;
    const contestDate = new Date().toISOString();

    this.db.prepare(`
      UPDATE fp_audit_items
      SET status = 'CONTESTED',
          contest_protocol = ?,
          contest_justification = ?,
          contest_date = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(contestProtocol, input.justification, contestDate, auditItemId);

    if (item.settlement_batch_id) {
      this.db.prepare(`
        UPDATE fp_settlement_batches
        SET status = 'CONTESTED',
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(item.settlement_batch_id);
    }

    return this.db.prepare('SELECT * FROM fp_audit_items WHERE id = ?').get(auditItemId) as FpAuditItem;
  }

  /**
   * 5. Listagem de Itens de Auditoria com Filtros
   */
  async listAuditItems(filters?: {
    store_id?: number;
    settlement_batch_id?: number;
    status?: FpAuditItemStatus;
  }): Promise<FpAuditItem[]> {
    let sql = 'SELECT * FROM fp_audit_items WHERE 1=1';
    const params: any[] = [];

    if (filters?.store_id) {
      sql += ' AND store_id = ?';
      params.push(filters.store_id);
    }
    if (filters?.settlement_batch_id) {
      sql += ' AND settlement_batch_id = ?';
      params.push(filters.settlement_batch_id);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY id ASC';
    return this.db.prepare(sql).all(...params) as FpAuditItem[];
  }

  /**
   * 6. Listagem de Dossiês Digitais (Guarda de 5 Anos)
   */
  async listDossiers(filters?: {
    store_id?: number;
    status?: FpDossierStatus;
    patient_cpf?: string;
  }): Promise<FpDigitalReceiptDossier[]> {
    let sql = 'SELECT * FROM fp_digital_receipt_dossiers WHERE 1=1';
    const params: any[] = [];

    if (filters?.store_id) {
      sql += ' AND store_id = ?';
      params.push(filters.store_id);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.patient_cpf) {
      sql += ' AND patient_cpf = ?';
      params.push(filters.patient_cpf);
    }

    sql += ' ORDER BY id ASC';
    return this.db.prepare(sql).all(...params) as FpDigitalReceiptDossier[];
  }

  /**
   * 7. KPIs Consolidados de Repasse, Glosas e Dossiês Comprobatórios
   */
  async getAuditKpis(storeId?: number): Promise<FpAuditKpis> {
    const storeFilter = storeId ? 'WHERE store_id = ?' : '';
    const storeParam = storeId ? [storeId] : [];

    const batchesRow = this.db.prepare(`
      SELECT COUNT(*) as total_batches FROM fp_settlement_batches ${storeFilter}
    `).get(...storeParam) as any;

    const itemsRow = this.db.prepare(`
      SELECT 
        COUNT(*) as total_items,
        COALESCE(SUM(authorized_ms_amount), 0) as total_authorized,
        COALESCE(SUM(credited_fns_amount), 0) as total_credited,
        COALESCE(SUM(gloss_amount), 0) as total_gloss
      FROM fp_audit_items ${storeFilter}
    `).get(...storeParam) as any;

    const dossiersRow = this.db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'PENDING_DOCS' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'ARCHIVED' THEN 1 ELSE 0 END) as archived_count
      FROM fp_digital_receipt_dossiers ${storeFilter}
    `).get(...storeParam) as any;

    const totalAuth = Number(itemsRow?.total_authorized || 0);
    const totalGloss = Number(itemsRow?.total_gloss || 0);
    const glossRate = totalAuth > 0 ? Number(((totalGloss / totalAuth) * 100).toFixed(2)) : 0.0;

    return {
      total_batches: Number(batchesRow?.total_batches || 0),
      total_reconciled_items: Number(itemsRow?.total_items || 0),
      total_credited_amount: Number(itemsRow?.total_credited || 0),
      total_gloss_amount: totalGloss,
      gloss_rate_percentage: glossRate,
      pending_dossiers_count: Number(dossiersRow?.pending_count || 0),
      archived_dossiers_count: Number(dossiersRow?.archived_count || 0),
    };
  }
}
