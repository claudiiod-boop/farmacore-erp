import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { TemperatureMonitoringService } from '../../../src/modules/temperature/temperature.service';

describe('TemperatureMonitoringService (Monitoramento Térmico, Cadeia de Frio & Excursões RDC 44/430)', () => {
  let db: Database;
  let service: TemperatureMonitoringService;
  let storeId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new TemperatureMonitoringService(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;
  });

  afterEach(() => {
    db.close();
  });

  it('registerSensor cadastra geladeira de termolábeis com faixa regulatória padrão (+2°C a +8°C)', () => {
    const sensor = service.registerSensor({
      storeId,
      name: 'Geladeira 01 - Vacinas e Insulinas',
      locationType: 'REFRIGERATOR_COLD_CHAIN',
      serialNumber: 'SEN-GEL-001',
      calibrationCertNumber: 'RBC-2026-9988',
      calibrationDueDate: '2027-11-30',
    });

    expect(sensor.id).toBeDefined();
    expect(sensor.name).toBe('Geladeira 01 - Vacinas e Insulinas');
    expect(sensor.location_type).toBe('REFRIGERATOR_COLD_CHAIN');
    expect(sensor.min_allowed_temp).toBe(2.0);
    expect(sensor.max_allowed_temp).toBe(8.0);
    expect(sensor.is_active).toBe(true);

    const fetched = service.getSensorById(sensor.id);
    expect(fetched.name).toBe(sensor.name);
  });

  it('registerSensor cadastra termômetro de salão de vendas com limites padrão (+15°C a +30°C / 40-70% UR)', () => {
    const sensor = service.registerSensor({
      storeId,
      name: 'Termo-Higrômetro Balcão Central',
      locationType: 'SALES_FLOOR',
    });

    expect(sensor.min_allowed_temp).toBe(15.0);
    expect(sensor.max_allowed_temp).toBe(30.0);
    expect(sensor.min_allowed_humidity).toBe(40.0);
    expect(sensor.max_allowed_humidity).toBe(70.0);
  });

  it('recordReading registra leitura conforme dentro da faixa sem abrir excursão', () => {
    const sensor = service.registerSensor({
      storeId,
      name: 'Geladeira 02',
      locationType: 'REFRIGERATOR_COLD_CHAIN',
    });

    const reading = service.recordReading({
      sensorId: sensor.id,
      storeId,
      temperature: 4.5,
      recordedBy: 'Farmacêutico Responsável',
    });

    expect(reading.isExcursion).toBe(false);
    expect(reading.excursionId).toBeUndefined();
    expect(reading.temperature).toBe(4.5);

    const readings = service.listReadings(sensor.id);
    expect(readings.length).toBe(1);
    expect(readings[0].temperature).toBe(4.5);
    expect(readings[0].is_excursion).toBe(false);
  });

  it('recordReading detecta excursão térmica crítica na geladeira (+9.5°C) e abre incidente automaticamente', () => {
    const sensor = service.registerSensor({
      storeId,
      name: 'Geladeira 01',
      locationType: 'REFRIGERATOR_COLD_CHAIN',
    });

    const reading = service.recordReading({
      sensorId: sensor.id,
      storeId,
      temperature: 9.5,
      maxTempRecorded: 10.2,
      minTempRecorded: 4.0,
      recordedBy: 'Operador Balcão',
      notes: 'Pico de temperatura após manutenção elétrica',
    });

    expect(reading.isExcursion).toBe(true);
    expect(reading.excursionId).toBeDefined();

    const excursion = service.getExcursionById(reading.excursionId!);
    expect(excursion.status).toBe('OPEN');
    expect(excursion.severity).toBe('CRITICAL');
    expect(excursion.peak_temp).toBe(10.2);
    expect(excursion.sensor_id).toBe(sensor.id);

    const openExcursions = service.listExcursions(storeId, 'OPEN');
    expect(openExcursions.length).toBe(1);
  });

  it('recordReading detecta excursão por umidade elevada no salão (>70% UR)', () => {
    const sensor = service.registerSensor({
      storeId,
      name: 'Salão Principal',
      locationType: 'SALES_FLOOR',
    });

    const reading = service.recordReading({
      sensorId: sensor.id,
      storeId,
      temperature: 24.0,
      humidity: 78.5,
      recordedBy: 'Atendente',
    });

    expect(reading.isExcursion).toBe(true);
    expect(reading.excursionId).toBeDefined();

    const exc = service.getExcursionById(reading.excursionId!);
    expect(exc.severity).toBe('MILD');
  });

  it('resolveExcursion resolve incidente com laudo sanitário e CRF obrigatório do farmacêutico', () => {
    const sensor = service.registerSensor({
      storeId,
      name: 'Geladeira 01',
      locationType: 'REFRIGERATOR_COLD_CHAIN',
    });

    const reading = service.recordReading({
      sensorId: sensor.id,
      storeId,
      temperature: 9.0,
      recordedBy: 'Técnico',
    });

    const excursionId = reading.excursionId!;

    // Tentativa de resolução sem CRF do farmacêutico deve falhar
    expect(() => {
      service.resolveExcursion(excursionId, {
        actionTaken: 'Compressor religado e temperatura normalizada',
        pharmacistCrf: '',
      });
    }).toThrow(/exige o CRF do Farmacêutico/i);

    // Resolução com sucesso
    const resolved = service.resolveExcursion(excursionId, {
      actionTaken: 'Porta da geladeira estava mal fechada. Termolábeis inspecionados sem alteração de aspecto. Normalizado para 4°C.',
      pharmacistCrf: 'CRF-SP 98765',
    });

    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.action_taken).toContain('Porta da geladeira');
    expect(resolved.pharmacist_crf).toBe('CRF-SP 98765');
    expect(resolved.resolved_at).not.toBeNull();
  });

  it('getKpis calcula métricas consolidadas da cadeia de frio e conformidade de leituras', () => {
    const sensorGeladeira = service.registerSensor({
      storeId,
      name: 'Geladeira Teste',
      locationType: 'REFRIGERATOR_COLD_CHAIN',
    });
    const sensorSalao = service.registerSensor({
      storeId,
      name: 'Salão Teste',
      locationType: 'SALES_FLOOR',
    });

    // 2 leituras na geladeira: 1 normal e 1 excursão
    service.recordReading({ sensorId: sensorGeladeira.id, storeId, temperature: 5.0, recordedBy: 'RT' });
    service.recordReading({ sensorId: sensorGeladeira.id, storeId, temperature: 9.8, recordedBy: 'RT' });

    // 1 leitura no salão normal
    service.recordReading({ sensorId: sensorSalao.id, storeId, temperature: 22.0, humidity: 55.0, recordedBy: 'RT' });

    const kpis = service.getKpis(storeId);
    expect(kpis.active_sensors_count).toBe(2);
    expect(kpis.open_excursions_count).toBe(1);
    expect(kpis.current_fridge_temp).toBe(9.8);
    expect(kpis.current_sales_floor_temp).toBe(22.0);
    expect(kpis.current_sales_floor_humidity).toBe(55.0);
    expect(kpis.cold_chain_status).toBe('EXCURSION');
    expect(kpis.ambient_status).toBe('NORMAL');
  });

  it('seedDefaultStoreSectors cria os 5 setores regulamentares para a loja (Hall, Estoque, Geladeira, Injetáveis, Triagem)', () => {
    const sensors = service.seedDefaultStoreSectors(storeId);
    expect(sensors.length).toBe(5);

    const hall = sensors.find((s) => s.sector_code === 'HALL_MEDICAMENTOS');
    const estoque = sensors.find((s) => s.sector_code === 'ESTOQUE_CENTRAL');
    const geladeira = sensors.find((s) => s.sector_code === 'GELADEIRA_TERMOLABEIS');
    const injetaveis = sensors.find((s) => s.sector_code === 'SALA_INJETAVEIS');
    const doca = sensors.find((s) => s.sector_code === 'QUARENTENA_RECEBIMENTO');

    expect(hall).toBeDefined();
    expect(estoque).toBeDefined();
    expect(geladeira).toBeDefined();
    expect(injetaveis).toBeDefined();
    expect(doca).toBeDefined();

    expect(geladeira?.min_allowed_temp).toBe(2.0);
    expect(geladeira?.max_allowed_temp).toBe(8.0);
    expect(hall?.min_allowed_temp).toBe(15.0);
    expect(hall?.max_allowed_temp).toBe(30.0);
  });

  it('recordSectorRound grava a ronda sanitária diária em lote para múltiplos setores de uma só vez', () => {
    const sensors = service.seedDefaultStoreSectors(storeId);
    const sHall = sensors.find((s) => s.sector_code === 'HALL_MEDICAMENTOS')!;
    const sEstoque = sensors.find((s) => s.sector_code === 'ESTOQUE_CENTRAL')!;
    const sGel = sensors.find((s) => s.sector_code === 'GELADEIRA_TERMOLABEIS')!;

    const roundRes = service.recordSectorRound({
      storeId,
      shift: 'MORNING',
      conductedBy: 'Dra. Vanessa - Farmacêutica RT',
      notes: 'Ronda matutina normal',
      readings: [
        { sensorId: sHall.id, temperature: 21.5, humidity: 52.0 },
        { sensorId: sEstoque.id, temperature: 22.0, humidity: 50.0 },
        { sensorId: sGel.id, temperature: 4.8 },
      ],
    });

    expect(roundRes.round.id).toBeDefined();
    expect(roundRes.round.shift).toBe('MORNING');
    expect(roundRes.round.readings_count).toBe(3);
    expect(roundRes.round.excursions_count).toBe(0);
    expect(roundRes.round.status).toBe('COMPLETED');
    expect(roundRes.round.readings?.length).toBe(3);

    const rounds = service.listRounds(storeId);
    expect(rounds.length).toBe(1);
    expect(rounds[0].conducted_by).toBe('Dra. Vanessa - Farmacêutica RT');
  });

  it('recordSectorRound detecta excursão na geladeira e marca status da ronda como EXCURSION_DETECTED', () => {
    const sensors = service.seedDefaultStoreSectors(storeId);
    const sHall = sensors.find((s) => s.sector_code === 'HALL_MEDICAMENTOS')!;
    const sGel = sensors.find((s) => s.sector_code === 'GELADEIRA_TERMOLABEIS')!;

    const roundRes = service.recordSectorRound({
      storeId,
      shift: 'AFTERNOON',
      conductedBy: 'Farmacêutico RT',
      readings: [
        { sensorId: sHall.id, temperature: 24.0, humidity: 55.0 },
        { sensorId: sGel.id, temperature: 10.5 }, // Excursão (> 8°C)
      ],
    });

    expect(roundRes.round.status).toBe('EXCURSION_DETECTED');
    expect(roundRes.round.excursions_count).toBe(1);

    const openExcursions = service.listExcursions(storeId, 'OPEN');
    expect(openExcursions.length).toBe(1);
    expect(openExcursions[0].peak_temp).toBe(10.5);
  });
});
