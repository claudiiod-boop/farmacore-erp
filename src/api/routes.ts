import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Database } from '../database/connection';
import { CatalogService } from '../modules/catalog/catalog.service';
import { CreateProductDTO } from '../modules/catalog/types';
import { InventoryService } from '../modules/inventory/inventory.service';
import { AddBatchDTO } from '../modules/inventory/types';
import { PreSaleService } from '../modules/counter/pre-sale.service';
import { CreatePreSaleDTO } from '../modules/counter/types';
import { PosService } from '../modules/pos/pos.service';
import { formatReceipt } from '../modules/pos/receipt-formatter';
import { CashMovementType, CheckoutParams } from '../modules/pos/types';
import { FiscalService } from '../modules/fiscal/fiscal.service';
import { FiscalProfile } from '../modules/fiscal/types';
import { PurchaseService, PurchaseImportError } from '../modules/purchases/purchase.service';
import { NfeParseError } from '../modules/purchases/nfe-parser';
import { SngpcService } from '../modules/sngpc/sngpc.service';
import { SngpcMovementType } from '../modules/sngpc/types';

const previewXmlSchema = z.object({
  xmlContent: z.string().trim().min(1, 'xmlContent é obrigatório'),
});

const importXmlSchema = z.object({
  xmlContent: z.string().trim().min(1, 'xmlContent é obrigatório'),
  autoRegisterProducts: z.boolean().optional(),
  itemClassifications: z
    .record(
      z.string(),
      z.object({
        stripe: z.string(),
        controlType: z.string(),
      })
    )
    .optional(),
});

const sngpcGenerateXmlSchema = z.object({
  startDate: z.string().trim().min(1, 'startDate é obrigatório'),
  endDate: z.string().trim().min(1, 'endDate é obrigatório'),
  pharmacistName: z.string().trim().min(1, 'pharmacistName é obrigatório'),
  pharmacistCpf: z.string().trim().min(1, 'pharmacistCpf é obrigatório'),
  pharmacistCrf: z.string().trim().min(1, 'pharmacistCrf é obrigatório'),
  pharmacistCrfUf: z.string().trim().min(1, 'pharmacistCrfUf é obrigatório'),
});

export async function registerRoutes(app: FastifyInstance, db: Database): Promise<void> {
  const catalogService = new CatalogService(db);
  const inventoryService = new InventoryService(db);
  const preSaleService = new PreSaleService(db, catalogService, inventoryService);
  const sngpcService = new SngpcService(db);
  const purchaseService = new PurchaseService(db, sngpcService);
  const posService = new PosService(db, preSaleService, inventoryService, sngpcService);
  const fiscalService = new FiscalService(db);

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
    Params: { id: string };
    Body: {
      type: CashMovementType;
      amount: number;
      reason: string;
      operatorName: string;
    };
  }>('/api/pos/sessions/:id/movements', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return reply.status(400).send({
        error: 'INVALID_SESSION_ID',
        message: 'Id da sessão deve ser numérico',
      });
    }

    try {
      const { type, amount, reason, operatorName } = req.body || {};
      const movement = posService.registerCashMovement(id, type, amount, reason, operatorName);
      return reply.status(201).send(movement);
    } catch (err: any) {
      if (err.message === 'INSUFFICIENT_DRAWER_CASH') {
        return reply.status(400).send({
          error: 'INSUFFICIENT_DRAWER_CASH',
          message: 'Saldo em dinheiro na gaveta insuficiente para realizar a sangria',
        });
      }
      if (err.message === 'SESSION_NOT_OPEN') {
        return reply.status(400).send({
          error: 'SESSION_NOT_OPEN',
          message: 'A sessão informada não está aberta',
        });
      }
      if (err.message === 'INVALID_AMOUNT') {
        return reply.status(400).send({
          error: 'INVALID_AMOUNT',
          message: 'Valor da movimentação inválido',
        });
      }
      if (err.message === 'INVALID_REASON') {
        return reply.status(400).send({
          error: 'INVALID_REASON',
          message: 'Motivo da movimentação é obrigatório',
        });
      }
      if (err.message === 'INVALID_OPERATOR') {
        return reply.status(400).send({
          error: 'INVALID_OPERATOR',
          message: 'Nome do operador é obrigatório',
        });
      }
      return reply.status(400).send({
        error: err.message || 'MOVEMENT_FAILED',
        message: err.message,
      });
    }
  });

  app.get<{ Params: { id: string } }>('/api/pos/sessions/:id/movements', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return reply.status(400).send({
        error: 'INVALID_SESSION_ID',
        message: 'Id da sessão deve ser numérico',
      });
    }

    const movements = posService.getCashMovements(id);
    return reply.status(200).send(movements);
  });

  app.get<{ Params: { id: string } }>('/api/pos/sessions/:id/summary', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return reply.status(400).send({
        error: 'INVALID_SESSION_ID',
        message: 'Id da sessão deve ser numérico',
      });
    }

    try {
      const summary = posService.getSessionSummary(id);
      return reply.status(200).send(summary);
    } catch (err: any) {
      if (err.message === 'SESSION_NOT_OPEN') {
        return reply.status(400).send({
          error: 'SESSION_NOT_OPEN',
          message: 'A sessão informada não está aberta',
        });
      }
      return reply.status(400).send({
        error: err.message || 'SUMMARY_FAILED',
        message: err.message,
      });
    }
  });

  app.post<{
    Body: CheckoutParams;
  }>('/api/pos/checkout', async (req, reply) => {
    try {
      const sale = posService.checkout(req.body);
      const receiptText = formatReceipt(sale);
      return reply.status(200).send({ sale, receiptText });
    } catch (err: any) {
      if (err.message === 'CONTROLLED_DRUG_DIRECT_SALE_FORBIDDEN') {
        return reply.status(400).send({
          error: 'CONTROLLED_DRUG_DIRECT_SALE_FORBIDDEN',
          message:
            'Venda direta no caixa é permitida apenas para produtos isentos de retenção de receita.',
        });
      }
      if (err.message === 'EMPTY_CHECKOUT') {
        return reply.status(400).send({
          error: 'EMPTY_CHECKOUT',
          message:
            'O checkout deve conter ao menos uma pré-venda ou itens adicionais de conveniência',
        });
      }
      if (err.message === 'INSUFFICIENT_BATCH_STOCK') {
        return reply.status(400).send({
          error: 'INSUFFICIENT_BATCH_STOCK',
          message: 'Estoque insuficiente para o lote selecionado',
        });
      }
      if (err.message === 'BATCH_EXPIRED') {
        return reply.status(400).send({
          error: 'BATCH_EXPIRED',
          message: 'Lote com data de validade vencida',
        });
      }
      if (err.message === 'PRODUCT_NOT_FOUND') {
        return reply.status(404).send({
          error: 'PRODUCT_NOT_FOUND',
          message: 'Produto não encontrado',
        });
      }
      if (err.message === 'PRE_SALE_NOT_FOUND') {
        return reply.status(404).send({
          error: 'PRE_SALE_NOT_FOUND',
          message: `Pré-venda ${req.body?.preSaleCode ?? ''} não encontrada`,
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
          message: 'O valor total pago é inferior ao valor da venda',
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
      if (err.message === 'NO_PAYMENT_PROVIDED') {
        return reply.status(400).send({
          error: 'NO_PAYMENT_PROVIDED',
          message: 'Nenhum pagamento informado',
        });
      }
      if (err.message === 'INVALID_PAYMENT_AMOUNT') {
        return reply.status(400).send({
          error: 'INVALID_PAYMENT_AMOUNT',
          message: 'Valor ou método de pagamento inválido',
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

  // ===================== FISCAL / NFC-E =====================
  app.get('/api/fiscal/profile', async (_req, reply) => {
    const profile = fiscalService.getFiscalProfile();
    return reply.status(200).send(profile ?? { profile: null });
  });

  app.put<{ Body: Partial<FiscalProfile> }>('/api/fiscal/profile', async (req, reply) => {
    try {
      const updated = fiscalService.updateFiscalProfile(req.body || {});
      return reply.status(200).send(updated);
    } catch (err: any) {
      return reply.status(400).send({
        error: err.message || 'PROFILE_UPDATE_FAILED',
        message: err.message,
      });
    }
  });

  app.post<{ Body: { saleId: number; offlineContingency?: boolean } }>(
    '/api/fiscal/nfce/issue',
    async (req, reply) => {
      const saleId = Number(req.body?.saleId);
      if (!saleId || isNaN(saleId) || saleId <= 0) {
        return reply.status(400).send({
          error: 'INVALID_SALE_ID',
          message: 'O identificador da venda deve ser um número válido',
        });
      }

      try {
        const details = await fiscalService.issueNfce(saleId, {
          offlineContingency: req.body?.offlineContingency,
        });
        return reply.status(201).send(details);
      } catch (err: any) {
        if (err.message === 'FISCAL_PROFILE_NOT_CONFIGURED') {
          return reply.status(400).send({
            error: 'FISCAL_PROFILE_NOT_CONFIGURED',
            message: 'Perfil fiscal não configurado',
          });
        }
        if (err.message === 'SALE_NOT_FOUND') {
          return reply.status(404).send({
            error: 'SALE_NOT_FOUND',
            message: 'Venda não encontrada',
          });
        }
        if (err.message === 'NFCE_ALREADY_ISSUED') {
          return reply.status(400).send({
            error: 'NFCE_ALREADY_ISSUED',
            message: 'NFC-e já emitida para esta venda',
          });
        }
        return reply.status(400).send({
          error: err.message || 'NFCE_ISSUE_FAILED',
          message: err.message,
        });
      }
    }
  );

  app.get<{ Params: { saleId: string } }>('/api/fiscal/nfce/:saleId', async (req, reply) => {
    const saleId = Number(req.params.saleId);
    if (isNaN(saleId) || saleId <= 0) {
      return reply.status(400).send({
        error: 'INVALID_ID',
        message: 'Identificador de venda inválido',
      });
    }

    const details = fiscalService.getNfceBySaleId(saleId);
    if (!details) {
      return reply.status(404).send({
        error: 'NFCE_NOT_FOUND',
        message: 'NFC-e não encontrada para esta venda',
      });
    }

    return reply.status(200).send(details);
  });

  app.get<{ Params: { saleId: string } }>('/api/fiscal/nfce/:saleId/xml', async (req, reply) => {
    const saleId = Number(req.params.saleId);
    if (isNaN(saleId) || saleId <= 0) {
      return reply.status(400).send({
        error: 'INVALID_ID',
        message: 'Identificador de venda inválido',
      });
    }

    const details = fiscalService.getNfceBySaleId(saleId);
    if (!details) {
      return reply.status(404).send({
        error: 'NFCE_NOT_FOUND',
        message: 'NFC-e não encontrada para esta venda',
      });
    }

    const xml = details.invoice.xmlAuthorized || details.invoice.xmlSigned;
    if (!xml) {
      return reply.status(404).send({
        error: 'XML_NOT_FOUND',
        message: 'XML da NFC-e não encontrado',
      });
    }

    reply.header('content-type', 'application/xml; charset=utf-8');
    return reply.status(200).send(xml);
  });

  app.get<{ Params: { saleId: string } }>('/api/fiscal/nfce/:saleId/danfe', async (req, reply) => {
    const saleId = Number(req.params.saleId);
    if (isNaN(saleId) || saleId <= 0) {
      return reply.status(400).send({
        error: 'INVALID_ID',
        message: 'Identificador de venda inválido',
      });
    }

    const details = fiscalService.getNfceBySaleId(saleId);
    if (!details) {
      return reply.status(404).send({
        error: 'NFCE_NOT_FOUND',
        message: 'NFC-e não encontrada para esta venda',
      });
    }

    const danfeText = details.danfeText || '';
    reply.header('content-type', 'text/plain; charset=utf-8');
    return reply.status(200).send(danfeText);
  });

  app.post<{ Params: { saleId: string }; Body: { reason: string } }>(
    '/api/fiscal/nfce/:saleId/cancel',
    async (req, reply) => {
      const saleId = Number(req.params.saleId);
      if (isNaN(saleId) || saleId <= 0) {
        return reply.status(400).send({
          error: 'INVALID_ID',
          message: 'Identificador de venda inválido',
        });
      }

      const reason = req.body?.reason;
      if (!reason || typeof reason !== 'string' || reason.trim().length < 15) {
        return reply.status(400).send({
          error: 'INVALID_CANCELLATION_REASON',
          message: 'A justificativa de cancelamento deve conter no mínimo 15 caracteres',
        });
      }

      const details = fiscalService.getNfceBySaleId(saleId);
      if (!details) {
        return reply.status(404).send({
          error: 'NFCE_NOT_FOUND',
          message: 'NFC-e não encontrada para esta venda',
        });
      }

      try {
        const result = await fiscalService.cancelNfce(saleId, reason);
        return reply.status(200).send(result);
      } catch (err: any) {
        if (err.message === 'INVALID_CANCELLATION_REASON') {
          return reply.status(400).send({
            error: 'INVALID_CANCELLATION_REASON',
            message: 'A justificativa de cancelamento deve conter no mínimo 15 caracteres',
          });
        }
        if (err.message === 'INVOICE_NOT_CANCELLABLE') {
          return reply.status(400).send({
            error: 'INVOICE_NOT_CANCELLABLE',
            message: 'Apenas notas com status AUTORIZADA podem ser canceladas',
          });
        }
        if (err.message === 'NFCE_NOT_FOUND') {
          return reply.status(404).send({
            error: 'NFCE_NOT_FOUND',
            message: 'NFC-e não encontrada para esta venda',
          });
        }
        return reply.status(400).send({
          error: err.message || 'CANCELLATION_FAILED',
          message: err.message,
        });
      }
    }
  );

  // ===================== PURCHASES =====================
  app.post<{ Body: { xmlContent: string } }>('/api/purchases/preview-xml', async (req, reply) => {
    const parseResult = previewXmlSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: parseResult.error.issues[0]?.message || 'xmlContent é obrigatório',
        code: 'INVALID_XML',
      });
    }

    try {
      const result = purchaseService.previewNfeXml(parseResult.data.xmlContent);
      return reply.status(200).send(result);
    } catch (err: any) {
      if (err instanceof NfeParseError) {
        return reply.status(400).send({
          error: err.message,
          code: err.code || 'INVALID_XML',
        });
      }
      return reply.status(400).send({
        error: err.message || 'Falha ao processar XML da NF-e',
        code: err.code || 'INVALID_XML',
      });
    }
  });

  app.post<{
    Body: {
      xmlContent: string;
      autoRegisterProducts?: boolean;
      itemClassifications?: Record<string, { stripe: string; controlType: string }>;
    };
  }>('/api/purchases/import-xml', async (req, reply) => {
    const parseResult = importXmlSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: parseResult.error.issues[0]?.message || 'Dados inválidos para importação de NF-e',
        code: 'INVALID_NFE_XML',
      });
    }

    try {
      const result = purchaseService.importNfeXml(parseResult.data.xmlContent, {
        autoRegisterProducts: parseResult.data.autoRegisterProducts,
        itemClassifications: parseResult.data.itemClassifications,
      });
      return reply.status(201).send(result);
    } catch (err: any) {
      if (err instanceof PurchaseImportError) {
        if (err.code === 'PURCHASE_INVOICE_ALREADY_IMPORTED') {
          return reply.status(409).send({
            error: err.message,
            code: err.code,
          });
        }
        if (err.code === 'PRODUCT_NOT_FOUND') {
          return reply.status(400).send({
            error: err.message,
            code: err.code,
          });
        }
        return reply.status(400).send({
          error: err.message,
          code: err.code,
        });
      }
      if (err instanceof NfeParseError) {
        return reply.status(400).send({
          error: err.message,
          code: err.code || 'INVALID_NFE_XML',
        });
      }
      return reply.status(400).send({
        error: err.message || 'Falha na importação do XML da NF-e',
        code: err.code || 'IMPORT_FAILED',
      });
    }
  });

  app.get('/api/purchases/invoices', async (_req, reply) => {
    try {
      const invoices = purchaseService.getInvoices();
      return reply.status(200).send(invoices);
    } catch (err: any) {
      return reply.status(500).send({
        error: err.message || 'Falha ao listar notas fiscais',
        code: 'PURCHASE_INVOICES_FETCH_FAILED',
      });
    }
  });

  app.get<{ Params: { id: string } }>('/api/purchases/invoices/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return reply.status(400).send({
        error: 'O identificador da nota fiscal deve ser numérico',
        code: 'INVALID_ID',
      });
    }

    const invoice = purchaseService.getInvoiceById(id);
    if (!invoice) {
      return reply.status(404).send({
        error: 'Nota fiscal não encontrada',
        code: 'PURCHASE_INVOICE_NOT_FOUND',
      });
    }

    return reply.status(200).send(invoice);
  });

  // ===================== SNGPC =====================
  app.get<{
    Querystring: {
      startDate?: string;
      endDate?: string;
      movementType?: string;
      isTransmitted?: string;
      productId?: string;
    };
  }>('/api/sngpc/movements', async (req, reply) => {
    const { startDate, endDate, movementType, isTransmitted, productId } = req.query;

    let parsedIsTransmitted: number | undefined;
    if (isTransmitted !== undefined && isTransmitted !== '') {
      parsedIsTransmitted =
        isTransmitted === '1' || isTransmitted === 'true'
          ? 1
          : isTransmitted === '0' || isTransmitted === 'false'
          ? 0
          : Number(isTransmitted);
    }

    let parsedProductId: number | undefined;
    if (productId !== undefined && productId !== '') {
      parsedProductId = Number(productId);
      if (isNaN(parsedProductId)) {
        return reply.status(400).send({
          error: 'productId deve ser numérico',
          code: 'INVALID_PARAMETERS',
        });
      }
    }

    const movements = sngpcService.getMovements({
      startDate,
      endDate,
      movementType: movementType as SngpcMovementType | undefined,
      isTransmitted: parsedIsTransmitted,
      productId: parsedProductId,
    });

    return reply.status(200).send(movements);
  });

  app.get<{
    Querystring: {
      startDate?: string;
      endDate?: string;
      productId?: string;
    };
  }>('/api/sngpc/livro', async (req, reply) => {
    const { startDate, endDate, productId } = req.query;

    if (!startDate || !endDate || startDate.trim() === '' || endDate.trim() === '') {
      return reply.status(400).send({
        error: 'startDate e endDate são obrigatórios',
        code: 'INVALID_DATE_RANGE',
      });
    }

    let parsedProductId: number | undefined;
    if (productId !== undefined && productId !== '') {
      parsedProductId = Number(productId);
      if (isNaN(parsedProductId)) {
        return reply.status(400).send({
          error: 'productId deve ser numérico',
          code: 'INVALID_PARAMETERS',
        });
      }
    }

    try {
      const livro = sngpcService.getLivroRegistro({
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        productId: parsedProductId,
      });
      return reply.status(200).send(livro);
    } catch (err: any) {
      return reply.status(400).send({
        error: err.message || 'Erro ao emitir Livro de Registro',
        code: err.code || 'LIVRO_ERROR',
      });
    }
  });

  app.post<{
    Body: {
      startDate: string;
      endDate: string;
      pharmacistName: string;
      pharmacistCpf: string;
      pharmacistCrf: string;
      pharmacistCrfUf: string;
    };
  }>('/api/sngpc/generate-xml', async (req, reply) => {
    const parseResult = sngpcGenerateXmlSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: parseResult.error.issues[0]?.message || 'Campos obrigatórios ausentes',
        code: 'INVALID_PARAMETERS',
      });
    }

    try {
      const result = sngpcService.generateWeeklyXml(parseResult.data);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({
        error: err.message || 'Falha ao gerar XML da transmissão SNGPC',
        code: err.code || 'GENERATE_XML_FAILED',
      });
    }
  });

  app.get('/api/sngpc/transmissions', async (_req, reply) => {
    const list = sngpcService.getTransmissions();
    return reply.status(200).send(list);
  });

  app.get<{ Params: { id: string } }>('/api/sngpc/transmissions/:id/xml', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return reply.status(400).send({
        error: 'O identificador da transmissão deve ser numérico',
        code: 'INVALID_ID',
      });
    }

    const transmission = sngpcService.getTransmissionById(id);
    if (!transmission) {
      return reply.status(404).send({
        error: 'Transmissão não encontrada',
        code: 'TRANSMISSION_NOT_FOUND',
      });
    }

    return reply
      .header('Content-Type', 'application/xml')
      .header('Content-Disposition', `attachment; filename="mensagemSNGPC-${transmission.id}.xml"`)
      .status(200)
      .send(transmission.xmlContent);
  });
}
