import path from 'path';
import fs from 'fs';
import { getDatabase } from '../src/database/connection';
import { runMigrations } from '../src/database/migrator';
import { seedCatalogIfEmpty } from '../src/database/seeds/seed-catalog';

const targetDir = path.join(process.cwd(), 'data');
const targetDbPath = path.join(targetDir, 'farmacore_starter_template.db');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

if (fs.existsSync(targetDbPath)) {
  fs.unlinkSync(targetDbPath);
}

console.log('Gerando banco de dados modelo para novas lojas...');
const db = getDatabase(targetDbPath);
runMigrations(db);
const total = seedCatalogIfEmpty(db, 1);
db.close();

console.log(`Sucesso! Banco gerado em: ${targetDbPath} (${total} produtos cadastrados prontos de fábrica).`);
