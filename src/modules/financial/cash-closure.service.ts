import type { Database } from '../../database/connection';
import type {
  CashClosure,
  DeclareBlindClosureParams,
  ReviewClosureParams,
  CashClosureFilters,
  DifferenceStatus,
} from './types';
import type { PaymentMethod } from '../pos/types';

interface CashClosureRow {
  id: number;
  cash_session_id: number;
  operator_name: string;
  declared_at: string;
  declared_cash: number;
  declared_credit: number;
  declared_debit: number;
  declared_pix: number;
  declared_pbm: number;
  total_declared: number;
  operator_notes: string | null;
  system_cash: number;
  system_credit: number;
  system_debit: number;
  system_pix: number;
  system_pbm: number;
  system_supplies: number;
  system_sangrias: number;
  total_system: number;
  cash_difference: number;
  total_difference: number;
  difference_status: 'EXACT' | 'SURPLUS' | 'SHORTAGE';
  manager_name: string | null;
  manager_notes: string | null;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CashSessionRow {
  id: number;
  operator_name: string;
  initial_cash: number;
  current_cash: number;
  status: 'OPEN' | 'CLOSED';
  opened_at: string;
  closed_at: string | null;
}

function mapCashClosureRow(row: CashClosureRow): CashClosure {
  return {
    id: row.id,
    cashSessionId: row.cash_session_id,
    operatorName: row.operator_name,
    declaredAt: row.declared_at,
    declaredCash: Number(row.declared_cash),
    declaredCredit: Number(row.declared_credit),
    declaredDebit: Number(row.declared_debit),
    declaredPix: Number(row.declared_pix),
    declaredPbm: Number(row.declared_pbm),
    totalDeclared: Number(row.total_declared),
    operatorNotes: row.operator_notes,
    systemCash: Number(row.system_cash),
    systemCredit: Number(row.system_credit),
    systemDebit: Number(row.system_debit),
    systemPix: Number(row.system_pix),
    systemPbm: Number(row.system_pbm),
    systemSupplies: Number(row.system_supplies),
    systemSangrias: Number(row.system_sangrias),
    totalSystem: Number(row.total_system),
    cashDifference: Number(row.cash_difference),
    totalDifference: Number(row.total_difference),
    differenceStatus: row.difference_status,
    managerName: row.manager_name,
    managerNotes: row.manager_notes,
    status: row.status,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BlindCashClosureService {
  constructor(private db: Database) {}

  /**
   * Realiza a contagem cega do operador, calcula os saldos do sistema,
   * apura quebra/sobra e encerra atomicamente a sessao de caixa.
   */
  declareBlindClosure(params: DeclareBlindClosureParams): CashClosure {
    const {
      sessionId,
      operatorName,
      declaredCash,
      declaredCredit,
      declaredDebit,
      declaredPix,
      declaredPbm,
      operatorNotes,
    } = params;

    if (!sessionId || sessionId <= 0) {
      throw new Error('INVALID_SESSION_ID');
    }

    if (!operatorName || operatorName.trim() === '') {
      throw new Error('INVALID_OPERATOR_NAME');
    }

    const session = this.db
      .prepare<CashSessionRow>('SELECT * FROM cash_sessions WHERE id = ?')
      .get(sessionId);

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    if (session.status === 'CLOSED') {
      throw new Error('SESSION_ALREADY_CLOSED');
    }

    const existingClosure = this.db
      .prepare<CashClosureRow>('SELECT * FROM cash_closures WHERE cash_session_id = ?')
      .get(sessionId);

    if (existingClosure) {
      throw new Error('CLOSURE_ALREADY_EXISTS');
    }

    // 1. Apuracao das vendas da sessao
    const salesRows = this.db
      .prepare<{ id: number; change_amount: number }>(
        "SELECT id, change_amount FROM sales WHERE cash_session_id = ? AND status = 'COMPLETED'"
      )
      .all(sessionId);

    const totalsByMethod: Record<PaymentMethod, number> = {
      DINHEIRO: 0,
      CARTAO_CREDITO: 0,
      CARTAO_DEBITO: 0,
      PIX: 0,
      CONVENIO_PBM: 0,
    };

    const paymentRows = this.db
      .prepare<{ method: string; amount: number }>(`
        SELECT sp.method, sp.amount
        FROM sale_payments sp
        JOIN sales s ON s.id = sp.sale_id
        WHERE s.cash_session_id = ? AND s.status = 'COMPLETED'
      `)
      .all(sessionId);

    for (const p of paymentRows) {
      const method = p.method as PaymentMethod;
      if (totalsByMethod[method] !== undefined) {
        totalsByMethod[method] = Number((totalsByMethod[method] + Number(p.amount)).toFixed(2));
      }
    }

    // Abate troco fornecido em dinheiro
    const totalChange = salesRows.reduce((acc, s) => acc + Number(s.change_amount), 0);
    const netCashSales = Number(Math.max(0, totalsByMethod.DINHEIRO - totalChange).toFixed(2));

    // 2. Apuracao das movimentacoes de caixa (suprimentos e sangrias)
    const movementRows = this.db
      .prepare<{ type: string; amount: number }>(
        'SELECT type, amount FROM cash_movements WHERE cash_session_id = ?'
      )
      .all(sessionId);

    let systemSupplies = 0;
    let systemSangrias = 0;

    for (const m of movementRows) {
      if (m.type === 'SUPPLY') {
        systemSupplies += Number(m.amount);
      } else if (m.type === 'SANGRIA') {
        systemSangrias += Number(m.amount);
      }
    }

    systemSupplies = Number(systemSupplies.toFixed(2));
    systemSangrias = Number(systemSangrias.toFixed(2));

    // 3. Totais apurados pelo sistema
    const systemCash = Number(
      (session.initial_cash + systemSupplies - systemSangrias + netCashSales).toFixed(2)
    );
    const systemCredit = Number(totalsByMethod.CARTAO_CREDITO.toFixed(2));
    const systemDebit = Number(totalsByMethod.CARTAO_DEBITO.toFixed(2));
    const systemPix = Number(totalsByMethod.PIX.toFixed(2));
    const systemPbm = Number(totalsByMethod.CONVENIO_PBM.toFixed(2));
    const totalSystem = Number(
      (systemCash + systemCredit + systemDebit + systemPix + systemPbm).toFixed(2)
    );

    // 4. Totais declarados pelo operador (contagem cega)
    const cleanCash = Number(declaredCash.toFixed(2));
    const cleanCredit = Number(declaredCredit.toFixed(2));
    const cleanDebit = Number(declaredDebit.toFixed(2));
    const cleanPix = Number(declaredPix.toFixed(2));
    const cleanPbm = Number(declaredPbm.toFixed(2));
    const totalDeclared = Number(
      (cleanCash + cleanCredit + cleanDebit + cleanPix + cleanPbm).toFixed(2)
    );

    // 5. Apuracao de diferencas (quebra ou sobra)
    const cashDifference = Number((cleanCash - systemCash).toFixed(2));
    const totalDifference = Number((totalDeclared - totalSystem).toFixed(2));

    let differenceStatus: DifferenceStatus = 'EXACT';
    if (Math.abs(totalDifference) < 0.01) {
      differenceStatus = 'EXACT';
    } else if (totalDifference > 0) {
      differenceStatus = 'SURPLUS';
    } else {
      differenceStatus = 'SHORTAGE';
    }

    // 6. Fechamento atomico com transacao SQLite
    const executeClosure = this.db.transaction(() => {
      // Fecha a sessao
      this.db
        .prepare("UPDATE cash_sessions SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(sessionId);

      // Insere o registro de fechamento
      const insertResult = this.db
        .prepare(`
          INSERT INTO cash_closures (
            cash_session_id, operator_name, declared_at,
            declared_cash, declared_credit, declared_debit, declared_pix, declared_pbm, total_declared,
            operator_notes,
            system_cash, system_credit, system_debit, system_pix, system_pbm,
            system_supplies, system_sangrias, total_system,
            cash_difference, total_difference, difference_status,
            status
          ) VALUES (
            ?, ?, CURRENT_TIMESTAMP,
            ?, ?, ?, ?, ?, ?,
            ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            'PENDING_REVIEW'
          )
        `)
        .run(
          sessionId,
          operatorName.trim(),
          cleanCash,
          cleanCredit,
          cleanDebit,
          cleanPix,
          cleanPbm,
          totalDeclared,
          operatorNotes?.trim() || null,
          systemCash,
          systemCredit,
          systemDebit,
          systemPix,
          systemPbm,
          systemSupplies,
          systemSangrias,
          totalSystem,
          cashDifference,
          totalDifference,
          differenceStatus
        );

      return Number(insertResult.lastInsertRowid);
    });

    const closureId = executeClosure();
    const createdClosure = this.getClosureById(closureId);
    if (!createdClosure) {
      throw new Error('FAILED_TO_CREATE_CLOSURE');
    }

    return createdClosure;
  }

  /**
   * Obtem o fechamento de caixa pelo ID da sessao.
   */
  getClosureBySessionId(sessionId: number): CashClosure | null {
    const row = this.db
      .prepare<CashClosureRow>('SELECT * FROM cash_closures WHERE cash_session_id = ?')
      .get(sessionId);

    return row ? mapCashClosureRow(row) : null;
  }

  /**
   * Obtem o fechamento de caixa pelo ID proprio.
   */
  getClosureById(closureId: number): CashClosure | null {
    const row = this.db
      .prepare<CashClosureRow>('SELECT * FROM cash_closures WHERE id = ?')
      .get(closureId);

    return row ? mapCashClosureRow(row) : null;
  }

  /**
   * Permite ao gerente homologar (aprovar/rejeitar) o fechamento com parecer.
   */
  reviewClosure(closureId: number, params: ReviewClosureParams): CashClosure {
    const { managerName, approved, managerNotes } = params;

    if (!managerName || managerName.trim() === '') {
      throw new Error('INVALID_MANAGER_NAME');
    }

    const closure = this.getClosureById(closureId);
    if (!closure) {
      throw new Error('CLOSURE_NOT_FOUND');
    }

    if (closure.status !== 'PENDING_REVIEW') {
      throw new Error('CLOSURE_ALREADY_REVIEWED');
    }

    const newStatus = approved ? 'APPROVED' : 'REJECTED';

    this.db
      .prepare(`
        UPDATE cash_closures
        SET manager_name = ?,
            manager_notes = ?,
            status = ?,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(managerName.trim(), managerNotes?.trim() || null, newStatus, closureId);

    const updated = this.getClosureById(closureId);
    if (!updated) {
      throw new Error('FAILED_TO_UPDATE_CLOSURE');
    }

    return updated;
  }

  /**
   * Lista fechamentos com paginacao e filtros opcionais.
   */
  listClosures(filters?: CashClosureFilters): { closures: CashClosure[]; total: number } {
    const conditions: string[] = [];
    const queryParams: (string | number)[] = [];

    if (filters?.status) {
      conditions.push('status = ?');
      queryParams.push(filters.status);
    }

    if (filters?.differenceStatus) {
      conditions.push('difference_status = ?');
      queryParams.push(filters.differenceStatus);
    }

    if (filters?.startDate) {
      conditions.push('date(declared_at) >= date(?)');
      queryParams.push(filters.startDate);
    }

    if (filters?.endDate) {
      conditions.push('date(declared_at) <= date(?)');
      queryParams.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = this.db
      .prepare<{ total: number }>(`SELECT COUNT(*) as total FROM cash_closures ${whereClause}`)
      .get(...queryParams);

    const total = countRow?.total || 0;

    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 50;
    const offset = filters?.offset && filters.offset >= 0 ? filters.offset : 0;

    const rows = this.db
      .prepare<CashClosureRow>(`
        SELECT * FROM cash_closures
        ${whereClause}
        ORDER BY id DESC
        LIMIT ? OFFSET ?
      `)
      .all(...queryParams, limit, offset);

    return {
      closures: rows.map(mapCashClosureRow),
      total,
    };
  }
}
