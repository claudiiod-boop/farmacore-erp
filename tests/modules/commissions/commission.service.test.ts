import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CommissionService } from '../../../src/modules/commissions/commission.service';

describe('CommissionService (Comissões, Campanhas & Aceleradores de Metas)', () => {
  let db: Database;
  let service: CommissionService;
  let storeId: number;
  let sellerId: number;
  let genericProdId: number;
  let similarProdId: number;
  let eticoProdId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new CommissionService(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    // Cadastra vendedor
    const seller = service.createSeller({
      store_id: storeId,
      name: 'Marcos Vinicius Balconista',
      cpf: '333.444.555-88',
      role: 'BALCONISTA',
    });
    sellerId = seller.id;

    // Cadastra produtos com categorias representativas
    const gRes = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('Losartana 50mg Genérico Eurofarma', '789123450001', 'Losartana', '10000001', 'RED', 'NONE', 30.0, 10.0, 20.0)
    `).run();
    genericProdId = Number(gRes.lastInsertRowid);

    const sRes = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('Corus 50mg Similar Bonificado', '789123450002', 'Losartana', '10000002', 'RED', 'NONE', 35.0, 12.0, 25.0)
    `).run();
    similarProdId = Number(sRes.lastInsertRowid);

    const eRes = db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('Cozaar 50mg Referência', '789123450003', 'Losartana', '10000003', 'RED', 'NONE', 60.0, 30.0, 50.0)
    `).run();
    eticoProdId = Number(eRes.lastInsertRowid);
  });

  afterEach(() => {
    db.close();
  });

  it('should categorize pharmaceutical products accurately', () => {
    expect(service.resolveProductCategory({ name: 'Dipirona 500mg Genérico Medley' })).toBe('GENERICO');
    expect(service.resolveProductCategory({ name: 'Dorflex Similar Bonificado' })).toBe('SIMILAR');
    expect(service.resolveProductCategory({ name: 'Shampoo Anticaspa 200ml' })).toBe('PERFUMARIA');
    expect(service.resolveProductCategory({ name: 'Cápsula Magistral Personalizada' })).toBe('MANIPULADO');
    expect(service.resolveProductCategory({ name: 'Paracetamol 750mg', stripe: 'NONE' })).toBe('OTC');
    expect(service.resolveProductCategory({ name: 'Lipitor 20mg', stripe: 'RED' })).toBe('ETICO');
  });

  it('should list sellers and update commission rules', () => {
    const sellers = service.listSellers();
    expect(sellers.length).toBeGreaterThanOrEqual(1);
    expect(sellers[0].id).toBe(sellerId);

    // Atualiza percentual de Genéricos de 6.0% para 8.0%
    const updated = service.updateRule('GENERICO', 8.0, 'Incentivo máximo à intercambialidade');
    expect(updated.percentage).toBe(8.0);

    const rules = service.listRules();
    const gRule = rules.find((r) => r.category_type === 'GENERICO');
    expect(gRule?.percentage).toBe(8.0);
  });

  it('should set and retrieve monthly sales goals and calculate progress', () => {
    const goal = service.setSalesGoal({
      seller_id: sellerId,
      store_id: storeId,
      period_month: '2026-11',
      target_amount: 20000.0,
    });

    expect(goal.target_amount).toBe(20000.0);
    expect(goal.progress_percentage).toBe(0.0);

    const list = service.listGoals('2026-11', storeId);
    expect(list.length).toBe(1);
    expect(list[0].seller_name).toBe('Marcos Vinicius Balconista');
  });

  it('should calculate sale commissions, apply campaign bonus and accelerator', () => {
    const today = '2026-11-23';
    const periodMonth = '2026-11';

    // 1. Cria campanha ativa para a Eurofarma: +R$ 2.00 por caixa
    service.createCampaign({
      name: 'Campanha Eurofarma Novembro',
      manufacturer: 'Eurofarma',
      bonus_per_unit: 2.00,
      start_date: '2026-11-01',
      end_date: '2026-11-30',
    });

    // 2. Define meta pequena para o vendedor bater 100% (ex: R$ 50.00)
    service.setSalesGoal({
      seller_id: sellerId,
      store_id: storeId,
      period_month: periodMonth,
      target_amount: 50.0,
    });

    // 3. Cadastra venda com 2 caixas de Genérico Eurofarma (2 x R$ 20.00 = R$ 40.00)
    // e 1 caixa de Referência Cozaar (1 x R$ 50.00 = R$ 50.00). Total da venda: R$ 90.00
    const saleRes = db.prepare(`
      INSERT INTO sales (total_amount, discount_amount, change_amount, created_at)
      VALUES (90.0, 0.0, 0.0, '2026-11-23 14:00:00')
    `).run();
    const saleId = Number(saleRes.lastInsertRowid);

    // Lotes
    const b1 = db.prepare("INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity) VALUES (?, 'L1', '2026-01-01', '2028-01-01', 50)").run(genericProdId);
    const b2 = db.prepare("INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity) VALUES (?, 'L2', '2026-01-01', '2028-01-01', 50)").run(eticoProdId);

    // Itens da venda
    db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, 2, 20.0, 40.0)
    `).run(saleId, genericProdId, b1.lastInsertRowid);

    db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, 1, 50.0, 50.0)
    `).run(saleId, eticoProdId, b2.lastInsertRowid);

    // 4. Apura comissão da venda
    const statements = service.calculateSaleCommissions({
      seller_id: sellerId,
      sale_id: saleId,
      sale_date: today,
    });

    expect(statements).toHaveLength(2);

    // Item 1 (Genérico): R$ 40.00 * 6% = R$ 2.40 base.
    // Campanha: 2 un * R$ 2.00 = R$ 4.00 bônus.
    // Soma = 6.40. Acelerador >= 100% (90/50 = 180% da meta) = 1.25x.
    // Final = 6.40 * 1.25 = R$ 8.00!
    const genStmt = statements.find((s) => s.product_id === genericProdId);
    expect(genStmt).toBeDefined();
    expect(genStmt?.category_type).toBe('GENERICO');
    expect(genStmt?.base_commission_amount).toBe(2.40);
    expect(genStmt?.campaign_bonus_amount).toBe(4.00);
    expect(genStmt?.accelerator_multiplier).toBe(1.25);
    expect(genStmt?.final_commission_amount).toBe(8.00);

    // Item 2 (Ético): R$ 50.00 * 1.5% = R$ 0.75 base. Bônus = 0.
    // Final = 0.75 * 1.25 = R$ 0.94!
    const eticoStmt = statements.find((s) => s.product_id === eticoProdId);
    expect(eticoStmt).toBeDefined();
    expect(eticoStmt?.category_type).toBe('ETICO');
    expect(eticoStmt?.final_commission_amount).toBe(0.94);

    // Valida meta atualizada
    const updatedGoal = service.getSalesGoal(sellerId, periodMonth);
    expect(updatedGoal.achieved_amount).toBe(90.0);
    expect(updatedGoal.status).toBe('ACHIEVED');
    expect(updatedGoal.progress_percentage).toBe(180.0);
  });

  it('should generate seller statement and close commissions for payroll', () => {
    const today = '2026-11-23';
    const periodMonth = '2026-11';

    // Cria venda
    const saleRes = db.prepare("INSERT INTO sales (total_amount) VALUES (30.0)").run();
    const saleId = Number(saleRes.lastInsertRowid);
    const b = db.prepare("INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity) VALUES (?, 'L3', '2026-01-01', '2028-01-01', 10)").run(genericProdId);

    db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, 1, 30.0, 30.0)
    `).run(saleId, genericProdId, b.lastInsertRowid);

    service.calculateSaleCommissions({
      seller_id: sellerId,
      sale_id: saleId,
      sale_date: today,
    });

    const stmt = service.getSellerStatement(sellerId, periodMonth);
    expect(stmt.length).toBeGreaterThanOrEqual(1);
    expect(stmt[0].status).toBe('PENDING');

    // Fechamento de folha: marca como PAID
    const closeResult = service.closeMonthlyCommissions(sellerId, periodMonth, 'PAID');
    expect(closeResult.updatedCount).toBeGreaterThanOrEqual(1);
    expect(closeResult.totalAmount).toBeGreaterThan(0);

    const updatedStmt = service.getSellerStatement(sellerId, periodMonth);
    expect(updatedStmt[0].status).toBe('PAID');
  });

  it('should return accurate commission KPIs', () => {
    const kpis = service.getCommissionKpis('2026-11');
    expect(kpis).toBeDefined();
    expect(kpis.totalCommissionsCurrentMonth).toBeDefined();
    expect(kpis.globalGoalProgressPercent).toBeDefined();
  });
});
