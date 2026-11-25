import { Database } from '../../database/connection';
import {
  StockInventory,
  StockInventoryItem,
  StockInventoryAdjustment,
  CreateInventoryInput,
  ItemCountInput,
  ApproveControlledInput,
  InventoryKpis,
  InventoryStatus
} from './blind-inventory.types';

export class BlindInventoryService {
  constructor(private db: Database) {}

  /**
   * 1. Inicia Sessão de Inventário Cego / Balanço
   */
  async createInventorySession(input: CreateInventoryInput): Promise<StockInventory> {
    const store = this.db.prepare('SELECT id FROM stores WHERE id = ?').get(input.store_id);
    if (!store) {
      throw new Error('STORE_NOT_FOUND');
    }

    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    const countRow = this.db.prepare('SELECT COUNT(*) as count FROM stock_inventories').get() as { count: number };
    const code = `INV-${yearMonth}-${String(countRow.count + 1).padStart(4, '0')}`;
    const now = new Date().toISOString();

    let newInventoryId = 0;

    this.db.transaction(() => {
      const insInv = this.db.prepare(`
        INSERT INTO stock_inventories (
          code, store_id, type, status, started_at, responsible_user_id,
          responsible_pharmacist_crf, notes, created_at, updated_at
        ) VALUES (
          ?, ?, ?, 'COUNTING', ?, ?,
          ?, ?, ?, ?
        )
      `).run(
        code,
        input.store_id,
        input.type,
        now,
        input.responsible_user_id || null,
        input.responsible_pharmacist_crf || null,
        input.notes || null,
        now,
        now
      );

      newInventoryId = Number(insInv.lastInsertRowid);

      // Snapshot dos produtos e lotes para o inventário
      let query = `
        SELECT
          p.id as product_id,
          p.control_type,
          p.stripe,
          p.price,
          b.id as batch_id,
          COALESCE(b.quantity, 0) as batch_qty
        FROM products p
        LEFT JOIN batches b ON p.id = b.product_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (input.type === 'CONTROLADOS_SNGPC') {
        query += ` AND (p.control_type IN ('PORTARIA_344', 'CONTROLADO', 'SNGPC') OR p.stripe = 'PRETA')`;
      } else if (input.product_ids && input.product_ids.length > 0) {
        query += ` AND p.id IN (${input.product_ids.map(() => '?').join(',')})`;
        params.push(...input.product_ids);
      }

      const rows = this.db.prepare(query).all(...params) as Array<{
        product_id: number;
        control_type: string;
        stripe: string;
        price: number;
        batch_id: number | null;
        batch_qty: number;
      }>;

      const insItem = this.db.prepare(`
        INSERT INTO stock_inventory_items (
          inventory_id, product_id, batch_id, system_quantity, counted_quantity,
          unit_cost, is_controlled, requires_pharmacist_approval, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?, 0, ?, ?)
      `);

      for (const r of rows) {
        const isControlled =
          r.control_type === 'PORTARIA_344' ||
          r.control_type === 'CONTROLADO' ||
          r.stripe === 'PRETA'
            ? 1
            : 0;

        insItem.run(
          newInventoryId,
          r.product_id,
          r.batch_id,
          r.batch_qty,
          r.price,
          isControlled,
          now,
          now
        );
      }
    })();

    return (await this.getInventoryById(newInventoryId, true))!;
  }

  /**
   * 2. Registra contagem cega de um item (sem feedback do estoque real do sistema)
   */
  async registerItemCount(input: ItemCountInput): Promise<StockInventoryItem> {
    const inv = this.db.prepare('SELECT id, status FROM stock_inventories WHERE id = ?').get(input.inventory_id) as any;
    if (!inv) throw new Error('INVENTORY_NOT_FOUND');
    if (inv.status === 'FINALIZED' || inv.status === 'CANCELLED') {
      throw new Error('INVENTORY_CLOSED');
    }

    const now = new Date().toISOString();

    // Procura item existente pelo product_id e batch_id
    let existing = this.db.prepare(`
      SELECT * FROM stock_inventory_items
      WHERE inventory_id = ? AND product_id = ? AND (batch_id = ? OR (batch_id IS NULL AND ? IS NULL))
    `).get(input.inventory_id, input.product_id, input.batch_id || null, input.batch_id || null) as any;

    if (existing) {
      this.db.prepare(`
        UPDATE stock_inventory_items
        SET counted_quantity = ?, updated_at = ?
        WHERE id = ?
      `).run(input.counted_quantity, now, existing.id);
    } else {
      const prod = this.db.prepare('SELECT * FROM products WHERE id = ?').get(input.product_id) as any;
      if (!prod) throw new Error('PRODUCT_NOT_FOUND');

      const isControlled =
        prod.control_type === 'PORTARIA_344' ||
        prod.control_type === 'CONTROLADO' ||
        prod.stripe === 'PRETA'
          ? 1
          : 0;

      const ins = this.db.prepare(`
        INSERT INTO stock_inventory_items (
          inventory_id, product_id, batch_id, system_quantity, counted_quantity,
          unit_cost, is_controlled, created_at, updated_at
        ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)
      `).run(
        input.inventory_id,
        input.product_id,
        input.batch_id || null,
        input.counted_quantity,
        prod.price,
        isControlled,
        now,
        now
      );

      existing = { id: ins.lastInsertRowid };
    }

    return (this.db.prepare('SELECT * FROM stock_inventory_items WHERE id = ?').get(existing.id) as StockInventoryItem);
  }

  /**
   * 3. Reconciliação e Auditoria de Divergências
   */
  async reconcileDivergences(inventoryId: number): Promise<StockInventory> {
    const inv = this.db.prepare('SELECT * FROM stock_inventories WHERE id = ?').get(inventoryId) as any;
    if (!inv) throw new Error('INVENTORY_NOT_FOUND');

    const items = this.db.prepare(`
      SELECT * FROM stock_inventory_items WHERE inventory_id = ?
    `).all(inventoryId) as StockInventoryItem[];

    let totalCounted = 0;
    let totalDivergences = 0;
    let totalDivergenceVal = 0;
    const now = new Date().toISOString();

    this.db.transaction(() => {
      const updateStmt = this.db.prepare(`
        UPDATE stock_inventory_items
        SET divergence_quantity = ?,
            divergence_value = ?,
            requires_pharmacist_approval = ?,
            updated_at = ?
        WHERE id = ?
      `);

      for (const item of items) {
        totalCounted++;
        const divergence = Number((item.counted_quantity - item.system_quantity).toFixed(2));
        const val = Number((divergence * item.unit_cost).toFixed(2));
        const requiresApproval = item.is_controlled === 1 && divergence !== 0 ? 1 : 0;

        if (divergence !== 0) {
          totalDivergences++;
          totalDivergenceVal += val;
        }

        updateStmt.run(divergence, val, requiresApproval, now, item.id);
      }

      this.db.prepare(`
        UPDATE stock_inventories
        SET status = 'AUDITING',
            total_items_counted = ?,
            total_divergences_count = ?,
            total_divergence_value = ?,
            updated_at = ?
        WHERE id = ?
      `).run(totalCounted, totalDivergences, Number(totalDivergenceVal.toFixed(2)), now, inventoryId);
    })();

    return (await this.getInventoryById(inventoryId, true))!;
  }

  /**
   * 4. Aprovação Sanitária do Farmacêutico RT para Divergências em Controlados
   */
  async approveControlledDivergence(input: ApproveControlledInput): Promise<StockInventoryItem> {
    const item = this.db.prepare(`
      SELECT sii.*, si.status as inventory_status
      FROM stock_inventory_items sii
      JOIN stock_inventories si ON sii.inventory_id = si.id
      WHERE sii.id = ?
    `).get(input.item_id) as any;

    if (!item) throw new Error('ITEM_NOT_FOUND');
    if (!item.requires_pharmacist_approval) {
      throw new Error('ITEM_DOES_NOT_REQUIRE_APPROVAL');
    }

    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE stock_inventory_items
      SET pharmacist_approved = 1,
          justification = ?,
          updated_at = ?
      WHERE id = ?
    `).run(input.justification, now, input.item_id);

    this.db.prepare(`
      UPDATE stock_inventories
      SET responsible_pharmacist_crf = ?, updated_at = ?
      WHERE id = ?
    `).run(input.pharmacist_crf, now, item.inventory_id);

    return (this.db.prepare('SELECT * FROM stock_inventory_items WHERE id = ?').get(input.item_id) as StockInventoryItem);
  }

  /**
   * 5. Finalização e Ajuste Físico/Patrimonial de Estoque
   */
  async finalizeInventory(
    inventoryId: number,
    userId?: number
  ): Promise<{ inventory: StockInventory; adjustments: StockInventoryAdjustment[] }> {
    const inv = await this.getInventoryById(inventoryId, true);
    if (!inv) throw new Error('INVENTORY_NOT_FOUND');

    if (inv.status === 'FINALIZED') {
      throw new Error('INVENTORY_ALREADY_FINALIZED');
    }

    // Trava Sanitária: Se houver divergência em controlados sem aprovação do RT Farmacêutico
    const unapprovedControlled = (inv.items || []).filter(
      (item) => item.requires_pharmacist_approval === 1 && item.pharmacist_approved === 0
    );

    if (unapprovedControlled.length > 0) {
      throw new Error('PENDING_CONTROLLED_APPROVAL');
    }

    const adjustments: StockInventoryAdjustment[] = [];
    const now = new Date().toISOString();

    this.db.transaction(() => {
      const insAdj = this.db.prepare(`
        INSERT INTO stock_inventory_adjustments (
          inventory_id, item_id, product_id, batch_id, adjustment_type,
          quantity, unit_cost, total_cost, dre_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of inv.items || []) {
        if (item.divergence_quantity === 0) continue;

        const isSobra = item.divergence_quantity > 0;
        const adjType = isSobra ? 'SOBRA' : 'FALTA';
        const qty = Math.abs(item.divergence_quantity);
        const totalCost = Number((qty * item.unit_cost).toFixed(2));
        const dreReason = isSobra ? 'AJUSTE_CONTAGEM' : 'QUEBRA';

        const resAdj = insAdj.run(
          inv.id,
          item.id,
          item.product_id,
          item.batch_id || null,
          adjType,
          qty,
          item.unit_cost,
          totalCost,
          dreReason,
          now
        );

        adjustments.push({
          id: Number(resAdj.lastInsertRowid),
          inventory_id: inv.id,
          item_id: item.id,
          product_id: item.product_id,
          batch_id: item.batch_id,
          adjustment_type: adjType,
          quantity: qty,
          unit_cost: item.unit_cost,
          total_cost: totalCost,
          dre_reason: dreReason,
          created_at: now
        });

        // Atualiza físico no batch
        if (item.batch_id) {
          if (isSobra) {
            this.db.prepare(`
              UPDATE batches SET quantity = quantity + ? WHERE id = ?
            `).run(qty, item.batch_id);
          } else {
            this.db.prepare(`
              UPDATE batches SET quantity = MAX(0, quantity - ?) WHERE id = ?
            `).run(qty, item.batch_id);
          }
        }
      }

      this.db.prepare(`
        UPDATE stock_inventories
        SET status = 'FINALIZED',
            finished_at = ?,
            responsible_user_id = COALESCE(?, responsible_user_id),
            updated_at = ?
        WHERE id = ?
      `).run(now, userId || null, now, inventoryId);
    })();

    const finalizedInv = (await this.getInventoryById(inventoryId, true))!;
    return { inventory: finalizedInv, adjustments };
  }

  /**
   * 6. Busca inventário por ID (suporta visão cega de conferente ou auditoria de gestor)
   */
  async getInventoryById(inventoryId: number, isManagerView = false): Promise<StockInventory | null> {
    const inv = this.db.prepare(`
      SELECT * FROM stock_inventories WHERE id = ?
    `).get(inventoryId) as any;

    if (!inv) return null;

    const items = this.db.prepare(`
      SELECT
        sii.*,
        p.name as product_name,
        p.ean as product_ean,
        b.batch_number
      FROM stock_inventory_items sii
      JOIN products p ON sii.product_id = p.id
      LEFT JOIN batches b ON sii.batch_id = b.id
      WHERE sii.inventory_id = ?
      ORDER BY sii.id ASC
    `).all(inventoryId) as StockInventoryItem[];

    // No modo contagem cega (operador), omite a quantidade do sistema para evitar contaminação da contagem
    const sanitizedItems = items.map((i) => {
      if (!isManagerView && inv.status === 'COUNTING') {
        return {
          ...i,
          system_quantity: 0,
          divergence_quantity: 0,
          divergence_value: 0
        };
      }
      return i;
    });

    return {
      ...inv,
      items: sanitizedItems
    };
  }

  /**
   * 7. Lista sessões de inventário
   */
  async listInventories(storeId?: number, status?: InventoryStatus): Promise<StockInventory[]> {
    let query = `SELECT * FROM stock_inventories WHERE 1=1`;
    const params: any[] = [];

    if (storeId) {
      query += ` AND store_id = ?`;
      params.push(storeId);
    }
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY id DESC`;
    return this.db.prepare(query).all(...params) as StockInventory[];
  }

  /**
   * 8. KPIs de Acurácia e Balanço
   */
  async getInventoryKpis(storeId?: number): Promise<InventoryKpis> {
    const storeFilter = storeId ? 'WHERE store_id = ?' : '';
    const storeParam = storeId ? [storeId] : [];

    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total_sessions,
        SUM(CASE WHEN status IN ('OPEN', 'COUNTING', 'AUDITING') THEN 1 ELSE 0 END) as open_sessions,
        SUM(CASE WHEN status = 'FINALIZED' THEN total_divergence_value ELSE 0 END) as total_divergence_val,
        SUM(CASE WHEN status = 'FINALIZED' THEN total_items_counted ELSE 0 END) as total_items,
        SUM(CASE WHEN status = 'FINALIZED' THEN total_divergences_count ELSE 0 END) as total_divergences
      FROM stock_inventories
      ${storeFilter}
    `).get(...storeParam) as any;

    const pendingControlled = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM stock_inventory_items sii
      JOIN stock_inventories si ON sii.inventory_id = si.id
      WHERE sii.requires_pharmacist_approval = 1 AND sii.pharmacist_approved = 0 AND si.status != 'CANCELLED'
      ${storeId ? 'AND si.store_id = ?' : ''}
    `).get(...storeParam) as { count: number };

    const totalCounted = stats?.total_items || 0;
    const totalDivs = stats?.total_divergences || 0;
    const accuracy = totalCounted > 0 ? Number((((totalCounted - totalDivs) / totalCounted) * 100).toFixed(1)) : 100.0;

    return {
      total_sessions: stats?.total_sessions || 0,
      open_sessions: stats?.open_sessions || 0,
      accuracy_rate_percent: accuracy,
      total_divergence_value_month: Number((stats?.total_divergence_val || 0).toFixed(2)),
      pending_controlled_approvals: pendingControlled?.count || 0
    };
  }
}
