import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { TefReconciliationService } from '../../../src/modules/financial/tef-reconciliation.service';
import type { SettleTransactionParams } from '../../../src/modules/financial/types';

describe('TefReconciliationService', () => {
  let db: Database;
  let service: TefReconciliationService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    db.prepare(`
      INSERT INTO tef_configs (provider_id, provider_name, environment)
      VALUES ('MOCK', 'Mock Gateway', 'MOCK')
    `).run();
    service = new TefReconciliationService(db);
  });

  afterEach(() => {
    db.close();
  });

  // Helper to insert a TEF transaction
  const insertTefTx = (params: {
    uuid: string;
    nsu: string;
    opType: 'DEBITO' | 'CREDITO' | 'PIX_TEF';
    amount: number;
    mdrRate: number;
    acquirer: string;
    expectedDate: string;
    status?: 'CONFIRMED' | 'PENDING' | 'REVERSED' | 'CANCELLED';
    settlementStatus?: 'PENDING' | 'SETTLED' | 'DIVERGENT';
  }) => {
    const netAmount = Number((params.amount * (1 - params.mdrRate / 100)).toFixed(2));
    db.prepare(`
      INSERT INTO tef_transactions (
        transaction_uuid, provider_id, terminal_id, operation_type,
        status, amount, brand_name, brand_code_sefaz, acquirer_name, acquirer_cnpj,
        authorization_code, nsu, host_nsu, mdr_rate, net_amount, expected_settlement_date,
        settlement_status
      ) VALUES (
        ?, 'MOCK', 'SE000001', ?,
        ?, ?, 'VISA', '01', ?, '12345678000199',
        'AUTH123', ?, 'HOST123', ?, ?, ?,
        ?
      )
    `).run(
      params.uuid,
      params.opType,
      params.status || 'CONFIRMED',
      params.amount,
      params.acquirer,
      params.nsu,
      params.mdrRate,
      netAmount,
      params.expectedDate,
      params.settlementStatus || 'PENDING'
    );
  };

  describe('getReceivablesForecast', () => {
    it('should aggregate receivables by date, acquirer, and operation type', () => {
      // 2 transacoes Cielo Debito para 2026-11-19
      insertTefTx({
        uuid: 'uuid-1',
        nsu: '100001',
        opType: 'DEBITO',
        amount: 100.0,
        mdrRate: 1.5, // 1.5% -> fee 1.50, net 98.50
        acquirer: 'CIELO',
        expectedDate: '2026-11-19',
      });
      insertTefTx({
        uuid: 'uuid-2',
        nsu: '100002',
        opType: 'DEBITO',
        amount: 200.0,
        mdrRate: 1.5, // 1.5% -> fee 3.00, net 197.00
        acquirer: 'CIELO',
        expectedDate: '2026-11-19',
      });

      // 1 transacao Rede Credito para 2026-12-19 (D+30)
      insertTefTx({
        uuid: 'uuid-3',
        nsu: '100003',
        opType: 'CREDITO',
        amount: 500.0,
        mdrRate: 2.5, // 2.5% -> fee 12.50, net 487.50
        acquirer: 'REDE',
        expectedDate: '2026-12-19',
      });

      // 1 transacao já liquidada (não deve entrar na previsão de pendentes)
      insertTefTx({
        uuid: 'uuid-4',
        nsu: '100004',
        opType: 'DEBITO',
        amount: 150.0,
        mdrRate: 1.5,
        acquirer: 'CIELO',
        expectedDate: '2026-11-18',
        settlementStatus: 'SETTLED',
      });

      const forecast = service.getReceivablesForecast();

      expect(forecast.totalTransactions).toBe(3);
      expect(forecast.totalGross).toBe(800.0);
      expect(forecast.totalEstimatedFee).toBe(17.0); // 1.50 + 3.00 + 12.50 = 17.00
      expect(forecast.totalNet).toBe(783.0); // 98.50 + 197.00 + 487.50 = 783.00
      expect(forecast.items.length).toBe(2);

      const cieloItem = forecast.items.find((i) => i.acquirerName === 'CIELO');
      expect(cieloItem).toBeDefined();
      expect(cieloItem?.transactionCount).toBe(2);
      expect(cieloItem?.grossAmount).toBe(300.0);
      expect(cieloItem?.netAmount).toBe(295.5);
    });

    it('should filter forecast by acquirer name and date interval', () => {
      insertTefTx({
        uuid: 'uuid-10',
        nsu: '100010',
        opType: 'DEBITO',
        amount: 100.0,
        mdrRate: 1.5,
        acquirer: 'STONE',
        expectedDate: '2026-11-20',
      });
      insertTefTx({
        uuid: 'uuid-11',
        nsu: '100011',
        opType: 'DEBITO',
        amount: 150.0,
        mdrRate: 1.5,
        acquirer: 'CIELO',
        expectedDate: '2026-11-20',
      });

      const stoneOnly = service.getReceivablesForecast({ acquirerName: 'STONE' });
      expect(stoneOnly.items.length).toBe(1);
      expect(stoneOnly.totalGross).toBe(100.0);
      expect(stoneOnly.items[0].acquirerName).toBe('STONE');
    });
  });

  describe('settleTransaction', () => {
    it('should successfully settle a transaction without fee divergence', () => {
      insertTefTx({
        uuid: 'uuid-20',
        nsu: '200001',
        opType: 'DEBITO',
        amount: 100.0,
        mdrRate: 1.5, // Expected fee: 1.50, Expected Net: 98.50
        acquirer: 'CIELO',
        expectedDate: '2026-11-19',
      });

      const params: SettleTransactionParams = {
        settledAmount: 98.5,
        settledFee: 1.5,
        bankAccount: 'BANCO DO BRASIL AG 1234 CC 56789-0',
        settledAt: '2026-11-19 10:00:00',
      };

      const result = service.settleTransaction('200001', params);

      expect(result.settlementStatus).toBe('SETTLED');
      expect(result.settledAmount).toBe(98.5);
      expect(result.settledFee).toBe(1.5);
      expect(result.bankAccount).toBe('BANCO DO BRASIL AG 1234 CC 56789-0');
    });

    it('should detect fee divergence (DIVERGENT) when acquirer discounts higher fee than contracted', () => {
      insertTefTx({
        uuid: 'uuid-21',
        nsu: '200002',
        opType: 'DEBITO',
        amount: 100.0,
        mdrRate: 1.5, // Expected fee: 1.50, Expected Net: 98.50
        acquirer: 'CIELO',
        expectedDate: '2026-11-19',
      });

      // Adquirente cobrou taxa de 3.00 (divergência de 1.5% > tolerância de 0.5%)
      const params: SettleTransactionParams = {
        settledAmount: 97.0,
        settledFee: 3.0,
        bankAccount: 'BANCO BRADESCO',
      };

      const result = service.settleTransaction('200002', params);

      expect(result.settlementStatus).toBe('DIVERGENT');
      expect(result.settledAmount).toBe(97.0);
      expect(result.settledFee).toBe(3.0);
    });

    it('should throw error if transaction not found', () => {
      expect(() => {
        service.settleTransaction('999999', { settledAmount: 100 });
      }).toThrow('TRANSACTION_NOT_FOUND');
    });

    it('should throw error if transaction is already settled', () => {
      insertTefTx({
        uuid: 'uuid-22',
        nsu: '200003',
        opType: 'DEBITO',
        amount: 100.0,
        mdrRate: 1.5,
        acquirer: 'CIELO',
        expectedDate: '2026-11-19',
        settlementStatus: 'SETTLED',
      });

      expect(() => {
        service.settleTransaction('200003', { settledAmount: 98.5 });
      }).toThrow('TRANSACTION_ALREADY_SETTLED');
    });

    it('should throw error if transaction is unconfirmed or cancelled', () => {
      insertTefTx({
        uuid: 'uuid-23',
        nsu: '200004',
        opType: 'DEBITO',
        amount: 100.0,
        mdrRate: 1.5,
        acquirer: 'CIELO',
        expectedDate: '2026-11-19',
        status: 'PENDING',
      });

      expect(() => {
        service.settleTransaction('200004', { settledAmount: 98.5 });
      }).toThrow('CANNOT_SETTLE_UNCONFIRMED_TRANSACTION');
    });
  });

  describe('listReconciliation', () => {
    it('should list transactions and compute correct summary breakdown', () => {
      // 1 PENDING
      insertTefTx({
        uuid: 'uuid-30',
        nsu: '300001',
        opType: 'DEBITO',
        amount: 100.0,
        mdrRate: 1.5,
        acquirer: 'CIELO',
        expectedDate: '2026-11-19',
        settlementStatus: 'PENDING',
      });

      // 1 SETTLED
      insertTefTx({
        uuid: 'uuid-31',
        nsu: '300002',
        opType: 'DEBITO',
        amount: 200.0,
        mdrRate: 1.5,
        acquirer: 'CIELO',
        expectedDate: '2026-11-19',
        settlementStatus: 'SETTLED',
      });
      db.prepare(`
        UPDATE tef_transactions
        SET settled_amount = 197.0, settled_fee = 3.0, settled_at = '2026-11-19 12:00:00'
        WHERE nsu = '300002'
      `).run();

      // 1 DIVERGENT
      insertTefTx({
        uuid: 'uuid-32',
        nsu: '300003',
        opType: 'CREDITO',
        amount: 300.0,
        mdrRate: 2.0,
        acquirer: 'REDE',
        expectedDate: '2026-12-19',
        settlementStatus: 'DIVERGENT',
      });
      db.prepare(`
        UPDATE tef_transactions
        SET settled_amount = 285.0, settled_fee = 15.0, settled_at = '2026-11-19 12:00:00'
        WHERE nsu = '300003'
      `).run();

      const res = service.listReconciliation();

      expect(res.transactions.length).toBe(3);
      expect(res.summary.pendingCount).toBe(1);
      expect(res.summary.settledCount).toBe(1);
      expect(res.summary.divergentCount).toBe(1);

      expect(res.summary.totalPending).toBe(98.5);
      expect(res.summary.totalSettled).toBe(197.0);
      expect(res.summary.totalDivergent).toBe(285.0);

      // Filtering by settlementStatus
      const pendingFiltered = service.listReconciliation({ settlementStatus: 'PENDING' });
      expect(pendingFiltered.transactions.length).toBe(1);
      expect(pendingFiltered.transactions[0].nsu).toBe('300001');
    });
  });
});
