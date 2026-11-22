import { Database } from '../../database/connection';
import {
  BankAccount,
  CreateBankAccountInput,
  BankStatementBatch,
  BankStatementEntry,
  ImportOfxInput,
  ManualMatchInput,
  BankReconciliationStatus,
  BankReconciliationType,
  BankTransactionType,
  BankAccountType
} from './bank-reconciliation.types';
import { OfxParserService } from './ofx-parser.service';

export class BankReconciliationService {
  /**
   * Cadastra nova conta bancária para uma filial.
   */
  static async createBankAccount(
    db: Database,
    input: CreateBankAccountInput
  ): Promise<BankAccount> {
    const initialBal = input.initialBalance ?? 0.0;
    const stmt = db.prepare(`
      INSERT INTO bank_accounts (
        store_id, bank_code, bank_name, agency_number, account_number,
        account_type, initial_balance, current_balance, is_active, notes
      ) VALUES (
        @storeId, @bankCode, @bankName, @agencyNumber, @accountNumber,
        @accountType, @initialBalance, @currentBalance, 1, @notes
      )
    `);

    const result = stmt.run({
      storeId: input.storeId,
      bankCode: input.bankCode.trim(),
      bankName: input.bankName.trim(),
      agencyNumber: input.agencyNumber.trim(),
      accountNumber: input.accountNumber.trim(),
      accountType: input.accountType || 'CHECKING',
      initialBalance: initialBal,
      currentBalance: initialBal,
      notes: input.notes || null
    });

    const row = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(result.lastInsertRowid) as any;
    return this.mapBankAccountRow(row);
  }

  /**
   * Lista contas bancárias de uma loja.
   */
  static async listBankAccounts(db: Database, storeId: number): Promise<BankAccount[]> {
    const rows = db.prepare(`
      SELECT * FROM bank_accounts WHERE store_id = ? ORDER BY bank_name ASC, account_number ASC
    `).all(storeId) as any[];

    return rows.map(r => this.mapBankAccountRow(r));
  }

  /**
   * Obtém conta bancária por ID.
   */
  static async getBankAccountById(db: Database, id: number): Promise<BankAccount | null> {
    const row = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id) as any;
    return row ? this.mapBankAccountRow(row) : null;
  }

  /**
   * Importa e processa arquivo OFX com detecção automática e batimento inteligente multi-origem.
   */
  static async importOfxStatement(
    db: Database,
    input: ImportOfxInput
  ): Promise<BankStatementBatch> {
    const parsed = OfxParserService.parse(input.ofxContent);
    const account = await this.getBankAccountById(db, input.bankAccountId);
    if (!account) {
      throw new Error(`Conta bancária com ID ${input.bankAccountId} não encontrada.`);
    }

    const batchCode = `OFX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const insertBatchStmt = db.prepare(`
      INSERT INTO bank_statement_batches (
        bank_account_id, batch_code, file_name, period_start, period_end,
        ledger_balance, total_entries, matched_entries, unmatched_entries
      ) VALUES (
        @bankAccountId, @batchCode, @fileName, @periodStart, @periodEnd,
        @ledgerBalance, @totalEntries, @matchedEntries, @unmatchedEntries
      )
    `);

    const insertEntryStmt = db.prepare(`
      INSERT INTO bank_statement_entries (
        batch_id, bank_account_id, fitid, transaction_type, posted_date,
        amount, document_number, memo, reconciliation_status, reconciliation_type,
        matched_entity_id, matched_notes, reconciled_at
      ) VALUES (
        @batchId, @bankAccountId, @fitid, @transactionType, @postedDate,
        @amount, @documentNumber, @memo, @reconciliationStatus, @reconciliationType,
        @matchedEntityId, @matchedNotes, @reconciledAt
      )
    `);

    const runInTransaction = db.transaction(() => {
      // 1. Cria cabeçalho provisório do lote
      const batchInsertResult = insertBatchStmt.run({
        bankAccountId: input.bankAccountId,
        batchCode,
        fileName: input.fileName,
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
        ledgerBalance: parsed.ledgerBalance,
        totalEntries: 0,
        matchedEntries: 0,
        unmatchedEntries: 0
      });

      const batchId = Number(batchInsertResult.lastInsertRowid);

      let totalInserted = 0;
      let matchedCount = 0;
      let unmatchedCount = 0;
      let runningDeltaBalance = 0;

      for (const trx of parsed.transactions) {
        // Verifica se a transação já foi importada anteriormente para esta conta (Idempotência via FITID)
        const existing = db.prepare(`
          SELECT id FROM bank_statement_entries WHERE bank_account_id = ? AND fitid = ?
        `).get(input.bankAccountId, trx.fitid) as any;

        if (existing) {
          continue; // Pula transação duplicada
        }

        totalInserted++;
        runningDeltaBalance = Math.round((runningDeltaBalance + trx.amount) * 100) / 100;

        let status: BankReconciliationStatus = 'UNMATCHED';
        let recType: BankReconciliationType | null = null;
        let matchedId: number | null = null;
        let notes: string | null = null;
        let reconciledAt: string | null = null;

        const memoUpper = trx.memo.toUpperCase();

        // 1. Regra Tarifa Bancária
        if (
          trx.amount < 0 &&
          (memoUpper.includes('TARIFA') ||
            memoUpper.includes('IOF') ||
            memoUpper.includes('TAXA') ||
            memoUpper.includes('MANUT') ||
            memoUpper.includes('MORA') ||
            memoUpper.includes('ANUIDADE') ||
            memoUpper.includes('ENCARGO'))
        ) {
          status = 'BANK_FEE';
          recType = 'BANK_FEE';
          notes = 'Classificação automática de despesa / encargo bancário';
          reconciledAt = new Date().toISOString();
          matchedCount++;
        }
        // 2. Regra TEF / Repasse de Cartões (Crédito)
        else if (trx.amount > 0) {
          const tefRow = db.prepare(`
            SELECT id, net_amount, brand_name, operation_type
            FROM card_settlement_entries
            WHERE ABS(net_amount - ?) <= 0.05
            ORDER BY id DESC LIMIT 1
          `).get(trx.amount) as any;

          if (tefRow) {
            status = 'MATCHED';
            recType = 'TEF_SETTLEMENT';
            matchedId = tefRow.id;
            notes = `Conciliado com lote de cartões TEF #${tefRow.id} (${tefRow.brand_name} / ${tefRow.operation_type})`;
            reconciledAt = new Date().toISOString();
            matchedCount++;
          } else {
            // 3. Regra Sangria / Fechamento de Caixa PDV
            const cashRow = db.prepare(`
              SELECT id, amount, reason
              FROM cash_movements
              WHERE type IN ('SANGRIA', 'DRAWER_BLEED') AND ABS(amount - ?) <= 0.05
              ORDER BY id DESC LIMIT 1
            `).get(trx.amount) as any;

            if (cashRow) {
              status = 'MATCHED';
              recType = 'CASH_DRAWER';
              matchedId = cashRow.id;
              notes = `Conciliado com sangria de caixa #${cashRow.id}: ${cashRow.reason || 'Depósito'}`;
              reconciledAt = new Date().toISOString();
              matchedCount++;
            } else {
              status = 'UNMATCHED';
              unmatchedCount++;
            }
          }
        }
        // 4. Regra Pagamento de Fornecedor / NF-e (Débito)
        else if (trx.amount < 0) {
          const absAmount = Math.abs(trx.amount);
          const invoiceRow = db.prepare(`
            SELECT id, invoice_number, total_invoice_amount
            FROM purchase_invoices
            WHERE ABS(total_invoice_amount - ?) <= 0.05
            ORDER BY id DESC LIMIT 1
          `).get(absAmount) as any;

          if (invoiceRow) {
            status = 'MATCHED';
            recType = 'PURCHASE_PAYMENT';
            matchedId = invoiceRow.id;
            notes = `Conciliado com NF de compra #${invoiceRow.invoice_number} (ID: ${invoiceRow.id})`;
            reconciledAt = new Date().toISOString();
            matchedCount++;
          } else {
            status = 'UNMATCHED';
            unmatchedCount++;
          }
        }

        insertEntryStmt.run({
          batchId,
          bankAccountId: input.bankAccountId,
          fitid: trx.fitid,
          transactionType: trx.type,
          postedDate: trx.postedDate,
          amount: trx.amount,
          documentNumber: trx.documentNumber || null,
          memo: trx.memo,
          reconciliationStatus: status,
          reconciliationType: recType,
          matchedEntityId: matchedId,
          matchedNotes: notes,
          reconciledAt
        });
      }

      // Atualiza lote consolidado
      db.prepare(`
        UPDATE bank_statement_batches
        SET total_entries = ?, matched_entries = ?, unmatched_entries = ?
        WHERE id = ?
      `).run(totalInserted, matchedCount, unmatchedCount, batchId);

      // Atualiza saldo da conta bancária
      db.prepare(`
        UPDATE bank_accounts
        SET current_balance = ROUND(current_balance + ?, 2), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(runningDeltaBalance, input.bankAccountId);

      return batchId;
    });

    const createdBatchId = runInTransaction();
    const batchRow = db.prepare('SELECT * FROM bank_statement_batches WHERE id = ?').get(createdBatchId) as any;
    return this.mapBatchRow(batchRow);
  }

  /**
   * Vincula manualmente uma entrada bancária que não foi conciliada automaticamente.
   */
  static async manualMatchEntry(
    db: Database,
    input: ManualMatchInput
  ): Promise<BankStatementEntry> {
    const entryRow = db.prepare('SELECT * FROM bank_statement_entries WHERE id = ?').get(input.entryId) as any;
    if (!entryRow) {
      throw new Error(`Entrada de extrato #${input.entryId} não encontrada.`);
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE bank_statement_entries
      SET
        reconciliation_status = 'MANUAL_MATCH',
        reconciliation_type = ?,
        matched_entity_id = ?,
        matched_notes = ?,
        reconciled_at = ?
      WHERE id = ?
    `).run(
      input.reconciliationType,
      input.matchedEntityId || null,
      input.notes,
      now,
      input.entryId
    );

    // Incrementa contadores do lote
    db.prepare(`
      UPDATE bank_statement_batches
      SET
        matched_entries = matched_entries + 1,
        unmatched_entries = MAX(0, unmatched_entries - 1)
      WHERE id = ?
    `).run(entryRow.batch_id);

    const updated = db.prepare('SELECT * FROM bank_statement_entries WHERE id = ?').get(input.entryId) as any;
    return this.mapEntryRow(updated);
  }

  /**
   * Obtém os detalhes completos do lote com suas transações.
   */
  static async getBatchDetails(
    db: Database,
    batchId: number
  ): Promise<{ batch: BankStatementBatch; entries: BankStatementEntry[] }> {
    const batchRow = db.prepare('SELECT * FROM bank_statement_batches WHERE id = ?').get(batchId) as any;
    if (!batchRow) {
      throw new Error(`Lote de extrato #${batchId} não encontrado.`);
    }

    const entryRows = db.prepare(`
      SELECT * FROM bank_statement_entries WHERE batch_id = ? ORDER BY posted_date ASC, id ASC
    `).all(batchId) as any[];

    return {
      batch: this.mapBatchRow(batchRow),
      entries: entryRows.map(r => this.mapEntryRow(r))
    };
  }

  // --- Mapeadores de Banco de Dados ---

  private static mapBankAccountRow(row: any): BankAccount {
    return {
      id: row.id,
      storeId: row.store_id,
      bankCode: row.bank_code,
      bankName: row.bank_name,
      agencyNumber: row.agency_number,
      accountNumber: row.account_number,
      accountType: row.account_type as BankAccountType,
      initialBalance: row.initial_balance,
      currentBalance: row.current_balance,
      isActive: row.is_active === 1,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private static mapBatchRow(row: any): BankStatementBatch {
    return {
      id: row.id,
      bankAccountId: row.bank_account_id,
      batchCode: row.batch_code,
      fileName: row.file_name,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      ledgerBalance: row.ledger_balance,
      totalEntries: row.total_entries,
      matchedEntries: row.matched_entries,
      unmatchedEntries: row.unmatched_entries,
      importedAt: row.imported_at
    };
  }

  private static mapEntryRow(row: any): BankStatementEntry {
    return {
      id: row.id,
      batchId: row.batch_id,
      bankAccountId: row.bank_account_id,
      fitid: row.fitid,
      transactionType: row.transaction_type as BankTransactionType,
      postedDate: row.posted_date,
      amount: row.amount,
      documentNumber: row.document_number,
      memo: row.memo,
      reconciliationStatus: row.reconciliation_status as BankReconciliationStatus,
      reconciliationType: row.reconciliation_type as BankReconciliationType | null,
      matchedEntityId: row.matched_entity_id,
      matchedNotes: row.matched_notes,
      reconciledAt: row.reconciled_at,
      createdAt: row.created_at
    };
  }
}
