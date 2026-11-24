import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { ReplenishmentService } from '../../../src/modules/replenishment/replenishment.service';

describe('ReplenishmentService (Reposição Inteligente, Ponto de Pedido & Sugestão de Compras)', () => {
  let db: Database;
  let service: ReplenishmentService;
  let prodA: number;
  let prodB: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new ReplenishmentService(db);

    // Produto A: Alto Giro (Dipirona)
    const p1 = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7891234500001', 'Dipirona 500mg 20 comp', 'Dipirona Monoidratada', '100430001', 'SEM_TARJA', 'NONE', 15.0, 5.0, 10.0)
    `).run();
    prodA = Number(p1.lastInsertRowid);

    // Produto B: Giro Médio (Omeprazol)
    const p2 = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7891234500002', 'Omeprazol 20mg 28 cápsulas', 'Omeprazol', '100430002', 'SEM_TARJA', 'NONE', 28.0, 10.0, 18.0)
    `).run();
    prodB = Number(p2.lastInsertRowid);
  });

  afterEach(() => {
    db.close();
  });

  it('1. Deve calcular a Demanda Média Diária (DMD) com base no histórico de vendas', () => {
    // Inserir vendas nos últimos 10 dias
    const today = new Date().toISOString().substring(0, 10);

    const bRes = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'L-DIP-01', '2024-01-01', '2027-01-01', 50)
    `).run(prodA);
    const batchId = Number(bRes.lastInsertRowid);

    // 60 unidades vendidas no período
    db.prepare(`
      INSERT INTO sngpc_movements (
        product_id, batch_id, movement_type, quantity, reference_type, reference_id, movement_date, ms_registration
      ) VALUES (?, ?, 'SAIDA_VENDA', 60, 'SALE', 101, ?, '100430001')
    `).run(prodA, batchId, today);

    const demand = service.calculateProductDemand(prodA, 1, 30);
    expect(demand.totalSold).toBe(60);
    expect(demand.dailyDemand).toBe(2.0); // 60 / 30 = 2.0 un/dia
  });

  it('2. Deve calcular Ponto de Pedido (PP), Estoque de Segurança e classificar status de ruptura', () => {
    // Dipirona com DMD de 3.0 un/dia
    const today = new Date().toISOString().substring(0, 10);
    const bRes = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'L-DIP-01', '2024-01-01', '2027-01-01', 5)
    `).run(prodA);
    const batchId = Number(bRes.lastInsertRowid);

    db.prepare(`
      INSERT INTO sngpc_movements (
        product_id, batch_id, movement_type, quantity, reference_type, reference_id, movement_date, ms_registration
      ) VALUES (?, ?, 'SAIDA_VENDA', 90, 'SALE', 101, ?, '100430001')
    `).run(prodA, batchId, today);

    // Parâmetros: Lead time 2 dias, Estoque segurança 3 dias
    db.prepare(`
      INSERT INTO replenishment_parameters (
        product_id, store_id, lead_time_days, safety_stock_days, review_cycle_days, abc_class
      ) VALUES (?, 1, 2, 3, 7, 'A')
    `).run(prodA);

    const analysis = service.computeProductStockAnalysis(prodA, 1, 30);
    expect(analysis).not.toBeNull();
    expect(analysis?.dailyDemand).toBe(3.0);
    expect(analysis?.safetyStock).toBe(9); // 3 dias * 3 un/dia = 9
    expect(analysis?.reorderPoint).toBe(15); // (2 dias * 3) + 9 = 15

    // Como currentStock é 5 e reorderPoint é 15, mas daysOfCover é 5 / 3 = 1.7 dias (< leadTime 2 dias)
    expect(analysis?.status).toBe('CRITICAL');
    expect(analysis?.suggestedQuantity).toBeGreaterThan(0);
  });

  it('3. Deve identificar produto com estoque zerado como OUT_OF_STOCK', () => {
    const analysis = service.computeProductStockAnalysis(prodB, 1, 30);
    expect(analysis).not.toBeNull();
    expect(analysis?.currentStock).toBe(0);
    expect(analysis?.status).toBe('OUT_OF_STOCK');
  });

  it('4. Deve gerar lista consolidada de sugestões de compra ordenada por risco', () => {
    const suggestions = service.generatePurchaseSuggestions(1, 30);
    expect(suggestions.length).toBeGreaterThanOrEqual(2);

    // Primeiro item deve ser OUT_OF_STOCK
    expect(suggestions[0].status).toBe('OUT_OF_STOCK');
  });

  it('5. Deve criar pedido de reposição a partir da sugestão de compra e atualizar status', () => {
    const order = service.createReplenishmentOrder({
      storeId: 1,
      distributor_name: 'Distribuidora Panpharma',
      notes: 'Reposição Emergencial',
      items: [
        {
          productId: prodA,
          orderQuantity: 30,
          unitCost: 5.0,
          suggestedQuantity: 30,
          currentStock: 5,
          reorderPoint: 15,
        },
      ],
    } as any);

    expect(order.id).toBeGreaterThan(0);
    expect(order.status).toBe('DRAFT');
    expect(order.total_items).toBe(1);
    expect(order.estimated_total).toBe(150.0);
    expect(order.items.length).toBe(1);
    expect(order.items[0].product_name).toContain('Dipirona');

    // Atualiza status para SUBMITTED
    const updated = service.updateOrderStatus(order.id, 'SUBMITTED');
    expect(updated.status).toBe('SUBMITTED');
  });

  it('6. Deve calcular KPIs de reposição em tempo real', () => {
    const kpis = service.getReplenishmentKpis(1);
    expect(kpis.out_of_stock_count).toBeGreaterThanOrEqual(1);
    expect(kpis.total_suggestions).toBeGreaterThanOrEqual(1);
    expect(kpis.total_estimated_cost).toBeGreaterThan(0);
  });
});
