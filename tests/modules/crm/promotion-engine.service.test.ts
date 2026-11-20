import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { PromotionEngineService, PromotionError } from '../../../src/modules/crm/promotion-engine.service';
import type {
  CreatePromotionInput,
  CartItemInput,
} from '../../../src/modules/crm/types';

describe('PromotionEngineService (Motor de Promoções Combinadas)', () => {
  let db: Database;
  let service: PromotionEngineService;
  let productAId: number;
  let productBId: number;
  let productCId: number;
  let customerMemberId: number;
  let customerNonMemberId: number;
  let birthdayCustomerId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new PromotionEngineService(db);

    // Seed store
    db.prepare(
      `INSERT OR IGNORE INTO stores (id, code, name, company_name, cnpj, ie, is_headquarters, street, number, neighborhood, city, state, zip_code, ibge_code, is_active)
       VALUES (1, 'LJ01', 'FarmaCore Matriz', 'FarmaCore Drogaria Ltda', '12.345.678/0001-90', '123456789', 1, 'Rua Principal', '100', 'Centro', 'São Paulo', 'SP', '01001-000', '3550308', 1)`
    ).run();

    // Seed products
    const resA = db.prepare(
      `INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
       VALUES ('7891000000001', 'Paracetamol 750mg c/ 20 comp', 'Paracetamol', '100000001', 'SEM_TARJA', 'LIBERADO', 15.00, 8.00, 10.00, 1)`
    ).run();
    productAId = Number(resA.lastInsertRowid);

    const resB = db.prepare(
      `INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
       VALUES ('7891000000002', 'Vitamina C 1g Efervescente c/ 10', 'Ácido Ascórbico', '100000002', 'SEM_TARJA', 'LIBERADO', 25.00, 12.00, 20.00, 1)`
    ).run();
    productBId = Number(resB.lastInsertRowid);

    const resC = db.prepare(
      `INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
       VALUES ('7891000000003', 'Protetor Solar FPS 50 200ml', 'Dióxido de Titânio', '100000003', 'SEM_TARJA', 'LIBERADO', 60.00, 30.00, 50.00, 1)`
    ).run();
    productCId = Number(resC.lastInsertRowid);

    // Seed customers
    const resCust1 = db.prepare(
      `INSERT INTO customers (store_id, name, cpf, birth_date)
       VALUES (1, 'Ana Membro Clube', '111.111.111-11', '1990-05-15')`
    ).run();
    customerMemberId = Number(resCust1.lastInsertRowid);

    // Register wallet for member customer
    db.prepare(
      `INSERT INTO loyalty_wallets (customer_id, current_balance, total_earned, total_redeemed, total_expired)
       VALUES (?, 50.0, 50.0, 0.0, 0.0)`
    ).run(customerMemberId);

    const resCust2 = db.prepare(
      `INSERT INTO customers (store_id, name, cpf, birth_date)
       VALUES (1, 'Bruno Sem Clube', '222.222.222-22', '1988-08-20')`
    ).run();
    customerNonMemberId = Number(resCust2.lastInsertRowid);

    // Birthday customer with birthday in November (current test month: 2026-11)
    const resCust3 = db.prepare(
      `INSERT INTO customers (store_id, name, cpf, birth_date)
       VALUES (1, 'Carla Aniversariante', '333.333.333-33', '1995-11-20')`
    ).run();
    birthdayCustomerId = Number(resCust3.lastInsertRowid);
  });

  afterEach(() => {
    db.close();
  });

  describe('CRUD de Promoções', () => {
    it('deve criar uma promoção com produtos e papéis (TRIGGER, REWARD, BOTH)', () => {
      const input: CreatePromotionInput = {
        name: 'Combo Especial Imunidade',
        description: 'Compre Paracetamol e ganhe desconto na Vitamina C',
        type: 'COMBO_CROSS_SELL',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        priority: 10,
        isActive: true,
        appliesTo: 'SPECIFIC_PRODUCTS',
        conditionsJson: {
          triggerProductId: productAId,
          rewardProductId: productBId,
          discountPercent: 50,
        },
        products: [
          { productId: productAId, role: 'TRIGGER' },
          { productId: productBId, role: 'REWARD', discountPercent: 50 },
        ],
      };

      const promo = service.createPromotion(input);
      expect(promo.id).toBeDefined();
      expect(promo.name).toBe('Combo Especial Imunidade');
      expect(promo.type).toBe('COMBO_CROSS_SELL');
      expect(promo.priority).toBe(10);
      expect(promo.isActive).toBe(true);
      expect(promo.products).toHaveLength(2);

      const triggerProd = promo.products.find((p) => p.productId === productAId);
      expect(triggerProd).toBeDefined();
      expect(triggerProd?.role).toBe('TRIGGER');

      const rewardProd = promo.products.find((p) => p.productId === productBId);
      expect(rewardProd).toBeDefined();
      expect(rewardProd?.role).toBe('REWARD');
      expect(rewardProd?.discountPercent).toBe(50);
    });

    it('deve buscar promoção por ID com produtos associados', () => {
      const created = service.createPromotion({
        name: 'Leve 3 Pague 2 Paracetamol',
        type: 'TAKE_MORE_PAY_LESS',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        conditionsJson: { takeQuantity: 3, payQuantity: 2 },
        products: [{ productId: productAId, role: 'BOTH' }],
      });

      const found = service.getPromotionById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe('Leve 3 Pague 2 Paracetamol');
      expect(found?.products).toHaveLength(1);
      expect(found?.products[0].productId).toBe(productAId);
      expect(found?.products[0].role).toBe('BOTH');
    });

    it('deve listar promoções com filtros (activeOnly, type, search)', () => {
      service.createPromotion({
        name: 'Promoção Ativa A',
        type: 'TAKE_MORE_PAY_LESS',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        isActive: true,
        conditionsJson: { takeQuantity: 3, payQuantity: 2 },
      });

      service.createPromotion({
        name: 'Promoção Inativa B',
        type: 'PROGRESSIVE_DISCOUNT',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        isActive: false,
        conditionsJson: { tiers: [] },
      });

      const all = service.listPromotions();
      expect(all.length).toBeGreaterThanOrEqual(2);

      const activeOnly = service.listPromotions({ activeOnly: true });
      expect(activeOnly.some((p) => p.name === 'Promoção Ativa A')).toBe(true);
      expect(activeOnly.some((p) => p.name === 'Promoção Inativa B')).toBe(false);

      const byType = service.listPromotions({ type: 'TAKE_MORE_PAY_LESS' });
      expect(byType.every((p) => p.type === 'TAKE_MORE_PAY_LESS')).toBe(true);

      const bySearch = service.listPromotions({ search: 'Inativa' });
      expect(bySearch).toHaveLength(1);
      expect(bySearch[0].name).toBe('Promoção Inativa B');
    });

    it('deve atualizar promoção existente e seus produtos vinculados', () => {
      const promo = service.createPromotion({
        name: 'Nome Original',
        type: 'CLUB_SPECIAL_PRICE',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        conditionsJson: { specialPrice: 25 },
        products: [{ productId: productAId, specialPrice: 25 }],
      });

      const updated = service.updatePromotion(promo.id, {
        name: 'Nome Atualizado',
        priority: 5,
        products: [{ productId: productBId, specialPrice: 18 }],
      });

      expect(updated.name).toBe('Nome Atualizado');
      expect(updated.priority).toBe(5);
      expect(updated.products).toHaveLength(1);
      expect(updated.products[0].productId).toBe(productBId);
      expect(updated.products[0].specialPrice).toBe(18);
    });

    it('deve excluir promoção e desvincular produtos', () => {
      const promo = service.createPromotion({
        name: 'Para Excluir',
        type: 'BIRTHDAY_DISCOUNT',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        conditionsJson: { discountPercent: 10 },
        products: [{ productId: productAId }],
      });

      const result = service.deletePromotion(promo.id);
      expect(result).toBe(true);

      const check = service.getPromotionById(promo.id);
      expect(check).toBeNull();
    });

    it('deve lançar PromotionError ao tentar atualizar ou excluir promoção inexistente', () => {
      expect(() => service.updatePromotion(9999, { name: 'X' })).toThrow(PromotionError);
      expect(() => service.deletePromotion(9999)).toThrow(PromotionError);
    });
  });

  describe('Motor de Avaliação de Carrinho (evaluateCart)', () => {
    const fixedDate = '2026-11-20T10:00:00.000Z';

    it('Cenário 1: TAKE_MORE_PAY_LESS (Leve 3 Pague 2)', () => {
      // Configura Leve 3 Pague 2 para o Produto A (preço R$ 10.00)
      service.createPromotion({
        name: 'Leve 3 Pague 2 Paracetamol',
        type: 'TAKE_MORE_PAY_LESS',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        priority: 10,
        conditionsJson: { takeQuantity: 3, payQuantity: 2 },
        products: [{ productId: productAId, role: 'BOTH' }],
      });

      // 1.1: Compra de 3 unidades a R$ 10 -> Total R$ 20 (R$ 10 de desconto)
      const cart3: CartItemInput[] = [{ productId: productAId, quantity: 3, unitPrice: 10.0 }];
      const res3 = service.evaluateCart(cart3, undefined, undefined, fixedDate);
      expect(res3.subtotal).toBe(30.0);
      expect(res3.totalDiscount).toBe(10.0);
      expect(res3.finalTotal).toBe(20.0);
      expect(res3.items[0].discountAmount).toBe(10.0);
      expect(res3.items[0].appliedPromotionType).toBe('TAKE_MORE_PAY_LESS');

      // 1.2: Compra de 6 unidades a R$ 10 -> Total R$ 40 (R$ 20 de desconto, 2 grátis)
      const cart6: CartItemInput[] = [{ productId: productAId, quantity: 6, unitPrice: 10.0 }];
      const res6 = service.evaluateCart(cart6, undefined, undefined, fixedDate);
      expect(res6.subtotal).toBe(60.0);
      expect(res6.totalDiscount).toBe(20.0);
      expect(res6.finalTotal).toBe(40.0);
      expect(res6.items[0].discountAmount).toBe(20.0);

      // 1.3: Compra de 2 unidades -> Não atinge o gatilho, sem desconto (Total R$ 20)
      const cart2: CartItemInput[] = [{ productId: productAId, quantity: 2, unitPrice: 10.0 }];
      const res2 = service.evaluateCart(cart2, undefined, undefined, fixedDate);
      expect(res2.subtotal).toBe(20.0);
      expect(res2.totalDiscount).toBe(0.0);
      expect(res2.finalTotal).toBe(20.0);
      expect(res2.items[0].discountAmount).toBe(0.0);
    });

    it('Cenário 2: PROGRESSIVE_DISCOUNT (Desconto Progressivo por Quantidade)', () => {
      // Configura faixas: 1 un = 0%, 2 un = 10%, 3+ un = 20% no Produto C (R$ 50.00 cada)
      service.createPromotion({
        name: 'Desconto Progressivo Protetor Solar',
        type: 'PROGRESSIVE_DISCOUNT',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        priority: 10,
        conditionsJson: {
          tiers: [
            { minQuantity: 1, maxQuantity: 1, discountPercent: 0 },
            { minQuantity: 2, maxQuantity: 2, discountPercent: 10 },
            { minQuantity: 3, discountPercent: 20 },
          ],
        },
        products: [{ productId: productCId, role: 'BOTH' }],
      });

      // 2.1: 1 unidade a R$ 50 -> R$ 50 (0% desconto)
      const res1 = service.evaluateCart([{ productId: productCId, quantity: 1, unitPrice: 50.0 }], undefined, undefined, fixedDate);
      expect(res1.subtotal).toBe(50.0);
      expect(res1.totalDiscount).toBe(0.0);
      expect(res1.finalTotal).toBe(50.0);

      // 2.2: 2 unidades -> R$ 45 cada (Total R$ 90, Desconto R$ 10)
      const res2 = service.evaluateCart([{ productId: productCId, quantity: 2, unitPrice: 50.0 }], undefined, undefined, fixedDate);
      expect(res2.subtotal).toBe(100.0);
      expect(res2.totalDiscount).toBe(10.0);
      expect(res2.finalTotal).toBe(90.0);
      expect(res2.items[0].finalUnitPrice).toBe(45.0);

      // 2.3: 3 unidades -> R$ 40 cada (Total R$ 120, Desconto R$ 30)
      const res3 = service.evaluateCart([{ productId: productCId, quantity: 3, unitPrice: 50.0 }], undefined, undefined, fixedDate);
      expect(res3.subtotal).toBe(150.0);
      expect(res3.totalDiscount).toBe(30.0);
      expect(res3.finalTotal).toBe(120.0);
      expect(res3.items[0].finalUnitPrice).toBe(40.0);
    });

    it('Cenário 3: COMBO_CROSS_SELL (Compre Produto A e ganhe 50% no Produto B)', () => {
      // Produto A = R$ 10.00, Produto B = R$ 20.00
      service.createPromotion({
        name: 'Combo Paracetamol + Vitamina C',
        type: 'COMBO_CROSS_SELL',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        priority: 10,
        conditionsJson: {
          triggerProductId: productAId,
          rewardProductId: productBId,
          discountPercent: 50,
        },
        products: [
          { productId: productAId, role: 'TRIGGER' },
          { productId: productBId, role: 'REWARD', discountPercent: 50 },
        ],
      });

      // 3.1: Apenas Produto A -> Sem desconto
      const resOnlyA = service.evaluateCart([{ productId: productAId, quantity: 1, unitPrice: 10.0 }], undefined, undefined, fixedDate);
      expect(resOnlyA.totalDiscount).toBe(0.0);
      expect(resOnlyA.finalTotal).toBe(10.0);

      // 3.2: Apenas Produto B -> Sem desconto
      const resOnlyB = service.evaluateCart([{ productId: productBId, quantity: 1, unitPrice: 20.0 }], undefined, undefined, fixedDate);
      expect(resOnlyB.totalDiscount).toBe(0.0);
      expect(resOnlyB.finalTotal).toBe(20.0);

      // 3.3: Compra de A (1x) e B (1x) -> Produto B ganha 50% de desconto (R$ 10 de desconto)
      const resCombo = service.evaluateCart(
        [
          { productId: productAId, quantity: 1, unitPrice: 10.0 },
          { productId: productBId, quantity: 1, unitPrice: 20.0 },
        ],
        undefined,
        undefined,
        fixedDate
      );
      expect(resCombo.subtotal).toBe(30.0);
      expect(resCombo.totalDiscount).toBe(10.0);
      expect(resCombo.finalTotal).toBe(20.0);

      const itemB = resCombo.items.find((i) => i.productId === productBId);
      expect(itemB?.finalUnitPrice).toBe(10.0);
      expect(itemB?.discountAmount).toBe(10.0);
      expect(itemB?.appliedPromotionType).toBe('COMBO_CROSS_SELL');
    });

    it('Cenário 4: CLUB_SPECIAL_PRICE (Preço Exclusivo do Clube da Drogaria)', () => {
      // Produto B: Normal R$ 30.00, Preço Clube R$ 22.00
      service.createPromotion({
        name: 'Preço Clube Vitamina C',
        type: 'CLUB_SPECIAL_PRICE',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        priority: 10,
        conditionsJson: { specialPrice: 22.0 },
        products: [{ productId: productBId, role: 'BOTH', specialPrice: 22.0 }],
      });

      // 4.1: Cliente não identificado ou sem carteira de fidelidade paga normal (R$ 30)
      const resNoClub = service.evaluateCart(
        [{ productId: productBId, quantity: 1, unitPrice: 30.0 }],
        customerNonMemberId,
        undefined,
        fixedDate
      );
      expect(resNoClub.totalDiscount).toBe(0.0);
      expect(resNoClub.finalTotal).toBe(30.0);

      // 4.2: Cliente membro do clube com carteira paga preço clube (R$ 22.00, desconto R$ 8.00)
      const resClub = service.evaluateCart(
        [{ productId: productBId, quantity: 1, unitPrice: 30.0 }],
        customerMemberId,
        undefined,
        fixedDate
      );
      expect(resClub.subtotal).toBe(30.0);
      expect(resClub.totalDiscount).toBe(8.0);
      expect(resClub.finalTotal).toBe(22.0);
      expect(resClub.items[0].finalUnitPrice).toBe(22.0);
      expect(resClub.items[0].discountAmount).toBe(8.0);
    });

    it('Cenário 5: BIRTHDAY_DISCOUNT (Desconto de Aniversariante)', () => {
      // 15% de desconto de aniversário para produtos em Novembro
      service.createPromotion({
        name: 'Mês de Aniversário FarmaCore',
        type: 'BIRTHDAY_DISCOUNT',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        priority: 5,
        appliesTo: 'ALL_PRODUCTS',
        conditionsJson: { discountPercent: 15.0 },
      });

      // 5.1: Cliente aniversariante em novembro ganha 15% de desconto
      const resBday = service.evaluateCart(
        [{ productId: productAId, quantity: 2, unitPrice: 20.0 }],
        birthdayCustomerId,
        undefined,
        fixedDate
      );
      // Subtotal = 40.0, 15% de 40 = 6.00, Total = 34.00
      expect(resBday.subtotal).toBe(40.0);
      expect(resBday.totalDiscount).toBe(6.0);
      expect(resBday.finalTotal).toBe(34.0);

      // 5.2: Cliente que não faz aniversário no mês paga preço normal
      const resNonBday = service.evaluateCart(
        [{ productId: productAId, quantity: 2, unitPrice: 20.0 }],
        customerMemberId, // Aniversário em Maio (1990-05-15)
        undefined,
        fixedDate
      );
      expect(resNonBday.subtotal).toBe(40.0);
      expect(resNonBday.totalDiscount).toBe(0.0);
      expect(resNonBday.finalTotal).toBe(40.0);
    });

    it('Cenário 6: Prioridade e Não-cumulatividade indevida de promoções', () => {
      // Cria promoção de baixa prioridade (10% desconto, prioridade 5)
      service.createPromotion({
        name: 'Desconto Geral 10%',
        type: 'PROGRESSIVE_DISCOUNT',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        priority: 5,
        conditionsJson: { tiers: [{ minQuantity: 1, discountPercent: 10 }] },
        products: [{ productId: productAId, role: 'BOTH' }],
      });

      // Cria promoção de alta prioridade (Leve 3 Pague 2 = ~33.3% desconto, prioridade 20)
      service.createPromotion({
        name: 'Leve 3 Pague 2 Prioritária',
        type: 'TAKE_MORE_PAY_LESS',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        priority: 20,
        conditionsJson: { takeQuantity: 3, payQuantity: 2 },
        products: [{ productId: productAId, role: 'BOTH' }],
      });

      // Avalia carrinho com 3 unidades a R$ 10 cada
      const res = service.evaluateCart(
        [{ productId: productAId, quantity: 3, unitPrice: 10.0 }],
        undefined,
        undefined,
        fixedDate
      );

      // Deve aplicar apenas a de maior prioridade (Leve 3 Pague 2 -> R$ 10 de desconto), NÃO acumulando os 10%
      expect(res.subtotal).toBe(30.0);
      expect(res.totalDiscount).toBe(10.0);
      expect(res.finalTotal).toBe(20.0);
      expect(res.appliedPromotions).toHaveLength(1);
      expect(res.appliedPromotions[0].name).toBe('Leve 3 Pague 2 Prioritária');
    });

    it('Cenário 7: Validação de teto CMED e preço final não-negativo', () => {
      // Cria promoção que daria 150% de desconto (erro de cadastro de campanha)
      service.createPromotion({
        name: 'Mega Desconto Irregular',
        type: 'PROGRESSIVE_DISCOUNT',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        priority: 10,
        conditionsJson: { tiers: [{ minQuantity: 1, discountPercent: 150 }] },
        products: [{ productId: productAId, role: 'BOTH' }],
      });

      const res = service.evaluateCart(
        [{ productId: productAId, quantity: 1, unitPrice: 10.0, cmedMaxPrice: 12.0 }],
        undefined,
        undefined,
        fixedDate
      );

      // Preço final nunca pode ser negativo
      expect(res.finalTotal).toBeGreaterThanOrEqual(0.0);
      expect(res.items[0].finalUnitPrice).toBeGreaterThanOrEqual(0.0);
      expect(res.totalDiscount).toBeLessThanOrEqual(10.0);

      // Validação de teto CMED: se unitPrice original estivesse acima do teto CMED, deve ser travado no teto
      const resCmed = service.evaluateCart(
        [{ productId: productBId, quantity: 1, unitPrice: 35.0, cmedMaxPrice: 25.0 }],
        undefined,
        undefined,
        fixedDate
      );
      expect(resCmed.items[0].finalUnitPrice).toBeLessThanOrEqual(25.0);
    });
  });
});
