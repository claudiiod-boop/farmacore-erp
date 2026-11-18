import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { FinancialReportsService } from '../../../src/modules/financial/financial-reports.service';

describe('FinancialReportsService (DRE Gerencial & Curva ABC)', () => {
  let db: Database;
  let service: FinancialReportsService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new FinancialReportsService(db);
  });

  afterEach(() => {
    db.close();
  });

  // Helper to insert a product
  const insertProduct = (params: {
    ean: string;
    name: string;
    category: 'REFERENCIA' | 'GENERICO' | 'SIMILAR' | 'PERFUMARIA' | 'CORRELATOS_OUTROS';
    pf: number;
    price: number;
  }) => {
    const info = db.prepare(`
      INSERT INTO products (
        ean, name, active_ingredient, ms_registration, stripe, control_type,
        pmc, pf, price, category
      ) VALUES (
        ?, ?, 'Principio Ativo', '1.0000.0000', 'SEM_TARJA', 'ISENTO',
        ?, ?, ?, ?
      )
    `).run(params.ean, params.name, params.price * 1.3, params.pf, params.price, params.category);

    const productId = Number(info.lastInsertRowid);

    // Create a batch
    const batchInfo = db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
      VALUES (?, 'LOTE001', '2026-01-01', '2028-12-31', 1000)
    `).run(productId);

    return { productId, batchId: Number(batchInfo.lastInsertRowid) };
  };

  // Helper to record a purchase invoice item for unit cost
  const recordPurchaseCost = (productId: number, unitCost: number) => {
    // Insert invoice
    const invInfo = db.prepare(`
      INSERT INTO purchase_invoices (
        access_key, invoice_number, invoice_series, issue_date, supplier_name, supplier_cnpj,
        total_invoice_amount, total_products_amount, xml_content
      ) VALUES ('35261100000000000000550010000001231000001234', 123, 1, '2026-11-01', 'DISTRIBUIDORA TESTE', '12345678000199', 1000.0, 1000.0, '<nfeProc/>')
    `).run();
    const invoiceId = Number(invInfo.lastInsertRowid);

    db.prepare(`
      INSERT INTO purchase_invoice_items (
        purchase_invoice_id, product_id, item_index, supplier_product_code, ean, product_name, ncm, cfop,
        quantity, unit_cost, total_cost
      ) VALUES (?, ?, 1, 'COD001', '789000000001', 'Produto Teste', '30049099', '5102', 100, ?, ?)
    `).run(invoiceId, productId, unitCost, unitCost * 100);
  };

  // Helper to insert a completed sale with items and payment
  const insertSale = (params: {
    createdAt: string;
    status?: 'COMPLETED' | 'CANCELLED';
    discount?: number;
    items: Array<{ productId: number; batchId: number; quantity: number; unitPrice: number }>;
    paymentMethod?: string;
  }) => {
    const totalAmount = params.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0) - (params.discount || 0);

    const saleInfo = db.prepare(`
      INSERT INTO sales (status, total_amount, discount_amount, created_at)
      VALUES (?, ?, ?, ?)
    `).run(params.status || 'COMPLETED', totalAmount, params.discount || 0, params.createdAt);
    const saleId = Number(saleInfo.lastInsertRowid);

    for (const item of params.items) {
      db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(saleId, item.productId, item.batchId, item.quantity, item.unitPrice, item.quantity * item.unitPrice);
    }

    if (params.paymentMethod) {
      db.prepare(`
        INSERT INTO sale_payments (sale_id, method, amount)
        VALUES (?, ?, ?)
      `).run(saleId, params.paymentMethod, totalAmount);
    }

    return saleId;
  };

  describe('generateDre', () => {
    it('should generate an accurate managerial DRE with CMV from purchases, discounts, TEF fees, and sangrias', () => {
      // 1. Produtos
      const prodA = insertProduct({
        ean: '789000000001',
        name: 'Dipirona 500mg',
        category: 'GENERICO',
        pf: 8.0,
        price: 15.0,
      });
      // Compra com custo unitário real de R$ 6.00 (mais barato que o PF de 8.00)
      recordPurchaseCost(prodA.productId, 6.0);

      const prodB = insertProduct({
        ean: '789000000002',
        name: 'Shampoo Anticaspa',
        category: 'PERFUMARIA',
        pf: 18.0, // Sem compra registrada, deve usar o PF de R$ 18.00
        price: 30.0,
      });

      // 2. Venda 1: 10 unidades de Dipirona (10 * 15 = 150) com R$ 10 de desconto -> Total R$ 140
      const saleId1 = insertSale({
        createdAt: '2026-11-15 10:00:00',
        status: 'COMPLETED',
        discount: 10.0,
        items: [{ productId: prodA.productId, batchId: prodA.batchId, quantity: 10, unitPrice: 15.0 }],
        paymentMethod: 'CARTAO_CREDITO',
      });

      // TEF transaction para a venda 1 (taxa de 2.5% = R$ 3.50)
      db.prepare(`
        INSERT INTO tef_configs (provider_id, provider_name, environment) VALUES ('MOCK', 'Mock Gateway', 'MOCK')
      `).run();
      db.prepare(`
        INSERT INTO tef_transactions (
          transaction_uuid, provider_id, terminal_id, sale_id, operation_type,
          status, amount, brand_name, brand_code_sefaz, acquirer_name, acquirer_cnpj,
          authorization_code, nsu, host_nsu, mdr_rate, net_amount, created_at
        ) VALUES (
          'uuid-dre-1', 'MOCK', 'SE000001', ?, 'CREDITO',
          'CONFIRMED', 140.0, 'VISA', '01', 'CIELO', '12345678000199',
          'AUTH1', 'NSU1', 'H1', 2.5, 136.5, '2026-11-15 10:00:00'
        )
      `).run(saleId1);

      // 3. Venda 2: 5 unidades de Shampoo (5 * 30 = 150) sem desconto -> Total R$ 150 (Dinheiro)
      insertSale({
        createdAt: '2026-11-16 14:00:00',
        status: 'COMPLETED',
        items: [{ productId: prodB.productId, batchId: prodB.batchId, quantity: 5, unitPrice: 30.0 }],
        paymentMethod: 'DINHEIRO',
      });

      // 4. Venda Cancelada (R$ 50) no período
      insertSale({
        createdAt: '2026-11-16 16:00:00',
        status: 'CANCELLED',
        items: [{ productId: prodA.productId, batchId: prodA.batchId, quantity: 3, unitPrice: 15.0 }],
      });

      // 5. Despesas Operacionais (Sangria para despesa de materiais de limpeza: R$ 25.00)
      db.prepare(`
        INSERT INTO cash_sessions (operator_name, initial_cash, current_cash, status)
        VALUES ('Operador', 100.0, 75.0, 'OPEN')
      `).run();
      db.prepare(`
        INSERT INTO cash_movements (cash_session_id, type, amount, reason, operator_name, created_at)
        VALUES (1, 'SANGRIA', 25.0, 'Material de limpeza e expediente', 'Operador', '2026-11-16 17:00:00')
      `).run();

      const dre = service.generateDre('2026-11-01', '2026-11-30');

      // Receita Bruta = 150 (Venda 1 itens) + 150 (Venda 2 itens) = 300.0
      expect(dre.grossRevenue).toBe(300.0);
      expect(dre.discounts).toBe(10.0);
      expect(dre.cancellations).toBe(45.0);
      expect(dre.tefFees).toBe(3.5); // 140 - 136.50 = 3.50
      // Receita Líquida = 300 - 10 (descontos) - 45 (cancelamentos) - 3.5 (taxas tef) = 241.50
      expect(dre.netRevenue).toBe(241.5);

      // CMV = (10 Dipironas * 6.00 de custo de compra) + (5 Shampoos * 18.00 de PF) = 60 + 90 = 150.0
      expect(dre.cmv).toBe(150.0);

      // Lucro Bruto = 241.50 - 150.00 = 91.50
      expect(dre.grossProfit).toBe(91.5);
      // Margem Bruta = (91.50 / 241.50) * 100 = 37.89%
      expect(dre.grossMarginPercent).toBe(37.89);

      // Despesas Operacionais (Sangria) = 25.00
      expect(dre.operatingExpenses).toBe(25.0);

      // Lucro Operacional Líquido = 91.50 - 25.00 = 66.50
      expect(dre.netOperatingProfit).toBe(66.5);
      // Margem Líquida = (66.50 / 241.50) * 100 = 27.54%
      expect(dre.netMarginPercent).toBe(27.54);

      expect(dre.salesCount).toBe(2);
      expect(dre.itemsSold).toBe(15); // 10 dipironas + 5 shampoos
    });
  });

  describe('generateAbcCurve', () => {
    it('should rank products by revenue share and classify into Pareto classes A, B, and C', () => {
      // Cria 4 produtos de diferentes categorias
      // Prod 1: Venda R$ 1000 (deve ser Classe A, ~70% do faturamento)
      const p1 = insertProduct({
        ean: '789111111111',
        name: 'Medicamento Referência Premium',
        category: 'REFERENCIA',
        pf: 50.0,
        price: 100.0,
      });

      // Prod 2: Venda R$ 250 (~17% do faturamento, atinge 87% acumulado -> cruza 80%, Classe B)
      const p2 = insertProduct({
        ean: '789222222222',
        name: 'Genérico Campeão de Vendas',
        category: 'GENERICO',
        pf: 10.0,
        price: 25.0,
      });

      // Prod 3: Venda R$ 100 (~7% do faturamento, atinge 94% acumulado -> Classe B)
      const p3 = insertProduct({
        ean: '789333333333',
        name: 'Similar Pop',
        category: 'SIMILAR',
        pf: 8.0,
        price: 20.0,
      });

      // Prod 4: Venda R$ 50 (~3.5% do faturamento, atinge 97.5% -> Classe C)
      const p4 = insertProduct({
        ean: '789444444444',
        name: 'Sabonete Dermocosmético',
        category: 'PERFUMARIA',
        pf: 5.0,
        price: 10.0,
      });

      // Vendas:
      // Total faturamento = 1000 + 250 + 100 + 50 = 1400.00
      insertSale({
        createdAt: '2026-11-10 10:00:00',
        items: [
          { productId: p1.productId, batchId: p1.batchId, quantity: 10, unitPrice: 100.0 }, // 1000
          { productId: p2.productId, batchId: p2.batchId, quantity: 10, unitPrice: 25.0 },  // 250
          { productId: p3.productId, batchId: p3.batchId, quantity: 5, unitPrice: 20.0 },   // 100
          { productId: p4.productId, batchId: p4.batchId, quantity: 5, unitPrice: 10.0 },   // 50
        ],
      });

      const report = service.generateAbcCurve('2026-11-01', '2026-11-30');

      expect(report.totalRevenue).toBe(1400.0);
      expect(report.totalProductsCount).toBe(4);
      expect(report.items.length).toBe(4);

      // Ranking ordenado
      expect(report.items[0].productName).toBe('Medicamento Referência Premium');
      expect(report.items[0].grossRevenue).toBe(1000.0);
      expect(report.items[0].revenueSharePercent).toBe(71.43);
      expect(report.items[0].abcClass).toBe('A');

      expect(report.items[1].productName).toBe('Genérico Campeão de Vendas');
      expect(report.items[1].grossRevenue).toBe(250.0);
      expect(report.items[1].abcClass).toBe('B');

      expect(report.items[3].productName).toBe('Sabonete Dermocosmético');
      expect(report.items[3].grossRevenue).toBe(50.0);
      expect(report.items[3].abcClass).toBe('C');

      // Verificação do sumário por categorias farmacêuticas
      expect(report.categoriesSummary.length).toBeGreaterThan(0);
      const genCat = report.categoriesSummary.find((c) => c.category === 'GENERICO');
      expect(genCat).toBeDefined();
      expect(genCat?.grossRevenue).toBe(250.0);
      expect(genCat?.quantitySold).toBe(10);
    });

    it('should filter Curva ABC by category', () => {
      const p1 = insertProduct({
        ean: '789999999001',
        name: 'Amoxicilina 500mg',
        category: 'GENERICO',
        pf: 10.0,
        price: 20.0,
      });
      const p2 = insertProduct({
        ean: '789999999002',
        name: 'Protetor Solar FPS 50',
        category: 'PERFUMARIA',
        pf: 25.0,
        price: 50.0,
      });

      insertSale({
        createdAt: '2026-11-12 11:00:00',
        items: [
          { productId: p1.productId, batchId: p1.batchId, quantity: 4, unitPrice: 20.0 }, // 80.0
          { productId: p2.productId, batchId: p2.batchId, quantity: 2, unitPrice: 50.0 }, // 100.0
        ],
      });

      const genericOnly = service.generateAbcCurve('2026-11-01', '2026-11-30', 'GENERICO');
      expect(genericOnly.items.length).toBe(1);
      expect(genericOnly.items[0].category).toBe('GENERICO');
      expect(genericOnly.totalRevenue).toBe(80.0);
    });
  });
});
