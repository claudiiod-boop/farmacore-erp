export type SensorLocationType =
  | 'REFRIGERATOR_COLD_CHAIN'
  | 'SALES_FLOOR'
  | 'STORAGE_ROOM';

export type SectorCode =
  | 'HALL_MEDICAMENTOS'
  | 'ESTOQUE_CENTRAL'
  | 'GELADEIRA_TERMOLABEIS'
  | 'SALA_INJETAVEIS'
  | 'QUARENTENA_RECEBIMENTO'
  | string;

export type RoundShift = 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'SPECIAL';

export type ExcursionSeverity = 'CRITICAL' | 'MILD';
export type ExcursionStatus = 'OPEN' | 'RESOLVED';

export interface TemperatureSensor {
  id: number;
  store_id: number;
  name: string;
  location_type: SensorLocationType;
  sector_code?: SectorCode | null;
  floor_location?: string | null;
  min_allowed_temp: number;
  max_allowed_temp: number;
  min_allowed_humidity: number;
  max_allowed_humidity: number;
  serial_number?: string | null;
  calibration_cert_number?: string | null;
  calibration_due_date?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_reading?: TemperatureReading | null;
}

export interface TemperatureReading {
  id: number;
  sensor_id: number;
  store_id: number;
  round_id?: number | null;
  sensor_name?: string;
  location_type?: SensorLocationType;
  sector_code?: SectorCode | null;
  temperature: number;
  humidity?: number | null;
  max_temp_recorded?: number | null;
  min_temp_recorded?: number | null;
  is_excursion: boolean;
  recorded_by: string;
  notes?: string | null;
  recorded_at: string;
  created_at: string;
}

export interface TemperatureRound {
  id: number;
  store_id: number;
  shift: RoundShift;
  conducted_by: string;
  readings_count: number;
  excursions_count: number;
  status: 'COMPLETED' | 'EXCURSION_DETECTED';
  notes?: string | null;
  recorded_at: string;
  created_at: string;
  readings?: TemperatureReading[];
}

export interface SectorReadingItem {
  sensorId: number;
  temperature: number;
  humidity?: number;
  notes?: string;
}

export interface RecordSectorRoundInput {
  storeId: number;
  shift: RoundShift;
  conductedBy: string;
  notes?: string;
  readings: SectorReadingItem[];
}

export interface TemperatureExcursion {
  id: number;
  sensor_id: number;
  store_id: number;
  reading_id: number;
  sensor_name?: string;
  location_type?: SensorLocationType;
  started_at: string;
  resolved_at?: string | null;
  severity: ExcursionSeverity;
  peak_temp: number;
  min_temp: number;
  action_taken?: string | null;
  pharmacist_crf?: string | null;
  quarantine_record_id?: number | null;
  status: ExcursionStatus;
  created_at: string;
  updated_at: string;
}

export interface RegisterSensorInput {
  storeId: number;
  name: string;
  locationType: SensorLocationType;
  sectorCode?: SectorCode;
  floorLocation?: string;
  minAllowedTemp?: number;
  maxAllowedTemp?: number;
  minAllowedHumidity?: number;
  maxAllowedHumidity?: number;
  serialNumber?: string;
  calibrationCertNumber?: string;
  calibrationDueDate?: string;
}

export interface RecordReadingInput {
  sensorId: number;
  storeId?: number;
  roundId?: number;
  temperature: number;
  humidity?: number;
  maxTempRecorded?: number;
  minTempRecorded?: number;
  recordedBy: string;
  notes?: string;
  recordedAt?: string;
  autoQuarantineTermolabile?: boolean;
}

export interface ResolveExcursionInput {
  resolvedBy?: string;
  actionTaken: string;
  pharmacistCrf: string;
  quarantineRecordId?: number;
}

export interface TemperatureKpis {
  active_sensors_count: number;
  open_excursions_count: number;
  current_fridge_temp: number | null;
  current_sales_floor_temp: number | null;
  current_sales_floor_humidity: number | null;
  cold_chain_status: 'NORMAL' | 'EXCURSION' | 'NO_DATA';
  ambient_status: 'NORMAL' | 'EXCURSION' | 'NO_DATA';
}
