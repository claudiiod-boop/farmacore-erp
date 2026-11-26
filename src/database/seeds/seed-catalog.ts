import fs from 'fs';
import path from 'path';
import { Database, getDatabase } from '../connection';

export interface SeedProduct {
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
}

export function seedCatalogIfEmpty(db: Database, minThreshold = 20): number {
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
    if (row && Number(row.count) >= minThreshold) {
      return 0; // Já possui catálogo carregado
    }

    const seedPath = path.join(__dirname, 'magnos_farma_catalog_seed.json');
    if (!fs.existsSync(seedPath)) {
      console.warn('Arquivo de seed magnos_farma_catalog_seed.json não encontrado.');
      return 0;
    }

    const dataRaw = fs.readFileSync(seedPath, 'utf8');
    const products: SeedProduct[] = JSON.parse(dataRaw);

    console.log(`[Seed Catálogo Magnos Farma] Carregando ${products.length} produtos reais...`);

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO products (
        ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const insertBatchStmt = db.prepare(`
      INSERT OR IGNORE INTO batches (
        product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
      ) VALUES (?, ?, ?, ?, ?, 0)
    `);

    let inserted = 0;
    const today = new Date().toISOString().slice(0, 10);
    const futureDate = '2028-12-31';

    const tx = db.transaction(() => {
      for (const p of products) {
        const res = insertStmt.run(
          p.ean,
          p.name,
          p.active_ingredient || p.name,
          p.ms_registration || 'ISENTO',
          p.stripe || 'SEM_TARJA',
          p.control_type || 'Geral',
          p.pmc || p.price,
          p.pf || p.price * 0.65,
          p.price
        );

        if (res.changes > 0) {
          inserted++;
          const prodId = Number(res.lastInsertRowid);
          // Cria lote padrão inicial com estoque 100
          insertBatchStmt.run(prodId, 'LOTE-PADRAO-01', today, futureDate, 100);
        }
      }
    });

    tx();

    console.log(`[Seed Catálogo Magnos Farma] Sucesso! ${inserted} produtos inseridos com lotes iniciais.`);
    return inserted;
  } catch (err: any) {
    console.error('Erro ao executar seed do catálogo:', err.message);
    return 0;
  }
}

if (require.main === module) {
  const db = getDatabase();
  const count = seedCatalogIfEmpty(db, 0);
  console.log(`Concluído: ${count} produtos processados.`);
}
