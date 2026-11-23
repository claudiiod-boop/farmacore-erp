import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { QuotationOptimizerService } from '../../../src/modules/b2b/quotation-optimizer.service';

describe('QuotationOptimizerService (Otimizador de Cotação: Split Order vs Pedido Fechado)', () => {
  let db: Database;
  let service: QuotationOptimizerService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new QuotationOptimizerService(db);

    // Insere produtos
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES 
        (1, '789000000001', 'Dipirona 500mg Gotas', 'Dipirona', '1000000000001', 'SEM_TARJA', 'ISENTO', 10.0, 5.0, 7.50),
        (2, '789000000002', 'Amoxicilina 500mg 21 caps', 'Amoxicilina', '1000000000002', 'VERMELHA', 'ANTIMICROBIANO', 35.0, 20.0, 28.00)
    `).run();

    // Insere distribuidores
    db.prepare(`
      INSERT INTO b2b_suppliers (id, code, name, trade_name, cnpj, min_order_value, lead_time_days)
      VALUES 
        (10, 'SUPP-SC', 'Distribuidora Santa Cruz Ltda', 'Santa Cruz', '11222333000199', 300.0, 1),
        (20, 'SUPP-PAN', 'Panpharma Medicamentos S/A', 'Panpharma', '44555666000188', 300.0, 2)
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('should run SPLIT ORDER optimization picking the lowest net unit price per item', () => {
    // 1. Cria campanha com 2 itens
    const campaign = service.createCampaign({
      storeId: 1,
      title: 'Cotação Semanal de Reposição',
      items: [
        { productId: 1, currentStock: 2, suggestedQuantity: 50, requestedQuantity: 50, targetPrice: 5.00 },
        { productId: 2, currentStock: 5, suggestedQuantity: 20, requestedQuantity: 20, targetPrice: 18.00 }
      ]
    });

    expect(campaign.id).toBeDefined();
    expect(campaign.items?.length).toBe(2);

    const qItem1 = campaign.items![0].id!;
    const qItem2 = campaign.items![1].id!;

    // 2. Registra proposta da Santa Cruz (Fornecedor 10):
    // Item 1 (Dipirona): R$ 4.50 (Mais barata!)
    // Item 2 (Amoxicilina): R$ 19.00
    service.submitProposal({
      campaignId: campaign.id!,
      supplierId: 10,
      proposalCode: 'PROP-SC-1001',
      items: [
        { quotationItemId: qItem1, productId: 1, offeredPrice: 4.50, discountPercent: 0, availableQuantity: 50 },
        { quotationItemId: qItem2, productId: 2, offeredPrice: 19.00, discountPercent: 0, availableQuantity: 20 }
      ]
    });

    // 3. Registra proposta da Panpharma (Fornecedor 20):
    // Item 1 (Dipirona): R$ 5.20
    // Item 2 (Amoxicilina): R$ 17.50 (Mais barata!)
    service.submitProposal({
      campaignId: campaign.id!,
      supplierId: 20,
      proposalCode: 'PROP-PAN-2002',
      items: [
        { quotationItemId: qItem1, productId: 1, offeredPrice: 5.20, discountPercent: 0, availableQuantity: 50 },
        { quotationItemId: qItem2, productId: 2, offeredPrice: 17.50, discountPercent: 0, availableQuantity: 20 }
      ]
    });

    // 4. Executa Otimização em Modo SPLIT_ORDER
    const result = service.optimizeCampaign(campaign.id!, 'SPLIT_ORDER');

    expect(result.optimizationMode).toBe('SPLIT_ORDER');
    expect(result.awardedOrders.length).toBe(2);

    const scOrder = result.awardedOrders.find(o => o.supplierId === 10);
    const panOrder = result.awardedOrders.find(o => o.supplierId === 20);

    // Santa Cruz deve vencer a Dipirona (R$ 4.50 x 50 = R$ 225.00)
    expect(scOrder?.items.length).toBe(1);
    expect(scOrder?.items[0].productId).toBe(1);
    expect(scOrder?.items[0].unitPrice).toBe(4.50);

    // Panpharma deve vencer a Amoxicilina (R$ 17.50 x 20 = R$ 350.00)
    expect(panOrder?.items.length).toBe(1);
    expect(panOrder?.items[0].productId).toBe(2);
    expect(panOrder?.items[0].unitPrice).toBe(17.50);

    // Economia total calculada vs maior preço ofertado
    // Dipirona: economizou (5.20 - 4.50) * 50 = 35.00
    // Amoxicilina: economizou (19.00 - 17.50) * 20 = 30.00
    // Total economizado: 65.00
    expect(result.totalCampaignSavings).toBe(65.00);
  });

  it('should run SINGLE SUPPLIER BEST TOTAL optimization awarding all items to the lowest total cost distributor', () => {
    const campaign = service.createCampaign({
      storeId: 1,
      title: 'Cotação Fechada',
      items: [
        { productId: 1, currentStock: 2, suggestedQuantity: 50, requestedQuantity: 50, targetPrice: 5.00 },
        { productId: 2, currentStock: 5, suggestedQuantity: 20, requestedQuantity: 20, targetPrice: 18.00 }
      ]
    });

    const qItem1 = campaign.items![0].id!;
    const qItem2 = campaign.items![1].id!;

    // Fornecedor 10: Total = (5.00 * 50) + (18.00 * 20) = 250 + 360 = R$ 610.00
    service.submitProposal({
      campaignId: campaign.id!,
      supplierId: 10,
      proposalCode: 'PROP-SC-FECHADO',
      items: [
        { quotationItemId: qItem1, productId: 1, offeredPrice: 5.00, discountPercent: 0, availableQuantity: 50 },
        { quotationItemId: qItem2, productId: 2, offeredPrice: 18.00, discountPercent: 0, availableQuantity: 20 }
      ]
    });

    // Fornecedor 20: Total = (4.80 * 50) + (17.00 * 20) = 240 + 340 = R$ 580.00 (Vencedor Geral!)
    service.submitProposal({
      campaignId: campaign.id!,
      supplierId: 20,
      proposalCode: 'PROP-PAN-FECHADO',
      items: [
        { quotationItemId: qItem1, productId: 1, offeredPrice: 4.80, discountPercent: 0, availableQuantity: 50 },
        { quotationItemId: qItem2, productId: 2, offeredPrice: 17.00, discountPercent: 0, availableQuantity: 20 }
      ]
    });

    const result = service.optimizeCampaign(campaign.id!, 'SINGLE_SUPPLIER_BEST_TOTAL');

    expect(result.awardedOrders.length).toBe(1);
    expect(result.awardedOrders[0].supplierId).toBe(20);
    expect(result.awardedOrders[0].items.length).toBe(2);
    expect(result.awardedOrders[0].totalOrderAmount).toBe(580.00);
    expect(result.totalCampaignSavings).toBe(30.00); // 610 - 580
  });
});
