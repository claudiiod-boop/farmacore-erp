// FarmaCore ERP — Rotas Fastify do Módulo de Crediário e Convênios Corporativos (Fase 11)

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Database } from '../../database/connection';
import { AgreementService, AgreementError } from './agreement.service';
import { CustomerCreditService, CustomerCreditError } from './customer-credit.service';
import { ReceivableService, ReceivableError } from './receivable.service';
import {
  formatPromissoryNote,
  formatPaymentReceipt,
  formatPayrollReport,
  type PromissoryNoteItem,
  type PromissoryNoteInstallment,
} from './credit-receipt-formatter';
import type {
  CreateAgreementInput,
  UpdateAgreementInput,
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateDependentInput,
  GenerateInvoiceParams,
  ReceivableStatus,
  CustomerStatus,
} from './types';

// =========================================================================
// Schemas Zod de Validação
// =========================================================================

const createAgreementSchema = z
  .object({
    code: z.string().trim().min(1, 'Código do convênio é obrigatório'),
    companyName: z.string().trim().min(1).optional(),
    company_name: z.string().trim().min(1).optional(),
    tradeName: z.string().trim().min(1).optional(),
    trade_name: z.string().trim().min(1).optional(),
    cnpj: z.string().trim().min(1, 'CNPJ do convênio é obrigatório'),
    ie: z.string().trim().nullable().optional(),
    phone: z.string().trim().nullable().optional(),
    email: z.string().trim().nullable().optional(),
    contactName: z.string().trim().nullable().optional(),
    contact_name: z.string().trim().nullable().optional(),
    street: z.string().trim().min(1, 'Logradouro é obrigatório'),
    number: z.string().trim().min(1, 'Número é obrigatório'),
    neighborhood: z.string().trim().min(1, 'Bairro é obrigatório'),
    city: z.string().trim().min(1, 'Cidade é obrigatória'),
    state: z.string().trim().min(1, 'Estado/UF é obrigatório'),
    zipCode: z.string().trim().min(1).optional(),
    zip_code: z.string().trim().min(1).optional(),
    closingDay: z.number().int().min(1).max(31).optional(),
    closing_day: z.number().int().min(1).max(31).optional(),
    dueDay: z.number().int().min(1).max(31).optional(),
    due_day: z.number().int().min(1).max(31).optional(),
    creditLimit: z.number().min(0).optional(),
    credit_limit: z.number().min(0).optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    discount_percent: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
    is_active: z.union([z.boolean(), z.number()]).optional(),
  })
  .refine(
    (d) => (d.companyName ?? d.company_name) !== undefined && (d.companyName ?? d.company_name)!.length > 0,
    {
      message: 'Razão social (companyName) é obrigatória',
      path: ['companyName'],
    }
  )
  .refine(
    (d) => (d.tradeName ?? d.trade_name) !== undefined && (d.tradeName ?? d.trade_name)!.length > 0,
    {
      message: 'Nome fantasia (tradeName) é obrigatório',
      path: ['tradeName'],
    }
  )
  .refine(
    (d) => (d.zipCode ?? d.zip_code) !== undefined && (d.zipCode ?? d.zip_code)!.length > 0,
    {
      message: 'CEP (zipCode) é obrigatório',
      path: ['zipCode'],
    }
  );

const updateAgreementSchema = z.object({
  code: z.string().trim().min(1).optional(),
  companyName: z.string().trim().min(1).optional(),
  company_name: z.string().trim().min(1).optional(),
  tradeName: z.string().trim().min(1).optional(),
  trade_name: z.string().trim().min(1).optional(),
  cnpj: z.string().trim().min(1).optional(),
  ie: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().nullable().optional(),
  contactName: z.string().trim().nullable().optional(),
  contact_name: z.string().trim().nullable().optional(),
  street: z.string().trim().min(1).optional(),
  number: z.string().trim().min(1).optional(),
  neighborhood: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  zipCode: z.string().trim().min(1).optional(),
  zip_code: z.string().trim().min(1).optional(),
  closingDay: z.number().int().min(1).max(31).optional(),
  closing_day: z.number().int().min(1).max(31).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  due_day: z.number().int().min(1).max(31).optional(),
  creditLimit: z.number().min(0).optional(),
  credit_limit: z.number().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discount_percent: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
});

const generateInvoiceSchema = z.object({
  startDate: z.string().min(1, 'startDate é obrigatório'),
  endDate: z.string().min(1, 'endDate é obrigatório'),
  dueDate: z.string().min(1, 'dueDate é obrigatório'),
  notes: z.string().optional(),
});

const createCustomerSchema = z.object({
  storeId: z.number().int().positive().optional(),
  store_id: z.number().int().positive().optional(),
  agreementId: z.number().int().positive().nullable().optional(),
  agreement_id: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1, 'Nome do cliente é obrigatório'),
  cpf: z.string().trim().min(11, 'CPF do cliente é obrigatório'),
  rg: z.string().trim().nullable().optional(),
  birthDate: z.string().trim().nullable().optional(),
  birth_date: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().nullable().optional(),
  street: z.string().trim().nullable().optional(),
  number: z.string().trim().nullable().optional(),
  neighborhood: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  zipCode: z.string().trim().nullable().optional(),
  zip_code: z.string().trim().nullable().optional(),
  registrationNumber: z.string().trim().nullable().optional(),
  registration_number: z.string().trim().nullable().optional(),
  department: z.string().trim().nullable().optional(),
  creditLimit: z.number().min(0).optional(),
  credit_limit: z.number().min(0).optional(),
  currentDebt: z.number().min(0).optional(),
  current_debt: z.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'BLOCKED_OVERDUE', 'INACTIVE']).optional(),
  allowDependents: z.boolean().optional(),
  allow_dependents: z.union([z.boolean(), z.number()]).optional(),
  notes: z.string().trim().nullable().optional(),
});

const updateCustomerSchema = z.object({
  storeId: z.number().int().positive().optional(),
  store_id: z.number().int().positive().optional(),
  agreementId: z.number().int().positive().nullable().optional(),
  agreement_id: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).optional(),
  cpf: z.string().trim().min(11).optional(),
  rg: z.string().trim().nullable().optional(),
  birthDate: z.string().trim().nullable().optional(),
  birth_date: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().nullable().optional(),
  street: z.string().trim().nullable().optional(),
  number: z.string().trim().nullable().optional(),
  neighborhood: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  zipCode: z.string().trim().nullable().optional(),
  zip_code: z.string().trim().nullable().optional(),
  registrationNumber: z.string().trim().nullable().optional(),
  registration_number: z.string().trim().nullable().optional(),
  department: z.string().trim().nullable().optional(),
  creditLimit: z.number().min(0).optional(),
  credit_limit: z.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'BLOCKED_OVERDUE', 'INACTIVE']).optional(),
  allowDependents: z.boolean().optional(),
  allow_dependents: z.union([z.boolean(), z.number()]).optional(),
  notes: z.string().trim().nullable().optional(),
});

const createDependentSchema = z.object({
  name: z.string().trim().min(1, 'Nome do dependente é obrigatório'),
  cpf: z.string().trim().min(11, 'CPF do dependente é obrigatório'),
  relationship: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
});

const checkEligibilitySchema = z.object({
  purchaseAmount: z.number().min(0).optional(),
  purchase_amount: z.number().min(0).optional(),
  buyerCpf: z.string().trim().optional(),
  buyer_cpf: z.string().trim().optional(),
});

const payReceivablesSchema = z.object({
  receivableIds: z
    .array(z.number().int().positive())
    .min(1, 'receivableIds deve conter pelo menos um ID de parcela'),
  cashSessionId: z.number().int().positive().nullable().optional(),
  paymentMethod: z.string().trim().min(1, 'Forma de pagamento é obrigatória'),
  notes: z.string().optional(),
  operatorName: z.string().optional(),
});

// =========================================================================
// Registro de Rotas Fastify (/api/credit/*)
// =========================================================================

export function registerCreditRoutes(app: FastifyInstance, db: Database): void {
  const agreementService = new AgreementService(db);
  const customerService = new CustomerCreditService(db);
  const receivableService = new ReceivableService(db);

  // -----------------------------------------------------------------------
  // 1. Convênios Corporativos (/api/credit/agreements)
  // -----------------------------------------------------------------------

  // GET /api/credit/agreements
  app.get<{ Querystring: { activeOnly?: string | boolean } }>(
    '/api/credit/agreements',
    async (req, reply) => {
      const activeOnly = req.query?.activeOnly === 'true' || req.query?.activeOnly === true;
      const agreements = agreementService.listAgreements({ activeOnly });
      return reply.status(200).send(agreements);
    }
  );

  // POST /api/credit/agreements
  app.post('/api/credit/agreements', async (req, reply) => {
    const parseResult = createAgreementSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'Dados inválidos para convênio',
        issues: parseResult.error.issues,
      });
    }

    try {
      const created = agreementService.createAgreement(parseResult.data as CreateAgreementInput);
      return reply.status(201).send(created);
    } catch (err: any) {
      if (err instanceof AgreementError) {
        if (err.code === 'DUPLICATE_CODE' || err.code === 'DUPLICATE_CNPJ') {
          return reply.status(409).send({ error: err.code, message: err.message });
        }
        return reply.status(400).send({ error: err.code, message: err.message });
      }
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  // GET /api/credit/agreements/:id
  app.get<{ Params: { id: string } }>('/api/credit/agreements/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_ID',
        message: 'O identificador do convênio deve ser um número positivo',
      });
    }

    const agreement = agreementService.getAgreementById(id);
    if (!agreement) {
      return reply.status(404).send({
        error: 'AGREEMENT_NOT_FOUND',
        message: `Convênio com ID ${id} não encontrado`,
      });
    }

    return reply.status(200).send(agreement);
  });

  // PUT /api/credit/agreements/:id
  app.put<{ Params: { id: string } }>('/api/credit/agreements/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_ID',
        message: 'O identificador do convênio deve ser um número positivo',
      });
    }

    const parseResult = updateAgreementSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'Dados inválidos para atualização',
        issues: parseResult.error.issues,
      });
    }

    try {
      const updated = agreementService.updateAgreement(id, parseResult.data as UpdateAgreementInput);
      return reply.status(200).send(updated);
    } catch (err: any) {
      if (err instanceof AgreementError) {
        if (err.code === 'AGREEMENT_NOT_FOUND') {
          return reply.status(404).send({ error: err.code, message: err.message });
        }
        if (err.code === 'DUPLICATE_CODE' || err.code === 'DUPLICATE_CNPJ') {
          return reply.status(409).send({ error: err.code, message: err.message });
        }
        return reply.status(400).send({ error: err.code, message: err.message });
      }
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  // POST /api/credit/agreements/:id/invoices (Geração de fatura mensal)
  app.post<{ Params: { id: string } }>(
    '/api/credit/agreements/:id/invoices',
    async (req, reply) => {
      const id = Number(req.params.id);
      if (isNaN(id) || id <= 0) {
        return reply.status(400).send({
          error: 'INVALID_ID',
          message: 'O identificador do convênio deve ser um número positivo',
        });
      }

      const parseResult = generateInvoiceSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Dados inválidos para faturamento',
          issues: parseResult.error.issues,
        });
      }

      try {
        const invoice = agreementService.generateInvoice(
          id,
          parseResult.data as GenerateInvoiceParams
        );
        return reply.status(201).send(invoice);
      } catch (err: any) {
        if (err instanceof AgreementError) {
          if (err.code === 'AGREEMENT_NOT_FOUND') {
            return reply.status(404).send({ error: err.code, message: err.message });
          }
          if (err.code === 'NO_RECEIVABLES_TO_INVOICE') {
            return reply.status(400).send({ error: err.code, message: err.message });
          }
          return reply.status(400).send({ error: err.code, message: err.message });
        }
        return reply.status(500).send({ error: 'INTERNAL_ERROR', message: err.message });
      }
    }
  );

  // GET /api/credit/agreements/:id/invoices (Lista de faturas do convênio)
  app.get<{ Params: { id: string } }>(
    '/api/credit/agreements/:id/invoices',
    async (req, reply) => {
      const id = Number(req.params.id);
      if (isNaN(id) || id <= 0) {
        return reply.status(400).send({
          error: 'INVALID_ID',
          message: 'O identificador do convênio deve ser um número positivo',
        });
      }

      const invoices = agreementService.listInvoices(id);
      return reply.status(200).send(invoices);
    }
  );

  // GET /api/credit/invoices/:id (Detalhes da fatura e extrato de RH formatado)
  app.get<{ Params: { id: string } }>('/api/credit/invoices/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_ID',
        message: 'O identificador da fatura deve ser um número positivo',
      });
    }

    const invoiceDetails = agreementService.getInvoiceById(id);
    if (!invoiceDetails) {
      return reply.status(404).send({
        error: 'INVOICE_NOT_FOUND',
        message: `Fatura de convênio #${id} não encontrada`,
      });
    }

    const payrollReportFormatted = formatPayrollReport(invoiceDetails);

    return reply.status(200).send({
      ...invoiceDetails,
      payrollReport: payrollReportFormatted.textReport,
      textReceipt: payrollReportFormatted.textReceipt,
      fullEscPos: payrollReportFormatted.fullEscPos,
    });
  });

  // -----------------------------------------------------------------------
  // 2. Clientes e Limites (/api/credit/customers)
  // -----------------------------------------------------------------------

  // GET /api/credit/customers
  app.get<{
    Querystring: {
      search?: string;
      agreementId?: string;
      status?: CustomerStatus;
      page?: string;
      limit?: string;
    };
  }>('/api/credit/customers', async (req, reply) => {
    const agreementId = req.query.agreementId ? Number(req.query.agreementId) : undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const result = customerService.listCustomers({
      search: req.query.search,
      agreementId,
      status: req.query.status,
      page,
      limit,
    });

    return reply.status(200).send(result);
  });

  // POST /api/credit/customers
  app.post('/api/credit/customers', async (req, reply) => {
    const parseResult = createCustomerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'Dados inválidos para cliente',
        issues: parseResult.error.issues,
      });
    }

    try {
      const created = customerService.createCustomer(parseResult.data as CreateCustomerInput);
      return reply.status(201).send(created);
    } catch (err: any) {
      if (err instanceof CustomerCreditError) {
        if (err.code === 'DUPLICATE_CPF') {
          return reply.status(409).send({ error: err.code, message: err.message });
        }
        if (err.code === 'STORE_NOT_FOUND' || err.code === 'AGREEMENT_NOT_FOUND') {
          return reply.status(404).send({ error: err.code, message: err.message });
        }
        return reply.status(400).send({ error: err.code, message: err.message });
      }
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  // GET /api/credit/customers/by-cpf/:cpf
  app.get<{ Params: { cpf: string } }>(
    '/api/credit/customers/by-cpf/:cpf',
    async (req, reply) => {
      const cpf = req.params.cpf;
      const customer = customerService.getCustomerByCpf(cpf);
      if (!customer) {
        return reply.status(404).send({
          error: 'CUSTOMER_NOT_FOUND',
          message: 'Cliente não encontrado com o CPF informado',
        });
      }
      return reply.status(200).send(customer);
    }
  );

  // GET /api/credit/customers/:id
  app.get<{ Params: { id: string } }>('/api/credit/customers/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_ID',
        message: 'O identificador do cliente deve ser um número positivo',
      });
    }

    const customer = customerService.getCustomerById(id);
    if (!customer) {
      return reply.status(404).send({
        error: 'CUSTOMER_NOT_FOUND',
        message: `Cliente com ID ${id} não encontrado`,
      });
    }

    return reply.status(200).send(customer);
  });

  // PUT /api/credit/customers/:id
  app.put<{ Params: { id: string } }>('/api/credit/customers/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_ID',
        message: 'O identificador do cliente deve ser um número positivo',
      });
    }

    const parseResult = updateCustomerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'Dados inválidos para atualização',
        issues: parseResult.error.issues,
      });
    }

    try {
      const updated = customerService.updateCustomer(id, parseResult.data as UpdateCustomerInput);
      return reply.status(200).send(updated);
    } catch (err: any) {
      if (err instanceof CustomerCreditError) {
        if (err.code === 'CUSTOMER_NOT_FOUND') {
          return reply.status(404).send({ error: err.code, message: err.message });
        }
        if (err.code === 'DUPLICATE_CPF') {
          return reply.status(409).send({ error: err.code, message: err.message });
        }
        return reply.status(400).send({ error: err.code, message: err.message });
      }
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  // POST /api/credit/customers/:id/dependents
  app.post<{ Params: { id: string } }>(
    '/api/credit/customers/:id/dependents',
    async (req, reply) => {
      const customerId = Number(req.params.id);
      if (isNaN(customerId) || customerId <= 0) {
        return reply.status(400).send({
          error: 'INVALID_ID',
          message: 'O identificador do titular deve ser um número positivo',
        });
      }

      const parseResult = createDependentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Dados inválidos para dependente',
          issues: parseResult.error.issues,
        });
      }

      try {
        const dependent = customerService.addDependent(
          customerId,
          parseResult.data as CreateDependentInput
        );
        return reply.status(201).send(dependent);
      } catch (err: any) {
        if (err instanceof CustomerCreditError) {
          if (err.code === 'CUSTOMER_NOT_FOUND') {
            return reply.status(404).send({ error: err.code, message: err.message });
          }
          if (err.code === 'DEPENDENTS_NOT_ALLOWED') {
            return reply.status(400).send({ error: err.code, message: err.message });
          }
          return reply.status(400).send({ error: err.code, message: err.message });
        }
        return reply.status(500).send({ error: 'INTERNAL_ERROR', message: err.message });
      }
    }
  );

  // DELETE /api/credit/customers/dependents/:id
  app.delete<{ Params: { id: string } }>(
    '/api/credit/customers/dependents/:id',
    async (req, reply) => {
      const dependentId = Number(req.params.id);
      if (isNaN(dependentId) || dependentId <= 0) {
        return reply.status(400).send({
          error: 'INVALID_ID',
          message: 'O identificador do dependente deve ser um número positivo',
        });
      }

      try {
        customerService.removeDependent(dependentId);
        return reply.status(200).send({ success: true, message: 'Dependente desativado com sucesso' });
      } catch (err: any) {
        if (err instanceof CustomerCreditError) {
          if (err.code === 'DEPENDENT_NOT_FOUND') {
            return reply.status(404).send({ error: err.code, message: err.message });
          }
          return reply.status(400).send({ error: err.code, message: err.message });
        }
        return reply.status(500).send({ error: 'INTERNAL_ERROR', message: err.message });
      }
    }
  );

  // POST /api/credit/customers/:id/check-eligibility
  app.post<{ Params: { id: string } }>(
    '/api/credit/customers/:id/check-eligibility',
    async (req, reply) => {
      const customerId = Number(req.params.id);
      if (isNaN(customerId) || customerId <= 0) {
        return reply.status(400).send({
          error: 'INVALID_ID',
          message: 'O identificador do cliente deve ser um número positivo',
        });
      }

      const parseResult = checkEligibilitySchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Parâmetros inválidos para verificação',
          issues: parseResult.error.issues,
        });
      }

      const purchaseAmount =
        parseResult.data.purchaseAmount ?? parseResult.data.purchase_amount ?? 0;
      const buyerCpf = parseResult.data.buyerCpf ?? parseResult.data.buyer_cpf;

      try {
        const eligibility = customerService.checkCreditEligibility(
          customerId,
          purchaseAmount,
          buyerCpf
        );
        return reply.status(200).send(eligibility);
      } catch (err: any) {
        if (err instanceof CustomerCreditError) {
          if (err.code === 'CUSTOMER_NOT_FOUND') {
            return reply.status(404).send({ error: err.code, message: err.message });
          }
          return reply.status(400).send({ error: err.code, message: err.message });
        }
        return reply.status(500).send({ error: 'INTERNAL_ERROR', message: err.message });
      }
    }
  );

  // -----------------------------------------------------------------------
  // 3. Contas a Receber / PDV (/api/credit/receivables)
  // -----------------------------------------------------------------------

  // GET /api/credit/receivables/customer/:customerId
  app.get<{
    Params: { customerId: string };
    Querystring: { status?: ReceivableStatus };
  }>('/api/credit/receivables/customer/:customerId', async (req, reply) => {
    const customerId = Number(req.params.customerId);
    if (isNaN(customerId) || customerId <= 0) {
      return reply.status(400).send({
        error: 'INVALID_CUSTOMER_ID',
        message: 'O identificador do cliente deve ser um número positivo',
      });
    }

    try {
      const receivables = receivableService.getCustomerReceivables(
        customerId,
        req.query?.status
      );
      return reply.status(200).send(receivables);
    } catch (err: any) {
      if (err instanceof ReceivableError && err.code === 'CUSTOMER_NOT_FOUND') {
        return reply.status(404).send({ error: err.code, message: err.message });
      }
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  // POST /api/credit/receivables/pay
  app.post('/api/credit/receivables/pay', async (req, reply) => {
    const parseResult = payReceivablesSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'Dados inválidos para quitação',
        issues: parseResult.error.issues,
      });
    }

    try {
      const result = receivableService.receivePayment(parseResult.data);

      // Gera comprovante térmico ESC/POS
      const formatted = formatPaymentReceipt({
        customer: result.customer,
        paidReceivables: result.paidReceivables,
        totalPaid: result.totalPaid,
        remainingDebt: result.remainingDebt,
        availableLimit: result.availableLimit,
        paymentMethod: parseResult.data.paymentMethod,
        cashSessionId: parseResult.data.cashSessionId,
        operatorName: parseResult.data.operatorName,
        paidAt: new Date().toISOString(),
      });

      return reply.status(200).send({
        ...result,
        textReceipt: formatted.textReceipt,
        fullEscPos: formatted.fullEscPos,
        escposPayload: formatted.fullEscPos,
      });
    } catch (err: any) {
      if (err instanceof ReceivableError) {
        if (
          err.code === 'RECEIVABLE_ALREADY_PAID' ||
          err.code === 'EMPTY_PAYMENT_LIST' ||
          err.code === 'MULTIPLE_CUSTOMERS_IN_RECEIPT' ||
          err.code.startsWith('INVALID_')
        ) {
          return reply.status(400).send({ error: err.code, message: err.message });
        }
        if (
          err.code === 'RECEIVABLE_NOT_FOUND' ||
          err.code === 'CUSTOMER_NOT_FOUND'
        ) {
          return reply.status(404).send({ error: err.code, message: err.message });
        }
        return reply.status(400).send({ error: err.code, message: err.message });
      }
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  // GET /api/credit/receivables/sale/:saleId/promissory
  app.get<{
    Params: { saleId: string };
    Querystring: { dependentId?: string };
  }>('/api/credit/receivables/sale/:saleId/promissory', async (req, reply) => {
    const saleId = Number(req.params.saleId);
    if (isNaN(saleId) || saleId <= 0) {
      return reply.status(400).send({
        error: 'INVALID_SALE_ID',
        message: 'O identificador da venda deve ser um número positivo',
      });
    }

    // Busca parcelas da venda
    const recRows = db
      .prepare('SELECT * FROM customer_receivables WHERE sale_id = ? ORDER BY installment_number ASC')
      .all(saleId) as any[];

    if (!recRows || recRows.length === 0) {
      return reply.status(404).send({
        error: 'NO_RECEIVABLES_FOR_SALE',
        message: `Nenhuma parcela de crediário encontrada para a venda #${saleId}`,
      });
    }

    const customerId = recRows[0].customer_id;
    const customer = customerService.getCustomerById(customerId);
    if (!customer) {
      return reply.status(404).send({
        error: 'CUSTOMER_NOT_FOUND',
        message: `Cliente #${customerId} associado à venda não encontrado`,
      });
    }

    // Busca venda
    const saleRow = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as any;
    if (!saleRow) {
      return reply.status(404).send({
        error: 'SALE_NOT_FOUND',
        message: `Venda #${saleId} não encontrada`,
      });
    }

    // Busca itens da venda
    const itemRows = db
      .prepare(
        `SELECT si.*, p.name AS product_name 
         FROM sale_items si
         JOIN products p ON p.id = si.product_id
         WHERE si.sale_id = ?`
      )
      .all(saleId) as any[];

    const items: PromissoryNoteItem[] = itemRows.map((r) => ({
      productName: r.product_name,
      quantity: Number(r.quantity),
      unitPrice: Number(r.unit_price),
      totalPrice: Number(r.total_price),
    }));

    const installments: PromissoryNoteInstallment[] = recRows.map((r) => ({
      installmentNumber: Number(r.installment_number),
      totalInstallments: Number(r.total_installments),
      dueDate: r.due_date,
      amount: Number(r.original_amount),
    }));

    // Verifica dependente comprador se informado
    let dependent = null;
    if (req.query?.dependentId) {
      const depId = Number(req.query.dependentId);
      const foundDep = customer.dependents?.find((d) => d.id === depId);
      if (foundDep) {
        dependent = {
          name: foundDep.name,
          cpf: foundDep.cpf,
          relationship: foundDep.relationship,
        };
      }
    }

    const formatted = formatPromissoryNote({
      saleId,
      saleDate: saleRow.created_at,
      customer: {
        name: customer.name,
        cpf: customer.cpf,
        rg: customer.rg,
        address: customer.street
          ? `${customer.street}, ${customer.number || 'S/N'} - ${customer.neighborhood || ''}, ${customer.city || ''} - ${customer.state || ''}`
          : null,
      },
      dependent,
      items,
      totalAmount: Number(saleRow.total_amount),
      installments,
      agreementName: customer.agreement?.tradeName ?? customer.agreement?.companyName ?? null,
    });

    return reply.status(200).send({
      saleId,
      customer,
      installments,
      textReceipt: formatted.textReceipt,
      fullEscPos: formatted.fullEscPos,
      promissoryNote: formatted.textReceipt,
    });
  });
}
