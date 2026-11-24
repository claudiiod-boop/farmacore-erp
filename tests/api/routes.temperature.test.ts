import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Monitoramento Térmico & Higrometria (Fase 34)', () => {
  let app: FastifyInstance;
  let db: Database;
  let storeId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. POST /api/temperature/sensors deve cadastrar novo sensor de temperatura', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/temperature/sensors',
      payload: {
        storeId,
        name: 'Geladeira Principal 01',
        locationType: 'REFRIGERATOR_COLD_CHAIN',
        serialNumber: 'SEN-GEL-100',
        calibrationCertNumber: 'RBC-2026-1122',
        calibrationDueDate: '2027-12-31',
      },
    });

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.body);
    expect(data.id).toBeDefined();
    expect(data.name).toBe('Geladeira Principal 01');
    expect(data.min_allowed_temp).toBe(2.0);
    expect(data.max_allowed_temp).toBe(8.0);
  });

  it('2. GET /api/temperature/sensors deve listar sensores cadastrados', async () => {
    // Cadastrar 1 sensor
    await app.inject({
      method: 'POST',
      url: '/api/temperature/sensors',
      payload: {
        storeId,
        name: 'Sensor Salão de Vendas',
        locationType: 'SALES_FLOOR',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/temperature/sensors?storeId=${storeId}`,
    });

    expect(res.statusCode).toBe(200);
    const sensors = JSON.parse(res.body);
    expect(Array.isArray(sensors)).toBe(true);
    expect(sensors.length).toBeGreaterThanOrEqual(1);
    expect(sensors[0].location_type).toBe('SALES_FLOOR');
  });

  it('3. POST /api/temperature/readings deve registrar leitura dentro da conformidade', async () => {
    const sRes = await app.inject({
      method: 'POST',
      url: '/api/temperature/sensors',
      payload: {
        storeId,
        name: 'Geladeira Insulinas',
        locationType: 'REFRIGERATOR_COLD_CHAIN',
      },
    });
    const sensor = JSON.parse(sRes.body);

    const rRes = await app.inject({
      method: 'POST',
      url: '/api/temperature/readings',
      payload: {
        sensorId: sensor.id,
        storeId,
        temperature: 4.8,
        recordedBy: 'Farmacêutico RT',
        notes: 'Leitura matutina normal',
      },
    });

    expect(rRes.statusCode).toBe(201);
    const data = JSON.parse(rRes.body);
    expect(data.isExcursion).toBe(false);
    expect(data.temperature).toBe(4.8);
  });

  it('4. POST /api/temperature/readings deve acusar excursão térmica crítica e criar incidente', async () => {
    const sRes = await app.inject({
      method: 'POST',
      url: '/api/temperature/sensors',
      payload: {
        storeId,
        name: 'Geladeira Vacinas',
        locationType: 'REFRIGERATOR_COLD_CHAIN',
      },
    });
    const sensor = JSON.parse(sRes.body);

    const rRes = await app.inject({
      method: 'POST',
      url: '/api/temperature/readings',
      payload: {
        sensorId: sensor.id,
        storeId,
        temperature: 9.8,
        maxTempRecorded: 10.5,
        minTempRecorded: 4.0,
        recordedBy: 'Operador de Monitoramento',
        notes: 'Queda temporária de energia',
      },
    });

    expect(rRes.statusCode).toBe(201);
    const data = JSON.parse(rRes.body);
    expect(data.isExcursion).toBe(true);
    expect(data.excursionId).toBeDefined();

    // Consultar incidentes
    const excRes = await app.inject({
      method: 'GET',
      url: `/api/temperature/excursions?storeId=${storeId}&status=OPEN`,
    });
    expect(excRes.statusCode).toBe(200);
    const excursions = JSON.parse(excRes.body);
    expect(excursions.length).toBe(1);
    expect(excursions[0].severity).toBe('CRITICAL');
  });

  it('5. POST /api/temperature/excursions/:id/resolve deve resolver excursão com laudo e CRF', async () => {
    // 1. Criar sensor e leitura com excursão
    const sRes = await app.inject({
      method: 'POST',
      url: '/api/temperature/sensors',
      payload: {
        storeId,
        name: 'Geladeira 03',
        locationType: 'REFRIGERATOR_COLD_CHAIN',
      },
    });
    const sensor = JSON.parse(sRes.body);

    const rRes = await app.inject({
      method: 'POST',
      url: '/api/temperature/readings',
      payload: {
        sensorId: sensor.id,
        storeId,
        temperature: 11.0,
        recordedBy: 'Técnico',
      },
    });
    const reading = JSON.parse(rRes.body);

    // 2. Tentar resolver sem CRF deve falhar 400
    const failRes = await app.inject({
      method: 'POST',
      url: `/api/temperature/excursions/${reading.excursionId}/resolve`,
      payload: {
        actionTaken: 'Normalizado',
      },
    });
    expect(failRes.statusCode).toBe(400);

    // 3. Resolver com laudo e CRF
    const okRes = await app.inject({
      method: 'POST',
      url: `/api/temperature/excursions/${reading.excursionId}/resolve`,
      payload: {
        actionTaken: 'Termostato recalibrado e estoque de vacinas mantido íntegro conforme análise de tempo-temperatura.',
        pharmacistCrf: 'CRF-SP 45678',
      },
    });
    expect(okRes.statusCode).toBe(200);
    const resolved = JSON.parse(okRes.body);
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.pharmacist_crf).toBe('CRF-SP 45678');
  });

  it('6. GET /api/temperature/kpis deve retornar KPIs agregados da loja', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/temperature/kpis?storeId=${storeId}`,
    });

    expect(res.statusCode).toBe(200);
    const kpis = JSON.parse(res.body);
    expect(kpis.active_sensors_count).toBeDefined();
    expect(kpis.cold_chain_status).toBeDefined();
  });

  it('7. POST /api/temperature/seed-sectors deve semear os 5 setores físicos padrão', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/temperature/seed-sectors',
      payload: { storeId },
    });

    expect(res.statusCode).toBe(200);
    const sectors = JSON.parse(res.body);
    expect(sectors.length).toBe(5);
    expect(sectors.some((s: any) => s.sector_code === 'HALL_MEDICAMENTOS')).toBe(true);
    expect(sectors.some((s: any) => s.sector_code === 'ESTOQUE_CENTRAL')).toBe(true);
  });

  it('8. POST /api/temperature/rounds deve registrar ronda multissetorial em lote', async () => {
    // 1. Semear setores
    const sRes = await app.inject({
      method: 'POST',
      url: '/api/temperature/seed-sectors',
      payload: { storeId },
    });
    const sectors = JSON.parse(sRes.body);
    const sHall = sectors.find((s: any) => s.sector_code === 'HALL_MEDICAMENTOS');
    const sGel = sectors.find((s: any) => s.sector_code === 'GELADEIRA_TERMOLABEIS');

    // 2. Registrar ronda
    const rRes = await app.inject({
      method: 'POST',
      url: '/api/temperature/rounds',
      payload: {
        storeId,
        shift: 'MORNING',
        conductedBy: 'Farmacêutico RT',
        notes: 'Aferição matutina diária de rotina',
        readings: [
          { sensorId: sHall.id, temperature: 22.0, humidity: 55.0 },
          { sensorId: sGel.id, temperature: 4.5 },
        ],
      },
    });

    expect(rRes.statusCode).toBe(201);
    const data = JSON.parse(rRes.body);
    expect(data.round.id).toBeDefined();
    expect(data.round.readings_count).toBe(2);
    expect(data.round.status).toBe('COMPLETED');

    // 3. Consultar histórico de rondas
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/temperature/rounds?storeId=${storeId}`,
    });
    expect(listRes.statusCode).toBe(200);
    const rounds = JSON.parse(listRes.body);
    expect(rounds.length).toBeGreaterThanOrEqual(1);
    expect(rounds[0].conducted_by).toBe('Farmacêutico RT');
  });
});
