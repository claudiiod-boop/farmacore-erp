import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';
import { AgreementService } from '../../src/modules/credit/agreement.service';
import { CustomerCreditService } from '../../src/modules/credit/customer-credit.service';
import { ReceivableService } from '../../src/modules/credit/receivable.service';

describe('Credit REST API Routes (/api/credit/*)', () => {
  let app: FastifyInstance;
  let db: Database;
  let agreementService: AgreementService;
  let customerService: CustomerCreditService;
  let receivableService: ReceivableService;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    agreementService = new AgreementService(db);
    customerService = new CustomerCreditService(db);
    receivableService = new ReceivableService(db);

    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  // =========================================================================
  // 1. CONVÊNIOS CORPORATIVOS (/api/credit/agreements/*)
  // =========================================================================
  describe('Corporate Agreements Routes', () => {
    it('GET /api/credit/agreements should list agreements and support activeOnly filter', async () => {
      // Cria um ativo e um inativo
      agreementService.createAgreement({
        code: 'CONV-A',
        companyName: 'Empresa A S.A.',
        tradeName: 'Alpha Corp',
        cnpj: '11.111.111/0001-11',
        street: 'Rua A',
        number: '10',
        neighborhood: 'Centro',
        city: 'Sao Paulo',
        state: 'SP',
        zipCode: '01001-000',
        isActive: true,
      });

      agreementService.createAgreement({
        code: 'CONV-B',
        companyName: 'Empresa B Ltda',
        tradeName: 'Beta Corp',
        cnpj: '22.222.222/0001-22',
        street: 'Rua B',
        number: '20',
        neighborhood: 'Bela Vista',
        city: 'Sao Paulo',
        state: 'SP',
        zipCode: '01311-000',
        isActive: false,
      });

      // Lista todos
      const resAll = await app.inject({
        method: 'GET',
        url: '/api/credit/agreements',
      });
      expect(resAll.statusCode).toBe(200);
      const agreementsAll = JSON.parse(resAll.body);
      expect(agreementsAll.length).toBe(2);

      // Filtra ativos
      const resActive = await app.inject({
        method: 'GET',
        url: '/api/credit/agreements?activeOnly=true',
      });
      expect(resActive.statusCode).toBe(200);
      const agreementsActive = JSON.parse(resActive.body);
      expect(agreementsActive.length).toBe(1);
      expect(agreementsActive[0].code).toBe('CONV-A');
    });

    it('POST /api/credit/agreements should create agreement, validate Zod, and reject duplicate code/cnpj', async () => {
      // 1. Criar válido
      const validPayload = {
        code: 'CONV-XYZ',
        companyName: 'XYZ Tecnologia S.A.',
        tradeName: 'XYZ Tech',
        cnpj: '33.333.333/0001-33',
        street: 'Av. Paulista',
        number: '1500',
        neighborhood: 'Bela Vista',
        city: 'Sao Paulo',
        state: 'SP',
        zipCode: '01310-200',
        closingDay: 25,
        dueDay: 10,
        creditLimit: 25000,
        discountPercent: 7.5,
      };

      const resCreate = await app.inject({
        method: 'POST',
        url: '/api/credit/agreements',
        payload: validPayload,
      });
      expect(resCreate.statusCode).toBe(201);
      const created = JSON.parse(resCreate.body);
      expect(created.id).toBeDefined();
      expect(created.code).toBe('CONV-XYZ');
      expect(created.tradeName).toBe('XYZ Tech');

      // 2. Erro de validação Zod (campo obrigatório ausente)
      const invalidPayload = {
        code: 'CONV-INVAL',
        // companyName faltando
        cnpj: '44.444.444/0001-44',
      };
      const resInvalid = await app.inject({
        method: 'POST',
        url: '/api/credit/agreements',
        payload: invalidPayload,
      });
      expect(resInvalid.statusCode).toBe(400);

      // 3. Conflito 409 por código duplicado
      const resDupCode = await app.inject({
        method: 'POST',
        url: '/api/credit/agreements',
        payload: {
          ...validPayload,
          cnpj: '55.555.555/0001-55', // CNPJ diferente, mesmo código
        },
      });
      expect(resDupCode.statusCode).toBe(409);

      // 4. Conflito 409 por CNPJ duplicado
      const resDupCnpj = await app.inject({
        method: 'POST',
        url: '/api/credit/agreements',
        payload: {
          ...validPayload,
          code: 'CONV-DIFERENTE',
        },
      });
      expect(resDupCnpj.statusCode).toBe(409);
    });

    it('GET /api/credit/agreements/:id should return agreement or 404', async () => {
      const created = agreementService.createAgreement({
        code: 'CONV-10',
        companyName: 'Empresa 10 Ltda',
        tradeName: 'Dez Corp',
        cnpj: '10.100.100/0001-10',
        street: 'Rua 10',
        number: '100',
        neighborhood: 'Centro',
        city: 'Sao Paulo',
        state: 'SP',
        zipCode: '01010-010',
      });

      const resFound = await app.inject({
        method: 'GET',
        url: `/api/credit/agreements/${created.id}`,
      });
      expect(resFound.statusCode).toBe(200);
      const bodyFound = JSON.parse(resFound.body);
      expect(bodyFound.id).toBe(created.id);
      expect(bodyFound.code).toBe('CONV-10');

      const resNotFound = await app.inject({
        method: 'GET',
        url: '/api/credit/agreements/9999',
      });
      expect(resNotFound.statusCode).toBe(404);
    });

    it('PUT /api/credit/agreements/:id should update agreement, handle 404 and 409', async () => {
      const ag1 = agreementService.createAgreement({
        code: 'CONV-U1',
        companyName: 'Empresa U1',
        tradeName: 'U1 Tech',
        cnpj: '71.111.111/0001-11',
        street: 'Rua 1',
        number: '1',
        neighborhood: 'N1',
        city: 'City',
        state: 'SP',
        zipCode: '11111-111',
      });

      const ag2 = agreementService.createAgreement({
        code: 'CONV-U2',
        companyName: 'Empresa U2',
        tradeName: 'U2 Tech',
        cnpj: '72.222.222/0001-22',
        street: 'Rua 2',
        number: '2',
        neighborhood: 'N2',
        city: 'City',
        state: 'SP',
        zipCode: '22222-222',
      });

      // 1. Atualizar com sucesso
      const resUpdate = await app.inject({
        method: 'PUT',
        url: `/api/credit/agreements/${ag1.id}`,
        payload: {
          tradeName: 'U1 Tech Atualizada',
          creditLimit: 30000,
        },
      });
      expect(resUpdate.statusCode).toBe(200);
      const updated = JSON.parse(resUpdate.body);
      expect(updated.tradeName).toBe('U1 Tech Atualizada');
      expect(updated.creditLimit).toBe(30000);

      // 2. 404 em id inexistente
      const res404 = await app.inject({
        method: 'PUT',
        url: '/api/credit/agreements/8888',
        payload: { tradeName: 'Novo' },
      });
      expect(res404.statusCode).toBe(404);

      // 3. 409 em código duplicado
      const res409 = await app.inject({
        method: 'PUT',
        url: `/api/credit/agreements/${ag1.id}`,
        payload: { code: 'CONV-U2' },
      });
      expect(res409.statusCode).toBe(409);
    });

    it('POST & GET /api/credit/agreements/:id/invoices and GET /api/credit/invoices/:id', async () => {
      const agreement = agreementService.createAgreement({
        code: 'CONV-FAT',
        companyName: 'Faturamento S.A.',
        tradeName: 'Faturadora',
        cnpj: '88.888.888/0001-88',
        street: 'Av Faturamento',
        number: '88',
        neighborhood: 'Centro',
        city: 'Sao Paulo',
        state: 'SP',
        zipCode: '08888-888',
        closingDay: 20,
        dueDay: 5,
      });

      const customer = customerService.createCustomer({
        storeId: 1,
        agreementId: agreement.id,
        name: 'Funcionario Faturado',
        cpf: '777.888.999-00',
        registrationNumber: 'MAT-77',
        department: 'TI',
        creditLimit: 1000,
      });

      // 1. Tentar gerar fatura sem nenhuma parcela -> 400 NO_RECEIVABLES_TO_INVOICE
      const resNoRec = await app.inject({
        method: 'POST',
        url: `/api/credit/agreements/${agreement.id}/invoices`,
        payload: {
          startDate: '2026-10-21',
          endDate: '2026-11-20',
          dueDate: '2026-12-05',
        },
      });
      expect(resNoRec.statusCode).toBe(400);
      const errNoRec = JSON.parse(resNoRec.body);
      expect(errNoRec.error).toBe('NO_RECEIVABLES_TO_INVOICE');

      // 2. Criar parcela a faturar
      receivableService.createReceivablesForSale({
        customerId: customer.id,
        agreementId: agreement.id,
        totalAmount: 150.0,
        installmentsCount: 1,
        firstDueDate: '2026-12-05',
        saleDate: '2026-11-15',
      });

      // 3. Gerar fatura com sucesso -> 201 com FAT-YYYYMM-XXXX
      const resInvoice = await app.inject({
        method: 'POST',
        url: `/api/credit/agreements/${agreement.id}/invoices`,
        payload: {
          startDate: '2026-10-21',
          endDate: '2026-12-31',
          dueDate: '2026-12-05',
          notes: 'Fatura Mensal Ref 11/2026',
        },
      });
      expect(resInvoice.statusCode).toBe(201);
      const invoice = JSON.parse(resInvoice.body);
      expect(invoice.id).toBeDefined();
      expect(invoice.invoiceNumber).toMatch(/^FAT-\d{6}-\d{4}$/);
      expect(invoice.totalAmount).toBe(150.0);

      // 4. Listar faturas do convênio -> GET /api/credit/agreements/:id/invoices
      const resListInvoices = await app.inject({
        method: 'GET',
        url: `/api/credit/agreements/${agreement.id}/invoices`,
      });
      expect(resListInvoices.statusCode).toBe(200);
      const invoicesList = JSON.parse(resListInvoices.body);
      expect(invoicesList.length).toBe(1);
      expect(invoicesList[0].invoiceNumber).toBe(invoice.invoiceNumber);

      // 5. Detalhes da fatura com extrato RH -> GET /api/credit/invoices/:id
      const resInvoiceDetails = await app.inject({
        method: 'GET',
        url: `/api/credit/invoices/${invoice.id}`,
      });
      expect(resInvoiceDetails.statusCode).toBe(200);
      const invoiceDetails = JSON.parse(resInvoiceDetails.body);
      expect(invoiceDetails.id).toBe(invoice.id);
      expect(invoiceDetails.payrollReport).toBeDefined();
      expect(invoiceDetails.payrollReport).toContain(invoice.invoiceNumber);
      expect(invoiceDetails.payrollReport).toContain('Funcionario Faturado');

      // 6. Inexistente -> 404
      const resInvoice404 = await app.inject({
        method: 'GET',
        url: '/api/credit/invoices/9999',
      });
      expect(resInvoice404.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // 2. CLIENTES, DEPENDENTES & ELEGIBILIDADE (/api/credit/customers/*)
  // =========================================================================
  describe('Customer & Credit Limits Routes', () => {
    it('GET /api/credit/customers should return paginated list and apply filters', async () => {
      customerService.createCustomer({
        storeId: 1,
        name: 'Ana Carolina',
        cpf: '111.111.111-11',
        creditLimit: 500,
      });
      customerService.createCustomer({
        storeId: 1,
        name: 'Bruno Dias',
        cpf: '222.222.222-22',
        creditLimit: 700,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/credit/customers?search=Carolina',
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.customers).toBeDefined();
      expect(data.customers.length).toBe(1);
      expect(data.customers[0].name).toBe('Ana Carolina');
    });

    it('POST /api/credit/customers should create customer, validate Zod, and reject duplicate CPF', async () => {
      const payload = {
        storeId: 1,
        name: 'Claudio Duarte',
        cpf: '333.333.333-33',
        creditLimit: 1000,
        allowDependents: true,
      };

      // 1. Criar válido
      const resCreate = await app.inject({
        method: 'POST',
        url: '/api/credit/customers',
        payload,
      });
      expect(resCreate.statusCode).toBe(201);
      const created = JSON.parse(resCreate.body);
      expect(created.id).toBeDefined();
      expect(created.name).toBe('Claudio Duarte');

      // 2. Erro de validação Zod (nome ausente)
      const resInvalid = await app.inject({
        method: 'POST',
        url: '/api/credit/customers',
        payload: { cpf: '444.444.444-44' },
      });
      expect(resInvalid.statusCode).toBe(400);

      // 3. Conflito de CPF duplicado
      const resDup = await app.inject({
        method: 'POST',
        url: '/api/credit/customers',
        payload: {
          ...payload,
          name: 'Claudio Duarte Clone',
        },
      });
      expect(resDup.statusCode).toBe(409);
    });

    it('GET /api/credit/customers/:id and GET /api/credit/customers/by-cpf/:cpf', async () => {
      const customer = customerService.createCustomer({
        storeId: 1,
        name: 'Debora Freitas',
        cpf: '444.555.666-77',
        creditLimit: 800,
      });

      // GET by ID
      const resId = await app.inject({
        method: 'GET',
        url: `/api/credit/customers/${customer.id}`,
      });
      expect(resId.statusCode).toBe(200);
      const bodyId = JSON.parse(resId.body);
      expect(bodyId.name).toBe('Debora Freitas');
      expect(Array.isArray(bodyId.dependents)).toBe(true);

      // GET by CPF formatado
      const resCpfFormatted = await app.inject({
        method: 'GET',
        url: '/api/credit/customers/by-cpf/444.555.666-77',
      });
      expect(resCpfFormatted.statusCode).toBe(200);
      expect(JSON.parse(resCpfFormatted.body).id).toBe(customer.id);

      // GET by CPF desmascarado
      const resCpfRaw = await app.inject({
        method: 'GET',
        url: '/api/credit/customers/by-cpf/44455566677',
      });
      expect(resCpfRaw.statusCode).toBe(200);
      expect(JSON.parse(resCpfRaw.body).id).toBe(customer.id);

      // 404
      const res404 = await app.inject({
        method: 'GET',
        url: '/api/credit/customers/by-cpf/00000000000',
      });
      expect(res404.statusCode).toBe(404);
    });

    it('PUT /api/credit/customers/:id should update customer or return 404/409', async () => {
      const c1 = customerService.createCustomer({
        storeId: 1,
        name: 'Eva Ramos',
        cpf: '101.101.101-01',
        creditLimit: 600,
      });
      const c2 = customerService.createCustomer({
        storeId: 1,
        name: 'Fabio Santos',
        cpf: '202.202.202-02',
        creditLimit: 600,
      });

      // 1. Atualizar
      const resPut = await app.inject({
        method: 'PUT',
        url: `/api/credit/customers/${c1.id}`,
        payload: {
          creditLimit: 1200,
          phone: '(11) 99999-8888',
        },
      });
      expect(resPut.statusCode).toBe(200);
      const updated = JSON.parse(resPut.body);
      expect(updated.creditLimit).toBe(1200);

      // 2. 404
      const res404 = await app.inject({
        method: 'PUT',
        url: '/api/credit/customers/9999',
        payload: { creditLimit: 2000 },
      });
      expect(res404.statusCode).toBe(404);

      // 3. 409 CPF duplicado
      const res409 = await app.inject({
        method: 'PUT',
        url: `/api/credit/customers/${c1.id}`,
        payload: { cpf: '202.202.202-02' },
      });
      expect(res409.statusCode).toBe(409);
    });

    it('POST /api/credit/customers/:id/dependents and DELETE /api/credit/customers/dependents/:id', async () => {
      const customer = customerService.createCustomer({
        storeId: 1,
        name: 'Gustavo Lima',
        cpf: '303.303.303-03',
        allowDependents: true,
      });

      // 1. Adicionar dependente
      const resAdd = await app.inject({
        method: 'POST',
        url: `/api/credit/customers/${customer.id}/dependents`,
        payload: {
          name: 'Gustavo Junior',
          cpf: '404.404.404-04',
          relationship: 'FILHO(A)',
        },
      });
      expect(resAdd.statusCode).toBe(201);
      const dep = JSON.parse(resAdd.body);
      expect(dep.id).toBeDefined();
      expect(dep.name).toBe('Gustavo Junior');

      // 2. Remover dependente
      const resDel = await app.inject({
        method: 'DELETE',
        url: `/api/credit/customers/dependents/${dep.id}`,
      });
      expect(resDel.statusCode).toBe(200);

      // 3. Deletar novamente -> 404
      const resDel404 = await app.inject({
        method: 'DELETE',
        url: `/api/credit/customers/dependents/${dep.id}`,
      });
      expect(resDel404.statusCode).toBe(404);

      // 4. Tentar adicionar em titular com allowDependents=false -> 400
      const customerNoDep = customerService.createCustomer({
        storeId: 1,
        name: 'Helena Souza',
        cpf: '505.505.505-05',
        allowDependents: false,
      });
      const resBlockDep = await app.inject({
        method: 'POST',
        url: `/api/credit/customers/${customerNoDep.id}/dependents`,
        payload: {
          name: 'Filho Bloqueado',
          cpf: '606.606.606-06',
        },
      });
      expect(resBlockDep.statusCode).toBe(400);
    });

    it('POST /api/credit/customers/:id/check-eligibility should evaluate credit and available limit', async () => {
      const customer = customerService.createCustomer({
        storeId: 1,
        name: 'Igor Viana',
        cpf: '707.707.707-07',
        creditLimit: 500,
      });

      // 1. Elegível para compra de R$ 200
      const resEligible = await app.inject({
        method: 'POST',
        url: `/api/credit/customers/${customer.id}/check-eligibility`,
        payload: {
          purchaseAmount: 200,
        },
      });
      expect(resEligible.statusCode).toBe(200);
      const elData = JSON.parse(resEligible.body);
      expect(elData.isEligible).toBe(true);
      expect(elData.availableLimit).toBe(500);

      // 2. Inelegível para compra que excede limite (R$ 600)
      const resExceeded = await app.inject({
        method: 'POST',
        url: `/api/credit/customers/${customer.id}/check-eligibility`,
        payload: {
          purchaseAmount: 600,
        },
      });
      expect(resExceeded.statusCode).toBe(200);
      const excData = JSON.parse(resExceeded.body);
      expect(excData.isEligible).toBe(false);
      expect(excData.errorCode).toBe('CREDIT_LIMIT_EXCEEDED');
    });
  });

  // =========================================================================
  // 3. CONTAS A RECEBER / PDV (/api/credit/receivables/*)
  // =========================================================================
  describe('Receivables & POS Settlement Routes', () => {
    it('GET /api/credit/receivables/customer/:customerId should list customer receivables', async () => {
      const customer = customerService.createCustomer({
        storeId: 1,
        name: 'Joao Parcelado',
        cpf: '808.808.808-08',
        creditLimit: 1000,
      });

      receivableService.createReceivablesForSale({
        customerId: customer.id,
        totalAmount: 300,
        installmentsCount: 3,
        firstDueDate: '2026-12-10',
      });

      const resAll = await app.inject({
        method: 'GET',
        url: `/api/credit/receivables/customer/${customer.id}`,
      });
      expect(resAll.statusCode).toBe(200);
      const recsAll = JSON.parse(resAll.body);
      expect(recsAll.length).toBe(3);

      const resOpen = await app.inject({
        method: 'GET',
        url: `/api/credit/receivables/customer/${customer.id}?status=OPEN`,
      });
      expect(resOpen.statusCode).toBe(200);
      const recsOpen = JSON.parse(resOpen.body);
      expect(recsOpen.length).toBe(3);
    });

    it('POST /api/credit/receivables/pay should settle installments and return receipt, 400 if already paid', async () => {
      const customer = customerService.createCustomer({
        storeId: 1,
        name: 'Katia Pagadora',
        cpf: '909.909.909-09',
        creditLimit: 1000,
      });

      const recs = receivableService.createReceivablesForSale({
        customerId: customer.id,
        totalAmount: 200,
        installmentsCount: 2,
        firstDueDate: '2026-12-10',
      });

      // 1. Quitar parcela 1
      const resPay = await app.inject({
        method: 'POST',
        url: '/api/credit/receivables/pay',
        payload: {
          receivableIds: [recs[0].id],
          paymentMethod: 'DINHEIRO',
          operatorName: 'Caixa Operador',
        },
      });
      expect(resPay.statusCode).toBe(200);
      const payResult = JSON.parse(resPay.body);
      expect(payResult.totalPaid).toBe(100);
      expect(payResult.remainingDebt).toBe(100);
      expect(payResult.receiptText).toBeDefined();
      expect(payResult.receiptText).toContain('Katia Pagadora');

      // 2. Tentar quitar a mesma parcela -> 400 RECEIVABLE_ALREADY_PAID
      const resPayDup = await app.inject({
        method: 'POST',
        url: '/api/credit/receivables/pay',
        payload: {
          receivableIds: [recs[0].id],
          paymentMethod: 'PIX',
        },
      });
      expect(resPayDup.statusCode).toBe(400);

      // 3. Tentar quitar lista vazia -> 400
      const resPayEmpty = await app.inject({
        method: 'POST',
        url: '/api/credit/receivables/pay',
        payload: {
          receivableIds: [],
          paymentMethod: 'DINHEIRO',
        },
      });
      expect(resPayEmpty.statusCode).toBe(400);
    });

    it('GET /api/credit/receivables/sale/:saleId/promissory should return thermal promissory note', async () => {
      const customer = customerService.createCustomer({
        storeId: 1,
        name: 'Lucas Promissoria',
        cpf: '121.212.121-21',
        creditLimit: 1000,
      });

      // Insere produto e lote
      const pResult = db
        .prepare(`
          INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
          VALUES ('Dipirona 500mg', '7891234567890', 'Dipirona', '100000000001', 'SEM_TARJA', 'ISENTO', 20.0, 10.0, 50.0)
        `)
        .run();
      const productId = Number(pResult.lastInsertRowid);

      const bResult = db
        .prepare(`
          INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
          VALUES (?, 'LOTE01', '2026-01-01', '2028-12-31', 100)
        `)
        .run(productId);
      const batchId = Number(bResult.lastInsertRowid);

      // Insere sessao de caixa
      const sessionResult = db
        .prepare(`
          INSERT INTO cash_sessions (operator_name, initial_cash, current_cash, status)
          VALUES ('Operador 1', 100.0, 100.0, 'OPEN')
        `)
        .run();
      const sessionId = Number(sessionResult.lastInsertRowid);

      // Insere venda no banco
      const insertSale = db.prepare(`
        INSERT INTO sales (cash_session_id, status, total_amount, discount_amount, change_amount)
        VALUES (?, 'COMPLETED', 150.0, 0.0, 0.0)
      `);
      const saleResult = insertSale.run(sessionId);
      const saleId = Number(saleResult.lastInsertRowid);

      // Insere item da venda
      db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
        VALUES (?, ?, ?, 3, 50.0, 150.0)
      `).run(saleId, productId, batchId);

      // Cria parcelas associadas à venda
      receivableService.createReceivablesForSale({
        customerId: customer.id,
        saleId,
        totalAmount: 150.0,
        installmentsCount: 2,
        firstDueDate: '2026-12-15',
      });

      const resPromissory = await app.inject({
        method: 'GET',
        url: `/api/credit/receivables/sale/${saleId}/promissory`,
      });
      expect(resPromissory.statusCode).toBe(200);
      const data = JSON.parse(resPromissory.body);
      expect(data.textReceipt).toBeDefined();
      expect(data.fullEscPos).toBeDefined();
      expect(data.textReceipt).toContain('NOTA PROMISSÓRIA / CONFISSÃO DE DÍVIDA');
      expect(data.textReceipt).toContain('Lucas Promissoria');
      expect(data.textReceipt).toContain('121.212.121-21');
      expect(data.fullEscPos).toContain('\x1B\x40');
      expect(data.fullEscPos).toContain('\x1D\x56\x41\x10');
    });
  });
});
