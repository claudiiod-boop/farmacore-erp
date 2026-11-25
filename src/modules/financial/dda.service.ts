import { Database } from '../../database/connection';
import {
  DdaInvoice,
  ImportDdaInvoiceInput,
  DdaReconciliationResult,
  DdaKpis,
  DdaInvoiceStatus
} from './dda.types';
import { randomUUID } from 'crypto';

export class DdaService {
  constructor(private db: Database) {}

  /**
   * Remove caracteres não numéricos de CNPJs e códigos de barras
   */
  private cleanDigits(val: string): string {
    return (val || '').replace(/\D/g, '');
  }

  /**
   * Importa lote de boletos DDA bancários
   */
  async importDdaInvoices(storeId: string, items: ImportDdaInvoiceInput[]): Promise<DdaInvoice[]> {
    const imported: DdaInvoice[] = [];
    const now = new Date().toISOString();

    const insertStmt = this.db.prepare(`
      INSERT INTO dda_invoices (
        id, store_id, bank_code, bank_name, barcode, digitable_line,
        beneficiary_cnpj, beneficiary_name, payer_cnpj, due_date, issue_date,
        nominal_amount, discount_amount, interest_amount, final_amount,
        status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        'PENDING', ?, ?
      )
    `);

    this.db.transaction(() => {
      for (const item of items) {
        const id = `dda-${randomUUID()}`;
        const discount = item.discount_amount || 0;
        const interest = item.interest_amount || 0;
        const finalAmount = item.final_amount ?? (item.nominal_amount - discount + interest);

        const cleanBeneficiaryCnpj = this.cleanDigits(item.beneficiary_cnpj);
        const cleanPayerCnpj = this.cleanDigits(item.payer_cnpj);
        const cleanBarcode = this.cleanDigits(item.barcode);

        insertStmt.run(
          id,
          storeId,
          item.bank_code,
          item.bank_name,
          cleanBarcode,
          item.digitable_line,
          cleanBeneficiaryCnpj,
          item.beneficiary_name,
          cleanPayerCnpj,
          item.due_date,
          item.issue_date,
          item.nominal_amount,
          discount,
          interest,
          finalAmount,
          now,
          now
        );

        imported.push({
          id,
          store_id: storeId,
          bank_code: item.bank_code,
          bank_name: item.bank_name,
          barcode: cleanBarcode,
          digitable_line: item.digitable_line,
          beneficiary_cnpj: cleanBeneficiaryCnpj,
          beneficiary_name: item.beneficiary_name,
          payer_cnpj: cleanPayerCnpj,
          due_date: item.due_date,
          issue_date: item.issue_date,
          nominal_amount: item.nominal_amount,
          discount_amount: discount,
          interest_amount: interest,
          final_amount: finalAmount,
          status: 'PENDING',
          created_at: now,
          updated_at: now
        });
      }
    })();

    return imported;
  }

  /**
   * Motor de Conciliação Automática: Compara boletos DDA contra notas de compras (purchase_invoices)
   * e despesas operacionais (operational_expenses)
   */
  async reconcileInvoicesAuto(storeId: string): Promise<DdaReconciliationResult> {
    const pendingInvoices = this.db.prepare(`
      SELECT * FROM dda_invoices
      WHERE store_id = ? AND status IN ('PENDING', 'UNMATCHED')
    `).all(storeId) as DdaInvoice[];

    let matchedCount = 0;
    let mismatchValueCount = 0;
    let unmatchedCount = 0;
    const processedList: DdaReconciliationResult['invoices'] = [];
    const now = new Date().toISOString();

    const updateStmt = this.db.prepare(`
      UPDATE dda_invoices
      SET status = ?,
          matched_purchase_invoice_id = ?,
          matched_expense_id = ?,
          reconciled_at = ?,
          updated_at = ?
      WHERE id = ?
    `);

    this.db.transaction(() => {
      for (const dda of pendingInvoices) {
        const cleanDdaCnpj = this.cleanDigits(dda.beneficiary_cnpj);

        // 1. Tenta conciliar com notas de compras (purchase_invoices)
        // Busca notas com mesmo CNPJ de distribuidora
        const purchases = this.db.prepare(`
          SELECT id, supplier_cnpj, supplier_name, total_invoice_amount, issue_date
          FROM purchase_invoices
          WHERE replace(replace(replace(supplier_cnpj, '.', ''), '/', ''), '-', '') = ?
        `).all(cleanDdaCnpj) as Array<{
          id: number;
          supplier_cnpj: string;
          supplier_name: string;
          total_invoice_amount: number;
          issue_date: string;
        }>;

        let matched = false;
        let matchedPurchaseId: number | null = null;
        let matchedExpenseId: string | null = null;
        let newStatus: DdaInvoiceStatus = 'UNMATCHED';
        let discrepancyNote: string | undefined;

        if (purchases.length > 0) {
          // Procura compra com valor idêntico (tolerância de até 5 centavos)
          const exactPurchase = purchases.find(
            (p) => Math.abs(p.total_invoice_amount - dda.final_amount) <= 0.05
          );

          if (exactPurchase) {
            matched = true;
            matchedPurchaseId = exactPurchase.id;
            newStatus = 'MATCHED';
            matchedCount++;
          } else {
            // CNPJ confere mas valor é discrepante
            newStatus = 'MISMATCH_VALUE';
            matchedPurchaseId = purchases[0].id;
            discrepancyNote = `Valor do boleto DDA (R$ ${dda.final_amount.toFixed(2)}) difere da NF de compra (R$ ${purchases[0].total_invoice_amount.toFixed(2)})`;
            mismatchValueCount++;
          }
        } else {
          // 2. Se não achou em compras, tenta verificar em despesas operacionais por fornecedor
          const expenses = this.db.prepare(`
            SELECT id, description, amount, due_date
            FROM operational_expenses
            WHERE LOWER(description) LIKE ?
          `).all(`%${dda.beneficiary_name.toLowerCase().slice(0, 10)}%`) as Array<{
            id: string;
            description: string;
            amount: number;
            due_date: string;
          }>;

          const exactExpense = expenses.find(
            (e) => Math.abs(e.amount - dda.final_amount) <= 0.05
          );

          if (exactExpense) {
            matched = true;
            matchedExpenseId = exactExpense.id;
            newStatus = 'MATCHED';
            matchedCount++;
          } else {
            newStatus = 'UNMATCHED';
            discrepancyNote = 'Nenhuma NF de compra ou despesa encontrada com este CNPJ no ERP (Atenção a possível fraude)';
            unmatchedCount++;
          }
        }

        updateStmt.run(
          newStatus,
          matchedPurchaseId,
          matchedExpenseId,
          newStatus === 'MATCHED' ? now : null,
          now,
          dda.id
        );

        processedList.push({
          id: dda.id,
          beneficiary_name: dda.beneficiary_name,
          final_amount: dda.final_amount,
          status: newStatus,
          matched_purchase_invoice_id: matchedPurchaseId,
          matched_expense_id: matchedExpenseId,
          discrepancyNote
        });
      }
    })();

    return {
      totalProcessed: pendingInvoices.length,
      matchedCount,
      mismatchValueCount,
      unmatchedCount,
      invoices: processedList
    };
  }

  /**
   * Vinculação manual de um boleto DDA
   */
  async manualMatch(
    invoiceId: string,
    matchType: 'PURCHASE' | 'EXPENSE',
    targetId: string | number,
    userId: string = 'GERENTE_FINANCEIRO'
  ): Promise<DdaInvoice> {
    const now = new Date().toISOString();

    const invoice = this.db.prepare(`SELECT * FROM dda_invoices WHERE id = ?`).get(invoiceId) as DdaInvoice;
    if (!invoice) {
      throw new Error('INVOICE_NOT_FOUND');
    }

    const matchedPurchase = matchType === 'PURCHASE' ? Number(targetId) : null;
    const matchedExpense = matchType === 'EXPENSE' ? String(targetId) : null;

    this.db.prepare(`
      UPDATE dda_invoices
      SET status = 'MATCHED',
          matched_purchase_invoice_id = ?,
          matched_expense_id = ?,
          reconciled_at = ?,
          reconciled_by = ?,
          updated_at = ?
      WHERE id = ?
    `).run(matchedPurchase, matchedExpense, now, userId, now, invoiceId);

    return this.db.prepare(`SELECT * FROM dda_invoices WHERE id = ?`).get(invoiceId) as DdaInvoice;
  }

  /**
   * Quitação e baixa do título DDA
   */
  async settleDdaInvoice(invoiceId: string, paidAmount: number, paymentDate: string): Promise<DdaInvoice> {
    const now = new Date().toISOString();
    const invoice = this.db.prepare(`SELECT * FROM dda_invoices WHERE id = ?`).get(invoiceId) as DdaInvoice;
    if (!invoice) {
      throw new Error('INVOICE_NOT_FOUND');
    }

    this.db.transaction(() => {
      this.db.prepare(`
        UPDATE dda_invoices
        SET status = 'PAID',
            updated_at = ?
        WHERE id = ?
      `).run(now, invoiceId);

      // Se havia despesa vinculada, baixa a despesa
      if (invoice.matched_expense_id) {
        this.db.prepare(`
          UPDATE operational_expenses
          SET status = 'PAID',
              payment_date = ?
          WHERE id = ?
        `).run(paymentDate, invoice.matched_expense_id);
      }
    })();

    return this.db.prepare(`SELECT * FROM dda_invoices WHERE id = ?`).get(invoiceId) as DdaInvoice;
  }

  /**
   * Listagem de boletos DDA com filtros
   */
  async listDdaInvoices(
    storeId: string,
    filters?: { status?: DdaInvoiceStatus; startDate?: string; endDate?: string }
  ): Promise<DdaInvoice[]> {
    let query = `SELECT * FROM dda_invoices WHERE store_id = ?`;
    const params: any[] = [storeId];

    if (filters?.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }
    if (filters?.startDate) {
      query += ` AND due_date >= ?`;
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ` AND due_date <= ?`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY due_date ASC, final_amount DESC`;
    return this.db.prepare(query).all(...params) as DdaInvoice[];
  }

  /**
   * Indicadores Financeiros de DDA
   */
  async getDdaKpis(storeId: string): Promise<DdaKpis> {
    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total_invoices,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_invoices,
        SUM(CASE WHEN status = 'MATCHED' THEN 1 ELSE 0 END) as matched_invoices,
        SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid_invoices,
        SUM(CASE WHEN status IN ('UNMATCHED', 'MISMATCH_VALUE') THEN 1 ELSE 0 END) as unmatched_invoices,
        SUM(CASE WHEN status IN ('PENDING', 'UNMATCHED', 'MISMATCH_VALUE') THEN final_amount ELSE 0 END) as total_amount_pending,
        SUM(CASE WHEN status = 'MATCHED' THEN final_amount ELSE 0 END) as total_amount_matched
      FROM dda_invoices
      WHERE store_id = ?
    `).get(storeId) as any;

    const total = stats.total_invoices || 0;
    const matched = (stats.matched_invoices || 0) + (stats.paid_invoices || 0);
    const rate = total > 0 ? (matched / total) * 100 : 0;

    return {
      total_invoices: total,
      pending_invoices: stats.pending_invoices || 0,
      matched_invoices: stats.matched_invoices || 0,
      paid_invoices: stats.paid_invoices || 0,
      unmatched_invoices: stats.unmatched_invoices || 0,
      total_amount_pending: stats.total_amount_pending || 0,
      total_amount_matched: stats.total_amount_matched || 0,
      reconciliation_rate_percent: Number(rate.toFixed(1))
    };
  }
}
