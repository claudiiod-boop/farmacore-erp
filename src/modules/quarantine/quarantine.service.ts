import { Database } from '../../database/connection';
import type {
  QuarantineRecord,
  RecallAlert,
  TransferToQuarantineInput,
  ResolveQuarantineInput,
  RegisterRecallAlertInput,
  QuarantineKpis,
} from './quarantine.types';

export class QuarantineService {
  constructor(private db: Database) {}

  /**
   * Transfere um lote ou quantidade para a Área de Quarentena Sanitária (RDC 44/2009 ANVISA),
   * deduzindo o saldo vendável do lote.
   */
  quarantineBatch(input: TransferToQuarantineInput): { quarantineId: number; productId: number; batchId: number; quantity: number; status: string } {
    if (input.quantity <= 0) {
      throw new Error('A quantidade para quarentena deve ser maior que zero.');
    }

    const batch = this.db.prepare('SELECT id, product_id, quantity FROM batches WHERE id = ?').get(input.batchId) as any;
    if (!batch) {
      throw new Error(`Lote #${input.batchId} não encontrado.`);
    }

    if (batch.quantity < input.quantity) {
      throw new Error(
        `Quantidade a transferir (${input.quantity}) excede o saldo disponível do lote (${batch.quantity}).`
      );
    }

    let quarantineId = 0;

    this.db.transaction(() => {
      // 1. Deduz estoque vendável do lote
      this.db
        .prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?')
        .run(input.quantity, input.batchId);

      // 2. Insere registro de quarentena sanitária
      const insertStmt = this.db.prepare(`
        INSERT INTO quarantine_records (
          store_id, product_id, batch_id, quantity, reason, origin, status, notes, quarantined_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'QUARANTINED', ?, ?)
      `);

      const result = insertStmt.run(
        input.storeId,
        input.productId,
        input.batchId,
        input.quantity,
        input.reason,
        input.origin,
        input.notes || null,
        input.quarantinedBy
      );

      quarantineId = Number(result.lastInsertRowid);
    })();

    return {
      quarantineId,
      productId: input.productId,
      batchId: input.batchId,
      quantity: input.quantity,
      status: 'QUARANTINED',
    };
  }

  /**
   * Varredura Automática de Validades (Auditoria FEFO):
   * Localiza todos os lotes com expiration_date <= hoje e quantity > 0,
   * bloqueando a venda e transferindo-os automaticamente para a Quarentena com motivo EXPIRED.
   */
  sweepExpiredBatches(storeId: number, sweptBy?: string): { sweptBatchesCount: number; totalUnitsQuarantined: number; records: any[] } {
    const today = new Date().toISOString().slice(0, 10);
    const expiredBatches = this.db
      .prepare(`
        SELECT b.id AS batch_id, b.product_id, b.batch_number, b.expiration_date, b.quantity, p.name AS product_name
        FROM batches b
        JOIN products p ON p.id = b.product_id
        WHERE b.expiration_date <= ? AND b.quantity > 0
      `)
      .all(today) as any[];

    if (expiredBatches.length === 0) {
      return { sweptBatchesCount: 0, totalUnitsQuarantined: 0, records: [] };
    }

    const quarantinedBy = sweptBy || 'Varredura Automática de Validades';
    const records: any[] = [];
    let totalUnits = 0;

    this.db.transaction(() => {
      for (const b of expiredBatches) {
        // Deduz estoque vendável
        this.db.prepare('UPDATE batches SET quantity = 0 WHERE id = ?').run(b.batch_id);

        // Insere quarentena
        const res = this.db
          .prepare(`
            INSERT INTO quarantine_records (
              store_id, product_id, batch_id, quantity, reason, origin, status, notes, quarantined_by
            ) VALUES (?, ?, ?, ?, 'EXPIRED', 'INVENTORY_SWEEP', 'QUARANTINED', ?, ?)
          `)
          .run(
            storeId,
            b.product_id,
            b.batch_id,
            b.quantity,
            `Lote vencido em ${b.expiration_date}. Bloqueado preventivamente.`,
            quarantinedBy
          );

        totalUnits += b.quantity;
        records.push({
          quarantineId: Number(res.lastInsertRowid),
          productId: b.product_id,
          productName: b.product_name,
          batchNumber: b.batch_number,
          expirationDate: b.expiration_date,
          quantity: b.quantity,
        });
      }
    })();

    return {
      sweptBatchesCount: expiredBatches.length,
      totalUnitsQuarantined: totalUnits,
      records,
    };
  }

  /**
   * Registra um Alerta Sanitário de Recolhimento da ANVISA (Notivisa / Resolução RE):
   * Localiza todos os lotes correspondentes em estoque e os bloqueia para Quarentena Sanitária.
   */
  registerRecallAlert(input: RegisterRecallAlertInput): { recallId: number; anvisaReNumber: string; unitsBlocked: number } {
    const product = this.db.prepare('SELECT id, name FROM products WHERE id = ?').get(input.productId) as any;
    if (!product) {
      throw new Error(`Produto #${input.productId} não encontrado.`);
    }

    let recallId = 0;
    let unitsBlocked = 0;

    this.db.transaction(() => {
      // 1. Cadastra alerta de recall
      const alertStmt = this.db.prepare(`
        INSERT INTO recall_alerts (
          anvisa_re_number, publication_date, product_id, batch_number, reason, severity, is_active, affected_units_blocked, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?)
      `);

      const alertRes = alertStmt.run(
        input.anvisaReNumber,
        input.publicationDate,
        input.productId,
        input.batchNumber,
        input.reason,
        input.severity,
        input.createdBy
      );
      recallId = Number(alertRes.lastInsertRowid);

      // 2. Se autoBlockStock for true (padrão), localiza e transfere os lotes para quarentena
      if (input.autoBlockStock !== false) {
        const matchingBatches = this.db
          .prepare('SELECT id, quantity FROM batches WHERE product_id = ? AND batch_number = ? AND quantity > 0')
          .all(input.productId, input.batchNumber) as any[];

        for (const b of matchingBatches) {
          unitsBlocked += b.quantity;

          this.db.prepare('UPDATE batches SET quantity = 0 WHERE id = ?').run(b.id);

          this.db
            .prepare(`
              INSERT INTO quarantine_records (
                store_id, product_id, batch_id, quantity, reason, origin, status, notes, quarantined_by
              ) VALUES (1, ?, ?, ?, 'RECALL_ANVISA', 'MANUAL', 'QUARANTINED', ?, ?)
            `)
            .run(
              input.productId,
              b.id,
              b.quantity,
              `Interdição Cautelar ANVISA ${input.anvisaReNumber}: ${input.reason}`,
              input.createdBy
            );
        }

        // Atualiza quantidade bloqueada no alerta
        this.db
          .prepare('UPDATE recall_alerts SET affected_units_blocked = ? WHERE id = ?')
          .run(unitsBlocked, recallId);
      }
    })();

    return {
      recallId,
      anvisaReNumber: input.anvisaReNumber,
      unitsBlocked,
    };
  }

  /**
   * Resolve a destinação de um lote em quarentena:
   * - DISPOSED_PGRSS: encaminha para o PGRSS (RDC 222/2018)
   * - RETURNED_TO_SUPPLIER: gera NF-e de remessa para devolução/reembolso ao fornecedor
   * - RELEASED: desinterdição técnica (exige CRF do Farmacêutico RT) e restaura estoque
   */
  resolveQuarantine(quarantineId: number, input: ResolveQuarantineInput): QuarantineRecord {
    const record = this.getQuarantineById(quarantineId);
    if (!record) {
      throw new Error(`Registro de quarentena #${quarantineId} não encontrado.`);
    }

    if (record.status !== 'QUARANTINED') {
      throw new Error(`Quarentena #${quarantineId} já foi resolvida com status: ${record.status}.`);
    }

    this.db.transaction(() => {
      if (input.resolution === 'DISPOSED_PGRSS') {
        const pgrssReason =
          record.reason === 'EXPIRED'
            ? 'VENCIDO'
            : record.reason === 'DAMAGED'
            ? 'AVARIADO'
            : record.reason === 'RECALL_ANVISA'
            ? 'RECALL_ANVISA'
            : 'CONTAMINADO';

        const weightKg = Number((record.quantity * 0.15).toFixed(3)); // Peso estimado padrão 150g por caixa
        const pgrssRes = this.db
          .prepare(`
            INSERT INTO pgrss_disposal_records (
              store_id, product_id, batch_id, waste_group, reason, quantity, weight_kg,
              pharmacist_name, pharmacist_crf, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'STORED', ?)
          `)
          .run(
            record.store_id,
            record.product_id,
            record.batch_id,
            input.pgrssHazardGroup || 'GRUPO_B_QUIMICO',
            pgrssReason,
            record.quantity,
            Math.max(0.05, weightKg),
            input.resolvedBy,
            input.pharmacistCrf || 'CRF-AUTO',
            input.resolutionNotes || 'Descarte gerado a partir da Quarentena Sanitária'
          );

        const pgrssId = Number(pgrssRes.lastInsertRowid);

        this.db
          .prepare(`
            UPDATE quarantine_records
            SET status = 'DISPOSED_PGRSS',
                resolved_by = ?,
                resolved_at = CURRENT_TIMESTAMP,
                resolution_notes = ?,
                pgrss_disposal_id = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .run(input.resolvedBy, input.resolutionNotes || null, pgrssId, quarantineId);
      } else if (input.resolution === 'RETURNED_TO_SUPPLIER') {
        const fiscalKey =
          input.fiscalNfeKey ||
          `35${new Date().toISOString().slice(2, 4)}${Math.floor(10000000000000 + Math.random() * 90000000000000)}55001000000002100000002011`;

        this.db
          .prepare(`
            UPDATE quarantine_records
            SET status = 'RETURNED_TO_SUPPLIER',
                resolved_by = ?,
                resolved_at = CURRENT_TIMESTAMP,
                resolution_notes = ?,
                fiscal_nfe_key = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .run(input.resolvedBy, input.resolutionNotes || null, fiscalKey, quarantineId);
      } else if (input.resolution === 'RELEASED') {
        if (!input.pharmacistCrf) {
          throw new Error('A desinterdição e liberação de lote em quarentena exige o CRF do Farmacêutico Responsável Técnico.');
        }

        // Restaura estoque vendável
        this.db
          .prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?')
          .run(record.quantity, record.batch_id);

        this.db
          .prepare(`
            UPDATE quarantine_records
            SET status = 'RELEASED',
                resolved_by = ?,
                resolved_at = CURRENT_TIMESTAMP,
                resolution_notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .run(
            `${input.resolvedBy} (CRF: ${input.pharmacistCrf})`,
            input.resolutionNotes || 'Laudo de inspeção técnica aprovado',
            quarantineId
          );
      }
    })();

    return this.getQuarantineById(quarantineId);
  }

  /**
   * Consulta registros de quarentena com filtros
   */
  listQuarantine(storeId: number, filters?: { status?: string; reason?: string; limit?: number }): QuarantineRecord[] {
    let sql = `
      SELECT
        qr.*,
        p.name AS product_name,
        p.ean,
        p.pmc,
        b.batch_number,
        b.expiration_date
      FROM quarantine_records qr
      JOIN products p ON p.id = qr.product_id
      JOIN batches b ON b.id = qr.batch_id
      WHERE qr.store_id = ?
    `;
    const params: any[] = [storeId];

    if (filters?.status) {
      sql += ' AND qr.status = ?';
      params.push(filters.status);
    }
    if (filters?.reason) {
      sql += ' AND qr.reason = ?';
      params.push(filters.reason);
    }

    sql += ' ORDER BY qr.id DESC';

    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return this.db.prepare(sql).all(...params) as QuarantineRecord[];
  }

  /**
   * Retorna os detalhes de um registro específico de quarentena
   */
  getQuarantineById(quarantineId: number): QuarantineRecord {
    const row = this.db
      .prepare(`
        SELECT
          qr.*,
          p.name AS product_name,
          p.ean,
          p.pmc,
          b.batch_number,
          b.expiration_date
        FROM quarantine_records qr
        JOIN products p ON p.id = qr.product_id
        JOIN batches b ON b.id = qr.batch_id
        WHERE qr.id = ?
      `)
      .get(quarantineId) as QuarantineRecord | undefined;

    if (!row) {
      throw new Error(`Registro de quarentena #${quarantineId} não encontrado.`);
    }

    return row;
  }

  /**
   * Lista todos os alertas de recall cadastrados
   */
  listRecallAlerts(): RecallAlert[] {
    const rows = this.db
      .prepare(`
        SELECT
          ra.*,
          p.name AS product_name,
          p.ean
        FROM recall_alerts ra
        JOIN products p ON p.id = ra.product_id
        ORDER BY ra.id DESC
      `)
      .all() as any[];

    return rows.map((r) => ({
      ...r,
      is_active: Boolean(r.is_active),
    }));
  }

  /**
   * Retorna os KPIs consolidados da Quarentena Sanitária
   */
  getKpis(storeId: number): QuarantineKpis {
    const stats = this.db
      .prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN qr.status = 'QUARANTINED' THEN qr.quantity ELSE 0 END), 0) AS total_items,
          COALESCE(SUM(CASE WHEN qr.status = 'QUARANTINED' THEN qr.quantity * p.pmc ELSE 0 END), 0) AS total_value,
          COALESCE(SUM(CASE WHEN qr.status = 'QUARANTINED' AND qr.reason = 'EXPIRED' THEN qr.quantity ELSE 0 END), 0) AS expired_items,
          COALESCE(SUM(CASE WHEN qr.status = 'DISPOSED_PGRSS' THEN qr.quantity ELSE 0 END), 0) AS disposed_items
        FROM quarantine_records qr
        JOIN products p ON p.id = qr.product_id
        WHERE qr.store_id = ?
      `)
      .get(storeId) as any;

    const recalls = this.db
      .prepare('SELECT COUNT(id) AS active_recalls FROM recall_alerts WHERE is_active = 1')
      .get() as any;

    return {
      total_quarantined_items: Number(stats?.total_items || 0),
      total_quarantined_value: Number(stats?.total_value || 0),
      active_recalls_count: Number(recalls?.active_recalls || 0),
      expired_items_in_quarantine: Number(stats?.expired_items || 0),
      disposed_pgrss_items: Number(stats?.disposed_items || 0),
    };
  }
}
