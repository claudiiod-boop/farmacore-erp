import { getDatabase, Database } from '../../database/connection';
import type {
  CorporateAgreement,
  CreateAgreementInput,
  UpdateAgreementInput,
  AgreementInvoice,
  AgreementInvoiceWithDetails,
  GenerateInvoiceParams,
  EmployeePayrollItem,
  CustomerReceivable,
} from './types';

export class AgreementError extends Error {
  constructor(public code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'AgreementError';
  }
}

interface AgreementRow {
  id: number;
  code: string;
  company_name: string;
  trade_name: string;
  cnpj: string;
  ie: string | null;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  closing_day: number;
  due_day: number;
  credit_limit: number;
  discount_percent: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface InvoiceRow {
  id: number;
  invoice_number: string;
  agreement_id: number;
  period_start: string;
  period_end: string;
  due_date: string;
  total_amount: number;
  total_sales_count: number;
  total_employees_count: number;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ReceivableQueryRow {
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
  customer_name: string;
  customer_cpf: string;
  customer_registration_number: string | null;
  customer_department: string | null;
}

function mapAgreementRow(row: AgreementRow): CorporateAgreement {
  const isActive = Boolean(row.is_active);

  return {
    id: Number(row.id),
    code: row.code,
    companyName: row.company_name,
    tradeName: row.trade_name,
    cnpj: row.cnpj,
    ie: row.ie ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    contactName: row.contact_name ?? null,
    street: row.street,
    number: row.number,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    closingDay: Number(row.closing_day),
    dueDay: Number(row.due_day),
    creditLimit: Number(row.credit_limit),
    discountPercent: Number(row.discount_percent),
    isActive,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // DB compatibility aliases
    company_name: row.company_name,
    trade_name: row.trade_name,
    contact_name: row.contact_name ?? undefined,
    zip_code: row.zip_code,
    closing_day: row.closing_day,
    due_day: row.due_day,
    credit_limit: row.credit_limit,
    discount_percent: row.discount_percent,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapInvoiceRow(row: InvoiceRow): AgreementInvoice {
  return {
    id: Number(row.id),
    invoiceNumber: row.invoice_number,
    agreementId: Number(row.agreement_id),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    dueDate: row.due_date,
    totalAmount: Number(row.total_amount),
    totalSalesCount: Number(row.total_sales_count),
    totalEmployeesCount: Number(row.total_employees_count),
    status: row.status as any,
    paidAt: row.paid_at ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // DB compatibility aliases
    invoice_number: row.invoice_number,
    agreement_id: row.agreement_id,
    period_start: row.period_start,
    period_end: row.period_end,
    due_date: row.due_date,
    total_amount: row.total_amount,
    total_sales_count: row.total_sales_count,
    total_employees_count: row.total_employees_count,
    paid_at: row.paid_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapReceivableRow(row: ReceivableQueryRow): CustomerReceivable {
  return {
    id: Number(row.id),
    customerId: Number(row.customer_id),
    saleId: row.sale_id ? Number(row.sale_id) : null,
    agreementId: row.agreement_id ? Number(row.agreement_id) : null,
    invoiceId: row.invoice_id ? Number(row.invoice_id) : null,
    installmentNumber: Number(row.installment_number),
    totalInstallments: Number(row.total_installments),
    dueDate: row.due_date,
    originalAmount: Number(row.original_amount),
    paidAmount: Number(row.paid_amount ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    interestAmount: Number(row.interest_amount ?? 0),
    status: row.status as any,
    paidAt: row.paid_at ?? null,
    cashSessionId: row.cash_session_id ? Number(row.cash_session_id) : null,
    paymentMethod: row.payment_method ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // DB compatibility aliases
    customer_id: row.customer_id,
    sale_id: row.sale_id,
    agreement_id: row.agreement_id,
    invoice_id: row.invoice_id,
    installment_number: row.installment_number,
    total_installments: row.total_installments,
    due_date: row.due_date,
    original_amount: row.original_amount,
    paid_amount: row.paid_amount,
    discount_amount: row.discount_amount,
    interest_amount: row.interest_amount,
    paid_at: row.paid_at,
    cash_session_id: row.cash_session_id,
    payment_method: row.payment_method,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class AgreementService {
  constructor(private db: Database = getDatabase()) {}

  /**
   * Retorna listagem de convênios cadastrados.
   * Suporta filtro opcional para retornar apenas convênios ativos.
   */
  listAgreements(filter?: { activeOnly?: boolean }): CorporateAgreement[] {
    const activeOnly = Boolean(filter?.activeOnly);
    const sql = activeOnly
      ? 'SELECT * FROM corporate_agreements WHERE is_active = 1 ORDER BY company_name ASC, id ASC'
      : 'SELECT * FROM corporate_agreements ORDER BY company_name ASC, id ASC';

    const rows = this.db.prepare(sql).all() as AgreementRow[];
    return rows.map(mapAgreementRow);
  }

  /**
   * Busca convênio corporativo por ID.
   * Retorna null se não encontrado.
   */
  getAgreementById(id: number): CorporateAgreement | null {
    const row = this.db
      .prepare('SELECT * FROM corporate_agreements WHERE id = ?')
      .get(id) as AgreementRow | undefined;

    if (!row) {
      return null;
    }
    return mapAgreementRow(row);
  }

  /**
   * Cria novo convênio corporativo com validação de unicidade de Código e CNPJ
   * e aplicação de valores padrão.
   */
  createAgreement(input: CreateAgreementInput): CorporateAgreement {
    const code = input.code?.trim();
    const cnpj = input.cnpj?.trim();

    if (!code) {
      throw new AgreementError('INVALID_CODE', 'Código do convênio é obrigatório.');
    }
    if (!cnpj) {
      throw new AgreementError('INVALID_CNPJ', 'CNPJ do convênio é obrigatório.');
    }

    // Validação de unicidade de código
    const existingCode = this.db
      .prepare('SELECT id FROM corporate_agreements WHERE code = ?')
      .get(code);
    if (existingCode) {
      throw new AgreementError(
        'DUPLICATE_CODE',
        `Código de convênio '${code}' já está cadastrado.`
      );
    }

    // Validação de unicidade de CNPJ
    const existingCnpj = this.db
      .prepare('SELECT id FROM corporate_agreements WHERE cnpj = ?')
      .get(cnpj);
    if (existingCnpj) {
      throw new AgreementError(
        'DUPLICATE_CNPJ',
        `CNPJ de convênio '${cnpj}' já está cadastrado.`
      );
    }

    const companyName = (input.companyName ?? input.company_name ?? '').trim();
    const tradeName = (input.tradeName ?? input.trade_name ?? '').trim();
    const contactName = input.contactName ?? input.contact_name ?? null;
    const zipCode = input.zipCode ?? input.zip_code ?? '';
    const closingDay = input.closingDay ?? input.closing_day ?? 20;
    const dueDay = input.dueDay ?? input.due_day ?? 5;
    const creditLimit = input.creditLimit ?? input.credit_limit ?? 0;
    const discountPercent = input.discountPercent ?? input.discount_percent ?? 0;
    const isActive =
      input.isActive !== undefined
        ? input.isActive
          ? 1
          : 0
        : input.is_active !== undefined
          ? input.is_active
            ? 1
            : 0
          : 1;

    const stmt = this.db.prepare(`
      INSERT INTO corporate_agreements (
        code, company_name, trade_name, cnpj, ie, phone, email, contact_name,
        street, number, neighborhood, city, state, zip_code,
        closing_day, due_day, credit_limit, discount_percent, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      code,
      companyName,
      tradeName,
      cnpj,
      input.ie ?? null,
      input.phone ?? null,
      input.email ?? null,
      contactName,
      input.street,
      input.number,
      input.neighborhood,
      input.city,
      input.state,
      zipCode,
      closingDay,
      dueDay,
      creditLimit,
      discountPercent,
      isActive
    );

    return this.getAgreementById(Number(info.lastInsertRowid))!;
  }

  /**
   * Atualização parcial de dados cadastrais, limites financeiros e ativação do convênio.
   */
  updateAgreement(id: number, input: UpdateAgreementInput): CorporateAgreement {
    const existing = this.getAgreementById(id);
    if (!existing) {
      throw new AgreementError(
        'AGREEMENT_NOT_FOUND',
        `Convênio corporativo com ID ${id} não encontrado.`
      );
    }

    if (input.code && input.code !== existing.code) {
      const dup = this.db
        .prepare('SELECT id FROM corporate_agreements WHERE code = ? AND id != ?')
        .get(input.code, id);
      if (dup) {
        throw new AgreementError(
          'DUPLICATE_CODE',
          `Código de convênio '${input.code}' já está em uso por outro convênio.`
        );
      }
    }

    if (input.cnpj && input.cnpj !== existing.cnpj) {
      const dup = this.db
        .prepare('SELECT id FROM corporate_agreements WHERE cnpj = ? AND id != ?')
        .get(input.cnpj, id);
      if (dup) {
        throw new AgreementError(
          'DUPLICATE_CNPJ',
          `CNPJ de convênio '${input.cnpj}' já está em uso por outro convênio.`
        );
      }
    }

    const fields: string[] = [];
    const values: any[] = [];

    const addField = (col: string, val: any) => {
      if (val !== undefined) {
        fields.push(`${col} = ?`);
        values.push(val);
      }
    };

    addField('code', input.code?.trim());
    addField('company_name', (input.companyName ?? input.company_name)?.trim());
    addField('trade_name', (input.tradeName ?? input.trade_name)?.trim());
    addField('cnpj', input.cnpj?.trim());
    addField('ie', input.ie);
    addField('phone', input.phone);
    addField('email', input.email);
    addField('contact_name', input.contactName ?? input.contact_name);
    addField('street', input.street);
    addField('number', input.number);
    addField('neighborhood', input.neighborhood);
    addField('city', input.city);
    addField('state', input.state);
    addField('zip_code', input.zipCode ?? input.zip_code);
    addField('closing_day', input.closingDay ?? input.closing_day);
    addField('due_day', input.dueDay ?? input.due_day);
    addField('credit_limit', input.creditLimit ?? input.credit_limit);
    addField('discount_percent', input.discountPercent ?? input.discount_percent);

    if (input.isActive !== undefined) {
      addField('is_active', input.isActive ? 1 : 0);
    } else if (input.is_active !== undefined) {
      addField('is_active', input.is_active ? 1 : 0);
    }

    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      this.db
        .prepare(`UPDATE corporate_agreements SET ${fields.join(', ')} WHERE id = ?`)
        .run(...values);
    }

    return this.getAgreementById(id)!;
  }

  /**
   * Gera código de fatura sequencial no formato FAT-YYYYMM-XXXX
   */
  private generateInvoiceNumber(referenceDate: string): string {
    const yearMonth = referenceDate.slice(0, 7).replace('-', '');
    const prefix = `FAT-${yearMonth}-`;

    const last = this.db
      .prepare(
        'SELECT invoice_number FROM agreement_invoices WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1'
      )
      .get(`${prefix}%`) as { invoice_number: string } | undefined;

    let seq = 1;
    if (last?.invoice_number) {
      const parts = last.invoice_number.split('-');
      if (parts.length >= 3) {
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
          seq = lastSeq + 1;
        }
      }
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Faturamento de RH / Fechamento de Convênio:
   * 1. Valida existência do convênio.
   * 2. Busca parcelas em aberto dos colaboradores dentro do período (due_date ou created_at).
   * 3. Lança erro NO_RECEIVABLES_TO_INVOICE se não houver itens a faturar.
   * 4. Gera código FAT-YYYYMM-XXXX.
   * 5. Insere fatura em agreement_invoices e vincula invoice_id nas parcelas via transação.
   * 6. Retorna AgreementInvoiceWithDetails agrupando por colaborador.
   */
  generateInvoice(
    agreementId: number,
    params: GenerateInvoiceParams
  ): AgreementInvoiceWithDetails {
    const agreement = this.getAgreementById(agreementId);
    if (!agreement) {
      throw new AgreementError(
        'AGREEMENT_NOT_FOUND',
        `Convênio corporativo com ID ${agreementId} não encontrado.`
      );
    }

    // Busca parcelas de colaboradores da empresa conveniada que estejam em aberto (status = 'OPEN'),
    // cujo agreement_id seja o da empresa (ou clientes pertencentes ao convênio),
    // com due_date ou created_at dentro de startDate e endDate, e que ainda NÃO foram faturadas (invoice_id IS NULL).
    const rows = this.db
      .prepare(
        `SELECT 
          r.*,
          c.name AS customer_name,
          c.cpf AS customer_cpf,
          c.registration_number AS customer_registration_number,
          c.department AS customer_department
        FROM customer_receivables r
        JOIN customers c ON c.id = r.customer_id
        WHERE (r.agreement_id = ? OR c.agreement_id = ?)
          AND r.status = 'OPEN'
          AND r.invoice_id IS NULL
          AND (
            (r.due_date >= ? AND r.due_date <= ?)
            OR (substr(r.created_at, 1, 10) >= ? AND substr(r.created_at, 1, 10) <= ?)
          )
        ORDER BY c.name ASC, r.due_date ASC, r.id ASC`
      )
      .all(
        agreementId,
        agreementId,
        params.startDate,
        params.endDate,
        params.startDate,
        params.endDate
      ) as ReceivableQueryRow[];

    if (rows.length === 0) {
      throw new AgreementError(
        'NO_RECEIVABLES_TO_INVOICE',
        `Nenhuma parcela em aberto encontrada para faturamento no período de ${params.startDate} a ${params.endDate}.`
      );
    }

    const referenceDate = params.endDate || new Date().toISOString().slice(0, 10);
    const invoiceNumber = this.generateInvoiceNumber(referenceDate);

    // Agrupamento por colaborador e cálculo de totais
    interface EmployeeGroup {
      customerId: number;
      customerName: string;
      cpf: string;
      registrationNumber: string | null;
      department: string | null;
      salesKeys: Set<string>;
      totalAmount: number;
      receivables: CustomerReceivable[];
    }

    const employeeMap = new Map<number, EmployeeGroup>();
    const globalSalesSet = new Set<string>();
    const receivableIds: number[] = [];
    let grandTotal = 0;

    for (const row of rows) {
      receivableIds.push(row.id);
      const rec = mapReceivableRow(row);
      const balance = Number(row.original_amount) - Number(row.paid_amount ?? 0);
      grandTotal += balance;

      const saleKey = row.sale_id ? `sale_${row.sale_id}` : `rec_${row.id}`;
      globalSalesSet.add(saleKey);

      let emp = employeeMap.get(row.customer_id);
      if (!emp) {
        emp = {
          customerId: row.customer_id,
          customerName: row.customer_name,
          cpf: row.customer_cpf,
          registrationNumber: row.customer_registration_number ?? null,
          department: row.customer_department ?? null,
          salesKeys: new Set<string>(),
          totalAmount: 0,
          receivables: [],
        };
        employeeMap.set(row.customer_id, emp);
      }

      emp.salesKeys.add(saleKey);
      emp.totalAmount += balance;
      emp.receivables.push(rec);
    }

    const totalAmount = Number(grandTotal.toFixed(2));
    const totalSalesCount = globalSalesSet.size;
    const totalEmployeesCount = employeeMap.size;

    // Transação para gravar a fatura e vincular as parcelas
    const executeInvoiceTx = this.db.transaction(() => {
      const insertInfo = this.db
        .prepare(
          `INSERT INTO agreement_invoices (
            invoice_number, agreement_id, period_start, period_end, due_date,
            total_amount, total_sales_count, total_employees_count, status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)`
        )
        .run(
          invoiceNumber,
          agreementId,
          params.startDate,
          params.endDate,
          params.dueDate,
          totalAmount,
          totalSalesCount,
          totalEmployeesCount,
          params.notes ?? null
        );

      const invoiceId = Number(insertInfo.lastInsertRowid);

      const updateReceivableStmt = this.db.prepare(
        `UPDATE customer_receivables 
         SET invoice_id = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`
      );

      for (const recId of receivableIds) {
        updateReceivableStmt.run(invoiceId, recId);
      }

      return invoiceId;
    });

    const invoiceId = executeInvoiceTx();

    const invoiceRow = this.db
      .prepare('SELECT * FROM agreement_invoices WHERE id = ?')
      .get(invoiceId) as InvoiceRow;

    const invoiceBase = mapInvoiceRow(invoiceRow);

    const items: EmployeePayrollItem[] = Array.from(employeeMap.values()).map(
      (emp) => ({
        customerId: emp.customerId,
        customerName: emp.customerName,
        cpf: emp.cpf,
        registrationNumber: emp.registrationNumber,
        department: emp.department,
        salesCount: emp.salesKeys.size,
        totalAmount: Number(emp.totalAmount.toFixed(2)),
        receivables: emp.receivables.map((r) => ({
          ...r,
          invoiceId,
          invoice_id: invoiceId,
        })),
      })
    );

    return {
      ...invoiceBase,
      agreement,
      items,
    };
  }

  /**
   * Busca fatura de convênio por ID com todos os detalhes e agrupamento por funcionário.
   */
  getInvoiceById(id: number): AgreementInvoiceWithDetails | null {
    const invoiceRow = this.db
      .prepare('SELECT * FROM agreement_invoices WHERE id = ?')
      .get(id) as InvoiceRow | undefined;

    if (!invoiceRow) {
      return null;
    }

    const agreement = this.getAgreementById(invoiceRow.agreement_id);
    if (!agreement) {
      return null;
    }

    const rows = this.db
      .prepare(
        `SELECT 
          r.*,
          c.name AS customer_name,
          c.cpf AS customer_cpf,
          c.registration_number AS customer_registration_number,
          c.department AS customer_department
        FROM customer_receivables r
        JOIN customers c ON c.id = r.customer_id
        WHERE r.invoice_id = ?
        ORDER BY c.name ASC, r.due_date ASC, r.id ASC`
      )
      .all(id) as ReceivableQueryRow[];

    const employeeMap = new Map<number, {
      customerId: number;
      customerName: string;
      cpf: string;
      registrationNumber: string | null;
      department: string | null;
      salesKeys: Set<string>;
      totalAmount: number;
      receivables: CustomerReceivable[];
    }>();

    for (const row of rows) {
      const rec = mapReceivableRow(row);
      const balance = Number(row.original_amount) - Number(row.paid_amount ?? 0);
      const saleKey = row.sale_id ? `sale_${row.sale_id}` : `rec_${row.id}`;

      let emp = employeeMap.get(row.customer_id);
      if (!emp) {
        emp = {
          customerId: row.customer_id,
          customerName: row.customer_name,
          cpf: row.customer_cpf,
          registrationNumber: row.customer_registration_number ?? null,
          department: row.customer_department ?? null,
          salesKeys: new Set<string>(),
          totalAmount: 0,
          receivables: [],
        };
        employeeMap.set(row.customer_id, emp);
      }

      emp.salesKeys.add(saleKey);
      emp.totalAmount += balance;
      emp.receivables.push(rec);
    }

    const items: EmployeePayrollItem[] = Array.from(employeeMap.values()).map(
      (emp) => ({
        customerId: emp.customerId,
        customerName: emp.customerName,
        cpf: emp.cpf,
        registrationNumber: emp.registrationNumber,
        department: emp.department,
        salesCount: emp.salesKeys.size,
        totalAmount: Number(emp.totalAmount.toFixed(2)),
        receivables: emp.receivables,
      })
    );

    return {
      ...mapInvoiceRow(invoiceRow),
      agreement,
      items,
    };
  }

  /**
   * Lista faturas de convênio (opcionalmente filtradas por agreementId).
   */
  listInvoices(agreementId?: number): AgreementInvoice[] {
    const sql = agreementId
      ? 'SELECT * FROM agreement_invoices WHERE agreement_id = ? ORDER BY id DESC'
      : 'SELECT * FROM agreement_invoices ORDER BY id DESC';

    const rows = (
      agreementId ? this.db.prepare(sql).all(agreementId) : this.db.prepare(sql).all()
    ) as InvoiceRow[];

    return rows.map(mapInvoiceRow);
  }
}
