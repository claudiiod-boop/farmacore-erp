import { Database } from '../../database/connection';
import { InventoryService } from '../inventory/inventory.service';
import { PreSaleService } from '../counter/pre-sale.service';
import { PrescriptionDetails } from '../counter/types';
import { SngpcService } from '../sngpc/sngpc.service';
import { PbmService } from '../pbm/pbm.service';
import { TefService } from '../tef/tef.service';
import {
  AdditionalCheckoutItem,
  CashMovement,
  CashMovementType,
  CashSession,
  CashSessionSummary,
  CheckoutParams,
  PaymentItem,
  PaymentItemDetails,
  PaymentMethod,
  Sale,
  SaleDetails,
  SaleItemDetails,
} from './types';

interface CashMovementRow {
  id: number | bigint;
  cash_session_id: number | bigint;
  type: string;
  amount: number;
  reason: string;
  operator_name: string;
  created_at: string;
}

interface CashSessionRow {
  id: number | bigint;
  operator_name: string;
  initial_cash: number;
  current_cash: number;
  status: string;
  opened_at: string;
  closed_at: string | null;
}

interface SaleRow {
  id: number | bigint;
  pre_sale_id: number | bigint | null;
  cash_session_id: number | bigint | null;
  status: string;
  total_amount: number;
  discount_amount: number;
  change_amount: number;
  created_at: string;
}

interface SaleItemRow {
  id: number | bigint;
  sale_id: number | bigint;
  product_id: number | bigint;
  product_name: string;
  batch_id: number | bigint;
  batch_number: string;
  expiration_date?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface SalePaymentRow {
  id: number | bigint;
  sale_id: number | bigint;
  method: string;
  amount: number;
  tef_transaction_id?: number | bigint | null;
  tef_nsu?: string | null;
  created_at: string;
}

interface PrescriptionRow {
  id: number | bigint;
  pre_sale_id: number | bigint;
  doctor_name: string;
  doctor_crm: string;
  doctor_uf: string;
  prescription_type: string;
  prescription_date: string;
  patient_name: string;
  buyer_name: string | null;
  buyer_cpf: string | null;
  created_at: string;
}

function mapPrescriptionRow(row: PrescriptionRow): PrescriptionDetails {
  return {
    id: Number(row.id),
    preSaleId: Number(row.pre_sale_id),
    doctorName: row.doctor_name,
    doctorCrm: row.doctor_crm,
    doctorUf: row.doctor_uf,
    prescriptionType: row.prescription_type,
    prescriptionDate: row.prescription_date,
    patientName: row.patient_name,
    buyerName: row.buyer_name,
    buyerCpf: row.buyer_cpf,
    createdAt: row.created_at,
  };
}

function mapCashMovementRow(row: CashMovementRow): CashMovement {
  return {
    id: Number(row.id),
    cashSessionId: Number(row.cash_session_id),
    type: row.type as CashMovementType,
    amount: Number(row.amount),
    reason: row.reason,
    operatorName: row.operator_name,
    createdAt: row.created_at,
  };
}

function mapCashSessionRow(row: CashSessionRow): CashSession {
  return {
    id: Number(row.id),
    operatorName: row.operator_name,
    initialCash: Number(row.initial_cash),
    currentCash: Number(row.current_cash),
    status: row.status as 'OPEN' | 'CLOSED',
    openedAt: row.opened_at,
    closedAt: row.closed_at ?? null,
  };
}

function mapSaleRow(row: SaleRow): Sale {
  return {
    id: Number(row.id),
    preSaleId: row.pre_sale_id !== null ? Number(row.pre_sale_id) : null,
    cashSessionId: row.cash_session_id !== null ? Number(row.cash_session_id) : null,
    status: row.status as 'COMPLETED' | 'CANCELLED',
    totalAmount: Number(row.total_amount),
    discountAmount: Number(row.discount_amount),
    changeAmount: Number(row.change_amount),
    createdAt: row.created_at,
  };
}

function mapSaleItemRow(row: SaleItemRow): SaleItemDetails {
  return {
    id: Number(row.id),
    saleId: Number(row.sale_id),
    productId: Number(row.product_id),
    productName: row.product_name,
    batchId: Number(row.batch_id),
    batchNumber: row.batch_number,
    expirationDate: row.expiration_date ?? undefined,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    totalPrice: Number(row.total_price),
  };
}

function mapSalePaymentRow(row: SalePaymentRow): PaymentItemDetails {
  return {
    id: Number(row.id),
    saleId: Number(row.sale_id),
    method: row.method as PaymentMethod,
    amount: Number(row.amount),
    tefTransactionId: row.tef_transaction_id != null ? Number(row.tef_transaction_id) : null,
    tefNsu: row.tef_nsu ?? null,
    createdAt: row.created_at,
  };
}

export class PosService {
  private sngpcService: SngpcService;
  private pbmService?: PbmService;
  private tefService?: TefService;

  constructor(
    private db: Database,
    private preSaleService: PreSaleService,
    private inventoryService: InventoryService,
    sngpcService?: SngpcService,
    pbmService?: PbmService,
    tefService?: TefService
  ) {
    this.sngpcService = sngpcService ?? new SngpcService(db);
    this.pbmService = pbmService;
    this.tefService = tefService;
  }

  setPbmService(service: PbmService): void {
    this.pbmService = service;
  }

  setTefService(service: TefService): void {
    this.tefService = service;
  }

  openCashSession(operatorName: string, initialCash: number): CashSession {
    if (!operatorName || typeof operatorName !== 'string' || operatorName.trim() === '') {
      throw new Error('INVALID_OPERATOR');
    }

    if (typeof initialCash !== 'number' || isNaN(initialCash) || initialCash < 0) {
      throw new Error('INVALID_AMOUNT');
    }

    const trimmedOperator = operatorName.trim();

    const existing = this.db
      .prepare<CashSessionRow>(
        "SELECT * FROM cash_sessions WHERE operator_name = ? AND status = 'OPEN'"
      )
      .get(trimmedOperator);

    if (existing) {
      throw new Error('SESSION_ALREADY_OPEN');
    }

    const stmt = this.db.prepare(`
      INSERT INTO cash_sessions (
        operator_name,
        initial_cash,
        current_cash,
        status
      ) VALUES (?, ?, ?, 'OPEN')
    `);

    const result = stmt.run(trimmedOperator, initialCash, initialCash);
    const insertedId = Number(result.lastInsertRowid);

    const row = this.db
      .prepare<CashSessionRow>('SELECT * FROM cash_sessions WHERE id = ?')
      .get(insertedId);

    if (!row) {
      throw new Error('Failed to retrieve newly created cash session');
    }

    return mapCashSessionRow(row);
  }

  closeCashSession(sessionId: number): CashSessionSummary {
    const sessionRow = this.db
      .prepare<CashSessionRow>('SELECT * FROM cash_sessions WHERE id = ?')
      .get(sessionId);

    if (!sessionRow || sessionRow.status !== 'OPEN') {
      throw new Error('SESSION_NOT_OPEN');
    }

    const closeTx = this.db.transaction(() => {
      this.db
        .prepare(
          "UPDATE cash_sessions SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
        .run(sessionId);

      const updatedSessionRow = this.db
        .prepare<CashSessionRow>('SELECT * FROM cash_sessions WHERE id = ?')
        .get(sessionId);

      if (!updatedSessionRow) {
        throw new Error('Failed to retrieve closed cash session');
      }

      const session = mapCashSessionRow(updatedSessionRow);
      return this.calculateSessionSummary(session);
    });

    return closeTx();
  }

  getSessionSummary(sessionId: number): CashSessionSummary {
    const sessionRow = this.db
      .prepare<CashSessionRow>('SELECT * FROM cash_sessions WHERE id = ?')
      .get(sessionId);

    if (!sessionRow || sessionRow.status !== 'OPEN') {
      throw new Error('SESSION_NOT_OPEN');
    }

    const session = mapCashSessionRow(sessionRow);
    return this.calculateSessionSummary(session);
  }

  private calculateSessionSummary(session: CashSession): CashSessionSummary {
    const sessionId = session.id;

    const salesRows = this.db
      .prepare<SaleRow>("SELECT * FROM sales WHERE cash_session_id = ? AND status = 'COMPLETED'")
      .all(sessionId);

    const totalSalesCount = salesRows.length;
    const totalSalesAmount = Number(
      salesRows.reduce((acc, s) => acc + Number(s.total_amount), 0).toFixed(2)
    );

    const totalsByMethod: Record<PaymentMethod, number> = {
      DINHEIRO: 0,
      CARTAO_CREDITO: 0,
      CARTAO_DEBITO: 0,
      PIX: 0,
      CONVENIO_PBM: 0,
    };

    const paymentRows = this.db
      .prepare<{ method: string; amount: number }>(`
        SELECT sp.method, sp.amount
        FROM sale_payments sp
        JOIN sales s ON s.id = sp.sale_id
        WHERE s.cash_session_id = ? AND s.status = 'COMPLETED'
      `)
      .all(sessionId);

    for (const p of paymentRows) {
      const method = p.method as PaymentMethod;
      if (totalsByMethod[method] !== undefined) {
        totalsByMethod[method] = Number((totalsByMethod[method] + Number(p.amount)).toFixed(2));
      }
    }

    // Adjust DINHEIRO for total change given in this session
    const totalChange = salesRows.reduce((acc, s) => acc + Number(s.change_amount), 0);
    if (totalChange > 0) {
      totalsByMethod.DINHEIRO = Number(
        Math.max(0, totalsByMethod.DINHEIRO - totalChange).toFixed(2)
      );
    }

    const movementRows = this.db
      .prepare<{ type: string; amount: number }>(
        'SELECT type, amount FROM cash_movements WHERE cash_session_id = ?'
      )
      .all(sessionId);

    let totalSupplies = 0;
    let totalSangrias = 0;

    for (const m of movementRows) {
      if (m.type === 'SUPPLY') {
        totalSupplies += Number(m.amount);
      } else if (m.type === 'SANGRIA') {
        totalSangrias += Number(m.amount);
      }
    }

    totalSupplies = Number(totalSupplies.toFixed(2));
    totalSangrias = Number(totalSangrias.toFixed(2));

    const expectedCash = Number(
      (session.initialCash + totalSupplies - totalSangrias + totalsByMethod.DINHEIRO).toFixed(2)
    );

    return {
      session,
      totalSalesCount,
      totalSalesAmount,
      totalsByMethod,
      totalSupplies,
      totalSangrias,
      expectedCash,
    };
  }


  registerCashMovement(
    sessionId: number,
    type: CashMovementType,
    amount: number,
    reason: string,
    operatorName: string
  ): CashMovement {
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      throw new Error('INVALID_AMOUNT');
    }

    if (type !== 'SANGRIA' && type !== 'SUPPLY') {
      throw new Error('INVALID_MOVEMENT_TYPE');
    }

    if (!reason || reason.trim() === '') {
      throw new Error('INVALID_REASON');
    }

    if (!operatorName || operatorName.trim() === '') {
      throw new Error('INVALID_OPERATOR');
    }

    const trimmedReason = reason.trim();
    const trimmedOperator = operatorName.trim();
    const cleanAmount = Number(amount.toFixed(2));

    const registerTx = this.db.transaction(() => {
      const sessionRow = this.db
        .prepare<CashSessionRow>('SELECT * FROM cash_sessions WHERE id = ?')
        .get(sessionId);

      if (!sessionRow || sessionRow.status !== 'OPEN') {
        throw new Error('SESSION_NOT_OPEN');
      }

      const currentCash = Number(sessionRow.current_cash);

      if (type === 'SANGRIA') {
        if (cleanAmount > currentCash) {
          throw new Error('INSUFFICIENT_DRAWER_CASH');
        }

        const newBalance = Number((currentCash - cleanAmount).toFixed(2));
        this.db
          .prepare('UPDATE cash_sessions SET current_cash = ? WHERE id = ?')
          .run(newBalance, sessionId);
      } else if (type === 'SUPPLY') {
        const newBalance = Number((currentCash + cleanAmount).toFixed(2));
        this.db
          .prepare('UPDATE cash_sessions SET current_cash = ? WHERE id = ?')
          .run(newBalance, sessionId);
      }

      const insertStmt = this.db.prepare(`
        INSERT INTO cash_movements (
          cash_session_id,
          type,
          amount,
          reason,
          operator_name
        ) VALUES (?, ?, ?, ?, ?)
      `);

      const result = insertStmt.run(
        sessionId,
        type,
        cleanAmount,
        trimmedReason,
        trimmedOperator
      );

      const insertedId = Number(result.lastInsertRowid);
      const movementRow = this.db
        .prepare<CashMovementRow>('SELECT * FROM cash_movements WHERE id = ?')
        .get(insertedId);

      if (!movementRow) {
        throw new Error('Failed to retrieve newly created cash movement');
      }

      return mapCashMovementRow(movementRow);
    });

    return registerTx();
  }

  getCashMovements(sessionId: number): CashMovement[] {
    const rows = this.db
      .prepare<CashMovementRow>(
        'SELECT * FROM cash_movements WHERE cash_session_id = ? ORDER BY id ASC'
      )
      .all(sessionId);

    return rows.map(mapCashMovementRow);
  }

  getCurrentSession(operatorName?: string): CashSession | null {
    let row: CashSessionRow | undefined;

    if (operatorName && operatorName.trim() !== '') {
      row = this.db
        .prepare<CashSessionRow>(
          "SELECT * FROM cash_sessions WHERE operator_name = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1"
        )
        .get(operatorName.trim());
    } else {
      row = this.db
        .prepare<CashSessionRow>(
          "SELECT * FROM cash_sessions WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1"
        )
        .get();
    }

    return row ? mapCashSessionRow(row) : null;
  }

  checkout(params: CheckoutParams): SaleDetails & Promise<SaleDetails> {
    const tefNsuSet = new Set<string>();
    if (params.tefNsuList) {
      for (const nsu of params.tefNsuList) {
        if (nsu) tefNsuSet.add(nsu);
      }
    }
    if (params.payments) {
      for (const p of params.payments) {
        if (p.tefNsu) {
          tefNsuSet.add(p.tefNsu);
        } else if (p.tefTransactionUuid) {
          const row = this.db
            .prepare<{ nsu: string }>('SELECT nsu FROM tef_transactions WHERE transaction_uuid = ?')
            .get(p.tefTransactionUuid);
          if (row?.nsu) {
            tefNsuSet.add(row.nsu);
          }
        }
      }
    }
    const tefNsus = Array.from(tefNsuSet);

    const handleTefUndo = async (reason: string = 'FALHA_CHECKOUT_PDV') => {
      if (this.tefService && tefNsus.length > 0) {
        for (const nsu of tefNsus) {
          try {
            const tx = this.tefService.getTransactionByNsu(nsu);
            if (tx && tx.status === 'AUTHORIZED') {
              await this.tefService.undo({ nsu, reason });
            }
          } catch {
            // Ignora falhas individuais em undo secundário
          }
        }
      }
    };

    let saleDetails: SaleDetails;

    try {
      if (params.cashSessionId !== undefined && params.cashSessionId !== null) {
      const sessionRow = this.db
        .prepare<CashSessionRow>('SELECT * FROM cash_sessions WHERE id = ?')
        .get(params.cashSessionId);

      if (!sessionRow || sessionRow.status !== 'OPEN') {
        throw new Error('SESSION_NOT_OPEN');
      }
    }

    let preSaleDetails: ReturnType<PreSaleService['getPreSaleByCode']> = null;
    if (params.preSaleCode !== undefined && params.preSaleCode !== null) {
      if (typeof params.preSaleCode !== 'string' || params.preSaleCode.trim() === '') {
        throw new Error('PRE_SALE_NOT_FOUND');
      }
      const cleanCode = params.preSaleCode.trim();
      preSaleDetails = this.preSaleService.getPreSaleByCode(cleanCode);
      if (!preSaleDetails) {
        throw new Error('PRE_SALE_NOT_FOUND');
      }
      if (preSaleDetails.preSale.status !== 'OPEN') {
        throw new Error('PRE_SALE_ALREADY_CLOSED');
      }
    }

    const hasPreSale = preSaleDetails !== null;
    const hasAdditionalItems =
      Array.isArray(params.additionalItems) && params.additionalItems.length > 0;

    if (!hasPreSale && !hasAdditionalItems) {
      throw new Error('EMPTY_CHECKOUT');
    }

    interface PreparedAdditionalItem {
      productId: number;
      productName: string;
      batchId: number;
      batchNumber: string;
      expirationDate?: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }
    const preparedAdditionalItems: PreparedAdditionalItem[] = [];

    if (hasAdditionalItems) {
      const batchUsage = new Map<number, number>();

      for (const item of params.additionalItems!) {
        if (!item.productId || typeof item.productId !== 'number') {
          throw new Error('PRODUCT_NOT_FOUND');
        }
        if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity <= 0) {
          throw new Error('INVALID_QUANTITY');
        }

        const productRow = this.db
          .prepare<{
            id: number | bigint;
            name: string;
            control_type: string;
            price: number;
          }>('SELECT id, name, control_type, price FROM products WHERE id = ?')
          .get(item.productId);

        if (!productRow) {
          throw new Error('PRODUCT_NOT_FOUND');
        }

        if (productRow.control_type !== 'ISENTO') {
          throw new Error('CONTROLLED_DRUG_DIRECT_SALE_FORBIDDEN');
        }

        const batch = this.inventoryService.getBatchById(item.batchId);
        if (!batch || batch.productId !== Number(productRow.id)) {
          throw new Error('INSUFFICIENT_BATCH_STOCK');
        }

        const currentDate = new Date().toISOString().slice(0, 10);
        if (batch.expirationDate <= currentDate) {
          throw new Error('BATCH_EXPIRED');
        }

        const currentUsed = batchUsage.get(item.batchId) || 0;
        if (batch.availableQuantity < currentUsed + item.quantity) {
          throw new Error('INSUFFICIENT_BATCH_STOCK');
        }
        batchUsage.set(item.batchId, currentUsed + item.quantity);

        const unitPrice = Number(productRow.price);
        const totalPrice = Number((unitPrice * item.quantity).toFixed(2));

        preparedAdditionalItems.push({
          productId: Number(productRow.id),
          productName: productRow.name,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          expirationDate: batch.expirationDate,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
        });
      }
    }

    const preSaleTotal = preSaleDetails
      ? Number(preSaleDetails.preSale.totalAmount.toFixed(2))
      : 0;
    const additionalTotal = Number(
      preparedAdditionalItems.reduce((acc, it) => acc + it.totalPrice, 0).toFixed(2)
    );
    const grandTotal = Number((preSaleTotal + additionalTotal).toFixed(2));

    if (!params.payments || !Array.isArray(params.payments) || params.payments.length === 0) {
      throw new Error('NO_PAYMENT_PROVIDED');
    }

    const VALID_METHODS: PaymentMethod[] = [
      'DINHEIRO',
      'CARTAO_CREDITO',
      'CARTAO_DEBITO',
      'PIX',
      'CONVENIO_PBM',
    ];

    for (const p of params.payments) {
      if (!VALID_METHODS.includes(p.method)) {
        throw new Error('INVALID_PAYMENT_AMOUNT');
      }
      if (typeof p.amount !== 'number' || isNaN(p.amount) || p.amount <= 0) {
        throw new Error('INVALID_PAYMENT_AMOUNT');
      }
    }

    const totalPaid = Number(params.payments.reduce((acc, p) => acc + p.amount, 0).toFixed(2));

    if (totalPaid < grandTotal) {
      throw new Error('INSUFFICIENT_PAYMENT');
    }

    const changeAmount = Number((totalPaid - grandTotal).toFixed(2));

    if (changeAmount > 0) {
      const cashPaid = Number(
        params.payments
          .filter((p) => p.method === 'DINHEIRO')
          .reduce((acc, p) => acc + p.amount, 0)
          .toFixed(2)
      );

      if (cashPaid < changeAmount) {
        throw new Error('EXCESS_NON_CASH_PAYMENT');
      }
    }

    const checkoutTx = this.db.transaction(() => {
      if (preSaleDetails) {
        const updateResult = this.db
          .prepare("UPDATE pre_sales SET status = 'CONVERTED_TO_SALE' WHERE id = ? AND status = 'OPEN'")
          .run(preSaleDetails.preSale.id);

        if (Number(updateResult.changes) === 0) {
          throw new Error('PRE_SALE_ALREADY_CLOSED');
        }
      }

      const insertSaleStmt = this.db.prepare(`
        INSERT INTO sales (
          pre_sale_id,
          cash_session_id,
          status,
          total_amount,
          discount_amount,
          change_amount
        ) VALUES (?, ?, 'COMPLETED', ?, ?, ?)
      `);

      const preSaleId = preSaleDetails ? preSaleDetails.preSale.id : null;
      const discountAmount = 0;

      const saleResult = insertSaleStmt.run(
        preSaleId,
        params.cashSessionId ?? null,
        grandTotal,
        discountAmount,
        changeAmount
      );

      const saleId = Number(saleResult.lastInsertRowid);

      const insertSaleItemStmt = this.db.prepare(`
        INSERT INTO sale_items (
          sale_id,
          product_id,
          batch_id,
          quantity,
          unit_price,
          total_price
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      if (preSaleDetails) {
        for (const item of preSaleDetails.items) {
          insertSaleItemStmt.run(
            saleId,
            item.productId,
            item.batchId,
            item.quantity,
            item.unitPrice,
            item.totalPrice
          );

          this.inventoryService.deductBatchStock(item.batchId, item.quantity);

          // Sanitary SNGPC movement recording for controlled medicines
          if (preSaleDetails.prescription) {
            const product = this.db
              .prepare<{ control_type: string; ms_registration: string }>(
                'SELECT control_type, ms_registration FROM products WHERE id = ?'
              )
              .get(item.productId);

            if (product && product.control_type !== 'ISENTO') {
              const movementDate = new Date().toISOString().slice(0, 10);
              this.sngpcService.recordSaleMovement({
                productId: item.productId,
                batchId: item.batchId,
                quantity: item.quantity,
                referenceId: saleId,
                movementDate,
                msRegistration: product.ms_registration || '',
                prescriptionId: preSaleDetails.prescription.id,
              });
            }
          }
        }
      }

      for (const item of preparedAdditionalItems) {
        insertSaleItemStmt.run(
          saleId,
          item.productId,
          item.batchId,
          item.quantity,
          item.unitPrice,
          item.totalPrice
        );

        this.inventoryService.deductBatchStock(item.batchId, item.quantity);
      }

      const insertPaymentStmt = this.db.prepare(`
        INSERT INTO sale_payments (
          sale_id,
          method,
          amount,
          tef_transaction_id,
          tef_nsu
        ) VALUES (?, ?, ?, ?, ?)
      `);

      for (const p of params.payments) {
        let tefTransactionId: number | null = null;
        let tefNsu: string | null = p.tefNsu || null;

        if (p.tefTransactionUuid || p.tefNsu) {
          let txRow: any = null;
          if (p.tefTransactionUuid) {
            txRow = this.db
              .prepare('SELECT id, nsu FROM tef_transactions WHERE transaction_uuid = ?')
              .get(p.tefTransactionUuid);
          }
          if (!txRow && p.tefNsu) {
            txRow = this.db
              .prepare('SELECT id, nsu FROM tef_transactions WHERE nsu = ?')
              .get(p.tefNsu);
          }

          if (txRow) {
            tefTransactionId = Number(txRow.id);
            tefNsu = txRow.nsu;
          }
        }

        const pResult = insertPaymentStmt.run(
          saleId,
          p.method,
          p.amount,
          tefTransactionId,
          tefNsu
        );
        const paymentId = Number(pResult.lastInsertRowid);

        if (tefTransactionId) {
          this.db
            .prepare('UPDATE tef_transactions SET sale_id = ?, payment_id = ? WHERE id = ?')
            .run(saleId, paymentId, tefTransactionId);
        }
      }

      if (params.tefNsuList && params.tefNsuList.length > 0) {
        for (const nsu of params.tefNsuList) {
          this.db
            .prepare('UPDATE tef_transactions SET sale_id = ? WHERE nsu = ? AND sale_id IS NULL')
            .run(saleId, nsu);
        }
      }

      if (params.cashSessionId !== undefined && params.cashSessionId !== null) {
        const cashPaid = Number(
          params.payments
            .filter((p) => p.method === 'DINHEIRO')
            .reduce((acc, p) => acc + p.amount, 0)
            .toFixed(2)
        );

        const netCash = Number((cashPaid - changeAmount).toFixed(2));
        if (netCash !== 0) {
          this.db
            .prepare('UPDATE cash_sessions SET current_cash = current_cash + ? WHERE id = ?')
            .run(netCash, params.cashSessionId);
        }
      }

      const saleDetails = this.getSaleById(saleId);
      if (!saleDetails) {
        throw new Error('Failed to retrieve newly created sale');
      }

      return saleDetails;
    });

    saleDetails = checkoutTx();
  } catch (err) {
    if (this.tefService && tefNsus.length > 0) {
      const undoPromise = handleTefUndo('FALHA_CHECKOUT_PDV').then(() => {
        throw err;
      });
      return undoPromise as any;
    }
    throw err;
  }

    let postCheckoutPromise = Promise.resolve(saleDetails);

    if (params.pbmProtocol && this.pbmService) {
      const pbmProtocol = params.pbmProtocol;
      postCheckoutPromise = postCheckoutPromise.then(() =>
        this.pbmService!.confirm({
          authorizationProtocol: pbmProtocol,
          saleId: saleDetails.sale.id,
        }).then(() => saleDetails)
      );
    }

    if (this.tefService && tefNsus.length > 0) {
      postCheckoutPromise = postCheckoutPromise.then(async () => {
        for (const nsu of tefNsus) {
          const tx = this.tefService!.getTransactionByNsu(nsu);
          if (tx && tx.status === 'AUTHORIZED') {
            await this.tefService!.confirm({
              nsu,
              saleId: saleDetails.sale.id,
            });
          }
        }
        return saleDetails;
      });
    }

    return Object.assign(postCheckoutPromise, saleDetails) as SaleDetails & Promise<SaleDetails>;
  }

  finalizeSaleFromPreSale(
    preSaleCode: string,
    payments: PaymentItem[],
    cashSessionId?: number,
    pbmProtocol?: string
  ): SaleDetails & Promise<SaleDetails> {
    return this.checkout({
      preSaleCode,
      payments,
      cashSessionId,
      pbmProtocol,
    });
  }

  getSaleById(saleId: number): SaleDetails | null {
    const saleRow = this.db
      .prepare<SaleRow>('SELECT * FROM sales WHERE id = ?')
      .get(saleId);

    if (!saleRow) {
      return null;
    }

    const sale = mapSaleRow(saleRow);

    const itemRows = this.db
      .prepare<SaleItemRow>(`
        SELECT
          si.id,
          si.sale_id,
          si.product_id,
          p.name AS product_name,
          si.batch_id,
          b.batch_number AS batch_number,
          b.expiration_date AS expiration_date,
          si.quantity,
          si.unit_price,
          si.total_price
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        JOIN batches b ON b.id = si.batch_id
        WHERE si.sale_id = ?
        ORDER BY si.id ASC
      `)
      .all(saleId);

    const items = itemRows.map(mapSaleItemRow);

    const paymentRows = this.db
      .prepare<SalePaymentRow>(`
        SELECT id, sale_id, method, amount, tef_transaction_id, tef_nsu, created_at
        FROM sale_payments
        WHERE sale_id = ?
        ORDER BY id ASC
      `)
      .all(saleId);

    const paymentDetails = paymentRows.map(mapSalePaymentRow);

    let preSaleCode: string | undefined;
    let prescription: PrescriptionDetails | null = null;

    if (sale.preSaleId !== null) {
      const preSaleRow = this.db
        .prepare<{ code: string }>('SELECT code FROM pre_sales WHERE id = ?')
        .get(sale.preSaleId);
      if (preSaleRow) {
        preSaleCode = preSaleRow.code;
      }

      const prescriptionRow = this.db
        .prepare<PrescriptionRow>('SELECT * FROM prescriptions WHERE pre_sale_id = ?')
        .get(sale.preSaleId);
      if (prescriptionRow) {
        prescription = mapPrescriptionRow(prescriptionRow);
      }
    }

    const saleDetails: SaleDetails = {
      sale,
      items,
      payments: paymentDetails,
      preSaleCode,
      prescription,
    };

    // Add compatibility getters
    Object.defineProperties(saleDetails, {
      id: { get: () => sale.id, enumerable: true },
      status: { get: () => sale.status, enumerable: true },
      totalAmount: { get: () => sale.totalAmount, enumerable: true },
      discountAmount: { get: () => sale.discountAmount, enumerable: true },
      changeAmount: { get: () => sale.changeAmount, enumerable: true },
      cashSessionId: { get: () => sale.cashSessionId, enumerable: true },
      preSaleId: { get: () => sale.preSaleId, enumerable: true },
      createdAt: { get: () => sale.createdAt, enumerable: true },
    });

    return saleDetails;
  }
}
