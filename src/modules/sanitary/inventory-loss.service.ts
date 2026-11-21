import { Database } from '../../database/connection';
import type {
  ApproveLossParams,
  CreateLossDraftInput,
  DisposalCertificateParams,
  InventoryLossItem,
  InventoryLossWithItems,
  LossFilters,
} from './types';

interface LossDbRow {
  id: number;
  loss_number: string;
  store_id: number;
  reason: 'EXPIRED' | 'BROKEN_DAMAGED' | 'RECALL_ANVISA' | 'TEMPERATURE_EXCURSION' | 'THEFT_STOLEN' | 'OTHER';
  status: 'DRAFT' | 'APPROVED' | 'DISPOSED';
  total_cost_amount: number;
  total_sale_amount: number;
  responsible_pharmacist_name: string;
  pharmacist_crf: string;
  pharmacist_crf_uf: string;
  laudo_number: string | null;
  disposal_company_name: string | null;
  disposal_certificate_number: string | null;
  mtr_number: string | null;
  disposed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface LossItemDbRow {
  id: number;
  loss_id: number;
  product_id: number;
  product_name: string;
  batch_id: number | null;
  batch_number: string;
  expiration_date: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  unit_sale_price: number;
  total_sale_price: number;
  created_at: string;
}

export class InventoryLossService {
  constructor(private readonly db: Database) {}

  private generateLossNumber(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `PER-${yearMonth}-`;

    const last = this.db
      .prepare<{ loss_number: string }>(
        'SELECT loss_number FROM inventory_losses WHERE loss_number LIKE ? ORDER BY loss_number DESC LIMIT 1'
      )
      .get(`${prefix}%`);

    let seq = 1;
    if (last?.loss_number) {
      const parts = last.loss_number.split('-');
      if (parts.length === 3) {
        const num = parseInt(parts[2], 10);
        if (!isNaN(num)) {
          seq = num + 1;
        }
      }
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  public createLossDraft(input: CreateLossDraftInput): InventoryLossWithItems {
    if (!input.items || input.items.length === 0) {
      throw new Error('A baixa de perda deve conter ao menos um item');
    }

    const lossNumber = this.generateLossNumber();

    let totalCostAmount = 0;
    let totalSaleAmount = 0;

    for (const item of input.items) {
      if (item.quantity <= 0) {
        throw new Error(`Quantidade inválida para o produto ${item.productId}: ${item.quantity}`);
      }
      totalCostAmount += item.quantity * item.unitCost;
      totalSaleAmount += item.quantity * item.unitSalePrice;
    }

    totalCostAmount = Number(totalCostAmount.toFixed(2));
    totalSaleAmount = Number(totalSaleAmount.toFixed(2));

    let lossId = 0;

    const tx = this.db.transaction(() => {
      const res = this.db
        .prepare(`
          INSERT INTO inventory_losses (
            loss_number, store_id, reason, status, total_cost_amount, total_sale_amount,
            responsible_pharmacist_name, pharmacist_crf, pharmacist_crf_uf, notes
          ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)
        `)
        .run(
          lossNumber,
          input.storeId,
          input.reason,
          totalCostAmount,
          totalSaleAmount,
          input.responsiblePharmacistName,
          input.pharmacistCrf,
          input.pharmacistCrfUf,
          input.notes || null
        );

      lossId = Number(res.lastInsertRowid);

      const insertItem = this.db.prepare(`
        INSERT INTO inventory_loss_items (
          loss_id, product_id, product_name, batch_id, batch_number,
          expiration_date, quantity, unit_cost, total_cost, unit_sale_price, total_sale_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of input.items) {
        // Fetch product name
        const prod = this.db
          .prepare<{ name: string }>('SELECT name FROM products WHERE id = ?')
          .get(item.productId);
        const productName = prod ? prod.name : `Produto #${item.productId}`;

        const itemTotalCost = Number((item.quantity * item.unitCost).toFixed(2));
        const itemTotalSale = Number((item.quantity * item.unitSalePrice).toFixed(2));

        insertItem.run(
          lossId,
          item.productId,
          productName,
          item.batchId || null,
          item.batchNumber,
          item.expirationDate,
          item.quantity,
          item.unitCost,
          itemTotalCost,
          item.unitSalePrice,
          itemTotalSale
        );
      }
    });

    tx();

    const created = this.getLossById(lossId);
    if (!created) {
      throw new Error('Falha ao criar rascunho de baixa');
    }
    return created;
  }

  public getLossById(id: number): InventoryLossWithItems | null {
    const row = this.db
      .prepare<LossDbRow>('SELECT * FROM inventory_losses WHERE id = ?')
      .get(id);

    if (!row) return null;

    const items = this.db
      .prepare<LossItemDbRow>(`
        SELECT * FROM inventory_loss_items WHERE loss_id = ? ORDER BY id ASC
      `)
      .all(id);

    return {
      id: row.id,
      lossNumber: row.loss_number,
      storeId: row.store_id,
      reason: row.reason,
      status: row.status,
      totalCostAmount: row.total_cost_amount,
      totalSaleAmount: row.total_sale_amount,
      responsiblePharmacistName: row.responsible_pharmacist_name,
      pharmacistCrf: row.pharmacist_crf,
      pharmacistCrfUf: row.pharmacist_crf_uf,
      laudoNumber: row.laudo_number,
      disposalCompanyName: row.disposal_company_name,
      disposalCertificateNumber: row.disposal_certificate_number,
      mtrNumber: row.mtr_number,
      disposedAt: row.disposed_at,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: items.map((it) => ({
        id: it.id,
        lossId: it.loss_id,
        productId: it.product_id,
        productName: it.product_name,
        batchId: it.batch_id,
        batchNumber: it.batch_number,
        expirationDate: it.expiration_date,
        quantity: it.quantity,
        unitCost: it.unit_cost,
        totalCost: it.total_cost,
        unitSalePrice: it.unit_sale_price,
        totalSalePrice: it.total_sale_price,
        createdAt: it.created_at,
      })),
    };
  }

  public listLosses(filters: LossFilters = {}): InventoryLossWithItems[] {
    let sql = 'SELECT * FROM inventory_losses WHERE 1=1';
    const params: any[] = [];

    if (filters.storeId !== undefined) {
      sql += ' AND store_id = ?';
      params.push(filters.storeId);
    }

    if (filters.reason) {
      sql += ' AND reason = ?';
      params.push(filters.reason);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.startDate) {
      sql += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    sql += ' ORDER BY id DESC';

    const rows = this.db.prepare<LossDbRow>(sql).all(...params);

    return rows.map((r) => this.getLossById(r.id)!);
  }

  public approveAndDeductStock(lossId: number, params: ApproveLossParams): InventoryLossWithItems {
    const loss = this.getLossById(lossId);
    if (!loss) {
      throw new Error(`Baixa com ID ${lossId} não encontrada`);
    }

    if (loss.status !== 'DRAFT') {
      throw new Error(`Apenas baixas com status DRAFT podem ser aprovadas. Status atual: ${loss.status}`);
    }

    const tx = this.db.transaction(() => {
      // Deduct stock for each item
      for (const item of loss.items) {
        let batch: { id: number; quantity: number } | undefined;

        if (item.batchId) {
          batch = this.db
            .prepare<{ id: number; quantity: number }>('SELECT id, quantity FROM batches WHERE id = ?')
            .get(item.batchId);
        } else {
          batch = this.db
            .prepare<{ id: number; quantity: number }>(
              'SELECT id, quantity FROM batches WHERE product_id = ? AND batch_number = ? LIMIT 1'
            )
            .get(item.productId, item.batchNumber);
        }

        if (!batch) {
          throw new Error(`Lote ${item.batchNumber} não encontrado no estoque`);
        }

        if (batch.quantity < item.quantity) {
          throw new Error(
            `Saldo insuficiente no lote ${item.batchNumber}. Saldo disponível: ${batch.quantity}, solicitado para baixa: ${item.quantity}`
          );
        }

        // Deduct batch quantity
        this.db
          .prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?')
          .run(item.quantity, batch.id);
      }

      // Update loss record
      const pharmName = params.approvedByPharmacistName || loss.responsiblePharmacistName;
      const crf = params.pharmacistCrf || loss.pharmacistCrf;
      const crfUf = params.pharmacistCrfUf || loss.pharmacistCrfUf;

      let notes = loss.notes || '';
      if (params.notes) {
        notes = notes ? `${notes} | ${params.notes}` : params.notes;
      }

      this.db
        .prepare(`
          UPDATE inventory_losses 
          SET status = 'APPROVED',
              responsible_pharmacist_name = ?,
              pharmacist_crf = ?,
              pharmacist_crf_uf = ?,
              notes = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(pharmName, crf, crfUf, notes || null, lossId);
    });

    tx();

    return this.getLossById(lossId)!;
  }

  public recordDisposalCertificate(
    lossId: number,
    params: DisposalCertificateParams
  ): InventoryLossWithItems {
    const loss = this.getLossById(lossId);
    if (!loss) {
      throw new Error(`Baixa com ID ${lossId} não encontrada`);
    }

    if (loss.status !== 'APPROVED') {
      throw new Error(`Apenas baixas com status APPROVED podem registrar descarte. Status atual: ${loss.status}`);
    }

    const laudoNumber = params.laudoNumber || `LAUDO-${loss.lossNumber}`;
    const disposedAt = params.disposedAt || new Date().toISOString();

    let notes = loss.notes || '';
    if (params.notes) {
      notes = notes ? `${notes} | ${params.notes}` : params.notes;
    }

    this.db
      .prepare(`
        UPDATE inventory_losses
        SET status = 'DISPOSED',
            disposal_company_name = ?,
            disposal_certificate_number = ?,
            mtr_number = ?,
            laudo_number = ?,
            disposed_at = ?,
            notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(
        params.disposalCompanyName,
        params.disposalCertificateNumber,
        params.mtrNumber || null,
        laudoNumber,
        disposedAt,
        notes || null,
        lossId
      );

    return this.getLossById(lossId)!;
  }
}
