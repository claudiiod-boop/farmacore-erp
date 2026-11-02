import { FastifyInstance } from 'fastify';
import { Database } from '../database/connection';
import { CatalogService } from '../modules/catalog/catalog.service';
import { CreateProductDTO } from '../modules/catalog/types';
import { InventoryService } from '../modules/inventory/inventory.service';
import { AddBatchDTO } from '../modules/inventory/types';
import { PreSaleService } from '../modules/counter/pre-sale.service';
import { CreatePreSaleDTO } from '../modules/counter/types';
import { PosService } from '../modules/pos/pos.service';
import { formatReceipt } from '../modules/pos/receipt-formatter';
import { PaymentItem } from '../modules/pos/types';

export async function registerRoutes(app: FastifyInstance, db: Database): Promise<void> {
  const catalogService = new CatalogService(db);
  const inventoryService = new InventoryService(db);
  const preSaleService = new PreSaleService(db, catalogService, inventoryService);
  const posService = new PosService(db, preSaleService, inventoryService);

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // ===================== PRODUCTS =====================
  app.post<{ Body: CreateProductDTO }>('/api/products', async (req, reply) => {
    try {
      const product = catalogService.createProduct(req.body);
      return reply.status(201).send(product);
    } catch (err: any) {
      if (err.message === 'CMED_PMC_EXCEEDED') {
        return reply.status(400).send({
          error: 'CMED_PMC_EXCEEDED',
          message: 'O preço de venda não pode ser superior ao PMC registrado na CMED',
        });
      }
      return reply.status(400).send({
        error: err.message || 'PRODUCT_CREATION_FAILED',
        message: err.message,
      });
    }
  });

  app.get<{ Querystring: { q?: string } }>('/api/products/search', async (req, reply) => {
    const q = req.query.q || '';
    const results = catalogService.searchProducts(q);
    return reply.status(200).send(results);
  });

  app.get<{ Params: { ean: string } }>('/api/products/ean/:ean', async (req, reply) => {
    const product = catalogService.getProductByEan(req.params.ean);
    if (!product) {
      return reply.status(404).send({
        error: 'PRODUCT_NOT_FOUND',
        message: `Produto com EAN ${req.params.ean} não foi encontrado`,
      });
    }
    return reply.status(200).send(product);
  });

  app.get<{ Params: { id: string } }>('/api/products/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return reply.status(400).send({
        error: 'INVALID_ID',
        message: 'O identificador do produto deve ser um número válido',
      });
    }

    const product = catalogService.getProductById(id);
    if (!product) {
      return reply.status(404).send({
        error: 'PRODUCT_NOT_FOUND',
        message: `Produto #${id} não encontrado`,
      });
    }
    return reply.status(200).send(product);
  });

  app.patch<{ Params: { id: string }; Body: { price?: number; newPrice?: number } }>(
    '/api/products/:id/price',
    async (req, reply) => {
      const id = Number(req.params.id);
      const newPrice = req.body.price ?? req.body.newPrice;

      if (isNaN(id)) {
        return reply.status(400).send({
          error: 'INVALID_ID',
          message: 'O identificador do produto deve ser numérico',
        });
      }

      if (typeof newPrice !== 'number' || isNaN(newPrice) || newPrice < 0) {
        return reply.status(400).send({
          error: 'INVALID_PRICE',
          message: 'Preço novo inválido',
        });
      }

      try {
        const updated = catalogService.updateProductPrice(id, newPrice);
        return reply.status(200).send(updated);
      } catch (err: any) {
        if (err.message === 'PRODUCT_NOT_FOUND') {
          return reply.status(404).send({
            error: 'PRODUCT_NOT_FOUND',
            message: `Produto #${id} não encontrado`,
          });
        }
        if (err.message === 'CMED_PMC_EXCEEDED') {
          return reply.status(400).send({
            error: 'CMED_PMC_EXCEEDED',
            message: 'O novo preço excede o Preço Máximo ao Consumidor (PMC)',
          });
        }
        return reply.status(400).send({
          error: err.message || 'UPDATE_PRICE_FAILED',
          message: err.message,
        });
      }
    }
  );

  // ===================== BATCHES & INVENTORY =====================
  app.post<{ Body: AddBatchDTO }>('/api/batches', async (req, reply) => {
    try {
      const batch = inventoryService.addBatch(req.body);
      return reply.status(201).send(batch);
    } catch (err: any) {
      if (err.message === 'BATCH_EXPIRED') {
        return reply.status(400).send({
          error: 'BATCH_EXPIRED',
          message: 'Não é permitido dar entrada ou cadastrar lote com data de validade vencida',
        });
      }
      if (err.message === 'INVALID_QUANTITY') {
        return reply.status(400).send({
          error: 'INVALID_QUANTITY',
          message: 'A quantidade de entrada do lote deve ser maior que zero',
        });
      }
      return reply.status(400).send({
        error: err.message || 'ADD_BATCH_FAILED',
        message: err.message,
      });
    }
  });

  const getInventoryBatchesHandler = async (
    req: { params: { productId: string } },
    reply: any
  ) => {
    const productId = Number(req.params.productId);
    if (isNaN(productId)) {
      return reply.status(400).send({
        error: 'INVALID_PRODUCT_ID',
        message: 'O id do produto deve ser numérico',
      });
    }

    const batches = inventoryService.getAvailableBatches(productId);
    return reply.status(200).send(batches);
  };

  app.get<{ Params: { productId: string } }>(
    '/api/inventory/:productId/batches',
    getInventoryBatchesHandler
  );
  app.get<{ Params: { productId: string } }>(
    '/api/inventory/:productId',
    getInventoryBatchesHandler
  );

  // ===================== COUNTER / PRE-SALES =====================
  app.post<{ Body: CreatePreSaleDTO }>('/api/pre-sales', async (req, reply) => {
    try {
      const preSale = preSaleService.createPreSale(req.body);
      return reply.status(201).send(preSale);
    } catch (err: any) {
      if (err.message === 'PRESCRIPTION_REQUIRED') {
        return reply.status(400).send({
          error: 'PRESCRIPTION_REQUIRED',
          message:
            'A dispensação de medicamentos controlados (Portaria 344/98 / Antimicrobianos) exige dados completos de receita médica',
        });
      }
      if (err.message === 'INSUFFICIENT_BATCH_STOCK' || err.message === 'INSUFFICIENT_STOCK') {
        return reply.status(400).send({
          error: 'INSUFFICIENT_BATCH_STOCK',
          message: 'Estoque insuficiente no lote selecionado',
        });
      }
      if (err.message === 'PRODUCT_NOT_FOUND') {
        return reply.status(404).send({
          error: 'PRODUCT_NOT_FOUND',
          message: 'Produto informado não encontrado',
        });
      }
      if (err.message === 'BATCH_EXPIRED') {
        return reply.status(400).send({
          error: 'BATCH_EXPIRED',
          message: 'Lote selecionado está vencido',
        });
      }
      return reply.status(400).send({
        error: err.message || 'PRE_SALE_CREATION_FAILED',
        message: err.message,
      });
    }
  });

  app.get<{ Params: { code: string } }>('/api/pre-sales/:code', async (req, reply) => {
    const details = preSaleService.getPreSaleByCode(req.params.code);
    if (!details) {
      return reply.status(404).send({
        error: 'PRE_SALE_NOT_FOUND',
        message: `Pré-venda ${req.params.code} não encontrada`,
      });
    }
    return reply.status(200).send(details);
  });

  app.post<{ Params: { code: string } }>('/api/pre-sales/:code/cancel', async (req, reply) => {
    try {
      preSaleService.cancelPreSale(req.params.code);
      return reply.status(200).send({ message: 'Pre-sale cancelled successfully' });
    } catch (err: any) {
      if (err.message === 'PRE_SALE_NOT_FOUND') {
        return reply.status(404).send({
          error: 'PRE_SALE_NOT_FOUND',
          message: `Pré-venda ${req.params.code} não encontrada`,
        });
      }
      if (err.message === 'PRE_SALE_NOT_OPEN') {
        return reply.status(400).send({
          error: 'PRE_SALE_NOT_OPEN',
          message: 'Apenas pré-vendas com status OPEN podem ser canceladas',
        });
      }
      return reply.status(400).send({
        error: err.message || 'CANCEL_PRE_SALE_FAILED',
        message: err.message,
      });
    }
  });

  // ===================== POS / CHECKOUT & SESSIONS =====================
  app.post<{ Body: { operatorName: string; initialCash: number } }>(
    '/api/pos/sessions',
    async (req, reply) => {
      try {
        const { operatorName, initialCash } = req.body;
        const session = posService.openCashSession(operatorName, initialCash);
        return reply.status(201).send(session);
      } catch (err: any) {
        if (err.message === 'SESSION_ALREADY_OPEN') {
          return reply.status(400).send({
            error: 'SESSION_ALREADY_OPEN',
            message: 'Operador já possui uma sessão de caixa aberta',
          });
        }
        if (err.message === 'INVALID_OPERATOR') {
          return reply.status(400).send({
            error: 'INVALID_OPERATOR',
            message: 'Nome do operador de caixa inválido',
          });
        }
        if (err.message === 'INVALID_AMOUNT') {
          return reply.status(400).send({
            error: 'INVALID_AMOUNT',
            message: 'Fundo de troco inicial inválido',
          });
        }
        return reply.status(400).send({
          error: err.message || 'OPEN_SESSION_FAILED',
          message: err.message,
        });
      }
    }
  );

  app.post<{ Params: { id: string } }>('/api/pos/sessions/:id/close', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return reply.status(400).send({
        error: 'INVALID_SESSION_ID',
        message: 'Id da sessão deve ser numérico',
      });
    }

    try {
      const summary = posService.closeCashSession(id);
      return reply.status(200).send(summary);
    } catch (err: any) {
      if (err.message === 'SESSION_NOT_OPEN') {
        return reply.status(400).send({
          error: 'SESSION_NOT_OPEN',
          message: 'A sessão informada não está aberta',
        });
      }
      return reply.status(400).send({
        error: err.message || 'CLOSE_SESSION_FAILED',
        message: err.message,
      });
    }
  });

  app.get<{ Querystring: { operatorName?: string } }>(
    '/api/pos/sessions/current',
    async (req, reply) => {
      const session = posService.getCurrentSession(req.query?.operatorName);
      if (!session) {
        return reply.status(404).send({
          error: 'NO_OPEN_SESSION',
          message: 'Nenhuma sessão de caixa aberta no momento',
        });
      }
      return reply.status(200).send(session);
    }
  );

  app.post<{
    Body: { preSaleCode: string; payments: PaymentItem[]; cashSessionId?: number };
  }>('/api/pos/checkout', async (req, reply) => {
    const { preSaleCode, payments, cashSessionId } = req.body;

    try {
      const sale = posService.finalizeSaleFromPreSale(preSaleCode, payments, cashSessionId);
      const receiptText = formatReceipt(sale);
      return reply.status(200).send({ sale, receiptText });
    } catch (err: any) {
      if (err.message === 'PRE_SALE_NOT_FOUND') {
        return reply.status(404).send({
          error: 'PRE_SALE_NOT_FOUND',
          message: `Pré-venda ${preSaleCode} não encontrada`,
        });
      }
      if (err.message === 'PRE_SALE_ALREADY_CLOSED') {
        return reply.status(400).send({
          error: 'PRE_SALE_ALREADY_CLOSED',
          message: 'Esta pré-venda já foi convertida em venda ou cancelada',
        });
      }
      if (err.message === 'INSUFFICIENT_PAYMENT') {
        return reply.status(400).send({
          error: 'INSUFFICIENT_PAYMENT',
          message: 'O valor total pago é inferior ao valor da pré-venda',
        });
      }
      if (err.message === 'EXCESS_NON_CASH_PAYMENT') {
        return reply.status(400).send({
          error: 'EXCESS_NON_CASH_PAYMENT',
          message: 'Troco não pode ser gerado a partir de pagamentos não em dinheiro',
        });
      }
      if (err.message === 'SESSION_NOT_OPEN') {
        return reply.status(400).send({
          error: 'SESSION_NOT_OPEN',
          message: 'A sessão de caixa informada não está aberta',
        });
      }
      return reply.status(400).send({
        error: err.message || 'CHECKOUT_FAILED',
        message: err.message,
      });
    }
  });

  app.get<{ Params: { id: string } }>('/api/sales/:id/receipt', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return reply.status(400).send({
        error: 'INVALID_ID',
        message: 'Id da venda deve ser numérico',
      });
    }

    const sale = posService.getSaleById(id);
    if (!sale) {
      return reply.status(404).send({
        error: 'SALE_NOT_FOUND',
        message: `Venda #${id} não encontrada`,
      });
    }

    const receiptText = formatReceipt(sale);
    return reply.status(200).send({ receiptText });
  });
}
