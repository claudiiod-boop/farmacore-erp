import { Database } from '../../database/connection';
import type {
  AffectedPatientItem,
  AnvisaRecallItem,
  AnvisaRecallWithItems,
  RecallFilters,
  RegisterRecallInput,
  ResolveRecallParams,
} from './types';

interface RecallDbRow {
  id: number;
  resolution_number: string;
  resolution_date: string;
  publication_date: string;
  reason: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface RecallItemDbRow {
  id: number;
  recall_id: number;
  product_id: number;
  product_name?: string;
  ean?: string;
  batch_number: string;
  action_taken: 'BLOCKED' | 'RETURNED_TO_SUPPLIER' | 'DESTROYED';
  total_stock_blocked: number;
  blocked_at: string;
}

export class AnvisaRecallService {
  constructor(private readonly db: Database) {}

  public registerRecall(input: RegisterRecallInput): AnvisaRecallWithItems {
    const existing = this.db
      .prepare<RecallDbRow>('SELECT * FROM anvisa_recalls WHERE resolution_number = ?')
      .get(input.resolutionNumber);

    if (existing) {
      throw new Error(`Resolução Anvisa "${input.resolutionNumber}" já cadastrada no sistema`);
    }

    let recallId = 0;

    const tx = this.db.transaction(() => {
      const res = this.db
        .prepare(`
          INSERT INTO anvisa_recalls (
            resolution_number, resolution_date, publication_date, reason, notes, status
          ) VALUES (?, ?, ?, ?, ?, 'ACTIVE')
        `)
        .run(
          input.resolutionNumber,
          input.resolutionDate,
          input.publicationDate,
          input.reason,
          input.notes || null
        );

      recallId = Number(res.lastInsertRowid);

      for (const item of input.items) {
        // Find matching batches
        const batches = this.db
          .prepare<{ id: number; quantity: number }>(`
            SELECT id, quantity FROM batches 
            WHERE product_id = ? AND batch_number = ?
          `)
          .all(item.productId, item.batchNumber);

        const totalStockBlocked = batches.reduce((sum, b) => sum + b.quantity, 0);

        // Atomically block batches
        this.db
          .prepare(`
            UPDATE batches 
            SET is_blocked = 1, block_reason = ? 
            WHERE product_id = ? AND batch_number = ?
          `)
          .run(
            `RECALL ANVISA ${input.resolutionNumber}: ${input.reason}`,
            item.productId,
            item.batchNumber
          );

        // Record recall item
        this.db
          .prepare(`
            INSERT INTO anvisa_recall_items (
              recall_id, product_id, batch_number, action_taken, total_stock_blocked
            ) VALUES (?, ?, ?, 'BLOCKED', ?)
          `)
          .run(recallId, item.productId, item.batchNumber, totalStockBlocked);
      }
    });

    tx();

    const created = this.getRecallById(recallId);
    if (!created) {
      throw new Error('Falha ao registrar recall sanitário');
    }
    return created;
  }

  public getRecallById(id: number): AnvisaRecallWithItems | null {
    const row = this.db
      .prepare<RecallDbRow>('SELECT * FROM anvisa_recalls WHERE id = ?')
      .get(id);

    if (!row) {
      return null;
    }

    const items = this.db
      .prepare<RecallItemDbRow>(`
        SELECT 
          ri.id,
          ri.recall_id,
          ri.product_id,
          p.name AS product_name,
          p.ean,
          ri.batch_number,
          ri.action_taken,
          ri.total_stock_blocked,
          ri.blocked_at
        FROM anvisa_recall_items ri
        JOIN products p ON p.id = ri.product_id
        WHERE ri.recall_id = ?
        ORDER BY ri.id ASC
      `)
      .all(id);

    return {
      id: row.id,
      resolutionNumber: row.resolution_number,
      resolutionDate: row.resolution_date,
      publicationDate: row.publication_date,
      reason: row.reason,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: items.map((it) => ({
        id: it.id,
        recallId: it.recall_id,
        productId: it.product_id,
        productName: it.product_name,
        ean: it.ean,
        batchNumber: it.batch_number,
        actionTaken: it.action_taken,
        totalStockBlocked: it.total_stock_blocked,
        blockedAt: it.blocked_at,
      })),
    };
  }

  public listRecalls(filters: RecallFilters = {}): AnvisaRecallWithItems[] {
    let sql = 'SELECT * FROM anvisa_recalls WHERE 1=1';
    const params: any[] = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.search) {
      sql += ' AND (resolution_number LIKE ? OR reason LIKE ?)';
      const term = `%${filters.search.trim()}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY id DESC';

    const rows = this.db.prepare<RecallDbRow>(sql).all(...params);

    return rows.map((r) => this.getRecallById(r.id)!);
  }

  public getAffectedPatients(recallId: number): AffectedPatientItem[] {
    const sql = `
      SELECT 
        s.id AS sale_id,
        s.created_at AS sale_date,
        si.quantity,
        c.id AS customer_id,
        COALESCE(ps.patient_name, c.name, psale.customer_name, 'Consumidor Não Identificado') AS customer_name,
        COALESCE(c.cpf, psale.customer_cpf, NULL) AS cpf,
        COALESCE(c.phone, NULL) AS phone,
        CASE WHEN ps.id IS NOT NULL THEN 1 ELSE 0 END AS has_prescription,
        CASE WHEN ps.id IS NOT NULL THEN (ps.doctor_name || ' (CRM ' || ps.doctor_crm || '/' || ps.doctor_uf || ')') ELSE NULL END AS prescription_doctor
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN batches b ON b.id = si.batch_id
      JOIN anvisa_recall_items ri ON ri.batch_number = b.batch_number AND ri.product_id = b.product_id
      LEFT JOIN pre_sales psale ON psale.id = s.pre_sale_id
      LEFT JOIN prescriptions ps ON ps.pre_sale_id = psale.id
      LEFT JOIN customers c ON c.cpf = psale.customer_cpf
      WHERE ri.recall_id = ?
      ORDER BY s.created_at DESC
    `;

    interface PatientDbRow {
      sale_id: number;
      sale_date: string;
      quantity: number;
      customer_id: number | null;
      customer_name: string;
      cpf: string | null;
      phone: string | null;
      has_prescription: number;
      prescription_doctor: string | null;
    }

    const rows = this.db.prepare<PatientDbRow>(sql).all(recallId);

    return rows.map((r) => ({
      saleId: r.sale_id,
      saleDate: r.sale_date,
      quantity: r.quantity,
      customerId: r.customer_id,
      customerName: r.customer_name,
      cpf: r.cpf,
      phone: r.phone,
      hasPrescription: Boolean(r.has_prescription),
      prescriptionDoctor: r.prescription_doctor,
    }));
  }

  public resolveRecall(recallId: number, params: ResolveRecallParams): AnvisaRecallWithItems {
    const recall = this.getRecallById(recallId);
    if (!recall) {
      throw new Error(`Recall com ID ${recallId} não encontrado`);
    }

    const tx = this.db.transaction(() => {
      let notes = recall.notes || '';
      if (params.notes) {
        notes = notes ? `${notes} | ${params.notes}` : params.notes;
      }

      this.db
        .prepare(`
          UPDATE anvisa_recalls 
          SET status = 'COMPLETED', notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(notes, recallId);

      this.db
        .prepare(`
          UPDATE anvisa_recall_items 
          SET action_taken = ? 
          WHERE recall_id = ?
        `)
        .run(params.actionTaken, recallId);
    });

    tx();

    return this.getRecallById(recallId)!;
  }
}
