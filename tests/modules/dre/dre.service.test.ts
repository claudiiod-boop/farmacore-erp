import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { DreService } from '../../../src/modules/dre/dre.service';

describe('DreService (Motor de DRE Gerencial & Centros de Custos)', () => {
  let db: Database;
  let service: DreService;
  let storeId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new DreService(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;
  });

  afterEach(() => {
    db.close();
  });

  it('should list and create cost centers', () => {
    const list = service.listCostCenters();
    expect(list.length).toBeGreaterThanOrEqual(6);

    const newCC = service.createCostCenter({
      store_id: storeId,
      code: 'CC-INFORMATICA',
      name: 'TI e Infraestrutura',
      department_type: 'ADMINISTRATIVO',
    });

    expect(newCC.id).toBeDefined();
    expect(newCC.code).toBe('CC-INFORMATICA');

    const updatedList = service.listCostCenters(storeId);
    expect(updatedList.some((c) => c.code === 'CC-INFORMATICA')).toBe(true);
  });

  it('should create, list and pay operational expenses', () => {
    const cc = service.listCostCenters().find((c) => c.department_type === 'BALCAO')!;

    const exp = service.createExpense({
      store_id: storeId,
      cost_center_id: cc.id,
      expense_type: 'PESSOAL',
      description: 'Salário Farmacêutico RT',
      amount: 4500.0,
      due_date: '2026-11-05',
    });

    expect(exp.id).toBeDefined();
    expect(exp.status).toBe('PENDING');
    expect(exp.amount).toBe(4500.0);

    const pendingExpenses = service.listExpenses({ status: 'PENDING', store_id: storeId });
    expect(pendingExpenses.length).toBe(1);

    const paidExp = service.payExpense(exp.id, '2026-11-04');
    expect(paidExp.status).toBe('PAID');
    expect(paidExp.payment_date).toBe('2026-11-04');

    const paidExpenses = service.listExpenses({ status: 'PAID', store_id: storeId });
    expect(paidExpenses.length).toBe(1);
  });

  it('should correctly calculate DRE report on accrual basis (Competência)', () => {
    // 1. Inserir produto com pf = 10 e preço de venda = 25
    const prodRes = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, category)
      VALUES ('7890001', 'Amoxicilina 500mg', 'Amoxicilina', '1.0001.0001', 'RED', 'NONE', 30.0, 10.0, 25.0, 'GENERICO')
    `).run();
    const prodId = Number(prodRes.lastInsertRowid);

    // Inserir produto de perfumaria com pf = 8 e preço = 18
    const perfRes = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, category)
      VALUES ('7890002', 'Shampoo Anticaspa', 'Zinco', 'ISENTO', 'NONE', 'NONE', 20.0, 8.0, 18.0, 'PERFUMARIA')
    `).run();
    const perfId = Number(perfRes.lastInsertRowid);

    // Inserir lotes
    const batch1 = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (?, 'L01', '2026-01-01', '2027-01-01', 100, ?)
    `).run(prodId, storeId);

    const batch2 = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (?, 'L02', '2026-01-01', '2027-01-01', 100, ?)
    `).run(perfId, storeId);

    // 2. Inserir venda realizada no mês 2026-11 com desconto
    const saleRes = db.prepare(`
      INSERT INTO sales (store_id, total_amount, discount_amount, status, created_at)
      VALUES (?, 95.0, 5.0, 'COMPLETED', '2026-11-15 14:00:00')
    `).run(storeId);
    const saleId = Number(saleRes.lastInsertRowid);

    // Itens: 2x Amoxicilina (2 * 25 = 50, custo = 2 * 10 = 20)
    db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, 2, 25.0, 50.0)
    `).run(saleId, prodId, batch1.lastInsertRowid);

    // Itens: 2x Shampoo (2 * 18 = 36) e 1 taxa de entrega = 14 => total bruto = 100, desc 5 => 95
    db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, 2, 18.0, 36.0)
    `).run(saleId, perfId, batch2.lastInsertRowid);

    // Inserir despesa operacional de aluguel (CC-ADMIN) e energia (CC-BALCAO)
    const adminCC = service.listCostCenters().find((c) => c.code === 'CC-ADMIN')!;
    const balcaoCC = service.listCostCenters().find((c) => c.code === 'CC-BALCAO')!;

    service.createExpense({
      store_id: storeId,
      cost_center_id: adminCC.id,
      expense_type: 'ADMINISTRATIVA',
      description: 'Aluguel do Ponto',
      amount: 15.0,
      due_date: '2026-11-10',
    });

    service.createExpense({
      store_id: storeId,
      cost_center_id: balcaoCC.id,
      expense_type: 'OPERACIONAL_OUTRAS',
      description: 'Energia Elétrica',
      amount: 10.0,
      due_date: '2026-11-20',
    });

    // Gerar DRE
    const dre = service.generateDreReport('2026-11', storeId, 'COMPETENCIA');

    expect(dre.period_month).toBe('2026-11');
    expect(dre.store_id).toBe(storeId);
    expect(dre.revenue_breakdown.medicamentos_balcao).toBe(50.0);
    expect(dre.revenue_breakdown.perfumaria_conveniencia).toBe(36.0);
    expect(dre.gross_revenue).toBe(86.0);

    // Descontos = 5.0
    expect(dre.deductions_breakdown.descontos_concedidos).toBe(5.0);
    expect(dre.net_revenue).toBeLessThan(dre.gross_revenue);

    // CMV = 2 * 10 (Amox) + 2 * 8 (Shampoo) = 20 + 16 = 36.0
    expect(dre.cmv_amount).toBe(36.0);
    expect(dre.gross_profit).toBe(Number((dre.net_revenue - 36.0).toFixed(2)));

    // Despesas operacionais = 15 + 10 = 25.0
    expect(dre.total_operating_expenses).toBe(25.0);
    expect(dre.expenses_by_cost_center.length).toBe(2);

    // EBITDA e Margem
    expect(dre.ebitda_amount).toBe(Number((dre.gross_profit - 25.0).toFixed(2)));
    expect(dre.break_even_point).toBeGreaterThan(0);
  });

  it('should support Cash Basis (Regime de Caixa) filtering by payment_date', () => {
    const adminCC = service.listCostCenters().find((c) => c.code === 'CC-ADMIN')!;

    // Despesa com vencimento em novembro mas paga em dezembro
    service.createExpense({
      store_id: storeId,
      cost_center_id: adminCC.id,
      expense_type: 'ADMINISTRATIVA',
      description: 'Contabilidade',
      amount: 1000.0,
      due_date: '2026-11-30',
      payment_date: '2026-12-05',
      status: 'PAID',
    });

    // No regime de competência (novembro), a despesa deve constar
    const dreCompetencia = service.generateDreReport('2026-11', storeId, 'COMPETENCIA');
    expect(dreCompetencia.total_operating_expenses).toBe(1000.0);

    // No regime de caixa (novembro), a despesa NÃO deve constar pois foi paga em dezembro
    const dreCaixaNov = service.generateDreReport('2026-11', storeId, 'CAIXA');
    expect(dreCaixaNov.total_operating_expenses).toBe(0.0);

    // No regime de caixa (dezembro), deve constar!
    const dreCaixaDez = service.generateDreReport('2026-12', storeId, 'CAIXA');
    expect(dreCaixaDez.total_operating_expenses).toBe(1000.0);
  });

  it('should save and list official DRE snapshots', () => {
    const snapshot = service.saveDreSnapshot('2026-11', storeId, 'COMPETENCIA');

    expect(snapshot.id).toBeDefined();
    expect(snapshot.period_month).toBe('2026-11');
    expect(snapshot.regime).toBe('COMPETENCIA');

    const list = service.listDreSnapshots(storeId);
    expect(list.length).toBe(1);
    expect(list[0].period_month).toBe('2026-11');
  });

  it('should calculate branch profitability ranking', () => {
    const ranking = service.getBranchProfitabilityRanking('2026-11');
    expect(ranking.length).toBeGreaterThanOrEqual(1);
    expect(ranking[0].store_id).toBeDefined();
    expect(ranking[0].store_name).toBeDefined();
  });
});
