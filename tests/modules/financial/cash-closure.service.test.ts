import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { BlindCashClosureService } from '../../../src/modules/financial/cash-closure.service';
import type { DeclareBlindClosureParams, ReviewClosureParams } from '../../../src/modules/financial/types';

describe('BlindCashClosureService', () => {
  let db: Database;
  let service: BlindCashClosureService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new BlindCashClosureService(db);
  });

  afterEach(() => {
    db.close();
  });

  // Helper function to create an open session
  const createSession = (operatorName = 'Operador 1', initialCash = 100.0) => {
    const info = db
      .prepare(`
        INSERT INTO cash_sessions (operator_name, initial_cash, current_cash, status)
        VALUES (?, ?, ?, 'OPEN')
      `)
      .run(operatorName, initialCash, initialCash);
    return Number(info.lastInsertRowid);
  };

  // Helper function to add a sale with payment
  const addSaleWithPayment = (sessionId: number, method: string, amount: number, change = 0.0) => {
    const saleInfo = db
      .prepare(`
        INSERT INTO sales (cash_session_id, status, total_amount, discount_amount, change_amount)
        VALUES (?, 'COMPLETED', ?, 0, ?)
      `)
      .run(sessionId, amount, change);
    const saleId = Number(saleInfo.lastInsertRowid);

    db.prepare(`
      INSERT INTO sale_payments (sale_id, method, amount)
      VALUES (?, ?, ?)
    `).run(saleId, method, amount + change);

    return saleId;
  };

  // Helper function to add a cash movement
  const addCashMovement = (sessionId: number, type: 'SANGRIA' | 'SUPPLY', amount: number) => {
    db.prepare(`
      INSERT INTO cash_movements (cash_session_id, type, amount, reason, operator_name)
      VALUES (?, ?, ?, 'Movimentacao teste', 'Operador 1')
    `).run(sessionId, type, amount);
  };

  describe('declareBlindClosure', () => {
    it('should calculate exact match (EXACT) with zero difference', () => {
      const sessionId = createSession('Operador 1', 100.0);
      // Sales:
      // Dinheiro: 50.0 (no change)
      // Cartao Credito: 120.0
      // Cartao Debito: 80.0
      // PIX: 45.0
      // Convenio PBM: 30.0
      addSaleWithPayment(sessionId, 'DINHEIRO', 50.0);
      addSaleWithPayment(sessionId, 'CARTAO_CREDITO', 120.0);
      addSaleWithPayment(sessionId, 'CARTAO_DEBITO', 80.0);
      addSaleWithPayment(sessionId, 'PIX', 45.0);
      addSaleWithPayment(sessionId, 'CONVENIO_PBM', 30.0);

      // Movements:
      // Suprimento: 20.0
      // Sangria: 30.0
      addCashMovement(sessionId, 'SUPPLY', 20.0);
      addCashMovement(sessionId, 'SANGRIA', 30.0);

      // System expected cash:
      // 100.0 (initial) + 20.0 (supply) - 30.0 (sangria) + 50.0 (cash sale) = 140.0
      // Total system: 140 (cash) + 120 (cred) + 80 (deb) + 45 (pix) + 30 (pbm) = 415.0

      const params: DeclareBlindClosureParams = {
        sessionId,
        operatorName: 'Operador 1',
        declaredCash: 140.0,
        declaredCredit: 120.0,
        declaredDebit: 80.0,
        declaredPix: 45.0,
        declaredPbm: 30.0,
        operatorNotes: 'Fechamento perfeito sem diferenca',
      };

      const closure = service.declareBlindClosure(params);

      expect(closure.id).toBeGreaterThan(0);
      expect(closure.cashSessionId).toBe(sessionId);
      expect(closure.operatorName).toBe('Operador 1');
      expect(closure.declaredCash).toBe(140.0);
      expect(closure.systemCash).toBe(140.0);
      expect(closure.systemCredit).toBe(120.0);
      expect(closure.systemDebit).toBe(80.0);
      expect(closure.systemPix).toBe(45.0);
      expect(closure.systemPbm).toBe(30.0);
      expect(closure.systemSupplies).toBe(20.0);
      expect(closure.systemSangrias).toBe(30.0);
      expect(closure.totalDeclared).toBe(415.0);
      expect(closure.totalSystem).toBe(415.0);
      expect(closure.cashDifference).toBe(0.0);
      expect(closure.totalDifference).toBe(0.0);
      expect(closure.differenceStatus).toBe('EXACT');
      expect(closure.status).toBe('PENDING_REVIEW');

      // Check session status is CLOSED
      const session = db
        .prepare<{ status: string; closed_at: string | null }>(
          'SELECT status, closed_at FROM cash_sessions WHERE id = ?'
        )
        .get(sessionId);
      expect(session?.status).toBe('CLOSED');
      expect(session?.closed_at).not.toBeNull();
    });

    it('should detect cash shortage (SHORTAGE) when physical money is missing', () => {
      const sessionId = createSession('Operador 2', 200.0);
      addSaleWithPayment(sessionId, 'DINHEIRO', 100.0);
      // Expected cash: 300.0
      // Operator counts only 280.0 in cash (R$ 20 shortage)

      const params: DeclareBlindClosureParams = {
        sessionId,
        operatorName: 'Operador 2',
        declaredCash: 280.0,
        declaredCredit: 0.0,
        declaredDebit: 0.0,
        declaredPix: 0.0,
        declaredPbm: 0.0,
        operatorNotes: 'Falta de R$ 20,00 na gaveta',
      };

      const closure = service.declareBlindClosure(params);

      expect(closure.declaredCash).toBe(280.0);
      expect(closure.systemCash).toBe(300.0);
      expect(closure.cashDifference).toBe(-20.0);
      expect(closure.totalDifference).toBe(-20.0);
      expect(closure.differenceStatus).toBe('SHORTAGE');
    });

    it('should detect surplus (SURPLUS) when physical money is over expected', () => {
      const sessionId = createSession('Operador 3', 50.0);
      addSaleWithPayment(sessionId, 'DINHEIRO', 50.0);
      // Expected cash: 100.0
      // Operator counts 115.0 (R$ 15 surplus)

      const params: DeclareBlindClosureParams = {
        sessionId,
        operatorName: 'Operador 3',
        declaredCash: 115.0,
        declaredCredit: 0.0,
        declaredDebit: 0.0,
        declaredPix: 0.0,
        declaredPbm: 0.0,
      };

      const closure = service.declareBlindClosure(params);

      expect(closure.declaredCash).toBe(115.0);
      expect(closure.systemCash).toBe(100.0);
      expect(closure.cashDifference).toBe(15.0);
      expect(closure.totalDifference).toBe(15.0);
      expect(closure.differenceStatus).toBe('SURPLUS');
    });

    it('should correctly deduct change given (change_amount) from cash sales', () => {
      const sessionId = createSession('Operador 4', 100.0);
      // Sale: total 35.0, paid with 50.0 bill (change = 15.0)
      addSaleWithPayment(sessionId, 'DINHEIRO', 35.0, 15.0);

      // Net cash added: 35.0
      // Total expected cash: 135.0
      const params: DeclareBlindClosureParams = {
        sessionId,
        operatorName: 'Operador 4',
        declaredCash: 135.0,
        declaredCredit: 0.0,
        declaredDebit: 0.0,
        declaredPix: 0.0,
        declaredPbm: 0.0,
      };

      const closure = service.declareBlindClosure(params);
      expect(closure.systemCash).toBe(135.0);
      expect(closure.differenceStatus).toBe('EXACT');
    });

    it('should reject closure if session does not exist', () => {
      expect(() => {
        service.declareBlindClosure({
          sessionId: 9999,
          operatorName: 'Operador Inexistente',
          declaredCash: 100,
          declaredCredit: 0,
          declaredDebit: 0,
          declaredPix: 0,
          declaredPbm: 0,
        });
      }).toThrow('SESSION_NOT_FOUND');
    });

    it('should reject closure if session is already closed', () => {
      const sessionId = createSession('Operador 5', 100.0);
      db.prepare("UPDATE cash_sessions SET status = 'CLOSED' WHERE id = ?").run(sessionId);

      expect(() => {
        service.declareBlindClosure({
          sessionId,
          operatorName: 'Operador 5',
          declaredCash: 100,
          declaredCredit: 0,
          declaredDebit: 0,
          declaredPix: 0,
          declaredPbm: 0,
        });
      }).toThrow('SESSION_ALREADY_CLOSED');
    });

    it('should reject second closure for the same session', () => {
      const sessionId = createSession('Operador 6', 100.0);
      service.declareBlindClosure({
        sessionId,
        operatorName: 'Operador 6',
        declaredCash: 100,
        declaredCredit: 0,
        declaredDebit: 0,
        declaredPix: 0,
        declaredPbm: 0,
      });

      expect(() => {
        service.declareBlindClosure({
          sessionId,
          operatorName: 'Operador 6',
          declaredCash: 100,
          declaredCredit: 0,
          declaredDebit: 0,
          declaredPix: 0,
          declaredPbm: 0,
        });
      }).toThrow(); // Either SESSION_ALREADY_CLOSED or CLOSURE_ALREADY_EXISTS
    });
  });

  describe('getClosureBySessionId & getClosureById', () => {
    it('should retrieve closure by sessionId and by id', () => {
      const sessionId = createSession('Operador 7', 150.0);
      const created = service.declareBlindClosure({
        sessionId,
        operatorName: 'Operador 7',
        declaredCash: 150.0,
        declaredCredit: 0,
        declaredDebit: 0,
        declaredPix: 0,
        declaredPbm: 0,
      });

      const bySession = service.getClosureBySessionId(sessionId);
      const byId = service.getClosureById(created.id);

      expect(bySession).not.toBeNull();
      expect(bySession?.id).toBe(created.id);
      expect(byId).not.toBeNull();
      expect(byId?.cashSessionId).toBe(sessionId);
    });

    it('should return null if closure does not exist', () => {
      expect(service.getClosureBySessionId(8888)).toBeNull();
      expect(service.getClosureById(8888)).toBeNull();
    });
  });

  describe('reviewClosure', () => {
    it('should allow manager to approve closure with notes', () => {
      const sessionId = createSession('Operador 8', 100.0);
      const created = service.declareBlindClosure({
        sessionId,
        operatorName: 'Operador 8',
        declaredCash: 95.0, // R$ 5 shortage
        declaredCredit: 0,
        declaredDebit: 0,
        declaredPix: 0,
        declaredPbm: 0,
      });

      const reviewParams: ReviewClosureParams = {
        managerName: 'Gerente Roberto',
        approved: true,
        managerNotes: 'Pequena diferenca de troco tolerada',
      };

      const reviewed = service.reviewClosure(created.id, reviewParams);

      expect(reviewed.status).toBe('APPROVED');
      expect(reviewed.managerName).toBe('Gerente Roberto');
      expect(reviewed.managerNotes).toBe('Pequena diferenca de troco tolerada');
      expect(reviewed.reviewedAt).not.toBeNull();
    });

    it('should allow manager to reject closure', () => {
      const sessionId = createSession('Operador 9', 100.0);
      const created = service.declareBlindClosure({
        sessionId,
        operatorName: 'Operador 9',
        declaredCash: 50.0, // R$ 50 shortage
        declaredCredit: 0,
        declaredDebit: 0,
        declaredPix: 0,
        declaredPbm: 0,
      });

      const reviewParams: ReviewClosureParams = {
        managerName: 'Gerente Roberto',
        approved: false,
        managerNotes: 'Diferenca expressiva sem justificativa aceitavel',
      };

      const reviewed = service.reviewClosure(created.id, reviewParams);

      expect(reviewed.status).toBe('REJECTED');
      expect(reviewed.managerNotes).toContain('Diferenca expressiva');
    });

    it('should throw error if closure does not exist', () => {
      expect(() => {
        service.reviewClosure(9999, {
          managerName: 'Gerente Roberto',
          approved: true,
        });
      }).toThrow('CLOSURE_NOT_FOUND');
    });

    it('should throw error if closure is already reviewed', () => {
      const sessionId = createSession('Operador 10', 100.0);
      const created = service.declareBlindClosure({
        sessionId,
        operatorName: 'Operador 10',
        declaredCash: 100.0,
        declaredCredit: 0,
        declaredDebit: 0,
        declaredPix: 0,
        declaredPbm: 0,
      });

      service.reviewClosure(created.id, {
        managerName: 'Gerente Roberto',
        approved: true,
      });

      expect(() => {
        service.reviewClosure(created.id, {
          managerName: 'Gerente Outro',
          approved: false,
        });
      }).toThrow('CLOSURE_ALREADY_REVIEWED');
    });
  });

  describe('listClosures', () => {
    it('should list closures with pagination and filters', () => {
      const s1 = createSession('Operador A', 100.0);
      const s2 = createSession('Operador B', 100.0);

      const c1 = service.declareBlindClosure({
        sessionId: s1,
        operatorName: 'Operador A',
        declaredCash: 100.0,
        declaredCredit: 0,
        declaredDebit: 0,
        declaredPix: 0,
        declaredPbm: 0,
      });

      const c2 = service.declareBlindClosure({
        sessionId: s2,
        operatorName: 'Operador B',
        declaredCash: 80.0,
        declaredCredit: 0,
        declaredDebit: 0,
        declaredPix: 0,
        declaredPbm: 0,
      });

      service.reviewClosure(c1.id, {
        managerName: 'Gerente',
        approved: true,
      });

      const all = service.listClosures();
      expect(all.total).toBe(2);
      expect(all.closures.length).toBe(2);

      const pendingOnly = service.listClosures({ status: 'PENDING_REVIEW' });
      expect(pendingOnly.total).toBe(1);
      expect(pendingOnly.closures[0].id).toBe(c2.id);

      const shortagesOnly = service.listClosures({ differenceStatus: 'SHORTAGE' });
      expect(shortagesOnly.total).toBe(1);
      expect(shortagesOnly.closures[0].id).toBe(c2.id);
    });
  });
});
