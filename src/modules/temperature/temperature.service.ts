import { Database } from '../../database/connection';
import type {
  TemperatureSensor,
  TemperatureReading,
  TemperatureExcursion,
  RegisterSensorInput,
  RecordReadingInput,
  ResolveExcursionInput,
  TemperatureKpis,
} from './temperature.types';

export class TemperatureMonitoringService {
  constructor(private db: Database) {}

  /**
   * Cadastra ou configura um sensor / termômetro calibrado (RBC / Inmetro)
   */
  registerSensor(input: RegisterSensorInput): TemperatureSensor {
    // Padrões regulatórios ANVISA (RDC 44/2009 e RDC 430/2020)
    let defaultMinTemp = 15.0;
    let defaultMaxTemp = 30.0;
    let defaultMinHumid = 40.0;
    let defaultMaxHumid = 70.0;

    if (input.locationType === 'REFRIGERATOR_COLD_CHAIN') {
      defaultMinTemp = 2.0;
      defaultMaxTemp = 8.0;
      defaultMinHumid = 0.0;
      defaultMaxHumid = 100.0;
    }

    const minTemp = input.minAllowedTemp !== undefined ? input.minAllowedTemp : defaultMinTemp;
    const maxTemp = input.maxAllowedTemp !== undefined ? input.maxAllowedTemp : defaultMaxTemp;
    const minHumid = input.minAllowedHumidity !== undefined ? input.minAllowedHumidity : defaultMinHumid;
    const maxHumid = input.maxAllowedHumidity !== undefined ? input.maxAllowedHumidity : defaultMaxHumid;

    const stmt = this.db.prepare(`
      INSERT INTO temperature_sensors (
        store_id, name, location_type, min_allowed_temp, max_allowed_temp,
        min_allowed_humidity, max_allowed_humidity, serial_number,
        calibration_cert_number, calibration_due_date, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const result = stmt.run(
      input.storeId,
      input.name,
      input.locationType,
      minTemp,
      maxTemp,
      minHumid,
      maxHumid,
      input.serialNumber || null,
      input.calibrationCertNumber || null,
      input.calibrationDueDate || null
    );

    const sensorId = Number(result.lastInsertRowid);
    return this.getSensorById(sensorId);
  }

  /**
   * Registra uma leitura de temperatura e umidade:
   * Valida automaticamente se houve excursão térmica e abre incidente sanitário.
   */
  recordReading(input: RecordReadingInput): {
    readingId: number;
    isExcursion: boolean;
    excursionId?: number;
    temperature: number;
    humidity: number | null;
  } {
    const sensor = this.getSensorById(input.sensorId);
    if (!sensor) {
      throw new Error(`Sensor #${input.sensorId} não encontrado.`);
    }

    const storeId = input.storeId || sensor.store_id;
    const tempExcursion =
      input.temperature < sensor.min_allowed_temp || input.temperature > sensor.max_allowed_temp;

    let humidExcursion = false;
    if (sensor.location_type !== 'REFRIGERATOR_COLD_CHAIN' && input.humidity !== undefined && input.humidity !== null) {
      humidExcursion =
        input.humidity < sensor.min_allowed_humidity || input.humidity > sensor.max_allowed_humidity;
    }

    const isExcursion = tempExcursion || humidExcursion;
    let readingId = 0;
    let excursionId: number | undefined;

    this.db.transaction(() => {
      // 1. Salvar leitura
      const readingStmt = this.db.prepare(`
        INSERT INTO temperature_readings (
          sensor_id, store_id, temperature, humidity, max_temp_recorded, min_temp_recorded,
          is_excursion, recorded_by, notes, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, coalesce(?, CURRENT_TIMESTAMP))
      `);

      const res = readingStmt.run(
        input.sensorId,
        storeId,
        input.temperature,
        input.humidity !== undefined ? input.humidity : null,
        input.maxTempRecorded !== undefined ? input.maxTempRecorded : input.temperature,
        input.minTempRecorded !== undefined ? input.minTempRecorded : input.temperature,
        isExcursion ? 1 : 0,
        input.recordedBy,
        input.notes || null,
        input.recordedAt || null
      );
      readingId = Number(res.lastInsertRowid);

      // 2. Se for excursão, abrir incidente
      if (isExcursion) {
        const severity = sensor.location_type === 'REFRIGERATOR_COLD_CHAIN' ? 'CRITICAL' : 'MILD';
        const peakTemp = Math.max(input.temperature, input.maxTempRecorded || input.temperature);
        const minTemp = Math.min(input.temperature, input.minTempRecorded || input.temperature);

        const excStmt = this.db.prepare(`
          INSERT INTO temperature_excursions (
            sensor_id, store_id, reading_id, started_at, severity, peak_temp, min_temp, status
          ) VALUES (?, ?, ?, coalesce(?, CURRENT_TIMESTAMP), ?, ?, ?, 'OPEN')
        `);

        const excRes = excStmt.run(
          input.sensorId,
          storeId,
          readingId,
          input.recordedAt || null,
          severity,
          peakTemp,
          minTemp
        );
        excursionId = Number(excRes.lastInsertRowid);
      }
    })();

    return {
      readingId,
      isExcursion,
      excursionId,
      temperature: input.temperature,
      humidity: input.humidity !== undefined ? input.humidity : null,
    };
  }

  /**
   * Resolve um incidente de excursão térmica com laudo e CRF do farmacêutico
   */
  resolveExcursion(excursionId: number, input: ResolveExcursionInput): TemperatureExcursion {
    const exc = this.getExcursionById(excursionId);
    if (!exc) {
      throw new Error(`Incidente de excursão #${excursionId} não encontrado.`);
    }

    if (exc.status !== 'OPEN') {
      throw new Error(`Incidente #${excursionId} já está com status ${exc.status}.`);
    }

    if (!input.pharmacistCrf) {
      throw new Error('A resolução de excursão térmica exige o CRF do Farmacêutico Responsável Técnico.');
    }

    this.db
      .prepare(`
        UPDATE temperature_excursions
        SET status = 'RESOLVED',
            resolved_at = CURRENT_TIMESTAMP,
            action_taken = ?,
            pharmacist_crf = ?,
            quarantine_record_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(
        input.actionTaken,
        input.pharmacistCrf,
        input.quarantineRecordId || null,
        excursionId
      );

    return this.getExcursionById(excursionId);
  }

  /**
   * Consulta sensores com última leitura
   */
  listSensors(storeId: number, activeOnly: boolean = true): TemperatureSensor[] {
    let sql = 'SELECT * FROM temperature_sensors WHERE store_id = ?';
    if (activeOnly) {
      sql += ' AND is_active = 1';
    }
    sql += ' ORDER BY id ASC';

    const sensors = this.db.prepare(sql).all(storeId) as any[];

    return sensors.map((s) => {
      const lastReading = this.db
        .prepare('SELECT * FROM temperature_readings WHERE sensor_id = ? ORDER BY id DESC LIMIT 1')
        .get(s.id) as any;

      return {
        ...s,
        is_active: Boolean(s.is_active),
        last_reading: lastReading
          ? {
              ...lastReading,
              is_excursion: Boolean(lastReading.is_excursion),
            }
          : null,
      };
    });
  }

  /**
   * Obtém detalhes de um sensor por ID
   */
  getSensorById(sensorId: number): TemperatureSensor {
    const row = this.db.prepare('SELECT * FROM temperature_sensors WHERE id = ?').get(sensorId) as any;
    if (!row) {
      throw new Error(`Sensor #${sensorId} não encontrado.`);
    }
    return {
      ...row,
      is_active: Boolean(row.is_active),
    };
  }

  /**
   * Histórico de medições para Mapa Térmico VISA
   */
  listReadings(
    sensorId: number,
    options?: { startDate?: string; endDate?: string; limit?: number }
  ): TemperatureReading[] {
    let sql = `
      SELECT tr.*, ts.name AS sensor_name, ts.location_type
      FROM temperature_readings tr
      JOIN temperature_sensors ts ON ts.id = tr.sensor_id
      WHERE tr.sensor_id = ?
    `;
    const params: any[] = [sensorId];

    if (options?.startDate) {
      sql += ' AND tr.recorded_at >= ?';
      params.push(options.startDate);
    }
    if (options?.endDate) {
      sql += ' AND tr.recorded_at <= ?';
      params.push(options.endDate);
    }

    sql += ' ORDER BY tr.id DESC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => ({
      ...r,
      is_excursion: Boolean(r.is_excursion),
    }));
  }

  /**
   * Consulta incidentes de excursão térmica
   */
  listExcursions(storeId: number, status?: string): TemperatureExcursion[] {
    let sql = `
      SELECT
        te.*,
        ts.name AS sensor_name,
        ts.location_type
      FROM temperature_excursions te
      JOIN temperature_sensors ts ON ts.id = te.sensor_id
      WHERE te.store_id = ?
    `;
    const params: any[] = [storeId];

    if (status) {
      sql += ' AND te.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY te.id DESC';

    return this.db.prepare(sql).all(...params) as TemperatureExcursion[];
  }

  /**
   * Obtém detalhes de um incidente de excursão
   */
  getExcursionById(excursionId: number): TemperatureExcursion {
    const row = this.db
      .prepare(`
        SELECT
          te.*,
          ts.name AS sensor_name,
          ts.location_type
        FROM temperature_excursions te
        JOIN temperature_sensors ts ON ts.id = te.sensor_id
        WHERE te.id = ?
      `)
      .get(excursionId) as any;

    if (!row) {
      throw new Error(`Incidente de excursão #${excursionId} não encontrado.`);
    }

    return row;
  }

  /**
   * KPIs consolidados de temperatura e higrometria da loja
   */
  getKpis(storeId: number): TemperatureKpis {
    const sensorsCount = this.db
      .prepare('SELECT COUNT(id) AS active_sensors FROM temperature_sensors WHERE store_id = ? AND is_active = 1')
      .get(storeId) as any;

    const excursionsCount = this.db
      .prepare("SELECT COUNT(id) AS open_excursions FROM temperature_excursions WHERE store_id = ? AND status = 'OPEN'")
      .get(storeId) as any;

    // Última leitura da geladeira
    const fridgeReading = this.db
      .prepare(`
        SELECT tr.temperature, tr.is_excursion
        FROM temperature_readings tr
        JOIN temperature_sensors ts ON ts.id = tr.sensor_id
        WHERE ts.store_id = ? AND ts.location_type = 'REFRIGERATOR_COLD_CHAIN'
        ORDER BY tr.id DESC LIMIT 1
      `)
      .get(storeId) as any;

    // Última leitura do salão de vendas
    const ambientReading = this.db
      .prepare(`
        SELECT tr.temperature, tr.humidity, tr.is_excursion
        FROM temperature_readings tr
        JOIN temperature_sensors ts ON ts.id = tr.sensor_id
        WHERE ts.store_id = ? AND ts.location_type = 'SALES_FLOOR'
        ORDER BY tr.id DESC LIMIT 1
      `)
      .get(storeId) as any;

    const coldChainStatus: 'NORMAL' | 'EXCURSION' | 'NO_DATA' = !fridgeReading
      ? 'NO_DATA'
      : fridgeReading.is_excursion
      ? 'EXCURSION'
      : 'NORMAL';

    const ambientStatus: 'NORMAL' | 'EXCURSION' | 'NO_DATA' = !ambientReading
      ? 'NO_DATA'
      : ambientReading.is_excursion
      ? 'EXCURSION'
      : 'NORMAL';

    return {
      active_sensors_count: Number(sensorsCount?.active_sensors || 0),
      open_excursions_count: Number(excursionsCount?.open_excursions || 0),
      current_fridge_temp: fridgeReading ? Number(fridgeReading.temperature) : null,
      current_sales_floor_temp: ambientReading ? Number(ambientReading.temperature) : null,
      current_sales_floor_humidity: ambientReading && ambientReading.humidity !== null ? Number(ambientReading.humidity) : null,
      cold_chain_status: coldChainStatus,
      ambient_status: ambientStatus,
    };
  }
}
