import { Database } from '../../database/connection';
import { CashFlowOverview, CashFlowDailySummary } from './bank-reconciliation.types';

export class CashFlowService {
  /**
   * Consolida a posição de liquidez atual (bancos + caixa físico) e projeta o fluxo de caixa dia a dia.
   */
  static async getCashFlowOverview(
    db: Database,
    storeId: number,
    daysAhead: number = 30
  ): Promise<CashFlowOverview> {
    // 1. Contas bancárias e saldos disponíveis
    const bankAccountRows = db.prepare(`
      SELECT id, bank_name, account_number, current_balance
      FROM bank_accounts
      WHERE store_id = ? AND is_active = 1
      ORDER BY bank_name ASC
    `).all(storeId) as any[];

    let totalLiquidBankBalance = 0;
    const currentBankBalances = bankAccountRows.map(row => {
      const bal = Math.round(row.current_balance * 100) / 100;
      totalLiquidBankBalance = Math.round((totalLiquidBankBalance + bal) * 100) / 100;
      return {
        accountId: row.id,
        bankName: row.bank_name,
        accountNumber: row.account_number,
        balance: bal
      };
    });

    // 2. Saldo em espécie na gaveta dos caixas PDV abertos
    const cashDrawerRow = db.prepare(`
      SELECT COALESCE(SUM(current_cash), 0.0) as total
      FROM cash_sessions
      WHERE status = 'OPEN'
    `).get() as any;

    const totalCashDrawerBalance = Math.round((cashDrawerRow?.total || 0) * 100) / 100;
    const totalCurrentAssets = Math.round((totalLiquidBankBalance + totalCashDrawerBalance) * 100) / 100;

    // 3. Projeção de fluxo de caixa diário (Realizado no passado + Projetado no futuro)
    const projections: CashFlowDailySummary[] = [];
    let rollingBalance = totalCurrentAssets;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (let i = 0; i < daysAhead; i++) {
      const targetDateObj = new Date(today.getTime() + i * 86400000);
      const targetDate = targetDateObj.toISOString().slice(0, 10);

      // Entradas projetadas de recebíveis de cartões (D+1/D+30)
      const cardInflowRow = db.prepare(`
        SELECT COALESCE(SUM(net_amount), 0.0) as total
        FROM card_settlement_entries
        WHERE settlement_date = ?
      `).get(targetDate) as any;

      const cardInflow = Math.round((cardInflowRow?.total || 0) * 100) / 100;

      // Entradas de crediário / convênios a vencer no dia
      let creditInflow = 0;
      try {
        const creditRow = db.prepare(`
          SELECT COALESCE(SUM(total_amount - paid_amount), 0.0) as total
          FROM agreement_invoices
          WHERE due_date = ? AND status = 'OPEN'
        `).get(targetDate) as any;
        creditInflow = Math.round((creditRow?.total || 0) * 100) / 100;
      } catch {
        // Tabela opcional conforme módulo
      }

      const totalProjectedInflow = Math.round((cardInflow + creditInflow) * 100) / 100;

      // Saídas projetadas a fornecedores (boletos/compras)
      let supplierOutflow = 0;
      try {
        const purchaseRow = db.prepare(`
          SELECT COALESCE(SUM(total_invoice_amount), 0.0) as total
          FROM purchase_invoices
          WHERE issue_date = ?
        `).get(targetDate) as any;
        supplierOutflow = Math.round((purchaseRow?.total || 0) * 100) / 100;
      } catch {
        // Fallback
      }

      const openingBalance = rollingBalance;
      const closingBalance = Math.round((openingBalance + totalProjectedInflow - supplierOutflow) * 100) / 100;
      rollingBalance = closingBalance;

      let status: 'SURPLUS' | 'WARNING' | 'DEFICIT' = 'SURPLUS';
      if (closingBalance < 0) {
        status = 'DEFICIT';
      } else if (closingBalance < 5000) {
        status = 'WARNING';
      }

      projections.push({
        date: targetDate,
        openingBalance,
        realizedInflow: i === 0 ? totalProjectedInflow : 0,
        realizedOutflow: i === 0 ? supplierOutflow : 0,
        realizedNet: i === 0 ? Math.round((totalProjectedInflow - supplierOutflow) * 100) / 100 : 0,
        closingBalance,
        projectedInflow: totalProjectedInflow,
        projectedOutflow: supplierOutflow,
        projectedClosingBalance: closingBalance,
        status
      });
    }

    return {
      currentBankBalances,
      totalLiquidBankBalance,
      totalCashDrawerBalance,
      totalCurrentAssets,
      projections30Days: projections
    };
  }
}
