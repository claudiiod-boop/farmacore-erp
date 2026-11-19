import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Database } from '../../database/connection';
import { StoreService } from './store.service';
import type { CreateStoreInput, UpdateStoreInput } from './types';

const createStoreSchema = z
  .object({
    code: z.string().trim().min(1, 'Código da loja é obrigatório'),
    name: z.string().trim().min(1, 'Nome da loja é obrigatório'),
    companyName: z.string().trim().min(1).optional(),
    company_name: z.string().trim().min(1).optional(),
    cnpj: z.string().trim().min(1, 'CNPJ é obrigatório'),
    ie: z.string().trim().min(1, 'Inscrição Estadual é obrigatória'),
    isHeadquarters: z.boolean().optional(),
    is_headquarters: z.union([z.boolean(), z.number()]).optional(),
    phone: z.string().trim().nullable().optional(),
    email: z.string().trim().nullable().optional(),
    street: z.string().trim().min(1, 'Logradouro é obrigatório'),
    number: z.string().trim().min(1, 'Número é obrigatório'),
    neighborhood: z.string().trim().min(1, 'Bairro é obrigatório'),
    city: z.string().trim().min(1, 'Cidade é obrigatória'),
    state: z.string().trim().min(1, 'Estado/UF é obrigatório'),
    zipCode: z.string().trim().min(1).optional(),
    zip_code: z.string().trim().min(1).optional(),
    ibgeCode: z.string().trim().min(1).optional(),
    ibge_code: z.string().trim().min(1).optional(),
    taxRegime: z.string().trim().optional(),
    tax_regime: z.string().trim().optional(),
    isActive: z.boolean().optional(),
    is_active: z.union([z.boolean(), z.number()]).optional(),
  })
  .refine((d) => (d.companyName ?? d.company_name) !== undefined && (d.companyName ?? d.company_name)!.length > 0, {
    message: 'Razão social (companyName) é obrigatória',
    path: ['companyName'],
  })
  .refine((d) => (d.zipCode ?? d.zip_code) !== undefined && (d.zipCode ?? d.zip_code)!.length > 0, {
    message: 'CEP (zipCode) é obrigatório',
    path: ['zipCode'],
  })
  .refine((d) => (d.ibgeCode ?? d.ibge_code) !== undefined && (d.ibgeCode ?? d.ibge_code)!.length > 0, {
    message: 'Código IBGE (ibgeCode) é obrigatório',
    path: ['ibgeCode'],
  });

const updateStoreSchema = z.object({
  code: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  companyName: z.string().trim().min(1).optional(),
  company_name: z.string().trim().min(1).optional(),
  cnpj: z.string().trim().min(1).optional(),
  ie: z.string().trim().min(1).optional(),
  isHeadquarters: z.boolean().optional(),
  is_headquarters: z.union([z.boolean(), z.number()]).optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().nullable().optional(),
  street: z.string().trim().min(1).optional(),
  number: z.string().trim().min(1).optional(),
  neighborhood: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  zipCode: z.string().trim().min(1).optional(),
  zip_code: z.string().trim().min(1).optional(),
  ibgeCode: z.string().trim().min(1).optional(),
  ibge_code: z.string().trim().min(1).optional(),
  taxRegime: z.string().trim().optional(),
  tax_regime: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
});

function isConflictError(msg: string): boolean {
  return (
    msg.includes('CNPJ já cadastrado') ||
    msg.includes('Código de loja já cadastrado') ||
    msg.includes('Já existe uma loja definida como Matriz')
  );
}

export function registerStoreRoutes(app: FastifyInstance, db: Database): void {
  const storeService = new StoreService(db);

  // GET /api/stores - List all stores
  app.get<{ Querystring: { activeOnly?: string | boolean } }>('/api/stores', async (req, reply) => {
    const activeOnly = req.query?.activeOnly === 'true' || req.query?.activeOnly === true;
    const stores = storeService.listStores({ activeOnly });
    return reply.status(200).send(stores);
  });

  // GET /api/stores/network-stock/:productId - Aggregated network stock
  app.get<{ Params: { productId: string } }>(
    '/api/stores/network-stock/:productId',
    async (req, reply) => {
      const productId = Number(req.params.productId);
      if (isNaN(productId) || productId <= 0) {
        return reply.status(400).send({
          error: 'INVALID_PRODUCT_ID',
          message: 'O identificador do produto deve ser um número positivo',
        });
      }

      const stock = storeService.getNetworkProductStock(productId);
      return reply.status(200).send(stock);
    }
  );

  // GET /api/stores/:id - Get store by ID
  app.get<{ Params: { id: string } }>('/api/stores/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_STORE_ID',
        message: 'O identificador da loja deve ser um número positivo',
      });
    }

    const store = storeService.getStoreById(id);
    if (!store) {
      return reply.status(404).send({
        error: 'STORE_NOT_FOUND',
        message: `Loja com ID ${id} não encontrada`,
      });
    }

    return reply.status(200).send(store);
  });

  // POST /api/stores - Create new store
  app.post('/api/stores', async (req: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createStoreSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'Dados inválidos para cadastro de loja',
        issues: parseResult.error.issues,
      });
    }

    try {
      const created = storeService.createStore(parseResult.data as CreateStoreInput);
      return reply.status(201).send(created);
    } catch (err: any) {
      const msg = err.message || 'Erro ao cadastrar loja';
      if (isConflictError(msg)) {
        return reply.status(409).send({
          error: 'CONFLICT',
          message: msg,
        });
      }
      return reply.status(400).send({
        error: 'STORE_CREATION_FAILED',
        message: msg,
      });
    }
  });

  // PUT /api/stores/:id - Update existing store
  app.put<{ Params: { id: string } }>('/api/stores/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({
        error: 'INVALID_STORE_ID',
        message: 'O identificador da loja deve ser um número positivo',
      });
    }

    const parseResult = updateStoreSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parseResult.error.issues[0]?.message || 'Dados inválidos para atualização de loja',
        issues: parseResult.error.issues,
      });
    }

    try {
      const updated = storeService.updateStore(id, parseResult.data as UpdateStoreInput);
      return reply.status(200).send(updated);
    } catch (err: any) {
      const msg = err.message || 'Erro ao atualizar loja';
      if (msg.includes('Loja não encontrada')) {
        return reply.status(404).send({
          error: 'STORE_NOT_FOUND',
          message: msg,
        });
      }
      if (isConflictError(msg)) {
        return reply.status(409).send({
          error: 'CONFLICT',
          message: msg,
        });
      }
      return reply.status(400).send({
        error: 'STORE_UPDATE_FAILED',
        message: msg,
      });
    }
  });
}
