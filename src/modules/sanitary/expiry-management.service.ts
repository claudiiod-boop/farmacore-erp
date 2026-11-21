import { Database } from '../../database/connection';
import type {
  BatchActionSuggestion,
  BatchDetails,
  ExpiringBatchItem,
  ExpiryFilters,
  ExpiryRiskCategory,
  ExpiryRiskMatrix,
  ExpiryRiskTierSummary,
} from './types';

interface BatchDbRow {
  batch_id: number;
  batch_number: string;
  expiration_date: string;
  quantity: number;
  is_blocked: number;
  product_id: number;
  product_name: string;
  ean: string;
  unit_cost: number;
  unit_sale_price: number;
}

export class ExpiryManagementService {
  constructor(private readonly db: Database) {}

  private getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private calculateDays(expirationDate: string, referenceDate: string): number {
    const exp = new Date(expirationDate + 'T00:00:00Z').getTime();
    const ref = new Date(referenceDate + 'T00:00:00Z').getTime();
    return Math.floor((exp - ref) / (1000 * 60 * 60 * 24));
  }

  public getCategory(diffDays: number): ExpiryRiskCategory {
    if (diffDays < 0) return 'EXPIRED';
    if (diffDays <= 30) return 'RISK_30_DAYS';
    if (diffDays <= 60) return 'RISK_60_DAYS';
    if (diffDays <= 90) return 'RISK_90_DAYS';
    return 'SAFE';
  }

  public suggestActionForBatch(
    batch: BatchDetails,
    supplierReturnDays: number = 90,
    referenceDate?: string
  ): BatchActionSuggestion {
    const refDate = referenceDate || this.getTodayString();
    const diffDays = this.calculateDays(batch.expirationDate, refDate);

    if (diffDays < 0) {
      return 'DISPOSE';
    }
    if (diffDays <= 60) {
      return 'PROMOTION';
    }
    if (diffDays <= supplierReturnDays) {
      return 'RETURN_TO_SUPPLIER';
    }
    return 'NORMAL';
  }

  public getExpiryMatrix(storeId?: number, referenceDate?: string): ExpiryRiskMatrix {
    const refDate = referenceDate || this.getTodayString();

    let sql = `
      SELECT 
        b.id AS batch_id,
        b.batch_number,
        b.expiration_date,
        b.quantity,
        b.is_blocked,
        p.id AS product_id,
        p.name AS product_name,
        p.ean,
        COALESCE(p.pf, 0.0) AS unit_cost,
        COALESCE(p.price, 0.0) AS unit_sale_price
      FROM batches b
      JOIN products p ON p.id = b.product_id
      WHERE b.quantity > 0
    `;
    const params: any[] = [];

    if (storeId !== undefined) {
      sql += ' AND b.store_id = ?';
      params.push(storeId);
    }

    const rows = this.db.prepare<BatchDbRow>(sql).all(...params);

    const initialTiers: Record<ExpiryRiskCategory, ExpiryRiskTierSummary> = {
      EXPIRED: {
        category: 'EXPIRED',
        label: 'Vencidos',
        minDays: -Infinity,
        maxDays: -1,
        batchCount: 0,
        unitCount: 0,
        totalCost: 0,
        totalSale: 0,
      },
      RISK_30_DAYS: {
        category: 'RISK_30_DAYS',
        label: 'Até 30 dias',
        minDays: 0,
        maxDays: 30,
        batchCount: 0,
        unitCount: 0,
        totalCost: 0,
        totalSale: 0,
      },
      RISK_60_DAYS: {
        category: 'RISK_60_DAYS',
        label: '31 a 60 dias',
        minDays: 31,
        maxDays: 60,
        batchCount: 0,
        unitCount: 0,
        totalCost: 0,
        totalSale: 0,
      },
      RISK_90_DAYS: {
        category: 'RISK_90_DAYS',
        label: '61 a 90 dias',
        minDays: 61,
        maxDays: 90,
        batchCount: 0,
        unitCount: 0,
        totalCost: 0,
        totalSale: 0,
      },
      SAFE: {
        category: 'SAFE',
        label: 'Mais de 90 dias',
        minDays: 91,
        maxDays: Infinity,
        batchCount: 0,
        unitCount: 0,
        totalCost: 0,
        totalSale: 0,
      },
    };

    let totalBatches = 0;
    let totalUnits = 0;
    let totalCostAmount = 0;
    let totalSaleAmount = 0;

    for (const row of rows) {
      const diffDays = this.calculateDays(row.expiration_date, refDate);
      const category = this.getCategory(diffDays);
      const tier = initialTiers[category];

      tier.batchCount += 1;
      tier.unitCount += row.quantity;
      const batchCost = Number((row.quantity * row.unit_cost).toFixed(2));
      const batchSale = Number((row.quantity * row.unit_sale_price).toFixed(2));
      tier.totalCost = Number((tier.totalCost + batchCost).toFixed(2));
      tier.totalSale = Number((tier.totalSale + batchSale).toFixed(2));

      totalBatches += 1;
      totalUnits += row.quantity;
      totalCostAmount = Number((totalCostAmount + batchCost).toFixed(2));
      totalSaleAmount = Number((totalSaleAmount + batchSale).toFixed(2));
    }

    return {
      referenceDate: refDate,
      storeId,
      tiers: initialTiers,
      totalBatches,
      totalUnits,
      totalCostAmount,
      totalSaleAmount,
    };
  }

  public getExpiringBatches(
    filters: ExpiryFilters = {},
    referenceDate?: string
  ): { batches: ExpiringBatchItem[]; total: number } {
    const refDate = referenceDate || this.getTodayString();

    let sql = `
      SELECT 
        b.id AS batch_id,
        b.batch_number,
        b.expiration_date,
        b.quantity,
        b.is_blocked,
        p.id AS product_id,
        p.name AS product_name,
        p.ean,
        COALESCE(p.pf, 0.0) AS unit_cost,
        COALESCE(p.price, 0.0) AS unit_sale_price
      FROM batches b
      JOIN products p ON p.id = b.product_id
      WHERE b.quantity > 0
    `;
    const params: any[] = [];

    if (filters.storeId !== undefined) {
      sql += ' AND b.store_id = ?';
      params.push(filters.storeId);
    }

    if (filters.search) {
      sql += ' AND (p.name LIKE ? OR p.ean LIKE ? OR b.batch_number LIKE ?)';
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term);
    }

    const rows = this.db.prepare<BatchDbRow>(sql).all(...params);

    const items: ExpiringBatchItem[] = [];

    for (const row of rows) {
      const diffDays = this.calculateDays(row.expiration_date, refDate);
      const category = this.getCategory(diffDays);

      if (filters.category && category !== filters.category) {
        continue;
      }

      if (filters.maxDays !== undefined && diffDays > filters.maxDays) {
        continue;
      }

      const suggestedAction = this.suggestActionForBatch(
        {
          id: row.batch_id,
          batchNumber: row.batch_number,
          expirationDate: row.expiration_date,
          currentQuantity: row.quantity,
          unitCost: row.unit_cost,
          unitSalePrice: row.unit_sale_price,
        },
        90,
        refDate
      );

      items.push({
        batchId: row.batch_id,
        batchNumber: row.batch_number,
        productId: row.product_id,
        productName: row.product_name,
        ean: row.ean,
        manufacturer: null,
        expirationDate: row.expiration_date,
        daysUntilExpiration: diffDays,
        quantity: row.quantity,
        unitCost: row.unit_cost,
        totalCost: Number((row.quantity * row.unit_cost).toFixed(2)),
        unitSalePrice: row.unit_sale_price,
        totalSalePrice: Number((row.quantity * row.unit_sale_price).toFixed(2)),
        category,
        suggestedAction,
        isBlocked: Boolean(row.is_blocked),
      });
    }

    items.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 50;
    const offset = (page - 1) * limit;

    const pagedBatches = items.slice(offset, offset + limit);

    return {
      batches: pagedBatches,
      total: items.length,
    };
  }
}
