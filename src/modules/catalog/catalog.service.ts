import { Database } from '../../database/connection';
import { ControlType, CreateProductDTO, Product, Stripe } from './types';

interface ProductRow {
  id: number | bigint;
  ean: string;
  name: string;
  active_ingredient: string;
  ms_registration: string;
  stripe: string;
  control_type: string;
  pmc: number;
  pf: number;
  price: number;
  is_active: number;
  created_at: string;
}

function mapProductRow(row: ProductRow): Product {
  return {
    id: Number(row.id),
    ean: row.ean,
    name: row.name,
    activeIngredient: row.active_ingredient,
    msRegistration: row.ms_registration,
    stripe: row.stripe as Stripe,
    controlType: row.control_type as ControlType,
    pmc: Number(row.pmc),
    pf: Number(row.pf),
    price: Number(row.price),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

export class CatalogService {
  constructor(private db: Database) {}

  createProduct(dto: CreateProductDTO): Product {
    if (dto.price > dto.pmc) {
      throw new Error('CMED_PMC_EXCEEDED');
    }

    const stmt = this.db.prepare(`
      INSERT INTO products (
        ean,
        name,
        active_ingredient,
        ms_registration,
        stripe,
        control_type,
        pmc,
        pf,
        price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      dto.ean,
      dto.name,
      dto.activeIngredient,
      dto.msRegistration,
      dto.stripe,
      dto.controlType,
      dto.pmc,
      dto.pf,
      dto.price
    );

    const insertedId = Number(result.lastInsertRowid);
    const product = this.getProductById(insertedId);

    if (!product) {
      throw new Error('Failed to retrieve newly created product');
    }

    return product;
  }

  getProductById(id: number): Product | null {
    const stmt = this.db.prepare<ProductRow>('SELECT * FROM products WHERE id = ?');
    const row = stmt.get(id);

    if (!row) {
      return null;
    }

    return mapProductRow(row);
  }

  getProductByEan(ean: string): Product | null {
    const stmt = this.db.prepare<ProductRow>('SELECT * FROM products WHERE ean = ?');
    const row = stmt.get(ean);

    if (!row) {
      return null;
    }

    return mapProductRow(row);
  }

  searchProducts(query: string): Product[] {
    const stmt = this.db.prepare<ProductRow>(`
      SELECT * FROM products
      WHERE is_active = 1
        AND (ean = ? OR name LIKE ? OR active_ingredient LIKE ?)
      ORDER BY id ASC
    `);

    const partial = `%${query}%`;
    const rows = stmt.all(query, partial, partial);

    return rows.map(mapProductRow);
  }

  updateProductPrice(id: number, newPrice: number): Product {
    const product = this.getProductById(id);

    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    if (newPrice > product.pmc) {
      throw new Error('CMED_PMC_EXCEEDED');
    }

    const stmt = this.db.prepare('UPDATE products SET price = ? WHERE id = ?');
    stmt.run(newPrice, id);

    const updated = this.getProductById(id);
    if (!updated) {
      throw new Error('Failed to retrieve updated product');
    }

    return updated;
  }
}
