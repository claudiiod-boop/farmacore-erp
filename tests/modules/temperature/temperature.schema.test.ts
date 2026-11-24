import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';

describe('Termômetro & Higrômetro Digital Schema (Migration 033)', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required temperature and humidity monitoring tables cleanly', () => {
    const tables = ['temperature_sensors', 'temperature_readings', 'temperature_excursions'];

    for (const table of tables) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name: string } | undefined;
      expect(row, `Tabela ${table} deve existir`).toBeDefined();
    }
  });

  it('should insert sensor, readings and excursions with foreign keys and constraints', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };

    // Inserir sensor de geladeira de termolábeis (+2°C a +8°C)
    const sensorRes = db.prepare(`
      INSERT INTO temperature_sensors (
        store_id, name, location_type, min_allowed_temp, max_allowed_temp, min_allowed_humidity, max_allowed_humidity,
        serial_number, calibration_cert_number, calibration_due_date, is_active
      ) VALUES (?, 'Geladeira de Termolábeis 01', 'REFRIGERATOR_COLD_CHAIN', 2.0, 8.0, 0.0, 100.0, 'SN-THERMO-01', 'CAL-RBC-2026/88', '2027-11-20', 1)
    `).run(store.id);
    const sensorId = Number(sensorRes.lastInsertRowid);
    expect(sensorId).toBeGreaterThan(0);

    // Inserir leitura com excursão (9.5°C > 8.0°C)
    const readingRes = db.prepare(`
      INSERT INTO temperature_readings (
        sensor_id, store_id, temperature, humidity, max_temp_recorded, min_temp_recorded, is_excursion, recorded_by, notes
      ) VALUES (?, ?, 9.5, 55.0, 10.2, 4.1, 1, 'Dra. Luiza - RT', 'Alerta sonoro de porta aberta')
    `).run(sensorId, store.id);
    const readingId = Number(readingRes.lastInsertRowid);
    expect(readingId).toBeGreaterThan(0);

    // Inserir registro de excursão térmica
    const excRes = db.prepare(`
      INSERT INTO temperature_excursions (
        sensor_id, store_id, reading_id, severity, peak_temp, min_temp, status
      ) VALUES (?, ?, ?, 'CRITICAL', 10.2, 4.1, 'OPEN')
    `).run(sensorId, store.id, readingId);
    const excursionId = Number(excRes.lastInsertRowid);
    expect(excursionId).toBeGreaterThan(0);

    // Consulta integrada
    const checkRow = db.prepare(`
      SELECT te.*, ts.name AS sensor_name, tr.temperature
      FROM temperature_excursions te
      JOIN temperature_sensors ts ON ts.id = te.sensor_id
      JOIN temperature_readings tr ON tr.id = te.reading_id
      WHERE te.id = ?
    `).get(excursionId) as any;

    expect(checkRow.sensor_name).toBe('Geladeira de Termolábeis 01');
    expect(checkRow.temperature).toBe(9.5);
    expect(checkRow.severity).toBe('CRITICAL');
    expect(checkRow.status).toBe('OPEN');
  });

  it('Migration 034: deve suportar setores físicos expandidos e tabela temperature_rounds', () => {
    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };

    // Inserir sensor com sector_code e floor_location
    const sensorRes = db.prepare(`
      INSERT INTO temperature_sensors (
        store_id, name, location_type, sector_code, floor_location, min_allowed_temp, max_allowed_temp, min_allowed_humidity, max_allowed_humidity
      ) VALUES (?, 'Termo-Higrômetro Hall Central', 'SALES_FLOOR', 'HALL_MEDICAMENTOS', 'TÉRREO BALCÃO', 15.0, 30.0, 40.0, 70.0)
    `).run(store.id);
    const sensorId = Number(sensorRes.lastInsertRowid);
    expect(sensorId).toBeGreaterThan(0);

    // Inserir ronda diária de temperatura
    const roundRes = db.prepare(`
      INSERT INTO temperature_rounds (
        store_id, shift, conducted_by, readings_count, excursions_count, status
      ) VALUES (?, 'MORNING', 'Farmacêutico RT', 1, 0, 'COMPLETED')
    `).run(store.id);
    const roundId = Number(roundRes.lastInsertRowid);
    expect(roundId).toBeGreaterThan(0);

    // Inserir leitura vinculada à ronda
    const readingRes = db.prepare(`
      INSERT INTO temperature_readings (
        sensor_id, store_id, round_id, temperature, humidity, is_excursion, recorded_by
      ) VALUES (?, ?, ?, 22.5, 55.0, 0, 'Farmacêutico RT')
    `).run(sensorId, store.id, roundId);
    expect(Number(readingRes.lastInsertRowid)).toBeGreaterThan(0);

    const fetchedReading = db.prepare('SELECT * FROM temperature_readings WHERE id = ?').get(readingRes.lastInsertRowid) as any;
    expect(fetchedReading.round_id).toBe(roundId);
  });
});
