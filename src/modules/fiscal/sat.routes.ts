import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { SatFiscalService } from './sat.service';
import { RegisterSatDeviceInput, IssueCfeInput, CfeStatus } from './sat.types';

export function registerSatFiscalRoutes(app: FastifyInstance, db: Database) {
  const service = new SatFiscalService(db);

  // 1. Cadastrar / Vincular Módulo SAT
  app.post<{
    Body: RegisterSatDeviceInput;
  }>('/api/v1/fiscal/sat/devices', async (req, reply) => {
    try {
      const { store_id, pos_station_id, serial_number, sign_code } = req.body;
      if (!store_id || !pos_station_id || !serial_number || !sign_code) {
        return reply.status(400).send({
          success: false,
          error: 'store_id, pos_station_id, serial_number e sign_code são obrigatórios'
        });
      }

      const device = await service.registerSatDevice(req.body);
      return reply.send({ success: true, data: device });
    } catch (err: any) {
      if (err.message === 'STORE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Loja não encontrada' });
      }
      if (err.message === 'SERIAL_NUMBER_ALREADY_LINKED') {
        return reply.status(409).send({ success: false, error: 'Número de série do SAT já está vinculado a outro PDV' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 2. Consultar Status Operacional do Aparelho SAT
  app.get<{
    Params: { id: string };
  }>('/api/v1/fiscal/sat/devices/:id/status', async (req, reply) => {
    try {
      const deviceId = Number(req.params.id);
      const status = await service.checkSatStatus(deviceId);
      return reply.send({ success: true, data: status });
    } catch (err: any) {
      if (err.message === 'SAT_DEVICE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Dispositivo SAT não encontrado' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 3. Emitir Cupom Fiscal Eletrônico CF-e-SAT
  app.post<{
    Body: IssueCfeInput;
  }>('/api/v1/fiscal/sat/cfe/issue', async (req, reply) => {
    try {
      const { sale_id, sat_device_id } = req.body;
      if (!sale_id || !sat_device_id) {
        return reply.status(400).send({
          success: false,
          error: 'sale_id e sat_device_id são obrigatórios'
        });
      }

      const cfe = await service.issueCfeSat(req.body);
      return reply.send({ success: true, data: cfe });
    } catch (err: any) {
      if (err.message === 'SALE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Venda não encontrada' });
      }
      if (err.message === 'CFE_ALREADY_ISSUED') {
        return reply.status(409).send({ success: false, error: 'Venda já possui CF-e emitido' });
      }
      if (err.message === 'SAT_DEVICE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Dispositivo SAT não encontrado' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 4. Sincronização em Lote de Contingência Off-line
  app.post<{
    Params: { deviceId: string };
  }>('/api/v1/fiscal/sat/devices/:deviceId/sync-contingency', async (req, reply) => {
    try {
      const deviceId = Number(req.params.deviceId);
      const result = await service.syncContingencyBatch(deviceId);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 5. Cancelar Último CF-e Emitido
  app.post<{
    Params: { id: string };
    Body: { justification: string };
  }>('/api/v1/fiscal/sat/cfe/:id/cancel', async (req, reply) => {
    try {
      const cfeId = Number(req.params.id);
      const { justification } = req.body;
      if (!justification) {
        return reply.status(400).send({ success: false, error: 'Justificativa de cancelamento é obrigatória' });
      }

      const cancelled = await service.cancelLastCfe(cfeId, justification);
      return reply.send({ success: true, data: cancelled });
    } catch (err: any) {
      if (err.message === 'CFE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Cupom CF-e não encontrado' });
      }
      if (err.message === 'CANCELLATION_DEADLINE_EXCEEDED') {
        return reply.status(422).send({
          success: false,
          error: 'PRAZO REGULATÓRIO EXPIRADO: O cancelamento de CF-e-SAT só é permitido em até 30 minutos após a emissão (Portaria CAT 147/2012).'
        });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 6. Extrato Térmico 80mm com QR Code
  app.get<{
    Params: { id: string };
  }>('/api/v1/fiscal/sat/cfe/:id/extrato', async (req, reply) => {
    try {
      const cfeId = Number(req.params.id);
      const extrato = await service.getExtratoThermalLayout(cfeId);
      return reply.send({ success: true, data: { extrato } });
    } catch (err: any) {
      if (err.message === 'CFE_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: 'Cupom CF-e não encontrado' });
      }
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 7. Lista Cupons CF-e
  app.get<{
    Querystring: { store_id?: string; status?: CfeStatus };
  }>('/api/v1/fiscal/sat/cfe', async (req, reply) => {
    try {
      const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
      const status = req.query.status;
      const list = await service.listCfeDocuments(storeId, status);
      return reply.send({ success: true, data: list });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 8. KPIs Fiscais SAT
  app.get<{
    Querystring: { store_id?: string };
  }>('/api/v1/fiscal/sat/kpis', async (req, reply) => {
    try {
      const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
      const kpis = await service.getSatKpis(storeId);
      return reply.send({ success: true, data: kpis });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
}
