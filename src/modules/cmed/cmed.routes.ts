import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { CmedParserService } from './cmed-parser.service';
import { CmedPricingService } from './cmed-pricing.service';

export async function registerCmedRoutes(app: FastifyInstance, db: Database) {
  const parserService = new CmedParserService(db);
  const pricingService = new CmedPricingService(db);

  // 1. Importação da Tabela Oficial CMED / ANVISA
  app.post('/api/cmed/import', async (request, reply) => {
    const body = request.body as any;
    if (!body.fileContent || !body.versionCode) {
      return reply
        .status(400)
        .send({ error: 'fileContent e versionCode são obrigatórios para a importação.' });
    }

    try {
      const result = parserService.importCmedFile(body.fileContent, body.versionCode);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao processar arquivo CMED' });
    }
  });

  // 2. Consulta de Medicamentos na Base CMED Ativa
  app.get('/api/cmed/search', async (request, reply) => {
    const { q, limit } = request.query as any;
    const queryTerm = (q || '').trim();
    const maxLimit = limit ? Math.min(Number(limit), 100) : 50;

    let sql = `
      SELECT cp.*
      FROM cmed_products cp
      JOIN cmed_table_versions ctv ON ctv.id = cp.version_id
      WHERE ctv.is_active = 1
    `;
    const params: any[] = [];

    if (queryTerm) {
      sql += ' AND (cp.ean LIKE ? OR cp.product_name LIKE ? OR cp.substance_name LIKE ?)';
      params.push(`%${queryTerm}%`, `%${queryTerm}%`, `%${queryTerm}%`);
    }

    sql += ' ORDER BY cp.product_name ASC LIMIT ?';
    params.push(maxLimit);

    const products = db.prepare(sql).all(...params);
    return reply.send(products);
  });

  // 3. Validação Pontual de Preço contra o Teto PMC (Trava Regulatória)
  app.post('/api/cmed/validate-price', async (request, reply) => {
    const body = request.body as any;
    if (!body.ean || body.price === undefined) {
      return reply.status(400).send({ error: 'ean e price são obrigatórios.' });
    }

    const icms = body.icmsRate ? Number(body.icmsRate) : 18.0;
    const result = pricingService.validatePmcCap(body.ean, Number(body.price), icms);
    return reply.send(result);
  });

  // 4. Auditoria Geral de Preços da Loja vs Tabela CMED
  app.get('/api/cmed/audit', async (request, reply) => {
    const { storeId, icmsRate } = request.query as any;
    const store = storeId ? Number(storeId) : 1;
    const icms = icmsRate ? Number(icmsRate) : 18.0;

    const report = pricingService.runPricingAudit(store, icms);
    return reply.send(report);
  });

  // 5. Consultar Regras de Precificação Comercial por Categoria
  app.get('/api/cmed/rules', async (request, reply) => {
    const { storeId } = request.query as any;
    const store = storeId ? Number(storeId) : 1;
    const rules = pricingService.getPricingRules(store);
    return reply.send(rules);
  });

  // 6. Salvar Regra de Precificação Comercial
  app.post('/api/cmed/rules', async (request, reply) => {
    const body = request.body as any;
    if (!body.storeId || !body.categoryType || body.discountPercentPmc === undefined) {
      return reply
        .status(400)
        .send({ error: 'storeId, categoryType e discountPercentPmc são obrigatórios.' });
    }

    const saved = pricingService.savePricingRule(body);
    return reply.status(201).send(saved);
  });

  // 7. Aplicação em Lote de Preços Atualizados (Conformidade Regulatória)
  app.post('/api/cmed/apply-updates', async (request, reply) => {
    const body = request.body as any;
    if (!body.storeId || !body.updates || !Array.isArray(body.updates) || body.updates.length === 0) {
      return reply
        .status(400)
        .send({ error: 'storeId e updates (array com productId e newPrice) são obrigatórios.' });
    }

    const result = pricingService.applyBatchPriceUpdates(
      Number(body.storeId),
      body.updates,
      body.auditorUser || 'SISTEMA'
    );
    return reply.send(result);
  });
}
