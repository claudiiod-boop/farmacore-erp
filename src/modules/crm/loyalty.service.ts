// FarmaCore ERP — Serviço de Carteira de Fidelidade e Motor de Cashback (Fase 12)
import { getDatabase, Database } from '../../database/connection';
import type {
  LoyaltyProgram,
  UpdateLoyaltyProgramInput,
  LoyaltyWallet,
  LoyaltyTransaction,
  CashbackCreditInput,
  CashbackRedeemInput,
  WalletStatement,
  ExpireCashbackResult,
} from './types';

export class LoyaltyError extends Error {
  constructor(public code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'LoyaltyError';
  }
}

function round2(val: number): number {
  return Number(val.toFixed(2));
}

export class LoyaltyService {
  constructor(private db: Database = getDatabase()) {}

  /**
   * Mapeia linha do banco de dados para a interface de domínio LoyaltyProgram
   */
  private mapLoyaltyProgram(row: any): LoyaltyProgram {
    return {
      id: row.id,
      storeId: row.store_id ?? null,
      name: row.name,
      cashbackPercent: Number(row.cashback_percent),
      validityDays: Number(row.validity_days),
      minPurchaseAmount: Number(row.min_purchase_amount),
      minRedeemAmount: Number(row.min_redeem_amount),
      maxRedeemPercent: Number(row.max_redeem_percent),
      allowWithPromotions: Boolean(row.allow_with_promotions),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,

      // DB compatibility aliases
      store_id: row.store_id ?? null,
      cashback_percent: Number(row.cashback_percent),
      validity_days: Number(row.validity_days),
      min_purchase_amount: Number(row.min_purchase_amount),
      min_redeem_amount: Number(row.min_redeem_amount),
      max_redeem_percent: Number(row.max_redeem_percent),
      allow_with_promotions: row.allow_with_promotions,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Mapeia linha do banco de dados para a interface de domínio LoyaltyWallet
   */
  private mapLoyaltyWallet(row: any): LoyaltyWallet {
    return {
      id: row.id,
      customerId: row.customer_id,
      currentBalance: Number(row.current_balance),
      totalEarned: Number(row.total_earned),
      totalRedeemed: Number(row.total_redeemed),
      totalExpired: Number(row.total_expired),
      lastActivityAt: row.last_activity_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,

      // DB compatibility aliases
      customer_id: row.customer_id,
      current_balance: Number(row.current_balance),
      total_earned: Number(row.total_earned),
      total_redeemed: Number(row.total_redeemed),
      total_expired: Number(row.total_expired),
      last_activity_at: row.last_activity_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Mapeia linha do banco de dados para a interface de domínio LoyaltyTransaction
   */
  private mapLoyaltyTransaction(row: any): LoyaltyTransaction {
    return {
      id: row.id,
      walletId: row.wallet_id,
      saleId: row.sale_id ?? null,
      type: row.type,
      amount: Number(row.amount),
      balanceAfter: Number(row.balance_after),
      expiresAt: row.expires_at ?? null,
      notes: row.notes ?? null,
      createdAt: row.created_at,

      // DB compatibility aliases
      wallet_id: row.wallet_id,
      sale_id: row.sale_id ?? null,
      balance_after: Number(row.balance_after),
      expires_at: row.expires_at ?? null,
      created_at: row.created_at,
    };
  }

  /**
   * Busca configuração do programa de fidelidade ativo por filial ou globalmente
   */
  getProgramConfig(storeId?: number): LoyaltyProgram {
    if (storeId !== undefined) {
      const storeProg = this.db
        .prepare('SELECT * FROM loyalty_programs WHERE store_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1')
        .get(storeId) as any;
      if (storeProg) {
        return this.mapLoyaltyProgram(storeProg);
      }
    }

    // Fallback: programa global (sem store_id ou padrão id = 1)
    const globalProg = this.db
      .prepare('SELECT * FROM loyalty_programs WHERE store_id IS NULL AND is_active = 1 ORDER BY id ASC LIMIT 1')
      .get() as any;
    if (globalProg) {
      return this.mapLoyaltyProgram(globalProg);
    }

    const fallbackProg = this.db
      .prepare('SELECT * FROM loyalty_programs WHERE id = 1 OR is_active = 1 ORDER BY id ASC LIMIT 1')
      .get() as any;
    if (fallbackProg) {
      return this.mapLoyaltyProgram(fallbackProg);
    }

    throw new LoyaltyError('PROGRAM_NOT_FOUND', 'Nenhum programa de fidelidade configurado no sistema');
  }

  /**
   * Atualiza ou cadastra configuração de programa de fidelidade
   */
  updateProgramConfig(input: UpdateLoyaltyProgramInput & { id?: number; storeId?: number | null }): LoyaltyProgram {
    const name = input.name;
    const cashbackPercent = input.cashbackPercent ?? input.cashback_percent;
    const validityDays = input.validityDays ?? input.validity_days;
    const minPurchaseAmount = input.minPurchaseAmount ?? input.min_purchase_amount;
    const minRedeemAmount = input.minRedeemAmount ?? input.min_redeem_amount;
    const maxRedeemPercent = input.maxRedeemPercent ?? input.max_redeem_percent;
    const allowWithPromotions = input.allowWithPromotions ?? input.allow_with_promotions;
    const isActive = input.isActive ?? input.is_active;
    const storeId = input.storeId !== undefined ? input.storeId : input.store_id;

    // Validações de limites de parâmetros
    if (cashbackPercent !== undefined && (cashbackPercent < 0 || cashbackPercent > 100)) {
      throw new LoyaltyError('INVALID_PROGRAM_CONFIG', 'O percentual de cashback deve estar entre 0% e 100%');
    }
    if (validityDays !== undefined && validityDays <= 0) {
      throw new LoyaltyError('INVALID_PROGRAM_CONFIG', 'A validade em dias deve ser maior que zero');
    }
    if (minPurchaseAmount !== undefined && minPurchaseAmount < 0) {
      throw new LoyaltyError('INVALID_PROGRAM_CONFIG', 'O valor mínimo de compra não pode ser negativo');
    }
    if (minRedeemAmount !== undefined && minRedeemAmount < 0) {
      throw new LoyaltyError('INVALID_PROGRAM_CONFIG', 'O valor mínimo de resgate não pode ser negativo');
    }
    if (maxRedeemPercent !== undefined && (maxRedeemPercent <= 0 || maxRedeemPercent > 100)) {
      throw new LoyaltyError('INVALID_PROGRAM_CONFIG', 'O teto de resgate deve estar entre 0.01% e 100%');
    }

    let existing: any = null;

    if (input.id) {
      existing = this.db.prepare('SELECT * FROM loyalty_programs WHERE id = ?').get(input.id);
    } else if (storeId !== undefined) {
      existing = this.db.prepare('SELECT * FROM loyalty_programs WHERE store_id = ?').get(storeId);
    } else {
      existing = this.db.prepare('SELECT * FROM loyalty_programs WHERE store_id IS NULL OR id = 1 LIMIT 1').get();
    }

    if (!existing) {
      // Criação de nova configuração para a loja
      const res = this.db
        .prepare(
          `INSERT INTO loyalty_programs (
            store_id, name, cashback_percent, validity_days, min_purchase_amount, min_redeem_amount,
            max_redeem_percent, allow_with_promotions, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        )
        .run(
          storeId ?? null,
          name || 'Programa Fidelidade',
          cashbackPercent !== undefined ? cashbackPercent : 3.0,
          validityDays !== undefined ? validityDays : 90,
          minPurchaseAmount !== undefined ? minPurchaseAmount : 10.0,
          minRedeemAmount !== undefined ? minRedeemAmount : 5.0,
          maxRedeemPercent !== undefined ? maxRedeemPercent : 50.0,
          allowWithPromotions !== undefined ? (allowWithPromotions ? 1 : 0) : 1,
          isActive !== undefined ? (isActive ? 1 : 0) : 1
        );

      const created = this.db.prepare('SELECT * FROM loyalty_programs WHERE id = ?').get(res.lastInsertRowid);
      return this.mapLoyaltyProgram(created);
    }

    // Atualização do registro existente
    const newName = name !== undefined ? name : existing.name;
    const newPercent = cashbackPercent !== undefined ? cashbackPercent : existing.cashback_percent;
    const newValidity = validityDays !== undefined ? validityDays : existing.validity_days;
    const newMinPurchase = minPurchaseAmount !== undefined ? minPurchaseAmount : existing.min_purchase_amount;
    const newMinRedeem = minRedeemAmount !== undefined ? minRedeemAmount : existing.min_redeem_amount;
    const newMaxRedeem = maxRedeemPercent !== undefined ? maxRedeemPercent : existing.max_redeem_percent;
    const newAllowWithPromos =
      allowWithPromotions !== undefined ? (allowWithPromotions ? 1 : 0) : existing.allow_with_promotions;
    const newIsActive = isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active;

    this.db
      .prepare(
        `UPDATE loyalty_programs SET
          name = ?,
          cashback_percent = ?,
          validity_days = ?,
          min_purchase_amount = ?,
          min_redeem_amount = ?,
          max_redeem_percent = ?,
          allow_with_promotions = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
      )
      .run(
        newName,
        newPercent,
        newValidity,
        newMinPurchase,
        newMinRedeem,
        newMaxRedeem,
        newAllowWithPromos,
        newIsActive,
        existing.id
      );

    const updated = this.db.prepare('SELECT * FROM loyalty_programs WHERE id = ?').get(existing.id);
    return this.mapLoyaltyProgram(updated);
  }

  /**
   * Busca carteira existente do cliente ou cria uma nova com saldo zero
   */
  getOrCreateWallet(customerId: number): LoyaltyWallet {
    const customer = this.db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      throw new LoyaltyError('CUSTOMER_NOT_FOUND', `Cliente ID ${customerId} não encontrado`);
    }

    let walletRow = this.db.prepare('SELECT * FROM loyalty_wallets WHERE customer_id = ?').get(customerId) as any;

    if (!walletRow) {
      const info = this.db
        .prepare(
          `INSERT INTO loyalty_wallets (
            customer_id, current_balance, total_earned, total_redeemed, total_expired, created_at, updated_at
          ) VALUES (?, 0.0, 0.0, 0.0, 0.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        )
        .run(customerId);

      walletRow = this.db.prepare('SELECT * FROM loyalty_wallets WHERE id = ?').get(info.lastInsertRowid);
    }

    return this.mapLoyaltyWallet(walletRow);
  }

  /**
   * Calcula valor de cashback com arredondamento de centavos
   * Retorna 0 se o valor de compra for inferior ao mínimo exigido
   */
  calculateCashback(amount: number, storeId?: number): number {
    if (amount <= 0) return 0;

    const config = this.getProgramConfig(storeId);
    if (!config.isActive) return 0;
    if (amount < config.minPurchaseAmount) return 0;

    return round2((amount * config.cashbackPercent) / 100);
  }

  /**
   * Credita cashback sobre uma venda concluída
   * Suporta input como objeto CashbackCreditInput ou parâmetros posicionais
   */
  creditCashback(
    inputOrSaleId: CashbackCreditInput | number,
    customerIdParam?: number,
    saleAmountParam?: number,
    storeIdParam?: number,
    notesParam?: string
  ): LoyaltyTransaction | null {
    let saleId: number | null = null;
    let customerId: number;
    let saleAmount: number;
    let notes: string | undefined;
    let storeId: number | undefined;

    if (typeof inputOrSaleId === 'object') {
      saleId = inputOrSaleId.saleId;
      customerId = inputOrSaleId.customerId;
      saleAmount = inputOrSaleId.saleAmount;
      notes = inputOrSaleId.notes;
      storeId = customerIdParam;
    } else {
      saleId = inputOrSaleId;
      customerId = customerIdParam!;
      saleAmount = saleAmountParam!;
      storeId = storeIdParam;
      notes = notesParam;
    }

    const customer = this.db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      throw new LoyaltyError('CUSTOMER_NOT_FOUND', `Cliente ID ${customerId} não encontrado`);
    }

    const config = this.getProgramConfig(storeId);
    if (!config.isActive || saleAmount < config.minPurchaseAmount) {
      return null;
    }

    const cashbackAmount = this.calculateCashback(saleAmount, storeId);
    if (cashbackAmount <= 0) {
      return null;
    }

    return this.db.transaction(() => {
      const wallet = this.getOrCreateWallet(customerId);

      // Calcula data de expiração (hoje + validade em dias)
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + config.validityDays);
      const expiresAt = expDate.toISOString();

      const newBalance = round2(wallet.currentBalance + cashbackAmount);
      const newTotalEarned = round2(wallet.totalEarned + cashbackAmount);

      this.db
        .prepare(
          `UPDATE loyalty_wallets SET
            current_balance = ?,
            total_earned = ?,
            last_activity_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`
        )
        .run(newBalance, newTotalEarned, wallet.id);

      const txInfo = this.db
        .prepare(
          `INSERT INTO loyalty_transactions (
            wallet_id, sale_id, type, amount, balance_after, expires_at, notes, created_at
          ) VALUES (?, ?, 'EARN', ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        )
        .run(
          wallet.id,
          saleId,
          cashbackAmount,
          newBalance,
          expiresAt,
          notes || 'Crédito de cashback referente a compra'
        );

      const txRow = this.db.prepare('SELECT * FROM loyalty_transactions WHERE id = ?').get(txInfo.lastInsertRowid);
      return this.mapLoyaltyTransaction(txRow);
    })();
  }

  /**
   * Resgata cashback para pagamento parcial de venda
   * Suporta input como objeto CashbackRedeemInput ou parâmetros posicionais
   */
  redeemCashback(
    inputOrCustomerId: CashbackRedeemInput | number,
    saleAmountParam?: number,
    requestedRedeemParam?: number,
    saleIdParam?: number,
    storeIdParam?: number,
    notesParam?: string
  ): LoyaltyTransaction {
    let customerId: number;
    let saleAmount: number;
    let requestedRedeem: number;
    let saleId: number | null = null;
    let notes: string | undefined;
    let storeId: number | undefined;

    if (typeof inputOrCustomerId === 'object') {
      customerId = inputOrCustomerId.customerId;
      saleAmount = inputOrCustomerId.saleAmount;
      requestedRedeem = inputOrCustomerId.requestedRedeem;
      saleId = inputOrCustomerId.saleId ?? null;
      notes = inputOrCustomerId.notes;
      storeId = saleAmountParam;
    } else {
      customerId = inputOrCustomerId;
      saleAmount = saleAmountParam!;
      requestedRedeem = requestedRedeemParam!;
      saleId = saleIdParam ?? null;
      storeId = storeIdParam;
      notes = notesParam;
    }

    // 1. Validação do valor solicitado
    if (requestedRedeem <= 0) {
      throw new LoyaltyError('INVALID_REDEEM_AMOUNT', 'Valor de resgate deve ser maior que zero');
    }

    // 2. Validação de existência do cliente
    const customer = this.db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      throw new LoyaltyError('CUSTOMER_NOT_FOUND', `Cliente ID ${customerId} não encontrado`);
    }

    const config = this.getProgramConfig(storeId);

    // 3. Validação do mínimo de resgate
    if (requestedRedeem < config.minRedeemAmount) {
      throw new LoyaltyError(
        'BELOW_MINIMUM_REDEEM',
        `Valor de resgate (R$ ${requestedRedeem.toFixed(2)}) é inferior ao mínimo permitido de R$ ${config.minRedeemAmount.toFixed(2)}`
      );
    }

    // 4. Validação do teto percentual sobre o valor da compra
    const maxAllowed = round2((saleAmount * config.maxRedeemPercent) / 100);
    if (requestedRedeem > maxAllowed) {
      throw new LoyaltyError(
        'EXCEEDS_MAX_REDEEM_PERCENT',
        `Valor de resgate (R$ ${requestedRedeem.toFixed(2)}) excede o teto permitido de ${config.maxRedeemPercent}% da compra (R$ ${maxAllowed.toFixed(2)})`
      );
    }

    // 5. Validação de saldo da carteira
    const wallet = this.getOrCreateWallet(customerId);
    if (wallet.currentBalance < requestedRedeem) {
      throw new LoyaltyError(
        'INSUFFICIENT_BALANCE',
        `Saldo insuficiente. Saldo disponível: R$ ${wallet.currentBalance.toFixed(2)}, solicitado: R$ ${requestedRedeem.toFixed(2)}`
      );
    }

    return this.db.transaction(() => {
      const newBalance = round2(wallet.currentBalance - requestedRedeem);
      const newTotalRedeemed = round2(wallet.totalRedeemed + requestedRedeem);

      this.db
        .prepare(
          `UPDATE loyalty_wallets SET
            current_balance = ?,
            total_redeemed = ?,
            last_activity_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`
        )
        .run(newBalance, newTotalRedeemed, wallet.id);

      const txInfo = this.db
        .prepare(
          `INSERT INTO loyalty_transactions (
            wallet_id, sale_id, type, amount, balance_after, expires_at, notes, created_at
          ) VALUES (?, ?, 'REDEEM', ?, ?, NULL, ?, CURRENT_TIMESTAMP)`
        )
        .run(
          wallet.id,
          saleId,
          requestedRedeem,
          newBalance,
          notes || 'Resgate de cashback em compra'
        );

      const txRow = this.db.prepare('SELECT * FROM loyalty_transactions WHERE id = ?').get(txInfo.lastInsertRowid);
      return this.mapLoyaltyTransaction(txRow);
    })();
  }

  /**
   * Consulta extrato completo da carteira e histórico de transações ordenado cronologicamente (decrescente)
   */
  getWalletStatement(customerId: number): WalletStatement {
    const customer = this.db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      throw new LoyaltyError('CUSTOMER_NOT_FOUND', `Cliente ID ${customerId} não encontrado`);
    }

    const wallet = this.getOrCreateWallet(customerId);
    const rows = this.db
      .prepare('SELECT * FROM loyalty_transactions WHERE wallet_id = ? ORDER BY created_at DESC, id DESC')
      .all(wallet.id) as any[];

    return {
      wallet,
      transactions: rows.map((r) => this.mapLoyaltyTransaction(r)),
    };
  }

  /**
   * Job de expiração automática de créditos vencidos
   * Expira créditos cujas transações EARN ultrapassaram o expires_at
   */
  expireOverdueCashback(referenceDate?: Date | string): ExpireCashbackResult {
    const refIso = referenceDate
      ? typeof referenceDate === 'string'
        ? referenceDate
        : referenceDate.toISOString()
      : new Date().toISOString();

    return this.db.transaction(() => {
      // Localiza transações EARN que já venceram e ainda não foram processadas por expiração
      const overdueTxs = this.db
        .prepare(
          `SELECT lt.*
           FROM loyalty_transactions lt
           WHERE lt.type = 'EARN'
             AND lt.expires_at IS NOT NULL
             AND datetime(lt.expires_at) <= datetime(?)
             AND (lt.notes IS NULL OR lt.notes NOT LIKE '%[EXPIRED_PROCESSED]%')
             AND NOT EXISTS (
               SELECT 1 FROM loyalty_transactions let
               WHERE let.wallet_id = lt.wallet_id
                 AND let.type = 'EXPIRE'
                 AND let.notes LIKE '%[EXPIRED_TX:' || lt.id || ']%'
             )
           ORDER BY lt.expires_at ASC, lt.id ASC`
        )
        .all(refIso) as any[];

      let expiredCount = 0;
      let totalAmount = 0;

      for (const earnTx of overdueTxs) {
        const walletRow = this.db
          .prepare('SELECT * FROM loyalty_wallets WHERE id = ?')
          .get(earnTx.wallet_id) as any;

        if (!walletRow) continue;

        const currentBalance = Number(walletRow.current_balance);
        const toExpire = round2(Math.min(currentBalance, Number(earnTx.amount)));

        if (toExpire > 0) {
          const newBalance = round2(currentBalance - toExpire);
          const newTotalExpired = round2(Number(walletRow.total_expired) + toExpire);

          this.db
            .prepare(
              `UPDATE loyalty_wallets SET
                current_balance = ?,
                total_expired = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`
            )
            .run(newBalance, newTotalExpired, walletRow.id);

          this.db
            .prepare(
              `INSERT INTO loyalty_transactions (
                wallet_id, sale_id, type, amount, balance_after, expires_at, notes, created_at
              ) VALUES (?, NULL, 'EXPIRE', ?, ?, NULL, ?, CURRENT_TIMESTAMP)`
            )
            .run(
              walletRow.id,
              toExpire,
              newBalance,
              `[EXPIRED_TX:${earnTx.id}] Expiração de cashback vencido em ${earnTx.expires_at}`
            );

          expiredCount++;
          totalAmount = round2(totalAmount + toExpire);
        } else {
          // Saldo da carteira já foi consumido anteriormente; apenas marca a transação como processada
          this.db
            .prepare(`UPDATE loyalty_transactions SET notes = COALESCE(notes, '') || ' [EXPIRED_PROCESSED]' WHERE id = ?`)
            .run(earnTx.id);
        }
      }

      return {
        expiredCount,
        totalAmount,
      };
    })();
  }
}
