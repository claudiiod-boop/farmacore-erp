import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Database } from '../../database/connection';
import { SpedFiscalService } from './sped-fiscal.service';
import { SintegraService } from './sintegra.service';
import { SpedAuditService } from './sped-audit.service';
import { SpedFiscalFormatter } from './sped-formatter';
import type { AccountingParameters, SpedGenerationParams } from './sped.types';

export function registerSpedRoutes(app: FastifyInstance, db: Database): void {
  const spedFiscalService = new SpedFiscalService(db);
  const sintegraService = new SintegraService(db);
  const spedAuditService = new SpedAuditService(db);

  // 1. Obter parâmetros contábeis
  app.get<{ Params: { storeId: string } }>('/api/sped/parameters/:storeId', async (req, reply) => {
    const storeId = Number(req.params.storeId) || 1;
    const params = spedFiscalService.getAccountingParameters(storeId);
    return reply.send(params || {});
  });

  // 2. Salvar parâmetros contábeis
  app.post<{ Body: AccountingParameters }>('/api/sped/parameters', async (req, reply) => {
    const body = req.body;
    if (!body.storeId || !body.accountantName || !body.accountantCpf || !body.accountantCrc) {
      return reply.status(400).send({ error: 'Campos obrigatórios do contador não preenchidos' });
    }
    const saved = spedFiscalService.setAccountingParameters(body);
    return reply.status(201).send(saved);
  });

  // 3. Executar pré-validação e auditoria
  app.post<{ Body: { storeId: number } }>('/api/sped/audit', async (req, reply) => {
    const storeId = Number(req.body.storeId) || 1;
    const result = spedAuditService.auditStoreFiscalData(storeId);
    return reply.send(result);
  });

  // 4. Obter itens do inventário Bloco H
  app.get<{ Querystring: { storeId?: string; date?: string } }>('/api/sped/inventory', async (req, reply) => {
    const storeId = Number(req.query.storeId) || 1;
    const items = spedFiscalService.getInventoryBlockH(storeId, req.query.date);
    const totalValue = items.reduce((sum, it) => sum + it.totalValue, 0);
    return reply.send({
      storeId,
      date: req.query.date || new Date().toISOString().substring(0, 10),
      totalItems: items.length,
      totalValue: Number(totalValue.toFixed(2)),
      items
    });
  });

  // 5. Gerar arquivo oficial (SPED ou Sintegra)
  app.post<{ Body: SpedGenerationParams }>('/api/sped/generate', async (req, reply) => {
    const body = req.body;
    if (!body.storeId || !body.periodStart || !body.periodEnd || !body.generationType) {
      return reply.status(400).send({ error: 'Parâmetros de geração incompletos' });
    }

    let record;
    if (body.generationType === 'SINTEGRA') {
      record = await sintegraService.generateSintegra(body);
    } else {
      record = await spedFiscalService.generateSpedFiscal(body);
    }

    // Executa auditoria vinculada à geração
    spedAuditService.auditStoreFiscalData(body.storeId, record.id);
    const updated = spedFiscalService.getGenerationById(record.id);

    return reply.status(201).send(updated || record);
  });

  // 6. Listar histórico de gerações
  app.get<{ Querystring: { storeId?: string; type?: string } }>('/api/sped/history', async (req, reply) => {
    const storeId = Number(req.query.storeId) || 1;
    const list = spedFiscalService.listGenerations(storeId, req.query.type);
    return reply.send(list);
  });

  // 7. Obter detalhes e download de geração
  app.get<{ Params: { id: string } }>('/api/sped/generations/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const record = spedFiscalService.getGenerationById(id);
    if (!record) {
      return reply.status(404).send({ error: 'Registro de geração fiscal não encontrado' });
    }
    return reply.send(record);
  });

  app.get<{ Params: { id: string } }>('/api/sped/download/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const record = spedFiscalService.getGenerationById(id);
    if (!record) {
      return reply.status(404).send({ error: 'Registro de geração fiscal não encontrado' });
    }

    reply.header('Content-Type', 'text/plain; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${record.fileName}"`);
    return reply.send(record.fileContent);
  });

  // 8. Imprimir comprovante térmico ESC/POS
  app.get<{ Params: { id: string } }>('/api/sped/print/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const record = spedFiscalService.getGenerationById(id);
    if (!record) {
      return reply.status(404).send({ error: 'Registro de geração fiscal não encontrado' });
    }

    const store = db.prepare('SELECT name, company_name FROM stores WHERE id = ?').get(record.storeId) as any;
    const storeName = store?.name || store?.company_name || 'DROGARIA FARMACORE';
    const slipText = SpedFiscalFormatter.formatSpedSummarySlip(record, storeName);

    return reply.send({
      generationId: record.id,
      fileName: record.fileName,
      slipText
    });
  });
}
