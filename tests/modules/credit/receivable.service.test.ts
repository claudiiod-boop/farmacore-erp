import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import {
  ReceivableService,
  ReceivableError,
} from '../../../src/modules/credit/receivable.service';
import { CustomerCreditService } from '../../../src/modules/credit/customer-credit.service';
import { AgreementService } from '../../../src/modules/credit/agreement.service';
import type { Customer, CorporateAgreement } from '../../../src/modules/credit/types';

describe('ReceivableService (Parcelamento a Prazo, Quitação no Caixa PDV e Movimentação de Gaveta)', () => {
  let db: Database;
  let service: ReceivableService;
  let customerService: CustomerCreditService;
  let agreementService: AgreementService;

  let activeCustomer: Customer;
  let corporateCustomer: Customer;
  let testAgreement: CorporateAgreement;
  let cashSessionId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);

    service = new ReceivableService(db);
    customerService = new CustomerCreditService(db);
    agreementService = new AgreementService(db);

    // Cria convênio de teste: fechamento dia 20, vencimento dia 5
    testAgreement = agreementService.createAgreement({
      code: 'CONV-EMPRESA-A',
      companyName: 'Empresa Alpha Ltda',
      tradeName: 'Alpha Tech',
      cnpj: '11.222.333/0001-44',
      street: 'Rua Alpha',
      number: '100',
      neighborhood: 'Distrito Industrial',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01001-000',
      closingDay: 20,
      dueDay: 5,
      creditLimit: 20000,
    });

    // Cliente 1: Crediário próprio (sem convênio)
    activeCustomer = customerService.createCustomer({
      storeId: 1,
      name: 'João da Silva',
      cpf: '111.222.333-44',
      creditLimit: 1000,
      currentDebt: 0,
      status: 'ACTIVE',
    });

    // Cliente 2: Conveniado (com convênio)
    corporateCustomer = customerService.createCustomer({
      storeId: 1,
      agreementId: testAgreement.id,
      name: 'Maria Santos',
      cpf: '555.666.777-88',
      creditLimit: 1500,
      currentDebt: 0,
      status: 'ACTIVE',
    });

    // Cria uma sessão de caixa aberta para os testes de PDV
    const sessionResult = db
      .prepare(`
        INSERT INTO cash_sessions (operator_name, initial_cash, current_cash, status)
        VALUES ('Caixa Operador 1', 100.0, 100.0, 'OPEN')
      `)
      .run();
    cashSessionId = Number(sessionResult.lastInsertRowid);
  });

  afterEach(() => {
    db.close();
  });

  describe('createReceivablesForSale', () => {
    it('deve gerar parcelas com desdobramento exato de centavos garantindo sum(original_amount) === total_amount', () => {
      // Caso 1: R$ 100,00 em 3 parcelas -> 33.34 + 33.33 + 33.33 = 100.00
      const receivables3x = service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 100.0,
        installmentsCount: 3,
        saleDate: '2026-05-10',
      });

      expect(receivables3x).toHaveLength(3);
      const sum3x = receivables3x.reduce((acc, r) => acc + r.originalAmount, 0);
      expect(Number(sum3x.toFixed(2))).toBe(100.0);
      expect(receivables3x[0].originalAmount).toBe(33.34);
      expect(receivables3x[1].originalAmount).toBe(33.33);
      expect(receivables3x[2].originalAmount).toBe(33.33);

      // Caso 2: R$ 10,00 em 6 parcelas -> 1.67, 1.67, 1.67, 1.67, 1.66, 1.66 = 10.00
      const receivables6x = service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 10.0,
        installmentsCount: 6,
        saleDate: '2026-05-10',
      });

      expect(receivables6x).toHaveLength(6);
      const sum6x = receivables6x.reduce((acc, r) => acc + r.originalAmount, 0);
      expect(Number(sum6x.toFixed(2))).toBe(10.0);
      expect(receivables6x[0].originalAmount).toBe(1.67);
      expect(receivables6x[1].originalAmount).toBe(1.67);
      expect(receivables6x[2].originalAmount).toBe(1.67);
      expect(receivables6x[3].originalAmount).toBe(1.67);
      expect(receivables6x[4].originalAmount).toBe(1.66);
      expect(receivables6x[5].originalAmount).toBe(1.66);

      // Caso 3: R$ 123,45 em 4 parcelas
      const receivables4x = service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 123.45,
        installmentsCount: 4,
        saleDate: '2026-05-10',
      });
      expect(receivables4x).toHaveLength(4);
      const sum4x = receivables4x.reduce((acc, r) => acc + r.originalAmount, 0);
      expect(Number(sum4x.toFixed(2))).toBe(123.45);
    });

    it('deve calcular vencimentos a cada 30 dias para crediário próprio (sem agreementId)', () => {
      const saleDate = '2026-01-10';
      const receivables = service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 300.0,
        installmentsCount: 3,
        saleDate,
      });

      expect(receivables).toHaveLength(3);
      // 2026-01-10 + 30 dias = 2026-02-09
      expect(receivables[0].dueDate).toBe('2026-02-09');
      expect(receivables[0].installmentNumber).toBe(1);
      expect(receivables[0].totalInstallments).toBe(3);
      expect(receivables[0].status).toBe('OPEN');

      // 2026-01-10 + 60 dias = 2026-03-11
      expect(receivables[1].dueDate).toBe('2026-03-11');
      expect(receivables[1].installmentNumber).toBe(2);

      // 2026-01-10 + 90 dias = 2026-04-10
      expect(receivables[2].dueDate).toBe('2026-04-10');
      expect(receivables[2].installmentNumber).toBe(3);
    });

    it('deve respeitar firstDueDate para crediário próprio quando fornecido', () => {
      const receivables = service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 200.0,
        installmentsCount: 2,
        firstDueDate: '2026-02-15',
      });

      expect(receivables[0].dueDate).toBe('2026-02-15');
      // Parcela 2 = firstDueDate + 30 dias = 2026-03-17
      expect(receivables[1].dueDate).toBe('2026-03-17');
    });

    it('deve calcular vencimentos conforme closing_day e due_day da empresa parceira para convênio corporativo', () => {
      // Convênio testAgreement: closing_day = 20, due_day = 5

      // Caso A: Venda em 2026-05-15 (dia 15 <= 20) -> Fecha em maio (20/05), vence em 05/06/2026
      const receivablesBeforeClosing = service.createReceivablesForSale({
        customerId: corporateCustomer.id,
        agreementId: testAgreement.id,
        totalAmount: 150.0,
        installmentsCount: 2,
        saleDate: '2026-05-15',
      });

      expect(receivablesBeforeClosing[0].dueDate).toBe('2026-06-05');
      expect(receivablesBeforeClosing[1].dueDate).toBe('2026-07-05');

      // Caso B: Venda em 2026-05-25 (dia 25 > 20) -> Fecha em junho (20/06), vence em 05/07/2026
      const receivablesAfterClosing = service.createReceivablesForSale({
        customerId: corporateCustomer.id,
        agreementId: testAgreement.id,
        totalAmount: 75.0,
        installmentsCount: 1,
        saleDate: '2026-05-25',
      });

      expect(receivablesAfterClosing[0].dueDate).toBe('2026-07-05');
    });

    it('deve calcular vencimento corporativo quando due_day > closing_day (vencimento no mesmo ciclo)', () => {
      // Cria convênio com fechamento dia 10 e vencimento dia 25
      const sameMonthAgreement = agreementService.createAgreement({
        code: 'CONV-BETA',
        companyName: 'Beta Tecnologia Ltda',
        tradeName: 'Beta Tech',
        cnpj: '22.333.444/0001-55',
        street: 'Rua Beta',
        number: '200',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01002-000',
        closingDay: 10,
        dueDay: 25,
      });

      const custBeta = customerService.createCustomer({
        storeId: 1,
        agreementId: sameMonthAgreement.id,
        name: 'Carlos Oliveira',
        cpf: '777.888.999-00',
        creditLimit: 1000,
        status: 'ACTIVE',
      });

      // Venda em 2026-05-05 (<= 10) -> Fecha em 10/05, vence em 25/05/2026
      const rec1 = service.createReceivablesForSale({
        customerId: custBeta.id,
        agreementId: sameMonthAgreement.id,
        totalAmount: 100.0,
        installmentsCount: 1,
        saleDate: '2026-05-05',
      });
      expect(rec1[0].dueDate).toBe('2026-05-25');

      // Venda em 2026-05-12 (> 10) -> Fecha em 10/06, vence em 25/06/2026
      const rec2 = service.createReceivablesForSale({
        customerId: custBeta.id,
        agreementId: sameMonthAgreement.id,
        totalAmount: 100.0,
        installmentsCount: 1,
        saleDate: '2026-05-12',
      });
      expect(rec2[0].dueDate).toBe('2026-06-25');
    });

    it('deve incrementar atomicamente customers.current_debt com o valor total da venda a prazo', () => {
      expect(activeCustomer.currentDebt).toBe(0);

      service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 250.75,
        installmentsCount: 3,
        saleDate: '2026-05-10',
      });

      const updatedCustomer = customerService.getCustomerById(activeCustomer.id);
      expect(updatedCustomer.currentDebt).toBe(250.75);

      // Segunda compra adiciona ao saldo devedor existente
      service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 149.25,
        installmentsCount: 1,
        saleDate: '2026-05-12',
      });

      const customerAfterSecondSale = customerService.getCustomerById(activeCustomer.id);
      expect(customerAfterSecondSale.currentDebt).toBe(400.0);
    });

    it('deve lançar erro CUSTOMER_NOT_FOUND se o cliente não existir', () => {
      expect(() => {
        service.createReceivablesForSale({
          customerId: 999999,
          totalAmount: 100.0,
          installmentsCount: 1,
        });
      }).toThrowError(ReceivableError);

      try {
        service.createReceivablesForSale({
          customerId: 999999,
          totalAmount: 100.0,
          installmentsCount: 1,
        });
      } catch (err: any) {
        expect(err.code).toBe('CUSTOMER_NOT_FOUND');
      }
    });

    it('deve lançar erro se o cliente estiver INACTIVE ou BLOCKED_OVERDUE', () => {
      // Cliente inativo
      const inactiveCustomer = customerService.createCustomer({
        storeId: 1,
        name: 'Inativo Santos',
        cpf: '333.444.555-66',
        creditLimit: 500,
        status: 'INACTIVE',
      });

      expect(() => {
        service.createReceivablesForSale({
          customerId: inactiveCustomer.id,
          totalAmount: 50.0,
          installmentsCount: 1,
        });
      }).toThrowError(ReceivableError);

      try {
        service.createReceivablesForSale({
          customerId: inactiveCustomer.id,
          totalAmount: 50.0,
          installmentsCount: 1,
        });
      } catch (err: any) {
        expect(['CUSTOMER_INACTIVE', 'CUSTOMER_BLOCKED']).toContain(err.code);
      }

      // Cliente bloqueado
      const blockedCustomer = customerService.createCustomer({
        storeId: 1,
        name: 'Bloqueado Silva',
        cpf: '999.888.777-66',
        creditLimit: 500,
        status: 'BLOCKED_OVERDUE',
      });

      expect(() => {
        service.createReceivablesForSale({
          customerId: blockedCustomer.id,
          totalAmount: 50.0,
          installmentsCount: 1,
        });
      }).toThrowError(ReceivableError);

      try {
        service.createReceivablesForSale({
          customerId: blockedCustomer.id,
          totalAmount: 50.0,
          installmentsCount: 1,
        });
      } catch (err: any) {
        expect(err.code).toBe('CUSTOMER_BLOCKED');
      }
    });
  });

  describe('getCustomerReceivables', () => {
    beforeEach(() => {
      // Cria duas compras com parcelas para activeCustomer
      service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 200.0,
        installmentsCount: 2,
        saleDate: '2026-01-10',
      });

      service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 100.0,
        installmentsCount: 1,
        saleDate: '2026-02-01',
      });
    });

    it('deve listar todas as parcelas do cliente ordenadas por due_date ASC, installment_number ASC', () => {
      const receivables = service.getCustomerReceivables(activeCustomer.id);
      expect(receivables).toHaveLength(3);

      for (let i = 0; i < receivables.length - 1; i++) {
        const curr = receivables[i];
        const next = receivables[i + 1];
        if (curr.dueDate === next.dueDate) {
          expect(curr.installmentNumber).toBeLessThanOrEqual(next.installmentNumber);
        } else {
          expect(curr.dueDate.localeCompare(next.dueDate)).toBeLessThanOrEqual(0);
        }
      }
    });

    it('deve filtrar parcelas por status OPEN, PAID ou ALL', () => {
      const allReceivables = service.getCustomerReceivables(activeCustomer.id, 'ALL');
      expect(allReceivables).toHaveLength(3);

      // Quita a primeira parcela
      service.receivePayment({
        receivableIds: [allReceivables[0].id],
        cashSessionId,
        paymentMethod: 'DINHEIRO',
      });

      const openReceivables = service.getCustomerReceivables(activeCustomer.id, 'OPEN');
      expect(openReceivables).toHaveLength(2);
      expect(openReceivables.every((r) => r.status === 'OPEN')).toBe(true);

      const paidReceivables = service.getCustomerReceivables(activeCustomer.id, 'PAID');
      expect(paidReceivables).toHaveLength(1);
      expect(paidReceivables[0].id).toBe(allReceivables[0].id);
      expect(paidReceivables[0].status).toBe('PAID');
    });

    it('deve lançar erro CUSTOMER_NOT_FOUND ao consultar parcelas de cliente inexistente', () => {
      expect(() => {
        service.getCustomerReceivables(999999);
      }).toThrowError(ReceivableError);
    });
  });

  describe('receivePayment', () => {
    it('deve dar baixa com sucesso em uma ou múltiplas parcelas em aberto', () => {
      const receivables = service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 300.0,
        installmentsCount: 3,
        saleDate: '2026-01-10',
      });

      const idsToPay = [receivables[0].id, receivables[1].id];
      const result = service.receivePayment({
        receivableIds: idsToPay,
        cashSessionId,
        paymentMethod: 'DINHEIRO',
        operatorName: 'Operador Fulano',
      });

      expect(result.paidReceivables).toHaveLength(2);
      expect(result.totalPaid).toBe(200.0);

      // Verifica status das parcelas no banco
      const rec1 = db.prepare('SELECT * FROM customer_receivables WHERE id = ?').get(receivables[0].id) as any;
      expect(rec1.status).toBe('PAID');
      expect(rec1.paid_amount).toBe(rec1.original_amount);
      expect(rec1.cash_session_id).toBe(cashSessionId);
      expect(rec1.payment_method).toBe('DINHEIRO');
      expect(rec1.paid_at).toBeDefined();

      const rec2 = db.prepare('SELECT * FROM customer_receivables WHERE id = ?').get(receivables[1].id) as any;
      expect(rec2.status).toBe('PAID');

      // Parcela 3 continua em aberto
      const rec3 = db.prepare('SELECT * FROM customer_receivables WHERE id = ?').get(receivables[2].id) as any;
      expect(rec3.status).toBe('OPEN');
      expect(rec3.paid_amount).toBe(0.0);
    });

    it('deve deduzir atomicamente o saldo devedor do cliente current_debt = MAX(0, current_debt - totalPaid)', () => {
      service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 300.0,
        installmentsCount: 3,
        saleDate: '2026-01-10',
      });

      const customerBefore = customerService.getCustomerById(activeCustomer.id);
      expect(customerBefore.currentDebt).toBe(300.0);

      const all = service.getCustomerReceivables(activeCustomer.id, 'OPEN');
      const result = service.receivePayment({
        receivableIds: [all[0].id],
        cashSessionId,
        paymentMethod: 'DINHEIRO',
      });

      expect(result.remainingDebt).toBe(200.0);
      const customerAfter = customerService.getCustomerById(activeCustomer.id);
      expect(customerAfter.currentDebt).toBe(200.0);
    });

    it('deve realizar desbloqueio automático do cliente quando quitar todas as parcelas vencidas há mais de 5 dias', () => {
      // Insere parcelas simulando atraso: vencimento há 10 dias
      const pastDueDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const futureDueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      // Bloqueia o cliente
      db.prepare("UPDATE customers SET status = 'BLOCKED_OVERDUE', current_debt = 200.0 WHERE id = ?").run(activeCustomer.id);

      const res1 = db.prepare(`
        INSERT INTO customer_receivables (customer_id, installment_number, total_installments, due_date, original_amount, status)
        VALUES (?, 1, 2, ?, 100.0, 'OPEN')
      `).run(activeCustomer.id, pastDueDate);
      const overdueId = Number(res1.lastInsertRowid);

      const res2 = db.prepare(`
        INSERT INTO customer_receivables (customer_id, installment_number, total_installments, due_date, original_amount, status)
        VALUES (?, 2, 2, ?, 100.0, 'OPEN')
      `).run(activeCustomer.id, futureDueDate);
      const futureId = Number(res2.lastInsertRowid);

      // Confirma que cliente está bloqueado
      let cust = customerService.getCustomerById(activeCustomer.id);
      expect(cust.status).toBe('BLOCKED_OVERDUE');

      // Quita a parcela vencida
      const paymentResult = service.receivePayment({
        receivableIds: [overdueId],
        cashSessionId,
        paymentMethod: 'DINHEIRO',
      });

      // Como não restam mais parcelas vencidas há mais de 5 dias, cliente é desbloqueado para ACTIVE
      expect(paymentResult.customer.status).toBe('ACTIVE');
      cust = customerService.getCustomerById(activeCustomer.id);
      expect(cust.status).toBe('ACTIVE');
    });

    it('não deve desbloquear o cliente se ainda restar outra parcela vencida há mais de 5 dias', () => {
      const pastDueDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      db.prepare("UPDATE customers SET status = 'BLOCKED_OVERDUE', current_debt = 200.0 WHERE id = ?").run(activeCustomer.id);

      const res1 = db.prepare(`
        INSERT INTO customer_receivables (customer_id, installment_number, total_installments, due_date, original_amount, status)
        VALUES (?, 1, 2, ?, 100.0, 'OPEN')
      `).run(activeCustomer.id, pastDueDate);
      const overdueId1 = Number(res1.lastInsertRowid);

      const res2 = db.prepare(`
        INSERT INTO customer_receivables (customer_id, installment_number, total_installments, due_date, original_amount, status)
        VALUES (?, 2, 2, ?, 100.0, 'OPEN')
      `).run(activeCustomer.id, pastDueDate);
      const overdueId2 = Number(res2.lastInsertRowid);

      // Quita apenas uma das duas parcelas atrasadas
      const paymentResult = service.receivePayment({
        receivableIds: [overdueId1],
        cashSessionId,
        paymentMethod: 'DINHEIRO',
      });

      // Ainda resta overdueId2 vencida há mais de 5 dias -> permanece BLOCKED_OVERDUE
      expect(paymentResult.customer.status).toBe('BLOCKED_OVERDUE');
      const cust = customerService.getCustomerById(activeCustomer.id);
      expect(cust.status).toBe('BLOCKED_OVERDUE');
    });

    it('deve inserir movimentação em cash_movements com type SUPPLY e atualizar current_cash quando paymentMethod for DINHEIRO', () => {
      const sessionBefore = db.prepare('SELECT current_cash FROM cash_sessions WHERE id = ?').get(cashSessionId) as any;
      expect(sessionBefore.current_cash).toBe(100.0);

      const receivables = service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 150.0,
        installmentsCount: 1,
      });

      service.receivePayment({
        receivableIds: [receivables[0].id],
        cashSessionId,
        paymentMethod: 'DINHEIRO',
        operatorName: 'Operador Carlos',
      });

      // Verifica gaveta de caixa
      const sessionAfter = db.prepare('SELECT current_cash FROM cash_sessions WHERE id = ?').get(cashSessionId) as any;
      expect(sessionAfter.current_cash).toBe(250.0); // 100 + 150

      // Verifica registro em cash_movements
      const movement = db.prepare('SELECT * FROM cash_movements WHERE cash_session_id = ?').get(cashSessionId) as any;
      expect(movement).toBeDefined();
      expect(movement.type).toBe('SUPPLY');
      expect(movement.amount).toBe(150.0);
      expect(movement.operator_name).toBe('Operador Carlos');
      expect(movement.reason).toContain('Quitação');
      expect(movement.reason).toContain(activeCustomer.name);
    });

    it('não deve lançar movimentação de dinheiro em gaveta (SUPPLY) quando pagamento for PIX ou CARTAO', () => {
      const receivables = service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 100.0,
        installmentsCount: 1,
      });

      service.receivePayment({
        receivableIds: [receivables[0].id],
        cashSessionId,
        paymentMethod: 'PIX',
      });

      const sessionAfter = db.prepare('SELECT current_cash FROM cash_sessions WHERE id = ?').get(cashSessionId) as any;
      expect(sessionAfter.current_cash).toBe(100.0); // Não altera dinheiro em espécie

      const movements = db.prepare('SELECT * FROM cash_movements WHERE cash_session_id = ?').all(cashSessionId);
      expect(movements).toHaveLength(0);
    });

    it('deve lançar erro RECEIVABLE_NOT_FOUND se uma parcela informada não existir', () => {
      expect(() => {
        service.receivePayment({
          receivableIds: [999999],
          paymentMethod: 'DINHEIRO',
        });
      }).toThrowError(ReceivableError);

      try {
        service.receivePayment({
          receivableIds: [999999],
          paymentMethod: 'DINHEIRO',
        });
      } catch (err: any) {
        expect(err.code).toBe('RECEIVABLE_NOT_FOUND');
      }
    });

    it('deve lançar erro RECEIVABLE_ALREADY_PAID se a parcela já estiver quitada', () => {
      const receivables = service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 50.0,
        installmentsCount: 1,
      });

      service.receivePayment({
        receivableIds: [receivables[0].id],
        paymentMethod: 'DINHEIRO',
      });

      expect(() => {
        service.receivePayment({
          receivableIds: [receivables[0].id],
          paymentMethod: 'DINHEIRO',
        });
      }).toThrowError(ReceivableError);

      try {
        service.receivePayment({
          receivableIds: [receivables[0].id],
          paymentMethod: 'DINHEIRO',
        });
      } catch (err: any) {
        expect(err.code).toBe('RECEIVABLE_ALREADY_PAID');
      }
    });

    it('deve lançar erro MULTIPLE_CUSTOMERS_IN_RECEIPT se parcelas pertencerem a clientes diferentes', () => {
      const recCustomer1 = service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 50.0,
        installmentsCount: 1,
      });

      const recCustomer2 = service.createReceivablesForSale({
        customerId: corporateCustomer.id,
        totalAmount: 50.0,
        installmentsCount: 1,
      });

      expect(() => {
        service.receivePayment({
          receivableIds: [recCustomer1[0].id, recCustomer2[0].id],
          paymentMethod: 'DINHEIRO',
        });
      }).toThrowError(ReceivableError);

      try {
        service.receivePayment({
          receivableIds: [recCustomer1[0].id, recCustomer2[0].id],
          paymentMethod: 'DINHEIRO',
        });
      } catch (err: any) {
        expect(err.code).toBe('MULTIPLE_CUSTOMERS_IN_RECEIPT');
      }
    });

    it('deve retornar PaymentReceiptResult com recibo textual detalhado e dados atualizados', () => {
      const receivables = service.createReceivablesForSale({
        customerId: activeCustomer.id,
        totalAmount: 200.0,
        installmentsCount: 2,
        saleDate: '2026-05-10',
      });

      const result = service.receivePayment({
        receivableIds: [receivables[0].id],
        cashSessionId,
        paymentMethod: 'DINHEIRO',
        operatorName: 'Caixa Central',
      });

      expect(result.customer.id).toBe(activeCustomer.id);
      expect(result.customer.name).toBe(activeCustomer.name);
      expect(result.totalPaid).toBe(100.0);
      expect(result.remainingDebt).toBe(100.0);
      expect(result.availableLimit).toBe(900.0); // 1000 - 100
      expect(result.paidReceivables).toHaveLength(1);

      // Validação do recibo textual
      expect(result.receiptText).toContain('FARMACORE');
      expect(result.receiptText).toContain('COMPROVANTE DE RECEBIMENTO');
      expect(result.receiptText).toContain(activeCustomer.name);
      expect(result.receiptText).toContain(activeCustomer.cpf);
      expect(result.receiptText).toContain('100.00');
      expect(result.receiptText).toContain('DINHEIRO');
    });
  });
});
