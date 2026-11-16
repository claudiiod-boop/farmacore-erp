/**
 * Serviço de Integração PBM e Farmácia Popular do Brasil.
 * Orquestra autorizações, confirmações fiscais, cancelamentos, persistência em SQLite
 * e emissão de cupom vinculado no padrão de 48 colunas ESC/POS (Denasus / Portaria MS nº 184/2011).
 */

import type { Database } from '../../database/connection';
import { DatasusMockProvider } from './providers/datasus-mock-provider';
import { DatasusSoapProvider, DatasusSoapConfig } from './providers/datasus-soap-provider';
import { formatPbmReceipt } from './pbm-receipt-formatter';
import type {
  PbmProvider,
  PbmAuthorizeParams,
  PbmAuthorizationResult,
  PbmConfirmParams,
  PbmConfirmResult,
  PbmCancelResult,
  PbmTransaction,
  PbmTransactionItem,
  PbmConfig,
  StoreInfo,
} from './types';

export class PbmService {
  private customProviders = new Map<string, PbmProvider>();
  private defaultProviders = new Map<string, PbmProvider>();

  constructor(
    private db: Database,
    customProviders?: Map<string, PbmProvider> | Record<string, PbmProvider>
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
   * Garante a inicialização das configurações padrão dos provedores no banco de dados.
   */
  private initDefaultConfigs(): void {
    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO pbm_configs (
        provider_id, provider_name, environment, is_active, credentials_json
      ) VALUES (?, ?, ?, ?, ?)
    `);

    const defaults = [
      { id: 'FARMACIA_POPULAR', name: 'Farmácia Popular do Brasil', env: 'MOCK', active: 1 },
      { id: 'VIDALINK', name: 'Vidalink Farmácia', env: 'MOCK', active: 1 },
      { id: 'EPHARMA', name: 'ePharma Saúde', env: 'MOCK', active: 1 },
      { id: 'FUNCIONAL', name: 'Funcional Card', env: 'MOCK', active: 1 },
    ];

    for (const d of defaults) {
      insertStmt.run(d.id, d.name, d.env, d.active, null);
    }
  }

  /**
   * Registra um provedor customizado em memória (ex: para testes ou extensões).
   */
  public registerProvider(provider: PbmProvider): void {
    this.customProviders.set(provider.providerId, provider);
  }

  /**
   * Resolve o provedor com base na configuração do banco e no ID solicitado.
   */
  public getProvider(providerId: string = 'FARMACIA_POPULAR'): PbmProvider {
    if (this.customProviders.has(providerId)) {
      return this.customProviders.get(providerId)!;
    }

    const config = this.getConfig(providerId);
    const environment = config?.environment ?? 'MOCK';
    const cacheKey = `${providerId}:${environment}`;

    if (this.defaultProviders.has(cacheKey)) {
      return this.defaultProviders.get(cacheKey)!;
    }

    let provider: PbmProvider;

    if (providerId === 'FARMACIA_POPULAR') {
      if (environment === 'HOMOLOGACAO' || environment === 'PRODUCAO') {
        let soapConfig: Partial<DatasusSoapConfig> = { environment };
        if (config?.credentialsJson) {
          try {
            const parsed = JSON.parse(config.credentialsJson);
            soapConfig = { ...soapConfig, ...parsed, environment };
          } catch {
            // Usa configuração básica caso json seja inválido
          }
        }
        provider = new DatasusSoapProvider(soapConfig);
      } else {
        provider = new DatasusMockProvider();
      }
    } else {
      provider = new DatasusMockProvider();
    }

    this.defaultProviders.set(cacheKey, provider);
    return provider;
  }

  /**
   * Executa a autorização prévia junto ao provedor e grava atomicamente no SQLite.
   */
  public async authorize(params: PbmAuthorizeParams): Promise<PbmAuthorizationResult> {
    const providerId = params.providerId || 'FARMACIA_POPULAR';
    const provider = this.getProvider(providerId);

    const result = await provider.authorize(params);
    if (!result.success) {
      return result;
    }

    const insertTx = this.db.prepare(`
      INSERT INTO pbm_transactions (
        transaction_uuid,
        provider_id,
        authorization_protocol,
        receipt_number,
        status,
        patient_cpf,
        patient_name,
        patient_birth_date,
        doctor_crm,
        doctor_uf,
        doctor_name,
        prescription_date,
        proxy_name,
        proxy_cpf,
        total_gross_amount,
        subsidy_amount,
        patient_copay_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = this.db.prepare(`
      INSERT INTO pbm_transaction_items (
        pbm_transaction_id,
        product_id,
        batch_id,
        ean,
        ms_registration,
        product_name,
        daily_dose,
        authorized_quantity,
        unit_gross_price,
        total_gross_price,
        reference_unit_price,
        subsidy_unit_price,
        subsidy_total_price,
        patient_unit_price,
        patient_total_price,
        program_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const persistAtomic = this.db.transaction(() => {
      const txRes = insertTx.run(
        result.transactionUuid,
        providerId,
        result.authorizationProtocol,
        null,
        'AUTHORIZED',
        params.patientCpf,
        params.patientName,
        params.patientBirthDate ?? null,
        params.doctorCrm,
        params.doctorUf,
        params.doctorName ?? null,
        params.prescriptionDate,
        params.proxyName ?? null,
        params.proxyCpf ?? null,
        result.totalGrossAmount,
        result.subsidyAmount,
        result.patientCopayAmount
      );

      const transactionId = Number(txRes.lastInsertRowid);

      for (const item of result.items) {
        insertItem.run(
          transactionId,
          item.productId,
          item.batchId ?? null,
          item.ean,
          item.msRegistration,
          item.productName,
          item.dailyDose ?? 1.0,
          item.authorizedQuantity,
          item.unitGrossPrice,
          item.totalGrossPrice,
          item.referenceUnitPrice,
          item.subsidyUnitPrice,
          item.subsidyTotalPrice,
          item.patientUnitPrice,
          item.patientTotalPrice,
          item.programType
        );
      }
    });

    persistAtomic();

    return result;
  }

  /**
   * Confirma a autorização vinculando-a à venda do PDV e dados fiscais da NFC-e.
   */
  public async confirm(params: PbmConfirmParams): Promise<PbmConfirmResult> {
    const row = this.db.prepare(`
      SELECT * FROM pbm_transactions WHERE authorization_protocol = ?
    `).get(params.authorizationProtocol) as any;

    if (!row) {
      throw new Error(`Transação PBM não encontrada para o protocolo: ${params.authorizationProtocol}`);
    }

    if (row.status === 'CONFIRMED') {
      throw new Error('Transação PBM já foi confirmada anteriormente');
    }

    if (row.status === 'CANCELLED') {
      throw new Error('Transação PBM cancelada não pode ser confirmada');
    }

    if (row.status !== 'AUTHORIZED') {
      throw new Error(`Transação PBM não está com status AUTHORIZED (status atual: ${row.status})`);
    }

    const provider = this.getProvider(row.provider_id);
    const confirmResult = await provider.confirm(params);

    if (!confirmResult.success) {
      return confirmResult;
    }

    const confirmedAt = confirmResult.confirmedAt || new Date().toISOString();
    const receiptNumber = confirmResult.receiptNumber;

    const updateStmt = this.db.prepare(`
      UPDATE pbm_transactions
      SET status = 'CONFIRMED',
          sale_id = ?,
          receipt_number = ?,
          fiscal_key_nfce = ?,
          nfce_number = ?,
          confirmed_at = ?
      WHERE id = ?
    `);

    updateStmt.run(
      params.saleId ?? null,
      receiptNumber ?? null,
      params.fiscalKeyNfce ?? null,
      params.nfceNumber ?? null,
      confirmedAt,
      row.id
    );

    return confirmResult;
  }

  /**
   * Cancela uma autorização PBM e registra a justificativa e protocolo de estorno.
   */
  public async cancel(protocol: string, reason: string): Promise<PbmCancelResult> {
    const row = this.db.prepare(`
      SELECT * FROM pbm_transactions WHERE authorization_protocol = ?
    `).get(protocol) as any;

    if (!row) {
      throw new Error(`Transação PBM não encontrada para o protocolo: ${protocol}`);
    }

    if (row.status === 'CANCELLED') {
      throw new Error('Transação PBM já se encontra cancelada');
    }

    const provider = this.getProvider(row.provider_id);
    const cancelResult = await provider.cancel(protocol, reason);

    if (!cancelResult.success) {
      return cancelResult;
    }

    const cancelledAt = new Date().toISOString();
    const cancellationProtocol = cancelResult.cancellationProtocol || `CANC-${protocol}`;

    this.db.prepare(`
      UPDATE pbm_transactions
      SET status = 'CANCELLED',
          cancellation_reason = ?,
          cancellation_protocol = ?,
          cancelled_at = ?
      WHERE id = ?
    `).run(reason, cancellationProtocol, cancelledAt, row.id);

    return {
      ...cancelResult,
      cancellationProtocol,
    };
  }

  /**
   * Obtém os detalhes completos de uma transação e seus itens pelo protocolo.
   */
  public getTransactionByProtocol(protocol: string): {
    transaction: PbmTransaction;
    items: PbmTransactionItem[];
  } | null {
    const txRow = this.db.prepare(`
      SELECT * FROM pbm_transactions WHERE authorization_protocol = ?
    `).get(protocol) as any;

    if (!txRow) {
      return null;
    }

    const itemRows = this.db.prepare(`
      SELECT * FROM pbm_transaction_items WHERE pbm_transaction_id = ? ORDER BY id ASC
    `).all(txRow.id) as any[];

    return {
      transaction: this.mapTransactionRow(txRow),
      items: itemRows.map((r) => this.mapItemRow(r)),
    };
  }

  /**
   * Lista transações PBM com filtros dinâmicos e paginação.
   */
  public listTransactions(filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    patientCpf?: string;
    limit?: number;
    offset?: number;
  }): { transactions: PbmTransaction[]; total: number } {
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

    if (filters?.patientCpf) {
      const cleanCpf = filters.patientCpf.replace(/\D/g, '');
      conditions.push("(patient_cpf = ? OR REPLACE(REPLACE(patient_cpf, '.', ''), '-', '') = ?)");
      params.push(filters.patientCpf, cleanCpf);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM pbm_transactions ${whereClause}
    `).get(...params) as { count: number | bigint };

    const total = Number(countRow.count);

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const rows = this.db.prepare(`
      SELECT * FROM pbm_transactions ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    return {
      transactions: rows.map((r) => this.mapTransactionRow(r)),
      total,
    };
  }

  /**
   * Gera o texto formatado do cupom vinculado ESC/POS 48 colunas (1ª e 2ª vias).
   */
  public getReceiptText(
    protocol: string,
    customStoreInfo?: StoreInfo
  ): {
    consumerCopy: string;
    storeCopy: string;
    fullEscPos: string;
  } {
    const txRow = this.db.prepare(`
      SELECT * FROM pbm_transactions WHERE authorization_protocol = ?
    `).get(protocol) as any;

    if (!txRow) {
      throw new Error(`Transação PBM não encontrada para emissão de cupom: ${protocol}`);
    }

    const transaction = this.mapTransactionRow(txRow);

    const itemRows = this.db.prepare(`
      SELECT i.*, b.batch_number
      FROM pbm_transaction_items i
      LEFT JOIN batches b ON b.id = i.batch_id
      WHERE i.pbm_transaction_id = ?
      ORDER BY i.id ASC
    `).all(txRow.id) as any[];

    const items = itemRows.map((r) => ({
      ...this.mapItemRow(r),
      batchNumber: r.batch_number ?? undefined,
    }));

    const storeInfo = customStoreInfo ?? this.getDefaultStoreInfo();

    return formatPbmReceipt(transaction, items, storeInfo);
  }

  /**
   * Obtém informações padrão da drogaria a partir do perfil fiscal ou fallback seguro.
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
   * Retorna a configuração de um provedor cadastrado.
   */
  public getConfig(providerId: string): PbmConfig | null {
    const stmt = this.db.prepare(`
      SELECT id, provider_id, provider_name, environment, is_active, credentials_json, created_at, updated_at
      FROM pbm_configs
      WHERE provider_id = ?
    `);
    const row = stmt.get(providerId) as any;
    if (!row) return null;
    return {
      id: Number(row.id),
      providerId: row.provider_id,
      providerName: row.provider_name,
      environment: row.environment,
      isActive: Number(row.is_active),
      credentialsJson: row.credentials_json,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Atualiza a configuração de um provedor.
   */
  public updateConfig(providerId: string, updates: Partial<PbmConfig>): PbmConfig {
    const current = this.getConfig(providerId);
    if (!current) {
      throw new Error(`Configuração do provedor PBM '${providerId}' não encontrada`);
    }

    const newName = updates.providerName ?? current.providerName;
    const newEnv = updates.environment ?? current.environment;
    const newActive = updates.isActive ?? current.isActive;
    const newCreds = updates.credentialsJson !== undefined ? updates.credentialsJson : current.credentialsJson;

    this.db.prepare(`
      UPDATE pbm_configs
      SET provider_name = ?,
          environment = ?,
          is_active = ?,
          credentials_json = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE provider_id = ?
    `).run(newName, newEnv, newActive, newCreds, providerId);

    // Invalida cache de instâncias de provedores
    this.defaultProviders.clear();

    return this.getConfig(providerId)!;
  }

  /**
   * Lista todas as configurações de provedores.
   */
  public listConfigs(onlyActive = false): PbmConfig[] {
    const sql = onlyActive
      ? `SELECT * FROM pbm_configs WHERE is_active = 1 ORDER BY id ASC`
      : `SELECT * FROM pbm_configs ORDER BY id ASC`;
    const rows = this.db.prepare(sql).all() as any[];
    return rows.map((row) => ({
      id: Number(row.id),
      providerId: row.provider_id,
      providerName: row.provider_name,
      environment: row.environment,
      isActive: Number(row.is_active),
      credentialsJson: row.credentials_json,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private mapTransactionRow(row: any): PbmTransaction {
    return {
      id: Number(row.id),
      transactionUuid: row.transaction_uuid,
      providerId: row.provider_id,
      saleId: row.sale_id != null ? Number(row.sale_id) : null,
      authorizationProtocol: row.authorization_protocol,
      receiptNumber: row.receipt_number,
      status: row.status,
      patientCpf: row.patient_cpf,
      patientName: row.patient_name,
      patientBirthDate: row.patient_birth_date,
      doctorCrm: row.doctor_crm,
      doctorUf: row.doctor_uf,
      doctorName: row.doctor_name,
      prescriptionDate: row.prescription_date,
      proxyName: row.proxy_name,
      proxyCpf: row.proxy_cpf,
      fiscalKeyNfce: row.fiscal_key_nfce,
      nfceNumber: row.nfce_number != null ? Number(row.nfce_number) : null,
      totalGrossAmount: Number(row.total_gross_amount),
      subsidyAmount: Number(row.subsidy_amount),
      patientCopayAmount: Number(row.patient_copay_amount),
      rejectionReason: row.rejection_reason,
      cancellationProtocol: row.cancellation_protocol,
      cancellationReason: row.cancellation_reason,
      cancelledAt: row.cancelled_at,
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at,
    };
  }

  private mapItemRow(row: any): PbmTransactionItem {
    return {
      id: Number(row.id),
      pbmTransactionId: Number(row.pbm_transaction_id),
      productId: Number(row.product_id),
      batchId: row.batch_id != null ? Number(row.batch_id) : null,
      ean: row.ean,
      msRegistration: row.ms_registration,
      productName: row.product_name,
      dailyDose: Number(row.daily_dose),
      authorizedQuantity: Number(row.authorized_quantity),
      unitGrossPrice: Number(row.unit_gross_price),
      totalGrossPrice: Number(row.total_gross_price),
      referenceUnitPrice: Number(row.reference_unit_price),
      subsidyUnitPrice: Number(row.subsidy_unit_price),
      subsidyTotalPrice: Number(row.subsidy_total_price),
      patientUnitPrice: Number(row.patient_unit_price),
      patientTotalPrice: Number(row.patient_total_price),
      programType: row.program_type,
      createdAt: row.created_at,
    };
  }
}
