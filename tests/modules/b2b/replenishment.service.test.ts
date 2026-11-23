import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { ReplenishmentService } from '../../../src/modules/b2b/replenishment.service';

describe('ReplenishmentService (Ponto de Pedido, Consumo Médio Diário e Curva ABC)', () => {
  let db: Database;
  let service: ReplenishmentService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new ReplenishmentService(db);

    // Cria produtos de teste
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES 
        (1, '789000000001', 'Dipirona 500mg Gotas', 'Dipirona', '1000000000001', 'SEM_TARJA', 'ISENTO', 10.0, 5.0, 7.50),
        (2, '789000000002', 'Amoxicilina 500mg 21 caps', 'Amoxicilina', '1000000000002', 'VERMELHA', 'ANTIMICROBIANO', 35.0, 20.0, 28.00),
        (3, '789000000003', 'Protetor Solar FPS 50', 'Filtro Solar', '1000000000003', 'SEM_TARJA', 'ISENTO', 60.0, 35.0, 49.90)
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('should calculate reorder point correctly based on CMD, lead time and safety stock', () => {
    // CMD = 5 unidades/dia, Lead Time = 2 dias, Estoque Segurança = 10 unidades
    // PP = (5 * 2) + 10 = 20
    const pp = service.calculateReorderPoint(5, 2, 10);
    expect(pp).toBe(20);
  });

  it('should generate replenishment suggestions for items below reorder point with high rupture risk', () => {
    // Produto 1: Dipirona - Estoque 2 unidades, Lote cadastrado
    db.prepare(`
      INSERT INTO batches (id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity)
      VALUES (1, 1, 'LOTE-DIP-01', '2026-01-01', '2028-01-01', 2, 0)
    `).run();

    // Simula vendas de Dipirona (60 unidades vendidas nos últimos 30 dias -> CMD = 2 un/dia)
    // Cria pré-venda e venda completada
    db.prepare(`
      INSERT INTO pre_sales (id, code, status, total_amount)
      VALUES (1, 'PV-TEST-01', 'FINALIZED', 450.0)
    `).run();

    db.prepare(`
      INSERT INTO pre_sale_items (pre_sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (1, 1, 1, 60, 7.50, 450.0)
    `).run();

    db.prepare(`
      INSERT INTO sales (id, pre_sale_id, status, total_amount, discount_amount, created_at)
      VALUES (1, 1, 'COMPLETED', 450.0, 0.0, date('now', '-5 days'))
    `).run();

    // Regra de reposição: Lead time = 2 dias, Estoque segurança = 4, Cobertura = 15 dias
    // PP = (2 un/dia * 2 dias) + 4 = 8 unidades
    // Estoque atual = 2 (menor que PP de 8!)
    // Qtd Sugerida = (2 * 15) - 2 = 28 unidades
    service.saveReplenishmentRule({
      storeId: 1,
      productId: 1,
      minStock: 5,
      safetyStock: 4,
      leadTimeDays: 2,
      coverageDays: 15,
      targetStock: 30,
      abcClass: 'A'
    });

    const suggestions = service.getReplenishmentSuggestions(1);
    const dipirona = suggestions.find(s => s.productId === 1);

    expect(dipirona).toBeDefined();
    expect(dipirona?.currentStock).toBe(2);
    expect(dipirona?.reorderPoint).toBe(8);
    expect(dipirona?.suggestedQuantity).toBe(28);
    expect(dipirona?.ruptureRisk).toBe('MEDIUM');
    expect(dipirona?.estimatedDaysUntilRupture).toBe(1);
  });

  it('should flag HIGH rupture risk when current stock is zero', () => {
    // Produto 2: Amoxicilina com estoque zero (sem lotes)
    // Regra cadastrada com minStock = 10
    service.saveReplenishmentRule({
      storeId: 1,
      productId: 2,
      minStock: 10,
      safetyStock: 5,
      leadTimeDays: 3,
      coverageDays: 10,
      targetStock: 25,
      abcClass: 'A'
    });

    const suggestions = service.getReplenishmentSuggestions(1);
    const amox = suggestions.find(s => s.productId === 2);

    expect(amox).toBeDefined();
    expect(amox?.currentStock).toBe(0);
    expect(amox?.ruptureRisk).toBe('HIGH');
    expect(amox?.estimatedDaysUntilRupture).toBe(0);
  });
});
