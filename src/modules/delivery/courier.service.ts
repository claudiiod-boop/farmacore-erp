import { getDatabase, Database } from '../../database/connection';
import type {
  Courier,
  CourierVehicleType,
  CourierStatus,
  CreateCourierInput,
  UpdateCourierInput,
  CourierFilters,
  DeliveryZone,
  CreateDeliveryZoneInput,
  UpdateDeliveryZoneInput,
} from './types';

export class CourierError extends Error {
  constructor(public code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'CourierError';
  }
}

// Compatibilidade cruzada com DeliveryError
export { CourierError as DeliveryError };

export interface DeliveryFeeCalculation {
  fee: number;
  estimatedMinutes: number;
  isFree: boolean;
  zone: DeliveryZone | null;
  zoneId?: number | null;
  zoneName?: string | null;
}

export interface CalculateDeliveryFeeParams {
  neighborhood: string;
  city?: string;
  storeId?: number | null;
  subtotalAmount?: number;
  subtotal?: number;
}

interface CourierDbRow {
  id: number;
  store_id: number | null;
  name: string;
  cpf: string;
  phone: string;
  vehicle_type: CourierVehicleType;
  vehicle_plate: string | null;
  cnh: string | null;
  commission_per_delivery: number;
  daily_allowance: number;
  status: CourierStatus;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface DeliveryZoneDbRow {
  id: number;
  store_id: number | null;
  name: string;
  neighborhood: string;
  city: string;
  state: string;
  delivery_fee: number;
  estimated_minutes: number;
  free_shipping_threshold: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

const VALID_VEHICLE_TYPES: CourierVehicleType[] = ['MOTO', 'BIKE', 'CAR', 'WALK'];
const VALID_COURIER_STATUSES: CourierStatus[] = ['AVAILABLE', 'ON_DELIVERY', 'INACTIVE'];

function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

function isValidCpfFormat(cpf: string): boolean {
  if (!cpf || typeof cpf !== 'string') return false;
  const trimmed = cpf.trim();
  const clean = normalizeCpf(trimmed);
  if (clean.length !== 11) return false;
  return /^[0-9.\-\s]+$/.test(trimmed);
}

function mapCourierRow(row: CourierDbRow): Courier {
  return {
    id: Number(row.id),
    storeId: row.store_id != null ? Number(row.store_id) : null,
    name: row.name,
    cpf: row.cpf,
    phone: row.phone,
    vehicleType: row.vehicle_type,
    vehiclePlate: row.vehicle_plate ?? null,
    cnh: row.cnh ?? null,
    commissionPerDelivery: Number(row.commission_per_delivery),
    dailyAllowance: Number(row.daily_allowance),
    status: row.status,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // Compatibilidade snake_case
    store_id: row.store_id != null ? Number(row.store_id) : null,
    vehicle_type: row.vehicle_type,
    vehicle_plate: row.vehicle_plate ?? null,
    commission_per_delivery: Number(row.commission_per_delivery),
    daily_allowance: Number(row.daily_allowance),
    is_active: Number(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapZoneRow(row: DeliveryZoneDbRow): DeliveryZone {
  return {
    id: Number(row.id),
    storeId: row.store_id != null ? Number(row.store_id) : null,
    name: row.name,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    deliveryFee: Number(row.delivery_fee),
    estimatedMinutes: Number(row.estimated_minutes),
    freeShippingThreshold:
      row.free_shipping_threshold != null ? Number(row.free_shipping_threshold) : null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // Compatibilidade snake_case
    store_id: row.store_id != null ? Number(row.store_id) : null,
    delivery_fee: Number(row.delivery_fee),
    estimated_minutes: Number(row.estimated_minutes),
    free_shipping_threshold:
      row.free_shipping_threshold != null ? Number(row.free_shipping_threshold) : null,
    is_active: Number(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class CourierService {
  constructor(private db: Database = getDatabase()) {}

  // =========================================================================
  // GESTÃO DE ENTREGADORES (couriers)
  // =========================================================================

  /**
   * Cadastra um novo entregador com validações completas e defaults do sistema.
   */
  createCourier(input: CreateCourierInput): Courier {
    const name = (input.name ?? '').trim();
    if (!name) {
      throw new CourierError('INVALID_NAME', 'Nome do entregador é obrigatório.');
    }

    const phone = (input.phone ?? '').trim();
    if (!phone) {
      throw new CourierError('INVALID_PHONE', 'Telefone do entregador é obrigatório.');
    }

    const cpf = (input.cpf ?? '').trim();
    if (!isValidCpfFormat(cpf)) {
      throw new CourierError('INVALID_CPF', 'CPF inválido. Deve conter 11 dígitos numéricos válidos.');
    }

    const cleanCpf = normalizeCpf(cpf);
    const existingCourier = this.db
      .prepare("SELECT id FROM couriers WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = ?")
      .get(cleanCpf);

    if (existingCourier) {
      throw new CourierError('DUPLICATE_CPF', `CPF '${cpf}' já está cadastrado para outro entregador.`);
    }

    const storeId = input.storeId ?? input.store_id ?? null;
    if (storeId != null) {
      this.validateStore(storeId);
    }

    const vehicleType: CourierVehicleType = input.vehicleType ?? input.vehicle_type ?? 'MOTO';
    if (!VALID_VEHICLE_TYPES.includes(vehicleType)) {
      throw new CourierError(
        'INVALID_VEHICLE_TYPE',
        `Tipo de veículo inválido: '${vehicleType}'. Permitidos: ${VALID_VEHICLE_TYPES.join(', ')}`
      );
    }

    const commissionPerDelivery =
      input.commissionPerDelivery ?? input.commission_per_delivery ?? 3.0;
    if (commissionPerDelivery < 0) {
      throw new CourierError('INVALID_COMMISSION', 'Comissão por entrega não pode ser negativa.');
    }

    const dailyAllowance = input.dailyAllowance ?? input.daily_allowance ?? 0.0;
    if (dailyAllowance < 0) {
      throw new CourierError('INVALID_DAILY_ALLOWANCE', 'Diária do entregador não pode ser negativa.');
    }

    const status: CourierStatus = input.status ?? 'AVAILABLE';
    if (!VALID_COURIER_STATUSES.includes(status)) {
      throw new CourierError(
        'INVALID_STATUS',
        `Status inválido: '${status}'. Permitidos: ${VALID_COURIER_STATUSES.join(', ')}`
      );
    }

    const isActive =
      input.isActive !== undefined
        ? (input.isActive ? 1 : 0)
        : input.is_active !== undefined
        ? (input.is_active ? 1 : 0)
        : 1;

    const vehiclePlate = input.vehiclePlate ?? input.vehicle_plate ?? null;
    const cnh = input.cnh ?? null;

    const stmt = this.db.prepare(`
      INSERT INTO couriers (
        store_id,
        name,
        cpf,
        phone,
        vehicle_type,
        vehicle_plate,
        cnh,
        commission_per_delivery,
        daily_allowance,
        status,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(
      storeId,
      name,
      cpf,
      phone,
      vehicleType,
      vehiclePlate,
      cnh,
      commissionPerDelivery,
      dailyAllowance,
      status,
      isActive
    );

    const created = this.getCourierById(Number(result.lastInsertRowid));
    if (!created) {
      throw new CourierError('CREATE_COURIER_FAILED', 'Falha ao recuperar entregador recém-criado.');
    }
    return created;
  }

  /**
   * Atualiza dados cadastrais, operacionais ou comissões de um entregador.
   */
  updateCourier(id: number, input: UpdateCourierInput): Courier {
    const existing = this.getCourierRow(id);
    if (!existing) {
      throw new CourierError('COURIER_NOT_FOUND', `Entregador com ID ${id} não encontrado.`);
    }

    let cpf = existing.cpf;
    if (input.cpf !== undefined) {
      const trimmedCpf = input.cpf.trim();
      if (!isValidCpfFormat(trimmedCpf)) {
        throw new CourierError('INVALID_CPF', 'CPF inválido. Deve conter 11 dígitos numéricos válidos.');
      }
      const cleanCpf = normalizeCpf(trimmedCpf);
      const duplicate = this.db
        .prepare(
          "SELECT id FROM couriers WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = ? AND id != ?"
        )
        .get(cleanCpf, id);

      if (duplicate) {
        throw new CourierError(
          'DUPLICATE_CPF',
          `CPF '${trimmedCpf}' já está em uso por outro entregador.`
        );
      }
      cpf = trimmedCpf;
    }

    const name = input.name !== undefined ? input.name.trim() : existing.name;
    if (!name) {
      throw new CourierError('INVALID_NAME', 'Nome do entregador não pode ser vazio.');
    }

    const phone = input.phone !== undefined ? input.phone.trim() : existing.phone;
    if (!phone) {
      throw new CourierError('INVALID_PHONE', 'Telefone do entregador não pode ser vazio.');
    }

    let storeId = existing.store_id;
    if (input.storeId !== undefined || input.store_id !== undefined) {
      const candidateStoreId = input.storeId ?? input.store_id;
      if (candidateStoreId != null) {
        this.validateStore(candidateStoreId);
        storeId = candidateStoreId;
      } else {
        storeId = null;
      }
    }

    let vehicleType = existing.vehicle_type;
    if (input.vehicleType !== undefined || input.vehicle_type !== undefined) {
      const candidate = input.vehicleType ?? input.vehicle_type;
      if (candidate && !VALID_VEHICLE_TYPES.includes(candidate)) {
        throw new CourierError(
          'INVALID_VEHICLE_TYPE',
          `Tipo de veículo inválido: '${candidate}'. Permitidos: ${VALID_VEHICLE_TYPES.join(', ')}`
        );
      }
      if (candidate) vehicleType = candidate;
    }

    let commission = existing.commission_per_delivery;
    if (input.commissionPerDelivery !== undefined || input.commission_per_delivery !== undefined) {
      const candidate = input.commissionPerDelivery ?? input.commission_per_delivery;
      if (candidate !== undefined) {
        if (candidate < 0) {
          throw new CourierError('INVALID_COMMISSION', 'Comissão por entrega não pode ser negativa.');
        }
        commission = candidate;
      }
    }

    let allowance = existing.daily_allowance;
    if (input.dailyAllowance !== undefined || input.daily_allowance !== undefined) {
      const candidate = input.dailyAllowance ?? input.daily_allowance;
      if (candidate !== undefined) {
        if (candidate < 0) {
          throw new CourierError('INVALID_DAILY_ALLOWANCE', 'Diária não pode ser negativa.');
        }
        allowance = candidate;
      }
    }

    let status = existing.status;
    if (input.status !== undefined) {
      if (!VALID_COURIER_STATUSES.includes(input.status)) {
        throw new CourierError(
          'INVALID_STATUS',
          `Status inválido: '${input.status}'. Permitidos: ${VALID_COURIER_STATUSES.join(', ')}`
        );
      }
      status = input.status;
    }

    let isActive = existing.is_active;
    if (input.isActive !== undefined) {
      isActive = input.isActive ? 1 : 0;
    } else if (input.is_active !== undefined) {
      isActive = input.is_active ? 1 : 0;
    }

    const vehiclePlate =
      input.vehiclePlate !== undefined
        ? input.vehiclePlate
        : input.vehicle_plate !== undefined
        ? input.vehicle_plate
        : existing.vehicle_plate;

    const cnh = input.cnh !== undefined ? input.cnh : existing.cnh;

    this.db
      .prepare(`
        UPDATE couriers SET
          store_id = ?,
          name = ?,
          cpf = ?,
          phone = ?,
          vehicle_type = ?,
          vehicle_plate = ?,
          cnh = ?,
          commission_per_delivery = ?,
          daily_allowance = ?,
          status = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(
        storeId,
        name,
        cpf,
        phone,
        vehicleType,
        vehiclePlate,
        cnh,
        commission,
        allowance,
        status,
        isActive,
        id
      );

    const updated = this.getCourierById(id);
    if (!updated) {
      throw new CourierError('UPDATE_COURIER_FAILED', 'Falha ao recuperar entregador atualizado.');
    }
    return updated;
  }

  /**
   * Busca entregador pelo ID único.
   */
  getCourierById(id: number): Courier | null {
    const row = this.getCourierRow(id);
    return row ? mapCourierRow(row) : null;
  }

  /**
   * Busca entregador por CPF (tolerante a máscaras e pontuações).
   */
  getCourierByCpf(cpf: string): Courier | null {
    if (!cpf) return null;
    const cleanCpf = normalizeCpf(cpf);
    const row = this.db
      .prepare(
        "SELECT * FROM couriers WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = ? LIMIT 1"
      )
      .get(cleanCpf) as CourierDbRow | undefined;

    return row ? mapCourierRow(row) : null;
  }

  /**
   * Lista entregadores com filtros por loja, status operacional, tipo de veículo e busca textual.
   */
  listCouriers(filters?: CourierFilters): Courier[] {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (filters?.storeId != null) {
      conditions.push('(store_id = ? OR store_id IS NULL)');
      params.push(filters.storeId);
    }

    if (filters?.activeOnly) {
      conditions.push('is_active = 1');
    }

    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters?.vehicleType) {
      conditions.push('vehicle_type = ?');
      params.push(filters.vehicleType);
    }

    if (filters?.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      const digitsOnly = normalizeCpf(filters.search.trim());
      if (digitsOnly.length > 0) {
        conditions.push(
          `(LOWER(name) LIKE LOWER(?) OR phone LIKE ? OR REPLACE(REPLACE(cpf, '.', ''), '-', '') LIKE ?)`
        );
        params.push(term, term, `%${digitsOnly}%`);
      } else {
        conditions.push(`(LOWER(name) LIKE LOWER(?) OR phone LIKE ?)`);
        params.push(term, term);
      }
    }

    const query = `
      SELECT * FROM couriers
      WHERE ${conditions.join(' AND ')}
      ORDER BY name ASC
    `;

    const rows = this.db.prepare(query).all(...params) as CourierDbRow[];
    return rows.map(mapCourierRow);
  }

  /**
   * Atualiza o status operacional do motoboy (AVAILABLE, ON_DELIVERY, INACTIVE).
   */
  updateCourierStatus(id: number, status: CourierStatus): Courier {
    if (!VALID_COURIER_STATUSES.includes(status)) {
      throw new CourierError(
        'INVALID_STATUS',
        `Status inválido: '${status}'. Permitidos: ${VALID_COURIER_STATUSES.join(', ')}`
      );
    }

    const courier = this.getCourierById(id);
    if (!courier) {
      throw new CourierError('COURIER_NOT_FOUND', `Entregador com ID ${id} não encontrado.`);
    }

    this.db
      .prepare('UPDATE couriers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(status, id);

    const updated = this.getCourierById(id);
    return updated!;
  }

  // =========================================================================
  // GESTÃO DE ZONAS DE ENTREGA (delivery_zones)
  // =========================================================================

  /**
   * Cria nova zona ou bairro de entrega com validação de taxas e tempos estimados.
   */
  createDeliveryZone(input: CreateDeliveryZoneInput): DeliveryZone {
    const name = (input.name ?? '').trim();
    const neighborhood = (input.neighborhood ?? '').trim();
    const city = (input.city ?? '').trim();

    if (!name || !neighborhood || !city) {
      throw new CourierError(
        'INVALID_ZONE_DATA',
        'Nome, bairro e cidade da zona de entrega são obrigatórios.'
      );
    }

    const state = (input.state ?? 'SP').trim().toUpperCase();

    const deliveryFee = input.deliveryFee ?? input.delivery_fee ?? 5.0;
    if (deliveryFee < 0) {
      throw new CourierError('INVALID_DELIVERY_FEE', 'Taxa de entrega não pode ser negativa.');
    }

    const estimatedMinutes = input.estimatedMinutes ?? input.estimated_minutes ?? 40;
    if (estimatedMinutes <= 0) {
      throw new CourierError(
        'INVALID_ESTIMATED_MINUTES',
        'Tempo estimado de entrega deve ser maior que zero minutos.'
      );
    }

    const freeShippingThreshold =
      input.freeShippingThreshold !== undefined
        ? input.freeShippingThreshold
        : input.free_shipping_threshold !== undefined
        ? input.free_shipping_threshold
        : null;

    if (freeShippingThreshold != null && freeShippingThreshold < 0) {
      throw new CourierError(
        'INVALID_FREE_SHIPPING_THRESHOLD',
        'Valor para frete grátis não pode ser negativo.'
      );
    }

    const storeId = input.storeId ?? input.store_id ?? null;
    if (storeId != null) {
      this.validateStore(storeId);
    }

    const isActive =
      input.isActive !== undefined
        ? (input.isActive ? 1 : 0)
        : input.is_active !== undefined
        ? (input.is_active ? 1 : 0)
        : 1;

    const stmt = this.db.prepare(`
      INSERT INTO delivery_zones (
        store_id,
        name,
        neighborhood,
        city,
        state,
        delivery_fee,
        estimated_minutes,
        free_shipping_threshold,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(
      storeId,
      name,
      neighborhood,
      city,
      state,
      deliveryFee,
      estimatedMinutes,
      freeShippingThreshold,
      isActive
    );

    const created = this.getDeliveryZoneById(Number(result.lastInsertRowid));
    if (!created) {
      throw new CourierError('CREATE_ZONE_FAILED', 'Falha ao recuperar zona de entrega criada.');
    }
    return created;
  }

  /**
   * Atualiza parâmetros de taxa, tempo estimado e teto de frete grátis de uma zona.
   */
  updateDeliveryZone(id: number, input: UpdateDeliveryZoneInput): DeliveryZone {
    const existing = this.getZoneRow(id);
    if (!existing) {
      throw new CourierError('ZONE_NOT_FOUND', `Zona de entrega com ID ${id} não encontrada.`);
    }

    const name = input.name !== undefined ? input.name.trim() : existing.name;
    const neighborhood =
      input.neighborhood !== undefined ? input.neighborhood.trim() : existing.neighborhood;
    const city = input.city !== undefined ? input.city.trim() : existing.city;
    const state =
      input.state !== undefined ? input.state.trim().toUpperCase() : existing.state;

    let deliveryFee = existing.delivery_fee;
    if (input.deliveryFee !== undefined || input.delivery_fee !== undefined) {
      const candidate = input.deliveryFee ?? input.delivery_fee;
      if (candidate !== undefined) {
        if (candidate < 0) {
          throw new CourierError('INVALID_DELIVERY_FEE', 'Taxa de entrega não pode ser negativa.');
        }
        deliveryFee = candidate;
      }
    }

    let estimatedMinutes = existing.estimated_minutes;
    if (input.estimatedMinutes !== undefined || input.estimated_minutes !== undefined) {
      const candidate = input.estimatedMinutes ?? input.estimated_minutes;
      if (candidate !== undefined) {
        if (candidate <= 0) {
          throw new CourierError(
            'INVALID_ESTIMATED_MINUTES',
            'Tempo estimado de entrega deve ser maior que zero minutos.'
          );
        }
        estimatedMinutes = candidate;
      }
    }

    let freeShippingThreshold = existing.free_shipping_threshold;
    if (
      input.freeShippingThreshold !== undefined ||
      input.free_shipping_threshold !== undefined
    ) {
      const candidate = input.freeShippingThreshold ?? input.free_shipping_threshold;
      if (candidate !== undefined) {
        if (candidate != null && candidate < 0) {
          throw new CourierError(
            'INVALID_FREE_SHIPPING_THRESHOLD',
            'Teto de frete grátis não pode ser negativo.'
          );
        }
        freeShippingThreshold = candidate;
      }
    }

    let isActive = existing.is_active;
    if (input.isActive !== undefined) {
      isActive = input.isActive ? 1 : 0;
    } else if (input.is_active !== undefined) {
      isActive = input.is_active ? 1 : 0;
    }

    this.db
      .prepare(`
        UPDATE delivery_zones SET
          name = ?,
          neighborhood = ?,
          city = ?,
          state = ?,
          delivery_fee = ?,
          estimated_minutes = ?,
          free_shipping_threshold = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(
        name,
        neighborhood,
        city,
        state,
        deliveryFee,
        estimatedMinutes,
        freeShippingThreshold,
        isActive,
        id
      );

    const updated = this.getDeliveryZoneById(id);
    if (!updated) {
      throw new CourierError('UPDATE_ZONE_FAILED', 'Falha ao recuperar zona de entrega atualizada.');
    }
    return updated;
  }

  /**
   * Busca zona de entrega pelo ID.
   */
  getDeliveryZoneById(id: number): DeliveryZone | null {
    const row = this.getZoneRow(id);
    return row ? mapZoneRow(row) : null;
  }

  /**
   * Lista zonas de entrega com filtros opcionais.
   */
  listDeliveryZones(filters?: { storeId?: number; activeOnly?: boolean; search?: string }): DeliveryZone[] {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (filters?.storeId != null) {
      conditions.push('(store_id = ? OR store_id IS NULL)');
      params.push(filters.storeId);
    }

    if (filters?.activeOnly) {
      conditions.push('is_active = 1');
    }

    if (filters?.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        '(LOWER(name) LIKE LOWER(?) OR LOWER(neighborhood) LIKE LOWER(?) OR LOWER(city) LIKE LOWER(?))'
      );
      params.push(term, term, term);
    }

    const query = `
      SELECT * FROM delivery_zones
      WHERE ${conditions.join(' AND ')}
      ORDER BY name ASC
    `;

    const rows = this.db.prepare(query).all(...params) as DeliveryZoneDbRow[];
    return rows.map(mapZoneRow);
  }

  /**
   * Exclui uma zona de entrega pelo ID.
   */
  deleteDeliveryZone(id: number): boolean {
    const existing = this.getZoneRow(id);
    if (!existing) {
      throw new CourierError('ZONE_NOT_FOUND', `Zona de entrega com ID ${id} não encontrada.`);
    }

    this.db.prepare('DELETE FROM delivery_zones WHERE id = ?').run(id);
    return true;
  }

  /**
   * Calcula taxa de entrega e tempo estimado para bairro/cidade.
   * Suporta chamada com objeto ou parâmetros posicionais.
   * Aplica frete grátis se o subtotal atingir o freeShippingThreshold.
   * Retorna fallback padrão (R$ 5.00 e 40 min) se o bairro não estiver cadastrado.
   */
  calculateDeliveryFee(
    paramsOrNeighborhood: CalculateDeliveryFeeParams | string,
    cityArg?: string,
    subtotalArg?: number,
    storeIdArg?: number
  ): DeliveryFeeCalculation {
    let neighborhood = '';
    let city: string | undefined;
    let storeId: number | null = null;
    let subtotalAmount = 0;

    if (typeof paramsOrNeighborhood === 'object' && paramsOrNeighborhood !== null) {
      neighborhood = paramsOrNeighborhood.neighborhood || '';
      city = paramsOrNeighborhood.city;
      storeId = paramsOrNeighborhood.storeId ?? null;
      subtotalAmount =
        paramsOrNeighborhood.subtotalAmount ?? paramsOrNeighborhood.subtotal ?? 0;
    } else {
      neighborhood = paramsOrNeighborhood || '';
      city = cityArg;
      subtotalAmount = subtotalArg ?? 0;
      storeId = storeIdArg ?? null;
    }

    const trimmedNeighborhood = neighborhood.trim();
    const trimmedCity = city?.trim();

    let zoneRow: DeliveryZoneDbRow | undefined;

    if (trimmedNeighborhood) {
      if (trimmedCity) {
        zoneRow = this.db
          .prepare(`
            SELECT * FROM delivery_zones
            WHERE LOWER(TRIM(neighborhood)) = LOWER(TRIM(?))
              AND LOWER(TRIM(city)) = LOWER(TRIM(?))
              AND is_active = 1
              AND (? IS NULL OR store_id = ? OR store_id IS NULL)
            ORDER BY store_id DESC
            LIMIT 1
          `)
          .get(trimmedNeighborhood, trimmedCity, storeId, storeId) as DeliveryZoneDbRow | undefined;
      } else {
        zoneRow = this.db
          .prepare(`
            SELECT * FROM delivery_zones
            WHERE LOWER(TRIM(neighborhood)) = LOWER(TRIM(?))
              AND is_active = 1
              AND (? IS NULL OR store_id = ? OR store_id IS NULL)
            ORDER BY store_id DESC
            LIMIT 1
          `)
          .get(trimmedNeighborhood, storeId, storeId) as DeliveryZoneDbRow | undefined;
      }
    }

    if (!zoneRow) {
      // Valores padrão de fallback
      return {
        fee: 5.0,
        estimatedMinutes: 40,
        isFree: false,
        zone: null,
        zoneId: null,
        zoneName: null,
      };
    }

    const zone = mapZoneRow(zoneRow);
    const hasFreeThreshold =
      zone.freeShippingThreshold != null && zone.freeShippingThreshold > 0;
    const isFree = hasFreeThreshold && subtotalAmount >= zone.freeShippingThreshold!;
    const fee = isFree ? 0.0 : zone.deliveryFee;

    return {
      fee,
      estimatedMinutes: zone.estimatedMinutes,
      isFree,
      zone,
      zoneId: zone.id,
      zoneName: zone.name,
    };
  }

  // =========================================================================
  // AUXILIARES PRIVADOS
  // =========================================================================

  private getCourierRow(id: number): CourierDbRow | undefined {
    return this.db.prepare('SELECT * FROM couriers WHERE id = ?').get(id) as
      | CourierDbRow
      | undefined;
  }

  private getZoneRow(id: number): DeliveryZoneDbRow | undefined {
    return this.db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(id) as
      | DeliveryZoneDbRow
      | undefined;
  }

  private validateStore(storeId: number): void {
    const store = this.db
      .prepare('SELECT id, is_active FROM stores WHERE id = ?')
      .get(storeId) as { id: number; is_active: number } | undefined;

    if (!store) {
      throw new CourierError('STORE_NOT_FOUND', `Loja com ID ${storeId} não encontrada.`);
    }
    if (!store.is_active) {
      throw new CourierError('STORE_INACTIVE', `Loja com ID ${storeId} está inativa.`);
    }
  }
}
