import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { FractionationService } from './fractionation.service';

export async function registerFractionationRoutes(app: FastifyInstance, db: Database) {
  const service = new FractionationService(db);

  // 1. Listar Produtos Fracionáveis
  app.get('/api/fractionation/products', async (request, reply) => {
    const { search } = request.query as any;
    const products = service.listFractionableProducts(search);
    return reply.send(products);
  });

  // 2. Alternar Status de Fracionabilidade do Produto
  app.patch('/api/fractionation/products/:id/toggle', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { isFractionable, unitsPerPackage, fractionalUnit } = request.body as any;
      const updated = service.toggleProductFractionable(
        Number(id),
        Boolean(isFractionable),
        unitsPerPackage ? Number(unitsPerPackage) : undefined,
        fractionalUnit
      );
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao parametrizar fracionamento do produto' });
    }
  });

  // 3. Executar Fracionamento Farmacêutico
  app.post('/api/fractionation/records', async (request, reply) => {
    try {
      const record = service.fractionateMedicine(request.body as any);
      return reply.status(201).send(record);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar fracionamento' });
    }
  });

  // 4. Listar Registros de Fracionamento
  app.get('/api/fractionation/records', async (request, reply) => {
    const { storeId } = request.query as any;
    const records = service.listFractionationRecords(storeId ? Number(storeId) : undefined);
    return reply.send(records);
  });

  // 5. Obter Detalhes do Registro de Fracionamento
  app.get('/api/fractionation/records/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const record = service.getFractionationRecord(Number(id));
      return reply.send(record);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message || 'Registro de fracionamento não encontrado' });
    }
  });

  // 6. Dispensar Medicamento Fracionado ao Paciente
  app.post('/api/fractionation/dispense', async (request, reply) => {
    try {
      const dispensation = service.dispenseFractioned(request.body as any);
      return reply.status(201).send(dispensation);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao dispensar medicamento fracionado' });
    }
  });

  // 7. Obter Rótulo Sanitário Térmico Oficial (RDC 80/2006)
  app.get('/api/fractionation/label/:dispensationId', async (request, reply) => {
    try {
      const { dispensationId } = request.params as any;
      const label = service.generateOfficialLabel(Number(dispensationId));
      return reply.send({ labelText: label });
    } catch (err: any) {
      return reply.status(404).send({ error: err.message || 'Dispensação não encontrada' });
    }
  });

  // 8. KPIs de Fracionamento
  app.get('/api/fractionation/kpis', async (_request, reply) => {
    const kpis = service.getFractionationKpis();
    return reply.send(kpis);
  });
}
