import { Database } from '../../database/connection';
import {
  AcquirerContract,
  AcquirerContractWithRules,
  AcquirerFeeRule,
  CardOperationType,
  CardReconciliationBatch,
  CardSettlementEntry,
  CreateAcquirerContractInput,
  CreateFeeRuleInput,
  ImportStatementInput,
  ReconciliationStatus
} from './card-reconciliation.types';
import { CardFeeCalculatorService } from './card-fee-calculator.service';

export class CardReconciliationService {
  /**
   * Cadastra um novo contrato com adquirente.
   */
  static async createAcquirerContract(
    db: Database,
    input: CreateAcquirerContractInput
  ): Promise<AcquirerContract> {
    const stmt = db.prepare(`
      INSERT INTO acquirer_contracts (
        store_id, acquirer_name, acquirer_cnpj, merchant_code,
        default_bank_name, default_bank_agency, default_bank_account,
        debit_settlement_days, credit_settlement_days, pix_settlement_days,
        is_active, notes
      ) VALUES (
        @storeId, @acquirerName, @acquirerCnpj, @merchantCode,
        @defaultBankName, @defaultBankAgency, @defaultBankAccount,
        @debitSettlementDays, @creditSettlementDays, @pixSettlementDays,
        1, @notes
      )
    `);

    const result = stmt.run({
      storeId: input.storeId,
      acquirerName: input.acquirerName.toUpperCase(),
      acquirerCnpj: input.acquirerCnpj.replace(/\D/g, ''),
      merchantCode: input.merchantCode || null,
      defaultBankName: input.defaultBankName,
      defaultBankAgency: input.defaultBankAgency,
      defaultBankAccount: input.defaultBankAccount,
      debitSettlementDays: input.debitSettlementDays ?? 1,
      creditSettlementDays: input.creditSettlementDays ?? 30,
      pixSettlementDays: input.pixSettlementDays ?? 0,
      notes: input.notes || null
    });

    const row = db.prepare(`SELECT * FROM acquirer_contracts WHERE id = ?`).get(result.lastInsertRowid) as any;
    return this.mapContractRow(row);
  }

  /**
   * Adiciona ou atualiza uma regra de taxa MDR para um contrato de adquirente.
   */
  static async addFeeRule(
    db: Database,
    input: CreateFeeRuleInput
  ): Promise<AcquirerFeeRule> {
    const stmt = db.prepare(`
      INSERT INTO acquirer_fee_rules (
        contract_id, brand_name, operation_type,
        installment_min, installment_max, mdr_rate, fixed_fee,
        settlement_days, is_active
      ) VALUES (
        @contractId, @brandName, @operationType,
        @installmentMin, @installmentMax, @mdrRate, @fixedFee,
        @settlementDays, 1
      )
      ON CONFLICT(contract_id, brand_name, operation_type, installment_min, installment_max)
      DO UPDATE SET
        mdr_rate = excluded.mdr_rate,
        fixed_fee = excluded.fixed_fee,
        settlement_days = excluded.settlement_days,
        is_active = 1
    `);

    const result = stmt.run({
      contractId: input.contractId,
      brandName: input.brandName.toUpperCase(),
      operationType: input.operationType.toUpperCase(),
      installmentMin: input.installmentMin ?? 1,
      installmentMax: input.installmentMax ?? 1,
      mdrRate: input.mdrRate,
      fixedFee: input.fixedFee ?? 0.0,
      settlementDays: input.settlementDays ?? null
    });

    const id = result.lastInsertRowid > 0
      ? result.lastInsertRowid
      : (db.prepare(`
          SELECT id FROM acquirer_fee_rules
          WHERE contract_id = ? AND brand_name = ? AND operation_type = ? AND installment_min = ? AND installment_max = ?
        `).get(
          input.contractId,
          input.brandName.toUpperCase(),
          input.operationType.toUpperCase(),
          input.installmentMin ?? 1,
          input.installmentMax ?? 1
        ) as any).id;

    const row = db.prepare(`SELECT * FROM acquirer_fee_rules WHERE id = ?`).get(id) as any;
    return this.mapFeeRuleRow(row);
  }

  /**
   * Lista todos os contratos de adquirente de uma loja com suas respectivas regras.
   */
  static async listContracts(db: Database, storeId: number): Promise<AcquirerContractWithRules[]> {
    const contractRows = db.prepare(`
      SELECT * FROM acquirer_contracts WHERE store_id = ? ORDER BY acquirer_name ASC
    `).all(storeId) as any[];

    const result: AcquirerContractWithRules[] = [];

    for (const cRow of contractRows) {
      const contract = this.mapContractRow(cRow);
      const ruleRows = db.prepare(`
        SELECT * FROM acquirer_fee_rules WHERE contract_id = ? AND is_active = 1 ORDER BY operation_type, brand_name, installment_min
      `).all(contract.id) as any[];

      const rules = ruleRows.map(r => this.mapFeeRuleRow(r));
      result.push({
        ...contract,
        rules
      });
    }

    return result;
  }

  /**
   * Obtém um contrato por ID com suas regras.
   */
  static async getContractById(db: Database, contractId: number): Promise<AcquirerContractWithRules | null> {
    const cRow = db.prepare(`SELECT * FROM acquirer_contracts WHERE id = ?`).get(contractId) as any;
    if (!cRow) return null;

    const contract = this.mapContractRow(cRow);
    const ruleRows = db.prepare(`
      SELECT * FROM acquirer_fee_rules WHERE contract_id = ? AND is_active = 1 ORDER BY operation_type, brand_name, installment_min
    `).all(contract.id) as any[];

    return {
      ...contract,
      rules: ruleRows.map(r => this.mapFeeRuleRow(r))
    };
  }

  /**
   * Importa e processa lote de extrato eletrônico (EDI / CSV), executando o batimento automático.
   */
  static async importStatement(
    db: Database,
    input: ImportStatementInput
  ): Promise<CardReconciliationBatch> {
    const batchCode = `CONC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    let acquirerName = 'OUTROS';
    let contractRules: AcquirerFeeRule[] = [];

    if (input.acquirerContractId) {
      const contractWithRules = await this.getContractById(db, input.acquirerContractId);
      if (contractWithRules) {
        acquirerName = contractWithRules.acquirerName;
        contractRules = contractWithRules.rules;
      }
    }

    // Calcula período coberto pelo lote
    let minDate = '';
    let maxDate = '';

    if (input.items.length > 0) {
      const dates = input.items.map(i => i.transactionDate.substring(0, 10)).sort();
      minDate = dates[0];
      maxDate = dates[dates.length - 1];
    } else {
      const today = new Date().toISOString().substring(0, 10);
      minDate = today;
      maxDate = today;
    }

    let conciliatedCount = 0;
    let divergentCount = 0;
    let chargebackCount = 0;
    let notFoundCount = 0;

    let totalGross = 0;
    let totalNet = 0;
    let totalFee = 0;

    const insertBatchStmt = db.prepare(`
      INSERT INTO card_reconciliation_batches (
        store_id, acquirer_contract_id, batch_code, file_name, file_type,
        period_start, period_end, total_records,
        total_gross_amount, total_net_amount, total_fee_amount,
        conciliated_count, divergent_count, chargeback_count, not_found_count,
        status
      ) VALUES (
        @storeId, @contractId, @batchCode, @fileName, @fileType,
        @periodStart, @periodEnd, @totalRecords,
        @totalGross, @totalNet, @totalFee,
        @conciliatedCount, @divergentCount, @chargebackCount, @notFoundCount,
        'PROCESSED'
      )
    `);

    const insertEntryStmt = db.prepare(`
      INSERT INTO card_settlement_entries (
        batch_id, tef_transaction_id, nsu, authorization_code,
        transaction_date, settlement_date, brand_name, operation_type,
        installment_number, total_installments,
        gross_amount, charged_mdr_rate, charged_fee_amount, net_amount,
        contract_mdr_rate, expected_fee_amount, expected_net_amount,
        divergence_amount, reconciliation_status, bank_account, notes
      ) VALUES (
        @batchId, @tefTransactionId, @nsu, @authorizationCode,
        @transactionDate, @settlementDate, @brandName, @operationType,
        @installmentNumber, @totalInstallments,
        @grossAmount, @chargedMdrRate, @chargedFeeAmount, @netAmount,
        @contractMdrRate, @expectedFeeAmount, @expectedNetAmount,
        @divergenceAmount, @reconciliationStatus, @bankAccount, @notes
      )
    `);

    // Inicia transação SQLite
    const runInTransaction = db.transaction(() => {
      // 1. Cria cabeçalho provisório para obter batchId
      const batchInsertResult = insertBatchStmt.run({
        storeId: input.storeId,
        contractId: input.acquirerContractId || null,
        batchCode,
        fileName: input.fileName,
        fileType: input.fileType,
        periodStart: minDate,
        periodEnd: maxDate,
        totalRecords: input.items.length,
        totalGross: 0,
        totalNet: 0,
        totalFee: 0,
        conciliatedCount: 0,
        divergentCount: 0,
        chargebackCount: 0,
        notFoundCount: 0
      });

      const batchId = Number(batchInsertResult.lastInsertRowid);

      // 2. Processa cada entrada e busca batimento no TEF/ERP
      for (const item of input.items) {
        totalGross = Math.round((totalGross + item.grossAmount) * 100) / 100;
        totalNet = Math.round((totalNet + item.netAmount) * 100) / 100;
        totalFee = Math.round((totalFee + item.chargedFeeAmount) * 100) / 100;

        let status: ReconciliationStatus = 'CONCILIATED';
        let divergenceAmount = 0.0;
        let contractMdrRate: number | null = null;
        let expectedFeeAmount: number | null = null;
        let expectedNetAmount: number | null = null;
        let tefTransactionId: number | null = null;

        const isChargeback =
          item.grossAmount < 0 ||
          (item.notes && item.notes.toUpperCase().includes('CHARGEBACK'));

        if (isChargeback) {
          status = 'CHARGEBACK';
          chargebackCount++;
        } else {
          // Busca transação correspondente em tef_transactions
          const tefRow = db.prepare(`
            SELECT id, amount, operation_type, brand_name, mdr_rate
            FROM tef_transactions
            WHERE nsu = ? OR (authorization_code = ? AND authorization_code IS NOT NULL AND authorization_code != '')
            ORDER BY id DESC LIMIT 1
          `).get(item.nsu, item.authorizationCode || '') as any;

          if (tefRow) {
            tefTransactionId = tefRow.id;

            // Busca regra de taxa acordada
            const matchedRule = CardFeeCalculatorService.matchFeeRule(
              contractRules,
              item.operationType,
              item.brandName,
              item.totalInstallments || 1
            );

            if (matchedRule) {
              contractMdrRate = matchedRule.mdrRate;
              const calc = CardFeeCalculatorService.calculateFeeAndNet(item.grossAmount, matchedRule);
              expectedFeeAmount = calc.feeAmount;
              expectedNetAmount = calc.netAmount;

              // Diferença entre o que foi cobrado e o contratual
              const diff = Math.round((item.chargedFeeAmount - expectedFeeAmount) * 100) / 100;

              // Tolerância de 2 centavos para pequenos desvios de arredondamento
              if (Math.abs(diff) > 0.02) {
                status = 'DIVERGENT_FEE';
                divergenceAmount = diff;
                divergentCount++;
              } else {
                status = 'CONCILIATED';
                divergenceAmount = 0.0;
                conciliatedCount++;
              }
            } else {
              // Não tem regra específica cadastrada, aceita como conciliado
              status = 'CONCILIATED';
              conciliatedCount++;
            }
          } else {
            status = 'NOT_FOUND_IN_ERP';
            notFoundCount++;
          }
        }

        insertEntryStmt.run({
          batchId,
          tefTransactionId,
          nsu: item.nsu,
          authorizationCode: item.authorizationCode || null,
          transactionDate: item.transactionDate,
          settlementDate: item.settlementDate,
          brandName: item.brandName.toUpperCase(),
          operationType: item.operationType.toUpperCase(),
          installmentNumber: item.installmentNumber || 1,
          totalInstallments: item.totalInstallments || 1,
          grossAmount: item.grossAmount,
          chargedMdrRate: item.chargedMdrRate,
          chargedFeeAmount: item.chargedFeeAmount,
          netAmount: item.netAmount,
          contractMdrRate,
          expectedFeeAmount,
          expectedNetAmount,
          divergenceAmount,
          reconciliationStatus: status,
          bankAccount: item.bankAccount || null,
          notes: item.notes || null
        });
      }

      // 3. Atualiza os totais e contadores consolidados do lote
      db.prepare(`
        UPDATE card_reconciliation_batches
        SET
          total_gross_amount = ?,
          total_net_amount = ?,
          total_fee_amount = ?,
          conciliated_count = ?,
          divergent_count = ?,
          chargeback_count = ?,
          not_found_count = ?
        WHERE id = ?
      `).run(
        totalGross,
        totalNet,
        totalFee,
        conciliatedCount,
        divergentCount,
        chargebackCount,
        notFoundCount,
        batchId
      );

      return batchId;
    });

    const createdBatchId = runInTransaction();
    const batchRow = db.prepare(`
      SELECT b.*, c.acquirer_name
      FROM card_reconciliation_batches b
      LEFT JOIN acquirer_contracts c ON c.id = b.acquirer_contract_id
      WHERE b.id = ?
    `).get(createdBatchId) as any;

    return this.mapBatchRow(batchRow);
  }

  /**
   * Obtém detalhes de um lote de conciliação com seus lançamentos.
   */
  static async getBatchDetails(
    db: Database,
    batchId: number
  ): Promise<{ batch: CardReconciliationBatch; entries: CardSettlementEntry[] }> {
    const batchRow = db.prepare(`
      SELECT b.*, c.acquirer_name
      FROM card_reconciliation_batches b
      LEFT JOIN acquirer_contracts c ON c.id = b.acquirer_contract_id
      WHERE b.id = ?
    `).get(batchId) as any;

    if (!batchRow) {
      throw new Error(`Lote de conciliação com ID ${batchId} não encontrado.`);
    }

    const entryRows = db.prepare(`
      SELECT * FROM card_settlement_entries WHERE batch_id = ? ORDER BY id ASC
    `).all(batchId) as any[];

    return {
      batch: this.mapBatchRow(batchRow),
      entries: entryRows.map(r => this.mapEntryRow(r))
    };
  }

  // --- Mapeadores de Banco de Dados ---

  private static mapContractRow(row: any): AcquirerContract {
    return {
      id: row.id,
      storeId: row.store_id,
      acquirerName: row.acquirer_name,
      acquirerCnpj: row.acquirer_cnpj,
      merchantCode: row.merchant_code,
      defaultBankName: row.default_bank_name,
      defaultBankAgency: row.default_bank_agency,
      defaultBankAccount: row.default_bank_account,
      debitSettlementDays: row.debit_settlement_days,
      creditSettlementDays: row.credit_settlement_days,
      pixSettlementDays: row.pix_settlement_days,
      isActive: row.is_active === 1,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private static mapFeeRuleRow(row: any): AcquirerFeeRule {
    return {
      id: row.id,
      contractId: row.contract_id,
      brandName: row.brand_name,
      operationType: row.operation_type as CardOperationType,
      installmentMin: row.installment_min,
      installmentMax: row.installment_max,
      mdrRate: row.mdr_rate,
      fixedFee: row.fixed_fee,
      settlementDays: row.settlement_days,
      isActive: row.is_active === 1,
      createdAt: row.created_at
    };
  }

  private static mapBatchRow(row: any): CardReconciliationBatch {
    return {
      id: row.id,
      storeId: row.store_id,
      acquirerContractId: row.acquirer_contract_id,
      acquirerName: row.acquirer_name,
      batchCode: row.batch_code,
      fileName: row.file_name,
      fileType: row.file_type,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      totalRecords: row.total_records,
      totalGrossAmount: row.total_gross_amount,
      totalNetAmount: row.total_net_amount,
      totalFeeAmount: row.total_fee_amount,
      conciliatedCount: row.conciliated_count,
      divergentCount: row.divergent_count,
      chargebackCount: row.chargeback_count,
      notFoundCount: row.not_found_count,
      status: row.status,
      processedAt: row.processed_at
    };
  }

  private static mapEntryRow(row: any): CardSettlementEntry {
    return {
      id: row.id,
      batchId: row.batch_id,
      tefTransactionId: row.tef_transaction_id,
      nsu: row.nsu,
      authorizationCode: row.authorization_code,
      transactionDate: row.transaction_date,
      settlementDate: row.settlement_date,
      brandName: row.brand_name,
      operationType: row.operation_type as CardOperationType,
      installmentNumber: row.installment_number,
      totalInstallments: row.total_installments,
      grossAmount: row.gross_amount,
      chargedMdrRate: row.charged_mdr_rate,
      chargedFeeAmount: row.charged_fee_amount,
      netAmount: row.net_amount,
      contractMdrRate: row.contract_mdr_rate,
      expectedFeeAmount: row.expected_fee_amount,
      expectedNetAmount: row.expected_net_amount,
      divergenceAmount: row.divergence_amount,
      reconciliationStatus: row.reconciliation_status as ReconciliationStatus,
      bankAccount: row.bank_account,
      notes: row.notes,
      createdAt: row.created_at
    };
  }
}
