import { getDatabase, Database } from '../../database/connection';
import type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerDependent,
  CreateDependentInput,
  CustomerWithDependents,
  CustomerFilters,
  CreditEligibilityResult,
  CustomerStatus,
  DependentRelationship,
  CorporateAgreement,
} from './types';

export class CustomerCreditError extends Error {
  constructor(public code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'CustomerCreditError';
  }
}

interface CustomerRow {
  id: number;
  store_id: number;
  agreement_id: number | null;
  name: string;
  cpf: string;
  rg: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  registration_number: string | null;
  department: string | null;
  credit_limit: number;
  current_debt: number;
  status: string;
  allow_dependents: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DependentRow {
  id: number;
  customer_id: number;
  name: string;
  cpf: string;
  relationship: string;
  is_active: number;
  created_at: string;
}

interface AgreementRow {
  id: number;
  code: string;
  company_name: string;
  trade_name: string;
  cnpj: string;
  ie: string | null;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  closing_day: number;
  due_day: number;
  credit_limit: number;
  discount_percent: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

function isValidCpfFormat(cpf: string): boolean {
  if (!cpf || typeof cpf !== 'string') return false;
  const trimmed = cpf.trim();
  const clean = normalizeCpf(trimmed);
  if (clean.length !== 11) return false;
  // Deve conter apenas dígitos, pontos, traços ou espaços
  return /^[0-9.\-\s]+$/.test(trimmed);
}

function mapCustomerRow(row: CustomerRow): Customer {
  const allowDependents = Boolean(row.allow_dependents);

  return {
    id: Number(row.id),
    storeId: Number(row.store_id),
    agreementId: row.agreement_id ? Number(row.agreement_id) : null,
    name: row.name,
    cpf: row.cpf,
    rg: row.rg ?? null,
    birthDate: row.birth_date ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    street: row.street ?? null,
    number: row.number ?? null,
    neighborhood: row.neighborhood ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    zipCode: row.zip_code ?? null,
    registrationNumber: row.registration_number ?? null,
    department: row.department ?? null,
    creditLimit: Number(row.credit_limit),
    currentDebt: Number(row.current_debt),
    status: row.status as CustomerStatus,
    allowDependents,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // DB compatibility aliases
    store_id: Number(row.store_id),
    agreement_id: row.agreement_id ? Number(row.agreement_id) : null,
    birth_date: row.birth_date ?? null,
    zip_code: row.zip_code ?? null,
    registration_number: row.registration_number ?? null,
    credit_limit: Number(row.credit_limit),
    current_debt: Number(row.current_debt),
    allow_dependents: row.allow_dependents,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapDependentRow(row: DependentRow): CustomerDependent {
  const isActive = Boolean(row.is_active);

  return {
    id: Number(row.id),
    customerId: Number(row.customer_id),
    name: row.name,
    cpf: row.cpf,
    relationship: (row.relationship as DependentRelationship) || 'OUTRO',
    isActive,
    createdAt: row.created_at,

    // DB compatibility aliases
    customer_id: Number(row.customer_id),
    is_active: row.is_active,
    created_at: row.created_at,
  };
}

function mapAgreementRow(row: AgreementRow): CorporateAgreement {
  return {
    id: Number(row.id),
    code: row.code,
    companyName: row.company_name,
    tradeName: row.trade_name,
    cnpj: row.cnpj,
    ie: row.ie ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    contactName: row.contact_name ?? null,
    street: row.street,
    number: row.number,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    closingDay: Number(row.closing_day),
    dueDay: Number(row.due_day),
    creditLimit: Number(row.credit_limit),
    discountPercent: Number(row.discount_percent),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // DB compatibility aliases
    company_name: row.company_name,
    trade_name: row.trade_name,
    contact_name: row.contact_name ?? undefined,
    zip_code: row.zip_code,
    closing_day: row.closing_day,
    due_day: row.due_day,
    credit_limit: row.credit_limit,
    discount_percent: row.discount_percent,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class CustomerCreditService {
  constructor(private db: Database = getDatabase()) {}

  /**
   * Cria um novo cliente titular com validações de dados cadastrais, formato de CPF e loja ativa.
   */
  createCustomer(input: CreateCustomerInput): Customer {
    const name = (input.name ?? '').trim();
    if (!name) {
      throw new CustomerCreditError('INVALID_NAME', 'Nome do cliente é obrigatório.');
    }

    const cpf = (input.cpf ?? '').trim();
    if (!isValidCpfFormat(cpf)) {
      throw new CustomerCreditError('INVALID_CPF', 'CPF inválido. Deve conter 11 dígitos numéricos.');
    }

    const cleanCpf = normalizeCpf(cpf);

    // Validação de unicidade do CPF no banco (comparando versão limpa de pontos e traços)
    const existingCustomer = this.db
      .prepare("SELECT id FROM customers WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = ?")
      .get(cleanCpf);

    if (existingCustomer) {
      throw new CustomerCreditError('DUPLICATE_CPF', `CPF '${cpf}' já está cadastrado.`);
    }

    // Validação da loja (store_id)
    const storeId = input.storeId ?? input.store_id ?? 1;
    const store = this.db
      .prepare('SELECT id, is_active FROM stores WHERE id = ?')
      .get(storeId) as { id: number; is_active: number } | undefined;

    if (!store) {
      throw new CustomerCreditError('STORE_NOT_FOUND', `Loja com ID ${storeId} não encontrada.`);
    }
    if (!store.is_active) {
      throw new CustomerCreditError('STORE_INACTIVE', `Loja com ID ${storeId} está inativa.`);
    }

    // Validação do convênio corporativo (se fornecido)
    const agreementId = input.agreementId ?? input.agreement_id ?? null;
    if (agreementId) {
      const agreement = this.db
        .prepare('SELECT id, is_active FROM corporate_agreements WHERE id = ?')
        .get(agreementId) as { id: number; is_active: number } | undefined;

      if (!agreement) {
        throw new CustomerCreditError('AGREEMENT_NOT_FOUND', `Convênio com ID ${agreementId} não encontrado.`);
      }
      if (!agreement.is_active) {
        throw new CustomerCreditError('AGREEMENT_INACTIVE', `Convênio com ID ${agreementId} está inativo.`);
      }
    }

    const rg = input.rg?.trim() ?? null;
    const birthDate = input.birthDate ?? input.birth_date ?? null;
    const phone = input.phone?.trim() ?? null;
    const email = input.email?.trim() ?? null;
    const street = input.street?.trim() ?? null;
    const number = input.number?.trim() ?? null;
    const neighborhood = input.neighborhood?.trim() ?? null;
    const city = input.city?.trim() ?? null;
    const state = input.state?.trim() ?? null;
    const zipCode = input.zipCode ?? input.zip_code ?? null;
    const registrationNumber = input.registrationNumber ?? input.registration_number ?? null;
    const department = input.department?.trim() ?? null;

    const creditLimit = Number(input.creditLimit ?? input.credit_limit ?? 0);
    const currentDebt = Number(input.currentDebt ?? input.current_debt ?? 0);
    const status: CustomerStatus = input.status ?? 'ACTIVE';

    const allowDependents =
      input.allowDependents !== undefined
        ? input.allowDependents ? 1 : 0
        : input.allow_dependents !== undefined
          ? input.allow_dependents ? 1 : 0
          : 1;

    const notes = input.notes?.trim() ?? null;

    const insertStmt = this.db.prepare(`
      INSERT INTO customers (
        store_id, agreement_id, name, cpf, rg, birth_date,
        phone, email, street, number, neighborhood, city, state, zip_code,
        registration_number, department, credit_limit, current_debt,
        status, allow_dependents, notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const result = insertStmt.run(
      storeId,
      agreementId,
      name,
      cpf,
      rg,
      birthDate,
      phone,
      email,
      street,
      number,
      neighborhood,
      city,
      state,
      zipCode,
      registrationNumber,
      department,
      creditLimit,
      currentDebt,
      status,
      allowDependents,
      notes
    );

    const createdId = Number(result.lastInsertRowid);
    const createdRow = this.db.prepare('SELECT * FROM customers WHERE id = ?').get(createdId) as CustomerRow;
    return mapCustomerRow(createdRow);
  }

  /**
   * Busca cliente por ID com dependentes e convênio vinculado.
   */
  getCustomerById(id: number): CustomerWithDependents | null {
    const row = this.db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as CustomerRow | undefined;
    if (!row) {
      return null;
    }

    const customer = mapCustomerRow(row);
    const dependentsRows = this.db
      .prepare('SELECT * FROM customer_dependents WHERE customer_id = ? ORDER BY id ASC')
      .all(id) as DependentRow[];

    const dependents = dependentsRows.map(mapDependentRow);

    let agreement: CorporateAgreement | null = null;
    if (customer.agreementId) {
      const agreementRow = this.db
        .prepare('SELECT * FROM corporate_agreements WHERE id = ?')
        .get(customer.agreementId) as AgreementRow | undefined;

      if (agreementRow) {
        agreement = mapAgreementRow(agreementRow);
      }
    }

    return {
      ...customer,
      dependents,
      agreement,
    };
  }

  /**
   * Busca cliente por CPF (normaliza pontos e traços) com dependentes e convênio vinculado.
   */
  getCustomerByCpf(cpf: string): CustomerWithDependents | null {
    const cleanCpf = normalizeCpf(cpf);
    if (!cleanCpf) {
      return null;
    }

    const row = this.db
      .prepare("SELECT * FROM customers WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = ?")
      .get(cleanCpf) as CustomerRow | undefined;

    if (!row) {
      return null;
    }

    return this.getCustomerById(Number(row.id));
  }

  /**
   * Busca paginada de clientes com filtros por search (nome/CPF), agreementId, status e storeId.
   */
  listCustomers(filters?: CustomerFilters): { customers: Customer[]; total: number } {
    const whereClauses: string[] = ['1 = 1'];
    const params: any[] = [];

    if (filters?.search) {
      const search = filters.search.trim();
      const cleanSearch = normalizeCpf(search);

      if (cleanSearch.length > 0) {
        whereClauses.push(
          "(name LIKE ? OR REPLACE(REPLACE(cpf, '.', ''), '-', '') LIKE ?)"
        );
        params.push(`%${search}%`, `%${cleanSearch}%`);
      } else {
        whereClauses.push('name LIKE ?');
        params.push(`%${search}%`);
      }
    }

    if (filters?.agreementId !== undefined && filters.agreementId !== null) {
      whereClauses.push('agreement_id = ?');
      params.push(filters.agreementId);
    }

    if (filters?.status) {
      whereClauses.push('status = ?');
      params.push(filters.status);
    }

    if (filters?.storeId !== undefined && filters.storeId !== null) {
      whereClauses.push('store_id = ?');
      params.push(filters.storeId);
    }

    const whereSql = whereClauses.join(' AND ');

    // Contagem total
    const countRow = this.db
      .prepare(`SELECT COUNT(*) AS total FROM customers WHERE ${whereSql}`)
      .get(...params) as { total: number };
    const total = Number(countRow.total);

    // Paginação
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.max(1, filters?.limit ?? 20);
    const offset = (page - 1) * limit;

    const listSql = `
      SELECT * FROM customers
      WHERE ${whereSql}
      ORDER BY name ASC, id ASC
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.prepare(listSql).all(...params, limit, offset) as CustomerRow[];
    const customers = rows.map(mapCustomerRow);

    return {
      customers,
      total,
    };
  }

  /**
   * Atualização parcial dos dados do cliente.
   */
  updateCustomer(id: number, input: UpdateCustomerInput): Customer {
    const existing = this.db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as CustomerRow | undefined;
    if (!existing) {
      throw new CustomerCreditError('CUSTOMER_NOT_FOUND', `Cliente com ID ${id} não encontrado.`);
    }

    const setClauses: string[] = [];
    const params: any[] = [];

    // CPF update & validation
    if (input.cpf !== undefined) {
      const cpf = input.cpf.trim();
      if (!isValidCpfFormat(cpf)) {
        throw new CustomerCreditError('INVALID_CPF', 'CPF inválido. Deve conter 11 dígitos numéricos.');
      }
      const cleanCpf = normalizeCpf(cpf);
      const duplicate = this.db
        .prepare("SELECT id FROM customers WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = ? AND id != ?")
        .get(cleanCpf, id);

      if (duplicate) {
        throw new CustomerCreditError('DUPLICATE_CPF', `CPF '${cpf}' já está em uso por outro cliente.`);
      }

      setClauses.push('cpf = ?');
      params.push(cpf);
    }

    // Store update & validation
    const storeId = input.storeId ?? input.store_id;
    if (storeId !== undefined) {
      const store = this.db
        .prepare('SELECT id, is_active FROM stores WHERE id = ?')
        .get(storeId) as { id: number; is_active: number } | undefined;

      if (!store) {
        throw new CustomerCreditError('STORE_NOT_FOUND', `Loja com ID ${storeId} não encontrada.`);
      }
      if (!store.is_active) {
        throw new CustomerCreditError('STORE_INACTIVE', `Loja com ID ${storeId} está inativa.`);
      }

      setClauses.push('store_id = ?');
      params.push(storeId);
    }

    // Agreement update & validation
    const agreementId = input.agreementId !== undefined ? input.agreementId : input.agreement_id;
    if (agreementId !== undefined) {
      if (agreementId !== null) {
        const agreement = this.db
          .prepare('SELECT id, is_active FROM corporate_agreements WHERE id = ?')
          .get(agreementId) as { id: number; is_active: number } | undefined;

        if (!agreement) {
          throw new CustomerCreditError('AGREEMENT_NOT_FOUND', `Convênio com ID ${agreementId} não encontrado.`);
        }
        if (!agreement.is_active) {
          throw new CustomerCreditError('AGREEMENT_INACTIVE', `Convênio com ID ${agreementId} está inativo.`);
        }
      }
      setClauses.push('agreement_id = ?');
      params.push(agreementId);
    }

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new CustomerCreditError('INVALID_NAME', 'Nome não pode ser vazio.');
      }
      setClauses.push('name = ?');
      params.push(name);
    }

    if (input.rg !== undefined) {
      setClauses.push('rg = ?');
      params.push(input.rg ? input.rg.trim() : null);
    }

    if (input.birthDate !== undefined || input.birth_date !== undefined) {
      setClauses.push('birth_date = ?');
      params.push(input.birthDate ?? input.birth_date ?? null);
    }

    if (input.phone !== undefined) {
      setClauses.push('phone = ?');
      params.push(input.phone ? input.phone.trim() : null);
    }

    if (input.email !== undefined) {
      setClauses.push('email = ?');
      params.push(input.email ? input.email.trim() : null);
    }

    if (input.street !== undefined) {
      setClauses.push('street = ?');
      params.push(input.street ? input.street.trim() : null);
    }

    if (input.number !== undefined) {
      setClauses.push('number = ?');
      params.push(input.number ? input.number.trim() : null);
    }

    if (input.neighborhood !== undefined) {
      setClauses.push('neighborhood = ?');
      params.push(input.neighborhood ? input.neighborhood.trim() : null);
    }

    if (input.city !== undefined) {
      setClauses.push('city = ?');
      params.push(input.city ? input.city.trim() : null);
    }

    if (input.state !== undefined) {
      setClauses.push('state = ?');
      params.push(input.state ? input.state.trim() : null);
    }

    if (input.zipCode !== undefined || input.zip_code !== undefined) {
      setClauses.push('zip_code = ?');
      params.push(input.zipCode ?? input.zip_code ?? null);
    }

    if (input.registrationNumber !== undefined || input.registration_number !== undefined) {
      setClauses.push('registration_number = ?');
      params.push(input.registrationNumber ?? input.registration_number ?? null);
    }

    if (input.department !== undefined) {
      setClauses.push('department = ?');
      params.push(input.department ? input.department.trim() : null);
    }

    if (input.creditLimit !== undefined || input.credit_limit !== undefined) {
      setClauses.push('credit_limit = ?');
      params.push(Number(input.creditLimit ?? input.credit_limit));
    }

    if (input.currentDebt !== undefined || input.current_debt !== undefined) {
      setClauses.push('current_debt = ?');
      params.push(Number(input.currentDebt ?? input.current_debt));
    }

    if (input.status !== undefined) {
      setClauses.push('status = ?');
      params.push(input.status);
    }

    if (input.allowDependents !== undefined || input.allow_dependents !== undefined) {
      const allow =
        input.allowDependents !== undefined
          ? input.allowDependents ? 1 : 0
          : input.allow_dependents ? 1 : 0;
      setClauses.push('allow_dependents = ?');
      params.push(allow);
    }

    if (input.notes !== undefined) {
      setClauses.push('notes = ?');
      params.push(input.notes ? input.notes.trim() : null);
    }

    if (setClauses.length > 0) {
      setClauses.push('updated_at = CURRENT_TIMESTAMP');
      const updateSql = `UPDATE customers SET ${setClauses.join(', ')} WHERE id = ?`;
      params.push(id);
      this.db.prepare(updateSql).run(...params);
    }

    const updatedRow = this.db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as CustomerRow;
    return mapCustomerRow(updatedRow);
  }

  /**
   * Adiciona um dependente vinculado ao titular com validações de allowDependents e formato de CPF.
   */
  addDependent(customerId: number, input: CreateDependentInput): CustomerDependent {
    const customer = this.db
      .prepare('SELECT id, allow_dependents FROM customers WHERE id = ?')
      .get(customerId) as { id: number; allow_dependents: number } | undefined;

    if (!customer) {
      throw new CustomerCreditError('CUSTOMER_NOT_FOUND', `Cliente com ID ${customerId} não encontrado.`);
    }

    if (!customer.allow_dependents) {
      throw new CustomerCreditError('DEPENDENTS_NOT_ALLOWED', 'Titular não permite dependentes cadastrados.');
    }

    const name = (input.name ?? '').trim();
    if (!name) {
      throw new CustomerCreditError('INVALID_NAME', 'Nome do dependente é obrigatório.');
    }

    const cpf = (input.cpf ?? '').trim();
    if (!isValidCpfFormat(cpf)) {
      throw new CustomerCreditError('INVALID_CPF', 'CPF do dependente inválido. Deve conter 11 dígitos.');
    }

    const relationship = input.relationship ?? 'OUTRO';
    const isActive =
      input.isActive !== undefined
        ? input.isActive ? 1 : 0
        : input.is_active !== undefined
          ? input.is_active ? 1 : 0
          : 1;

    const result = this.db.prepare(`
      INSERT INTO customer_dependents (customer_id, name, cpf, relationship, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(customerId, name, cpf, relationship, isActive);

    const insertedId = Number(result.lastInsertRowid);
    const row = this.db.prepare('SELECT * FROM customer_dependents WHERE id = ?').get(insertedId) as DependentRow;
    return mapDependentRow(row);
  }

  /**
   * Remove dependente por ID.
   */
  removeDependent(dependentId: number): void {
    const dep = this.db.prepare('SELECT id FROM customer_dependents WHERE id = ?').get(dependentId);
    if (!dep) {
      throw new CustomerCreditError('DEPENDENT_NOT_FOUND', `Dependente com ID ${dependentId} não encontrado.`);
    }

    this.db.prepare('DELETE FROM customer_dependents WHERE id = ?').run(dependentId);
  }

  /**
   * Verifica a elegibilidade para compras no Crediário Próprio ou Convênio.
   * Valida status, inadimplência (> 5 dias), permissão/autorização de dependente e limite disponível.
   */
  checkCreditEligibility(
    customerId: number,
    purchaseAmount: number,
    buyerCpf?: string
  ): CreditEligibilityResult {
    const customer = this.getCustomerById(customerId);
    if (!customer) {
      throw new CustomerCreditError('CUSTOMER_NOT_FOUND', `Cliente com ID ${customerId} não encontrado.`);
    }

    const availableLimit = customer.creditLimit - customer.currentDebt;

    // 1. Cliente inativo
    if (customer.status === 'INACTIVE') {
      return {
        isEligible: false,
        customer,
        availableLimit,
        errorCode: 'CUSTOMER_INACTIVE',
        reason: 'Cliente inativo no sistema.',
      };
    }

    // 2. Cliente já bloqueado por inadimplência
    if (customer.status === 'BLOCKED_OVERDUE') {
      return {
        isEligible: false,
        customer,
        availableLimit,
        errorCode: 'CUSTOMER_BLOCKED',
        reason: 'Cliente bloqueado por inadimplência.',
      };
    }

    // 3. Cliente com parcelas vencidas há mais de 5 dias em customer_receivables
    const overdueRow = this.db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM customer_receivables
        WHERE customer_id = ?
          AND status = 'OPEN'
          AND due_date < date('now', '-5 days')
      `)
      .get(customerId) as { count: number };

    if (overdueRow && overdueRow.count > 0) {
      // Atualização atômica do status para BLOCKED_OVERDUE
      this.db.transaction(() => {
        this.db
          .prepare("UPDATE customers SET status = 'BLOCKED_OVERDUE', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .run(customerId);
      })();

      customer.status = 'BLOCKED_OVERDUE';
      customer.updatedAt = new Date().toISOString();

      return {
        isEligible: false,
        customer,
        availableLimit,
        errorCode: 'OVERDUE_DEBTS',
        reason: 'Cliente possui parcelas vencidas há mais de 5 dias.',
      };
    }

    // 4. Verificação de dependente comprador (se buyerCpf fornecido)
    if (buyerCpf) {
      const cleanBuyerCpf = normalizeCpf(buyerCpf);
      const cleanCustomerCpf = normalizeCpf(customer.cpf);

      // Se o comprador não for o próprio titular, validar dependente
      if (cleanBuyerCpf !== cleanCustomerCpf) {
        if (!customer.allowDependents) {
          return {
            isEligible: false,
            customer,
            availableLimit,
            errorCode: 'DEPENDENTS_NOT_ALLOWED',
            reason: 'Titular não autoriza compras por dependentes.',
          };
        }

        const depRow = this.db
          .prepare("SELECT * FROM customer_dependents WHERE customer_id = ? AND REPLACE(REPLACE(cpf, '.', ''), '-', '') = ?")
          .get(customerId, cleanBuyerCpf) as DependentRow | undefined;

        if (!depRow || !depRow.is_active) {
          return {
            isEligible: false,
            customer,
            availableLimit,
            errorCode: 'DEPENDENT_NOT_AUTHORIZED',
            reason: 'Comprador dependente não cadastrado ou inativo.',
          };
        }
      }
    }

    // 5. Verificação de limite de crédito
    if (customer.currentDebt + purchaseAmount > customer.creditLimit) {
      return {
        isEligible: false,
        customer,
        availableLimit,
        errorCode: 'CREDIT_LIMIT_EXCEEDED',
        reason: 'Limite de crédito insuficiente.',
      };
    }

    // Elegível
    return {
      isEligible: true,
      customer,
      availableLimit,
    };
  }
}
