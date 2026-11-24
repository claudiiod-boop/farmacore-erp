import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { TemperatureMonitoringService } from './temperature.service';
import type {
  RegisterSensorInput,
  RecordReadingInput,
  ResolveExcursionInput,
  SensorLocationType,
} from './temperature.types';

export async function registerTemperatureRoutes(app: FastifyInstance, db: Database) {
  const service = new TemperatureMonitoringService(db);

  // 1. Cadastrar / Configurar Sensor
  app.post('/api/temperature/sensors', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body.name || !body.locationType && !body.location_type) {
        return reply.status(400).send({ error: 'name e locationType são obrigatórios' });
      }

      const input: RegisterSensorInput = {
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        name: body.name,
        locationType: (body.locationType || body.location_type) as SensorLocationType,
        minAllowedTemp: body.minAllowedTemp !== undefined ? Number(body.minAllowedTemp) : (body.min_allowed_temp !== undefined ? Number(body.min_allowed_temp) : undefined),
        maxAllowedTemp: body.maxAllowedTemp !== undefined ? Number(body.maxAllowedTemp) : (body.max_allowed_temp !== undefined ? Number(body.max_allowed_temp) : undefined),
        minAllowedHumidity: body.minAllowedHumidity !== undefined ? Number(body.minAllowedHumidity) : (body.min_allowed_humidity !== undefined ? Number(body.min_allowed_humidity) : undefined),
        maxAllowedHumidity: body.maxAllowedHumidity !== undefined ? Number(body.maxAllowedHumidity) : (body.max_allowed_humidity !== undefined ? Number(body.max_allowed_humidity) : undefined),
        serialNumber: body.serialNumber || body.serial_number,
        calibrationCertNumber: body.calibrationCertNumber || body.calibration_cert_number,
        calibrationDueDate: body.calibrationDueDate || body.calibration_due_date,
      };

      const sensor = service.registerSensor(input);
      return reply.status(201).send(sensor);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao cadastrar sensor' });
    }
  });

  // 2. Listar Sensores
  app.get('/api/temperature/sensors', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const activeOnly = query.activeOnly !== undefined ? query.activeOnly === 'true' || query.activeOnly === true : true;

      const sensors = service.listSensors(storeId, activeOnly);
      return reply.send(sensors);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao listar sensores' });
    }
  });

  // 3. Registrar Leitura de Temperatura e Umidade
  app.post('/api/temperature/readings', async (request, reply) => {
    try {
      const body = request.body as any;
      const sensorId = Number(body.sensorId || body.sensor_id);
      if (!sensorId || body.temperature === undefined || body.temperature === null) {
        return reply.status(400).send({ error: 'sensorId e temperature são obrigatórios' });
      }

      const input: RecordReadingInput = {
        sensorId,
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : undefined,
        temperature: Number(body.temperature),
        humidity: body.humidity !== undefined && body.humidity !== null ? Number(body.humidity) : undefined,
        maxTempRecorded: body.maxTempRecorded !== undefined ? Number(body.maxTempRecorded) : (body.max_temp_recorded !== undefined ? Number(body.max_temp_recorded) : undefined),
        minTempRecorded: body.minTempRecorded !== undefined ? Number(body.minTempRecorded) : (body.min_temp_recorded !== undefined ? Number(body.min_temp_recorded) : undefined),
        recordedBy: body.recordedBy || body.recorded_by || 'Farmacêutico RT',
        notes: body.notes,
        recordedAt: body.recordedAt || body.recorded_at,
      };

      const result = service.recordReading(input);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar leitura' });
    }
  });

  // 4. Listar Leituras (Histórico / Mapa Térmico)
  app.get('/api/temperature/readings', async (request, reply) => {
    try {
      const query = request.query as any;
      const sensorId = Number(query.sensorId || query.sensor_id);
      if (!sensorId) {
        return reply.status(400).send({ error: 'sensorId é obrigatório' });
      }

      const readings = service.listReadings(sensorId, {
        startDate: query.startDate || query.start_date,
        endDate: query.endDate || query.end_date,
        limit: query.limit ? Number(query.limit) : undefined,
      });

      return reply.send(readings);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao listar leituras' });
    }
  });

  // 5. Listar Incidentes de Excursão Térmica
  app.get('/api/temperature/excursions', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const status = query.status as any;

      const excursions = service.listExcursions(storeId, status);
      return reply.send(excursions);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao listar excursões' });
    }
  });

  // 6. Resolver Incidente de Excursão Térmica
  app.post('/api/temperature/excursions/:id/resolve', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;

      if (!body.pharmacistCrf && !body.pharmacist_crf) {
        return reply.status(400).send({ error: 'pharmacistCrf é obrigatório para resolução de excursão' });
      }
      if (!body.actionTaken && !body.action_taken) {
        return reply.status(400).send({ error: 'actionTaken é obrigatório' });
      }

      const input: ResolveExcursionInput = {
        actionTaken: body.actionTaken || body.action_taken,
        pharmacistCrf: body.pharmacistCrf || body.pharmacist_crf,
        quarantineRecordId: body.quarantineRecordId || body.quarantine_record_id ? Number(body.quarantineRecordId || body.quarantine_record_id) : undefined,
      };

      const resolved = service.resolveExcursion(Number(id), input);
      return reply.send(resolved);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao resolver incidente de excursão' });
    }
  });

  // 7. KPIs Consolidados do Monitoramento Térmico
  app.get('/api/temperature/kpis', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;

      const kpis = service.getKpis(storeId);
      return reply.send(kpis);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao obter KPIs de temperatura' });
    }
  });
}
