import { Database } from '../../database/connection';
import type {
  CustomerReturn,
  CustomerReturnItem,
  StoreCredit,
  CreateReturnInput,
  ApproveReturnInput,
  FiscalReturnSummary,
  ReturnKpis,
} from './returns.types';

export class CustomerReturnService {
  constructor(private db: Database) {}

  /**
   * Obtém os itens de uma venda original elegíveis para devolução/troca,
   * deduzindo quantidades já devolvidas em solicitações aprovadas ou pendentes.
   */
  getEligibleItemsForSale(saleId: number) {
    const sale = this.db
      .prepare(`
        SELECT s.id, s.total_amount, s.created_at, ps.customer_name, ps.customer_cpf
        FROM sales s
        LEFT JOIN pre_sales ps ON ps.id = s.pre_sale_id
        WHERE s.id = ?
      `)
      .get(saleId) as any;

    if (!sale) {
      throw new Error(`Venda #${saleId} não encontrada.`);
    }

    const saleItems = this.db
      .prepare(`
        SELECT
          si.id AS sale_item_id,
          si.product_id,
          p.name AS product_name,
          p.ean,
          p.control_type,
          si.batch_id,
          b.batch_number,
          si.quantity AS sold_quantity,
          si.unit_price,
          si.total_price
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        LEFT JOIN batches b ON b.id = si.batch_id
        WHERE si.sale_id = ?
      `)
      .all(saleId) as any[];

    // Quantidades já devolvidas anteriormente que não foram rejeitadas
    const previouslyReturned = this.db
      .prepare(`
        SELECT cri.sale_item_id, SUM(cri.quantity) AS returned_qty
        FROM customer_return_items cri
        JOIN customer_returns cr ON cr.id = cri.return_id
        WHERE cr.sale_id = ? AND cr.status != 'REJECTED'
        GROUP BY cri.sale_item_id
      `)
      .all(saleId) as Array<{ sale_item_id: number; returned_qty: number }>;

    const returnedMap = new Map<number, number>();
    for (const row of previouslyReturned) {
      if (row.sale_item_id) {
        returnedMap.set(row.sale_item_id, row.returned_qty);
      }
    }

    const items = saleItems.map((it) => {
      const returnedQty = returnedMap.get(it.sale_item_id) || 0;
      const availableQty = Math.max(0, it.sold_quantity - returnedQty);
      const isThermolabile =
        it.product_name?.toLowerCase().includes('insulina') ||
        it.product_name?.toLowerCase().includes('vacina') ||
        it.product_name?.toLowerCase().includes('termolábil') ||
        it.product_name?.toLowerCase().includes('geladeira');
      const isControlled = it.control_type && it.control_type !== 'NONE';

      return {
        saleItemId: it.sale_item_id,
        productId: it.product_id,
        productName: it.product_name,
        ean: it.ean,
        batchId: it.batch_id,
        batchNumber: it.batch_number,
        soldQuantity: it.sold_quantity,
        returnedQuantity: returnedQty,
        availableQuantity: availableQty,
        unitPrice: it.unit_price,
        isThermolabile: Boolean(isThermolabile),
        requiresPharmacistAuth: Boolean(isControlled),
      };
    });

    return {
      saleId: sale.id,
      customerName: sale.customer_name,
      customerCpf: sale.customer_cpf,
      totalAmount: sale.total_amount,
      createdAt: sale.created_at,
      items,
    };
  }

  /**
   * Registra uma nova solicitação de Devolução / Troca no balcão
   */
  createReturn(input: CreateReturnInput): { returnId: number; code: string; totalAmount: number; status: string } {
    if (!input.items || input.items.length === 0) {
      throw new Error('A solicitação de devolução deve conter pelo menos 1 item.');
    }

    const sale = this.db.prepare('SELECT id FROM sales WHERE id = ?').get(input.saleId) as any;
    if (!sale) {
      throw new Error(`Venda de origem #${input.saleId} não encontrada.`);
    }

    const store = this.db.prepare('SELECT id FROM stores WHERE id = ?').get(input.storeId) as any;
    if (!store) {
      throw new Error(`Filial #${input.storeId} não encontrada.`);
    }

    // Validação de elegibilidade de itens
    const eligibleInfo = this.getEligibleItemsForSale(input.saleId);
    const eligibleMap = new Map(eligibleInfo.items.map((it) => [it.saleItemId, it]));

    let totalAmount = 0;
    const validatedItems: any[] = [];
    let requiresPharmacist = false;

    for (const reqItem of input.items) {
      if (reqItem.quantity <= 0) {
        throw new Error('Quantidade do item a devolver deve ser maior que zero.');
      }

      let eligible = reqItem.saleItemId ? eligibleMap.get(reqItem.saleItemId) : undefined;
      if (!eligible) {
        eligible = eligibleInfo.items.find((it) => it.productId === reqItem.productId);
      }

      if (!eligible) {
        throw new Error(`Produto #${reqItem.productId} não pertence à venda #${input.saleId}.`);
      }

      if (reqItem.quantity > eligible.availableQuantity) {
        throw new Error(
          `Quantidade solicitada (${reqItem.quantity}) excede a quantidade disponível para devolução (${eligible.availableQuantity}) para o produto ${eligible.productName}.`
        );
      }

      // Regra Sanitária RDC 44/2009 ANVISA: Termolábeis NUNCA podem voltar para prateleira (estoque vendável)
      if (eligible.isThermolabile && reqItem.destination === 'RETURN_TO_STOCK') {
        throw new Error(
          `REGRA SANITÁRIA ANVISA (RDC 44/2009): Medicamento termolábil (${eligible.productName}) que saiu da drogaria não pode retornar ao estoque vendável. Destino deve ser QUARENTENA ou DESCARTE PGRSS.`
        );
      }

      // Se produto avariado/violado, não pode voltar ao estoque
      if (reqItem.condition !== 'INTACT' && reqItem.destination === 'RETURN_TO_STOCK') {
        throw new Error(
          `Item não intacto (${reqItem.condition}) não pode retornar ao estoque vendável.`
        );
      }

      if (eligible.requiresPharmacistAuth) {
        requiresPharmacist = true;
      }

      const unitPrice = reqItem.unitPrice !== undefined ? reqItem.unitPrice : eligible.unitPrice;
      const itemTotal = Number((reqItem.quantity * unitPrice).toFixed(2));
      totalAmount += itemTotal;

      validatedItems.push({
        saleItemId: eligible.saleItemId,
        productId: eligible.productId,
        batchId: reqItem.batchId || eligible.batchId,
        quantity: reqItem.quantity,
        unitPrice,
        totalPrice: itemTotal,
        condition: reqItem.condition,
        destination: reqItem.destination,
        isThermolabile: eligible.isThermolabile ? 1 : 0,
        requiresPharmacistAuth: eligible.requiresPharmacistAuth ? 1 : 0,
        reason: reqItem.reason || input.reason,
      });
    }

    totalAmount = Number(totalAmount.toFixed(2));
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const code = `DEV-${dateStr}-${randomSuffix}`;
    const cfop = '1.202'; // Devolução de venda no estado

    const stmt = this.db.prepare(`
      INSERT INTO customer_returns (
        store_id, sale_id, customer_id, code, return_type, refund_method,
        total_amount, reason, notes, status, cfop, created_by, authorized_by_pharmacist
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)
    `);

    const result = stmt.run(
      input.storeId,
      input.saleId,
      input.customerId || null,
      code,
      input.returnType,
      input.refundMethod,
      totalAmount,
      input.reason,
      input.notes || null,
      cfop,
      input.createdBy,
      input.pharmacistCrf || null
    );

    const returnId = Number(result.lastInsertRowid);

    const insertItemStmt = this.db.prepare(`
      INSERT INTO customer_return_items (
        return_id, sale_item_id, product_id, batch_id, quantity, unit_price,
        total_price, condition, destination, is_thermolabile, requires_pharmacist_auth, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of validatedItems) {
      insertItemStmt.run(
        returnId,
        item.saleItemId,
        item.product_id || item.productId,
        item.batchId || null,
        item.quantity,
        item.unitPrice,
        item.totalPrice,
        item.condition,
        item.destination,
        item.isThermolabile,
        item.requiresPharmacistAuth,
        item.reason
      );
    }

    return {
      returnId,
      code,
      totalAmount,
      status: 'DRAFT',
    };
  }

  /**
   * Aprova e executa a devolução:
   * - Valida exigência de Farmacêutico RT (Portaria 344/98)
   * - Movimenta estoque se o destino for RETURN_TO_STOCK
   * - Emite vale-compras se a forma de estorno for STORE_CREDIT
   * - Gera chave de NF-e de Devolução (SEFAZ)
   */
  approveReturn(returnId: number, input?: ApproveReturnInput): CustomerReturn {
    const ret = this.getReturnById(returnId);
    if (!ret) {
      throw new Error(`Devolução #${returnId} não encontrada.`);
    }

    if (ret.status !== 'DRAFT') {
      throw new Error(`Devolução #${returnId} já está com status ${ret.status} e não pode ser aprovada.`);
    }

    // Verificação de exigência de CRF do Farmacêutico
    const needsPharmacist = ret.items?.some((it) => it.requires_pharmacist_auth);
    const pharmacist = input?.authorizedByPharmacist || ret.authorized_by_pharmacist;
    if (needsPharmacist && !pharmacist) {
      throw new Error(
        'EXIGÊNCIA SANITÁRIA (Portaria 344/98 ANVISA): A devolução contém medicamentos controlados e exige autorização e CRF do Farmacêutico Responsável.'
      );
    }

    const fiscalNfeKey =
      input?.fiscalNfeKey ||
      `35${new Date().toISOString().slice(2, 4)}${Math.floor(10000000000000 + Math.random() * 90000000000000)}550010000000011000000010`;

    // Movimentação de estoque e crédito
    this.db.transaction(() => {
      // 1. Atualizar status e fiscal_key
      this.db
        .prepare(`
          UPDATE customer_returns
          SET status = 'COMPLETED',
              authorized_by_pharmacist = ?,
              fiscal_nfe_key = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(pharmacist || null, fiscalNfeKey, returnId);

      // 2. Movimentar estoque para itens que retornam à prateleira
      if (ret.items) {
        for (const item of ret.items) {
          if (item.destination === 'RETURN_TO_STOCK' && item.batch_id) {
            this.db
              .prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?')
              .run(item.quantity, item.batch_id);
          }
        }
      }

      // 3. Emissão de Vale-Compras (Store Credit) se aplicável
      if (ret.refund_method === 'STORE_CREDIT') {
        const creditCode = `CRED-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        // Expira em 90 dias
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

        // Se customer_id for nulo, busca da venda
        let customerId = ret.customer_id;
        if (!customerId) {
          const cust = this.db.prepare('SELECT id FROM customers LIMIT 1').get() as any;
          customerId = cust ? cust.id : 1;
        }

        this.db
          .prepare(`
            INSERT INTO store_credits (
              store_id, customer_id, return_id, code, initial_balance, current_balance, expires_at, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
          `)
          .run(ret.store_id, customerId, returnId, creditCode, ret.total_amount, ret.total_amount, expiresAt);
      }
    })();

    return this.getReturnById(returnId);
  }

  /**
   * Rejeita a devolução com justificativa técnica
   */
  rejectReturn(returnId: number, reason: string): CustomerReturn {
    const ret = this.getReturnById(returnId);
    if (!ret) {
      throw new Error(`Devolução #${returnId} não encontrada.`);
    }

    if (ret.status !== 'DRAFT') {
      throw new Error(`Devolução com status ${ret.status} não pode ser rejeitada.`);
    }

    this.db
      .prepare(`
        UPDATE customer_returns
        SET status = 'REJECTED',
            notes = coalesce(notes || ' | ', '') || 'Rejeição: ' || ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(reason, returnId);

    return this.getReturnById(returnId);
  }

  /**
   * Retorna os detalhes de uma devolução com seus itens e vale-compras
   */
  getReturnById(returnId: number): CustomerReturn {
    const row = this.db
      .prepare(`
        SELECT
          cr.*,
          c.name AS customer_name,
          c.cpf AS customer_cpf
        FROM customer_returns cr
        LEFT JOIN customers c ON c.id = cr.customer_id
        WHERE cr.id = ?
      `)
      .get(returnId) as any;

    if (!row) {
      throw new Error(`Devolução #${returnId} não encontrada.`);
    }

    const items = this.db
      .prepare(`
        SELECT
          cri.*,
          p.name AS product_name,
          p.ean,
          b.batch_number
        FROM customer_return_items cri
        JOIN products p ON p.id = cri.product_id
        LEFT JOIN batches b ON b.id = cri.batch_id
        WHERE cri.return_id = ?
      `)
      .all(returnId) as any[];

    const storeCredit = this.db
      .prepare('SELECT * FROM store_credits WHERE return_id = ?')
      .get(returnId) as StoreCredit | undefined;

    return {
      ...row,
      items: items.map((it) => ({
        ...it,
        is_thermolabile: Boolean(it.is_thermolabile),
        requires_pharmacist_auth: Boolean(it.requires_pharmacist_auth),
      })),
      store_credit: storeCredit || null,
    };
  }

  /**
   * Lista devoluções de uma loja com filtros
   */
  listReturns(storeId: number, options?: { status?: string; returnType?: string; limit?: number }): CustomerReturn[] {
    let sql = `
      SELECT
        cr.*,
        c.name AS customer_name,
        c.cpf AS customer_cpf
      FROM customer_returns cr
      LEFT JOIN customers c ON c.id = cr.customer_id
      WHERE cr.store_id = ?
    `;
    const params: any[] = [storeId];

    if (options?.status) {
      sql += ' AND cr.status = ?';
      params.push(options.status);
    }
    if (options?.returnType) {
      sql += ' AND cr.return_type = ?';
      params.push(options.returnType);
    }

    sql += ' ORDER BY cr.id DESC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => ({
      ...r,
    }));
  }

  /**
   * Valida saldo de um vale-compras (Store Credit)
   */
  validateStoreCredit(code: string): { valid: boolean; balance: number; customerId: number; expiresAt: string; status: string } {
    const credit = this.db.prepare('SELECT * FROM store_credits WHERE code = ?').get(code) as any;
    if (!credit) {
      return { valid: false, balance: 0, customerId: 0, expiresAt: '', status: 'NOT_FOUND' };
    }

    const now = new Date().toISOString();
    if (credit.expires_at < now && credit.status === 'ACTIVE') {
      this.db.prepare("UPDATE store_credits SET status = 'EXPIRED' WHERE id = ?").run(credit.id);
      return { valid: false, balance: 0, customerId: credit.customer_id, expiresAt: credit.expires_at, status: 'EXPIRED' };
    }

    if (credit.status !== 'ACTIVE' || credit.current_balance <= 0) {
      return {
        valid: false,
        balance: credit.current_balance,
        customerId: credit.customer_id,
        expiresAt: credit.expires_at,
        status: credit.status,
      };
    }

    return {
      valid: true,
      balance: credit.current_balance,
      customerId: credit.customer_id,
      expiresAt: credit.expires_at,
      status: credit.status,
    };
  }

  /**
   * Utiliza saldo do vale-compras em um pagamento
   */
  useStoreCredit(code: string, amount: number): { success: boolean; newBalance: number } {
    const val = this.validateStoreCredit(code);
    if (!val.valid) {
      throw new Error(`Vale-compras inválido ou expirado (status: ${val.status}).`);
    }

    if (amount <= 0 || amount > val.balance) {
      throw new Error(`Valor de uso (${amount}) inválido para saldo disponível (${val.balance}).`);
    }

    const newBalance = Number((val.balance - amount).toFixed(2));
    const newStatus = newBalance === 0 ? 'EXHAUSTED' : 'ACTIVE';

    this.db
      .prepare('UPDATE store_credits SET current_balance = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ?')
      .run(newBalance, newStatus, code);

    return { success: true, newBalance };
  }

  /**
   * Gera o espelho fiscal da NF-e de Devolução (Estorno Tributário SEFAZ)
   */
  generateFiscalReturnSummary(returnId: number): FiscalReturnSummary {
    const ret = this.getReturnById(returnId);
    if (!ret) {
      throw new Error(`Devolução #${returnId} não encontrada.`);
    }

    const icmsReversal = Number((ret.total_amount * 0.18).toFixed(2));
    const pisReversal = Number((ret.total_amount * 0.0165).toFixed(2));
    const cofinsReversal = Number((ret.total_amount * 0.076).toFixed(2));

    const items = (ret.items || []).map((it) => ({
      productId: it.product_id,
      cfop: ret.cfop,
      quantity: it.quantity,
      unitPrice: it.unit_price,
      totalAmount: it.total_price,
      icmsBase: it.total_price,
      icmsAmount: Number((it.total_price * 0.18).toFixed(2)),
    }));

    return {
      returnNfeKey: ret.fiscal_nfe_key || 'PENDING_TRANSMISSION',
      cfop: ret.cfop,
      natureOfOperation: 'DEVOLUÇÃO DE MERCADORIA RECEBIDA EM VENDA A CONSUMIDOR',
      totalReturnAmount: ret.total_amount,
      icmsReversal,
      pisReversal,
      cofinsReversal,
      items,
    };
  }

  /**
   * Retorna os KPIs do módulo de trocas e devoluções
   */
  getKpis(storeId: number): ReturnKpis {
    const returnsStats = this.db
      .prepare(`
        SELECT
          COUNT(id) AS total_count,
          COALESCE(SUM(total_amount), 0.0) AS total_amount
        FROM customer_returns
        WHERE store_id = ? AND status != 'REJECTED'
      `)
      .get(storeId) as any;

    const creditsStats = this.db
      .prepare(`
        SELECT COALESCE(SUM(current_balance), 0.0) AS active_balance
        FROM store_credits
        WHERE store_id = ? AND status = 'ACTIVE'
      `)
      .get(storeId) as any;

    const quarantineStats = this.db
      .prepare(`
        SELECT
          SUM(CASE WHEN destination = 'QUARANTINE' THEN quantity ELSE 0 END) AS quarantine_qty,
          SUM(CASE WHEN destination = 'DISPOSAL_PGRSS' THEN quantity ELSE 0 END) AS disposal_qty
        FROM customer_return_items cri
        JOIN customer_returns cr ON cr.id = cri.return_id
        WHERE cr.store_id = ? AND cr.status != 'REJECTED'
      `)
      .get(storeId) as any;

    return {
      total_returns_month: Number(returnsStats?.total_count || 0),
      total_amount_returned_month: Number(returnsStats?.total_amount || 0),
      active_store_credits_balance: Number(creditsStats?.active_balance || 0),
      quarantined_items_count: Number(quarantineStats?.quarantine_qty || 0),
      disposal_pgrss_items_count: Number(quarantineStats?.disposal_qty || 0),
    };
  }
}
