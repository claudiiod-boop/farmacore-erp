import type { Database } from '../../database/connection';
import type {
  ForecastFilters,
  ReceivablesForecastItem,
  ReceivablesForecastSummary,
  SettleTransactionParams,
  ReconciliationFilters,
  ReconciliationSummary,
  TefSettlementStatus,
} from './types';
import type { TefTransaction, TefOperationType, TefTransactionStatus, TefInstallmentType } from '../tef/types';

interface TefTransactionRow {
  id: number;
  transaction_uuid: string;
  provider_id: string;
  terminal_id: string;
  sale_id: number | null;
  payment_id: number | null;
  operation_type: TefOperationType;
  status: TefTransactionStatus;
  amount: number;
  installments: number;
  installment_type: TefInstallmentType | null;
  brand_name: string;
  brand_code_sefaz: string;
  acquirer_name: string;
  acquirer_cnpj: string;
  authorization_code: string;
  nsu: string;
  host_nsu: string;
  card_last_four: string | null;
  customer_receipt: string | null;
  merchant_receipt: string | null;
  cancellation_receipt: string | null;
  failure_reason: string | null;
  reversal_reason: string | null;
  cancellation_nsu: string | null;
  cancellation_reason: string | null;
  mdr_rate: number | null;
  net_amount: number | null;
  expected_settlement_date: string | null;
  batch_number: string | null;
  settlement_status: TefSettlementStatus | null;
  settled_amount: number | null;
  settled_fee: number | null;
  settled_at: string | null;
  bank_account: string | null;
  created_at: string;
  confirmed_at: string | null;
  reversed_at: string | null;
  cancelled_at: string | null;
}

function mapTefTransactionRow(row: TefTransactionRow): TefTransaction {
  return {
    id: row.id,
    transactionUuid: row.transaction_uuid,
    providerId: row.provider_id,
    terminalId: row.terminal_id,
    saleId: row.sale_id,
    paymentId: row.payment_id,
    operationType: row.operation_type,
    status: row.status,
    amount: Number(row.amount),
    installments: row.installments,
    installmentType: row.installment_type || undefined,
    brandName: row.brand_name,
    brandCodeSefaz: row.brand_code_sefaz,
    acquirerName: row.acquirer_name,
    acquirerCnpj: row.acquirer_cnpj,
    authorizationCode: row.authorization_code,
    nsu: row.nsu,
    hostNsu: row.host_nsu,
    cardLastFour: row.card_last_four,
    customerReceipt: row.customer_receipt,
    merchantReceipt: row.merchant_receipt,
    cancellationReceipt: row.cancellation_receipt,
    failureReason: row.failure_reason,
    reversalReason: row.reversal_reason,
    cancellationNsu: row.cancellation_nsu,
    cancellationReason: row.cancellation_reason,
    mdrRate: row.mdr_rate !== null ? Number(row.mdr_rate) : undefined,
    netAmount: row.net_amount !== null ? Number(row.net_amount) : null,
    expectedSettlementDate: row.expected_settlement_date,
    batchNumber: row.batch_number,
    settlementStatus: row.settlement_status || 'PENDING',
    settledAmount: row.settled_amount !== null ? Number(row.settled_amount) : null,
    settledFee: row.settled_fee !== null ? Number(row.settled_fee) : null,
    settledAt: row.settled_at,
    bankAccount: row.bank_account,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    reversedAt: row.reversed_at,
    cancelledAt: row.cancelled_at,
  };
}

export class TefReconciliationService {
  constructor(private db: Database) {}

  /**
   * Previsao de recebiveis futuros agrupados por adquirente, modalidade e data de repasse bancario.
   */
  getReceivablesForecast(filters?: ForecastFilters): ReceivablesForecastSummary {
    const conditions: string[] = [
      "status = 'CONFIRMED'",
      "(settlement_status = 'PENDING' OR settlement_status IS NULL)",
    ];
    const queryParams: (string | number)[] = [];

    if (filters?.startDate) {
      conditions.push('date(expected_settlement_date) >= date(?)');
      queryParams.push(filters.startDate);
    }

    if (filters?.endDate) {
      conditions.push('date(expected_settlement_date) <= date(?)');
      queryParams.push(filters.endDate);
    }

    if (filters?.acquirerName) {
      conditions.push('acquirer_name = ?');
      queryParams.push(filters.acquirerName);
    }

    if (filters?.operationType) {
      conditions.push('operation_type = ?');
      queryParams.push(filters.operationType);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    interface GroupRow {
      expected_settlement_date: string;
      acquirer_name: string;
      operation_type: string;
      transaction_count: number;
      gross_amount: number;
      net_amount: number;
    }

    const rows = this.db
      .prepare<GroupRow>(`
        SELECT
          COALESCE(expected_settlement_date, date(created_at)) as expected_settlement_date,
          acquirer_name,
          operation_type,
          COUNT(*) as transaction_count,
          SUM(amount) as gross_amount,
          SUM(COALESCE(net_amount, amount)) as net_amount
        FROM tef_transactions
        ${whereClause}
        GROUP BY COALESCE(expected_settlement_date, date(created_at)), acquirer_name, operation_type
        ORDER BY expected_settlement_date ASC, acquirer_name ASC
      `)
      .all(...queryParams);

    let totalGross = 0;
    let totalEstimatedFee = 0;
    let totalNet = 0;
    let totalTransactions = 0;

    const items: ReceivablesForecastItem[] = rows.map((r) => {
      const gross = Number(Number(r.gross_amount).toFixed(2));
      const net = Number(Number(r.net_amount).toFixed(2));
      const fee = Number((gross - net).toFixed(2));
      const count = Number(r.transaction_count);

      totalGross += gross;
      totalEstimatedFee += fee;
      totalNet += net;
      totalTransactions += count;

      return {
        expectedSettlementDate: r.expected_settlement_date,
        acquirerName: r.acquirer_name,
        operationType: r.operation_type,
        transactionCount: count,
        grossAmount: gross,
        estimatedFee: fee,
        netAmount: net,
      };
    });

    return {
      items,
      totalGross: Number(totalGross.toFixed(2)),
      totalEstimatedFee: Number(totalEstimatedFee.toFixed(2)),
      totalNet: Number(totalNet.toFixed(2)),
      totalTransactions,
    };
  }

  /**
   * Baixa e conciliacao bancaria de uma transacao TEF pelo NSU,
   * detectando automaticamente se a adquirente cobrou taxa superior a contratada.
   */
  settleTransaction(nsu: string, params: SettleTransactionParams): TefTransaction {
    if (!nsu || nsu.trim() === '') {
      throw new Error('INVALID_NSU');
    }

    const row = this.db
      .prepare<TefTransactionRow>('SELECT * FROM tef_transactions WHERE nsu = ?')
      .get(nsu.trim());

    if (!row) {
      throw new Error('TRANSACTION_NOT_FOUND');
    }

    if (row.status !== 'CONFIRMED') {
      throw new Error('CANNOT_SETTLE_UNCONFIRMED_TRANSACTION');
    }

    if (row.settlement_status === 'SETTLED') {
      throw new Error('TRANSACTION_ALREADY_SETTLED');
    }

    const amount = Number(row.amount);
    const settledAmount = Number(params.settledAmount.toFixed(2));

    // Calculo da taxa esperada vs taxa efetiva
    const expectedNetAmount = row.net_amount !== null
      ? Number(row.net_amount)
      : Number((amount * (1 - (row.mdr_rate || 0) / 100)).toFixed(2));
    const expectedFee = Number((amount - expectedNetAmount).toFixed(2));

    const settledFee = params.settledFee !== undefined
      ? Number(params.settledFee.toFixed(2))
      : Number((amount - settledAmount).toFixed(2));

    // Divergencia: diferenca superior a 0.5% do valor da transacao
    const feeDifference = Math.abs(settledFee - expectedFee);
    const tolerance = Number((amount * 0.005).toFixed(4)) + 0.001;

    let settlementStatus: TefSettlementStatus = 'SETTLED';
    if (feeDifference > tolerance) {
      settlementStatus = 'DIVERGENT';
    }

    const settledAt = params.settledAt || new Date().toISOString();
    const bankAccount = params.bankAccount?.trim() || null;

    this.db
      .prepare(`
        UPDATE tef_transactions
        SET settlement_status = ?,
            settled_amount = ?,
            settled_fee = ?,
            settled_at = ?,
            bank_account = ?
        WHERE id = ?
      `)
      .run(settlementStatus, settledAmount, settledFee, settledAt, bankAccount, row.id);

    const updated = this.db
      .prepare<TefTransactionRow>('SELECT * FROM tef_transactions WHERE id = ?')
      .get(row.id);

    if (!updated) {
      throw new Error('FAILED_TO_UPDATE_SETTLEMENT');
    }

    return mapTefTransactionRow(updated);
  }

  /**
   * Listagem de transacoes para conciliacao e resumo de status.
   */
  listReconciliation(filters?: ReconciliationFilters): {
    transactions: TefTransaction[];
    summary: ReconciliationSummary;
  } {
    const baseConditions: string[] = ["status = 'CONFIRMED'"];
    const baseParams: (string | number)[] = [];

    if (filters?.settlementStatus) {
      baseConditions.push('settlement_status = ?');
      baseParams.push(filters.settlementStatus);
    }

    if (filters?.acquirerName) {
      baseConditions.push('acquirer_name = ?');
      baseParams.push(filters.acquirerName);
    }

    if (filters?.startDate) {
      baseConditions.push('date(created_at) >= date(?)');
      baseParams.push(filters.startDate);
    }

    if (filters?.endDate) {
      baseConditions.push('date(created_at) <= date(?)');
      baseParams.push(filters.endDate);
    }

    const whereClause = `WHERE ${baseConditions.join(' AND ')}`;

    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 50;
    const offset = filters?.offset && filters.offset >= 0 ? filters.offset : 0;

    const rows = this.db
      .prepare<TefTransactionRow>(`
        SELECT * FROM tef_transactions
        ${whereClause}
        ORDER BY id DESC
        LIMIT ? OFFSET ?
      `)
      .all(...baseParams, limit, offset);

    // Calculo do sumario global de conciliacao
    interface SummaryRow {
      settlement_status: string | null;
      count: number;
      total_amount: number;
    }

    const summaryRows = this.db
      .prepare<SummaryRow>(`
        SELECT
          COALESCE(settlement_status, 'PENDING') as settlement_status,
          COUNT(*) as count,
          SUM(CASE
            WHEN settlement_status = 'SETTLED' THEN COALESCE(settled_amount, net_amount, amount)
            WHEN settlement_status = 'DIVERGENT' THEN COALESCE(settled_amount, net_amount, amount)
            ELSE COALESCE(net_amount, amount)
          END) as total_amount
        FROM tef_transactions
        WHERE status = 'CONFIRMED'
        GROUP BY COALESCE(settlement_status, 'PENDING')
      `)
      .all();

    let totalPending = 0;
    let totalSettled = 0;
    let totalDivergent = 0;
    let pendingCount = 0;
    let settledCount = 0;
    let divergentCount = 0;

    for (const s of summaryRows) {
      const amount = Number(Number(s.total_amount).toFixed(2));
      const count = Number(s.count);

      if (s.settlement_status === 'SETTLED') {
        totalSettled += amount;
        settledCount += count;
      } else if (s.settlement_status === 'DIVERGENT') {
        totalDivergent += amount;
        divergentCount += count;
      } else {
        totalPending += amount;
        pendingCount += count;
      }
    }

    return {
      transactions: rows.map(mapTefTransactionRow),
      summary: {
        totalPending: Number(totalPending.toFixed(2)),
        totalSettled: Number(totalSettled.toFixed(2)),
        totalDivergent: Number(totalDivergent.toFixed(2)),
        pendingCount,
        settledCount,
        divergentCount,
      },
    };
  }
}
