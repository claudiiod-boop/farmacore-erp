import { getDatabase, Database } from '../../database/connection';
import { StoreService } from '../stores/store.service';
import { formatTransferSlip } from './transfer-slip-formatter';
import type { Store } from '../stores/types';
import type {
  Transfer,
  TransferItem,
  TransferWithItems,
  CreateTransferInput,
  CarrierInfo,
  ReceiveItemInput,
  TransferFilters,
  TransferStatus,
} from './types';

interface TransferRow {
  id: number;
  transfer_number: string;
  source_store_id: number;
  target_store_id: number;
  status: TransferStatus;
  requested_by: string;
  dispatched_by: string | null;
  received_by: string | null;
  carrier_name: string | null;
  tracking_code: string | null;
  notes: string | null;
  nfe_key: string | null;
  nfe_protocol: string | null;
  cfop: string;
  dispatched_at: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TransferItemRow {
  id: number;
  transfer_id: number;
  product_id: number;
  product_name?: string | null;
  source_batch_id: number | null;
  batch_number: string;
  expiration_date: string;
  manufacturing_date: string;
  requested_quantity: number;
  shipped_quantity: number;
  received_quantity: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
}

function mapTransferItemRow(row: TransferItemRow): TransferItem {
  return {
    id: Number(row.id),
    transferId: Number(row.transfer_id),
    productId: Number(row.product_id),
    productName: row.product_name || undefined,
    sourceBatchId: row.source_batch_id ? Number(row.source_batch_id) : null,
    batchNumber: row.batch_number || '',
    expirationDate: row.expiration_date || '',
    manufacturingDate: row.manufacturing_date || '',
    requestedQuantity: Number(row.requested_quantity || 0),
    shippedQuantity: Number(row.shipped_quantity || 0),
    receivedQuantity: Number(row.received_quantity || 0),
    unitCost: Number(row.unit_cost || 0),
    totalCost: Number(row.total_cost || 0),
    createdAt: row.created_at,

    // DB compatibility aliases
    transfer_id: Number(row.transfer_id),
    product_id: Number(row.product_id),
    product_name: row.product_name || undefined,
    source_batch_id: row.source_batch_id ? Number(row.source_batch_id) : null,
    batch_number: row.batch_number || '',
    expiration_date: row.expiration_date || '',
    manufacturing_date: row.manufacturing_date || '',
    requested_quantity: Number(row.requested_quantity || 0),
    shipped_quantity: Number(row.shipped_quantity || 0),
    received_quantity: Number(row.received_quantity || 0),
    unit_cost: Number(row.unit_cost || 0),
    total_cost: Number(row.total_cost || 0),
    created_at: row.created_at,
  };
}

function mapTransferRow(
  row: TransferRow,
  items: TransferItem[],
  sourceStore?: Store,
  targetStore?: Store
): TransferWithItems {
  return {
    id: Number(row.id),
    transferNumber: row.transfer_number,
    sourceStoreId: Number(row.source_store_id),
    targetStoreId: Number(row.target_store_id),
    status: row.status,
    requestedBy: row.requested_by,
    dispatchedBy: row.dispatched_by ?? null,
    receivedBy: row.received_by ?? null,
    carrierName: row.carrier_name ?? null,
    trackingCode: row.tracking_code ?? null,
    notes: row.notes ?? null,
    nfeKey: row.nfe_key ?? null,
    nfeProtocol: row.nfe_protocol ?? null,
    cfop: row.cfop,
    dispatchedAt: row.dispatched_at ?? null,
    receivedAt: row.received_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
    sourceStore,
    targetStore,

    // DB compatibility aliases
    transfer_number: row.transfer_number,
    source_store_id: Number(row.source_store_id),
    target_store_id: Number(row.target_store_id),
    requested_by: row.requested_by,
    dispatched_by: row.dispatched_by ?? null,
    received_by: row.received_by ?? null,
    carrier_name: row.carrier_name ?? null,
    tracking_code: row.tracking_code ?? null,
    nfe_key: row.nfe_key ?? null,
    nfe_protocol: row.nfe_protocol ?? null,
    dispatched_at: row.dispatched_at ?? null,
    received_at: row.received_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class TransferService {
  private storeService: StoreService;

  constructor(private db: Database = getDatabase()) {
    this.storeService = new StoreService(this.db);
  }

  private getCurrentDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Generates next sequential unique transfer number in format TRF-YYYYMMDD-XXXX
   */
  private generateTransferNumber(): string {
    const todayStr = this.getCurrentDate().replace(/-/g, '');
    const prefix = `TRF-${todayStr}-`;

    const lastRow = this.db
      .prepare('SELECT transfer_number FROM transfers WHERE transfer_number LIKE ? ORDER BY id DESC LIMIT 1')
      .get(`${prefix}%`) as { transfer_number: string } | undefined;

    let nextSeq = 1;
    if (lastRow?.transfer_number) {
      const parts = lastRow.transfer_number.split('-');
      const seqStr = parts[parts.length - 1];
      const parsed = parseInt(seqStr, 10);
      if (!isNaN(parsed)) {
        nextSeq = parsed + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Cria uma nova transferência entre filiais com validações cadastrais e de itens.
   */
  createTransfer(input: CreateTransferInput): TransferWithItems {
    const sourceStoreId = Number(input.sourceStoreId ?? input.source_store_id);
    const targetStoreId = Number(input.targetStoreId ?? input.target_store_id);
    const requestedBy = (input.requestedBy ?? input.requested_by ?? '').trim();
    const notes = input.notes?.trim() || null;
    const items = input.items || [];
    const status: TransferStatus = input.status || 'DRAFT';

    if (!sourceStoreId || !targetStoreId) {
      throw new Error('Lojas de origem e destino são obrigatórias');
    }

    if (sourceStoreId === targetStoreId) {
      throw new Error('A loja de origem deve ser diferente da loja de destino (não podem ser a mesma loja)');
    }

    const sourceStore = this.storeService.getStoreById(sourceStoreId);
    if (!sourceStore || !sourceStore.isActive) {
      throw new Error('Loja de origem não encontrada ou inativa');
    }

    const targetStore = this.storeService.getStoreById(targetStoreId);
    if (!targetStore || !targetStore.isActive) {
      throw new Error('Loja de destino não encontrada ou inativa');
    }

    if (!requestedBy) {
      throw new Error('Campo obrigatório: requestedBy');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('A transferência deve conter ao menos um item');
    }

    // Determine CFOP: 5152 for internal (same UF), 6152 for interstate (different UF)
    const cfop = input.cfop || (sourceStore.state === targetStore.state ? '5152' : '6152');

    // Validate items and resolve pricing
    const processedItems = items.map((item) => {
      const productId = Number(item.productId ?? item.product_id);
      const requestedQuantity = Number(item.requestedQuantity ?? item.requested_quantity);

      if (!productId) {
        throw new Error('Item com productId inválido');
      }

      if (isNaN(requestedQuantity) || requestedQuantity <= 0) {
        throw new Error('Quantidade deve ser maior que zero');
      }

      const prod = this.db.prepare('SELECT id, name, pf FROM products WHERE id = ?').get(productId) as
        | { id: number; name: string; pf: number }
        | undefined;

      if (!prod) {
        throw new Error(`Produto não encontrado: ID ${productId}`);
      }

      const unitCost = Number(item.unitCost ?? item.unit_cost ?? prod.pf ?? 0.0);
      const totalCost = Number((unitCost * requestedQuantity).toFixed(2));
      const batchNumber = (item.batchNumber ?? item.batch_number ?? '').trim();
      const expirationDate = (item.expirationDate ?? item.expiration_date ?? '').trim();
      const manufacturingDate = (item.manufacturingDate ?? item.manufacturing_date ?? '').trim();
      const sourceBatchId = item.sourceBatchId ?? item.source_batch_id ?? null;

      return {
        productId,
        productName: prod.name,
        requestedQuantity,
        unitCost,
        totalCost,
        batchNumber,
        expirationDate,
        manufacturingDate,
        sourceBatchId,
      };
    });

    const transferNumber = this.generateTransferNumber();

    const tx = this.db.transaction(() => {
      const insertTransferStmt = this.db.prepare(`
        INSERT INTO transfers (
          transfer_number, source_store_id, target_store_id, status, requested_by, notes, cfop
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertTransferStmt.run(
        transferNumber,
        sourceStoreId,
        targetStoreId,
        status,
        requestedBy,
        notes,
        cfop
      );

      const transferId = Number(result.lastInsertRowid);

      const insertItemStmt = this.db.prepare(`
        INSERT INTO transfer_items (
          transfer_id, product_id, source_batch_id, batch_number, expiration_date, manufacturing_date,
          requested_quantity, shipped_quantity, received_quantity, unit_cost, total_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
      `);

      for (const item of processedItems) {
        insertItemStmt.run(
          transferId,
          item.productId,
          item.sourceBatchId,
          item.batchNumber,
          item.expirationDate,
          item.manufacturingDate,
          item.requestedQuantity,
          item.unitCost,
          item.totalCost
        );
      }

      return transferId;
    });

    const createdId = tx();
    return this.getTransferById(createdId)!;
  }

  /**
   * Despacha uma transferência: realiza verificação FEFO e baixa física no estoque da loja de origem.
   */
  dispatchTransfer(transferId: number, dispatchedBy: string, carrierInfo?: CarrierInfo): TransferWithItems {
    const operator = (dispatchedBy || '').trim();
    if (!operator) {
      throw new Error('Responsável pelo despacho é obrigatório');
    }

    const transfer = this.getTransferById(transferId);
    if (!transfer) {
      throw new Error('Transferência não encontrada');
    }

    if (transfer.status !== 'DRAFT' && transfer.status !== 'REQUESTED') {
      throw new Error(`Transferência não pode ser despachada no status atual: ${transfer.status}`);
    }

    const sourceStore = transfer.sourceStore || this.storeService.getStoreById(transfer.sourceStoreId);
    const targetStore = transfer.targetStore || this.storeService.getStoreById(transfer.targetStoreId);

    const cfop = sourceStore?.state === targetStore?.state ? '5152' : '6152';

    const tx = this.db.transaction(() => {
      const currentDate = this.getCurrentDate();

      for (const item of transfer.items) {
        // Find available batches for this product in source store (FEFO: earliest expiration first)
        const batches = this.db
          .prepare(`
            SELECT id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
            FROM batches
            WHERE store_id = ? AND product_id = ? AND expiration_date >= ? AND (quantity - reserved_quantity) > 0
            ORDER BY expiration_date ASC, id ASC
          `)
          .all(transfer.sourceStoreId, item.productId, currentDate) as Array<{
          id: number;
          batch_number: string;
          manufacturing_date: string;
          expiration_date: string;
          quantity: number;
          reserved_quantity: number;
        }>;

        const totalAvailable = batches.reduce((sum, b) => sum + (b.quantity - b.reserved_quantity), 0);
        if (totalAvailable < item.requestedQuantity) {
          throw new Error(
            `Estoque insuficiente para o produto ID ${item.productId} na loja de origem. Solicitado: ${item.requestedQuantity}, Disponível: ${totalAvailable}`
          );
        }

        let remaining = item.requestedQuantity;
        let isFirstBatch = true;

        for (const batch of batches) {
          if (remaining <= 0) break;
          const batchAvail = batch.quantity - batch.reserved_quantity;
          const deductAmount = Math.min(batchAvail, remaining);

          // Deduct from batch in source store
          this.db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?').run(deductAmount, batch.id);

          if (isFirstBatch) {
            // Update existing transfer_item
            this.db
              .prepare(`
                UPDATE transfer_items
                SET source_batch_id = ?, batch_number = ?, expiration_date = ?, manufacturing_date = ?,
                    requested_quantity = ?, shipped_quantity = ?, total_cost = ?
                WHERE id = ?
              `)
              .run(
                batch.id,
                batch.batch_number,
                batch.expiration_date,
                batch.manufacturing_date,
                deductAmount,
                deductAmount,
                Number((item.unitCost * deductAmount).toFixed(2)),
                item.id
              );
            isFirstBatch = false;
          } else {
            // Insert split transfer_item row for additional batch
            this.db
              .prepare(`
                INSERT INTO transfer_items (
                  transfer_id, product_id, source_batch_id, batch_number, expiration_date, manufacturing_date,
                  requested_quantity, shipped_quantity, received_quantity, unit_cost, total_cost
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
              `)
              .run(
                transfer.id,
                item.productId,
                batch.id,
                batch.batch_number,
                batch.expiration_date,
                batch.manufacturing_date,
                deductAmount,
                deductAmount,
                item.unitCost,
                Number((item.unitCost * deductAmount).toFixed(2))
              );
          }

          remaining -= deductAmount;
        }
      }

      const carrierName = carrierInfo?.carrierName ?? carrierInfo?.carrier_name ?? null;
      const trackingCode = carrierInfo?.trackingCode ?? carrierInfo?.tracking_code ?? null;

      this.db
        .prepare(`
          UPDATE transfers
          SET status = 'IN_TRANSIT',
              dispatched_by = ?,
              dispatched_at = CURRENT_TIMESTAMP,
              carrier_name = ?,
              tracking_code = ?,
              cfop = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(operator, carrierName, trackingCode, cfop, transferId);
    });

    tx();
    return this.getTransferById(transferId)!;
  }

  /**
   * Recebe uma transferência na loja de destino: incorpora quantidades em lotes existentes ou cria novos lotes.
   */
  receiveTransfer(transferId: number, receivedBy: string, itemsConfirmed?: ReceiveItemInput[]): TransferWithItems {
    const operator = (receivedBy || '').trim();
    if (!operator) {
      throw new Error('Responsável pelo recebimento é obrigatório');
    }

    const transfer = this.getTransferById(transferId);
    if (!transfer) {
      throw new Error('Transferência não encontrada');
    }

    if (transfer.status !== 'IN_TRANSIT') {
      throw new Error(`Transferência não pode ser recebida no status atual: ${transfer.status}`);
    }

    const tx = this.db.transaction(() => {
      for (const item of transfer.items) {
        let recQty = item.shippedQuantity;
        if (itemsConfirmed && itemsConfirmed.length > 0) {
          const conf = itemsConfirmed.find((c) => (c.itemId ?? c.item_id) === item.id);
          if (conf) {
            recQty = Number(conf.receivedQuantity ?? conf.received_quantity ?? item.shippedQuantity);
          }
        }

        if (recQty < 0) {
          throw new Error(`Quantidade recebida inválida para o item ID ${item.id}`);
        }

        // Look for existing batch in target store with matching product_id, batch_number, expiration_date
        const existingBatch = this.db
          .prepare(`
            SELECT id, quantity FROM batches
            WHERE store_id = ? AND product_id = ? AND batch_number = ? AND expiration_date = ?
          `)
          .get(transfer.targetStoreId, item.productId, item.batchNumber, item.expirationDate) as
          | { id: number; quantity: number }
          | undefined;

        if (existingBatch) {
          this.db
            .prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?')
            .run(recQty, existingBatch.id);
        } else {
          this.db
            .prepare(`
              INSERT INTO batches (
                store_id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
              ) VALUES (?, ?, ?, ?, ?, ?, 0)
            `)
            .run(
              transfer.targetStoreId,
              item.productId,
              item.batchNumber,
              item.manufacturingDate,
              item.expirationDate,
              recQty
            );
        }

        this.db.prepare('UPDATE transfer_items SET received_quantity = ? WHERE id = ?').run(recQty, item.id);
      }

      this.db
        .prepare(`
          UPDATE transfers
          SET status = 'RECEIVED',
              received_by = ?,
              received_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(operator, transferId);
    });

    tx();
    return this.getTransferById(transferId)!;
  }

  /**
   * Cancela uma transferência. Se estiver IN_TRANSIT, estorna atomicamente o estoque para os lotes de origem.
   */
  cancelTransfer(transferId: number, reason: string): TransferWithItems {
    const cancelReason = (reason || '').trim();
    if (!cancelReason) {
      throw new Error('Motivo do cancelamento é obrigatório');
    }

    const transfer = this.getTransferById(transferId);
    if (!transfer) {
      throw new Error('Transferência não encontrada');
    }

    if (transfer.status === 'RECEIVED') {
      throw new Error('Transferência já recebida não pode ser cancelada');
    }

    if (transfer.status === 'CANCELLED') {
      throw new Error('Transferência já cancelada');
    }

    const tx = this.db.transaction(() => {
      if (transfer.status === 'IN_TRANSIT') {
        for (const item of transfer.items) {
          if (item.sourceBatchId && item.shippedQuantity > 0) {
            this.db
              .prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?')
              .run(item.shippedQuantity, item.sourceBatchId);
          }
        }
      }

      const notes = transfer.notes
        ? `${transfer.notes} | Cancelamento: ${cancelReason}`
        : `Cancelamento: ${cancelReason}`;

      this.db
        .prepare(`
          UPDATE transfers
          SET status = 'CANCELLED',
              notes = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(notes, transferId);
    });

    tx();
    return this.getTransferById(transferId)!;
  }

  /**
   * Recupera os dados completos de uma transferência por ID, incluindo itens, loja de origem e loja de destino.
   */
  getTransferById(id: number): TransferWithItems | null {
    const row = this.db.prepare('SELECT * FROM transfers WHERE id = ?').get(id) as TransferRow | undefined;
    if (!row) {
      return null;
    }

    const itemRows = this.db
      .prepare(`
        SELECT ti.*, p.name as product_name
        FROM transfer_items ti
        LEFT JOIN products p ON p.id = ti.product_id
        WHERE ti.transfer_id = ?
        ORDER BY ti.id ASC
      `)
      .all(id) as TransferItemRow[];

    const items = itemRows.map(mapTransferItemRow);
    const sourceStore = this.storeService.getStoreById(Number(row.source_store_id)) || undefined;
    const targetStore = this.storeService.getStoreById(Number(row.target_store_id)) || undefined;

    return mapTransferRow(row, items, sourceStore, targetStore);
  }

  /**
   * Lista transferências com suporte a filtros e paginação.
   */
  listTransfers(filters?: TransferFilters): { transfers: TransferWithItems[]; total: number } {
    const conditions: string[] = [];
    const values: any[] = [];

    const status = filters?.status;
    if (status) {
      conditions.push('status = ?');
      values.push(status);
    }

    const sourceStoreId = filters?.sourceStoreId ?? filters?.source_store_id;
    if (sourceStoreId) {
      conditions.push('source_store_id = ?');
      values.push(Number(sourceStoreId));
    }

    const targetStoreId = filters?.targetStoreId ?? filters?.target_store_id;
    if (targetStoreId) {
      conditions.push('target_store_id = ?');
      values.push(Number(targetStoreId));
    }

    const startDate = filters?.startDate ?? filters?.start_date;
    if (startDate) {
      conditions.push('DATE(created_at) >= DATE(?)');
      values.push(startDate);
    }

    const endDate = filters?.endDate ?? filters?.end_date;
    if (endDate) {
      conditions.push('DATE(created_at) <= DATE(?)');
      values.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = this.db.prepare(`SELECT COUNT(*) as total FROM transfers ${whereClause}`).get(...values) as {
      total: number;
    };
    const total = Number(countRow?.total || 0);

    const limit = filters?.limit !== undefined ? Number(filters.limit) : 50;
    const offset = filters?.offset !== undefined ? Number(filters.offset) : 0;

    const queryRows = this.db
      .prepare(`SELECT id FROM transfers ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...values, limit, offset) as Array<{ id: number }>;

    const transfers: TransferWithItems[] = [];
    for (const r of queryRows) {
      const transfer = this.getTransferById(r.id);
      if (transfer) {
        transfers.push(transfer);
      }
    }

    return { transfers, total };
  }

  /**
   * Emite o Romaneio de Transferência formatado para impressão térmica/documental (80 colunas e ESC/POS).
   */
  generateTransferSlip(transferId: number): { textSlip: string; fullEscPos: string } {
    const transfer = this.getTransferById(transferId);
    if (!transfer) {
      throw new Error(`Transferência não encontrada: ID ${transferId}`);
    }

    const sourceStore = transfer.sourceStore || this.storeService.getStoreById(transfer.sourceStoreId);
    const targetStore = transfer.targetStore || this.storeService.getStoreById(transfer.targetStoreId);

    if (!sourceStore || !targetStore) {
      throw new Error('Loja de origem ou destino não encontrada para o romaneio');
    }

    return formatTransferSlip(transfer, sourceStore, targetStore);
  }
}

