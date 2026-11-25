export type ScaleProtocol = 'TOLEDO_PR4' | 'FILIZOLA' | 'URANO' | 'BALMAK' | 'GENERICA_CONTINUA';

export type BarcodePayloadType = 'TOTAL_VALUE' | 'NET_WEIGHT';

export interface ScaleDevice {
  id: number;
  store_id: number;
  name: string;
  serial_port: string;
  baud_rate: number;
  protocol: ScaleProtocol;
  inmetro_seal_number: string;
  capacity_kg: number;
  precision_grams: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface WeightedBarcodeConfig {
  id: number;
  store_id: number;
  prefix: string;
  product_code_length: number;
  payload_type: BarcodePayloadType;
  decimal_places: number;
  created_at: string;
}

export interface ScaleWeighingLog {
  id: number;
  scale_device_id?: number | null;
  product_id: number;
  product_name?: string;
  batch_id?: number | null;
  batch_number?: string | null;
  gross_weight_grams: number;
  tare_grams: number;
  net_weight_grams: number;
  price_per_kg: number;
  total_price: number;
  generated_barcode: string;
  operator_name?: string | null;
  created_at: string;
}

export interface RegisterScaleDeviceInput {
  store_id: number;
  name: string;
  serial_port: string;
  baud_rate?: number;
  protocol?: ScaleProtocol;
  inmetro_seal_number: string;
  capacity_kg?: number;
  precision_grams?: number;
}

export interface ScaleReadingResult {
  device_id: number;
  device_name: string;
  protocol: ScaleProtocol;
  is_stable: boolean;
  gross_weight_grams: number;
  tare_grams: number;
  net_weight_grams: number;
  timestamp: string;
}

export interface DecodeWeightedBarcodeInput {
  barcode: string;
  store_id?: number;
}

export interface DecodedWeightedBarcodeResult {
  is_weighted: boolean;
  product_id: number;
  product_name: string;
  product_ean: string;
  price_per_kg: number;
  net_weight_grams: number;
  total_price: number;
  calculated_quantity: number;
  payload_type: BarcodePayloadType;
  raw_value: number;
}

export interface GenerateWeighingLabelInput {
  product_id: number;
  batch_id?: number;
  gross_weight_grams: number;
  tare_grams?: number;
  scale_device_id?: number;
  operator_name?: string;
  store_id?: number;
}

export interface WeighingLabelResult {
  log_id: number;
  product_id: number;
  product_name: string;
  barcode: string;
  net_weight_grams: number;
  price_per_kg: number;
  total_price: number;
  tare_grams: number;
  expiration_date?: string | null;
  thermal_label_zpl: string;
}

export interface ScaleKpis {
  total_scales: number;
  active_scales: number;
  total_weighings_today: number;
  total_weight_kg_today: number;
  total_weighted_sales_amount_today: number;
}
