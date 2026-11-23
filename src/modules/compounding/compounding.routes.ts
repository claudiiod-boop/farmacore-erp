import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { CompoundingService } from './compounding.service';
import { CompoundingCalculationService } from './compounding-calculation.service';
import { RawMaterialBatchStatus, CompoundingOrderStatus } from './compounding.types';

export async function registerCompoundingRoutes(app: FastifyInstance, db: Database) {
  const service = new CompoundingService(db);
  const calc = new CompoundingCalculationService();

  // 1. Matérias-Primas
  app.get('/api/compounding/raw-materials', async (request, reply) => {
    const { search } = request.query as any;
    const materials = service.listRawMaterials(search);
    return reply.send(materials);
  });

  app.post('/api/compounding/raw-materials', async (request, reply) => {
    try {
      const material = service.createRawMaterial(request.body as any);
      return reply.status(201).send(material);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao criar matéria-prima' });
    }
  });

  // 2. Lotes e Quarentena (Controle Analítico)
  app.get('/api/compounding/batches', async (request, reply) => {
    const { rawMaterialId, status } = request.query as any;
    const batches = service.listBatches(
      rawMaterialId ? Number(rawMaterialId) : undefined,
      status as RawMaterialBatchStatus
    );
    return reply.send(batches);
  });

  app.post('/api/compounding/batches', async (request, reply) => {
    try {
      const batch = service.createRawMaterialBatch(request.body as any);
      return reply.status(201).send(batch);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar lote' });
    }
  });

  app.post('/api/compounding/batches/:id/release', async (request, reply) => {
    const { id } = request.params as any;
    const { pharmacistName } = request.body as any;

    try {
      const batch = service.releaseRawMaterialBatch(
        Number(id),
        pharmacistName || 'FARMACEUTICO_RT'
      );
      return reply.send(batch);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao liberar lote da quarentena' });
    }
  });

  app.post('/api/compounding/batches/:id/reject', async (request, reply) => {
    const { id } = request.params as any;
    const { pharmacistName, rejectionReason } = request.body as any;

    if (!rejectionReason) {
      return reply.status(400).send({ error: 'Motivo da reprovação é obrigatório.' });
    }

    try {
      const batch = service.rejectRawMaterialBatch(
        Number(id),
        pharmacistName || 'FARMACEUTICO_RT',
        rejectionReason
      );
      return reply.send(batch);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao reprovar lote' });
    }
  });

  // 3. Calculadora de Cubagem & Cápsulas
  app.post('/api/compounding/calculate-capsule', async (request, reply) => {
    const { components, totalUnits, excipientDensity } = request.body as any;
    if (!components || components.length === 0) {
      return reply.status(400).send({ error: 'Componentes são obrigatórios para a cubagem.' });
    }

    try {
      const result = calc.calculateCapsuleDimensions(
        components,
        totalUnits || 30,
        excipientDensity || 0.60
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao dimensionar cápsulas' });
    }
  });

  // 4. Ordens de Manipulação (Ficha de Pesagem & Rótulos)
  app.get('/api/compounding/orders', async (request, reply) => {
    const { storeId, status } = request.query as any;
    const orders = service.listOrders(
      storeId ? Number(storeId) : 1,
      status as CompoundingOrderStatus
    );
    return reply.send(orders);
  });

  app.post('/api/compounding/orders', async (request, reply) => {
    const body = request.body as any;
    try {
      const order = service.createOrder(body.orderData || {}, body.components || []);
      return reply.status(201).send(order);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao criar ordem de manipulação' });
    }
  });

  app.get('/api/compounding/orders/:id', async (request, reply) => {
    const { id } = request.params as any;
    const order = service.getOrderById(Number(id));
    if (!order) {
      return reply.status(404).send({ error: 'Ordem de manipulação não encontrada.' });
    }
    return reply.send(order);
  });

  app.post('/api/compounding/orders/:id/weigh-item', async (request, reply) => {
    const { id } = request.params as any;
    const { itemId, weighedAmount, operatorName } = request.body as any;

    if (!itemId || weighedAmount === undefined) {
      return reply.status(400).send({ error: 'itemId e weighedAmount são obrigatórios.' });
    }

    try {
      const order = service.weighItem(
        Number(id),
        Number(itemId),
        Number(weighedAmount),
        operatorName || 'OPERADOR_PESAGEM'
      );
      return reply.send(order);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar pesagem' });
    }
  });

  app.post('/api/compounding/orders/:id/quality-control', async (request, reply) => {
    const { id } = request.params as any;
    const { actualAverageWeightMg, pharmacistName } = request.body as any;

    if (!actualAverageWeightMg) {
      return reply.status(400).send({ error: 'Peso médio aferido é obrigatório.' });
    }

    try {
      const order = service.evaluateQualityControl(
        Number(id),
        Number(actualAverageWeightMg),
        pharmacistName || 'FARMACEUTICO_RT'
      );
      return reply.send(order);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro no controle de qualidade' });
    }
  });

  app.get('/api/compounding/orders/:id/label', async (request, reply) => {
    const { id } = request.params as any;
    try {
      const labelText = service.generateMagistralLabel(Number(id));
      return reply.send({ labelText });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao gerar rótulo' });
    }
  });
}
