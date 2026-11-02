import { Database } from '../../database/connection';
import { InventoryService } from '../inventory/inventory.service';
import { PreSaleService } from '../counter/pre-sale.service';
import { PrescriptionDetails } from '../counter/types';
import {
  CashMovement,
  CashMovementType,
  CashSession,
  CashSessionSummary,
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
    createdAt: row.created_at,
  };
}

export class PosService {
  constructor(
    private db: Database,
    private preSaleService: PreSaleService,
    private inventoryService: InventoryService
  ) {}

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
    });

    return closeTx();
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

  finalizeSaleFromPreSale(
    preSaleCode: string,
    payments: PaymentItem[],
    cashSessionId?: number
  ): SaleDetails {
    if (!preSaleCode || typeof preSaleCode !== 'string') {
      throw new Error('PRE_SALE_NOT_FOUND');
    }

    const preSaleDetails = this.preSaleService.getPreSaleByCode(preSaleCode);
    if (!preSaleDetails) {
      throw new Error('PRE_SALE_NOT_FOUND');
    }

    if (preSaleDetails.preSale.status !== 'OPEN') {
      throw new Error('PRE_SALE_ALREADY_CLOSED');
    }

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      throw new Error('NO_PAYMENT_PROVIDED');
    }

    const VALID_METHODS: PaymentMethod[] = ['DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX'];

    for (const p of payments) {
      if (!VALID_METHODS.includes(p.method)) {
        throw new Error('INVALID_PAYMENT_AMOUNT');
      }
      if (typeof p.amount !== 'number' || isNaN(p.amount) || p.amount <= 0) {
        throw new Error('INVALID_PAYMENT_AMOUNT');
      }
    }

    const preSaleTotal = Number(preSaleDetails.preSale.totalAmount.toFixed(2));
    const totalPaid = Number(payments.reduce((acc, p) => acc + p.amount, 0).toFixed(2));

    if (totalPaid < preSaleTotal) {
      throw new Error('INSUFFICIENT_PAYMENT');
    }

    const changeAmount = Number((totalPaid - preSaleTotal).toFixed(2));

    if (changeAmount > 0) {
      const cashPaid = Number(
        payments
          .filter((p) => p.method === 'DINHEIRO')
          .reduce((acc, p) => acc + p.amount, 0)
          .toFixed(2)
      );

      if (cashPaid < changeAmount) {
        throw new Error('EXCESS_NON_CASH_PAYMENT');
      }
    }

    if (cashSessionId !== undefined && cashSessionId !== null) {
      const sessionRow = this.db
        .prepare<CashSessionRow>('SELECT * FROM cash_sessions WHERE id = ?')
        .get(cashSessionId);

      if (!sessionRow || sessionRow.status !== 'OPEN') {
        throw new Error('SESSION_NOT_OPEN');
      }
    }

    const finalizeTx = this.db.transaction(() => {
      // 1. Mark pre-sale as CONVERTED_TO_SALE
      this.db
        .prepare("UPDATE pre_sales SET status = 'CONVERTED_TO_SALE' WHERE id = ?")
        .run(preSaleDetails.preSale.id);

      // 2. Insert into sales
      const insertSaleStmt = this.db.prepare(`
        INSERT INTO sales (
          pre_sale_id,
          cash_session_id,
          status,
          total_amount,
          discount_amount,
          change_amount
        ) VALUES (?, ?, 'COMPLETED', ?, 0, ?)
      `);

      const saleResult = insertSaleStmt.run(
        preSaleDetails.preSale.id,
        cashSessionId ?? null,
        preSaleTotal,
        changeAmount
      );

      const saleId = Number(saleResult.lastInsertRowid);

      // 3. Insert sale items and deduct physical inventory
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
      }

      // 4. Insert sale payments
      const insertPaymentStmt = this.db.prepare(`
        INSERT INTO sale_payments (sale_id, method, amount)
        VALUES (?, ?, ?)
      `);

      for (const p of payments) {
        insertPaymentStmt.run(saleId, p.method, p.amount);
      }

      // 5. Update cash session drawer if cash was paid
      if (cashSessionId !== undefined && cashSessionId !== null) {
        const cashPaid = Number(
          payments
            .filter((p) => p.method === 'DINHEIRO')
            .reduce((acc, p) => acc + p.amount, 0)
            .toFixed(2)
        );

        const netCash = Number((cashPaid - changeAmount).toFixed(2));
        if (netCash !== 0) {
          this.db
            .prepare('UPDATE cash_sessions SET current_cash = current_cash + ? WHERE id = ?')
            .run(netCash, cashSessionId);
        }
      }

      // 6. Fetch created sale details
      const saleDetails = this.getSaleById(saleId);
      if (!saleDetails) {
        throw new Error('Failed to retrieve newly created sale');
      }

      return saleDetails;
    });

    return finalizeTx();
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
        SELECT id, sale_id, method, amount, created_at
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
