import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';
import { LoyaltyService } from '../../src/modules/crm/loyalty.service';
import { PromotionEngineService } from '../../src/modules/crm/promotion-engine.service';
import { TreatmentAdherenceService } from '../../src/modules/crm/treatment-adherence.service';

describe('CRM REST API Routes (/api/crm/*)', () => {
  let app: FastifyInstance;
  let db: Database;
  let loyaltyService: LoyaltyService;
  let promotionService: PromotionEngineService;
  let treatmentService: TreatmentAdherenceService;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    loyaltyService = new LoyaltyService(db);
    promotionService = new PromotionEngineService(db);
    treatmentService = new TreatmentAdherenceService(db);

    // Cria Loja 1
    db.prepare(
      `INSERT OR IGNORE INTO stores (id, code, name, company_name, cnpj, ie, is_headquarters, street, number, neighborhood, city, state, zip_code, ibge_code, is_active)
       VALUES (1, 'LJ01', 'FarmaCore Matriz', 'FarmaCore Drogaria Ltda', '12.345.678/0001-90', '123456789', 1, 'Rua Central', '100', 'Centro', 'São Paulo', 'SP', '01001-000', '3550308', 1)`
    ).run();

    // Cria Clientes de Teste
    db.prepare(
      `INSERT INTO customers (id, store_id, name, cpf, phone, email, birth_date)
       VALUES (1, 1, 'Maria Oliveira', '123.456.789-00', '(11) 98765-4321', 'maria.oliveira@email.com', '1985-11-15')`
    ).run();

    db.prepare(
      `INSERT INTO customers (id, store_id, name, cpf, phone, email, birth_date)
       VALUES (2, 1, 'João da Silva', '987.654.321-99', '(11) 91234-5678', 'joao.silva@email.com', '1990-05-20')`
    ).run();

    // Cria Produtos de Teste
    db.prepare(
      `INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
       VALUES (1, '7891111111111', 'Losartana Potássica 50mg 30 comp', 'Losartana Potássica 50mg', '1.0000.0001', 'TARJA_VERMELHA', 'LIBERADO', 40.0, 30.0, 25.0, 1)`
    ).run();

    db.prepare(
      `INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
       VALUES (2, '7892222222222', 'Metformina 850mg 60 comp', 'Cloridrato de Metformina 850mg', '1.0000.0002', 'TARJA_VERMELHA', 'LIBERADO', 35.0, 25.0, 20.0, 1)`
    ).run();

    db.prepare(
      `INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
       VALUES (3, '7893333333333', 'Vitamina C 1g 10 comp', 'Ácido Ascórbico', '1.0000.0003', 'SEM_TARJA', 'LIBERADO', 18.0, 12.0, 10.0, 1)`
    ).run();

    // Cria Vendas de Teste
    db.prepare(`INSERT INTO sales (id, total_amount) VALUES (101, 50.0)`).run();
    db.prepare(`INSERT INTO sales (id, total_amount) VALUES (102, 75.0)`).run();

    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  // =========================================================================
  // 1. ROTAS DE FIDELIDADE / CASHBACK (/api/crm/loyalty/*)
  // =========================================================================
  describe('Loyalty & Cashback Routes', () => {
    it('GET /api/crm/loyalty/program should return 200 with default program config', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/crm/loyalty/program',
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('cashbackPercent');
      expect(data.isActive).toBe(true);
    });

    it('PUT /api/crm/loyalty/program should return 200 when updated and 400 for invalid data', async () => {
      // 1. Sucesso na atualização
      const validUpdate = await app.inject({
        method: 'PUT',
        url: '/api/crm/loyalty/program',
        payload: {
          cashbackPercent: 5.0,
          validityDays: 60,
          minPurchaseAmount: 15.0,
          minRedeemAmount: 2.0,
          maxRedeemPercent: 50.0,
        },
      });

      expect(validUpdate.statusCode).toBe(200);
      const updated = validUpdate.json();
      expect(updated.cashbackPercent).toBe(5.0);
      expect(updated.validityDays).toBe(60);

      // 2. Erro de validação Zod (cashbackPercent negativo)
      const invalidUpdate = await app.inject({
        method: 'PUT',
        url: '/api/crm/loyalty/program',
        payload: {
          cashbackPercent: -10,
        },
      });

      expect(invalidUpdate.statusCode).toBe(400);
      const err = invalidUpdate.json();
      expect(err).toHaveProperty('message');
    });

    it('GET /api/crm/loyalty/wallet/:customerId should return 200 with wallet and 404 if customer not found', async () => {
      // 1. Sucesso para cliente existente (id: 1)
      const response = await app.inject({
        method: 'GET',
        url: '/api/crm/loyalty/wallet/1',
      });

      expect(response.statusCode).toBe(200);
      const wallet = response.json();
      expect(wallet.customerId).toBe(1);
      expect(wallet.currentBalance).toBe(0);

      // 2. Erro 404 para cliente inexistente
      const notFound = await app.inject({
        method: 'GET',
        url: '/api/crm/loyalty/wallet/9999',
      });

      expect(notFound.statusCode).toBe(404);
    });

    it('GET /api/crm/loyalty/wallet/:customerId/statement should return 200 with statement and textReceipt, or 404', async () => {
      // Credita algum cashback primeiro
      loyaltyService.creditCashback({
        saleId: 101,
        customerId: 1,
        saleAmount: 100.0,
        notes: 'Compra teste',
      });

      // 1. Sucesso com recibo formatado
      const response = await app.inject({
        method: 'GET',
        url: '/api/crm/loyalty/wallet/1/statement',
      });

      expect(response.statusCode).toBe(200);
      const statement = response.json();
      expect(statement).toHaveProperty('wallet');
      expect(statement).toHaveProperty('transactions');
      expect(statement).toHaveProperty('textReceipt');
      expect(statement.transactions.length).toBeGreaterThan(0);
      expect(statement.textReceipt).toContain('CLUBE FARMACORE - EXTRATO DE CASHBACK');

      // 2. 404 para cliente inexistente
      const notFound = await app.inject({
        method: 'GET',
        url: '/api/crm/loyalty/wallet/9999/statement',
      });

      expect(notFound.statusCode).toBe(404);
    });

    it('POST /api/crm/loyalty/redeem should return 200 on success, 400 on insufficient balance or invalid input, 404 on not found', async () => {
      // Credita cashback
      loyaltyService.creditCashback({
        saleId: 101,
        customerId: 1,
        saleAmount: 1000.0, // 3% = 30.00
      });

      // 1. Sucesso no resgate
      const redeemRes = await app.inject({
        method: 'POST',
        url: '/api/crm/loyalty/redeem',
        payload: {
          customerId: 1,
          saleAmount: 100.0,
          requestedRedeem: 15.0,
          saleId: 102,
        },
      });

      expect(redeemRes.statusCode).toBe(200);
      const redeemData = redeemRes.json();
      expect(redeemData.amount).toBe(15.0);
      expect(redeemData.type).toBe('REDEEM');

      // 2. Erro de saldo insuficiente (400)
      const failBalance = await app.inject({
        method: 'POST',
        url: '/api/crm/loyalty/redeem',
        payload: {
          customerId: 1,
          saleAmount: 100.0,
          requestedRedeem: 500.0,
        },
      });

      expect(failBalance.statusCode).toBe(400);

      // 3. 404 para cliente inexistente
      const failCustomer = await app.inject({
        method: 'POST',
        url: '/api/crm/loyalty/redeem',
        payload: {
          customerId: 9999,
          saleAmount: 100.0,
          requestedRedeem: 5.0,
        },
      });

      expect(failCustomer.statusCode).toBe(404);
    });

    it('POST /api/crm/loyalty/expire should return 200 with expiredCount and totalAmount', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/crm/loyalty/expire',
        payload: {
          referenceDate: '2027-01-01',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data).toHaveProperty('expiredCount');
      expect(data).toHaveProperty('totalAmount');
    });
  });

  // =========================================================================
  // 2. ROTAS DE PROMOÇÕES COMBINADAS (/api/crm/promotions/*)
  // =========================================================================
  describe('Promotions Routes', () => {
    it('GET /api/crm/promotions should return 200 with promotions list and support activeOnly filter', async () => {
      // Cria promoção de teste
      promotionService.createPromotion({
        name: 'Leve 3 Pague 2 Vitamina C',
        type: 'TAKE_MORE_PAY_LESS',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isActive: true,
        conditionsJson: { takeQuantity: 3, payQuantity: 2 },
        products: [{ productId: 3, role: 'BOTH' }],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/crm/promotions?activeOnly=true',
      });

      expect(response.statusCode).toBe(200);
      const promotions = response.json();
      expect(Array.isArray(promotions)).toBe(true);
      expect(promotions.length).toBe(1);
      expect(promotions[0].name).toBe('Leve 3 Pague 2 Vitamina C');
      expect(promotions[0].products.length).toBe(1);
    });

    it('POST /api/crm/promotions should return 201 on create and 400 on Zod validation error', async () => {
      // 1. Sucesso
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/crm/promotions',
        payload: {
          name: 'Promoção Progressiva Losartana',
          type: 'PROGRESSIVE_DISCOUNT',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          priority: 2,
          isActive: true,
          conditionsJson: {
            tiers: [
              { minQuantity: 2, maxQuantity: 2, discountPercent: 10 },
              { minQuantity: 3, discountPercent: 20 },
            ],
          },
          products: [{ productId: 1, role: 'TRIGGER' }],
        },
      });

      expect(createRes.statusCode).toBe(201);
      const created = createRes.json();
      expect(created).toHaveProperty('id');
      expect(created.name).toBe('Promoção Progressiva Losartana');

      // 2. Validação Zod (sem nome ou data inválida)
      const invalidRes = await app.inject({
        method: 'POST',
        url: '/api/crm/promotions',
        payload: {
          name: '',
          type: 'INVALID_TYPE',
        },
      });

      expect(invalidRes.statusCode).toBe(400);
    });

    it('GET /api/crm/promotions/:id should return 200 with products or 404', async () => {
      const promo = promotionService.createPromotion({
        name: 'Clube Losartana 50mg',
        type: 'CLUB_SPECIAL_PRICE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        conditionsJson: { specialPrice: 19.9 },
        products: [{ productId: 1, role: 'BOTH', specialPrice: 19.9 }],
      });

      // 1. Sucesso
      const res = await app.inject({
        method: 'GET',
        url: `/api/crm/promotions/${promo.id}`,
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.id).toBe(promo.id);
      expect(data.products.length).toBe(1);

      // 2. 404
      const notFound = await app.inject({
        method: 'GET',
        url: '/api/crm/promotions/9999',
      });

      expect(notFound.statusCode).toBe(404);
    });

    it('PUT /api/crm/promotions/:id should return 200 when updated or 404', async () => {
      const promo = promotionService.createPromotion({
        name: 'Promoção Antiga',
        type: 'TAKE_MORE_PAY_LESS',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        conditionsJson: { takeQuantity: 2, payQuantity: 1 },
      });

      // 1. Sucesso
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/crm/promotions/${promo.id}`,
        payload: {
          name: 'Promoção Atualizada',
          priority: 5,
        },
      });

      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.json().name).toBe('Promoção Atualizada');

      // 2. 404
      const notFound = await app.inject({
        method: 'PUT',
        url: '/api/crm/promotions/9999',
        payload: { name: 'Novo Nome' },
      });

      expect(notFound.statusCode).toBe(404);
    });

    it('DELETE /api/crm/promotions/:id should return 200 on delete or 404', async () => {
      const promo = promotionService.createPromotion({
        name: 'Promo Para Deletar',
        type: 'TAKE_MORE_PAY_LESS',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        conditionsJson: { takeQuantity: 2, payQuantity: 1 },
      });

      // 1. Sucesso
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/crm/promotions/${promo.id}`,
      });

      expect(delRes.statusCode).toBe(200);

      // 2. 404
      const notFound = await app.inject({
        method: 'DELETE',
        url: '/api/crm/promotions/9999',
      });

      expect(notFound.statusCode).toBe(404);
    });

    it('POST /api/crm/promotions/evaluate should return 200 with cart evaluation (e.g. Leve 3 Pague 2)', async () => {
      // Cadastra Leve 3 Pague 2 na Vitamina C (id: 3, preco: 10.00)
      promotionService.createPromotion({
        name: 'Leve 3 Pague 2 Vitamina C',
        type: 'TAKE_MORE_PAY_LESS',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        conditionsJson: { takeQuantity: 3, payQuantity: 2 },
        products: [{ productId: 3, role: 'BOTH' }],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/crm/promotions/evaluate',
        payload: {
          items: [
            {
              productId: 3,
              quantity: 3,
              unitPrice: 10.0,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('subtotal');
      expect(result).toHaveProperty('totalDiscount');
      expect(result).toHaveProperty('finalTotal');

      // Subtotal = 30.00, Desconto = 10.00 (1 unidade gratis), Final = 20.00
      expect(result.subtotal).toBe(30.0);
      expect(result.totalDiscount).toBe(10.0);
      expect(result.finalTotal).toBe(20.0);
    });
  });

  // =========================================================================
  // 3. ROTAS DE ADESÃO A TRATAMENTO (/api/crm/treatments/*)
  // =========================================================================
  describe('Treatment Adherence Routes', () => {
    let treatmentId: number;

    beforeEach(() => {
      // Registra um tratamento para cliente 1 com Losartana (id 1)
      const [treatment] = treatmentService.registerTreatmentFromSale({
        customerId: 1,
        saleId: 101,
        items: [
          {
            productId: 1,
            dailyDose: 1,
            unitsPerBox: 30,
            boxesPurchased: 1,
            startDate: '2026-11-01',
          },
        ],
      });
      treatmentId = treatment.id;
    });

    it('GET /api/crm/treatments/upcoming should return 200 with upcoming refill alerts and respect daysAhead', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/crm/treatments/upcoming?daysAhead=40',
      });

      expect(response.statusCode).toBe(200);
      const items = response.json();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
      expect(items[0]).toHaveProperty('treatmentId');
      expect(items[0]).toHaveProperty('customerName');
      expect(items[0]).toHaveProperty('productName');
      expect(items[0]).toHaveProperty('expectedRefillDate');
    });

    it('GET /api/crm/treatments/customer/:customerId should return 200 with customer treatment history or 404', async () => {
      // 1. Sucesso
      const response = await app.inject({
        method: 'GET',
        url: '/api/crm/treatments/customer/1',
      });

      expect(response.statusCode).toBe(200);
      const treatments = response.json();
      expect(Array.isArray(treatments)).toBe(true);
      expect(treatments.length).toBe(1);
      expect(treatments[0].customerId).toBe(1);

      // 2. 404 para cliente inexistente
      const notFound = await app.inject({
        method: 'GET',
        url: '/api/crm/treatments/customer/9999',
      });

      expect(notFound.statusCode).toBe(404);
    });

    it('POST /api/crm/treatments/:id/contact should return 200 and update status to CONTACTED or 404', async () => {
      // 1. Sucesso
      const response = await app.inject({
        method: 'POST',
        url: `/api/crm/treatments/${treatmentId}/contact`,
        payload: {
          notes: 'Paciente contatado por WhatsApp, virá amanhã',
        },
      });

      expect(response.statusCode).toBe(200);
      const updated = response.json();
      expect(updated.status).toBe('CONTACTED');
      expect(updated.notes).toContain('Paciente contatado por WhatsApp');

      // 2. 404 para tratamento inexistente
      const notFound = await app.inject({
        method: 'POST',
        url: '/api/crm/treatments/9999/contact',
        payload: { notes: 'Teste' },
      });

      expect(notFound.statusCode).toBe(404);
    });

    it('POST /api/crm/treatments/:id/discontinue should return 200 and update status to DISCONTINUED or 404', async () => {
      // 1. Sucesso
      const response = await app.inject({
        method: 'POST',
        url: `/api/crm/treatments/${treatmentId}/discontinue`,
        payload: {
          reason: 'Troca de medicamento prescrita pelo cardiologista',
        },
      });

      expect(response.statusCode).toBe(200);
      const updated = response.json();
      expect(updated.status).toBe('DISCONTINUED');
      expect(updated.notes).toContain('Troca de medicamento');

      // 2. 404 para tratamento inexistente
      const notFound = await app.inject({
        method: 'POST',
        url: '/api/crm/treatments/9999/discontinue',
        payload: { reason: 'Teste' },
      });

      expect(notFound.statusCode).toBe(404);
    });

    it('GET /api/crm/treatments/:id/slip should return 200 with thermal slip formatted with ESC/POS or 404', async () => {
      // 1. Sucesso
      const response = await app.inject({
        method: 'GET',
        url: `/api/crm/treatments/${treatmentId}/slip`,
      });

      expect(response.statusCode).toBe(200);
      const slipData = response.json();
      expect(slipData).toHaveProperty('textReceipt');
      expect(slipData).toHaveProperty('fullEscPos');
      expect(slipData.textReceipt).toContain('ALERTA DE RECOMPRA PREDITIVA');
      expect(slipData.textReceipt).toContain('Maria Oliveira');
      expect(slipData.textReceipt).toContain('Losartana Potássica');

      // 2. 404 para tratamento inexistente
      const notFound = await app.inject({
        method: 'GET',
        url: '/api/crm/treatments/9999/slip',
      });

      expect(notFound.statusCode).toBe(404);
    });
  });
});
