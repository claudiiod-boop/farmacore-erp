import { Database } from '../../database/connection';
import {
  AgreementInvoice,
  AgreementInvoiceItem,
  PayrollExportResult,
  PayrollDiscountRow,
  AgreementBillingKpis,
  AgreementInvoiceStatus
} from './agreements.types';
import { randomUUID } from 'crypto';

export class CorporateAgreementService {
  constructor(private db: Database) {}

  /**
   * Gera Fatura Consolidada de Convênio para uma empresa no ciclo mensal
   */
  async generateInvoiceForAgreement(
    agreementId: number,
    periodStart: string,
    periodEnd: string,
    dueDate: string
  ): Promise<AgreementInvoice> {
    const agreement = this.db.prepare(`
      SELECT * FROM corporate_agreements WHERE id = ?
    `).get(agreementId) as any;

    if (!agreement) {
      throw new Error('AGREEMENT_NOT_FOUND');
    }

    // Busca contas a receber de convênio no período para clientes vinculados a esta empresa que ainda não foram faturadas
    const eligibleSales = this.db.prepare(`
      SELECT
        cr.id as receivable_id,
        COALESCE(cr.sale_id, cr.id) as sale_id,
        cr.created_at as sale_date,
        (cr.original_amount - cr.paid_amount) as sale_amount,
        c.id as customer_id,
        c.name as customer_name,
        c.cpf as customer_cpf,
        COALESCE(c.registration_number, 'S/M') as employee_code
      FROM customer_receivables cr
      JOIN customers c ON cr.customer_id = c.id
      WHERE cr.agreement_id = ?
        AND cr.status = 'OPEN'
        AND cr.invoice_id IS NULL
        AND date(cr.created_at) >= ?
        AND date(cr.created_at) <= ?
      ORDER BY cr.created_at ASC
    `).all(agreementId, periodStart, periodEnd) as Array<{
      receivable_id: number;
      sale_id: number;
      sale_date: string;
      sale_amount: number;
      customer_id: number;
      customer_name: string;
      customer_cpf: string;
      employee_code: string;
    }>;

    if (eligibleSales.length === 0) {
      throw new Error('NO_SALES_TO_INVOICE');
    }

    const totalAmount = Number(
      eligibleSales.reduce((acc, s) => acc + s.sale_amount, 0).toFixed(2)
    );
    const uniqueEmployees = new Set(eligibleSales.map((s) => s.customer_id)).size;

    const yearMonth = periodEnd.replace(/-/g, '').slice(0, 6);
    const countRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM agreement_invoices
    `).get() as { count: number };
    const invoiceNumber = `FAT-${yearMonth}-${String(countRow.count + 1).padStart(4, '0')}`;
    const now = new Date().toISOString();

    let newInvoiceId = 0;

    this.db.transaction(() => {
      const insInvoice = this.db.prepare(`
        INSERT INTO agreement_invoices (
          invoice_number, agreement_id, period_start, period_end, due_date,
          total_amount, total_sales_count, total_employees_count, status,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, 'OPEN',
          ?, ?
        )
      `).run(
        invoiceNumber,
        agreementId,
        periodStart,
        periodEnd,
        dueDate,
        totalAmount,
        eligibleSales.length,
        uniqueEmployees,
        now,
        now
      );

      newInvoiceId = Number(insInvoice.lastInsertRowid);

      const insItem = this.db.prepare(`
        INSERT INTO agreement_invoice_items (
          invoice_id, sale_id, customer_id, employee_code, customer_name, customer_cpf, sale_date, sale_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of eligibleSales) {
        insItem.run(
          newInvoiceId,
          item.sale_id,
          item.customer_id,
          item.employee_code,
          item.customer_name,
          item.customer_cpf,
          item.sale_date,
          item.sale_amount
        );
      }

      const recIds = eligibleSales.map((s) => s.receivable_id);
      if (recIds.length > 0) {
        this.db.prepare(`
          UPDATE customer_receivables
          SET invoice_id = ?
          WHERE id IN (${recIds.join(',')})
        `).run(newInvoiceId);
      }
    })();

    return (await this.getInvoiceById(newInvoiceId))!;
  }

  /**
   * Faturamento em lote de todos os convênios ativos
   */
  async generateBatchBilling(
    periodStart: string,
    periodEnd: string,
    dueDate: string
  ): Promise<AgreementInvoice[]> {
    const agreements = this.db.prepare(`
      SELECT id FROM corporate_agreements WHERE is_active = 1
    `).all() as Array<{ id: number }>;

    const generated: AgreementInvoice[] = [];

    for (const agr of agreements) {
      try {
        const inv = await this.generateInvoiceForAgreement(agr.id, periodStart, periodEnd, dueDate);
        generated.push(inv);
      } catch (err: any) {
        // Ignora convênios sem vendas no período
        if (err.message !== 'NO_SALES_TO_INVOICE') {
          throw err;
        }
      }
    }

    return generated;
  }

  /**
   * Busca fatura detalhada com dados da empresa e lista de compras
   */
  async getInvoiceById(invoiceId: number): Promise<AgreementInvoice | null> {
    const invoice = this.db.prepare(`
      SELECT
        ai.*,
        ca.company_name,
        ca.cnpj
      FROM agreement_invoices ai
      JOIN corporate_agreements ca ON ai.agreement_id = ca.id
      WHERE ai.id = ?
    `).get(invoiceId) as any;

    if (!invoice) return null;

    const items = this.db.prepare(`
      SELECT * FROM agreement_invoice_items WHERE invoice_id = ? ORDER BY customer_name ASC, sale_date ASC
    `).all(invoiceId) as AgreementInvoiceItem[];

    return { ...invoice, items };
  }

  /**
   * Gera e exporta o Espelho de Desconto em Folha para o RH da Empresa
   */
  async exportPayrollDiscountFile(invoiceId: number): Promise<PayrollExportResult> {
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('INVOICE_NOT_FOUND');
    }

    const rows = this.db.prepare(`
      SELECT
        employee_code,
        customer_name,
        customer_cpf,
        COUNT(*) as sales_count,
        SUM(sale_amount) as total_discount_amount
      FROM agreement_invoice_items
      WHERE invoice_id = ?
      GROUP BY customer_id
      ORDER BY customer_name ASC
    `).all(invoiceId) as PayrollDiscountRow[];

    // Monta o arquivo CSV com cabeçalho padrão de RH
    let csvContent = 'MATRICULA;CPF;NOME_COLABORADOR;QTD_COMPRAS;VALOR_DESCONTO_FOLHA\n';
    for (const r of rows) {
      csvContent += `${r.employee_code};${r.customer_cpf};${r.customer_name};${r.sales_count};${r.total_discount_amount.toFixed(2).replace('.', ',')}\n`;
    }

    const exportId = `exp-${randomUUID()}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO agreement_payroll_exports (
        id, invoice_id, agreement_id, export_date, period_start, period_end,
        total_employees, total_amount, file_content_csv, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      exportId,
      invoice.id,
      invoice.agreement_id,
      now.slice(0, 10),
      invoice.period_start,
      invoice.period_end,
      rows.length,
      invoice.total_amount,
      csvContent,
      now
    );

    return {
      exportId,
      invoiceId: invoice.id,
      companyName: invoice.company_name || '',
      cnpj: invoice.cnpj || '',
      period: `${invoice.period_start} a ${invoice.period_end}`,
      totalEmployees: rows.length,
      totalAmount: invoice.total_amount,
      csvContent,
      rows
    };
  }

  /**
   * Quitação da Fatura Corporativa
   */
  async settleAgreementInvoice(invoiceId: number, paidDate: string, notes?: string): Promise<AgreementInvoice> {
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('INVOICE_NOT_FOUND');
    }

    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE agreement_invoices
      SET status = 'PAID',
          paid_at = ?,
          notes = COALESCE(?, notes),
          updated_at = ?
      WHERE id = ?
    `).run(paidDate, notes || null, now, invoiceId);

    this.db.prepare(`
      UPDATE customer_receivables
      SET status = 'PAID',
          paid_at = ?,
          updated_at = ?
      WHERE invoice_id = ? AND status = 'OPEN'
    `).run(paidDate, now, invoiceId);

    return (await this.getInvoiceById(invoiceId))!;
  }

  /**
   * Validação de elegibilidade de compra corporativa com travas de limite e inadimplência
   */
  async checkCustomerAgreementEligibility(
    customerId: number,
    saleAmount: number
  ): Promise<{ eligible: boolean; reason?: string; agreementName?: string; remainingCreditLimit?: number }> {
    const customer = this.db.prepare(`
      SELECT c.*, ca.company_name, ca.is_active as agreement_active, ca.id as agr_id
      FROM customers c
      LEFT JOIN corporate_agreements ca ON c.agreement_id = ca.id
      WHERE c.id = ?
    `).get(customerId) as any;

    if (!customer) {
      return { eligible: false, reason: 'CLIENTE_NAO_ENCONTRADO' };
    }

    if (!customer.agreement_id || !customer.agreement_active) {
      return { eligible: false, reason: 'CONVENIO_INATIVO_OU_INEXISTENTE' };
    }

    // Trava de inadimplência corporativa: se a empresa tiver faturas OPEN com due_date vencida há mais de 10 dias
    const today = new Date().toISOString().slice(0, 10);
    const overdueInvoices = this.db.prepare(`
      SELECT COUNT(*) as count FROM agreement_invoices
      WHERE agreement_id = ? AND status = 'OPEN' AND date(due_date, '+10 days') < date(?)
    `).get(customer.agr_id, today) as { count: number };

    if (overdueInvoices && overdueInvoices.count > 0) {
      return {
        eligible: false,
        reason: 'EMPRESA_CONVENIADA_INADIMPLENTE',
        agreementName: customer.company_name
      };
    }

    // Limite de crédito do colaborador
    const currentDebt = customer.current_debt || 0;
    const creditLimit = customer.credit_limit || 0;
    const remainingLimit = Math.max(0, creditLimit - currentDebt);

    if (creditLimit > 0 && currentDebt + saleAmount > creditLimit) {
      return {
        eligible: false,
        reason: 'LIMITE_CREDITO_EXCEDIDO',
        agreementName: customer.company_name,
        remainingCreditLimit: Number(remainingLimit.toFixed(2))
      };
    }

    return {
      eligible: true,
      agreementName: customer.company_name,
      remainingCreditLimit: Number(remainingLimit.toFixed(2))
    };
  }

  /**
   * Lista faturas com filtros
   */
  async listInvoices(agreementId?: number, status?: AgreementInvoiceStatus): Promise<AgreementInvoice[]> {
    let query = `
      SELECT
        ai.*,
        ca.company_name,
        ca.cnpj
      FROM agreement_invoices ai
      JOIN corporate_agreements ca ON ai.agreement_id = ca.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (agreementId) {
      query += ` AND ai.agreement_id = ?`;
      params.push(agreementId);
    }
    if (status) {
      query += ` AND ai.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY ai.due_date DESC, ai.created_at DESC`;
    return this.db.prepare(query).all(...params) as AgreementInvoice[];
  }

  /**
   * Indicadores gerais de convênios empresariais
   */
  async getAgreementKpis(): Promise<AgreementBillingKpis> {
    const activeAgreements = this.db.prepare(`
      SELECT COUNT(*) as count FROM corporate_agreements WHERE is_active = 1
    `).get() as { count: number };

    const invoicesStat = this.db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN status = 'OPEN' THEN total_amount ELSE 0 END) as open_amount,
        SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END) as paid_amount
      FROM agreement_invoices
    `).get() as any;

    const employeesCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM customers WHERE agreement_id IS NOT NULL AND status = 'ACTIVE'
    `).get() as { count: number };

    return {
      total_agreements_active: activeAgreements?.count || 0,
      open_invoices_count: invoicesStat?.open_count || 0,
      total_open_amount: invoicesStat?.open_amount || 0,
      paid_invoices_month_count: invoicesStat?.paid_count || 0,
      total_paid_month_amount: invoicesStat?.paid_amount || 0,
      active_employees_count: employeesCount?.count || 0
    };
  }
}
