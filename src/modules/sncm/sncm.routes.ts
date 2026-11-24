import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { SncmService } from './sncm.service';

export async function registerSncmRoutes(app: FastifyInstance, db: Database) {
  const service = new SncmService(db);

  // 1. Decodificar código GS1 DataMatrix
  app.post('/api/sncm/parse-datamatrix', async (request, reply) => {
    try {
      const body = (request.body as any) || {};
      const raw = body.raw || body.dataMatrix || body.barcode;
      if (!raw) {
        return reply.status(400).send({ error: 'Parâmetro raw (DataMatrix) é obrigatório' });
      }
      const parsed = service.parseDataMatrix(raw);
      return reply.send(parsed);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao decodificar DataMatrix' });
    }
  });

  // 2. Registrar Recebimento de Carga Serializada
  app.post('/api/sncm/receipt', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return reply.status(400).send({ error: 'Lista de itens para recebimento é obrigatória' });
      }

      const result = service.registerReceipt({
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        nfeAccessKey: body.nfeAccessKey || body.nfe_access_key,
        operatorName: body.operatorName || body.operator_name,
        items: body.items,
      });

      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar recebimento SNCM' });
    }
  });

  // 3. Dispensar unidade física no PDV / Balcão
  app.post('/api/sncm/dispense', async (request, reply) => {
    try {
      const body = request.body as any;
      const serialNumber = body.serialNumber || body.serial_number;
      const rawDataMatrix = body.rawDataMatrix || body.raw_data_matrix;

      if (!serialNumber && !rawDataMatrix) {
        return reply.status(400).send({ error: 'Número de série ou código DataMatrix é obrigatório' });
      }

      const result = service.dispenseItem({
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        gtin: body.gtin,
        serialNumber,
        rawDataMatrix,
        saleId: body.saleId || body.sale_id ? Number(body.saleId || body.sale_id) : undefined,
        fiscalDocNumber: body.fiscalDocNumber || body.fiscal_doc_number,
        operatorName: body.operatorName || body.operator_name,
      });

      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao dispensar unidade SNCM' });
    }
  });

  // 4. Listar Estoque Serializado
  app.get('/api/sncm/items', async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
    const status = query.status;
    const search = query.search || query.q;
    const items = service.listItems(storeId, status, search);
    return reply.send(items);
  });

  // 5. Consultar Histórico e Autenticidade de um Serial
  app.get('/api/sncm/items/:serial', async (request, reply) => {
    const { serial } = request.params as { serial: string };
    const query = request.query as any;
    const gtin = query.gtin;

    const item = service.queryItem(serial, gtin);
    if (!item) {
      return reply.status(404).send({ error: 'Unidade rastreada não encontrada' });
    }
    return reply.send(item);
  });

  // 6. Retenção em Quarentena Sanitária
  app.post('/api/sncm/items/:serial/quarantine', async (request, reply) => {
    try {
      const { serial } = request.params as { serial: string };
      const body = (request.body as any) || {};
      const reason = body.reason || 'Retenção cautelar sanitária';
      const gtin = body.gtin;
      const operatorName = body.operatorName || body.operator_name;

      const item = service.quarantineItem(serial, reason, gtin, operatorName);
      return reply.send(item);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao colocar item em quarentena' });
    }
  });

  // 7. Listar Eventos Sanitários
  app.get('/api/sncm/events', async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
    const limit = query.limit ? Number(query.limit) : 50;
    const events = service.listEvents(storeId, limit);
    return reply.send(events);
  });

  // 8. Transmitir Eventos à ANVISA
  app.post('/api/sncm/transmit', async (request, reply) => {
    try {
      const body = (request.body as any) || {};
      const storeId = body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1;
      const result = service.transmitEvents(storeId);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao transmitir eventos ao SNCM' });
    }
  });

  // 9. KPIs Regulatórios SNCM
  app.get('/api/sncm/kpis', async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
    const kpis = service.getSncmKpis(storeId);
    return reply.send(kpis);
  });
}
