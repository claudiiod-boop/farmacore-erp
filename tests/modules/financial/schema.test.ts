import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import type {
  CashClosure,
  DifferenceStatus,
  ClosureReviewStatus,
  PharmaceuticalCategory,
  TefSettlementStatus,
  DeclareBlindClosureParams,
  ReviewClosureParams,
  CashClosureFilters,
  ReceivablesForecastItem,
  ReceivablesForecastSummary,
  SettleTransactionParams,
  ReconciliationFilters,
  ReconciliationSummary,
  DreReport,
  AbcClass,
  AbcCurveItem,
  AbcCategorySummary,
  AbcCurveReport,
} from '../../../src/modules/financial/types';

describe('Financial Domain Schema 007 & Types (Blind Closure, TEF Reconciliation, DRE & Curva ABC)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Migration 007 & Table Existence', () => {
    it('should register migration 007 in _migrations table', () => {
      const migrations = db
        .prepare<{ name: string }>('SELECT name FROM _migrations WHERE name = ?')
        .all('007_financial_dre_blind_closure.sql');

      expect(migrations.length).toBe(1);
      expect(migrations[0].name).toBe('007_financial_dre_blind_closure.sql');
    });

    it('should create cash_closures table', () => {
      const tables = db
        .prepare<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = 'cash_closures'"
        )
        .all();

      expect(tables.length).toBe(1);
    });
  });

  describe('cash_closures Schema & Constraints', () => {
    it('should verify all required columns exist in cash_closures', () => {
      const columns = db
        .prepare<{ name: string; type: string; notnull: number; dflt_value: string | null }>(
          'PRAGMA table_info(cash_closures)'
        )
        .all();

      const colMap = new Map(columns.map((c) => [c.name, c]));

      // Primary & Foreign keys
      expect(colMap.has('id')).toBe(true);
      expect(colMap.has('cash_session_id')).toBe(true);
      expect(colMap.get('cash_session_id')?.notnull).toBe(1);
      expect(colMap.has('operator_name')).toBe(true);
      expect(colMap.get('operator_name')?.notnull).toBe(1);
      expect(colMap.has('declared_at')).toBe(true);

      // Declared values (Blind counting)
      expect(colMap.has('declared_cash')).toBe(true);
      expect(colMap.has('declared_credit')).toBe(true);
      expect(colMap.has('declared_debit')).toBe(true);
      expect(colMap.has('declared_pix')).toBe(true);
      expect(colMap.has('declared_pbm')).toBe(true);
      expect(colMap.has('total_declared')).toBe(true);
      expect(colMap.has('operator_notes')).toBe(true);

      // System audit values
      expect(colMap.has('system_cash')).toBe(true);
      expect(colMap.has('system_credit')).toBe(true);
      expect(colMap.has('system_debit')).toBe(true);
      expect(colMap.has('system_pix')).toBe(true);
      expect(colMap.has('system_pbm')).toBe(true);
      expect(colMap.has('system_supplies')).toBe(true);
      expect(colMap.has('system_sangrias')).toBe(true);
      expect(colMap.has('total_system')).toBe(true);

      // Difference analysis
      expect(colMap.has('cash_difference')).toBe(true);
      expect(colMap.has('total_difference')).toBe(true);
      expect(colMap.has('difference_status')).toBe(true);

      // Management Review
      expect(colMap.has('manager_name')).toBe(true);
      expect(colMap.has('manager_notes')).toBe(true);
      expect(colMap.has('status')).toBe(true);
      expect(colMap.has('reviewed_at')).toBe(true);

      // Timestamps
      expect(colMap.has('created_at')).toBe(true);
      expect(colMap.has('updated_at')).toBe(true);
    });

    it('should verify indexes on cash_closures', () => {
      const indexes = db
        .prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type='index'")
        .all()
        .map((r) => r.name);

      expect(indexes).toContain('idx_cash_closures_session');
      expect(indexes).toContain('idx_cash_closures_status');
      expect(indexes).toContain('idx_cash_closures_created');
    });

    it('should enforce unique constraint on cash_session_id', () => {
      db.prepare(`
        INSERT INTO cash_sessions (operator_name, initial_cash, current_cash, status)
        VALUES ('Operador 1', 100.0, 100.0, 'CLOSED')
      `).run();

      const insertClosure = () =>
        db.prepare(`
          INSERT INTO cash_closures (
            cash_session_id, operator_name, declared_cash, total_declared,
            system_cash, total_system, cash_difference, total_difference,
            difference_status
          ) VALUES (
            1, 'Operador 1', 100.0, 100.0,
            100.0, 100.0, 0.0, 0.0,
            'EXACT'
          )
        `).run();

      expect(() => insertClosure()).not.toThrow();
      expect(() => insertClosure()).toThrow(); // Second insertion for session 1 must fail UNIQUE constraint
    });

    it('should enforce check constraint on difference_status', () => {
      db.prepare(`
        INSERT INTO cash_sessions (operator_name, initial_cash, current_cash, status)
        VALUES ('Operador 2', 100.0, 100.0, 'CLOSED')
      `).run();

      expect(() => {
        db.prepare(`
          INSERT INTO cash_closures (
            cash_session_id, operator_name, declared_cash, total_declared,
            system_cash, total_system, cash_difference, total_difference,
            difference_status
          ) VALUES (
            1, 'Operador 2', 100.0, 100.0,
            100.0, 100.0, 0.0, 0.0,
            'INVALID_STATUS'
          )
        `).run();
      }).toThrow();
    });

    it('should enforce check constraint on status (review status)', () => {
      db.prepare(`
        INSERT INTO cash_sessions (operator_name, initial_cash, current_cash, status)
        VALUES ('Operador 3', 100.0, 100.0, 'CLOSED')
      `).run();

      expect(() => {
        db.prepare(`
          INSERT INTO cash_closures (
            cash_session_id, operator_name, declared_cash, total_declared,
            system_cash, total_system, cash_difference, total_difference,
            difference_status, status
          ) VALUES (
            1, 'Operador 3', 100.0, 100.0,
            100.0, 100.0, 0.0, 0.0,
            'EXACT', 'INVALID_REVIEW_STATUS'
          )
        `).run();
      }).toThrow();
    });
  });

  describe('tef_transactions Extended Columns for Settlement/Reconciliation', () => {
    it('should have settlement_status, settled_amount, settled_fee, settled_at, bank_account columns', () => {
      const columns = db
        .prepare<{ name: string; type: string; dflt_value: string | null }>(
          'PRAGMA table_info(tef_transactions)'
        )
        .all();

      const colNames = columns.map((c) => c.name);
      expect(colNames).toContain('settlement_status');
      expect(colNames).toContain('settled_amount');
      expect(colNames).toContain('settled_fee');
      expect(colNames).toContain('settled_at');
      expect(colNames).toContain('bank_account');
    });

    it('should enforce check constraint on settlement_status', () => {
      db.prepare(`
        INSERT INTO tef_configs (provider_id, provider_name)
        VALUES ('MOCK', 'Mock Provider')
      `).run();

      // Valid statuses: PENDING, SETTLED, DIVERGENT
      const insertWithStatus = (st: string) =>
        db.prepare(`
          INSERT INTO tef_transactions (
            transaction_uuid, provider_id, operation_type, status,
            amount, brand_name, brand_code_sefaz, acquirer_name, acquirer_cnpj,
            authorization_code, nsu, host_nsu, settlement_status
          ) VALUES (
            ?, 'MOCK', 'DEBITO', 'CONFIRMED',
            50.0, 'VISA', '01', 'CIELO', '01027058000191',
            'AUTH', ?, 'HOST', ?
          )
        `);

      expect(() => insertWithStatus('PENDING').run('uuid-s1', 'NSU-S1', 'PENDING')).not.toThrow();
      expect(() => insertWithStatus('SETTLED').run('uuid-s2', 'NSU-S2', 'SETTLED')).not.toThrow();
      expect(() => insertWithStatus('DIVERGENT').run('uuid-s3', 'NSU-S3', 'DIVERGENT')).not.toThrow();
      expect(() => insertWithStatus('INVALID').run('uuid-s4', 'NSU-S4', 'INVALID')).toThrow();
    });
  });

  describe('products Extended Column for Pharmaceutical Category', () => {
    it('should have category column with default CORRELATOS_OUTROS', () => {
      const columns = db
        .prepare<{ name: string; type: string; dflt_value: string | null }>(
          'PRAGMA table_info(products)'
        )
        .all();

      const categoryCol = columns.find((c) => c.name === 'category');
      expect(categoryCol).toBeDefined();
      expect(categoryCol?.type.toUpperCase()).toBe('TEXT');
      expect(categoryCol?.dflt_value).toContain('CORRELATOS_OUTROS');
    });

    it('should have index on products(category)', () => {
      const indexes = db
        .prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type='index'")
        .all()
        .map((r) => r.name);

      expect(indexes).toContain('idx_products_category');
    });

    it('should enforce check constraint on category enum', () => {
      const insertProduct = (category: string, ean: string) =>
        db.prepare(`
          INSERT INTO products (
            ean, name, active_ingredient, ms_registration, stripe,
            control_type, pmc, pf, price, category
          ) VALUES (
            ?, 'Medicamento Teste', 'Princípio', '1.0000.0000', 'SEM_TARJA',
            'ISENTO', 20.0, 15.0, 18.0, ?
          )
        `).run(ean, category);

      expect(() => insertProduct('REFERENCIA', '789000000001')).not.toThrow();
      expect(() => insertProduct('GENERICO', '789000000002')).not.toThrow();
      expect(() => insertProduct('SIMILAR', '789000000003')).not.toThrow();
      expect(() => insertProduct('PERFUMARIA', '789000000004')).not.toThrow();
      expect(() => insertProduct('CORRELATOS_OUTROS', '789000000005')).not.toThrow();
      expect(() => insertProduct('ALIMENTICIO', '789000000006')).toThrow();
    });
  });

  describe('Financial TypeScript Domain Types Compilation', () => {
    it('should validate typing contracts for blind cash closure', () => {
      const diffStatus: DifferenceStatus = 'SHORTAGE';
      const reviewStatus: ClosureReviewStatus = 'APPROVED';

      const closure: CashClosure = {
        id: 1,
        cashSessionId: 10,
        operatorName: 'João Caixa',
        declaredAt: '2026-11-18T18:00:00Z',
        declaredCash: 250.0,
        declaredCredit: 400.0,
        declaredDebit: 150.0,
        declaredPix: 100.0,
        declaredPbm: 50.0,
        totalDeclared: 950.0,
        operatorNotes: 'Conferência física final de turno',
        systemCash: 260.0,
        systemCredit: 400.0,
        systemDebit: 150.0,
        systemPix: 100.0,
        systemPbm: 50.0,
        systemSupplies: 50.0,
        systemSangrias: 100.0,
        totalSystem: 960.0,
        cashDifference: -10.0,
        totalDifference: -10.0,
        differenceStatus: diffStatus,
        managerName: 'Gerente Carlos',
        managerNotes: 'Quebra de R$ 10,00 autorizada com desconto em folha',
        status: reviewStatus,
        reviewedAt: '2026-11-18T18:15:00Z',
        createdAt: '2026-11-18T18:00:00Z',
        updatedAt: '2026-11-18T18:15:00Z',
      };

      expect(closure.differenceStatus).toBe('SHORTAGE');
      expect(closure.status).toBe('APPROVED');
      expect(closure.totalDifference).toBe(-10.0);

      const declareParams: DeclareBlindClosureParams = {
        sessionId: 10,
        operatorName: 'João Caixa',
        declaredCash: 250.0,
        declaredCredit: 400.0,
        declaredDebit: 150.0,
        declaredPix: 100.0,
        declaredPbm: 50.0,
        operatorNotes: 'Fechamento turno',
      };
      expect(declareParams.sessionId).toBe(10);

      const reviewParams: ReviewClosureParams = {
        managerName: 'Gerente Carlos',
        approved: true,
        managerNotes: 'Homologado',
      };
      expect(reviewParams.approved).toBe(true);

      const filters: CashClosureFilters = {
        status: 'PENDING_REVIEW',
        differenceStatus: 'SHORTAGE',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        limit: 20,
        offset: 0,
      };
      expect(filters.limit).toBe(20);
    });

    it('should validate typing contracts for TEF reconciliation and forecasting', () => {
      const settlementStatus: TefSettlementStatus = 'SETTLED';
      expect(settlementStatus).toBe('SETTLED');

      const forecastItem: ReceivablesForecastItem = {
        expectedSettlementDate: '2026-11-19',
        acquirerName: 'CIELO',
        operationType: 'DEBITO',
        transactionCount: 15,
        grossAmount: 1500.0,
        estimatedFee: 22.5,
        netAmount: 1477.5,
      };
      expect(forecastItem.grossAmount).toBe(1500.0);

      const forecastSummary: ReceivablesForecastSummary = {
        items: [forecastItem],
        totalGross: 1500.0,
        totalEstimatedFee: 22.5,
        totalNet: 1477.5,
        totalTransactions: 15,
      };
      expect(forecastSummary.totalTransactions).toBe(15);

      const settleParams: SettleTransactionParams = {
        settledAmount: 1477.5,
        settledFee: 22.5,
        bankAccount: 'Banco do Brasil Ag 1234 C/C 56789-0',
        settledAt: '2026-11-19T10:00:00Z',
      };
      expect(settleParams.settledAmount).toBe(1477.5);

      const recFilters: ReconciliationFilters = {
        settlementStatus: 'PENDING',
        acquirerName: 'CIELO',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      };
      expect(recFilters.settlementStatus).toBe('PENDING');

      const recSummary: ReconciliationSummary = {
        totalPending: 5000.0,
        totalSettled: 15000.0,
        totalDivergent: 120.0,
        pendingCount: 25,
        settledCount: 80,
        divergentCount: 1,
      };
      expect(recSummary.divergentCount).toBe(1);
    });

    it('should validate typing contracts for DRE and Curva ABC', () => {
      const cat: PharmaceuticalCategory = 'GENERICO';
      expect(cat).toBe('GENERICO');

      const dre: DreReport = {
        startDate: '2026-11-01',
        endDate: '2026-11-18',
        grossRevenue: 50000.0,
        discounts: 2500.0,
        cancellations: 500.0,
        tefFees: 1200.0,
        netRevenue: 45800.0,
        cmv: 28000.0,
        grossProfit: 17800.0,
        grossMarginPercent: 38.86,
        operatingExpenses: 3500.0,
        netOperatingProfit: 14300.0,
        netMarginPercent: 31.22,
        salesCount: 320,
        itemsSold: 980,
      };
      expect(dre.netOperatingProfit).toBe(14300.0);

      const abcClass: AbcClass = 'A';
      const abcItem: AbcCurveItem = {
        productId: 1,
        ean: '7891234567890',
        productName: 'Dipirona 500mg',
        category: 'GENERICO',
        quantitySold: 200,
        grossRevenue: 2000.0,
        revenueSharePercent: 20.0,
        cumulativeRevenuePercent: 20.0,
        abcClass,
        unitCostAverage: 4.5,
        totalCost: 900.0,
        grossProfit: 1100.0,
        marginPercent: 55.0,
      };
      expect(abcItem.abcClass).toBe('A');

      const catSummary: AbcCategorySummary = {
        category: 'GENERICO',
        grossRevenue: 15000.0,
        revenueSharePercent: 30.0,
        quantitySold: 500,
        grossProfit: 7500.0,
        marginPercent: 50.0,
      };

      const abcReport: AbcCurveReport = {
        startDate: '2026-11-01',
        endDate: '2026-11-18',
        totalRevenue: 50000.0,
        totalCost: 30000.0,
        totalProfit: 20000.0,
        overallMarginPercent: 40.0,
        totalProductsCount: 150,
        classACount: 25,
        classBCount: 45,
        classCCount: 80,
        items: [abcItem],
        categoriesSummary: [catSummary],
      };
      expect(abcReport.classACount).toBe(25);
    });
  });
});
