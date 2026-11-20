import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import {
  CustomerCreditService,
  CustomerCreditError,
} from '../../../src/modules/credit/customer-credit.service';
import { AgreementService } from '../../../src/modules/credit/agreement.service';
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateDependentInput,
} from '../../../src/modules/credit/types';

describe('CustomerCreditService (Gestão de Clientes, Dependentes e Limite de Crédito)', () => {
  let db: Database;
  let service: CustomerCreditService;
  let agreementService: AgreementService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new CustomerCreditService(db);
    agreementService = new AgreementService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('createCustomer', () => {
    it('should create a customer with all cadastral and functional fields', () => {
      // Create a test agreement first
      const agreement = agreementService.createAgreement({
        code: 'CONV-EMPRESA1',
        companyName: 'Empresa Teste Ltda',
        tradeName: 'Empresa Teste',
        cnpj: '11.222.333/0001-44',
        street: 'Rua das Flores',
        number: '123',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001-000',
      });

      const input: CreateCustomerInput = {
        storeId: 1,
        agreementId: agreement.id,
        name: 'Maria Souza',
        cpf: '123.456.789-01',
        rg: 'MG-12.345.678',
        birthDate: '1985-05-15',
        phone: '(11) 98765-4321',
        email: 'maria.souza@email.com',
        street: 'Av. Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01310-100',
        registrationNumber: 'FUNC-9988',
        department: 'Engenharia',
        creditLimit: 1500,
        currentDebt: 250,
        status: 'ACTIVE',
        allowDependents: true,
        notes: 'Cliente conveniada preferencial',
      };

      const customer = service.createCustomer(input);

      expect(customer.id).toBeGreaterThan(0);
      expect(customer.storeId).toBe(1);
      expect(customer.agreementId).toBe(agreement.id);
      expect(customer.name).toBe('Maria Souza');
      expect(customer.cpf).toBe('123.456.789-01');
      expect(customer.rg).toBe('MG-12.345.678');
      expect(customer.birthDate).toBe('1985-05-15');
      expect(customer.phone).toBe('(11) 98765-4321');
      expect(customer.email).toBe('maria.souza@email.com');
      expect(customer.street).toBe('Av. Paulista');
      expect(customer.number).toBe('1000');
      expect(customer.neighborhood).toBe('Bela Vista');
      expect(customer.city).toBe('São Paulo');
      expect(customer.state).toBe('SP');
      expect(customer.zipCode).toBe('01310-100');
      expect(customer.registrationNumber).toBe('FUNC-9988');
      expect(customer.department).toBe('Engenharia');
      expect(customer.creditLimit).toBe(1500);
      expect(customer.currentDebt).toBe(250);
      expect(customer.status).toBe('ACTIVE');
      expect(customer.allowDependents).toBe(true);
      expect(customer.notes).toBe('Cliente conveniada preferencial');
      expect(customer.createdAt).toBeDefined();

      // Verify row in database
      const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id) as any;
      expect(row).toBeDefined();
      expect(row.name).toBe('Maria Souza');
      expect(row.cpf).toBe('123.456.789-01');
      expect(row.allow_dependents).toBe(1);
    });

    it('should apply proper defaults when optional fields are omitted', () => {
      const customer = service.createCustomer({
        name: 'Carlos Alberto',
        cpf: '987.654.321-00',
      });

      expect(customer.id).toBeGreaterThan(0);
      expect(customer.storeId).toBe(1); // default store
      expect(customer.agreementId).toBeNull();
      expect(customer.creditLimit).toBe(0);
      expect(customer.currentDebt).toBe(0);
      expect(customer.status).toBe('ACTIVE');
      expect(customer.allowDependents).toBe(true);
    });

    it('should throw DUPLICATE_CPF when CPF already exists (both formatted and unformatted)', () => {
      service.createCustomer({
        name: 'Cliente Original',
        cpf: '111.222.333-44',
      });

      expect(() => {
        service.createCustomer({
          name: 'Cliente Clone Formatado',
          cpf: '111.222.333-44',
        });
      }).toThrowError(CustomerCreditError);

      try {
        service.createCustomer({
          name: 'Cliente Clone Desformatado',
          cpf: '11122233344',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(CustomerCreditError);
        expect((err as CustomerCreditError).code).toBe('DUPLICATE_CPF');
      }
    });

    it('should throw INVALID_CPF when CPF format or length is invalid', () => {
      expect(() => {
        service.createCustomer({
          name: 'CPF Curto',
          cpf: '12345',
        });
      }).toThrowError(CustomerCreditError);

      try {
        service.createCustomer({
          name: 'CPF Letras',
          cpf: 'ABC.DEF.GHI-JK',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(CustomerCreditError);
        expect((err as CustomerCreditError).code).toBe('INVALID_CPF');
      }
    });

    it('should throw STORE_NOT_FOUND when storeId does not exist', () => {
      expect(() => {
        service.createCustomer({
          name: 'Sem Loja',
          cpf: '222.333.444-55',
          storeId: 9999,
        });
      }).toThrowError(CustomerCreditError);

      try {
        service.createCustomer({
          name: 'Sem Loja',
          cpf: '222.333.444-55',
          storeId: 9999,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(CustomerCreditError);
        expect((err as CustomerCreditError).code).toBe('STORE_NOT_FOUND');
      }
    });

    it('should throw STORE_INACTIVE when store is inactive', () => {
      // Insert inactive store
      db.prepare(`
        INSERT INTO stores (id, code, name, company_name, cnpj, ie, street, number, neighborhood, city, state, zip_code, ibge_code, is_active)
        VALUES (2, 'LJ02', 'Filial Fechada', 'Filial Ltda', '99.888.777/0002-11', '987654321', 'Rua X', '1', 'Bairro', 'SP', 'SP', '01001-000', '3550308', 0)
      `).run();

      expect(() => {
        service.createCustomer({
          name: 'Cliente Loja Inativa',
          cpf: '333.444.555-66',
          storeId: 2,
        });
      }).toThrowError(CustomerCreditError);

      try {
        service.createCustomer({
          name: 'Cliente Loja Inativa',
          cpf: '333.444.555-66',
          storeId: 2,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(CustomerCreditError);
        expect((err as CustomerCreditError).code).toBe('STORE_INACTIVE');
      }
    });
  });

  describe('getCustomerById and getCustomerByCpf', () => {
    it('should retrieve customer with dependents and agreement details', () => {
      const agreement = agreementService.createAgreement({
        code: 'CONV-XYZ',
        companyName: 'XYZ Tecnologia',
        tradeName: 'XYZ Tech',
        cnpj: '33.444.555/0001-66',
        street: 'Rua A',
        number: '10',
        neighborhood: 'Centro',
        city: 'Campinas',
        state: 'SP',
        zipCode: '13010-000',
      });

      const customer = service.createCustomer({
        name: 'Roberto Firmino',
        cpf: '444.555.666-77',
        agreementId: agreement.id,
        creditLimit: 2000,
      });

      // Add two dependents
      service.addDependent(customer.id, {
        name: 'Larissa Firmino',
        cpf: '555.666.777-88',
        relationship: 'CONJUGE',
      });

      service.addDependent(customer.id, {
        name: 'Enzo Firmino',
        cpf: '666.777.888-99',
        relationship: 'FILHO(A)',
      });

      // Query by ID
      const byId = service.getCustomerById(customer.id);
      expect(byId).not.toBeNull();
      expect(byId!.id).toBe(customer.id);
      expect(byId!.name).toBe('Roberto Firmino');
      expect(byId!.dependents).toHaveLength(2);
      expect(byId!.dependents[0].name).toBe('Larissa Firmino');
      expect(byId!.dependents[0].relationship).toBe('CONJUGE');
      expect(byId!.dependents[1].name).toBe('Enzo Firmino');
      expect(byId!.dependents[1].relationship).toBe('FILHO(A)');
      expect(byId!.agreement).toBeDefined();
      expect(byId!.agreement!.companyName).toBe('XYZ Tecnologia');

      // Query by CPF (normalized with points/dashes)
      const byCpfFormatted = service.getCustomerByCpf('444.555.666-77');
      expect(byCpfFormatted).not.toBeNull();
      expect(byCpfFormatted!.id).toBe(customer.id);
      expect(byCpfFormatted!.dependents).toHaveLength(2);

      // Query by CPF (unformatted digits only)
      const byCpfRaw = service.getCustomerByCpf('44455566677');
      expect(byCpfRaw).not.toBeNull();
      expect(byCpfRaw!.id).toBe(customer.id);
      expect(byCpfRaw!.dependents).toHaveLength(2);
    });

    it('should return null when customer is not found', () => {
      expect(service.getCustomerById(9999)).toBeNull();
      expect(service.getCustomerByCpf('000.000.000-00')).toBeNull();
      expect(service.getCustomerByCpf('00000000000')).toBeNull();
    });
  });

  describe('listCustomers', () => {
    beforeEach(() => {
      // Seed 3 customers
      service.createCustomer({
        name: 'Ana Carolina Dias',
        cpf: '101.202.303-40',
        status: 'ACTIVE',
        storeId: 1,
      });

      service.createCustomer({
        name: 'Bruno Carvalho',
        cpf: '202.303.404-50',
        status: 'BLOCKED_OVERDUE',
        storeId: 1,
      });

      service.createCustomer({
        name: 'Carla Dias Moreira',
        cpf: '303.404.505-60',
        status: 'INACTIVE',
        storeId: 1,
      });
    });

    it('should list customers with pagination', () => {
      const result = service.listCustomers({ page: 1, limit: 2 });
      expect(result.total).toBe(3);
      expect(result.customers).toHaveLength(2);

      const page2 = service.listCustomers({ page: 2, limit: 2 });
      expect(page2.total).toBe(3);
      expect(page2.customers).toHaveLength(1);
    });

    it('should filter customers by search (name)', () => {
      const result = service.listCustomers({ search: 'Dias' });
      expect(result.total).toBe(2);
      expect(result.customers.map((c) => c.name)).toContain('Ana Carolina Dias');
      expect(result.customers.map((c) => c.name)).toContain('Carla Dias Moreira');
    });

    it('should filter customers by search (CPF formatted or unformatted)', () => {
      const result1 = service.listCustomers({ search: '202.303.404-50' });
      expect(result1.total).toBe(1);
      expect(result1.customers[0].name).toBe('Bruno Carvalho');

      const result2 = service.listCustomers({ search: '20230340450' });
      expect(result2.total).toBe(1);
      expect(result2.customers[0].name).toBe('Bruno Carvalho');
    });

    it('should filter customers by status', () => {
      const active = service.listCustomers({ status: 'ACTIVE' });
      expect(active.total).toBe(1);
      expect(active.customers[0].name).toBe('Ana Carolina Dias');

      const blocked = service.listCustomers({ status: 'BLOCKED_OVERDUE' });
      expect(blocked.total).toBe(1);
      expect(blocked.customers[0].name).toBe('Bruno Carvalho');
    });
  });

  describe('updateCustomer', () => {
    it('should partially update customer details including limits and status', () => {
      const customer = service.createCustomer({
        name: 'Juliana Paes',
        cpf: '505.606.707-80',
        creditLimit: 500,
        status: 'ACTIVE',
      });

      const updated = service.updateCustomer(customer.id, {
        name: 'Juliana Paes Silva',
        creditLimit: 1200,
        status: 'BLOCKED_OVERDUE',
        notes: 'Limite alterado pela gerência',
      });

      expect(updated.id).toBe(customer.id);
      expect(updated.name).toBe('Juliana Paes Silva');
      expect(updated.creditLimit).toBe(1200);
      expect(updated.status).toBe('BLOCKED_OVERDUE');
      expect(updated.notes).toBe('Limite alterado pela gerência');

      const reloaded = service.getCustomerById(customer.id);
      expect(reloaded!.name).toBe('Juliana Paes Silva');
      expect(reloaded!.creditLimit).toBe(1200);
      expect(reloaded!.status).toBe('BLOCKED_OVERDUE');
    });

    it('should throw CUSTOMER_NOT_FOUND when updating non-existent customer', () => {
      expect(() => {
        service.updateCustomer(9999, { name: 'Ninguém' });
      }).toThrowError(CustomerCreditError);

      try {
        service.updateCustomer(9999, { name: 'Ninguém' });
      } catch (err) {
        expect(err).toBeInstanceOf(CustomerCreditError);
        expect((err as CustomerCreditError).code).toBe('CUSTOMER_NOT_FOUND');
      }
    });

    it('should throw DUPLICATE_CPF when updating customer to another customer CPF', () => {
      service.createCustomer({
        name: 'Cliente 1',
        cpf: '707.808.909-01',
      });

      const cust2 = service.createCustomer({
        name: 'Cliente 2',
        cpf: '808.909.010-12',
      });

      expect(() => {
        service.updateCustomer(cust2.id, {
          cpf: '707.808.909-01',
        });
      }).toThrowError(CustomerCreditError);

      try {
        service.updateCustomer(cust2.id, {
          cpf: '707.808.909-01',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(CustomerCreditError);
        expect((err as CustomerCreditError).code).toBe('DUPLICATE_CPF');
      }
    });

    it('should allow customer to keep their own CPF during update', () => {
      const cust = service.createCustomer({
        name: 'Cliente Próprio',
        cpf: '909.010.121-23',
      });

      const updated = service.updateCustomer(cust.id, {
        cpf: '909.010.121-23',
        name: 'Cliente Próprio Atualizado',
      });

      expect(updated.name).toBe('Cliente Próprio Atualizado');
      expect(updated.cpf).toBe('909.010.121-23');
    });
  });

  describe('addDependent and removeDependent', () => {
    it('should add dependent linked to titular customer', () => {
      const customer = service.createCustomer({
        name: 'Fabio Santos',
        cpf: '121.232.343-45',
        allowDependents: true,
      });

      const depInput: CreateDependentInput = {
        name: 'Lucas Santos',
        cpf: '232.343.454-56',
        relationship: 'FILHO(A)',
        isActive: true,
      };

      const dep = service.addDependent(customer.id, depInput);

      expect(dep.id).toBeGreaterThan(0);
      expect(dep.customerId).toBe(customer.id);
      expect(dep.name).toBe('Lucas Santos');
      expect(dep.cpf).toBe('232.343.454-56');
      expect(dep.relationship).toBe('FILHO(A)');
      expect(dep.isActive).toBe(true);

      const withDeps = service.getCustomerById(customer.id);
      expect(withDeps!.dependents).toHaveLength(1);
      expect(withDeps!.dependents[0].name).toBe('Lucas Santos');
    });

    it('should throw DEPENDENTS_NOT_ALLOWED when customer has allowDependents = false', () => {
      const customer = service.createCustomer({
        name: 'Marcos Vinicius',
        cpf: '343.454.565-67',
        allowDependents: false,
      });

      expect(() => {
        service.addDependent(customer.id, {
          name: 'Filho Bloqueado',
          cpf: '454.565.676-78',
        });
      }).toThrowError(CustomerCreditError);

      try {
        service.addDependent(customer.id, {
          name: 'Filho Bloqueado',
          cpf: '454.565.676-78',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(CustomerCreditError);
        expect((err as CustomerCreditError).code).toBe('DEPENDENTS_NOT_ALLOWED');
      }
    });

    it('should throw INVALID_CPF if dependent CPF format is invalid', () => {
      const customer = service.createCustomer({
        name: 'Marcos Silva',
        cpf: '454.565.676-79',
        allowDependents: true,
      });

      expect(() => {
        service.addDependent(customer.id, {
          name: 'Dependente CPF Ruim',
          cpf: '123',
        });
      }).toThrowError(CustomerCreditError);

      try {
        service.addDependent(customer.id, {
          name: 'Dependente CPF Ruim',
          cpf: '123',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(CustomerCreditError);
        expect((err as CustomerCreditError).code).toBe('INVALID_CPF');
      }
    });

    it('should remove dependent by id', () => {
      const customer = service.createCustomer({
        name: 'Rodrigo Caio',
        cpf: '565.676.787-89',
        allowDependents: true,
      });

      const dep = service.addDependent(customer.id, {
        name: 'Mariana Caio',
        cpf: '676.787.898-90',
      });

      expect(service.getCustomerById(customer.id)!.dependents).toHaveLength(1);

      service.removeDependent(dep.id);

      expect(service.getCustomerById(customer.id)!.dependents).toHaveLength(0);
    });

    it('should throw DEPENDENT_NOT_FOUND when removing non-existent dependent', () => {
      expect(() => {
        service.removeDependent(9999);
      }).toThrowError(CustomerCreditError);

      try {
        service.removeDependent(9999);
      } catch (err) {
        expect(err).toBeInstanceOf(CustomerCreditError);
        expect((err as CustomerCreditError).code).toBe('DEPENDENT_NOT_FOUND');
      }
    });
  });

  describe('checkCreditEligibility', () => {
    it('should return isEligible: true when customer is active and limit is sufficient', () => {
      const customer = service.createCustomer({
        name: 'Diego Souza',
        cpf: '787.898.909-01',
        creditLimit: 1000,
        currentDebt: 300,
        status: 'ACTIVE',
      });

      const result = service.checkCreditEligibility(customer.id, 200);

      expect(result.isEligible).toBe(true);
      expect(result.availableLimit).toBe(700);
      expect(result.customer.id).toBe(customer.id);
      expect(result.errorCode).toBeUndefined();
    });

    it('should return isEligible: false with CUSTOMER_INACTIVE when customer status is INACTIVE', () => {
      const customer = service.createCustomer({
        name: 'Inativo da Silva',
        cpf: '898.909.010-12',
        creditLimit: 1000,
        status: 'INACTIVE',
      });

      const result = service.checkCreditEligibility(customer.id, 50);

      expect(result.isEligible).toBe(false);
      expect(result.errorCode).toBe('CUSTOMER_INACTIVE');
    });

    it('should return isEligible: false with CUSTOMER_BLOCKED when customer is already BLOCKED_OVERDUE', () => {
      const customer = service.createCustomer({
        name: 'Bloqueado Previamente',
        cpf: '909.010.121-23',
        creditLimit: 1000,
        status: 'BLOCKED_OVERDUE',
      });

      const result = service.checkCreditEligibility(customer.id, 50);

      expect(result.isEligible).toBe(false);
      expect(result.errorCode).toBe('CUSTOMER_BLOCKED');
    });

    it('should atomically update status to BLOCKED_OVERDUE and return OVERDUE_DEBTS when installments overdue > 5 days exist', () => {
      const customer = service.createCustomer({
        name: 'Devedor Atrasado',
        cpf: '010.121.232-34',
        creditLimit: 1000,
        currentDebt: 200,
        status: 'ACTIVE',
      });

      // Insert an open receivable overdue by 6 days
      db.prepare(`
        INSERT INTO customer_receivables (
          customer_id, installment_number, total_installments,
          due_date, original_amount, status
        ) VALUES (?, 1, 1, date('now', '-6 days'), 200, 'OPEN')
      `).run(customer.id);

      const result = service.checkCreditEligibility(customer.id, 50);

      expect(result.isEligible).toBe(false);
      expect(result.errorCode).toBe('OVERDUE_DEBTS');

      // Verify that database customer record was atomically changed to BLOCKED_OVERDUE
      const row = db.prepare('SELECT status FROM customers WHERE id = ?').get(customer.id) as any;
      expect(row.status).toBe('BLOCKED_OVERDUE');
    });

    it('should return isEligible: false with CREDIT_LIMIT_EXCEEDED when currentDebt + purchaseAmount > creditLimit', () => {
      const customer = service.createCustomer({
        name: 'Sem Limite',
        cpf: '121.232.343-56',
        creditLimit: 500,
        currentDebt: 400,
        status: 'ACTIVE',
      });

      // 400 + 150 = 550 > 500
      const result = service.checkCreditEligibility(customer.id, 150);

      expect(result.isEligible).toBe(false);
      expect(result.errorCode).toBe('CREDIT_LIMIT_EXCEEDED');
      expect(result.availableLimit).toBe(100);
    });

    it('should return isEligible: true when buyerCpf belongs to an authorized active dependent', () => {
      const customer = service.createCustomer({
        name: 'Titular Familia',
        cpf: '232.343.454-67',
        creditLimit: 1000,
        currentDebt: 100,
        status: 'ACTIVE',
        allowDependents: true,
      });

      service.addDependent(customer.id, {
        name: 'Esposa Autorizada',
        cpf: '343.454.565-78',
        relationship: 'CONJUGE',
        isActive: true,
      });

      const result = service.checkCreditEligibility(customer.id, 200, '343.454.565-78');

      expect(result.isEligible).toBe(true);
      expect(result.availableLimit).toBe(900);
    });

    it('should return isEligible: false with DEPENDENT_NOT_AUTHORIZED when buyer is not a registered dependent', () => {
      const customer = service.createCustomer({
        name: 'Titular Cauteloso',
        cpf: '454.565.676-89',
        creditLimit: 1000,
        status: 'ACTIVE',
        allowDependents: true,
      });

      const result = service.checkCreditEligibility(customer.id, 100, '999.888.777-66');

      expect(result.isEligible).toBe(false);
      expect(result.errorCode).toBe('DEPENDENT_NOT_AUTHORIZED');
    });

    it('should return isEligible: false with DEPENDENT_NOT_AUTHORIZED when dependent is marked isActive = false', () => {
      const customer = service.createCustomer({
        name: 'Titular Ex-Esposo',
        cpf: '565.676.787-90',
        creditLimit: 1000,
        status: 'ACTIVE',
        allowDependents: true,
      });

      service.addDependent(customer.id, {
        name: 'Ex-Conjuge',
        cpf: '676.787.898-01',
        relationship: 'CONJUGE',
        isActive: false,
      });

      const result = service.checkCreditEligibility(customer.id, 100, '676.787.898-01');

      expect(result.isEligible).toBe(false);
      expect(result.errorCode).toBe('DEPENDENT_NOT_AUTHORIZED');
    });

    it('should return isEligible: false with DEPENDENTS_NOT_ALLOWED when titular does not allow dependents', () => {
      const customer = service.createCustomer({
        name: 'Titular Solteiro',
        cpf: '787.898.909-12',
        creditLimit: 1000,
        status: 'ACTIVE',
        allowDependents: false,
      });

      const result = service.checkCreditEligibility(customer.id, 100, '898.909.010-23');

      expect(result.isEligible).toBe(false);
      expect(result.errorCode).toBe('DEPENDENTS_NOT_ALLOWED');
    });

    it('should allow titular themselves to purchase when buyerCpf matches customer CPF even if allowDependents is false', () => {
      const customer = service.createCustomer({
        name: 'Titular Comprando',
        cpf: '898.909.010-23',
        creditLimit: 1000,
        currentDebt: 0,
        status: 'ACTIVE',
        allowDependents: false,
      });

      const result = service.checkCreditEligibility(customer.id, 100, '898.909.010-23');

      expect(result.isEligible).toBe(true);
      expect(result.availableLimit).toBe(1000);
    });
  });
});
