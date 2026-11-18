/**
 * Serviço de Orquestração TEF (Transferência Eletrônica de Fundos) & Gateway de Cartões.
 * Gerencia o ciclo completo de pagamentos com PinPad:
 *   - pay: autorização no PinPad e persistência no banco
 *   - confirm: confirmação definitiva pós-emissão de NFC-e
 *   - undo: desfazimento técnico imediato por falha no checkout
 *   - cancel: cancelamento/estorno administrativo com emissão de comprovante
 *   - getReceiptText: formatação de vias do cliente e estabelecimento ESC/POS 48 colunas
 */

import { randomUUID } from 'crypto';
import type { Database } from '../../database/connection';
import { TefMockProvider } from './providers/tef-mock-provider';
import { formatTefReceipt, formatTefCancellationReceipt } from './tef-receipt-formatter';
import type {
  TefProvider,
  TefPayParams,
  TefPayResult,
  TefConfirmParams,
  TefConfirmResult,
  TefUndoParams,
  TefUndoResult,
  TefCancelParams,
  TefCancelResult,
  TefConfig,
  TefTransaction,
  TefTransactionStatus,
  TefOperationType,
  StoreInfo,
} from './types';

export interface TefListFilters {
  startDate?: string;
  endDate?: string;
  status?: TefTransactionStatus | string;
  operationType?: TefOperationType | string;
  brandName?: string;
  acquirerName?: string;
  saleId?: number;
  terminalId?: string;
  nsu?: string;
  limit?: number;
  offset?: number;
}

export class TefService {
  private customProviders = new Map<string, TefProvider>();
  private defaultProviders = new Map<string, TefProvider>();

  constructor(
    private db: Database,
    customProviders?: Map<string, TefProvider> | Record<string, TefProvider>
  ) {
    if (customProviders) {
      if (customProviders instanceof Map) {
        this.customProviders = new Map(customProviders);
      } else {
        for (const [k, v] of Object.entries(customProviders)) {
          this.customProviders.set(k, v);
        }
      }
    }

    this.initDefaultConfigs();
  }

  /**
   * Garante a inicialização das configurações padrão dos provedores TEF no SQLite.
   */
  private initDefaultConfigs(): void {
    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO tef_configs (
        provider_id, provider_name, environment, terminal_id, merchant_id, ip_address, port, is_active, credentials_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaults = [
      {
        id: 'SITEF',
        name: 'SiTef (Software Express)',
        env: 'MOCK',
        terminal: 'SE000001',
        merchant: null,
        ip: '127.0.0.1',
        port: 4096,
        active: 1,
      },
      {
        id: 'PAYGO',
        name: 'PayGo (Linx TEF)',
        env: 'MOCK',
        terminal: 'SE000001',
        merchant: null,
        ip: '127.0.0.1',
        port: 4096,
        active: 1,
      },
      {
        id: 'MOCK',
        name: 'Simulador PinPad & Adquirente FarmaCore',
        env: 'MOCK',
        terminal: 'SE000001',
        merchant: null,
        ip: '127.0.0.1',
        port: 4096,
        active: 1,
      },
    ];

    for (const d of defaults) {
      insertStmt.run(d.id, d.name, d.env, d.terminal, d.merchant, d.ip, d.port, d.active, null);
    }
  }

  /**
   * Registra um provedor customizado em memória (ex: em testes ou integrações específicas).
   */
  public registerProvider(provider: TefProvider): void {
    this.customProviders.set(provider.providerId, provider);
  }

  /**
   * Obtém a instância do provedor TEF solicitado.
   */
  public getProvider(providerId: string = 'MOCK'): TefProvider {
    if (this.customProviders.has(providerId)) {
      return this.customProviders.get(providerId)!;
    }

    if (this.defaultProviders.has(providerId)) {
      return this.defaultProviders.get(providerId)!;
    }

    // Provedor padrão: TefMockProvider (Simulador oficial de homologação e testes offline)
    const provider = new TefMockProvider();
    this.defaultProviders.set(providerId, provider);
    return provider;
  }

  /**
   * Executa a autorização TEF no PinPad e persiste a transação com status AUTHORIZED ou FAILED.
   */
  public async pay(params: TefPayParams): Promise<TefPayResult> {
    if (!params.amount || params.amount <= 0) {
      throw new Error(`Valor de pagamento inválido: R$ ${params.amount}`);
    }

    const providerId = params.providerId || 'MOCK';
    const provider = this.getProvider(providerId);
    const config = this.getConfig(providerId);
    const terminalId = params.terminalId || config?.terminalId || 'SE000001';

    const result = await provider.pay(params);

    const insertTx = this.db.prepare(`
      INSERT INTO tef_transactions (
        transaction_uuid,
        provider_id,
        terminal_id,
        sale_id,
        payment_id,
        operation_type,
        status,
        amount,
        installments,
        installment_type,
        brand_name,
        brand_code_sefaz,
        acquirer_name,
        acquirer_cnpj,
        authorization_code,
        nsu,
        host_nsu,
        card_last_four,
        customer_receipt,
        merchant_receipt,
        cancellation_receipt,
        failure_reason,
        reversal_reason,
        cancellation_nsu,
        cancellation_reason,
        mdr_rate,
        net_amount,
        expected_settlement_date,
        batch_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    if (result.success) {
      insertTx.run(
        result.transactionUuid,
        providerId,
        terminalId,
        params.saleId ?? null,
        null,
        params.operationType,
        'AUTHORIZED',
        result.amount,
        result.installments,
        params.installmentType || 'A_VISTA',
        result.brandName,
        result.brandCodeSefaz,
        result.acquirerName,
        result.acquirerCnpj,
        result.authorizationCode,
        result.nsu,
        result.hostNsu,
        result.cardLastFour || null,
        result.customerReceipt || null,
        result.merchantReceipt || null,
        null, // cancellation_receipt
        null, // failure_reason
        null, // reversal_reason
        null, // cancellation_nsu
        null, // cancellation_reason
        result.mdrRate ?? 0.0,
        result.netAmount ?? null,
        result.expectedSettlementDate ?? null,
        null // batch_number
      );
    } else {
      const fallbackNsu = result.nsu || `F${Date.now().toString().slice(-6)}`;
      insertTx.run(
        result.transactionUuid || randomUUID(),
        providerId,
        terminalId,
        params.saleId ?? null,
        null,
        params.operationType,
        'FAILED',
        params.amount,
        params.installments || 1,
        params.installmentType || 'A_VISTA',
        result.brandName || 'DESCONHECIDA',
        result.brandCodeSefaz || '99',
        result.acquirerName || 'DESCONHECIDA',
        result.acquirerCnpj || '00000000000000',
        result.authorizationCode || '000000',
        fallbackNsu,
        result.hostNsu || '000000',
        result.cardLastFour || null,
        result.customerReceipt || null,
        result.merchantReceipt || null,
        null, // cancellation_receipt
        result.errorMessage || 'Falha na autorização TEF',
        null, // reversal_reason
        null, // cancellation_nsu
        null, // cancellation_reason
        0.0,
        null,
        null,
        null
      );
    }

    return result;
  }

  /**
   * Confirma a transação TEF vinculando-a à venda finalizada no PDV e à NFC-e.
   */
  public async confirm(params: TefConfirmParams): Promise<TefConfirmResult> {
    const tx = this.getTransactionByNsu(params.nsu);
    if (!tx) {
      throw new Error(`Transação TEF não encontrada para o NSU: ${params.nsu}`);
    }

    if (tx.status === 'CONFIRMED') {
      throw new Error('Transação TEF já foi confirmada anteriormente');
    }

    if (tx.status === 'REVERSED') {
      throw new Error('Transação TEF desfeita não pode ser confirmada');
    }

    if (tx.status === 'CANCELLED') {
      throw new Error('Transação TEF cancelada não pode ser confirmada');
    }

    if (tx.status !== 'AUTHORIZED') {
      throw new Error(`Transação TEF não está autorizada para confirmação (status atual: ${tx.status})`);
    }

    const provider = this.getProvider(tx.providerId);
    const confirmResult = await provider.confirm(params);

    if (!confirmResult.success) {
      return confirmResult;
    }

    const confirmedAt = confirmResult.confirmedAt || new Date().toISOString();

    this.db.prepare(`
      UPDATE tef_transactions
      SET status = 'CONFIRMED',
          sale_id = COALESCE(?, sale_id),
          confirmed_at = ?
      WHERE id = ?
    `).run(params.saleId ?? null, confirmedAt, tx.id);

    return {
      ...confirmResult,
      confirmedAt,
    };
  }

  /**
   * Desfazimento técnico imediato (usado se checkout ou NFC-e falharem logo após autorização).
   */
  public async undo(params: TefUndoParams): Promise<TefUndoResult> {
    const tx = this.getTransactionByNsu(params.nsu);
    if (!tx) {
      throw new Error(`Transação TEF não encontrada para o NSU: ${params.nsu}`);
    }

    if (tx.status === 'REVERSED') {
      throw new Error('Transação TEF já foi desfeita anteriormente');
    }

    if (tx.status === 'CANCELLED') {
      throw new Error('Transação TEF cancelada não pode ser desfeita');
    }

    if (tx.status === 'CONFIRMED') {
      throw new Error('Transação TEF confirmada não pode ser desfeita via undo, utilize cancel');
    }

    const provider = this.getProvider(tx.providerId);
    const undoResult = await provider.undo(params);

    if (!undoResult.success) {
      return undoResult;
    }

    const reversedAt = undoResult.reversedAt || new Date().toISOString();
    const reversalReason = params.reason || undoResult.reversalReason || 'Desfazimento técnico';

    this.db.prepare(`
      UPDATE tef_transactions
      SET status = 'REVERSED',
          reversal_reason = ?,
          reversed_at = ?
      WHERE id = ?
    `).run(reversalReason, reversedAt, tx.id);

    return {
      ...undoResult,
      reversedAt,
      reversalReason,
    };
  }

  /**
   * Cancelamento administrativo de transação confirmada (estorno posterior no caixa).
   */
  public async cancel(params: TefCancelParams): Promise<TefCancelResult> {
    const tx = this.getTransactionByNsu(params.nsu);
    if (!tx) {
      throw new Error(`Transação TEF não encontrada para o NSU: ${params.nsu}`);
    }

    if (tx.status === 'CANCELLED') {
      throw new Error('Transação TEF já foi cancelada anteriormente');
    }

    if (tx.status === 'REVERSED') {
      throw new Error('Transação TEF desfeita não pode ser cancelada');
    }

    if (tx.status !== 'CONFIRMED') {
      throw new Error(`Apenas transações TEF confirmadas podem ser canceladas (status atual: ${tx.status})`);
    }

    const provider = this.getProvider(tx.providerId);
    const cancelResult = await provider.cancel(params);

    if (!cancelResult.success) {
      return cancelResult;
    }

    const cancelledAt = cancelResult.cancelledAt || new Date().toISOString();

    this.db.prepare(`
      UPDATE tef_transactions
      SET status = 'CANCELLED',
          cancellation_nsu = ?,
          cancellation_reason = ?,
          cancellation_receipt = ?,
          cancelled_at = ?
      WHERE id = ?
    `).run(
      cancelResult.cancellationNsu,
      params.reason,
      cancelResult.cancellationReceipt,
      cancelledAt,
      tx.id
    );

    return {
      ...cancelResult,
      cancelledAt,
    };
  }

  /**
   * Obtém uma transação TEF pelo NSU.
   */
  public getTransactionByNsu(nsu: string): TefTransaction | null {
    const row = this.db.prepare(`
      SELECT * FROM tef_transactions WHERE nsu = ?
    `).get(nsu) as any;

    if (!row) return null;
    return this.mapTransactionRow(row);
  }

  /**
   * Obtém uma transação TEF pelo UUID.
   */
  public getTransactionByUuid(uuid: string): TefTransaction | null {
    const row = this.db.prepare(`
      SELECT * FROM tef_transactions WHERE transaction_uuid = ?
    `).get(uuid) as any;

    if (!row) return null;
    return this.mapTransactionRow(row);
  }

  /**
   * Lista transações TEF com filtros dinâmicos e paginação.
   */
  public listTransactions(filters?: TefListFilters): { transactions: TefTransaction[]; total: number } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.startDate) {
      conditions.push('created_at >= ?');
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      const end = filters.endDate.length === 10 ? `${filters.endDate} 23:59:59` : filters.endDate;
      conditions.push('created_at <= ?');
      params.push(end);
    }

    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters?.operationType) {
      conditions.push('operation_type = ?');
      params.push(filters.operationType);
    }

    if (filters?.brandName) {
      conditions.push('UPPER(brand_name) = ?');
      params.push(filters.brandName.toUpperCase());
    }

    if (filters?.acquirerName) {
      conditions.push('UPPER(acquirer_name) = ?');
      params.push(filters.acquirerName.toUpperCase());
    }

    if (filters?.saleId != null) {
      conditions.push('sale_id = ?');
      params.push(filters.saleId);
    }

    if (filters?.terminalId) {
      conditions.push('terminal_id = ?');
      params.push(filters.terminalId);
    }

    if (filters?.nsu) {
      conditions.push('nsu = ?');
      params.push(filters.nsu);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM tef_transactions ${whereClause}
    `).get(...params) as { count: number | bigint };

    const total = Number(countRow.count);

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const rows = this.db.prepare(`
      SELECT * FROM tef_transactions ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    return {
      transactions: rows.map((r) => this.mapTransactionRow(r)),
      total,
    };
  }

  /**
   * Formata as 2 vias do comprovante TEF (Cliente e Estabelecimento) em 48 colunas ESC/POS.
   * Se a transação estiver CANCELLED, emite o comprovante oficial de cancelamento/estorno.
   */
  public getReceiptText(
    nsu: string,
    customStoreInfo?: StoreInfo
  ): {
    customerReceipt: string;
    merchantReceipt: string;
    fullEscPos: string;
  } {
    const tx = this.getTransactionByNsu(nsu);
    if (!tx) {
      throw new Error(`Transação TEF não encontrada para o NSU: ${nsu}`);
    }

    const storeInfo = customStoreInfo ?? this.getDefaultStoreInfo();

    if (tx.status === 'CANCELLED') {
      return formatTefCancellationReceipt(tx, storeInfo);
    }

    return formatTefReceipt(tx, storeInfo);
  }

  /**
   * Retorna a configuração de um provedor TEF.
   */
  public getConfig(providerId: string): TefConfig | null {
    const row = this.db.prepare(`
      SELECT * FROM tef_configs WHERE provider_id = ?
    `).get(providerId) as any;

    if (!row) return null;
    return this.mapConfigRow(row);
  }

  /**
   * Atualiza a configuração de um provedor TEF.
   */
  public updateConfig(providerId: string, updates: Partial<TefConfig>): TefConfig {
    const existing = this.getConfig(providerId);
    if (!existing) {
      throw new Error(`Configuração TEF não encontrada para o provedor: ${providerId}`);
    }

    const fields: string[] = [];
    const params: any[] = [];

    if (updates.environment !== undefined) {
      fields.push('environment = ?');
      params.push(updates.environment);
    }
    if (updates.terminalId !== undefined) {
      fields.push('terminal_id = ?');
      params.push(updates.terminalId);
    }
    if (updates.merchantId !== undefined) {
      fields.push('merchant_id = ?');
      params.push(updates.merchantId);
    }
    if (updates.ipAddress !== undefined) {
      fields.push('ip_address = ?');
      params.push(updates.ipAddress);
    }
    if (updates.port !== undefined) {
      fields.push('port = ?');
      params.push(updates.port);
    }
    if (updates.isActive !== undefined) {
      fields.push('is_active = ?');
      params.push(updates.isActive ? 1 : 0);
    }
    if (updates.credentialsJson !== undefined) {
      fields.push('credentials_json = ?');
      params.push(updates.credentialsJson);
    }

    fields.push("updated_at = datetime('now')");

    this.db.prepare(`
      UPDATE tef_configs
      SET ${fields.join(', ')}
      WHERE provider_id = ?
    `).run(...params, providerId);

    return this.getConfig(providerId)!;
  }

  /**
   * Obtém informações da drogaria a partir de fiscal_profiles ou fallback seguro.
   */
  private getDefaultStoreInfo(): StoreInfo {
    try {
      const fiscalProfile = this.db.prepare(`
        SELECT legal_name, trade_name, cnpj, state_registration, street, number, neighborhood, city, state
        FROM fiscal_profiles
        LIMIT 1
      `).get() as any;

      if (fiscalProfile) {
        const address = `${fiscalProfile.street || ''}, ${fiscalProfile.number || 'S/N'} - ${fiscalProfile.neighborhood || ''} - ${fiscalProfile.city || ''}/${fiscalProfile.state || ''}`.replace(/^, /, '').trim();
        return {
          name: fiscalProfile.trade_name || fiscalProfile.legal_name || 'FARMACORE DROGARIAS LTDA',
          cnpj: fiscalProfile.cnpj || '00.000.000/0001-91',
          ie: fiscalProfile.state_registration || '123.456.789.111',
          address: address || 'RUA DAS FARMACIAS, 123 - CENTRO',
          pharmacistName: 'FARMACEUTICO RESPONSAVEL TECNICO',
          pharmacistCrf: '12345',
          pharmacistUf: fiscalProfile.state || 'PR',
        };
      }
    } catch {
      // Se fiscal_profiles não existir ou consulta falhar, usa fallback
    }

    return {
      name: 'FARMACORE DROGARIAS LTDA',
      cnpj: '12.345.678/0001-90',
      ie: '123.456.789.111',
      address: 'RUA DAS FARMACIAS, 123 - CENTRO - CURITIBA/PR',
      pharmacistName: 'FARMACEUTICO RESPONSAVEL TECNICO',
      pharmacistCrf: '12345',
      pharmacistUf: 'PR',
    };
  }

  /**
   * Mapeia registro do banco para interface de domínio TefTransaction.
   */
  private mapTransactionRow(row: any): TefTransaction {
    return {
      id: Number(row.id),
      transactionUuid: row.transaction_uuid,
      providerId: row.provider_id,
      terminalId: row.terminal_id,
      saleId: row.sale_id != null ? Number(row.sale_id) : null,
      paymentId: row.payment_id != null ? Number(row.payment_id) : null,
      operationType: row.operation_type,
      status: row.status,
      amount: Number(row.amount),
      installments: Number(row.installments),
      installmentType: row.installment_type,
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
      mdrRate: row.mdr_rate != null ? Number(row.mdr_rate) : undefined,
      netAmount: row.net_amount != null ? Number(row.net_amount) : null,
      expectedSettlementDate: row.expected_settlement_date,
      batchNumber: row.batch_number,
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at,
      reversedAt: row.reversed_at,
      cancelledAt: row.cancelled_at,
    };
  }

  /**
   * Mapeia registro do banco para interface de domínio TefConfig.
   */
  private mapConfigRow(row: any): TefConfig {
    return {
      id: Number(row.id),
      providerId: row.provider_id,
      providerName: row.provider_name,
      environment: row.environment,
      terminalId: row.terminal_id,
      merchantId: row.merchant_id,
      ipAddress: row.ip_address,
      port: row.port != null ? Number(row.port) : undefined,
      isActive: Number(row.is_active),
      credentialsJson: row.credentials_json,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
