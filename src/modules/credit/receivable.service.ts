import { Database } from '../../database/connection';
import type {
  CustomerReceivable,
  CreateReceivableInput,
  ReceivePaymentParams,
  PaymentReceiptResult,
  Customer,
  ReceivableStatus,
  CustomerStatus,
} from './types';

export class ReceivableError extends Error {
  constructor(public code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'ReceivableError';
  }
}

export interface CreateSaleReceivablesInput {
  customerId: number;
  saleId?: number | null;
  agreementId?: number | null;
  totalAmount: number;
  installmentsCount?: number;
  firstDueDate?: string;
  saleDate?: string;
  notes?: string | null;

  // DB / Snake_case compatibility aliases
  customer_id?: number;
  sale_id?: number | null;
  agreement_id?: number | null;
  total_amount?: number;
  installments_count?: number;
  first_due_date?: string;
  sale_date?: string;
}

interface CustomerRow {
  id: number;
  store_id: number;
  agreement_id: number | null;
  name: string;
  cpf: string;
  rg: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  registration_number: string | null;
  department: string | null;
  credit_limit: number;
  current_debt: number;
  status: string;
  allow_dependents: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ReceivableRow {
  id: number;
  customer_id: number;
  sale_id: number | null;
  agreement_id: number | null;
  invoice_id: number | null;
  installment_number: number;
  total_installments: number;
  due_date: string;
  original_amount: number;
  paid_amount: number;
  discount_amount: number;
  interest_amount: number;
  status: string;
  paid_at: string | null;
  cash_session_id: number | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface AgreementRow {
  id: number;
  code: string;
  company_name: string;
  trade_name: string;
  cnpj: string;
  closing_day: number;
  due_day: number;
  credit_limit: number;
  discount_percent: number;
  is_active: number;
}

interface CashSessionRow {
  id: number;
  operator_name: string;
  initial_cash: number;
  current_cash: number;
  status: string;
}

function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  return { year: parts[0], month: parts[1], day: parts[2] };
}

function formatDateFromParts(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function addDays(baseDateStr: string, days: number): string {
  const { year, month, day } = parseDateParts(baseDateStr);
  const d = new Date(year, month - 1, day + days);
  return formatDateFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function calculateInstallmentAmounts(totalAmount: number, installmentsCount: number): number[] {
  if (totalAmount <= 0) {
    throw new ReceivableError('INVALID_AMOUNT', 'Valor total das parcelas deve ser maior que zero.');
  }
  if (installmentsCount < 1) {
    throw new ReceivableError('INVALID_INSTALLMENTS', 'Número de parcelas deve ser no mínimo 1.');
  }

  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / installmentsCount);
  const remainder = totalCents % installmentsCount;

  const amounts: number[] = [];
  for (let i = 0; i < installmentsCount; i++) {
    const cents = baseCents + (i < remainder ? 1 : 0);
    amounts.push(Number((cents / 100).toFixed(2)));
  }
  return amounts;
}

export function calculateCorporateDueDate(
  baseSaleDateStr: string,
  closingDay: number,
  dueDay: number,
  installmentIndex: number
): string {
  const { year, month, day } = parseDateParts(baseSaleDateStr);

  let cycleMonth = month;
  let cycleYear = year;
  if (day > closingDay) {
    cycleMonth += 1;
    if (cycleMonth > 12) {
      cycleMonth = 1;
      cycleYear += 1;
    }
  }

  let dueMonth = cycleMonth;
  let dueYear = cycleYear;
  if (dueDay <= closingDay) {
    dueMonth += 1;
    if (dueMonth > 12) {
      dueMonth = 1;
      dueYear += 1;
    }
  }

  if (installmentIndex > 0) {
    dueMonth += installmentIndex;
    while (dueMonth > 12) {
      dueMonth -= 12;
      dueYear += 1;
    }
  }

  const maxDay = daysInMonth(dueYear, dueMonth);
  const finalDay = Math.min(dueDay, maxDay);
  return formatDateFromParts(dueYear, dueMonth, finalDay);
}

function mapReceivableRow(row: ReceivableRow): CustomerReceivable {
  return {
    id: row.id,
    customerId: row.customer_id,
    saleId: row.sale_id ?? null,
    agreementId: row.agreement_id ?? null,
    invoiceId: row.invoice_id ?? null,
    installmentNumber: row.installment_number,
    totalInstallments: row.total_installments,
    dueDate: row.due_date,
    originalAmount: Number(row.original_amount),
    paidAmount: Number(row.paid_amount ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    interestAmount: Number(row.interest_amount ?? 0),
    status: row.status as ReceivableStatus,
    paidAt: row.paid_at ?? null,
    cashSessionId: row.cash_session_id ?? null,
    paymentMethod: row.payment_method ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // DB compatibility aliases
    customer_id: row.customer_id,
    sale_id: row.sale_id ?? null,
    agreement_id: row.agreement_id ?? null,
    invoice_id: row.invoice_id ?? null,
    installment_number: row.installment_number,
    total_installments: row.total_installments,
    due_date: row.due_date,
    original_amount: Number(row.original_amount),
    paid_amount: Number(row.paid_amount ?? 0),
    discount_amount: Number(row.discount_amount ?? 0),
    interest_amount: Number(row.interest_amount ?? 0),
    paid_at: row.paid_at ?? null,
    cash_session_id: row.cash_session_id ?? null,
    payment_method: row.payment_method ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCustomerRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    storeId: row.store_id,
    agreementId: row.agreement_id ?? null,
    name: row.name,
    cpf: row.cpf,
    rg: row.rg ?? null,
    birthDate: row.birth_date ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    street: row.street ?? null,
    number: row.number ?? null,
    neighborhood: row.neighborhood ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    zipCode: row.zip_code ?? null,
    registrationNumber: row.registration_number ?? null,
    department: row.department ?? null,
    creditLimit: Number(row.credit_limit),
    currentDebt: Number(row.current_debt),
    status: row.status as CustomerStatus,
    allowDependents: Boolean(row.allow_dependents),
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // DB compatibility aliases
    store_id: row.store_id,
    agreement_id: row.agreement_id ?? null,
    birth_date: row.birth_date ?? null,
    zip_code: row.zip_code ?? null,
    registration_number: row.registration_number ?? null,
    credit_limit: Number(row.credit_limit),
    current_debt: Number(row.current_debt),
    allow_dependents: row.allow_dependents,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class ReceivableService {
  constructor(private db: Database) {}

  /**
   * Gera parcelas de crediário próprio ou convênio para uma venda a prazo.
   * Realiza o desdobramento exato de centavos e incrementa atomicamente o current_debt do cliente.
   */
  createReceivablesForSale(input: CreateSaleReceivablesInput): CustomerReceivable[] {
    const customerId = input.customerId ?? input.customer_id;
    if (!customerId) {
      throw new ReceivableError('INVALID_CUSTOMER', 'Cliente não informado.');
    }

    const totalAmount = Number((input.totalAmount ?? input.total_amount ?? 0).toFixed(2));
    const installmentsCount = input.installmentsCount ?? input.installments_count ?? 1;
    const saleId = input.saleId ?? input.sale_id ?? null;
    const notes = input.notes ?? null;
    const saleDate = input.saleDate ?? input.sale_date ?? new Date().toISOString().slice(0, 10);

    const amounts = calculateInstallmentAmounts(totalAmount, installmentsCount);

    const customerRow = this.db
      .prepare('SELECT * FROM customers WHERE id = ?')
      .get(customerId) as CustomerRow | undefined;

    if (!customerRow) {
      throw new ReceivableError('CUSTOMER_NOT_FOUND', `Cliente de id ${customerId} não encontrado.`);
    }

    if (customerRow.status === 'INACTIVE') {
      throw new ReceivableError('CUSTOMER_INACTIVE', 'Cliente está com cadastro inativo.');
    }

    if (customerRow.status === 'BLOCKED_OVERDUE') {
      throw new ReceivableError('CUSTOMER_BLOCKED', 'Cliente bloqueado por débitos vencidos.');
    }

    if (customerRow.status !== 'ACTIVE') {
      throw new ReceivableError(
        'CUSTOMER_BLOCKED',
        `Cliente não está ativo para compras a prazo (status: ${customerRow.status}).`
      );
    }

    const targetAgreementId =
      input.agreementId ?? input.agreement_id ?? customerRow.agreement_id ?? null;

    let agreementRow: AgreementRow | undefined;
    if (targetAgreementId) {
      agreementRow = this.db
        .prepare('SELECT * FROM corporate_agreements WHERE id = ?')
        .get(targetAgreementId) as AgreementRow | undefined;

      if (!agreementRow) {
        throw new ReceivableError(
          'AGREEMENT_NOT_FOUND',
          `Convênio de id ${targetAgreementId} não encontrado.`
        );
      }

      if (!agreementRow.is_active) {
        throw new ReceivableError('AGREEMENT_INACTIVE', 'Convênio corporativo está inativo.');
      }
    }

    // Cálculo das datas de vencimento de cada parcela
    const dueDates: string[] = [];
    if (targetAgreementId && agreementRow) {
      // Convênio corporativo: fecha e vence conforme closing_day e due_day
      for (let i = 0; i < installmentsCount; i++) {
        dueDates.push(
          calculateCorporateDueDate(
            saleDate,
            agreementRow.closing_day,
            agreementRow.due_day,
            i
          )
        );
      }
    } else {
      // Crediário próprio: vencimentos a cada 30 dias (30, 60, 90...)
      if (input.firstDueDate || input.first_due_date) {
        const firstDue = input.firstDueDate || input.first_due_date!;
        dueDates.push(firstDue);
        for (let i = 1; i < installmentsCount; i++) {
          dueDates.push(addDays(firstDue, 30 * i));
        }
      } else {
        for (let i = 0; i < installmentsCount; i++) {
          dueDates.push(addDays(saleDate, 30 * (i + 1)));
        }
      }
    }

    // Transação atômica: inserção das parcelas e incremento da dívida
    const executeTx = this.db.transaction(() => {
      const insertStmt = this.db.prepare(`
        INSERT INTO customer_receivables (
          customer_id,
          sale_id,
          agreement_id,
          installment_number,
          total_installments,
          due_date,
          original_amount,
          paid_amount,
          discount_amount,
          interest_amount,
          status,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.0, 0.0, 0.0, 'OPEN', ?)
      `);

      const createdIds: number[] = [];
      for (let i = 0; i < installmentsCount; i++) {
        const result = insertStmt.run(
          customerId,
          saleId,
          targetAgreementId,
          i + 1,
          installmentsCount,
          dueDates[i],
          amounts[i],
          notes
        );
        createdIds.push(Number(result.lastInsertRowid));
      }

      // Incremento atômico no saldo devedor do cliente
      this.db
        .prepare(`
          UPDATE customers
          SET current_debt = ROUND(current_debt + ?, 2),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(totalAmount, customerId);

      return createdIds;
    });

    const insertedIds = executeTx();

    const placeholders = insertedIds.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT * FROM customer_receivables WHERE id IN (${placeholders}) ORDER BY installment_number ASC`)
      .all(...insertedIds) as ReceivableRow[];

    return rows.map(mapReceivableRow);
  }

  /**
   * Consulta parcelas de um cliente com ordenação por due_date ASC, installment_number ASC.
   * Suporta filtro opcional por status ('OPEN', 'PAID', 'ALL').
   */
  getCustomerReceivables(
    customerId: number,
    statusFilter?: ReceivableStatus | 'ALL'
  ): CustomerReceivable[] {
    const customer = this.db
      .prepare('SELECT id FROM customers WHERE id = ?')
      .get(customerId);

    if (!customer) {
      throw new ReceivableError('CUSTOMER_NOT_FOUND', `Cliente de id ${customerId} não encontrado.`);
    }

    let sql = 'SELECT * FROM customer_receivables WHERE customer_id = ?';
    const params: any[] = [customerId];

    if (statusFilter && statusFilter !== 'ALL') {
      sql += ' AND status = ?';
      params.push(statusFilter);
    }

    sql += ' ORDER BY due_date ASC, installment_number ASC, id ASC';

    const rows = this.db.prepare(sql).all(...params) as ReceivableRow[];
    return rows.map(mapReceivableRow);
  }

  /**
   * Consulta uma parcela específica pelo seu ID.
   */
  getReceivableById(id: number): CustomerReceivable {
    const row = this.db
      .prepare('SELECT * FROM customer_receivables WHERE id = ?')
      .get(id) as ReceivableRow | undefined;

    if (!row) {
      throw new ReceivableError('RECEIVABLE_NOT_FOUND', `Parcela de id ${id} não encontrada.`);
    }

    return mapReceivableRow(row);
  }

  /**
   * Realiza a quitação de uma ou múltiplas parcelas no caixa PDV.
   * Atualiza parcelas, deduz saldo devedor, desbloqueia cliente automaticamente se elegível,
   * e registra suprimento (SUPPLY) no caixa para pagamento em DINHEIRO.
   */
  receivePayment(params: ReceivePaymentParams): PaymentReceiptResult {
    if (!params.receivableIds || params.receivableIds.length === 0) {
      throw new ReceivableError(
        'EMPTY_PAYMENT_LIST',
        'Nenhuma parcela foi selecionada para quitação.'
      );
    }

    const uniqueIds = Array.from(new Set(params.receivableIds));
    const receivableRows: ReceivableRow[] = [];

    for (const recId of uniqueIds) {
      const row = this.db
        .prepare('SELECT * FROM customer_receivables WHERE id = ?')
        .get(recId) as ReceivableRow | undefined;

      if (!row) {
        throw new ReceivableError(
          'RECEIVABLE_NOT_FOUND',
          `Parcela #${recId} não encontrada no contas a receber.`
        );
      }

      if (row.status === 'PAID') {
        throw new ReceivableError(
          'RECEIVABLE_ALREADY_PAID',
          `Parcela #${recId} já está quitada.`
        );
      }

      receivableRows.push(row);
    }

    // Validação de unicidade do cliente
    const customerIds = Array.from(new Set(receivableRows.map((r) => r.customer_id)));
    if (customerIds.length > 1) {
      throw new ReceivableError(
        'MULTIPLE_CUSTOMERS_IN_RECEIPT',
        'Não é permitido quitar parcelas de clientes distintos no mesmo recibo.'
      );
    }

    const customerId = customerIds[0];
    const initialCustomerRow = this.db
      .prepare('SELECT * FROM customers WHERE id = ?')
      .get(customerId) as CustomerRow | undefined;

    if (!initialCustomerRow) {
      throw new ReceivableError(
        'CUSTOMER_NOT_FOUND',
        `Cliente #${customerId} não encontrado.`
      );
    }

    const totalPaid = Number(
      receivableRows
        .reduce((sum, r) => sum + Number(r.original_amount), 0)
        .toFixed(2)
    );

    const paidAt = new Date().toISOString();
    const isCashPayment =
      params.paymentMethod.toUpperCase() === 'DINHEIRO' ||
      params.paymentMethod.toUpperCase() === 'CASH';

    const executePaymentTx = this.db.transaction(() => {
      // 1. Atualiza as parcelas para PAID
      const updateRecStmt = this.db.prepare(`
        UPDATE customer_receivables
        SET status = 'PAID',
            paid_amount = original_amount,
            paid_at = ?,
            cash_session_id = ?,
            payment_method = ?,
            notes = COALESCE(?, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      for (const row of receivableRows) {
        updateRecStmt.run(
          paidAt,
          params.cashSessionId ?? null,
          params.paymentMethod,
          params.notes ?? null,
          row.id
        );
      }

      // 2. Deduz atomicamente o saldo devedor do cliente: MAX(0, current_debt - totalPaid)
      this.db
        .prepare(`
          UPDATE customers
          SET current_debt = MAX(0.0, ROUND(current_debt - ?, 2)),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(totalPaid, customerId);

      // 3. Desbloqueio automático: se estava BLOCKED_OVERDUE e não há mais parcelas vencidas há > 5 dias
      if (initialCustomerRow.status === 'BLOCKED_OVERDUE') {
        const overdueRow = this.db
          .prepare(`
            SELECT COUNT(*) AS count
            FROM customer_receivables
            WHERE customer_id = ?
              AND status = 'OPEN'
              AND due_date < date('now', '-5 days')
          `)
          .get(customerId) as { count: number };

        if (!overdueRow || overdueRow.count === 0) {
          this.db
            .prepare(`
              UPDATE customers
              SET status = 'ACTIVE',
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `)
            .run(customerId);
        }
      }

      // 4. Se pagamento em DINHEIRO com sessão de caixa informada, alimenta a gaveta do PDV
      if (params.cashSessionId && isCashPayment) {
        const sessionRow = this.db
          .prepare('SELECT * FROM cash_sessions WHERE id = ?')
          .get(params.cashSessionId) as CashSessionRow | undefined;

        if (sessionRow) {
          // Atualiza saldo físico em dinheiro da sessão
          this.db
            .prepare(`
              UPDATE cash_sessions
              SET current_cash = ROUND(current_cash + ?, 2)
              WHERE id = ?
            `)
            .run(totalPaid, params.cashSessionId);

          const operator =
            params.operatorName?.trim() ||
            sessionRow.operator_name ||
            'Operador PDV';

          const reason = `Quitação de crediário - Cliente: ${initialCustomerRow.name} - Parcelas: [${uniqueIds.join(', ')}]`;

          this.db
            .prepare(`
              INSERT INTO cash_movements (
                cash_session_id,
                type,
                amount,
                reason,
                operator_name
              ) VALUES (?, 'SUPPLY', ?, ?, ?)
            `)
            .run(params.cashSessionId, totalPaid, reason, operator);
        }
      }
    });

    executePaymentTx();

    // Consulta parcelas e cliente atualizados
    const placeholders = uniqueIds.map(() => '?').join(',');
    const updatedRecRows = this.db
      .prepare(`SELECT * FROM customer_receivables WHERE id IN (${placeholders}) ORDER BY installment_number ASC`)
      .all(...uniqueIds) as ReceivableRow[];

    const updatedCustomerRow = this.db
      .prepare('SELECT * FROM customers WHERE id = ?')
      .get(customerId) as CustomerRow;

    const updatedCustomer = mapCustomerRow(updatedCustomerRow);
    const paidReceivables = updatedRecRows.map(mapReceivableRow);

    const remainingDebt = updatedCustomer.currentDebt;
    const availableLimit = Math.max(
      0,
      Number((updatedCustomer.creditLimit - remainingDebt).toFixed(2))
    );

    const receiptText = this.generateReceiptText({
      customer: updatedCustomer,
      paidReceivables,
      totalPaid,
      remainingDebt,
      availableLimit,
      paymentMethod: params.paymentMethod,
      cashSessionId: params.cashSessionId,
      operatorName: params.operatorName,
      paidAt,
    });

    return {
      paidReceivables,
      totalPaid,
      remainingDebt,
      availableLimit,
      customer: updatedCustomer,
      receiptText,
    };
  }

  /**
   * Formata comprovante textual de quitação de parcelas de crediário.
   */
  private generateReceiptText(data: {
    customer: Customer;
    paidReceivables: CustomerReceivable[];
    totalPaid: number;
    remainingDebt: number;
    availableLimit: number;
    paymentMethod: string;
    cashSessionId?: number | null;
    operatorName?: string;
    paidAt: string;
  }): string {
    const width = 48;
    const line = '-'.repeat(width);
    const doubleLine = '='.repeat(width);

    const center = (text: string) => {
      const padding = Math.max(0, Math.floor((width - text.length) / 2));
      return ' '.repeat(padding) + text;
    };

    const justify = (left: string, right: string) => {
      const space = Math.max(1, width - left.length - right.length);
      return left + ' '.repeat(space) + right;
    };

    const lines: string[] = [
      doubleLine,
      center('FARMACORE DROGARIA & FARMACIA'),
      center('COMPROVANTE DE RECEBIMENTO DE CREDIARIO'),
      doubleLine,
      justify('Data/Hora:', data.paidAt.replace('T', ' ').slice(0, 19)),
      justify('Cliente:', data.customer.name),
      justify('CPF:', data.customer.cpf),
      line,
      center('PARCELAS QUITADAS'),
      line,
    ];

    for (const rec of data.paidReceivables) {
      const desc = `Parc ${rec.installmentNumber}/${rec.totalInstallments} (Venc: ${rec.dueDate})`;
      const val = `R$ ${rec.originalAmount.toFixed(2)}`;
      lines.push(justify(desc, val));
    }

    lines.push(line);
    lines.push(justify('TOTAL PAGO:', `R$ ${data.totalPaid.toFixed(2)}`));
    lines.push(justify('Forma de Pagamento:', data.paymentMethod));
    if (data.cashSessionId) {
      lines.push(justify('Caixa / Sessao:', `#${data.cashSessionId}`));
    }
    if (data.operatorName) {
      lines.push(justify('Operador:', data.operatorName));
    }
    lines.push(line);
    lines.push(justify('Saldo Devedor Restante:', `R$ ${data.remainingDebt.toFixed(2)}`));
    lines.push(justify('Limite Disponivel:', `R$ ${data.availableLimit.toFixed(2)}`));
    lines.push(doubleLine);
    lines.push(center('Guarde este comprovante para seu controle.'));
    lines.push(doubleLine);

    return lines.join('\n');
  }
}
