import { getDatabase, Database } from '../../database/connection';
import { StoreService } from '../stores/store.service';
import type { Store } from '../stores/types';
import type {
  InventorySession,
  InventoryItem,
  InventorySessionWithItems,
  CreateInventorySessionInput,
  AddCountInput,
  InventorySessionFilters,
  InventoryType,
  InventoryStatus,
  DifferenceStatus,
  AdjustmentReason,
} from './audit-types';

interface InventorySessionRow {
  id: number;
  session_code: string;
  store_id: number;
  inventory_type: InventoryType;
  category_filter: string | null;
  status: InventoryStatus;
  opened_by: string;
  applied_by: string | null;
  responsible_pharmacist_crf: string | null;
  responsible_pharmacist_uf: string | null;
  notes: string | null;
  total_products_expected: number;
  total_products_counted: number;
  total_batches_expected: number;
  total_batches_counted: number;
  accuracy_rate: number;
  total_surplus_cost: number;
  total_shortage_cost: number;
  net_financial_difference: number;
  started_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface InventoryItemRow {
  id: number;
  session_id: number;
  product_id: number;
  batch_id: number | null;
  batch_number: string;
  expiration_date: string;
  manufacturing_date: string;
  expected_quantity: number;
  counted_quantity: number;
  recount_quantity: number | null;
  difference_quantity: number;
  difference_status: DifferenceStatus;
  unit_cost: number;
  total_cost_difference: number;
  adjustment_reason: AdjustmentReason | null;
  notes: string | null;
  sngpc_adjusted: number;
  created_at: string;
  updated_at: string;
  product_name?: string;
  product_ean?: string;
  control_type?: string;
  category?: string;
}

function mapInventoryItemRow(row: InventoryItemRow): InventoryItem {
  return {
    id: Number(row.id),
    sessionId: Number(row.session_id),
    productId: Number(row.product_id),
    productName: row.product_name ?? undefined,
    productEan: row.product_ean ?? undefined,
    batchId: row.batch_id != null ? Number(row.batch_id) : null,
    batchNumber: row.batch_number,
    expirationDate: row.expiration_date,
    manufacturingDate: row.manufacturing_date,
    expectedQuantity: Number(row.expected_quantity ?? 0),
    countedQuantity: Number(row.counted_quantity ?? 0),
    recountQuantity: row.recount_quantity != null ? Number(row.recount_quantity) : null,
    differenceQuantity: Number(row.difference_quantity ?? 0),
    differenceStatus: row.difference_status,
    unitCost: Number(row.unit_cost ?? 0),
    totalCostDifference: Number(row.total_cost_difference ?? 0),
    adjustmentReason: row.adjustment_reason ?? null,
    notes: row.notes ?? null,
    sngpcAdjusted: Boolean(row.sngpc_adjusted),
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // DB compatibility aliases
    session_id: Number(row.session_id),
    product_id: Number(row.product_id),
    product_name: row.product_name ?? undefined,
    product_ean: row.product_ean ?? undefined,
    batch_id: row.batch_id != null ? Number(row.batch_id) : null,
    batch_number: row.batch_number,
    expiration_date: row.expiration_date,
    manufacturing_date: row.manufacturing_date,
    expected_quantity: Number(row.expected_quantity ?? 0),
    counted_quantity: Number(row.counted_quantity ?? 0),
    recount_quantity: row.recount_quantity != null ? Number(row.recount_quantity) : null,
    difference_quantity: Number(row.difference_quantity ?? 0),
    difference_status: row.difference_status,
    unit_cost: Number(row.unit_cost ?? 0),
    total_cost_difference: Number(row.total_cost_difference ?? 0),
    adjustment_reason: row.adjustment_reason ?? null,
    sngpc_adjusted: Number(row.sngpc_adjusted ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapInventorySessionRow(
  row: InventorySessionRow,
  items: InventoryItem[] = [],
  store?: Store
): InventorySessionWithItems {
  return {
    id: Number(row.id),
    sessionCode: row.session_code,
    storeId: Number(row.store_id),
    inventoryType: row.inventory_type,
    categoryFilter: row.category_filter ?? null,
    status: row.status,
    openedBy: row.opened_by,
    appliedBy: row.applied_by ?? null,
    responsiblePharmacistCrf: row.responsible_pharmacist_crf ?? null,
    responsiblePharmacistUf: row.responsible_pharmacist_uf ?? null,
    notes: row.notes ?? null,
    totalProductsExpected: Number(row.total_products_expected ?? 0),
    totalProductsCounted: Number(row.total_products_counted ?? 0),
    totalBatchesExpected: Number(row.total_batches_expected ?? 0),
    totalBatchesCounted: Number(row.total_batches_counted ?? 0),
    accuracyRate: Number(row.accuracy_rate ?? 100),
    totalSurplusCost: Number(row.total_surplus_cost ?? 0),
    totalShortageCost: Number(row.total_shortage_cost ?? 0),
    netFinancialDifference: Number(row.net_financial_difference ?? 0),
    startedAt: row.started_at,
    closedAt: row.closed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // DB compatibility aliases
    session_code: row.session_code,
    store_id: Number(row.store_id),
    inventory_type: row.inventory_type,
    category_filter: row.category_filter ?? null,
    opened_by: row.opened_by,
    applied_by: row.applied_by ?? null,
    responsible_pharmacist_crf: row.responsible_pharmacist_crf ?? null,
    responsible_pharmacist_uf: row.responsible_pharmacist_uf ?? null,
    total_products_expected: Number(row.total_products_expected ?? 0),
    total_products_counted: Number(row.total_products_counted ?? 0),
    total_batches_expected: Number(row.total_batches_expected ?? 0),
    total_batches_counted: Number(row.total_batches_counted ?? 0),
    accuracy_rate: Number(row.accuracy_rate ?? 100),
    total_surplus_cost: Number(row.total_surplus_cost ?? 0),
    total_shortage_cost: Number(row.total_shortage_cost ?? 0),
    net_financial_difference: Number(row.net_financial_difference ?? 0),
    started_at: row.started_at,
    closed_at: row.closed_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,

    items,
    store,
  };
}

export class InventoryAuditService {
  private storeService: StoreService;

  constructor(private db: Database = getDatabase()) {
    this.storeService = new StoreService(this.db);
  }

  private getCurrentDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private generateSessionCode(): string {
    const todayStr = this.getCurrentDate().replace(/-/g, '');
    const prefix = `INV-${todayStr}-`;

    const lastRow = this.db
      .prepare('SELECT session_code FROM inventory_sessions WHERE session_code LIKE ? ORDER BY id DESC LIMIT 1')
      .get(`${prefix}%`) as { session_code: string } | undefined;

    let nextSeq = 1;
    if (lastRow?.session_code) {
      const parts = lastRow.session_code.split('-');
      const seqStr = parts[parts.length - 1];
      const parsed = parseInt(seqStr, 10);
      if (!isNaN(parsed)) {
        nextSeq = parsed + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Cria uma nova sessão de inventário e captura o snapshot lógico de estoque da filial.
   */
  createSession(input: CreateInventorySessionInput): InventorySessionWithItems {
    const storeId = Number(input.storeId ?? input.store_id);
    const openedBy = (input.openedBy ?? input.opened_by)?.trim();
    const inventoryType = (input.inventoryType ?? input.inventory_type) as InventoryType;
    const categoryFilter = (input.categoryFilter ?? input.category_filter)?.trim() || null;
    const notes = input.notes?.trim() || null;

    // 1. Valida se a filial existe e está ativa
    const store = this.storeService.getStoreById(storeId);
    if (!store || !store.isActive) {
      throw new Error(`Filial não encontrada ou inativa: ID ${storeId}`);
    }

    // 2. Valida responsável
    if (!openedBy) {
      throw new Error('Responsável pela abertura (openedBy) é obrigatório');
    }

    // 3. Valida tipo de inventário
    const validTypes: InventoryType[] = ['GERAL', 'ROTATIVO', 'CONTROLADOS_SNGPC'];
    if (!validTypes.includes(inventoryType)) {
      throw new Error(`Tipo de inventário inválido: ${inventoryType}`);
    }

    // 4. Se for ROTATIVO, exige categoryFilter
    if (inventoryType === 'ROTATIVO' && !categoryFilter) {
      throw new Error('Filtro de categoria é obrigatório para inventário rotativo');
    }

    // 5. Verifica duplicidade de sessão OPEN no mesmo escopo
    let duplicateCheckSql = `
      SELECT id FROM inventory_sessions 
      WHERE store_id = ? AND status = 'OPEN' AND inventory_type = ?
    `;
    const duplicateParams: any[] = [storeId, inventoryType];

    if (inventoryType === 'ROTATIVO') {
      duplicateCheckSql += ' AND category_filter = ?';
      duplicateParams.push(categoryFilter);
    }

    const existingOpenSession = this.db.prepare(duplicateCheckSql).get(...duplicateParams);
    if (existingOpenSession) {
      throw new Error('Já existe uma sessão de inventário aberta para este escopo nesta filial');
    }

    // 6. Gera código único sequencial
    const sessionCode = this.generateSessionCode();

    // 7. Consulta lotes elegíveis para o snapshot
    let batchSql = `
      SELECT 
        b.id AS batch_id,
        b.product_id,
        b.batch_number,
        b.expiration_date,
        b.manufacturing_date,
        b.quantity,
        b.reserved_quantity,
        p.name AS product_name,
        p.ean AS product_ean,
        p.pf AS product_pf,
        p.control_type,
        p.category
      FROM batches b
      JOIN products p ON p.id = b.product_id
      WHERE b.store_id = ?
    `;
    const batchParams: any[] = [storeId];

    if (inventoryType === 'ROTATIVO' && categoryFilter) {
      batchSql += ` AND p.category = ?`;
      batchParams.push(categoryFilter);
    } else if (inventoryType === 'CONTROLADOS_SNGPC') {
      batchSql += ` AND p.control_type IN ('ANTIMICROBIANO', 'C1', 'C2', 'B1', 'B2', 'A1', 'A2', 'A3')`;
    }
    batchSql += ` ORDER BY b.id ASC`;

    const batches = this.db.prepare(batchSql).all(...batchParams) as Array<{
      batch_id: number;
      product_id: number;
      batch_number: string;
      expiration_date: string;
      manufacturing_date: string;
      quantity: number;
      reserved_quantity: number;
      product_name: string;
      product_ean: string;
      product_pf: number;
      control_type: string;
      category: string;
    }>;

    const uniqueProducts = new Set<number>();
    for (const b of batches) {
      uniqueProducts.add(b.product_id);
    }
    const totalBatchesExpected = batches.length;
    const totalProductsExpected = uniqueProducts.size;

    // 8. Executa inserção atômica no banco
    let newSessionId = 0;
    const tx = this.db.transaction(() => {
      const insertSessionStmt = this.db.prepare(`
        INSERT INTO inventory_sessions (
          session_code, store_id, inventory_type, category_filter, status, opened_by, notes,
          total_products_expected, total_batches_expected, total_products_counted, total_batches_counted,
          accuracy_rate, total_surplus_cost, total_shortage_cost, net_financial_difference
        ) VALUES (?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, 0, 0, 100.0, 0.0, 0.0, 0.0)
      `);

      const sessionResult = insertSessionStmt.run(
        sessionCode,
        storeId,
        inventoryType,
        categoryFilter,
        openedBy,
        notes,
        totalProductsExpected,
        totalBatchesExpected
      );

      newSessionId = Number(sessionResult.lastInsertRowid);

      const insertItemStmt = this.db.prepare(`
        INSERT INTO inventory_items (
          session_id, product_id, batch_id, batch_number, expiration_date, manufacturing_date,
          expected_quantity, counted_quantity, recount_quantity, difference_quantity, difference_status,
          unit_cost, total_cost_difference, adjustment_reason, notes, sngpc_adjusted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, NULL, NULL, 0)
      `);

      for (const b of batches) {
        const expectedQuantity = Math.max(0, (b.quantity || 0) - (b.reserved_quantity || 0));
        const unitCost = Number(b.product_pf || 0);
        const differenceQuantity = -expectedQuantity;
        const differenceStatus: DifferenceStatus = expectedQuantity > 0 ? 'SHORTAGE' : 'EXACT';
        const totalCostDifference = Number((differenceQuantity * unitCost).toFixed(2));

        insertItemStmt.run(
          newSessionId,
          b.product_id,
          b.batch_id,
          b.batch_number,
          b.expiration_date,
          b.manufacturing_date,
          expectedQuantity,
          differenceQuantity,
          differenceStatus,
          unitCost,
          totalCostDifference
        );
      }
    });

    tx();

    const createdSession = this.getSessionById(newSessionId);
    if (!createdSession) {
      throw new Error(`Falha ao recuperar sessão de inventário recém-criada (ID ${newSessionId})`);
    }

    return createdSession;
  }

  /**
   * Obtém os detalhes completos de uma sessão de inventário por ID, incluindo itens e filial.
   */
  getSessionById(id: number): InventorySessionWithItems | null {
    const sessionRow = this.db
      .prepare('SELECT * FROM inventory_sessions WHERE id = ?')
      .get(id) as InventorySessionRow | undefined;

    if (!sessionRow) {
      return null;
    }

    const itemRows = this.db
      .prepare(`
        SELECT 
          i.*,
          p.name AS product_name,
          p.ean AS product_ean,
          p.control_type,
          p.category
        FROM inventory_items i
        LEFT JOIN products p ON p.id = i.product_id
        WHERE i.session_id = ?
        ORDER BY i.id ASC
      `)
      .all(id) as InventoryItemRow[];

    const items = itemRows.map(mapInventoryItemRow);
    const store = this.storeService.getStoreById(sessionRow.store_id) || undefined;

    return mapInventorySessionRow(sessionRow, items, store);
  }

  /**
   * Lista sessões de inventário com filtros e paginação.
   */
  listSessions(filters?: InventorySessionFilters): { sessions: InventorySessionWithItems[]; total: number } {
    const conditions: string[] = [];
    const values: any[] = [];

    const storeId = filters?.storeId ?? filters?.store_id;
    if (storeId !== undefined && storeId !== null) {
      conditions.push('store_id = ?');
      values.push(Number(storeId));
    }

    const status = filters?.status;
    if (status) {
      conditions.push('status = ?');
      values.push(status);
    }

    const inventoryType = filters?.inventoryType ?? filters?.inventory_type;
    if (inventoryType) {
      conditions.push('inventory_type = ?');
      values.push(inventoryType);
    }

    const startDate = filters?.startDate ?? filters?.start_date;
    if (startDate) {
      conditions.push('DATE(started_at) >= DATE(?)');
      values.push(startDate);
    }

    const endDate = filters?.endDate ?? filters?.end_date;
    if (endDate) {
      conditions.push('DATE(started_at) <= DATE(?)');
      values.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = this.db
      .prepare(`SELECT COUNT(*) as total FROM inventory_sessions ${whereClause}`)
      .get(...values) as { total: number } | undefined;

    const total = Number(countRow?.total || 0);

    const limit = filters?.limit !== undefined ? Number(filters.limit) : 50;
    const offset = filters?.offset !== undefined ? Number(filters.offset) : 0;

    const sessionRows = this.db
      .prepare(`SELECT id FROM inventory_sessions ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...values, limit, offset) as Array<{ id: number }>;

    const sessions: InventorySessionWithItems[] = [];
    for (const row of sessionRows) {
      const session = this.getSessionById(row.id);
      if (session) {
        sessions.push(session);
      }
    }

    return { sessions, total };
  }

  /**
   * Registra a contagem física de um item/lote (contagem cega bip-a-bip ou valor absoluto).
   */
  addCount(sessionId: number, input: AddCountInput): InventoryItem {
    // 1. Valida se a sessão existe e está aberta
    const session = this.db
      .prepare('SELECT id, status FROM inventory_sessions WHERE id = ?')
      .get(sessionId) as { id: number; status: InventoryStatus } | undefined;

    if (!session) {
      throw new Error(`Sessão de inventário não encontrada: ID ${sessionId}`);
    }
    if (session.status !== 'OPEN') {
      throw new Error('Sessão de inventário não está aberta para contagem');
    }

    // 2. Resolve o produto por productId ou EAN
    const productId = input.productId ?? input.product_id;
    const rawEan = (input.ean ?? (input as any).product_ean)?.trim();

    let product: { id: number; name: string; ean: string; pf: number } | undefined;
    if (productId) {
      product = this.db
        .prepare('SELECT id, name, ean, pf FROM products WHERE id = ?')
        .get(Number(productId)) as any;
    } else if (rawEan) {
      product = this.db
        .prepare('SELECT id, name, ean, pf FROM products WHERE ean = ?')
        .get(rawEan) as any;
    }

    if (!product) {
      throw new Error('Produto não encontrado');
    }

    // 3. Valida dados do lote e quantidade
    const rawBatch = (input.batchNumber ?? input.batch_number)?.trim();
    if (!rawBatch) {
      throw new Error('Número do lote é obrigatório');
    }

    const expirationDate = (input.expirationDate ?? input.expiration_date)?.trim();
    if (!expirationDate) {
      throw new Error('Data de validade é obrigatória');
    }

    const quantity = Number(input.quantity);
    if (isNaN(quantity) || quantity < 0) {
      throw new Error('Quantidade inválida: deve ser maior ou igual a zero');
    }

    const manufacturingDate =
      (input.manufacturingDate ?? input.manufacturing_date)?.trim() || expirationDate;
    const isIncremental = Boolean(input.isIncremental ?? input.is_incremental);

    // 4. Busca item existente na sessão para este produto e lote
    const existingItem = this.db
      .prepare('SELECT * FROM inventory_items WHERE session_id = ? AND product_id = ? AND batch_number = ?')
      .get(sessionId, product.id, rawBatch) as InventoryItemRow | undefined;

    if (existingItem) {
      const newCounted = isIncremental
        ? Number(existingItem.counted_quantity || 0) + quantity
        : quantity;

      const expectedQty = Number(existingItem.expected_quantity || 0);
      const diffQty = newCounted - expectedQty;
      const diffStatus: DifferenceStatus =
        diffQty === 0 ? 'EXACT' : diffQty > 0 ? 'SURPLUS' : 'SHORTAGE';
      const unitCost = Number(existingItem.unit_cost || 0);
      const totalCostDiff = Number((diffQty * unitCost).toFixed(2));

      this.db
        .prepare(`
          UPDATE inventory_items
          SET counted_quantity = ?,
              difference_quantity = ?,
              difference_status = ?,
              total_cost_difference = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(newCounted, diffQty, diffStatus, totalCostDiff, existingItem.id);

      const updatedRow = this.db
        .prepare(`
          SELECT i.*, p.name AS product_name, p.ean AS product_ean, p.control_type, p.category
          FROM inventory_items i
          LEFT JOIN products p ON p.id = i.product_id
          WHERE i.id = ?
        `)
        .get(existingItem.id) as InventoryItemRow;

      return mapInventoryItemRow(updatedRow);
    } else {
      // Item não existia no snapshot lógico (sobra física / lote novo encontrado na prateleira)
      const unitCost = Number(input.unitCost ?? input.unit_cost ?? product.pf ?? 0.0);
      const diffQty = quantity;
      const diffStatus: DifferenceStatus = 'SURPLUS';
      const totalCostDiff = Number((diffQty * unitCost).toFixed(2));

      const insertRes = this.db
        .prepare(`
          INSERT INTO inventory_items (
            session_id, product_id, batch_id, batch_number, expiration_date, manufacturing_date,
            expected_quantity, counted_quantity, recount_quantity, difference_quantity, difference_status,
            unit_cost, total_cost_difference, adjustment_reason, notes, sngpc_adjusted
          ) VALUES (?, ?, NULL, ?, ?, ?, 0, ?, NULL, ?, ?, ?, ?, 'SOBRA_NAO_IDENTIFICADA', NULL, 0)
        `)
        .run(
          sessionId,
          product.id,
          rawBatch,
          expirationDate,
          manufacturingDate,
          quantity,
          diffQty,
          diffStatus,
          unitCost,
          totalCostDiff
        );

      const newItemId = Number(insertRes.lastInsertRowid);
      const insertedRow = this.db
        .prepare(`
          SELECT i.*, p.name AS product_name, p.ean AS product_ean, p.control_type, p.category
          FROM inventory_items i
          LEFT JOIN products p ON p.id = i.product_id
          WHERE i.id = ?
        `)
        .get(newItemId) as InventoryItemRow;

      return mapInventoryItemRow(insertedRow);
    }
  }

  /**
   * Registra a recontagem de um item divergente. A recontagem passa a ser o valor oficial contado.
   */
  recountItem(sessionId: number, itemId: number, recountQuantity: number): InventoryItem {
    const session = this.db
      .prepare('SELECT id, status FROM inventory_sessions WHERE id = ?')
      .get(sessionId) as { id: number; status: InventoryStatus } | undefined;

    if (!session) {
      throw new Error(`Sessão de inventário não encontrada: ID ${sessionId}`);
    }
    if (session.status !== 'OPEN' && session.status !== 'COUNTED') {
      throw new Error('Sessão de inventário não permite recontagem: status deve ser OPEN ou COUNTED');
    }

    const item = this.db
      .prepare('SELECT * FROM inventory_items WHERE id = ? AND session_id = ?')
      .get(itemId, sessionId) as InventoryItemRow | undefined;

    if (!item) {
      throw new Error(`Item de inventário não encontrado nesta sessão: ID ${itemId}`);
    }

    const qty = Number(recountQuantity);
    if (isNaN(qty) || qty < 0) {
      throw new Error('Quantidade de recontagem inválida: deve ser maior ou igual a zero');
    }

    const expectedQty = Number(item.expected_quantity || 0);
    const diffQty = qty - expectedQty;
    const diffStatus: DifferenceStatus =
      diffQty === 0 ? 'EXACT' : diffQty > 0 ? 'SURPLUS' : 'SHORTAGE';
    const unitCost = Number(item.unit_cost || 0);
    const totalCostDiff = Number((diffQty * unitCost).toFixed(2));

    this.db
      .prepare(`
        UPDATE inventory_items
        SET recount_quantity = ?,
            counted_quantity = ?,
            difference_quantity = ?,
            difference_status = ?,
            total_cost_difference = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(qty, qty, diffQty, diffStatus, totalCostDiff, itemId);

    const updatedRow = this.db
      .prepare(`
        SELECT i.*, p.name AS product_name, p.ean AS product_ean, p.control_type, p.category
        FROM inventory_items i
        LEFT JOIN products p ON p.id = i.product_id
        WHERE i.id = ?
      `)
      .get(itemId) as InventoryItemRow;

    return mapInventoryItemRow(updatedRow);
  }

  /**
   * Finaliza a contagem cega da sessão (transição OPEN -> COUNTED) e calcula métricas de acurácia e divergências financeiras.
   */
  finishCounting(sessionId: number): InventorySessionWithItems {
    const session = this.db
      .prepare('SELECT id, status FROM inventory_sessions WHERE id = ?')
      .get(sessionId) as { id: number; status: InventoryStatus } | undefined;

    if (!session) {
      throw new Error(`Sessão de inventário não encontrada: ID ${sessionId}`);
    }
    if (session.status !== 'OPEN') {
      throw new Error('Sessão de inventário não está aberta para finalização de contagem');
    }

    const tx = this.db.transaction(() => {
      const items = this.db
        .prepare(`
          SELECT product_id, counted_quantity, difference_quantity, difference_status, unit_cost
          FROM inventory_items
          WHERE session_id = ?
        `)
        .all(sessionId) as Array<{
          product_id: number;
          counted_quantity: number;
          difference_quantity: number;
          difference_status: DifferenceStatus;
          unit_cost: number;
        }>;

      const countedProducts = new Set<number>();
      let totalBatchesCounted = 0;
      let exactCount = 0;
      let totalSurplusCost = 0;
      let totalShortageCost = 0;

      for (const it of items) {
        const countedQty = Number(it.counted_quantity || 0);
        const diffQty = Number(it.difference_quantity || 0);
        const unitCost = Number(it.unit_cost || 0);

        if (countedQty > 0) {
          countedProducts.add(it.product_id);
          totalBatchesCounted += 1;
        }

        if (it.difference_status === 'EXACT') {
          exactCount += 1;
        } else if (it.difference_status === 'SURPLUS') {
          totalSurplusCost += diffQty * unitCost;
        } else if (it.difference_status === 'SHORTAGE') {
          totalShortageCost += Math.abs(diffQty * unitCost);
        }
      }

      const totalItems = items.length;
      const accuracyRate =
        totalItems === 0 ? 100.0 : Number(((exactCount / totalItems) * 100).toFixed(2));
      const roundedSurplusCost = Number(totalSurplusCost.toFixed(2));
      const roundedShortageCost = Number(totalShortageCost.toFixed(2));
      const netFinancialDifference = Number(
        (roundedSurplusCost - roundedShortageCost).toFixed(2)
      );

      this.db
        .prepare(`
          UPDATE inventory_sessions
          SET status = 'COUNTED',
              total_products_counted = ?,
              total_batches_counted = ?,
              accuracy_rate = ?,
              total_surplus_cost = ?,
              total_shortage_cost = ?,
              net_financial_difference = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(
          countedProducts.size,
          totalBatchesCounted,
          accuracyRate,
          roundedSurplusCost,
          roundedShortageCost,
          netFinancialDifference,
          sessionId
        );
    });

    tx();

    const result = this.getSessionById(sessionId);
    if (!result) {
      throw new Error(`Falha ao recuperar sessão de inventário finalizada: ID ${sessionId}`);
    }
    return result;
  }
}
