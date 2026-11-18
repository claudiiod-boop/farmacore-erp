// FarmaCore ERP — Tipos de Domínio Multi-Loja (Fase 9)

export type TaxRegime = 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';

export interface Store {
  id: number;
  code: string;
  name: string;
  companyName: string;
  cnpj: string;
  ie: string;
  isHeadquarters: boolean;
  phone?: string | null;
  email?: string | null;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  ibgeCode: string;
  taxRegime: TaxRegime | string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;

  // DB compatibility aliases
  company_name?: string;
  is_headquarters?: number | boolean;
  zip_code?: string;
  ibge_code?: string;
  tax_regime?: string;
  is_active?: number | boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateStoreInput {
  code: string;
  name: string;
  companyName: string;
  cnpj: string;
  ie: string;
  isHeadquarters?: boolean;
  phone?: string | null;
  email?: string | null;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  ibgeCode: string;
  taxRegime?: TaxRegime | string;
  isActive?: boolean;

  // Compatibility aliases
  company_name?: string;
  is_headquarters?: number | boolean;
  zip_code?: string;
  ibge_code?: string;
  tax_regime?: string;
  is_active?: number | boolean;
}

export interface UpdateStoreInput {
  code?: string;
  name?: string;
  companyName?: string;
  cnpj?: string;
  ie?: string;
  isHeadquarters?: boolean;
  phone?: string | null;
  email?: string | null;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  ibgeCode?: string;
  taxRegime?: TaxRegime | string;
  isActive?: boolean;

  // Compatibility aliases
  company_name?: string;
  is_headquarters?: number | boolean;
  zip_code?: string;
  ibge_code?: string;
  tax_regime?: string;
  is_active?: number | boolean;
}

export interface NetworkStockItem {
  storeId: number;
  storeCode?: string;
  storeName: string;
  storeCity: string;
  storeState?: string;
  storePhone?: string | null;
  isHeadquarters?: boolean;
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  earliestExpiry?: string | null;
  batchCount?: number;

  // Compatibility aliases
  store_id?: number;
  store_code?: string;
  store_name?: string;
  store_city?: string;
  store_state?: string;
  store_phone?: string | null;
  is_headquarters?: number | boolean;
  total_quantity?: number;
  reserved_quantity?: number;
  available_quantity?: number;
  earliest_expiry?: string | null;
  batch_count?: number;
}
