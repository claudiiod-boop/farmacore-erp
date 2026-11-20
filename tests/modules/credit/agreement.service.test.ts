import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { AgreementService } from '../../../src/modules/credit/agreement.service';
import type {
  CreateAgreementInput,
  UpdateAgreementInput,
  GenerateInvoiceParams,
} from '../../../src/modules/credit/types';

describe('AgreementService (Gestão de Empresas Conveniadas e Faturamento de RH)', () => {
  let db: Database;
  let service: AgreementService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new AgreementService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('createAgreement', () => {
    it('should create an agreement with all fields provided', () => {
      const input: CreateAgreementInput = {
        code: 'CONV-TECH',
        companyName: 'Tech Solutions Ltda',
        tradeName: 'Tech Solutions',
        cnpj: '12.345.678/0001-90',
        ie: '123456789',
        phone: '(11) 98765-4321',
        email: 'rh@techsolutions.com.br',
        contactName: 'Carlos RH',
        street: 'Av. Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01310-100',
        closingDay: 25,
        dueDay: 10,
        creditLimit: 50000,
        discountPercent: 5.5,
        isActive: true,
      };

      const agreement = service.createAgreement(input);

      expect(agreement.id).toBeGreaterThan(0);
      expect(agreement.code).toBe('CONV-TECH');
      expect(agreement.companyName).toBe('Tech Solutions Ltda');
      expect(agreement.tradeName).toBe('Tech Solutions');
      expect(agreement.cnpj).toBe('12.345.678/0001-90');
      expect(agreement.ie).toBe('123456789');
      expect(agreement.phone).toBe('(11) 98765-4321');
      expect(agreement.email).toBe('rh@techsolutions.com.br');
      expect(agreement.contactName).toBe('Carlos RH');
      expect(agreement.street).toBe('Av. Paulista');
      expect(agreement.closingDay).toBe(25);
      expect(agreement.dueDay).toBe(10);
      expect(agreement.creditLimit).toBe(50000);
      expect(agreement.discountPercent).toBe(5.5);
      expect(agreement.isActive).toBe(true);

      // Verify DB row
      const row = db.prepare('SELECT * FROM corporate_agreements WHERE id = ?').get(agreement.id) as any;
      expect(row.code).toBe('CONV-TECH');
      expect(row.is_active).toBe(1);
    });

    it('should create an agreement with default values when optional parameters are omitted', () => {
      const input: CreateAgreementInput = {
        code: 'CONV-PADRAO',
        companyName: 'Empresa Padrão S.A.',
        tradeName: 'Padrão Corp',
        cnpj: '99.888.777/0001-11',
        street: 'Rua Principal',
        number: '50',
        neighborhood: 'Centro',
        city: 'Curitiba',
        state: 'PR',
        zipCode: '80000-000',
      };

      const agreement = service.createAgreement(input);

      expect(agreement.id).toBeDefined();
      expect(agreement.closingDay).toBe(20);
      expect(agreement.dueDay).toBe(5);
      expect(agreement.creditLimit).toBe(0);
      expect(agreement.discountPercent).toBe(0);
      expect(agreement.isActive).toBe(true);
    });

    it('should throw DUPLICATE_CODE error when code already exists', () => {
      const input: CreateAgreementInput = {
        code: 'CONV-DUP',
        companyName: 'Empresa 1',
        tradeName: 'Empresa 1',
        cnpj: '11.111.111/0001-11',
        street: 'Rua 1',
        number: '1',
        neighborhood: 'Bairro',
        city: 'Cidade',
        state: 'SP',
        zipCode: '00000-000',
      };
      service.createAgreement(input);

      expect(() => {
        service.createAgreement({
          ...input,
          cnpj: '22.222.222/0001-22',
        });
      }).toThrow(/DUPLICATE_CODE/);
    });

    it('should throw DUPLICATE_CNPJ error when CNPJ already exists', () => {
      const input: CreateAgreementInput = {
        code: 'CONV-01',
        companyName: 'Empresa Alpha',
        tradeName: 'Alpha',
        cnpj: '33.333.333/0001-33',
        street: 'Rua Alpha',
        number: '10',
        neighborhood: 'Bairro',
        city: 'Cidade',
        state: 'SP',
        zipCode: '00000-000',
      };
      service.createAgreement(input);

      expect(() => {
        service.createAgreement({
          ...input,
          code: 'CONV-02',
        });
      }).toThrow(/DUPLICATE_CNPJ/);
    });
  });

  describe('getAgreementById', () => {
    it('should return agreement by id when found', () => {
      const created = service.createAgreement({
        code: 'CONV-FIND',
        companyName: 'Empresa Encontrar',
        tradeName: 'Encontrar',
        cnpj: '44.444.444/0001-44',
        street: 'Rua Teste',
        number: '123',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01000-000',
      });

      const found = service.getAgreementById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.companyName).toBe('Empresa Encontrar');
      expect(found?.company_name).toBe('Empresa Encontrar');
    });

    it('should return null when agreement does not exist', () => {
      const found = service.getAgreementById(999999);
      expect(found).toBeNull();
    });
  });

  describe('listAgreements', () => {
    beforeEach(() => {
      service.createAgreement({
        code: 'CONV-ACT-1',
        companyName: 'Ativa 1',
        tradeName: 'Ativa 1',
        cnpj: '55.555.555/0001-55',
        street: 'Rua 1',
        number: '1',
        neighborhood: 'B',
        city: 'C',
        state: 'SP',
        zipCode: '00000-000',
        isActive: true,
      });

      service.createAgreement({
        code: 'CONV-INACT',
        companyName: 'Inativa 1',
        tradeName: 'Inativa 1',
        cnpj: '66.666.666/0001-66',
        street: 'Rua 2',
        number: '2',
        neighborhood: 'B',
        city: 'C',
        state: 'SP',
        zipCode: '00000-000',
        isActive: false,
      });

      service.createAgreement({
        code: 'CONV-ACT-2',
        companyName: 'Ativa 2',
        tradeName: 'Ativa 2',
        cnpj: '77.777.777/0001-77',
        street: 'Rua 3',
        number: '3',
        neighborhood: 'B',
        city: 'C',
        state: 'SP',
        zipCode: '00000-000',
        isActive: true,
      });
    });

    it('should list all agreements when no filter is provided', () => {
      const all = service.listAgreements();
      expect(all.length).toBe(3);
    });

    it('should filter only active agreements when activeOnly: true', () => {
      const active = service.listAgreements({ activeOnly: true });
      expect(active.length).toBe(2);
      expect(active.every((a) => a.isActive)).toBe(true);
      expect(active.some((a) => a.code === 'CONV-INACT')).toBe(false);
    });
  });

  describe('updateAgreement', () => {
    it('should partially update agreement cadastral and financial fields', () => {
      const created = service.createAgreement({
        code: 'CONV-UPD',
        companyName: 'Antes do Update',
        tradeName: 'Antes',
        cnpj: '88.888.888/0001-88',
        street: 'Rua Velha',
        number: '10',
        neighborhood: 'Bairro Velho',
        city: 'Cidade Velha',
        state: 'SP',
        zipCode: '00000-000',
        creditLimit: 1000,
        discountPercent: 2,
        closingDay: 15,
        dueDay: 5,
      });

      const updated = service.updateAgreement(created.id, {
        companyName: 'Depois do Update Ltda',
        tradeName: 'Depois Corp',
        creditLimit: 25000,
        discountPercent: 8,
        closingDay: 28,
        dueDay: 10,
        phone: '(11) 99999-8888',
        isActive: false,
      });

      expect(updated.id).toBe(created.id);
      expect(updated.companyName).toBe('Depois do Update Ltda');
      expect(updated.tradeName).toBe('Depois Corp');
      expect(updated.creditLimit).toBe(25000);
      expect(updated.discountPercent).toBe(8);
      expect(updated.closingDay).toBe(28);
      expect(updated.dueDay).toBe(10);
      expect(updated.phone).toBe('(11) 99999-8888');
      expect(updated.isActive).toBe(false);
      // Unchanged fields remain
      expect(updated.cnpj).toBe('88.888.888/0001-88');
      expect(updated.street).toBe('Rua Velha');
    });

    it('should throw DUPLICATE_CODE when updating to an already taken code', () => {
      service.createAgreement({
        code: 'CODE-EXISTING',
        companyName: 'Existente',
        tradeName: 'Existente',
        cnpj: '10.100.100/0001-01',
        street: 'Rua A',
        number: '1',
        neighborhood: 'B',
        city: 'C',
        state: 'SP',
        zipCode: '00000-000',
      });

      const second = service.createAgreement({
        code: 'CODE-OTHER',
        companyName: 'Outra',
        tradeName: 'Outra',
        cnpj: '20.200.200/0001-02',
        street: 'Rua B',
        number: '2',
        neighborhood: 'B',
        city: 'C',
        state: 'SP',
        zipCode: '00000-000',
      });

      expect(() => {
        service.updateAgreement(second.id, { code: 'CODE-EXISTING' });
      }).toThrow(/DUPLICATE_CODE/);
    });

    it('should throw DUPLICATE_CNPJ when updating to an already taken CNPJ', () => {
      service.createAgreement({
        code: 'CONV-A',
        companyName: 'Empresa A',
        tradeName: 'Empresa A',
        cnpj: '30.300.300/0001-03',
        street: 'Rua A',
        number: '1',
        neighborhood: 'B',
        city: 'C',
        state: 'SP',
        zipCode: '00000-000',
      });

      const second = service.createAgreement({
        code: 'CONV-B',
        companyName: 'Empresa B',
        tradeName: 'Empresa B',
        cnpj: '40.400.400/0001-04',
        street: 'Rua B',
        number: '2',
        neighborhood: 'B',
        city: 'C',
        state: 'SP',
        zipCode: '00000-000',
      });

      expect(() => {
        service.updateAgreement(second.id, { cnpj: '30.300.300/0001-03' });
      }).toThrow(/DUPLICATE_CNPJ/);
    });

    it('should throw error when updating non-existent agreement', () => {
      expect(() => {
        service.updateAgreement(99999, { companyName: 'Não Existe' });
      }).toThrow(/AGREEMENT_NOT_FOUND/);
    });
  });

  describe('generateInvoice', () => {
    let agreementId: number;
    let employee1Id: number;
    let employee2Id: number;

    beforeEach(() => {
      const agr = service.createAgreement({
        code: 'CONV-FATURAMENTO',
        companyName: 'Indústrias Farmacêuticas ABC S.A.',
        tradeName: 'Indústrias ABC',
        cnpj: '50.500.500/0001-50',
        street: 'Rodovia dos Bandeirantes',
        number: 'km 45',
        neighborhood: 'Distrito Industrial',
        city: 'Jundiaí',
        state: 'SP',
        zipCode: '13200-000',
        closingDay: 20,
        dueDay: 5,
        creditLimit: 100000,
        discountPercent: 10,
      });
      agreementId = agr.id;

      // Create employees (customers) linked to agreement
      const emp1Info = db.prepare(
        `INSERT INTO customers (
          store_id, agreement_id, name, cpf, registration_number, department, credit_limit, current_debt, status
        ) VALUES (1, ?, 'João Silva Sauro', '111.222.333-01', 'MATR-001', 'Engenharia', 2000, 350.50, 'ACTIVE')`
      ).run(agreementId);
      employee1Id = Number(emp1Info.lastInsertRowid);

      const emp2Info = db.prepare(
        `INSERT INTO customers (
          store_id, agreement_id, name, cpf, registration_number, department, credit_limit, current_debt, status
        ) VALUES (1, ?, 'Maria Oliveira Costa', '222.333.444-02', 'MATR-002', 'Financeiro', 3000, 120.00, 'ACTIVE')`
      ).run(agreementId);
      employee2Id = Number(emp2Info.lastInsertRowid);

      // Create dummy sales to associate with receivables
      const sale1Info = db.prepare(
        `INSERT INTO sales (total_amount) VALUES (200.0)`
      ).run();
      const sale1Id = Number(sale1Info.lastInsertRowid);

      const sale2Info = db.prepare(
        `INSERT INTO sales (total_amount) VALUES (150.50)`
      ).run();
      const sale2Id = Number(sale2Info.lastInsertRowid);

      const sale3Info = db.prepare(
        `INSERT INTO sales (total_amount) VALUES (120.00)`
      ).run();
      const sale3Id = Number(sale3Info.lastInsertRowid);

      // Insert open receivables within period:
      // Employee 1: 2 receivables (R$ 200.00 + R$ 150.50 = R$ 350.50)
      db.prepare(
        `INSERT INTO customer_receivables (
          customer_id, sale_id, agreement_id, due_date, original_amount, paid_amount, status, created_at
        ) VALUES (?, ?, ?, '2026-11-05', 200.00, 0.0, 'OPEN', '2026-10-25 10:00:00')`
      ).run(employee1Id, sale1Id, agreementId);

      db.prepare(
        `INSERT INTO customer_receivables (
          customer_id, sale_id, agreement_id, due_date, original_amount, paid_amount, status, created_at
        ) VALUES (?, ?, ?, '2026-11-15', 150.50, 0.0, 'OPEN', '2026-11-02 14:30:00')`
      ).run(employee1Id, sale2Id, agreementId);

      // Employee 2: 1 receivable (R$ 120.00)
      db.prepare(
        `INSERT INTO customer_receivables (
          customer_id, sale_id, agreement_id, due_date, original_amount, paid_amount, status, created_at
        ) VALUES (?, ?, ?, '2026-11-18', 120.00, 0.0, 'OPEN', '2026-11-05 09:15:00')`
      ).run(employee2Id, sale3Id, agreementId);

      // Receivables that must NOT be included:
      // 1. Outside period (due 2026-12-25, created 2026-12-01)
      db.prepare(
        `INSERT INTO customer_receivables (
          customer_id, agreement_id, due_date, original_amount, status, created_at
        ) VALUES (?, ?, '2026-12-25', 500.00, 'OPEN', '2026-12-01 10:00:00')`
      ).run(employee1Id, agreementId);

      // 2. Status != 'OPEN' (PAID)
      db.prepare(
        `INSERT INTO customer_receivables (
          customer_id, agreement_id, due_date, original_amount, paid_amount, status, created_at
        ) VALUES (?, ?, '2026-11-10', 80.00, 80.00, 'PAID', '2026-11-01 11:00:00')`
      ).run(employee2Id, agreementId);

      // 3. Different agreement
      const otherAgrInfo = db.prepare(
        `INSERT INTO corporate_agreements (
          code, company_name, trade_name, cnpj, street, number, neighborhood, city, state, zip_code
        ) VALUES ('CONV-OUTRO', 'Outra Empresa', 'Outra', '60.600.600/0001-60', 'Rua X', '1', 'B', 'C', 'SP', '00000-000')`
      ).run();
      const otherAgrId = Number(otherAgrInfo.lastInsertRowid);

      const custOtherInfo = db.prepare(
        `INSERT INTO customers (store_id, agreement_id, name, cpf)
         VALUES (1, ?, 'Funcionario de Outra', '999.888.777-66')`
      ).run(otherAgrId);
      const custOtherId = Number(custOtherInfo.lastInsertRowid);

      db.prepare(
        `INSERT INTO customer_receivables (
          customer_id, agreement_id, due_date, original_amount, status, created_at
        ) VALUES (?, ?, '2026-11-12', 300.00, 'OPEN', '2026-11-01 10:00:00')`
      ).run(custOtherId, otherAgrId);
    });

    it('should generate invoice for the agreement period, updating receivables and returning details', () => {
      const params: GenerateInvoiceParams = {
        startDate: '2026-10-21',
        endDate: '2026-11-20',
        dueDate: '2026-12-05',
        notes: 'Faturamento de convênio Novembro/2026',
      };

      const invoiceWithDetails = service.generateInvoice(agreementId, params);

      // Check invoice fields
      expect(invoiceWithDetails.id).toBeGreaterThan(0);
      expect(invoiceWithDetails.invoiceNumber).toMatch(/^FAT-\d{6}-\d{4}$/);
      expect(invoiceWithDetails.agreementId).toBe(agreementId);
      expect(invoiceWithDetails.periodStart).toBe('2026-10-21');
      expect(invoiceWithDetails.periodEnd).toBe('2026-11-20');
      expect(invoiceWithDetails.dueDate).toBe('2026-12-05');
      expect(invoiceWithDetails.totalAmount).toBe(470.5); // 200.00 + 150.50 + 120.00
      expect(invoiceWithDetails.totalSalesCount).toBe(3);
      expect(invoiceWithDetails.totalEmployeesCount).toBe(2);
      expect(invoiceWithDetails.status).toBe('OPEN');
      expect(invoiceWithDetails.notes).toBe('Faturamento de convênio Novembro/2026');

      // Check agreement details
      expect(invoiceWithDetails.agreement).toBeDefined();
      expect(invoiceWithDetails.agreement.id).toBe(agreementId);
      expect(invoiceWithDetails.agreement.companyName).toBe('Indústrias Farmacêuticas ABC S.A.');

      // Check employee payroll items
      expect(invoiceWithDetails.items).toHaveLength(2);

      const emp1Item = invoiceWithDetails.items.find((i) => i.customerId === employee1Id);
      expect(emp1Item).toBeDefined();
      expect(emp1Item?.customerName).toBe('João Silva Sauro');
      expect(emp1Item?.cpf).toBe('111.222.333-01');
      expect(emp1Item?.registrationNumber).toBe('MATR-001');
      expect(emp1Item?.department).toBe('Engenharia');
      expect(emp1Item?.salesCount).toBe(2);
      expect(emp1Item?.totalAmount).toBe(350.5);
      expect(emp1Item?.receivables).toHaveLength(2);
      expect(emp1Item?.receivables.every((r) => r.invoiceId === invoiceWithDetails.id)).toBe(true);

      const emp2Item = invoiceWithDetails.items.find((i) => i.customerId === employee2Id);
      expect(emp2Item).toBeDefined();
      expect(emp2Item?.customerName).toBe('Maria Oliveira Costa');
      expect(emp2Item?.cpf).toBe('222.333.444-02');
      expect(emp2Item?.registrationNumber).toBe('MATR-002');
      expect(emp2Item?.department).toBe('Financeiro');
      expect(emp2Item?.salesCount).toBe(1);
      expect(emp2Item?.totalAmount).toBe(120.0);
      expect(emp2Item?.receivables).toHaveLength(1);
      expect(emp2Item?.receivables[0].invoiceId).toBe(invoiceWithDetails.id);

      // Verify DB persistence in agreement_invoices
      const invoiceRow = db.prepare('SELECT * FROM agreement_invoices WHERE id = ?').get(invoiceWithDetails.id) as any;
      expect(invoiceRow).toBeDefined();
      expect(invoiceRow.invoice_number).toBe(invoiceWithDetails.invoiceNumber);
      expect(invoiceRow.total_amount).toBe(470.5);
      expect(invoiceRow.total_sales_count).toBe(3);
      expect(invoiceRow.total_employees_count).toBe(2);
      expect(invoiceRow.status).toBe('OPEN');

      // Verify DB customer_receivables were updated with invoice_id
      const linkedReceivables = db.prepare(
        'SELECT id, invoice_id FROM customer_receivables WHERE invoice_id = ?'
      ).all(invoiceWithDetails.id) as any[];
      expect(linkedReceivables).toHaveLength(3);
    });

    it('should throw NO_RECEIVABLES_TO_INVOICE when no open receivables exist in period', () => {
      const params: GenerateInvoiceParams = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        dueDate: '2025-02-05',
      };

      expect(() => {
        service.generateInvoice(agreementId, params);
      }).toThrow(/NO_RECEIVABLES_TO_INVOICE/);
    });

    it('should throw NO_RECEIVABLES_TO_INVOICE on second run because items are already invoiced', () => {
      const params: GenerateInvoiceParams = {
        startDate: '2026-10-21',
        endDate: '2026-11-20',
        dueDate: '2026-12-05',
      };

      // First run succeeds
      service.generateInvoice(agreementId, params);

      // Second run must fail as invoice_id is now populated on all matching receivables
      expect(() => {
        service.generateInvoice(agreementId, params);
      }).toThrow(/NO_RECEIVABLES_TO_INVOICE/);
    });

    it('should generate sequential invoice codes within the same month', () => {
      // Create another customer and receivable for another agreement
      const agr2 = service.createAgreement({
        code: 'CONV-SEQ',
        companyName: 'Segunda Empresa',
        tradeName: 'Segunda',
        cnpj: '70.700.700/0001-70',
        street: 'Rua Seq',
        number: '1',
        neighborhood: 'B',
        city: 'C',
        state: 'SP',
        zipCode: '00000-000',
      });

      const cust2Info = db.prepare(
        `INSERT INTO customers (store_id, agreement_id, name, cpf)
         VALUES (1, ?, 'Funcionario Dois', '333.444.555-66')`
      ).run(agr2.id);

      db.prepare(
        `INSERT INTO customer_receivables (
          customer_id, agreement_id, due_date, original_amount, status, created_at
        ) VALUES (?, ?, '2026-11-10', 100.0, 'OPEN', '2026-11-01 08:00:00')`
      ).run(Number(cust2Info.lastInsertRowid), agr2.id);

      const inv1 = service.generateInvoice(agreementId, {
        startDate: '2026-10-21',
        endDate: '2026-11-20',
        dueDate: '2026-12-05',
      });

      const inv2 = service.generateInvoice(agr2.id, {
        startDate: '2026-10-21',
        endDate: '2026-11-20',
        dueDate: '2026-12-05',
      });

      expect(inv1.invoiceNumber).toBe('FAT-202611-0001');
      expect(inv2.invoiceNumber).toBe('FAT-202611-0002');
    });

    it('should throw AGREEMENT_NOT_FOUND when generating invoice for non-existent agreement', () => {
      expect(() => {
        service.generateInvoice(99999, {
          startDate: '2026-10-21',
          endDate: '2026-11-20',
          dueDate: '2026-12-05',
        });
      }).toThrow(/AGREEMENT_NOT_FOUND/);
    });
  });
});
