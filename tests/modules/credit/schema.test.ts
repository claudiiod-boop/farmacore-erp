import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import type {
  CorporateAgreement,
  Customer,
  CustomerDependent,
  CustomerReceivable,
  AgreementInvoice,
  CreditEligibilityResult,
  CustomerStatus,
  DependentRelationship,
  ReceivableStatus,
  AgreementInvoiceStatus,
} from '../../../src/modules/credit/types';

describe('Schema 010 - Corporate Agreements & Customer Credit Migration', () => {
  let db: Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('should run all migrations including 010 cleanly and create tables and indexes', () => {
    runMigrations(db);

    const tables = db
      .prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('corporate_agreements', 'customers', 'customer_dependents', 'agreement_invoices', 'customer_receivables')"
      )
      .all();

    expect(tables.map((t) => t.name).sort()).toEqual([
      'agreement_invoices',
      'corporate_agreements',
      'customer_dependents',
      'customer_receivables',
      'customers',
    ]);

    const indexes = db
      .prepare<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%credit%' OR name LIKE 'idx_customer%' OR name LIKE 'idx_agreement%'"
      )
      .all();

    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain('idx_customers_cpf');
    expect(indexNames).toContain('idx_customers_agreement');
    expect(indexNames).toContain('idx_customer_receivables_customer');
    expect(indexNames).toContain('idx_customer_receivables_due');
    expect(indexNames).toContain('idx_agreement_invoices_agreement');
  });

  it('should enforce unique constraints on corporate_agreements (code and cnpj)', () => {
    runMigrations(db);

    db.prepare(
      `INSERT INTO corporate_agreements (
        code, company_name, trade_name, cnpj, street, number, neighborhood, city, state, zip_code
      ) VALUES ('CONV01', 'Empresa Alpha Ltda', 'Alpha Corp', '11.222.333/0001-44', 'Rua A', '100', 'Centro', 'São Paulo', 'SP', '01001-000')`
    ).run();

    // Duplicate code should throw
    expect(() => {
      db.prepare(
        `INSERT INTO corporate_agreements (
          code, company_name, trade_name, cnpj, street, number, neighborhood, city, state, zip_code
        ) VALUES ('CONV01', 'Outra Empresa', 'Outra', '22.333.444/0001-55', 'Rua B', '200', 'Bairro', 'São Paulo', 'SP', '01002-000')`
      ).run();
    }).toThrow();

    // Duplicate cnpj should throw
    expect(() => {
      db.prepare(
        `INSERT INTO corporate_agreements (
          code, company_name, trade_name, cnpj, street, number, neighborhood, city, state, zip_code
        ) VALUES ('CONV02', 'Outra Empresa 2', 'Outra 2', '11.222.333/0001-44', 'Rua C', '300', 'Bairro', 'São Paulo', 'SP', '01003-000')`
      ).run();
    }).toThrow();
  });

  it('should enforce default values on corporate_agreements', () => {
    runMigrations(db);

    const info = db.prepare(
      `INSERT INTO corporate_agreements (
        code, company_name, trade_name, cnpj, street, number, neighborhood, city, state, zip_code
      ) VALUES ('CONV_DEF', 'Empresa Padrao', 'Padrao', '99.888.777/0001-66', 'Rua D', '1', 'Centro', 'SP', 'SP', '01000-000')`
    ).run();

    const agreement = db.prepare('SELECT * FROM corporate_agreements WHERE id = ?').get(info.lastInsertRowid) as any;
    expect(agreement.closing_day).toBe(20);
    expect(agreement.due_day).toBe(5);
    expect(agreement.credit_limit).toBe(0.0);
    expect(agreement.discount_percent).toBe(0.0);
    expect(agreement.is_active).toBe(1);
  });

  it('should enforce unique constraint on customers (cpf) and default values', () => {
    runMigrations(db);

    // store 1 exists from migration 008
    const customerInfo = db.prepare(
      `INSERT INTO customers (store_id, name, cpf)
       VALUES (1, 'Joao da Silva', '123.456.789-00')`
    ).run();

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerInfo.lastInsertRowid) as any;
    expect(customer.name).toBe('Joao da Silva');
    expect(customer.credit_limit).toBe(0.0);
    expect(customer.current_debt).toBe(0.0);
    expect(customer.status).toBe('ACTIVE');
    expect(customer.allow_dependents).toBe(1);

    // Duplicate CPF should throw
    expect(() => {
      db.prepare(
        `INSERT INTO customers (store_id, name, cpf)
         VALUES (1, 'Joao Silva Clonado', '123.456.789-00')`
      ).run();
    }).toThrow();
  });

  it('should enforce cascade delete on customer_dependents when customer is deleted', () => {
    runMigrations(db);

    const custInfo = db.prepare(
      `INSERT INTO customers (store_id, name, cpf)
       VALUES (1, 'Maria Oliveira', '234.567.890-11')`
    ).run();
    const customerId = Number(custInfo.lastInsertRowid);

    db.prepare(
      `INSERT INTO customer_dependents (customer_id, name, cpf, relationship)
       VALUES (?, 'Pedro Oliveira', '345.678.901-22', 'FILHO(A)')`
    ).run(customerId);

    db.prepare(
      `INSERT INTO customer_dependents (customer_id, name, cpf, relationship)
       VALUES (?, 'Carlos Oliveira', '456.789.012-33', 'CONJUGE')`
    ).run(customerId);

    let dependents = db.prepare('SELECT * FROM customer_dependents WHERE customer_id = ?').all(customerId);
    expect(dependents.length).toBe(2);

    // Delete customer
    db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);

    dependents = db.prepare('SELECT * FROM customer_dependents WHERE customer_id = ?').all(customerId);
    expect(dependents.length).toBe(0);
  });

  it('should enforce foreign key constraints on customer_receivables', () => {
    runMigrations(db);

    // Attempting to insert receivable for non-existent customer should fail
    expect(() => {
      db.prepare(
        `INSERT INTO customer_receivables (
          customer_id, due_date, original_amount
        ) VALUES (99999, '2026-12-05', 150.0)`
      ).run();
    }).toThrow();

    // Insert valid customer
    const custInfo = db.prepare(
      `INSERT INTO customers (store_id, name, cpf)
       VALUES (1, 'Ana Paula', '567.890.123-44')`
    ).run();
    const customerId = Number(custInfo.lastInsertRowid);

    // Insert valid receivable
    const recInfo = db.prepare(
      `INSERT INTO customer_receivables (
        customer_id, due_date, original_amount
      ) VALUES (?, '2026-12-05', 150.0)`
    ).run(customerId);

    const rec = db.prepare('SELECT * FROM customer_receivables WHERE id = ?').get(recInfo.lastInsertRowid) as any;
    expect(rec.installment_number).toBe(1);
    expect(rec.total_installments).toBe(1);
    expect(rec.paid_amount).toBe(0.0);
    expect(rec.discount_amount).toBe(0.0);
    expect(rec.interest_amount).toBe(0.0);
    expect(rec.status).toBe('OPEN');

    // Trying to delete customer with receivables should be restricted (ON DELETE RESTRICT)
    expect(() => {
      db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
    }).toThrow();
  });

  it('should link receivables to agreement_invoices and set invoice_id to NULL on invoice delete', () => {
    runMigrations(db);

    // Agreement
    const agrInfo = db.prepare(
      `INSERT INTO corporate_agreements (
        code, company_name, trade_name, cnpj, street, number, neighborhood, city, state, zip_code
      ) VALUES ('CONV_INV', 'Empresa Fatura', 'Fatura Corp', '77.888.999/0001-00', 'Rua E', '50', 'Centro', 'SP', 'SP', '01000-000')`
    ).run();
    const agreementId = Number(agrInfo.lastInsertRowid);

    // Customer linked to agreement
    const custInfo = db.prepare(
      `INSERT INTO customers (store_id, agreement_id, name, cpf)
       VALUES (1, ?, 'Funcionario Conveniado', '789.012.345-66')`
    ).run(agreementId);
    const customerId = Number(custInfo.lastInsertRowid);

    // Invoice
    const invInfo = db.prepare(
      `INSERT INTO agreement_invoices (
        invoice_number, agreement_id, period_start, period_end, due_date, total_amount, total_sales_count, total_employees_count
      ) VALUES ('FAT-202611-0001', ?, '2026-10-21', '2026-11-20', '2026-12-05', 250.0, 1, 1)`
    ).run(agreementId);
    const invoiceId = Number(invInfo.lastInsertRowid);

    // Receivable linked to customer, agreement, and invoice
    const recInfo = db.prepare(
      `INSERT INTO customer_receivables (
        customer_id, agreement_id, invoice_id, due_date, original_amount
      ) VALUES (?, ?, ?, '2026-12-05', 250.0)`
    ).run(customerId, agreementId, invoiceId);
    const receivableId = Number(recInfo.lastInsertRowid);

    // Verify invoice linked
    let rec = db.prepare('SELECT * FROM customer_receivables WHERE id = ?').get(receivableId) as any;
    expect(rec.invoice_id).toBe(invoiceId);

    // Delete invoice -> ON DELETE SET NULL should set invoice_id = null
    db.prepare('DELETE FROM agreement_invoices WHERE id = ?').run(invoiceId);

    rec = db.prepare('SELECT * FROM customer_receivables WHERE id = ?').get(receivableId) as any;
    expect(rec.invoice_id).toBeNull();
  });

  it('should validate domain types TypeScript structure', () => {
    const agreement: CorporateAgreement = {
      id: 1,
      code: 'CONV-TEST',
      companyName: 'Test Corp',
      tradeName: 'Test',
      cnpj: '11.111.111/0001-11',
      street: 'Rua Teste',
      number: '123',
      neighborhood: 'Bairro',
      city: 'Cidade',
      state: 'SP',
      zipCode: '12345-678',
      closingDay: 20,
      dueDay: 5,
      creditLimit: 5000,
      discountPercent: 10,
      isActive: true,
    };
    expect(agreement.code).toBe('CONV-TEST');

    const customer: Customer = {
      id: 1,
      storeId: 1,
      name: 'Cliente Teste',
      cpf: '111.222.333-44',
      creditLimit: 1000,
      currentDebt: 0,
      status: 'ACTIVE',
      allowDependents: true,
    };
    expect(customer.status).toBe('ACTIVE');

    const dependent: CustomerDependent = {
      id: 1,
      customerId: 1,
      name: 'Dependente Teste',
      cpf: '555.666.777-88',
      relationship: 'FILHO(A)',
      isActive: true,
    };
    expect(dependent.relationship).toBe('FILHO(A)');

    const receivable: CustomerReceivable = {
      id: 1,
      customerId: 1,
      installmentNumber: 1,
      totalInstallments: 3,
      dueDate: '2026-12-05',
      originalAmount: 100,
      paidAmount: 0,
      discountAmount: 0,
      interestAmount: 0,
      status: 'OPEN',
    };
    expect(receivable.status).toBe('OPEN');

    const invoice: AgreementInvoice = {
      id: 1,
      invoiceNumber: 'FAT-202611-0001',
      agreementId: 1,
      periodStart: '2026-10-21',
      periodEnd: '2026-11-20',
      dueDate: '2026-12-05',
      totalAmount: 100,
      totalSalesCount: 1,
      totalEmployeesCount: 1,
      status: 'OPEN',
    };
    expect(invoice.invoiceNumber).toBe('FAT-202611-0001');

    const eligibility: CreditEligibilityResult = {
      isEligible: true,
      customer,
      availableLimit: 1000,
    };
    expect(eligibility.isEligible).toBe(true);
  });
});
