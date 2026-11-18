import { getDatabase, Database } from '../../database/connection';
import type {
  Store,
  CreateStoreInput,
  UpdateStoreInput,
  NetworkStockItem,
} from './types';

interface StoreRow {
  id: number;
  code: string;
  name: string;
  company_name: string;
  cnpj: string;
  ie: string;
  is_headquarters: number;
  phone: string | null;
  email: string | null;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  ibge_code: string;
  tax_regime: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface BatchStockRow {
  store_id: number;
  quantity: number;
  reserved_quantity: number;
  expiration_date: string;
}

function mapStoreRow(row: StoreRow): Store {
  const isHeadquarters = Boolean(row.is_headquarters);
  const isActive = Boolean(row.is_active);

  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    companyName: row.company_name,
    cnpj: row.cnpj,
    ie: row.ie,
    isHeadquarters,
    phone: row.phone ?? null,
    email: row.email ?? null,
    street: row.street,
    number: row.number,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    ibgeCode: row.ibge_code,
    taxRegime: row.tax_regime,
    isActive,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // DB compatibility aliases
    company_name: row.company_name,
    is_headquarters: row.is_headquarters,
    zip_code: row.zip_code,
    ibge_code: row.ibge_code,
    tax_regime: row.tax_regime,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class StoreService {
  constructor(private db: Database = getDatabase()) {}

  private getCurrentDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Retorna lista de lojas ordenadas por Matriz primeiro, depois ID crescente.
   */
  listStores(filter?: { activeOnly?: boolean }): Store[] {
    const activeOnly = Boolean(filter?.activeOnly);
    const sql = activeOnly
      ? 'SELECT * FROM stores WHERE is_active = 1 ORDER BY is_headquarters DESC, id ASC'
      : 'SELECT * FROM stores ORDER BY is_headquarters DESC, id ASC';

    const rows = this.db.prepare(sql).all() as StoreRow[];
    return rows.map(mapStoreRow);
  }

  /**
   * Busca loja por ID. Retorna null se não encontrada.
   */
  getStoreById(id: number): Store | null {
    const row = this.db.prepare('SELECT * FROM stores WHERE id = ?').get(id) as StoreRow | undefined;
    return row ? mapStoreRow(row) : null;
  }

  /**
   * Cadastra uma nova loja / filial com validações cadastrais e fiscais.
   */
  createStore(data: CreateStoreInput): Store {
    const code = (data.code ?? '').trim();
    const name = (data.name ?? '').trim();
    const companyName = (data.companyName ?? data.company_name ?? '').trim();
    const cnpj = (data.cnpj ?? '').trim();
    const ie = (data.ie ?? '').trim();
    const street = (data.street ?? '').trim();
    const number = (data.number ?? '').trim();
    const neighborhood = (data.neighborhood ?? '').trim();
    const city = (data.city ?? '').trim();
    const state = (data.state ?? '').trim().toUpperCase();
    const zipCode = (data.zipCode ?? data.zip_code ?? '').trim();
    const ibgeCode = (data.ibgeCode ?? data.ibge_code ?? '').trim();

    // Validação de campos obrigatórios
    if (!code) throw new Error('Campo obrigatório: code');
    if (!name) throw new Error('Campo obrigatório: name');
    if (!companyName) throw new Error('Campo obrigatório: companyName');
    if (!cnpj) throw new Error('Campo obrigatório: cnpj');
    if (!ie) throw new Error('Campo obrigatório: ie');
    if (!street) throw new Error('Campo obrigatório: street');
    if (!number) throw new Error('Campo obrigatório: number');
    if (!neighborhood) throw new Error('Campo obrigatório: neighborhood');
    if (!city) throw new Error('Campo obrigatório: city');
    if (!state) throw new Error('Campo obrigatório: state');
    if (!zipCode) throw new Error('Campo obrigatório: zipCode');
    if (!ibgeCode) throw new Error('Campo obrigatório: ibgeCode');

    // Validação de unicidade de CNPJ
    const existingCnpj = this.db.prepare('SELECT id FROM stores WHERE cnpj = ?').get(cnpj);
    if (existingCnpj) {
      throw new Error('CNPJ já cadastrado');
    }

    // Validação de unicidade de Código de Loja
    const existingCode = this.db.prepare('SELECT id FROM stores WHERE code = ?').get(code);
    if (existingCode) {
      throw new Error('Código de loja já cadastrado');
    }

    // Validação de unicidade de Matriz ativa
    const isHeadquarters = Boolean(data.isHeadquarters ?? data.is_headquarters);
    if (isHeadquarters) {
      const existingHq = this.db.prepare('SELECT id FROM stores WHERE is_headquarters = 1 AND is_active = 1').get();
      if (existingHq) {
        throw new Error('Já existe uma loja definida como Matriz');
      }
    }

    const phone = data.phone?.trim() || null;
    const email = data.email?.trim() || null;
    const taxRegime = data.taxRegime ?? data.tax_regime ?? 'SIMPLES_NACIONAL';
    const isActive = data.isActive !== undefined
      ? (data.isActive ? 1 : 0)
      : (data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1);

    const stmt = this.db.prepare(`
      INSERT INTO stores (
        code, name, company_name, cnpj, ie, is_headquarters, phone, email,
        street, number, neighborhood, city, state, zip_code, ibge_code,
        tax_regime, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      code,
      name,
      companyName,
      cnpj,
      ie,
      isHeadquarters ? 1 : 0,
      phone,
      email,
      street,
      number,
      neighborhood,
      city,
      state,
      zipCode,
      ibgeCode,
      taxRegime,
      isActive
    );

    const createdId = Number(result.lastInsertRowid);
    const createdStore = this.getStoreById(createdId);
    if (!createdStore) {
      throw new Error('Erro ao recuperar loja cadastrada');
    }

    return createdStore;
  }

  /**
   * Atualiza dados cadastrais, endereço ou status de uma loja.
   */
  updateStore(id: number, data: UpdateStoreInput): Store {
    const existing = this.getStoreById(id);
    if (!existing) {
      throw new Error('Loja não encontrada');
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (data.code !== undefined) {
      const code = data.code.trim();
      if (!code) throw new Error('Campo obrigatório: code');
      const conflict = this.db.prepare('SELECT id FROM stores WHERE code = ? AND id <> ?').get(code, id);
      if (conflict) {
        throw new Error('Código de loja já cadastrado');
      }
      updates.push('code = ?');
      values.push(code);
    }

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new Error('Campo obrigatório: name');
      updates.push('name = ?');
      values.push(name);
    }

    const companyName = data.companyName ?? data.company_name;
    if (companyName !== undefined) {
      const trimmed = companyName.trim();
      if (!trimmed) throw new Error('Campo obrigatório: companyName');
      updates.push('company_name = ?');
      values.push(trimmed);
    }

    if (data.cnpj !== undefined) {
      const cnpj = data.cnpj.trim();
      if (!cnpj) throw new Error('Campo obrigatório: cnpj');
      const conflict = this.db.prepare('SELECT id FROM stores WHERE cnpj = ? AND id <> ?').get(cnpj, id);
      if (conflict) {
        throw new Error('CNPJ já cadastrado');
      }
      updates.push('cnpj = ?');
      values.push(cnpj);
    }

    if (data.ie !== undefined) {
      const ie = data.ie.trim();
      if (!ie) throw new Error('Campo obrigatório: ie');
      updates.push('ie = ?');
      values.push(ie);
    }

    const isHqInput = data.isHeadquarters ?? data.is_headquarters;
    if (isHqInput !== undefined) {
      const isHeadquarters = Boolean(isHqInput);
      if (isHeadquarters && !existing.isHeadquarters) {
        const conflict = this.db.prepare('SELECT id FROM stores WHERE is_headquarters = 1 AND is_active = 1 AND id <> ?').get(id);
        if (conflict) {
          throw new Error('Já existe uma loja definida como Matriz');
        }
      }
      updates.push('is_headquarters = ?');
      values.push(isHeadquarters ? 1 : 0);
    }

    if (data.phone !== undefined) {
      updates.push('phone = ?');
      values.push(data.phone ? data.phone.trim() : null);
    }

    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email ? data.email.trim() : null);
    }

    if (data.street !== undefined) {
      const street = data.street.trim();
      if (!street) throw new Error('Campo obrigatório: street');
      updates.push('street = ?');
      values.push(street);
    }

    if (data.number !== undefined) {
      const num = data.number.trim();
      if (!num) throw new Error('Campo obrigatório: number');
      updates.push('number = ?');
      values.push(num);
    }

    if (data.neighborhood !== undefined) {
      const neighborhood = data.neighborhood.trim();
      if (!neighborhood) throw new Error('Campo obrigatório: neighborhood');
      updates.push('neighborhood = ?');
      values.push(neighborhood);
    }

    if (data.city !== undefined) {
      const city = data.city.trim();
      if (!city) throw new Error('Campo obrigatório: city');
      updates.push('city = ?');
      values.push(city);
    }

    if (data.state !== undefined) {
      const state = data.state.trim().toUpperCase();
      if (!state) throw new Error('Campo obrigatório: state');
      updates.push('state = ?');
      values.push(state);
    }

    const zipCode = data.zipCode ?? data.zip_code;
    if (zipCode !== undefined) {
      const trimmed = zipCode.trim();
      if (!trimmed) throw new Error('Campo obrigatório: zipCode');
      updates.push('zip_code = ?');
      values.push(trimmed);
    }

    const ibgeCode = data.ibgeCode ?? data.ibge_code;
    if (ibgeCode !== undefined) {
      const trimmed = ibgeCode.trim();
      if (!trimmed) throw new Error('Campo obrigatório: ibgeCode');
      updates.push('ibge_code = ?');
      values.push(trimmed);
    }

    const taxRegime = data.taxRegime ?? data.tax_regime;
    if (taxRegime !== undefined) {
      updates.push('tax_regime = ?');
      values.push(taxRegime);
    }

    const isActiveInput = data.isActive ?? data.is_active;
    if (isActiveInput !== undefined) {
      updates.push('is_active = ?');
      values.push(isActiveInput ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      this.db.prepare(`UPDATE stores SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = this.getStoreById(id);
    if (!updated) {
      throw new Error('Erro ao recuperar loja atualizada');
    }
    return updated;
  }

  /**
   * Consulta o estoque de um produto em toda a rede de lojas ativas,
   * calculando saldo físico, reservado e disponível, com a validade mais próxima.
   */
  getNetworkProductStock(productId: number): NetworkStockItem[] {
    const activeStores = this.db.prepare(`
      SELECT * FROM stores WHERE is_active = 1 ORDER BY is_headquarters DESC, id ASC
    `).all() as StoreRow[];

    const currentDate = this.getCurrentDate();

    // Consulta lotes não-expirados do produto
    const batchRows = this.db.prepare(`
      SELECT store_id, quantity, reserved_quantity, expiration_date
      FROM batches
      WHERE product_id = ? AND expiration_date >= ?
      ORDER BY expiration_date ASC
    `).all(productId, currentDate) as BatchStockRow[];

    // Agrupa lotes por loja
    const storeBatchesMap = new Map<number, BatchStockRow[]>();
    for (const batch of batchRows) {
      const storeId = Number(batch.store_id);
      if (!storeBatchesMap.has(storeId)) {
        storeBatchesMap.set(storeId, []);
      }
      storeBatchesMap.get(storeId)!.push(batch);
    }

    const results: NetworkStockItem[] = [];

    for (const store of activeStores) {
      const batches = storeBatchesMap.get(store.id) || [];

      let totalQuantity = 0;
      let reservedQuantity = 0;
      let earliestExpiry: string | null = null;
      let activeBatchCount = 0;

      for (const batch of batches) {
        const qty = Number(batch.quantity || 0);
        const resQty = Number(batch.reserved_quantity || 0);

        totalQuantity += qty;
        reservedQuantity += resQty;

        if (qty > 0) {
          activeBatchCount += 1;
          if (!earliestExpiry || batch.expiration_date < earliestExpiry) {
            earliestExpiry = batch.expiration_date;
          }
        }
      }

      const availableQuantity = Math.max(0, totalQuantity - reservedQuantity);
      const isHeadquarters = Boolean(store.is_headquarters);

      results.push({
        storeId: store.id,
        storeCode: store.code,
        storeName: store.name,
        storeCity: store.city,
        storeState: store.state,
        storePhone: store.phone ?? null,
        isHeadquarters,
        totalQuantity,
        reservedQuantity,
        availableQuantity,
        earliestExpiry,
        batchCount: activeBatchCount,

        // Compatibility aliases
        store_id: store.id,
        store_code: store.code,
        store_name: store.name,
        store_city: store.city,
        store_state: store.state,
        store_phone: store.phone ?? null,
        is_headquarters: store.is_headquarters,
        total_quantity: totalQuantity,
        reserved_quantity: reservedQuantity,
        available_quantity: availableQuantity,
        earliest_expiry: earliestExpiry,
        batch_count: activeBatchCount,
      });
    }

    // Ordenação: Lojas com estoque disponível primeiro (maior saldo primeiro),
    // seguido de Matriz e ID
    results.sort((a, b) => {
      const aHasStock = a.availableQuantity > 0 ? 1 : 0;
      const bHasStock = b.availableQuantity > 0 ? 1 : 0;
      if (bHasStock !== aHasStock) {
        return bHasStock - aHasStock;
      }
      if (b.availableQuantity !== a.availableQuantity) {
        return b.availableQuantity - a.availableQuantity;
      }
      if (b.isHeadquarters !== a.isHeadquarters) {
        return (b.isHeadquarters ? 1 : 0) - (a.isHeadquarters ? 1 : 0);
      }
      return a.storeId - b.storeId;
    });

    return results;
  }
}
