import { Database } from '../../database/connection';
import { AddBatchDTO, Batch } from './types';

interface BatchRow {
  id: number | bigint;
  product_id: number | bigint;
  batch_number: string;
  manufacturing_date: string;
  expiration_date: string;
  quantity: number;
  reserved_quantity: number;
  created_at: string;
}

function mapBatchRow(row: BatchRow): Batch {
  const quantity = Number(row.quantity);
  const reservedQuantity = Number(row.reserved_quantity);

  return {
    id: Number(row.id),
    productId: Number(row.product_id),
    batchNumber: row.batch_number,
    manufacturingDate: row.manufacturing_date,
    expirationDate: row.expiration_date,
    quantity,
    reservedQuantity,
    availableQuantity: quantity - reservedQuantity,
    createdAt: row.created_at,
  };
}

export class InventoryService {
  constructor(private db: Database) {}

  private getCurrentDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  addBatch(dto: AddBatchDTO): Batch {
    if (dto.quantity <= 0) {
      throw new Error('INVALID_QUANTITY');
    }

    const currentDate = this.getCurrentDate();
    if (dto.expirationDate <= currentDate) {
      throw new Error('BATCH_EXPIRED');
    }

    const stmt = this.db.prepare(`
      INSERT INTO batches (
        product_id,
        batch_number,
        manufacturing_date,
        expiration_date,
        quantity,
        reserved_quantity
      ) VALUES (?, ?, ?, ?, ?, 0)
    `);

    const result = stmt.run(
      dto.productId,
      dto.batchNumber,
      dto.manufacturingDate,
      dto.expirationDate,
      dto.quantity
    );

    const insertedId = Number(result.lastInsertRowid);
    const batch = this.getBatchById(insertedId);

    if (!batch) {
      throw new Error('Failed to retrieve newly created batch');
    }

    return batch;
  }

  getBatchById(batchId: number): Batch | null {
    const stmt = this.db.prepare<BatchRow>('SELECT * FROM batches WHERE id = ?');
    const row = stmt.get(batchId);

    if (!row) {
      return null;
    }

    return mapBatchRow(row);
  }

  getAvailableBatches(productId: number): Batch[] {
    const currentDate = this.getCurrentDate();
    const stmt = this.db.prepare<BatchRow>(`
      SELECT * FROM batches
      WHERE product_id = ?
        AND (quantity - reserved_quantity) > 0
        AND expiration_date > ?
      ORDER BY expiration_date ASC, id ASC
    `);

    const rows = stmt.all(productId, currentDate);
    return rows.map(mapBatchRow);
  }

  suggestFefoBatch(productId: number, quantity: number): Batch {
    if (quantity <= 0) {
      throw new Error('INVALID_QUANTITY');
    }

    const batches = this.getAvailableBatches(productId);
    const suitable = batches.find((b) => b.availableQuantity >= quantity);

    if (!suitable) {
      throw new Error('INSUFFICIENT_STOCK');
    }

    return suitable;
  }

  reserveBatchStock(batchId: number, quantity: number): void {
    if (quantity <= 0) {
      throw new Error('INVALID_QUANTITY');
    }

    const tx = this.db.transaction(() => {
      const batch = this.getBatchById(batchId);
      if (!batch) {
        throw new Error('INSUFFICIENT_BATCH_STOCK');
      }

      if (batch.expirationDate <= this.getCurrentDate()) {
        throw new Error('BATCH_EXPIRED');
      }

      if (batch.availableQuantity < quantity) {
        throw new Error('INSUFFICIENT_BATCH_STOCK');
      }

      const stmt = this.db.prepare(
        'UPDATE batches SET reserved_quantity = reserved_quantity + ? WHERE id = ?'
      );
      stmt.run(quantity, batchId);
    });

    tx();
  }

  releaseBatchStock(batchId: number, quantity: number): void {
    if (quantity <= 0) {
      throw new Error('INVALID_QUANTITY');
    }

    const batch = this.getBatchById(batchId);
    if (!batch) {
      throw new Error('BATCH_NOT_FOUND');
    }

    const stmt = this.db.prepare(
      'UPDATE batches SET reserved_quantity = MAX(0, reserved_quantity - ?) WHERE id = ?'
    );
    stmt.run(quantity, batchId);
  }

  deductBatchStock(batchId: number, quantity: number): void {
    if (quantity <= 0) {
      throw new Error('INVALID_QUANTITY');
    }

    const tx = this.db.transaction(() => {
      const batch = this.getBatchById(batchId);
      if (!batch) {
        throw new Error('INSUFFICIENT_BATCH_STOCK');
      }

      if (batch.expirationDate <= this.getCurrentDate()) {
        throw new Error('BATCH_EXPIRED');
      }

      if (batch.quantity < quantity) {
        throw new Error('INSUFFICIENT_BATCH_STOCK');
      }

      const stmt = this.db.prepare(
        'UPDATE batches SET quantity = quantity - ?, reserved_quantity = MAX(0, reserved_quantity - ?) WHERE id = ?'
      );
      stmt.run(quantity, quantity, batchId);
    });

    tx();
  }
}
