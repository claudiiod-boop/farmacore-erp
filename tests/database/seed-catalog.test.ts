import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { seedCatalogIfEmpty } from '../../src/database/seeds/seed-catalog';

describe('Magnos Farma Master Catalog Seed', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    if (db) db.close();
  });

  it('should seed catalog when database has no products', () => {
    const initialCount = db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number };
    expect(initialCount.c).toBe(0);

    const inserted = seedCatalogIfEmpty(db, 1);
    expect(inserted).toBeGreaterThan(100);

    const afterCount = db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number };
    expect(afterCount.c).toBeGreaterThan(100);

    // Valida que produtos têm EAN, Preço, PMC e Lote criado
    const sample = db.prepare('SELECT * FROM products WHERE price > 0 LIMIT 1').get() as any;
    expect(sample).toBeDefined();
    expect(sample.ean).toBeDefined();
    expect(sample.price).toBeGreaterThan(0);
    expect(sample.pmc).toBeGreaterThanOrEqual(sample.price);

    const batch = db.prepare('SELECT * FROM batches WHERE product_id = ?').get(sample.id) as any;
    expect(batch).toBeDefined();
    expect(batch.quantity).toBe(100);

    // Segunda execução não deve duplicar (idempotência)
    const secondRun = seedCatalogIfEmpty(db, 1);
    expect(secondRun).toBe(0);
  });
});
