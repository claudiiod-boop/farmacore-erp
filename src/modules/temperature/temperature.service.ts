import { Database } from '../../database/connection';
import type {
  TemperatureSensor,
  TemperatureReading,
  TemperatureExcursion,
  RegisterSensorInput,
  RecordReadingInput,
  ResolveExcursionInput,
  TemperatureKpis,
  TemperatureRound,
  RecordSectorRoundInput,
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
    const sectorCode = input.sectorCode || (input.locationType === 'REFRIGERATOR_COLD_CHAIN' ? 'GELADEIRA_TERMOLABEIS' : input.locationType === 'STORAGE_ROOM' ? 'ESTOQUE_CENTRAL' : 'HALL_MEDICAMENTOS');
    const floorLocation = input.floorLocation || 'TÉRREO';

    const stmt = this.db.prepare(`
      INSERT INTO temperature_sensors (
        store_id, name, location_type, sector_code, floor_location, min_allowed_temp, max_allowed_temp,
        min_allowed_humidity, max_allowed_humidity, serial_number,
        calibration_cert_number, calibration_due_date, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const result = stmt.run(
      input.storeId,
      input.name,
      input.locationType,
      sectorCode,
      floorLocation,
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
          sensor_id, store_id, round_id, temperature, humidity, max_temp_recorded, min_temp_recorded,
          is_excursion, recorded_by, notes, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, coalesce(?, CURRENT_TIMESTAMP))
      `);

      const res = readingStmt.run(
        input.sensorId,
        storeId,
        input.roundId || null,
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

  /**
   * Inicializa automaticamente os 5 setores físicos regulamentares caso a loja ainda não possua sensores cadastrados
   */
  seedDefaultStoreSectors(storeId: number): TemperatureSensor[] {
    const existing = this.listSensors(storeId, false);
    if (existing.length > 0) {
      return existing;
    }

    const defaultSectors = [
      {
        name: 'Hall de Medicamentos (Dispensário & Balcão)',
        locationType: 'SALES_FLOOR' as const,
        sectorCode: 'HALL_MEDICAMENTOS',
        floorLocation: 'TÉRREO BALCÃO',
        minAllowedTemp: 15.0,
        maxAllowedTemp: 30.0,
        minAllowedHumidity: 40.0,
        maxAllowedHumidity: 70.0,
        serialNumber: 'SEN-HALL-01',
      },
      {
        name: 'Estoque Central & Almoxarifado',
        locationType: 'STORAGE_ROOM' as const,
        sectorCode: 'ESTOQUE_CENTRAL',
        floorLocation: 'TÉRREO FUNDOS',
        minAllowedTemp: 15.0,
        maxAllowedTemp: 30.0,
        minAllowedHumidity: 40.0,
        maxAllowedHumidity: 70.0,
        serialNumber: 'SEN-EST-01',
      },
      {
        name: 'Geladeira Principal de Termolábeis',
        locationType: 'REFRIGERATOR_COLD_CHAIN' as const,
        sectorCode: 'GELADEIRA_TERMOLABEIS',
        floorLocation: 'ÁREA TÉCNICA',
        minAllowedTemp: 2.0,
        maxAllowedTemp: 8.0,
        minAllowedHumidity: 0.0,
        maxAllowedHumidity: 100.0,
        serialNumber: 'SEN-GEL-01',
        calibrationCertNumber: 'RBC-2026/01',
      },
      {
        name: 'Consultório & Sala de Injetáveis',
        locationType: 'SALES_FLOOR' as const,
        sectorCode: 'SALA_INJETAVEIS',
        floorLocation: 'CONSULTÓRIO 01',
        minAllowedTemp: 15.0,
        maxAllowedTemp: 30.0,
        minAllowedHumidity: 40.0,
        maxAllowedHumidity: 70.0,
        serialNumber: 'SEN-CLIN-01',
      },
      {
        name: 'Doca de Recebimento & Triagem',
        locationType: 'STORAGE_ROOM' as const,
        sectorCode: 'QUARENTENA_RECEBIMENTO',
        floorLocation: 'DOCA DE ENTRADA',
        minAllowedTemp: 15.0,
        maxAllowedTemp: 30.0,
        minAllowedHumidity: 40.0,
        maxAllowedHumidity: 70.0,
        serialNumber: 'SEN-DOCA-01',
      },
    ];

    for (const sec of defaultSectors) {
      this.registerSensor({
        storeId,
        ...sec,
      });
    }

    return this.listSensors(storeId, false);
  }

  /**
   * Executa a Ronda Térmica Multissetorial em lote (Manhã / Tarde / Noite)
   */
  recordSectorRound(input: RecordSectorRoundInput): {
    round: TemperatureRound;
    results: Array<{ sensorId: number; readingId: number; isExcursion: boolean; excursionId?: number }>;
  } {
    if (!input.readings || input.readings.length === 0) {
      throw new Error('A ronda deve conter ao menos 1 leitura de setor.');
    }

    let roundId = 0;
    let excursionsCount = 0;
    const results: Array<{ sensorId: number; readingId: number; isExcursion: boolean; excursionId?: number }> = [];

    this.db.transaction(() => {
      // 1. Criar cabeçalho da ronda
      const roundStmt = this.db.prepare(`
        INSERT INTO temperature_rounds (
          store_id, shift, conducted_by, readings_count, excursions_count, status, notes
        ) VALUES (?, ?, ?, ?, 0, 'COMPLETED', ?)
      `);
      const roundRes = roundStmt.run(
        input.storeId,
        input.shift,
        input.conductedBy,
        input.readings.length,
        input.notes || null
      );
      roundId = Number(roundRes.lastInsertRowid);

      // 2. Gravar leitura de cada setor
      for (const item of input.readings) {
        const readRes = this.recordReading({
          sensorId: item.sensorId,
          storeId: input.storeId,
          roundId,
          temperature: item.temperature,
          humidity: item.humidity,
          recordedBy: input.conductedBy,
          notes: item.notes,
        });

        if (readRes.isExcursion) {
          excursionsCount++;
        }

        results.push({
          sensorId: item.sensorId,
          readingId: readRes.readingId,
          isExcursion: readRes.isExcursion,
          excursionId: readRes.excursionId,
        });
      }

      // 3. Atualizar status e contagem de excursões na ronda
      const status = excursionsCount > 0 ? 'EXCURSION_DETECTED' : 'COMPLETED';
      this.db
        .prepare(`
          UPDATE temperature_rounds
          SET excursions_count = ?, status = ?
          WHERE id = ?
        `)
        .run(excursionsCount, status, roundId);
    })();

    const round = this.getRoundById(roundId);
    return { round, results };
  }

  /**
   * Obtém detalhes de uma ronda por ID
   */
  getRoundById(roundId: number): TemperatureRound {
    const row = this.db.prepare('SELECT * FROM temperature_rounds WHERE id = ?').get(roundId) as any;
    if (!row) {
      throw new Error(`Ronda #${roundId} não encontrada.`);
    }

    const readings = this.db
      .prepare(`
        SELECT tr.*, ts.name AS sensor_name, ts.location_type, ts.sector_code
        FROM temperature_readings tr
        JOIN temperature_sensors ts ON ts.id = tr.sensor_id
        WHERE tr.round_id = ?
        ORDER BY tr.id ASC
      `)
      .all(roundId) as any[];

    return {
      ...row,
      readings: readings.map((r) => ({
        ...r,
        is_excursion: Boolean(r.is_excursion),
      })),
    };
  }

  /**
   * Lista histórico de rondas sanitárias da loja
   */
  listRounds(storeId: number, limit: number = 30): TemperatureRound[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM temperature_rounds
        WHERE store_id = ?
        ORDER BY id DESC
        LIMIT ?
      `)
      .all(storeId, limit) as any[];

    return rows.map((r) => {
      const readings = this.db
        .prepare(`
          SELECT tr.*, ts.name AS sensor_name, ts.location_type, ts.sector_code
          FROM temperature_readings tr
          JOIN temperature_sensors ts ON ts.id = tr.sensor_id
          WHERE tr.round_id = ?
          ORDER BY tr.id ASC
        `)
        .all(r.id) as any[];

      return {
        ...r,
        readings: readings.map((item) => ({
          ...item,
          is_excursion: Boolean(item.is_excursion),
        })),
      };
    });
  }
}
