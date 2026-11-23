import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('B2B Purchasing, Quotations & EDI Farma REST API Routes (/api/b2b/*)', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    // Insere produtos de teste
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES 
        (1, '7891234567890', 'Dipirona 500mg Gotas', 'Dipirona', '1000000000001', 'SEM_TARJA', 'ISENTO', 10.0, 5.0, 7.50),
        (2, '7899876543210', 'Amoxicilina 500mg 21 caps', 'Amoxicilina', '1000000000002', 'VERMELHA', 'ANTIMICROBIANO', 35.0, 20.0, 28.00)
    `).run();

    app = fastify();
    await registerRoutes(app, db);
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('should list replenishment suggestions based on inventory status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/b2b/replenishment/suggestions?storeId=1',
    });

    expect(res.statusCode).toBe(200);
    const suggestions = JSON.parse(res.body);
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBe(2);
    expect(suggestions[0].ean).toBeDefined();
    expect(suggestions[0].ruptureRisk).toBe('HIGH'); // sem estoque
  });

  it('should register and list B2B distributor suppliers', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/b2b/suppliers',
      payload: {
        code: 'SUPP-SC',
        name: 'Santa Cruz Distribuidora de Medicamentos',
        tradeName: 'Santa Cruz',
        cnpj: '12345678000199',
        ediCode: 'SC-001',
        minOrderValue: 400.0,
        leadTimeDays: 1,
        paymentTerms: '28 DDL',
      },
    });

    expect(postRes.statusCode).toBe(201);
    const created = JSON.parse(postRes.body);
    expect(created.id).toBeDefined();
    expect(created.code).toBe('SUPP-SC');

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/b2b/suppliers',
    });

    expect(getRes.statusCode).toBe(200);
    const suppliers = JSON.parse(getRes.body);
    expect(suppliers.length).toBe(1);
    expect(suppliers[0].name).toContain('Santa Cruz');
  });

  it('should run complete B2B quotation lifecycle: create campaign, export EDI, import proposals and optimize', async () => {
    // 1. Cadastra 2 fornecedores
    await app.inject({
      method: 'POST',
      url: '/api/b2b/suppliers',
      payload: { code: 'SUPP-SC', name: 'Santa Cruz', cnpj: '11111111000199', minOrderValue: 200 },
    });
    await app.inject({
      method: 'POST',
      url: '/api/b2b/suppliers',
      payload: { code: 'SUPP-PAN', name: 'Panpharma', cnpj: '22222222000188', minOrderValue: 200 },
    });

    // 2. Cria campanha de cotação
    const campRes = await app.inject({
      method: 'POST',
      url: '/api/b2b/campaigns',
      payload: {
        storeId: 1,
        title: 'Cotação Semanal de Medicamentos Básicos',
        items: [
          { productId: 1, requestedQuantity: 40, suggestedQuantity: 40, targetPrice: 5.0 },
          { productId: 2, requestedQuantity: 20, suggestedQuantity: 20, targetPrice: 18.0 },
        ],
      },
    });

    expect(campRes.statusCode).toBe(201);
    const campaign = JSON.parse(campRes.body);
    expect(campaign.id).toBeDefined();
    expect(campaign.campaignCode).toContain('COT-');

    // 3. Exporta arquivo de espelho EDI Farma
    const ediRes = await app.inject({
      method: 'POST',
      url: `/api/b2b/campaigns/${campaign.id}/export-edi`,
    });

    expect(ediRes.statusCode).toBe(200);
    const ediData = JSON.parse(ediRes.body);
    expect(ediData.content).toContain('HDR|');
    expect(ediData.content).toContain('ITM|7891234567890|');

    // 4. Importa proposta EDI da Santa Cruz (Fornecedor 1)
    const ediSantaCruz = `
HDR|${campaign.campaignCode}|11111111000199|SANTA CRUZ
ITM|7891234567890|4.80|0.0|40|1
ITM|7899876543210|19.50|0.0|20|1
TRL|2
    `.trim();

    const import1 = await app.inject({
      method: 'POST',
      url: `/api/b2b/campaigns/${campaign.id}/import-proposals`,
      payload: {
        ediContent: ediSantaCruz,
        proposalCode: 'PROP-SC-01',
      },
    });
    expect(import1.statusCode).toBe(201);

    // 5. Importa proposta EDI da Panpharma (Fornecedor 2)
    const ediPanpharma = `
HDR|${campaign.campaignCode}|22222222000188|PANPHARMA
ITM|7891234567890|5.30|0.0|40|1
ITM|7899876543210|17.20|0.0|20|1
TRL|2
    `.trim();

    const import2 = await app.inject({
      method: 'POST',
      url: `/api/b2b/campaigns/${campaign.id}/import-proposals`,
      payload: {
        ediContent: ediPanpharma,
        proposalCode: 'PROP-PAN-01',
      },
    });
    expect(import2.statusCode).toBe(201);

    // 6. Otimiza cotação em modo SPLIT_ORDER
    const optRes = await app.inject({
      method: 'POST',
      url: `/api/b2b/campaigns/${campaign.id}/optimize`,
      payload: { mode: 'SPLIT_ORDER' },
    });

    expect(optRes.statusCode).toBe(200);
    const optResult = JSON.parse(optRes.body);
    expect(optResult.awardedOrders.length).toBe(2);
    expect(optResult.totalCampaignSavings).toBeGreaterThan(0);

    // 7. Gera pedidos de compra oficiais
    const genOrderRes = await app.inject({
      method: 'POST',
      url: `/api/b2b/campaigns/${campaign.id}/generate-orders`,
    });
    expect(genOrderRes.statusCode).toBe(200);
    const genData = JSON.parse(genOrderRes.body);
    expect(genData.message).toContain('com sucesso');
  });
});
