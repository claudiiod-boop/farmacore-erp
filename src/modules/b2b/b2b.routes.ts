import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { ReplenishmentService } from './replenishment.service';
import { QuotationOptimizerService } from './quotation-optimizer.service';
import { EdiFarmaService } from './edi-farma.service';

export async function registerB2bRoutes(app: FastifyInstance, db: Database) {
  const replenishmentService = new ReplenishmentService(db);
  const optimizerService = new QuotationOptimizerService(db);

  // 1. Sugestões de Reposição (Ponto de Pedido & Ruptura)
  app.get('/api/b2b/replenishment/suggestions', async (request, reply) => {
    const { storeId, abcFilter, minRuptureRiskOnly } = request.query as any;
    const store = storeId ? Number(storeId) : 1;
    const abc = abcFilter ? (Array.isArray(abcFilter) ? abcFilter : [abcFilter]) : undefined;
    const riskOnly = minRuptureRiskOnly === 'true' || minRuptureRiskOnly === true;

    const suggestions = replenishmentService.getReplenishmentSuggestions(store, {
      abcFilter: abc,
      minRuptureRiskOnly: riskOnly,
    });
    return reply.send(suggestions);
  });

  // 2. Salvar Regra de Reposição
  app.post('/api/b2b/replenishment/rules', async (request, reply) => {
    const body = request.body as any;
    if (!body.storeId || !body.productId) {
      return reply.status(400).send({ error: 'storeId e productId são obrigatórios.' });
    }
    const saved = replenishmentService.saveReplenishmentRule(body);
    return reply.status(201).send(saved);
  });

  // 3. Listar Fornecedores / Distribuidoras B2B
  app.get('/api/b2b/suppliers', async (request, reply) => {
    const { activeOnly } = request.query as any;
    let sql = 'SELECT * FROM b2b_suppliers';
    if (activeOnly === 'true') {
      sql += ' WHERE active = 1';
    }
    sql += ' ORDER BY name ASC';
    const suppliers = db.prepare(sql).all();
    return reply.send(suppliers);
  });

  // 4. Cadastrar Fornecedor B2B
  app.post('/api/b2b/suppliers', async (request, reply) => {
    const body = request.body as any;
    if (!body.code || !body.name || !body.cnpj) {
      return reply.status(400).send({ error: 'code, name e cnpj são obrigatórios.' });
    }

    const info = db
      .prepare(
        `INSERT INTO b2b_suppliers (code, name, trade_name, cnpj, edi_code, min_order_value, lead_time_days, payment_terms, email, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        body.code,
        body.name,
        body.tradeName || null,
        body.cnpj,
        body.ediCode || null,
        body.minOrderValue || 0,
        body.leadTimeDays || 1,
        body.paymentTerms || '28 DDL',
        body.email || null,
        body.phone || null
      );

    return reply.status(201).send({
      id: Number(info.lastInsertRowid),
      ...body,
    });
  });

  // 5. Criar Campanha de Cotação
  app.post('/api/b2b/campaigns', async (request, reply) => {
    const body = request.body as any;
    if (!body.storeId || !body.title || !body.items || body.items.length === 0) {
      return reply
        .status(400)
        .send({ error: 'storeId, title e lista de itens são obrigatórios para a cotação.' });
    }

    const campaign = optimizerService.createCampaign({
      storeId: Number(body.storeId),
      title: body.title,
      notes: body.notes,
      items: body.items,
    });

    return reply.status(201).send(campaign);
  });

  // 6. Listar Campanhas de Cotação
  app.get('/api/b2b/campaigns', async (request, reply) => {
    const { storeId, status } = request.query as any;
    const store = storeId ? Number(storeId) : 1;
    const campaigns = optimizerService.listCampaigns(store, status);
    return reply.send(campaigns);
  });

  // 7. Obter Detalhes da Campanha
  app.get('/api/b2b/campaigns/:id', async (request, reply) => {
    const { id } = request.params as any;
    const campaign = optimizerService.getCampaign(Number(id));
    if (!campaign) {
      return reply.status(404).send({ error: 'Campanha de cotação não encontrada.' });
    }
    return reply.send(campaign);
  });

  // 8. Exportar Espelho de Cotação EDI Farma
  app.post('/api/b2b/campaigns/:id/export-edi', async (request, reply) => {
    const { id } = request.params as any;
    const campaign = optimizerService.getCampaign(Number(id));
    if (!campaign) {
      return reply.status(404).send({ error: 'Campanha de cotação não encontrada.' });
    }

    const store = db.prepare<any>('SELECT * FROM stores WHERE id = ?').get(campaign.storeId);
    const ediLines = (campaign.items || []).map((i) => ({
      ean: i.ean || '0000000000000',
      description: i.productName || 'Medicamento',
      quantityRequested: i.requestedQuantity,
      targetPrice: i.targetPrice,
    }));

    const ediFileContent = EdiFarmaService.generateEdiQuotationFile({
      campaignCode: campaign.campaignCode,
      pharmacyCnpj: store?.cnpj || '12345678000190',
      pharmacyName: store?.name || 'Drogaria FarmaCore',
      lines: ediLines,
    });

    return reply.send({
      campaignCode: campaign.campaignCode,
      fileName: `${campaign.campaignCode}_EDI_COTACAO.txt`,
      content: ediFileContent,
    });
  });

  // 9. Importar Proposta EDI de Distribuidora
  app.post('/api/b2b/campaigns/:id/import-proposals', async (request, reply) => {
    const { id } = request.params as any;
    const campaignId = Number(id);
    const body = request.body as any;

    if (!body.ediContent) {
      return reply.status(400).send({ error: 'Conteúdo EDI (ediContent) é obrigatório.' });
    }

    const parsed = EdiFarmaService.parseEdiProposalResponse(body.ediContent);
    let supplierId = body.supplierId ? Number(body.supplierId) : 0;

    if (!supplierId && parsed.supplierCnpj) {
      const supp = db
        .prepare<any>('SELECT id FROM b2b_suppliers WHERE cnpj = ?')
        .get(parsed.supplierCnpj);
      if (supp) supplierId = supp.id;
    }

    if (!supplierId) {
      return reply.status(400).send({
        error:
          'Distribuidor não identificado. Informe supplierId ou garanta que o CNPJ esteja cadastrado.',
      });
    }

    const campaign = optimizerService.getCampaign(campaignId);
    if (!campaign) {
      return reply.status(404).send({ error: 'Campanha de cotação não encontrada.' });
    }

    // Mapeia EAN para quotationItemId e productId
    const itemsToSubmit: any[] = [];
    for (const pItem of parsed.items) {
      const match = (campaign.items || []).find((ci) => ci.ean === pItem.ean);
      if (match) {
        itemsToSubmit.push({
          quotationItemId: match.id!,
          productId: match.productId,
          offeredPrice: pItem.offeredPrice,
          discountPercent: pItem.discountPercent,
          availableQuantity: pItem.availableQuantity,
          stIcmsIncluded: pItem.stIcmsIncluded,
        });
      }
    }

    const proposal = optimizerService.submitProposal({
      campaignId,
      supplierId,
      proposalCode: body.proposalCode || `PROP-${parsed.campaignCode || 'AUTO'}`,
      paymentTerms: body.paymentTerms,
      deliveryDays: body.deliveryDays,
      items: itemsToSubmit,
    });

    return reply.status(201).send(proposal);
  });

  // 10. Submeter Proposta Manual
  app.post('/api/b2b/campaigns/:id/proposals', async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;

    if (!body.supplierId || !body.proposalCode || !body.items || body.items.length === 0) {
      return reply
        .status(400)
        .send({ error: 'supplierId, proposalCode e itens são obrigatórios na proposta.' });
    }

    const proposal = optimizerService.submitProposal({
      campaignId: Number(id),
      supplierId: Number(body.supplierId),
      proposalCode: body.proposalCode,
      paymentTerms: body.paymentTerms,
      deliveryDays: body.deliveryDays,
      items: body.items,
    });

    return reply.status(201).send(proposal);
  });

  // 11. Otimizar Cotação (Split Order vs Pedido Fechado)
  app.post('/api/b2b/campaigns/:id/optimize', async (request, reply) => {
    const { id } = request.params as any;
    const { mode } = request.body as any;
    const optMode = mode === 'SINGLE_SUPPLIER_BEST_TOTAL' ? 'SINGLE_SUPPLIER_BEST_TOTAL' : 'SPLIT_ORDER';

    const result = optimizerService.optimizeCampaign(Number(id), optMode);
    return reply.send(result);
  });

  // 12. Gerar Pedidos de Compra a partir da Cotação
  app.post('/api/b2b/campaigns/:id/generate-orders', async (request, reply) => {
    const { id } = request.params as any;
    const res = optimizerService.generatePurchaseOrders(Number(id));
    return reply.send(res);
  });
}
