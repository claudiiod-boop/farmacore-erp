import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import type {
  TefConfig,
  TefTransaction,
  TefOperationType,
  TefInstallmentType,
  TefTransactionStatus,
  TefPayParams,
  TefPayResult,
  TefConfirmParams,
  TefConfirmResult,
  TefUndoParams,
  TefUndoResult,
  TefCancelParams,
  TefCancelResult,
  TefProvider,
} from '../../../src/modules/tef/types';

describe('TEF Card Gateway Schema 006 & Types', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should apply migration 006 and create tef_configs and tef_transactions tables', () => {
    const tables = db
      .prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((r) => r.name);

    expect(tables).toContain('tef_configs');
    expect(tables).toContain('tef_transactions');
  });

  it('should verify sale_payments table has tef_transaction_id and tef_nsu columns', () => {
    const columns = db
      .prepare<{ name: string; type: string; dflt_value: string | null }>(
        'PRAGMA table_info(sale_payments)'
      )
      .all();

    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain('tef_transaction_id');
    expect(columnNames).toContain('tef_nsu');
  });

  it('should verify indexes exist on tef_transactions', () => {
    const indexes = db
      .prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type='index'")
      .all()
      .map((r) => r.name);

    expect(indexes).toContain('idx_tef_trans_nsu');
    expect(indexes).toContain('idx_tef_trans_uuid');
    expect(indexes).toContain('idx_tef_trans_sale');
    expect(indexes).toContain('idx_tef_trans_status');
    expect(indexes).toContain('idx_tef_trans_created');
  });

  it('should insert and retrieve tef_config correctly', () => {
    db.prepare(`
      INSERT INTO tef_configs (
        provider_id, provider_name, environment, terminal_id, merchant_id, ip_address, port, is_active, credentials_json
      ) VALUES (
        'MOCK', 'Simulador PinPad', 'MOCK', 'SE000001', 'MERCHANT123', '127.0.0.1', 4096, 1, '{"key": "test"}'
      )
    `).run();

    const config = db.prepare<any>('SELECT * FROM tef_configs WHERE provider_id = ?').get('MOCK');
    expect(config).toBeDefined();
    expect(config.provider_id).toBe('MOCK');
    expect(config.provider_name).toBe('Simulador PinPad');
    expect(config.environment).toBe('MOCK');
    expect(config.terminal_id).toBe('SE000001');
    expect(config.port).toBe(4096);
    expect(config.is_active).toBe(1);
  });

  it('should enforce check constraint on tef_configs environment', () => {
    expect(() => {
      db.prepare(`
        INSERT INTO tef_configs (provider_id, provider_name, environment)
        VALUES ('TEST', 'Test Provider', 'INVALID_ENV')
      `).run();
    }).toThrow();
  });

  it('should insert and retrieve tef_transaction with proper constraints', () => {
    // Insert config first
    db.prepare(`
      INSERT INTO tef_configs (provider_id, provider_name, environment)
      VALUES ('MOCK', 'Simulador PinPad', 'MOCK')
    `).run();

    // Insert transaction
    db.prepare(`
      INSERT INTO tef_transactions (
        transaction_uuid, provider_id, terminal_id, operation_type, status,
        amount, installments, installment_type, brand_name, brand_code_sefaz,
        acquirer_name, acquirer_cnpj, authorization_code, nsu, host_nsu,
        card_last_four, customer_receipt, merchant_receipt
      ) VALUES (
        'uuid-1234', 'MOCK', 'SE000001', 'DEBITO', 'AUTHORIZED',
        100.50, 1, 'A_VISTA', 'VISA', '01',
        'CIELO', '01027058000191', 'AUTH123', 'NSU123', 'HOST123',
        '1234', 'VIA CLIENTE', 'VIA ESTABELECIMENTO'
      )
    `).run();

    const tx = db.prepare<any>('SELECT * FROM tef_transactions WHERE transaction_uuid = ?').get('uuid-1234');
    expect(tx).toBeDefined();
    expect(tx.operation_type).toBe('DEBITO');
    expect(tx.status).toBe('AUTHORIZED');
    expect(tx.amount).toBe(100.50);
    expect(tx.brand_code_sefaz).toBe('01');
    expect(tx.acquirer_cnpj).toBe('01027058000191');
    expect(tx.card_last_four).toBe('1234');
  });

  it('should enforce check constraints on tef_transactions operation_type and status', () => {
    db.prepare(`
      INSERT INTO tef_configs (provider_id, provider_name)
      VALUES ('MOCK', 'Simulador PinPad')
    `).run();

    // Invalid operation_type
    expect(() => {
      db.prepare(`
        INSERT INTO tef_transactions (
          transaction_uuid, provider_id, operation_type, status, amount,
          brand_name, brand_code_sefaz, acquirer_name, acquirer_cnpj,
          authorization_code, nsu, host_nsu
        ) VALUES (
          'uuid-bad-op', 'MOCK', 'INVALID_OP', 'AUTHORIZED', 10.0,
          'VISA', '01', 'CIELO', '01027058000191', 'AUTH', 'NSU', 'HOST'
        )
      `).run();
    }).toThrow();

    // Invalid status
    expect(() => {
      db.prepare(`
        INSERT INTO tef_transactions (
          transaction_uuid, provider_id, operation_type, status, amount,
          brand_name, brand_code_sefaz, acquirer_name, acquirer_cnpj,
          authorization_code, nsu, host_nsu
        ) VALUES (
          'uuid-bad-st', 'MOCK', 'DEBITO', 'INVALID_STATUS', 10.0,
          'VISA', '01', 'CIELO', '01027058000191', 'AUTH', 'NSU', 'HOST'
        )
      `).run();
    }).toThrow();

    // Amount <= 0
    expect(() => {
      db.prepare(`
        INSERT INTO tef_transactions (
          transaction_uuid, provider_id, operation_type, status, amount,
          brand_name, brand_code_sefaz, acquirer_name, acquirer_cnpj,
          authorization_code, nsu, host_nsu
        ) VALUES (
          'uuid-bad-amount', 'MOCK', 'DEBITO', 'AUTHORIZED', 0,
          'VISA', '01', 'CIELO', '01027058000191', 'AUTH', 'NSU', 'HOST'
        )
      `).run();
    }).toThrow();
  });

  it('should link sale_payments with tef_transaction_id and tef_nsu', () => {
    // Insert prerequisite cashier session, sale, tef_config and tef_transaction
    db.prepare(`
      INSERT INTO cash_sessions (operator_name, initial_cash, current_cash, status)
      VALUES ('Op1', 100.0, 100.0, 'OPEN')
    `).run();

    db.prepare(`
      INSERT INTO sales (cash_session_id, total_amount, discount_amount, change_amount, status)
      VALUES (1, 50.0, 0, 0, 'COMPLETED')
    `).run();

    db.prepare(`
      INSERT INTO tef_configs (provider_id, provider_name)
      VALUES ('MOCK', 'Mock Provider')
    `).run();

    db.prepare(`
      INSERT INTO tef_transactions (
        transaction_uuid, provider_id, sale_id, operation_type, status,
        amount, brand_name, brand_code_sefaz, acquirer_name, acquirer_cnpj,
        authorization_code, nsu, host_nsu
      ) VALUES (
        'uuid-sale-link', 'MOCK', 1, 'CREDITO', 'CONFIRMED',
        50.0, 'MASTERCARD', '02', 'REDE', '01425787000104',
        'AUTH999', 'NSU999', 'HOST999'
      )
    `).run();

    db.prepare(`
      INSERT INTO sale_payments (sale_id, method, amount, tef_transaction_id, tef_nsu)
      VALUES (1, 'CARTAO_CREDITO', 50.0, 1, 'NSU999')
    `).run();

    const payment = db.prepare<any>('SELECT * FROM sale_payments WHERE tef_nsu = ?').get('NSU999');
    expect(payment).toBeDefined();
    expect(payment.tef_transaction_id).toBe(1);
    expect(payment.tef_nsu).toBe('NSU999');
  });

  it('should typecheck domain interfaces without runtime errors', () => {
    const config: TefConfig = {
      id: 1,
      providerId: 'MOCK',
      providerName: 'Simulador PinPad',
      environment: 'MOCK',
      terminalId: 'SE000001',
      merchantId: 'M001',
      ipAddress: '127.0.0.1',
      port: 4096,
      isActive: true,
      credentialsJson: '{}',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(config.providerId).toBe('MOCK');

    const op: TefOperationType = 'DEBITO';
    const instType: TefInstallmentType = 'A_VISTA';
    const status: TefTransactionStatus = 'AUTHORIZED';
    expect(op).toBe('DEBITO');
    expect(instType).toBe('A_VISTA');
    expect(status).toBe('AUTHORIZED');

    const tx: TefTransaction = {
      id: 1,
      transactionUuid: 'uuid-1',
      providerId: 'MOCK',
      terminalId: 'SE000001',
      saleId: null,
      paymentId: null,
      operationType: 'DEBITO',
      status: 'AUTHORIZED',
      amount: 100,
      installments: 1,
      installmentType: 'A_VISTA',
      brandName: 'VISA',
      brandCodeSefaz: '01',
      acquirerName: 'CIELO',
      acquirerCnpj: '01027058000191',
      authorizationCode: '123456',
      nsu: '111222',
      hostNsu: '333444',
      cardLastFour: '1234',
      customerReceipt: 'REC_CLI',
      merchantReceipt: 'REC_EST',
      cancellationReceipt: null,
      failureReason: null,
      reversalReason: null,
      cancellationNsu: null,
      cancellationReason: null,
      mdrRate: 1.5,
      netAmount: 98.5,
      expectedSettlementDate: '2026-11-17',
      batchNumber: '001',
      createdAt: new Date().toISOString(),
      confirmedAt: null,
      reversedAt: null,
      cancelledAt: null,
    };
    expect(tx.nsu).toBe('111222');

    const payParams: TefPayParams = {
      amount: 50.0,
      operationType: 'CREDITO',
      mockScenario: 'SUCCESS',
    };
    expect(payParams.amount).toBe(50.0);

    const payResult: TefPayResult = {
      success: true,
      transactionUuid: 'uuid-1',
      nsu: '123',
      hostNsu: '456',
      authorizationCode: '789',
      brandName: 'VISA',
      brandCodeSefaz: '01',
      acquirerName: 'CIELO',
      acquirerCnpj: '01027058000191',
      cardLastFour: '9999',
      amount: 50.0,
      installments: 1,
      customerReceipt: 'REC',
      merchantReceipt: 'REC',
    };
    expect(payResult.success).toBe(true);

    const confirmParams: TefConfirmParams = { nsu: '123', saleId: 1 };
    const confirmResult: TefConfirmResult = { success: true, nsu: '123', confirmedAt: '2026-11-16' };
    const undoParams: TefUndoParams = { nsu: '123', reason: 'Falha NFCe' };
    const undoResult: TefUndoResult = { success: true, nsu: '123', reversedAt: '2026-11-16', reversalReason: 'Falha' };
    const cancelParams: TefCancelParams = { nsu: '123', reason: 'Devolução' };
    const cancelResult: TefCancelResult = {
      success: true,
      nsu: '123',
      cancellationNsu: '999',
      cancelledAt: '2026-11-16',
      cancellationReceipt: 'REC_CANC',
    };

    expect(confirmParams.nsu).toBe('123');
    expect(confirmResult.success).toBe(true);
    expect(undoParams.reason).toBe('Falha NFCe');
    expect(undoResult.success).toBe(true);
    expect(cancelParams.nsu).toBe('123');
    expect(cancelResult.cancellationNsu).toBe('999');

    // TefProvider interface check
    const mockProvider: TefProvider = {
      providerId: 'MOCK',
      providerName: 'Simulador PinPad',
      pay: async () => payResult,
      confirm: async () => confirmResult,
      undo: async () => undoResult,
      cancel: async () => cancelResult,
    };
    expect(mockProvider.providerId).toBe('MOCK');
  });
});
