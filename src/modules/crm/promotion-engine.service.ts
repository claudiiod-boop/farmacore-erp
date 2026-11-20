// FarmaCore ERP — Motor de Promoções Combinadas (Fase 12)
import { getDatabase, Database } from '../../database/connection';
import type {
  Promotion,
  PromotionProduct,
  PromotionWithProducts,
  CreatePromotionInput,
  UpdatePromotionInput,
  PromotionFilter,
  CartItemInput,
  EvaluatedItem,
  AppliedPromotionSummary,
  CartEvaluationResult,
  PromotionType,
  PromotionAppliesTo,
  PromotionProductRole,
} from './types';

export class PromotionError extends Error {
  constructor(public code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'PromotionError';
  }
}

function round2(val: number): number {
  return Number(val.toFixed(2));
}

function safeParseConditions(conditionsJson?: string | Record<string, any> | null): Record<string, any> {
  if (typeof conditionsJson === 'object' && conditionsJson !== null) {
    return conditionsJson;
  }
  if (typeof conditionsJson === 'string') {
    try {
      return JSON.parse(conditionsJson || '{}');
    } catch {
      return {};
    }
  }
  return {};
}

function safeStringifyConditions(conditions?: string | Record<string, any> | null): string {
  if (typeof conditions === 'string') {
    return conditions;
  }
  return JSON.stringify(conditions ?? {});
}

export class PromotionEngineService {
  constructor(private db: Database = getDatabase()) {}

  /**
   * Mapeia registro do banco para a interface Promotion
   */
  private mapPromotion(row: any): Promotion {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      type: row.type as PromotionType,
      startDate: row.start_date,
      endDate: row.end_date,
      priority: Number(row.priority),
      isActive: Boolean(row.is_active),
      appliesTo: (row.applies_to || 'SPECIFIC_PRODUCTS') as PromotionAppliesTo,
      targetCategory: row.target_category ?? null,
      conditionsJson: row.conditions_json,
      createdAt: row.created_at,
      updatedAt: row.updated_at,

      // DB compatibility aliases
      start_date: row.start_date,
      end_date: row.end_date,
      is_active: row.is_active,
      applies_to: row.applies_to,
      target_category: row.target_category,
      conditions_json: row.conditions_json,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Mapeia registro do banco para a interface PromotionProduct
   */
  private mapPromotionProduct(row: any): PromotionProduct {
    return {
      id: row.id,
      promotionId: row.promotion_id,
      productId: row.product_id,
      role: (row.role || 'TRIGGER') as PromotionProductRole,
      specialPrice: row.special_price !== null && row.special_price !== undefined ? Number(row.special_price) : null,
      discountPercent: row.discount_percent !== null && row.discount_percent !== undefined ? Number(row.discount_percent) : null,
      createdAt: row.created_at,

      // DB compatibility aliases
      promotion_id: row.promotion_id,
      product_id: row.product_id,
      special_price: row.special_price !== null && row.special_price !== undefined ? Number(row.special_price) : null,
      discount_percent: row.discount_percent !== null && row.discount_percent !== undefined ? Number(row.discount_percent) : null,
      created_at: row.created_at,

      productName: row.product_name,
      productEan: row.product_ean,
      regularPrice: row.product_price !== null && row.product_price !== undefined ? Number(row.product_price) : undefined,
    };
  }

  /**
   * Cria uma nova promoção com seus produtos e papéis
   */
  createPromotion(input: CreatePromotionInput): PromotionWithProducts {
    const name = input.name?.trim();
    if (!name) {
      throw new PromotionError('INVALID_INPUT', 'O nome da promoção é obrigatório');
    }

    const type = input.type;
    const validTypes: PromotionType[] = [
      'TAKE_MORE_PAY_LESS',
      'PROGRESSIVE_DISCOUNT',
      'COMBO_CROSS_SELL',
      'CLUB_SPECIAL_PRICE',
      'BIRTHDAY_DISCOUNT',
    ];
    if (!validTypes.includes(type)) {
      throw new PromotionError('INVALID_TYPE', `Tipo de promoção inválido: ${type}`);
    }

    const startDate = input.startDate ?? input.start_date;
    const endDate = input.endDate ?? input.end_date;
    if (!startDate || !endDate) {
      throw new PromotionError('INVALID_DATES', 'As datas de início e fim da promoção são obrigatórias');
    }

    const priority = input.priority !== undefined ? Number(input.priority) : 1;
    const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : input.is_active !== undefined ? (input.is_active ? 1 : 0) : 1;
    const appliesTo = (input.appliesTo ?? input.applies_to ?? 'SPECIFIC_PRODUCTS') as PromotionAppliesTo;
    const targetCategory = input.targetCategory ?? input.target_category ?? null;
    const conditionsJson = safeStringifyConditions(input.conditionsJson ?? input.conditions_json);

    return this.db.transaction(() => {
      const res = this.db
        .prepare(
          `INSERT INTO promotions (
            name, description, type, start_date, end_date, priority, is_active, applies_to, target_category, conditions_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          name,
          input.description ?? null,
          type,
          startDate,
          endDate,
          priority,
          isActive,
          appliesTo,
          targetCategory,
          conditionsJson
        );

      const promotionId = Number(res.lastInsertRowid);

      if (input.products && input.products.length > 0) {
        const stmt = this.db.prepare(
          `INSERT INTO promotion_products (
            promotion_id, product_id, role, special_price, discount_percent
          ) VALUES (?, ?, ?, ?, ?)`
        );

        for (const prod of input.products) {
          const pId = prod.productId ?? prod.product_id;
          const role = prod.role || 'TRIGGER';
          const specialPrice = prod.specialPrice ?? prod.special_price ?? null;
          const discountPercent = prod.discountPercent ?? prod.discount_percent ?? null;
          stmt.run(promotionId, pId, role, specialPrice, discountPercent);
        }
      }

      const created = this.getPromotionById(promotionId);
      if (!created) {
        throw new PromotionError('NOT_FOUND', 'Erro ao recuperar promoção após criação');
      }
      return created;
    })();
  }

  /**
   * Obtém detalhes de uma promoção por ID, incluindo os produtos vinculados
   */
  getPromotionById(id: number): PromotionWithProducts | null {
    const row = this.db.prepare('SELECT * FROM promotions WHERE id = ?').get(id) as any;
    if (!row) {
      return null;
    }

    const promo = this.mapPromotion(row);
    const prodRows = this.db
      .prepare(
        `SELECT pp.*, p.name as product_name, p.ean as product_ean, p.price as product_price
         FROM promotion_products pp
         LEFT JOIN products p ON p.id = pp.product_id
         WHERE pp.promotion_id = ?
         ORDER BY pp.id ASC`
      )
      .all(id) as any[];

    const products = prodRows.map((r) => this.mapPromotionProduct(r));

    return {
      ...promo,
      products,
    };
  }

  /**
   * Lista promoções com filtros opcionais
   */
  listPromotions(filter?: PromotionFilter): PromotionWithProducts[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter?.activeOnly) {
      conditions.push('p.is_active = 1');
    }
    if (filter?.type) {
      conditions.push('p.type = ?');
      params.push(filter.type);
    }
    if (filter?.search) {
      conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${filter.search}%`, `%${filter.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM promotions p ${whereClause} ORDER BY p.priority DESC, p.id DESC`;

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => {
      const promo = this.mapPromotion(r);
      const prodRows = this.db
        .prepare(
          `SELECT pp.*, p.name as product_name, p.ean as product_ean, p.price as product_price
           FROM promotion_products pp
           LEFT JOIN products p ON p.id = pp.product_id
           WHERE pp.promotion_id = ?
           ORDER BY pp.id ASC`
        )
        .all(promo.id) as any[];

      return {
        ...promo,
        products: prodRows.map((pr) => this.mapPromotionProduct(pr)),
      };
    });
  }

  /**
   * Atualiza promoção existente e recria a lista de produtos vinculados caso fornecida
   */
  updatePromotion(id: number, input: UpdatePromotionInput): PromotionWithProducts {
    const existing = this.getPromotionById(id);
    if (!existing) {
      throw new PromotionError('PROMOTION_NOT_FOUND', `Promoção ID ${id} não encontrada`);
    }

    const name = input.name !== undefined ? input.name.trim() : existing.name;
    const description = input.description !== undefined ? input.description : existing.description;
    const type = input.type !== undefined ? input.type : existing.type;
    const startDate = input.startDate ?? input.start_date ?? existing.startDate;
    const endDate = input.endDate ?? input.end_date ?? existing.endDate;
    const priority = input.priority !== undefined ? Number(input.priority) : existing.priority;
    const isActive =
      input.isActive !== undefined
        ? input.isActive
          ? 1
          : 0
        : input.is_active !== undefined
        ? input.is_active
          ? 1
          : 0
        : existing.isActive
        ? 1
        : 0;
    const appliesTo = (input.appliesTo ?? input.applies_to ?? existing.appliesTo) as PromotionAppliesTo;
    const targetCategory = input.targetCategory ?? input.target_category ?? existing.targetCategory;
    const conditionsJson =
      input.conditionsJson !== undefined || input.conditions_json !== undefined
        ? safeStringifyConditions(input.conditionsJson ?? input.conditions_json)
        : existing.conditionsJson;

    return this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE promotions SET
            name = ?,
            description = ?,
            type = ?,
            start_date = ?,
            end_date = ?,
            priority = ?,
            is_active = ?,
            applies_to = ?,
            target_category = ?,
            conditions_json = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`
        )
        .run(
          name,
          description,
          type,
          startDate,
          endDate,
          priority,
          isActive,
          appliesTo,
          targetCategory,
          conditionsJson,
          id
        );

      if (input.products !== undefined) {
        this.db.prepare('DELETE FROM promotion_products WHERE promotion_id = ?').run(id);

        const stmt = this.db.prepare(
          `INSERT INTO promotion_products (
            promotion_id, product_id, role, special_price, discount_percent
          ) VALUES (?, ?, ?, ?, ?)`
        );

        for (const prod of input.products) {
          const pId = prod.productId ?? prod.product_id;
          const role = prod.role || 'TRIGGER';
          const specialPrice = prod.specialPrice ?? prod.special_price ?? null;
          const discountPercent = prod.discountPercent ?? prod.discount_percent ?? null;
          stmt.run(id, pId, role, specialPrice, discountPercent);
        }
      }

      const updated = this.getPromotionById(id);
      if (!updated) {
        throw new PromotionError('NOT_FOUND', 'Erro ao recuperar promoção após atualização');
      }
      return updated;
    })();
  }

  /**
   * Exclui promoção e seus vínculos
   */
  deletePromotion(id: number): boolean {
    const existing = this.getPromotionById(id);
    if (!existing) {
      throw new PromotionError('PROMOTION_NOT_FOUND', `Promoção ID ${id} não encontrada`);
    }

    return this.db.transaction(() => {
      this.db.prepare('DELETE FROM promotion_products WHERE promotion_id = ?').run(id);
      this.db.prepare('DELETE FROM promotions WHERE id = ?').run(id);
      return true;
    })();
  }

  /**
   * Avalia os itens do carrinho aplicando o motor de promoções combinadas
   */
  evaluateCart(
    cartItems: CartItemInput[],
    customerId?: number,
    storeId?: number,
    currentDate?: string
  ): CartEvaluationResult {
    const evalDateStr = (currentDate || new Date().toISOString()).slice(0, 10);
    const evalMonth = parseInt(evalDateStr.slice(5, 7), 10);

    // Identifica status do cliente: membro do clube e data de nascimento
    let isClubMember = false;
    let isBirthdayMonth = false;

    if (customerId) {
      const wallet = this.db.prepare('SELECT 1 FROM loyalty_wallets WHERE customer_id = ?').get(customerId);
      if (wallet) {
        isClubMember = true;
      }

      const cust = this.db.prepare('SELECT birth_date FROM customers WHERE id = ?').get(customerId) as any;
      if (cust?.birth_date) {
        const bMonth = parseInt(cust.birth_date.slice(5, 7), 10);
        if (bMonth === evalMonth) {
          isBirthdayMonth = true;
        }
      }
    }

    // Inicializa itens avaliados respeitando teto CMED e não-negatividade
    const evaluatedItems: EvaluatedItem[] = cartItems.map((ci) => {
      let unitPrice = ci.unitPrice;
      if (ci.cmedMaxPrice !== undefined && ci.cmedMaxPrice > 0) {
        unitPrice = Math.min(unitPrice, ci.cmedMaxPrice);
      }
      unitPrice = Math.max(0, round2(unitPrice));

      return {
        productId: ci.productId,
        quantity: ci.quantity,
        originalUnitPrice: unitPrice,
        finalUnitPrice: unitPrice,
        discountAmount: 0,
        appliedPromotionId: undefined,
        appliedPromotionName: undefined,
        appliedPromotionType: undefined,
      };
    });

    // Busca todas as promoções ativas e vigentes ordenadas por prioridade descrescente
    const activePromos = this.listPromotions({ activeOnly: true }).filter((p) => {
      const start = p.startDate.slice(0, 10);
      const end = p.endDate.slice(0, 10);
      return evalDateStr >= start && evalDateStr <= end;
    });

    // Dicionário de resumos de promoções aplicadas
    const appliedPromosMap = new Map<number, AppliedPromotionSummary>();

    for (const promo of activePromos) {
      const conditions = safeParseConditions(promo.conditionsJson);

      // Tratamento por tipo de promoção
      switch (promo.type) {
        case 'TAKE_MORE_PAY_LESS': {
          const takeQty = Number(conditions.takeQuantity || 0);
          const payQty = Number(conditions.payQuantity || 0);
          if (takeQty <= 0 || payQty <= 0 || payQty >= takeQty) {
            break;
          }

          for (const item of evaluatedItems) {
            // Se já tem promoção aplicada, respeita não-cumulatividade
            if (item.appliedPromotionId !== undefined) continue;

            const isEligible =
              promo.appliesTo === 'ALL_PRODUCTS' ||
              (promo.appliesTo === 'SPECIFIC_PRODUCTS' && promo.products.some((p) => p.productId === item.productId));

            if (isEligible && item.quantity >= takeQty) {
              const blocks = Math.floor(item.quantity / takeQty);
              const freeUnits = blocks * (takeQty - payQty);
              const lineDiscount = round2(freeUnits * item.originalUnitPrice);

              if (lineDiscount > 0) {
                item.discountAmount = lineDiscount;
                item.finalUnitPrice = round2((item.originalUnitPrice * item.quantity - lineDiscount) / item.quantity);
                item.appliedPromotionId = promo.id;
                item.appliedPromotionName = promo.name;
                item.appliedPromotionType = promo.type;

                const currentSummary = appliedPromosMap.get(promo.id) || {
                  id: promo.id,
                  name: promo.name,
                  type: promo.type,
                  totalDiscount: 0,
                };
                currentSummary.totalDiscount = round2(currentSummary.totalDiscount + lineDiscount);
                appliedPromosMap.set(promo.id, currentSummary);
              }
            }
          }
          break;
        }

        case 'PROGRESSIVE_DISCOUNT': {
          const tiers: Array<{ minQuantity: number; maxQuantity?: number; discountPercent: number }> =
            conditions.tiers || [];
          if (!tiers.length) break;

          // Ordena faixas por quantidade mínima decrescente
          const sortedTiers = [...tiers].sort((a, b) => b.minQuantity - a.minQuantity);

          for (const item of evaluatedItems) {
            if (item.appliedPromotionId !== undefined) continue;

            const isEligible =
              promo.appliesTo === 'ALL_PRODUCTS' ||
              (promo.appliesTo === 'SPECIFIC_PRODUCTS' && promo.products.some((p) => p.productId === item.productId));

            if (isEligible) {
              const matchedTier = sortedTiers.find(
                (t) => item.quantity >= t.minQuantity && (t.maxQuantity === undefined || item.quantity <= t.maxQuantity)
              );

              if (matchedTier && matchedTier.discountPercent > 0) {
                const discountPercent = Math.min(100, Math.max(0, matchedTier.discountPercent));
                const unitDiscount = round2(item.originalUnitPrice * (discountPercent / 100));
                const lineDiscount = round2(unitDiscount * item.quantity);

                if (lineDiscount > 0) {
                  item.discountAmount = lineDiscount;
                  item.finalUnitPrice = round2(item.originalUnitPrice - unitDiscount);
                  item.appliedPromotionId = promo.id;
                  item.appliedPromotionName = promo.name;
                  item.appliedPromotionType = promo.type;

                  const currentSummary = appliedPromosMap.get(promo.id) || {
                    id: promo.id,
                    name: promo.name,
                    type: promo.type,
                    totalDiscount: 0,
                  };
                  currentSummary.totalDiscount = round2(currentSummary.totalDiscount + lineDiscount);
                  appliedPromosMap.set(promo.id, currentSummary);
                }
              }
            }
          }
          break;
        }

        case 'COMBO_CROSS_SELL': {
          let triggerProdId = conditions.triggerProductId;
          let rewardProdId = conditions.rewardProductId;
          let discountPercent = Number(conditions.discountPercent || 0);

          if (!triggerProdId || !rewardProdId) {
            const trigger = promo.products.find((p) => p.role === 'TRIGGER');
            const reward = promo.products.find((p) => p.role === 'REWARD');
            if (trigger) triggerProdId = trigger.productId;
            if (reward) {
              rewardProdId = reward.productId;
              if (!discountPercent && reward.discountPercent) {
                discountPercent = Number(reward.discountPercent);
              }
            }
          }

          if (!triggerProdId || !rewardProdId || discountPercent <= 0) break;

          const triggerItem = evaluatedItems.find((i) => i.productId === triggerProdId);
          const rewardItem = evaluatedItems.find((i) => i.productId === rewardProdId && i.appliedPromotionId === undefined);

          if (triggerItem && rewardItem) {
            const comboCount = Math.min(triggerItem.quantity, rewardItem.quantity);
            if (comboCount > 0) {
              const unitDiscount = round2(rewardItem.originalUnitPrice * (discountPercent / 100));
              const lineDiscount = round2(unitDiscount * comboCount);

              if (lineDiscount > 0) {
                rewardItem.discountAmount = lineDiscount;
                rewardItem.finalUnitPrice = round2(
                  (rewardItem.originalUnitPrice * rewardItem.quantity - lineDiscount) / rewardItem.quantity
                );
                rewardItem.appliedPromotionId = promo.id;
                rewardItem.appliedPromotionName = promo.name;
                rewardItem.appliedPromotionType = promo.type;

                const currentSummary = appliedPromosMap.get(promo.id) || {
                  id: promo.id,
                  name: promo.name,
                  type: promo.type,
                  totalDiscount: 0,
                };
                currentSummary.totalDiscount = round2(currentSummary.totalDiscount + lineDiscount);
                appliedPromosMap.set(promo.id, currentSummary);
              }
            }
          }
          break;
        }

        case 'CLUB_SPECIAL_PRICE': {
          // Preço Clube só é aplicável se o cliente estiver identificado e com carteira ativa
          if (!isClubMember) break;

          for (const item of evaluatedItems) {
            if (item.appliedPromotionId !== undefined) continue;

            const prodConfig = promo.products.find((p) => p.productId === item.productId);
            const isEligible = promo.appliesTo === 'ALL_PRODUCTS' || prodConfig !== undefined;

            if (isEligible) {
              const specialPrice = prodConfig?.specialPrice ?? conditions.specialPrice;
              if (specialPrice !== undefined && specialPrice !== null && specialPrice < item.originalUnitPrice) {
                const unitDiscount = round2(item.originalUnitPrice - Number(specialPrice));
                const lineDiscount = round2(unitDiscount * item.quantity);

                if (lineDiscount > 0) {
                  item.discountAmount = lineDiscount;
                  item.finalUnitPrice = Number(specialPrice);
                  item.appliedPromotionId = promo.id;
                  item.appliedPromotionName = promo.name;
                  item.appliedPromotionType = promo.type;

                  const currentSummary = appliedPromosMap.get(promo.id) || {
                    id: promo.id,
                    name: promo.name,
                    type: promo.type,
                    totalDiscount: 0,
                  };
                  currentSummary.totalDiscount = round2(currentSummary.totalDiscount + lineDiscount);
                  appliedPromosMap.set(promo.id, currentSummary);
                }
              }
            }
          }
          break;
        }

        case 'BIRTHDAY_DISCOUNT': {
          // Desconto de aniversário só é aplicável se o cliente faz aniversário no mês corrente
          if (!isBirthdayMonth) break;

          const discountPercent = Number(conditions.discountPercent || 0);
          if (discountPercent <= 0) break;

          for (const item of evaluatedItems) {
            if (item.appliedPromotionId !== undefined) continue;

            const isEligible =
              promo.appliesTo === 'ALL_PRODUCTS' ||
              (promo.appliesTo === 'SPECIFIC_PRODUCTS' && promo.products.some((p) => p.productId === item.productId));

            if (isEligible) {
              const validPercent = Math.min(100, Math.max(0, discountPercent));
              const unitDiscount = round2(item.originalUnitPrice * (validPercent / 100));
              const lineDiscount = round2(unitDiscount * item.quantity);

              if (lineDiscount > 0) {
                item.discountAmount = lineDiscount;
                item.finalUnitPrice = round2(item.originalUnitPrice - unitDiscount);
                item.appliedPromotionId = promo.id;
                item.appliedPromotionName = promo.name;
                item.appliedPromotionType = promo.type;

                const currentSummary = appliedPromosMap.get(promo.id) || {
                  id: promo.id,
                  name: promo.name,
                  type: promo.type,
                  totalDiscount: 0,
                };
                currentSummary.totalDiscount = round2(currentSummary.totalDiscount + lineDiscount);
                appliedPromosMap.set(promo.id, currentSummary);
              }
            }
          }
          break;
        }
      }
    }

    // Validações pós-processamento: teto CMED, valores não-negativos e arredondamentos finais
    for (let i = 0; i < evaluatedItems.length; i++) {
      const evalItem = evaluatedItems[i];
      const cartInput = cartItems[i];

      // Teto CMED
      if (cartInput.cmedMaxPrice !== undefined && cartInput.cmedMaxPrice > 0) {
        if (evalItem.finalUnitPrice > cartInput.cmedMaxPrice) {
          evalItem.finalUnitPrice = cartInput.cmedMaxPrice;
          evalItem.discountAmount = Math.max(
            0,
            round2(evalItem.originalUnitPrice * evalItem.quantity - evalItem.finalUnitPrice * evalItem.quantity)
          );
        }
      }

      // Preço final nunca negativo
      if (evalItem.finalUnitPrice < 0) {
        evalItem.finalUnitPrice = 0;
        evalItem.discountAmount = round2(evalItem.originalUnitPrice * evalItem.quantity);
      }

      // O desconto do item não pode exceder o valor total original
      const maxDiscount = round2(evalItem.originalUnitPrice * evalItem.quantity);
      if (evalItem.discountAmount > maxDiscount) {
        evalItem.discountAmount = maxDiscount;
        evalItem.finalUnitPrice = 0;
      }
    }

    const subtotal = round2(evaluatedItems.reduce((acc, it) => acc + it.originalUnitPrice * it.quantity, 0));
    const totalDiscount = round2(evaluatedItems.reduce((acc, it) => acc + it.discountAmount, 0));
    const finalTotal = round2(Math.max(0, subtotal - totalDiscount));

    return {
      items: evaluatedItems,
      subtotal,
      totalDiscount,
      finalTotal,
      appliedPromotions: Array.from(appliedPromosMap.values()),
    };
  }
}
