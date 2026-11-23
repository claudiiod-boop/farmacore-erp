import { Database } from '../../database/connection';
import type {
  CmedPricingRule,
  PmcValidationResult,
  CmedPricingAuditReport,
  CmedPriceAuditItem,
} from './cmed.types';

export class CmedPricingService {
  constructor(private db: Database) {}

  /**
   * Determina a coluna de PMC com base na alíquota de ICMS do estado da loja.
   */
  static getPmcColumnForIcms(icmsRate: number): string {
    const rate = Math.round(icmsRate * 10) / 10;
    switch (rate) {
      case 0:
        return 'pmc_0';
      case 12:
        return 'pmc_12';
      case 17:
        return 'pmc_17';
      case 17.5:
        return 'pmc_17_5';
      case 18:
        return 'pmc_18';
      case 19:
        return 'pmc_19';
      case 20:
        return 'pmc_20';
      case 21:
        return 'pmc_21';
      case 22:
        return 'pmc_22';
      default:
        return 'pmc_18';
    }
  }

  /**
   * Determina a coluna de Preço Fábrica (PF) com base no ICMS.
   */
  static getPfColumnForIcms(icmsRate: number): string {
    const rate = Math.round(icmsRate * 10) / 10;
    switch (rate) {
      case 0:
        return 'pf_0';
      case 12:
        return 'pf_12';
      case 17:
        return 'pf_17';
      case 17.5:
        return 'pf_17_5';
      case 18:
        return 'pf_18';
      case 19:
        return 'pf_19';
      case 20:
        return 'pf_20';
      case 21:
        return 'pf_21';
      case 22:
        return 'pf_22';
      default:
        return 'pf_18';
    }
  }

  /**
   * Trava Sanitária & Regulatória Inviolável:
   * Valida se o preço de venda informado está dentro do Preço Máximo ao Consumidor (PMC).
   * Lei Federal 10.742/2003 e Código de Defesa do Consumidor.
   */
  validatePmcCap(ean: string, price: number, icmsRate = 18.0): PmcValidationResult {
    const pmcCol = CmedPricingService.getPmcColumnForIcms(icmsRate);

    const cmedProd = this.db
      .prepare<any>(
        `SELECT cp.product_name, cp.${pmcCol} AS pmc
         FROM cmed_products cp
         JOIN cmed_table_versions ctv ON ctv.id = cp.version_id
         WHERE cp.ean = ? AND ctv.is_active = 1`
      )
      .get(ean);

    if (!cmedProd || !cmedProd.pmc || cmedProd.pmc <= 0) {
      // Produto não regulado pela CMED (ex: perfumaria, correlato) ou sem teto estipulado
      return {
        isValid: true,
        ean,
        price,
        maxAllowedPmc: price,
        icmsRate,
      };
    }

    const maxAllowedPmc = Math.round(cmedProd.pmc * 100) / 100;
    const roundedPrice = Math.round(price * 100) / 100;

    if (roundedPrice > maxAllowedPmc) {
      return {
        isValid: false,
        ean,
        price: roundedPrice,
        maxAllowedPmc,
        icmsRate,
        productName: cmedProd.product_name,
        infractionWarning: `Infração Sanitária e Legal (Lei 10.742/2003): Preço de venda R$ ${roundedPrice.toFixed(
          2
        )} excede o teto regulatório de R$ ${maxAllowedPmc.toFixed(2)} registrado na CMED/ANVISA.`,
      };
    }

    return {
      isValid: true,
      ean,
      price: roundedPrice,
      maxAllowedPmc,
      icmsRate,
      productName: cmedProd.product_name,
    };
  }

  /**
   * Salva ou atualiza regra comercial de precificação por categoria.
   */
  savePricingRule(rule: CmedPricingRule): CmedPricingRule {
    const existing = this.db
      .prepare<any>(
        'SELECT id FROM cmed_pricing_rules WHERE store_id = ? AND category_type = ?'
      )
      .get(rule.storeId, rule.categoryType);

    if (existing) {
      this.db
        .prepare(
          `UPDATE cmed_pricing_rules
           SET discount_percent_pmc = ?, target_markup_pf = ?, min_gross_margin_percent = ?, enforce_pmc_cap = ?
           WHERE id = ?`
        )
        .run(
          rule.discountPercentPmc,
          rule.targetMarkupPf || 0,
          rule.minGrossMarginPercent,
          rule.enforcePmcCap ? 1 : 0,
          existing.id
        );
      return { ...rule, id: existing.id };
    }

    const res = this.db
      .prepare(
        `INSERT INTO cmed_pricing_rules (store_id, category_type, discount_percent_pmc, target_markup_pf, min_gross_margin_percent, enforce_pmc_cap)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        rule.storeId,
        rule.categoryType,
        rule.discountPercentPmc,
        rule.targetMarkupPf || 0,
        rule.minGrossMarginPercent,
        rule.enforcePmcCap ? 1 : 0
      );

    return { ...rule, id: Number(res.lastInsertRowid) };
  }

  /**
   * Consulta as regras comerciais de precificação da loja.
   */
  getPricingRules(storeId: number): CmedPricingRule[] {
    const rows = this.db
      .prepare<any>('SELECT * FROM cmed_pricing_rules WHERE store_id = ? ORDER BY category_type ASC')
      .all(storeId);

    return rows.map((r) => ({
      id: r.id,
      storeId: r.store_id,
      categoryType: r.category_type,
      discountPercentPmc: r.discount_percent_pmc,
      targetMarkupPf: r.target_markup_pf,
      minGrossMarginPercent: r.min_gross_margin_percent,
      enforcePmcCap: r.enforce_pmc_cap === 1,
      createdAt: r.created_at,
    }));
  }

  /**
   * Executa a auditoria completa de preços da farmácia contra a tabela oficial da CMED.
   * Identifica infrações de preço acima do teto e margens comerciais abaixo da meta.
   */
  runPricingAudit(storeId: number, icmsRate = 18.0): CmedPricingAuditReport {
    const pmcCol = CmedPricingService.getPmcColumnForIcms(icmsRate);
    const pfCol = CmedPricingService.getPfColumnForIcms(icmsRate);

    const products = this.db
      .prepare<any>(
        `SELECT p.id, p.ean, p.name, p.price, p.pf, p.pmc,
                cp.${pmcCol} AS cmed_pmc,
                cp.${pfCol} AS cmed_pf,
                cp.product_type,
                cp.list_type
         FROM products p
         LEFT JOIN cmed_products cp ON cp.ean = p.ean
         LEFT JOIN cmed_table_versions ctv ON ctv.id = cp.version_id AND ctv.is_active = 1
         WHERE p.is_active = 1
         ORDER BY p.name ASC`
      )
      .all();

    const rules = this.getPricingRules(storeId);
    const rulesMap = new Map<string, CmedPricingRule>();
    rules.forEach((r) => rulesMap.set(r.categoryType, r));

    let nonCompliantAbovePmcCount = 0;
    let lowMarginCount = 0;
    let compliantCount = 0;
    const items: CmedPriceAuditItem[] = [];

    for (const prod of products) {
      const pmcAllowed = prod.cmed_pmc || prod.pmc || prod.price;
      const pfRef = prod.cmed_pf || prod.pf || 0;
      const currentPrice = prod.price;

      // Cálculo de margem bruta atual: ((Preço - Custo) / Preço) * 100
      let currentMargin = 0;
      if (currentPrice > 0 && pfRef > 0) {
        currentMargin = Math.round(((currentPrice - pfRef) / currentPrice) * 1000) / 10;
      }

      // Regra de precificação da categoria
      const catRule = rulesMap.get(prod.product_type || 'REFERENCIA');
      const discountPmc = catRule?.discountPercentPmc || 0;
      const minMargin = catRule?.minGrossMarginPercent || 15.0;

      // Preço sugerido por padrão de desconto sobre o PMC
      let suggestedPrice = pmcAllowed;
      if (discountPmc > 0) {
        suggestedPrice = Math.round(pmcAllowed * (1 - discountPmc / 100) * 100) / 100;
      }

      // Diagnóstico de auditoria
      if (currentPrice > pmcAllowed) {
        nonCompliantAbovePmcCount++;
        items.push({
          productId: prod.id,
          ean: prod.ean,
          productName: prod.name,
          currentSalePrice: currentPrice,
          pmcAllowed,
          pfReference: pfRef,
          productType: prod.product_type,
          listType: prod.list_type,
          status: 'ABOVE_PMC',
          priceExcessAmount: Math.round((currentPrice - pmcAllowed) * 100) / 100,
          currentMarginPercent: currentMargin,
          suggestedSalePrice: Math.min(suggestedPrice, pmcAllowed),
        });
      } else if (currentMargin < minMargin && currentPrice > 0 && pfRef > 0) {
        lowMarginCount++;
        items.push({
          productId: prod.id,
          ean: prod.ean,
          productName: prod.name,
          currentSalePrice: currentPrice,
          pmcAllowed,
          pfReference: pfRef,
          productType: prod.product_type,
          listType: prod.list_type,
          status: 'MARGIN_TOO_LOW',
          priceExcessAmount: 0,
          currentMarginPercent: currentMargin,
          suggestedSalePrice: suggestedPrice,
        });
      } else {
        compliantCount++;
        items.push({
          productId: prod.id,
          ean: prod.ean,
          productName: prod.name,
          currentSalePrice: currentPrice,
          pmcAllowed,
          pfReference: pfRef,
          productType: prod.product_type,
          listType: prod.list_type,
          status: 'COMPLIANT',
          priceExcessAmount: 0,
          currentMarginPercent: currentMargin,
          suggestedSalePrice: currentPrice,
        });
      }
    }

    return {
      storeId,
      icmsRate,
      totalProductsAudited: products.length,
      nonCompliantAbovePmcCount,
      lowMarginCount,
      compliantCount,
      items,
    };
  }

  /**
   * Aplica em lote as correções de preços recomendadas ou autorizadas.
   */
  applyBatchPriceUpdates(
    storeId: number,
    updates: Array<{ productId: number; newPrice: number; reason?: string }>,
    auditorUser = 'SISTEMA'
  ): { updatedCount: number; message: string } {
    let count = 0;

    const getProdStmt = this.db.prepare<any>('SELECT price, pmc, pf FROM products WHERE id = ?');
    const updateProdStmt = this.db.prepare('UPDATE products SET price = ? WHERE id = ?');
    const logStmt = this.db.prepare(
      `INSERT INTO cmed_price_audit_logs (store_id, product_id, old_price, new_price, current_pmc, current_pf, icms_rate, reason, auditor_user)
       VALUES (?, ?, ?, ?, ?, ?, 18.0, ?, ?)`
    );

    this.db.transaction(() => {
      for (const upd of updates) {
        const prod = getProdStmt.get(upd.productId);
        if (prod) {
          updateProdStmt.run(upd.newPrice, upd.productId);
          logStmt.run(
            storeId,
            upd.productId,
            prod.price,
            upd.newPrice,
            prod.pmc || upd.newPrice,
            prod.pf || 0,
            upd.reason || 'Ajuste de conformidade CMED',
            auditorUser
          );
          count++;
        }
      }
    })();

    return {
      updatedCount: count,
      message: `${count} preço(s) de medicamentos atualizados e auditados com sucesso.`,
    };
  }
}
