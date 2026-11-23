import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('CMED / ANVISA Pricing & Regulatory Limits REST API Routes (/api/cmed/*)', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    // Insere produtos na loja
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES 
        (1, '7891234567890', 'Dipirona 500mg Gotas', 'Dipirona', '1000000000001', 'SEM_TARJA', 'ISENTO', 10.0, 5.0, 12.00), -- ACIMA DO PMC (12 > 10)!
        (2, '7899876543210', 'Amoxicilina 500mg 21 caps', 'Amoxicilina', '1000000000002', 'VERMELHA', 'ANTIMICROBIANO', 35.0, 20.0, 28.00)
    `).run();

    app = fastify();
    await registerRoutes(app, db);
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('should import CMED CSV table and make products searchable', async () => {
    const csvContent = `
SUBSTANCIA;CNPJ;LABORATORIO;REGISTRO;EAN_1;PRODUTO;APRESENTACAO;CLASSE_TERAPEUTICA;TIPO_PRODUTO;LISTA_CONCESSAO_CREDITO_TRIBUTARIO;PF_18;PMC_18
DIPIRONA;11.222.333/0001-99;MEDLEY;1000000000001;7891234567890;DIPIRONA;500MG/ML GOTAS 20ML;ANALGESICOS;GENÉRICO;POSITIVA;5,00;10,00
AMOXICILINA;44.555.666/0001-88;EMS;1000000000002;7899876543210;AMOXICILINA;500MG 21 CAPS;ANTIBACTERIANOS;GENÉRICO;NEGATIVA;20,00;35,00
    `.trim();

    const importRes = await app.inject({
      method: 'POST',
      url: '/api/cmed/import',
      payload: {
        fileContent: csvContent,
        versionCode: 'CMED-2026-11',
      },
    });

    expect(importRes.statusCode).toBe(201);
    const importData = JSON.parse(importRes.body);
    expect(importData.importedCount).toBe(2);

    // Consulta medicamento na base CMED
    const searchRes = await app.inject({
      method: 'GET',
      url: '/api/cmed/search?q=DIPIRONA',
    });

    expect(searchRes.statusCode).toBe(200);
    const searchData = JSON.parse(searchRes.body);
    expect(searchData.length).toBe(1);
    expect(searchData[0].product_name).toBe('DIPIRONA');
    expect(searchData[0].pmc_18).toBe(10.00);
  });

  it('should validate sale price against regulatory PMC cap', async () => {
    // Importa base primeiro
    const csvContent = `
SUBSTANCIA;CNPJ;LABORATORIO;REGISTRO;EAN_1;PRODUTO;APRESENTACAO;CLASSE_TERAPEUTICA;TIPO_PRODUTO;LISTA_CONCESSAO_CREDITO_TRIBUTARIO;PF_18;PMC_18
DIPIRONA;11.222.333/0001-99;MEDLEY;1000000000001;7891234567890;DIPIRONA;500MG/ML GOTAS;ANALGESICOS;GENÉRICO;POSITIVA;5,00;10,00
    `.trim();

    await app.inject({
      method: 'POST',
      url: '/api/cmed/import',
      payload: { fileContent: csvContent, versionCode: 'CMED-2026-11' },
    });

    // Teste 1: Preço infrator (R$ 12,50 > R$ 10,00)
    const invalidRes = await app.inject({
      method: 'POST',
      url: '/api/cmed/validate-price',
      payload: { ean: '7891234567890', price: 12.50, icmsRate: 18.0 },
    });

    expect(invalidRes.statusCode).toBe(200);
    const invalidData = JSON.parse(invalidRes.body);
    expect(invalidData.isValid).toBe(false);
    expect(invalidData.maxAllowedPmc).toBe(10.00);
    expect(invalidData.infractionWarning).toContain('Infração Sanitária e Legal');

    // Teste 2: Preço válido (R$ 8,50 <= R$ 10,00)
    const validRes = await app.inject({
      method: 'POST',
      url: '/api/cmed/validate-price',
      payload: { ean: '7891234567890', price: 8.50, icmsRate: 18.0 },
    });

    expect(validRes.statusCode).toBe(200);
    const validData = JSON.parse(validRes.body);
    expect(validData.isValid).toBe(true);
  });

  it('should run store pricing audit, save pricing rules and apply price updates', async () => {
    // Importa base CMED
    const csvContent = `
SUBSTANCIA;CNPJ;LABORATORIO;REGISTRO;EAN_1;PRODUTO;APRESENTACAO;CLASSE_TERAPEUTICA;TIPO_PRODUTO;LISTA_CONCESSAO_CREDITO_TRIBUTARIO;PF_18;PMC_18
DIPIRONA;11.222.333/0001-99;MEDLEY;1000000000001;7891234567890;DIPIRONA;500MG/ML GOTAS;ANALGESICOS;GENÉRICO;POSITIVA;5,00;10,00
AMOXICILINA;44.555.666/0001-88;EMS;1000000000002;7899876543210;AMOXICILINA;500MG 21 CAPS;ANTIBACTERIANOS;GENÉRICO;NEGATIVA;20,00;35,00
    `.trim();

    await app.inject({
      method: 'POST',
      url: '/api/cmed/import',
      payload: { fileContent: csvContent, versionCode: 'CMED-2026-11' },
    });

    // Auditoria
    const auditRes = await app.inject({
      method: 'GET',
      url: '/api/cmed/audit?storeId=1&icmsRate=18',
    });

    expect(auditRes.statusCode).toBe(200);
    const auditData = JSON.parse(auditRes.body);
    expect(auditData.nonCompliantAbovePmcCount).toBe(1); // Dipirona está a R$ 12,00 (teto é 10,00)

    // Salva regra comercial
    const ruleRes = await app.inject({
      method: 'POST',
      url: '/api/cmed/rules',
      payload: {
        storeId: 1,
        categoryType: 'GENERICO',
        discountPercentPmc: 25.0,
        minGrossMarginPercent: 20.0,
      },
    });
    expect(ruleRes.statusCode).toBe(201);

    // Aplica correção de preço
    const updateRes = await app.inject({
      method: 'POST',
      url: '/api/cmed/apply-updates',
      payload: {
        storeId: 1,
        updates: [{ productId: 1, newPrice: 7.50, reason: 'Ajuste de conformidade CMED' }],
        auditorUser: 'GERENTE_FARMACIA',
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updateData = JSON.parse(updateRes.body);
    expect(updateData.updatedCount).toBe(1);

    // Re-auditoria: deve estar 100% compliant
    const reAuditRes = await app.inject({
      method: 'GET',
      url: '/api/cmed/audit?storeId=1&icmsRate=18',
    });
    const reAuditData = JSON.parse(reAuditRes.body);
    expect(reAuditData.nonCompliantAbovePmcCount).toBe(0);
  });
});
