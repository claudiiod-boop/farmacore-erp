import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { ScaleWeighingService } from './scale.service';
import {
  RegisterScaleDeviceInput,
  DecodeWeightedBarcodeInput,
  GenerateWeighingLabelInput
} from './scale.types';

export function registerScaleRoutes(app: FastifyInstance, db: Database) {
  const service = new ScaleWeighingService(db);

  // 1. Cadastrar Balança Serial
  app.post<{
    Body: RegisterScaleDeviceInput;
  }>('/api/v1/scales/devices', async (req, reply) => {
    try {
      const { store_id, name, serial_port, inmetro_seal_number } = req.body;
      if (!store_id || !name || !serial_port || !inmetro_seal_number) {
        return reply.status(400).send({
          success: false,
          error: 'store_id, name, serial_port e inmetro_seal_number são obrigatórios'
        });
      }

      const device = await service.registerScaleDevice(req.body);
      return reply.send({ success: true, data: device });
    } catch (err: any) {
      if (err.message === 'STORE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Loja não encontrada' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 2. Leitura Direta de Balança Serial
  app.get<{
    Params: { id: string };
    Querystring: { gross?: string; tare?: string };
  }>('/api/v1/scales/devices/:id/read', async (req, reply) => {
    try {
      const deviceId = Number(req.params.id);
      const gross = req.query.gross !== undefined ? Number(req.query.gross) : undefined;
      const tare = req.query.tare !== undefined ? Number(req.query.tare) : undefined;

      const reading = await service.readWeightFromScale(deviceId, gross, tare);
      return reply.send({ success: true, data: reading });
    } catch (err: any) {
      if (err.message === 'SCALE_DEVICE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Balança não encontrada' });
      }
      if (err.message === 'SCALE_DEVICE_INACTIVE') {
        return reply.status(400).send({ success: false, error: 'Balança inativa' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 3. Decodificar Código de Barras Pesável EAN-13
  app.post<{
    Body: DecodeWeightedBarcodeInput;
  }>('/api/v1/scales/barcodes/decode', async (req, reply) => {
    try {
      const { barcode } = req.body;
      if (!barcode) {
        return reply.status(400).send({
          success: false,
          error: 'barcode é obrigatório'
        });
      }

      const result = await service.decodeWeightedBarcode(req.body);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      if (err.message === 'WEIGHTED_PRODUCT_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Produto pesável não encontrado no cadastro' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 4. Gerar Etiqueta Térmica de Pesagem
  app.post<{
    Body: GenerateWeighingLabelInput;
  }>('/api/v1/scales/labels/generate', async (req, reply) => {
    try {
      const { product_id, gross_weight_grams } = req.body;
      if (!product_id || gross_weight_grams === undefined) {
        return reply.status(400).send({
          success: false,
          error: 'product_id e gross_weight_grams são obrigatórios'
        });
      }

      const label = await service.generateWeighingLabel(req.body);
      return reply.send({ success: true, data: label });
    } catch (err: any) {
      if (err.message === 'PRODUCT_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Produto não encontrado' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 5. KPIs de Balança
  app.get<{
    Querystring: { store_id?: string };
  }>('/api/v1/scales/kpis', async (req, reply) => {
    try {
      const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
      const kpis = await service.getScaleKpis(storeId);
      return reply.send({ success: true, data: kpis });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
}
