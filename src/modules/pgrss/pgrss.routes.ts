import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { PgrssDisposalService } from './pgrss.service';

export async function registerPgrssRoutes(app: FastifyInstance, db: Database) {
  const service = new PgrssDisposalService(db);

  // 1. Segregar Medicamento / Resíduo para Descarte
  app.post('/api/sanitary/pgrss/segregate', async (request, reply) => {
    try {
      const body = request.body as any;
      const record = service.segregateWaste({
        store_id: Number(body.storeId || body.store_id),
        product_id: Number(body.productId || body.product_id),
        batch_id: body.batchId || body.batch_id ? Number(body.batchId || body.batch_id) : undefined,
        waste_group: body.wasteGroup || body.waste_group,
        reason: body.reason,
        quantity: Number(body.quantity),
        weight_kg: Number(body.weightKg || body.weight_kg),
        pharmacist_name: body.pharmacistName || body.pharmacist_name,
        pharmacist_crf: body.pharmacistCrf || body.pharmacist_crf,
        notes: body.notes,
      });
      return reply.status(201).send(record);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao segregar resíduo' });
    }
  });

  // 2. Listar Resíduos Segregados
  app.get('/api/sanitary/pgrss/records', async (request, reply) => {
    const query = request.query as any;
    const records = service.listWasteRecords({
      store_id: query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined,
      status: query.status,
      waste_group: query.wasteGroup || query.waste_group,
      reason: query.reason,
      start_date: query.startDate || query.start_date,
      end_date: query.endDate || query.end_date,
    });
    return reply.send(records);
  });

  app.get('/api/sanitary/pgrss/records/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const record = service.getRecordById(Number(id));
      return reply.send(record);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // 3. Emitir Manifesto MTR
  app.post('/api/sanitary/pgrss/manifests', async (request, reply) => {
    try {
      const body = request.body as any;
      const manifest = service.createMtrManifest({
        store_id: Number(body.storeId || body.store_id),
        collector_name: body.collectorName || body.collector_name,
        collector_cnpj: body.collectorCnpj || body.collector_cnpj,
        environmental_license: body.environmentalLicense || body.environmental_license,
        vehicle_plate: body.vehiclePlate || body.vehicle_plate,
        driver_name: body.driverName || body.driver_name,
        dispatch_date: body.dispatchDate || body.dispatch_date,
        disposal_record_ids: body.disposalRecordIds || body.disposal_record_ids || [],
      });
      return reply.status(201).send(manifest);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao emitir manifesto MTR' });
    }
  });

  // 4. Listar Manifestos MTR
  app.get('/api/sanitary/pgrss/manifests', async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined;
    const manifests = service.listManifests(storeId);
    return reply.send(manifests);
  });

  app.get('/api/sanitary/pgrss/manifests/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const manifest = service.getManifestById(Number(id));
      return reply.send(manifest);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // 5. Espelho de Documento MTR
  app.get('/api/sanitary/pgrss/manifests/:id/document', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const documentText = service.generateMtrDocument(Number(id));
      return reply.send({ document: documentText });
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // 6. Finalizar MTR com CDF (Certificado de Destinação Final)
  app.patch('/api/sanitary/pgrss/manifests/:id/cdf', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const finalized = service.finalizeWithCdf(Number(id), {
        cdf_number: body.cdfNumber || body.cdf_number,
        certificate_date: body.certificateDate || body.certificate_date || new Date().toISOString().substring(0, 10),
        incineration_plant: body.incinerationPlant || body.incineration_plant,
      });
      return reply.send(finalized);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao finalizar MTR com CDF' });
    }
  });

  // 7. KPIs Sanitários
  app.get('/api/sanitary/pgrss/kpis', async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined;
    const kpis = service.getPgrssKpis(storeId);
    return reply.send(kpis);
  });
}
