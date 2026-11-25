export type SatDeviceStatus = 'ACTIVE' | 'BLOCKED' | 'MAINTENANCE' | 'UNLINKED';

export type CfeStatus = 'AUTHORIZED' | 'CANCELLED' | 'SYNC_PENDING';

export type ContingencyStatus = 'PENDING' | 'TRANSMITTED' | 'ERROR';

export interface SatDevice {
  id: number;
  store_id: number;
  pos_station_id: string;
  serial_number: string;
  model: string;
  sign_code: string;
  status: SatDeviceStatus;
  last_status_check?: string | null;
  firmware_version?: string | null;
  memory_percent_used: number;
  created_at: string;
  updated_at: string;
}

export interface CfeSatDocument {
  id: number;
  sale_id: number;
  store_id: number;
  sat_device_id: number;
  access_key: string;
  cfe_number: number;
  session_random_number: number;
  total_amount: number;
  discount_amount: number;
  net_amount: number;
  xml_sent: string;
  xml_signed: string;
  qr_code_payload: string;
  sefaz_status_code: string;
  sefaz_status_message: string;
  status: CfeStatus;
  issued_at: string;
  cancelled_at?: string | null;
  cancel_xml?: string | null;
  created_at: string;
}

export interface CfeContingencyQueueItem {
  id: number;
  cfe_id: number;
  sat_device_id: number;
  status: ContingencyStatus;
  retry_count: number;
  last_error?: string | null;
  last_attempt_at?: string | null;
  created_at: string;
  access_key?: string;
  total_amount?: number;
}

export interface RegisterSatDeviceInput {
  store_id: number;
  pos_station_id: string;
  serial_number: string;
  model?: string;
  sign_code: string;
  firmware_version?: string;
}

export interface IssueCfeInput {
  sale_id: number;
  sat_device_id: number;
  customer_cpf?: string;
  force_offline_contingency?: boolean; // Simulação de contingência offline
}

export interface SatStatusResponse {
  serial_number: string;
  status: 'OPERACIONAL' | 'BLOQUEADO' | 'SEM_REDE' | 'FALHA_COMUNICACAO';
  lan_ip: string;
  memory_used_percent: number;
  battery_level: string;
  sefaz_transmission_status: 'CONECTADO' | 'DESCONECTADO_CONTINGENCIA';
  firmware_version: string;
}

export interface SatFiscalKpis {
  total_cfe_issued: number;
  total_authorized_amount: number;
  total_cancelled_count: number;
  pending_contingency_count: number;
  active_devices_count: number;
}
