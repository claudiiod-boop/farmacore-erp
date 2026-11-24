import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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
import { PbmService } from '../modules/pbm/pbm.service';
import { TefService } from '../modules/tef/tef.service';
import { BlindCashClosureService } from '../modules/financial/cash-closure.service';
import { TefReconciliationService } from '../modules/financial/tef-reconciliation.service';
import { FinancialReportsService } from '../modules/financial/financial-reports.service';
import { formatCashClosureReceipt } from '../modules/financial/closure-receipt-formatter';
import { registerStoreRoutes } from '../modules/stores/store.routes';
import { registerTransferRoutes } from '../modules/transfers/transfer.routes';
import { registerInventoryRoutes } from '../modules/inventory/audit.routes';
import { registerCreditRoutes } from '../modules/credit/credit.routes';
import { registerCrmRoutes } from '../modules/crm/crm.routes';
import { registerDeliveryRoutes } from '../modules/delivery/delivery.routes';
import { registerSanitaryRoutes } from '../modules/sanitary/sanitary.routes';
import { registerCardReconciliationRoutes } from '../modules/financial/card-reconciliation.routes';
import { registerBankReconciliationRoutes } from '../modules/financial/bank-reconciliation.routes';
import { registerSpedRoutes } from '../modules/fiscal/sped.routes';
import { registerClinicalRoutes } from '../modules/clinical/clinical.routes';
import { registerB2bRoutes } from '../modules/b2b/b2b.routes';
import { registerCmedRoutes } from '../modules/cmed/cmed.routes';
import { registerOmnichannelRoutes } from '../modules/omnichannel/omnichannel.routes';
import { registerCompoundingRoutes } from '../modules/compounding/compounding.routes';
import { registerSubscriptionRoutes } from '../modules/subscriptions/subscription.routes';
import { registerFractionationRoutes } from '../modules/fractionation/fractionation.routes';
import { registerCommissionRoutes } from '../modules/commissions/commission.routes';
import { registerDreRoutes } from '../modules/dre/dre.routes';
import { registerPgrssRoutes } from '../modules/pgrss/pgrss.routes';
import type {
  DeclareBlindClosureParams,
  ReviewClosureParams,
  CashClosureFilters,
  ForecastFilters,
  SettleTransactionParams,
  ReconciliationFilters,
  StoreInfo,
} from '../modules/financial/types';

const declareBlindClosureSchema = z.object({
  sessionId: z.number().int().positive('sessionId deve ser um número inteiro positivo'),
  operatorName: z.string().trim().min(1, 'operatorName é obrigatório'),
  declaredCash: z.number().min(0, 'declaredCash deve ser >= 0'),
  declaredCredit: z.number().min(0, 'declaredCredit deve ser >= 0'),
  declaredDebit: z.number().min(0, 'declaredDebit deve ser >= 0'),
  declaredPix: z.number().min(0, 'declaredPix deve ser >= 0'),
  declaredPbm: z.number().min(0, 'declaredPbm deve ser >= 0'),
  operatorNotes: z.string().optional().nullable(),
});

const reviewClosureSchema = z.object({
  managerName: z.string().trim().min(1, 'managerName é obrigatório'),
  approved: z.boolean(),
  managerNotes: z.string().optional().nullable(),
});

const settleTransactionSchema = z.object({
  nsu: z.string().trim().min(1, 'nsu é obrigatório'),
  settledAmount: z.number().min(0, 'settledAmount deve ser >= 0'),
  settledFee: z.number().min(0).optional(),
  bankAccount: z.string().optional().nullable(),
  settledAt: z.string().optional().nullable(),
});

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

const pbmAuthorizeItemSchema = z.object({
  productId: z.number().int().positive('productId deve ser um número positivo'),
  ean: z.string().trim().min(1, 'ean é obrigatório'),
  msRegistration: z.string().trim().min(1, 'msRegistration é obrigatório'),
  productName: z.string().trim().min(1, 'productName é obrigatório'),
  quantity: z.number().positive('quantity deve ser maior que zero'),
  unitPrice: z.number().nonnegative('unitPrice não pode ser negativo'),
  dailyDose: z.number().positive().optional(),
  batchId: z.number().int().positive().optional(),
});

const pbmAuthorizeSchema = z.object({
  providerId: z.string().trim().min(1).default('FARMACIA_POPULAR'),
  patientCpf: z.string().trim().min(11, 'patientCpf deve conter ao menos 11 dígitos'),
  patientName: z.string().trim().min(1, 'patientName é obrigatório'),
  patientBirthDate: z.string().trim().optional(),
  doctorCrm: z.string().trim().min(1, 'doctorCrm é obrigatório'),
  doctorUf: z.string().trim().min(2, 'doctorUf deve conter a UF com 2 caracteres'),
  doctorName: z.string().trim().optional(),
  prescriptionDate: z.string().trim().min(1, 'prescriptionDate é obrigatória'),
  proxyName: z.string().trim().optional(),
  proxyCpf: z.string().trim().optional(),
  isBolsaFamilia: z.boolean().optional(),
  cidLaudo: z.string().trim().optional(),
  items: z.array(pbmAuthorizeItemSchema).min(1, 'items deve conter ao menos um item'),
});

const pbmConfirmSchema = z.object({
  authorizationProtocol: z.string().trim().min(1, 'authorizationProtocol é obrigatório'),
  saleId: z.number().int().positive('saleId deve ser um número inteiro positivo'),
  fiscalKeyNfce: z.string().trim().optional(),
  nfceNumber: z.number().int().positive().optional(),
});

const pbmCancelSchema = z.object({
  protocol: z.string().trim().min(1, 'protocol é obrigatório'),
  reason: z.string().trim().min(1, 'reason é obrigatório'),
});

const pbmConfigUpdateSchema = z.object({
  providerName: z.string().trim().optional(),
  environment: z.enum(['PRODUCAO', 'HOMOLOGACAO', 'MOCK']).optional(),
  isActive: z.number().int().min(0).max(1).optional(),
  credentialsJson: z.string().nullable().optional(),
});

const tefPaySchema = z.object({
  amount: z.number().positive('amount deve ser maior que zero'),
  operationType: z.enum(['DEBITO', 'CREDITO', 'VOUCHER', 'PIX_TEF']),
  installments: z.number().int().min(1, 'installments deve ser ao menos 1').optional(),
  installmentType: z.enum(['A_VISTA', 'PARCELADO_LOJA', 'PARCELADO_ADM']).optional(),
  terminalId: z.string().trim().optional(),
  providerId: z.string().trim().optional(),
  saleId: z.number().int().positive().optional(),
  brandName: z.string().trim().optional(),
  mockScenario: z
    .enum(['SUCCESS', 'APPROVED', 'WRONG_PIN', 'INSUFFICIENT_FUNDS', 'TIMEOUT', 'PINPAD_TIMEOUT', 'USER_CANCELLED'])
    .optional()
    .transform((v) => {
      if (v === 'APPROVED') return 'SUCCESS';
      if (v === 'PINPAD_TIMEOUT') return 'TIMEOUT';
      return v as 'SUCCESS' | 'WRONG_PIN' | 'INSUFFICIENT_FUNDS' | 'TIMEOUT' | 'USER_CANCELLED' | undefined;
    }),
});

const tefConfirmSchema = z.object({
  nsu: z.string().trim().min(1, 'nsu é obrigatório'),
  saleId: z.number().int().positive('saleId deve ser um número inteiro positivo'),
  fiscalKeyNfce: z.string().trim().optional(),
});

const tefUndoSchema = z.object({
  nsu: z.string().trim().min(1, 'nsu é obrigatório'),
  reason: z.string().trim().min(1, 'reason é obrigatório'),
});

const tefCancelSchema = z.object({
  nsu: z.string().trim().min(1, 'nsu é obrigatório'),
  reason: z.string().trim().min(1, 'reason é obrigatório'),
});

const tefConfigUpdateSchema = z.object({
  terminalId: z.string().trim().optional(),
  merchantId: z.string().trim().nullable().optional(),
  ipAddress: z.string().trim().optional(),
  port: z.number().int().positive().optional(),
  isActive: z.union([z.number().int().min(0).max(1), z.boolean().transform((v) => (v ? 1 : 0))]).optional(),
  environment: z.enum(['PRODUCAO', 'HOMOLOGACAO', 'MOCK']).optional(),
  credentialsJson: z.string().nullable().optional(),
});

export async function registerRoutes(app: FastifyInstance, db: Database): Promise<void> {
  const catalogService = new CatalogService(db);
  const inventoryService = new InventoryService(db);
  const preSaleService = new PreSaleService(db, catalogService, inventoryService);
  const sngpcService = new SngpcService(db);
  const purchaseService = new PurchaseService(db, sngpcService);
  const posService = new PosService(db, preSaleService, inventoryService, sngpcService);
  const fiscalService = new FiscalService(db);
  const pbmService = new PbmService(db);
  posService.setPbmService(pbmService);
  const tefService = new TefService(db);
  posService.setTefService(tefService);
  const blindCashClosureService = new BlindCashClosureService(db);
  const tefReconciliationService = new TefReconciliationService(db);
  const financialReportsService = new FinancialReportsService(db);

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

  // ===================== PBM / FARMÁCIA POPULAR =====================
  app.get<{ Querystring: { onlyActive?: string } }>('/api/pbm/providers', async (req, reply) => {
    const onlyActive = req.query.onlyActive === 'true' || req.query.onlyActive === '1';
    const providers = pbmService.listConfigs(onlyActive);
    return reply.status(200).send(providers);
  });

  app.post<{ Body: unknown }>('/api/pbm/authorize', async (req, reply) => {
    const parseResult = pbmAuthorizeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: parseResult.error.issues[0]?.message || 'Parâmetros de autorização PBM inválidos',
        issues: parseResult.error.issues,
      });
    }

    try {
      const result = await pbmService.authorize(parseResult.data);
      if (!result.success) {
        return reply.status(400).send({
          error: 'PBM_AUTHORIZATION_FAILED',
          message: result.errorMessage || 'Autorização negada pelo provedor PBM',
          details: result,
        });
      }
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(400).send({
        error: 'PBM_AUTHORIZATION_ERROR',
        message: err.message || 'Erro inesperado na autorização PBM',
      });
    }
  });

  app.post<{ Body: unknown }>('/api/pbm/confirm', async (req, reply) => {
    const parseResult = pbmConfirmSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: parseResult.error.issues[0]?.message || 'Parâmetros de confirmação PBM inválidos',
        issues: parseResult.error.issues,
      });
    }

    try {
      const result = await pbmService.confirm(parseResult.data);
      if (!result.success) {
        return reply.status(400).send({
          error: 'PBM_CONFIRMATION_FAILED',
          message: result.errorMessage || 'Falha na confirmação da autorização PBM',
          details: result,
        });
      }
      return reply.status(200).send(result);
    } catch (err: any) {
      if (err.message && err.message.includes('não encontrada')) {
        return reply.status(404).send({
          error: 'PBM_TRANSACTION_NOT_FOUND',
          message: err.message,
        });
      }
      return reply.status(400).send({
        error: 'PBM_CONFIRMATION_ERROR',
        message: err.message || 'Erro inesperado na confirmação PBM',
      });
    }
  });

  app.post<{ Body: unknown }>('/api/pbm/cancel', async (req, reply) => {
    const parseResult = pbmCancelSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: parseResult.error.issues[0]?.message || 'Parâmetros de cancelamento PBM inválidos',
        issues: parseResult.error.issues,
      });
    }

    try {
      const result = await pbmService.cancel(parseResult.data.protocol, parseResult.data.reason);
      if (!result.success) {
        return reply.status(400).send({
          error: 'PBM_CANCELLATION_FAILED',
          message: result.errorMessage || 'Falha no cancelamento da autorização PBM',
          details: result,
        });
      }
      return reply.status(200).send(result);
    } catch (err: any) {
      if (err.message && err.message.includes('não encontrada')) {
        return reply.status(404).send({
          error: 'PBM_TRANSACTION_NOT_FOUND',
          message: err.message,
        });
      }
      return reply.status(400).send({
        error: 'PBM_CANCELLATION_ERROR',
        message: err.message || 'Erro inesperado no cancelamento PBM',
      });
    }
  });

  app.get<{
    Querystring: {
      startDate?: string;
      endDate?: string;
      status?: string;
      patientCpf?: string;
      limit?: string;
      offset?: string;
    };
  }>('/api/pbm/transactions', async (req, reply) => {
    const { startDate, endDate, status, patientCpf, limit, offset } = req.query;
    const result = pbmService.listTransactions({
      startDate,
      endDate,
      status,
      patientCpf,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return reply.status(200).send(result);
  });

  app.get<{ Params: { protocol: string } }>(
    '/api/pbm/transactions/:protocol/coupon',
    async (req, reply) => {
      let protocol = req.params.protocol;
      if (!protocol) {
        return reply.status(400).send({
          error: 'INVALID_PROTOCOL',
          message: 'Protocolo é obrigatório',
        });
      }

      // Se for passado ID numérico da transação, faz o de-para para o protocolo
      if (/^\d+$/.test(protocol)) {
        const rowById = db.prepare('SELECT authorization_protocol FROM pbm_transactions WHERE id = ?').get(Number(protocol)) as any;
        if (rowById?.authorization_protocol) {
          protocol = rowById.authorization_protocol;
        }
      }

      try {
        const receipt = pbmService.getReceiptText(protocol);
        return reply.status(200).send(receipt);
      } catch (err: any) {
        if (err.message && err.message.includes('não encontrada')) {
          return reply.status(404).send({
            error: 'PBM_TRANSACTION_NOT_FOUND',
            message: err.message,
          });
        }
        return reply.status(400).send({
          error: 'PBM_RECEIPT_ERROR',
          message: err.message || 'Erro ao gerar cupom PBM',
        });
      }
    }
  );

  app.get<{ Params: { providerId: string } }>(
    '/api/pbm/config/:providerId',
    async (req, reply) => {
      const config = pbmService.getConfig(req.params.providerId);
      if (!config) {
        return reply.status(404).send({
          error: 'PBM_CONFIG_NOT_FOUND',
          message: `Configuração do provedor PBM '${req.params.providerId}' não encontrada`,
        });
      }
      return reply.status(200).send(config);
    }
  );

  app.get('/api/pbm/config', async (_req, reply) => {
    const configs = pbmService.listConfigs();
    return reply.status(200).send(configs);
  });

  app.put<{ Params: { providerId: string }; Body: unknown }>(
    '/api/pbm/config/:providerId',
    async (req, reply) => {
      const parseResult = pbmConfigUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'INVALID_PARAMETERS',
          message: parseResult.error.issues[0]?.message || 'Parâmetros de configuração inválidos',
          issues: parseResult.error.issues,
        });
      }

      try {
        const updated = pbmService.updateConfig(req.params.providerId, parseResult.data);
        return reply.status(200).send(updated);
      } catch (err: any) {
        if (err.message && err.message.includes('não encontrada')) {
          return reply.status(404).send({
            error: 'PBM_CONFIG_NOT_FOUND',
            message: err.message,
          });
        }
        return reply.status(400).send({
          error: 'PBM_CONFIG_UPDATE_FAILED',
          message: err.message || 'Erro ao atualizar configuração PBM',
        });
      }
    }
  );

  app.put<{ Body: { providerId?: string; [key: string]: any } }>('/api/pbm/config', async (req, reply) => {
    const providerId = req.body?.providerId;
    if (!providerId || typeof providerId !== 'string') {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: 'providerId é obrigatório para atualização de configuração',
      });
    }

    const parseResult = pbmConfigUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: parseResult.error.issues[0]?.message || 'Parâmetros de configuração inválidos',
        issues: parseResult.error.issues,
      });
    }

    try {
      const updated = pbmService.updateConfig(providerId, parseResult.data);
      return reply.status(200).send(updated);
    } catch (err: any) {
      if (err.message && err.message.includes('não encontrada')) {
        return reply.status(404).send({
          error: 'PBM_CONFIG_NOT_FOUND',
          message: err.message,
        });
      }
      return reply.status(400).send({
        error: 'PBM_CONFIG_UPDATE_FAILED',
        message: err.message || 'Erro ao atualizar configuração PBM',
      });
    }
  });

  // ===================== TEF (TRANSFERÊNCIA ELETRÔNICA DE FUNDOS) =====================
  app.get<{ Querystring: { onlyActive?: string } }>('/api/tef/providers', async (req, reply) => {
    const onlyActive = req.query.onlyActive === 'true' || req.query.onlyActive === '1';
    const providers = tefService.listConfigs(onlyActive);
    return reply.status(200).send(providers);
  });

  app.post<{ Body: unknown }>('/api/tef/pay', async (req, reply) => {
    const parseResult = tefPaySchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: parseResult.error.issues[0]?.message || 'Parâmetros de pagamento TEF inválidos',
        issues: parseResult.error.issues,
      });
    }

    try {
      const result = await tefService.pay(parseResult.data);
      if (!result.success) {
        return reply.status(400).send({
          error: 'TEF_PAYMENT_REJECTED',
          message: result.errorMessage || 'Pagamento recusado pela adquirente ou PinPad',
          details: result,
        });
      }
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(400).send({
        error: 'TEF_PAYMENT_ERROR',
        message: err.message || 'Erro inesperado no processamento do pagamento TEF',
      });
    }
  });

  app.post<{ Body: unknown }>('/api/tef/confirm', async (req, reply) => {
    const parseResult = tefConfirmSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: parseResult.error.issues[0]?.message || 'Parâmetros de confirmação TEF inválidos',
        issues: parseResult.error.issues,
      });
    }

    try {
      const result = await tefService.confirm(parseResult.data);
      if (!result.success) {
        return reply.status(400).send({
          error: 'TEF_CONFIRMATION_FAILED',
          message: result.errorMessage || 'Falha na confirmação da transação TEF',
          details: result,
        });
      }
      return reply.status(200).send(result);
    } catch (err: any) {
      if (err.message && err.message.includes('não encontrada')) {
        return reply.status(404).send({
          error: 'TEF_TRANSACTION_NOT_FOUND',
          message: err.message,
        });
      }
      return reply.status(400).send({
        error: 'TEF_CONFIRMATION_ERROR',
        message: err.message || 'Erro inesperado na confirmação TEF',
      });
    }
  });

  app.post<{ Body: unknown }>('/api/tef/undo', async (req, reply) => {
    const parseResult = tefUndoSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: parseResult.error.issues[0]?.message || 'Parâmetros de desfazimento TEF inválidos',
        issues: parseResult.error.issues,
      });
    }

    try {
      const result = await tefService.undo(parseResult.data);
      if (!result.success) {
        return reply.status(400).send({
          error: 'TEF_UNDO_FAILED',
          message: result.errorMessage || 'Falha no desfazimento da transação TEF',
          details: result,
        });
      }
      return reply.status(200).send(result);
    } catch (err: any) {
      if (err.message && err.message.includes('não encontrada')) {
        return reply.status(404).send({
          error: 'TEF_TRANSACTION_NOT_FOUND',
          message: err.message,
        });
      }
      return reply.status(400).send({
        error: 'TEF_UNDO_ERROR',
        message: err.message || 'Erro inesperado no desfazimento TEF',
      });
    }
  });

  app.post<{ Body: unknown }>('/api/tef/cancel', async (req, reply) => {
    const parseResult = tefCancelSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: parseResult.error.issues[0]?.message || 'Parâmetros de cancelamento TEF inválidos',
        issues: parseResult.error.issues,
      });
    }

    try {
      const result = await tefService.cancel(parseResult.data);
      if (!result.success) {
        return reply.status(400).send({
          error: 'TEF_CANCELLATION_FAILED',
          message: result.errorMessage || 'Falha no cancelamento da transação TEF',
          details: result,
        });
      }
      return reply.status(200).send(result);
    } catch (err: any) {
      if (err.message && err.message.includes('não encontrada')) {
        return reply.status(404).send({
          error: 'TEF_TRANSACTION_NOT_FOUND',
          message: err.message,
        });
      }
      return reply.status(400).send({
        error: 'TEF_CANCELLATION_ERROR',
        message: err.message || 'Erro inesperado no cancelamento TEF',
      });
    }
  });

  app.get<{
    Querystring: {
      startDate?: string;
      endDate?: string;
      status?: string;
      operationType?: string;
      brandName?: string;
      acquirerName?: string;
      saleId?: string;
      terminalId?: string;
      nsu?: string;
      limit?: string;
      offset?: string;
    };
  }>('/api/tef/transactions', async (req, reply) => {
    const {
      startDate,
      endDate,
      status,
      operationType,
      brandName,
      acquirerName,
      saleId,
      terminalId,
      nsu,
      limit,
      offset,
    } = req.query;

    const result = tefService.listTransactions({
      startDate,
      endDate,
      status,
      operationType,
      brandName,
      acquirerName,
      saleId: saleId ? Number(saleId) : undefined,
      terminalId,
      nsu,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    return reply.status(200).send(result);
  });

  app.get<{ Params: { nsu: string } }>(
    '/api/tef/transactions/:nsu/receipt',
    async (req, reply) => {
      const { nsu } = req.params;
      if (!nsu) {
        return reply.status(400).send({
          error: 'INVALID_PARAMETERS',
          message: 'NSU é obrigatório',
        });
      }

      try {
        const receipt = tefService.getReceiptText(nsu);
        return reply.status(200).send(receipt);
      } catch (err: any) {
        if (err.message && err.message.includes('não encontrada')) {
          return reply.status(404).send({
            error: 'TEF_TRANSACTION_NOT_FOUND',
            message: err.message,
          });
        }
        return reply.status(400).send({
          error: 'TEF_RECEIPT_ERROR',
          message: err.message || 'Erro ao gerar comprovante TEF',
        });
      }
    }
  );

  app.get('/api/tef/config', async (_req, reply) => {
    const configs = tefService.listConfigs();
    return reply.status(200).send(configs);
  });

  app.get<{ Params: { providerId: string } }>(
    '/api/tef/config/:providerId',
    async (req, reply) => {
      const config = tefService.getConfig(req.params.providerId);
      if (!config) {
        return reply.status(404).send({
          error: 'TEF_CONFIG_NOT_FOUND',
          message: `Configuração do provedor TEF '${req.params.providerId}' não encontrada`,
        });
      }
      return reply.status(200).send(config);
    }
  );

  app.put<{ Params: { providerId: string }; Body: unknown }>(
    '/api/tef/config/:providerId',
    async (req, reply) => {
      const parseResult = tefConfigUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'INVALID_PARAMETERS',
          message: parseResult.error.issues[0]?.message || 'Parâmetros de configuração TEF inválidos',
          issues: parseResult.error.issues,
        });
      }

      try {
        const updated = tefService.updateConfig(req.params.providerId, parseResult.data);
        return reply.status(200).send(updated);
      } catch (err: any) {
        if (err.message && err.message.includes('não encontrada')) {
          return reply.status(404).send({
            error: 'TEF_CONFIG_NOT_FOUND',
            message: err.message,
          });
        }
        return reply.status(400).send({
          error: 'TEF_CONFIG_UPDATE_FAILED',
          message: err.message || 'Erro ao atualizar configuração TEF',
        });
      }
    }
  );

  app.put<{ Body: { providerId?: string; [key: string]: any } }>('/api/tef/config', async (req, reply) => {
    const providerId = req.body?.providerId;
    if (!providerId || typeof providerId !== 'string') {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: 'providerId é obrigatório para atualização de configuração TEF',
      });
    }

    const parseResult = tefConfigUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: parseResult.error.issues[0]?.message || 'Parâmetros de configuração TEF inválidos',
        issues: parseResult.error.issues,
      });
    }

    try {
      const updated = tefService.updateConfig(providerId, parseResult.data);
      return reply.status(200).send(updated);
    } catch (err: any) {
      if (err.message && err.message.includes('não encontrada')) {
        return reply.status(404).send({
          error: 'TEF_CONFIG_NOT_FOUND',
          message: err.message,
        });
      }
      return reply.status(400).send({
        error: 'TEF_CONFIG_UPDATE_FAILED',
        message: err.message || 'Erro ao atualizar configuração TEF',
      });
    }
  });

  // ===================== FINANCIAL & BLIND CASH CLOSURE =====================

  // 1. Declarar fechamento cego de caixa
  const handleDeclareBlindClosure = async (
    req: FastifyRequest<{ Body: DeclareBlindClosureParams }>,
    reply: FastifyReply
  ) => {
    const parseResult = declareBlindClosureSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: parseResult.error.issues[0]?.message || 'Parâmetros inválidos para fechamento cego de caixa',
        issues: parseResult.error.issues,
      });
    }

    try {
      const closure = blindCashClosureService.declareBlindClosure(parseResult.data);
      return reply.status(201).send(closure);
    } catch (err: any) {
      if (err.message === 'SESSION_NOT_FOUND') {
        return reply.status(404).send({ error: 'SESSION_NOT_FOUND', message: 'Sessão de caixa não encontrada' });
      }
      if (err.message === 'SESSION_ALREADY_CLOSED') {
        return reply.status(409).send({ error: 'SESSION_ALREADY_CLOSED', message: 'Sessão de caixa já foi encerrada' });
      }
      if (err.message === 'CLOSURE_ALREADY_EXISTS') {
        return reply.status(409).send({ error: 'CLOSURE_ALREADY_EXISTS', message: 'Sessão de caixa já possui fechamento declarado' });
      }
      return reply.status(400).send({
        error: 'CASH_CLOSURE_FAILED',
        message: err.message || 'Erro ao declarar fechamento de caixa',
      });
    }
  };
  app.post<{ Body: DeclareBlindClosureParams }>('/api/financial/cash-closure/declare', handleDeclareBlindClosure);
  app.post<{ Body: DeclareBlindClosureParams }>('/api/financial/cash-closures', handleDeclareBlindClosure);

  // 2. Obter fechamento pelo ID da sessao
  const handleGetClosureBySession = async (
    req: FastifyRequest<{ Params: { sessionId: string } }>,
    reply: FastifyReply
  ) => {
    const sessionId = Number(req.params.sessionId);
    if (isNaN(sessionId) || sessionId <= 0) {
      return reply.status(400).send({ error: 'INVALID_SESSION_ID', message: 'sessionId deve ser um número válido' });
    }

    const closure = blindCashClosureService.getClosureBySessionId(sessionId);
    if (!closure) {
      return reply.status(404).send({ error: 'CLOSURE_NOT_FOUND', message: 'Fechamento de caixa não encontrado para esta sessão' });
    }

    return reply.status(200).send(closure);
  };
  app.get<{ Params: { sessionId: string } }>('/api/financial/cash-closure/session/:sessionId', handleGetClosureBySession);
  app.get<{ Params: { sessionId: string } }>('/api/financial/cash-closures/by-session/:sessionId', handleGetClosureBySession);

  // 3. Obter fechamento pelo ID
  const handleGetClosureById = async (
    req: FastifyRequest<{ Params: { closureId: string } }>,
    reply: FastifyReply
  ) => {
    const closureId = Number(req.params.closureId);
    if (isNaN(closureId) || closureId <= 0) {
      return reply.status(400).send({ error: 'INVALID_CLOSURE_ID', message: 'closureId deve ser um número válido' });
    }

    const closure = blindCashClosureService.getClosureById(closureId) || blindCashClosureService.getClosureBySessionId(closureId);
    if (!closure) {
      return reply.status(404).send({ error: 'CLOSURE_NOT_FOUND', message: 'Fechamento de caixa não encontrado' });
    }

    return reply.status(200).send(closure);
  };
  app.get<{ Params: { closureId: string } }>('/api/financial/cash-closure/:closureId', handleGetClosureById);
  app.get<{ Params: { closureId: string } }>('/api/financial/cash-closures/:closureId', handleGetClosureById);

  // 4. Homologação Gerencial do Fechamento
  const handleReviewClosure = async (
    req: FastifyRequest<{ Params: { closureId: string }; Body: ReviewClosureParams }>,
    reply: FastifyReply
  ) => {
    const closureId = Number(req.params.closureId);
    if (isNaN(closureId) || closureId <= 0) {
      return reply.status(400).send({ error: 'INVALID_CLOSURE_ID', message: 'closureId deve ser um número válido' });
    }

    const parseResult = reviewClosureSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: parseResult.error.issues[0]?.message || 'Parâmetros inválidos para homologação do fechamento',
      });
    }

    try {
      const reviewed = blindCashClosureService.reviewClosure(closureId, parseResult.data);
      return reply.status(200).send(reviewed);
    } catch (err: any) {
      if (err.message === 'CLOSURE_NOT_FOUND') {
        return reply.status(404).send({ error: 'CLOSURE_NOT_FOUND', message: 'Fechamento de caixa não encontrado' });
      }
      if (err.message === 'CLOSURE_ALREADY_REVIEWED') {
        return reply.status(409).send({ error: 'CLOSURE_ALREADY_REVIEWED', message: 'Fechamento de caixa já foi homologado anteriormente' });
      }
      return reply.status(400).send({
        error: 'CLOSURE_REVIEW_FAILED',
        message: err.message || 'Erro ao homologar fechamento de caixa',
      });
    }
  };
  app.post<{ Params: { closureId: string }; Body: ReviewClosureParams }>(
    '/api/financial/cash-closure/:closureId/review',
    handleReviewClosure
  );
  app.post<{ Params: { closureId: string }; Body: ReviewClosureParams }>(
    '/api/financial/cash-closures/:closureId/review',
    handleReviewClosure
  );

  // 5. Comprovante Térmico de Fechamento de Caixa (ESC/POS 48 Colunas)
  const handleGetClosureReceipt = async (
    req: FastifyRequest<{ Params: { closureId: string }; Querystring: StoreInfo }>,
    reply: FastifyReply
  ) => {
    const closureId = Number(req.params.closureId);
    if (isNaN(closureId) || closureId <= 0) {
      return reply.status(400).send({ error: 'INVALID_CLOSURE_ID', message: 'closureId deve ser um número válido' });
    }

    const closure = blindCashClosureService.getClosureById(closureId);
    if (!closure) {
      return reply.status(404).send({ error: 'CLOSURE_NOT_FOUND', message: 'Fechamento de caixa não encontrado' });
    }

    const sessionRow = db
      .prepare<{ id: number; operator_name: string; initial_cash: number; current_cash: number; status: 'OPEN' | 'CLOSED'; opened_at: string; closed_at: string | null }>(
        'SELECT * FROM cash_sessions WHERE id = ?'
      )
      .get(closure.cashSessionId);

    if (!sessionRow) {
      return reply.status(404).send({ error: 'SESSION_NOT_FOUND', message: 'Sessão de caixa não encontrada' });
    }

    const session = {
      id: sessionRow.id,
      operatorName: sessionRow.operator_name,
      initialCash: Number(sessionRow.initial_cash),
      currentCash: Number(sessionRow.current_cash),
      status: sessionRow.status,
      openedAt: sessionRow.opened_at,
      closedAt: sessionRow.closed_at,
    };

    const receipt = formatCashClosureReceipt(closure, session, req.query);
    return reply.status(200).send(receipt);
  };
  app.get<{ Params: { closureId: string }; Querystring: StoreInfo }>(
    '/api/financial/cash-closure/:closureId/receipt',
    handleGetClosureReceipt
  );
  app.get<{ Params: { closureId: string }; Querystring: StoreInfo }>(
    '/api/financial/cash-closures/:closureId/receipt',
    handleGetClosureReceipt
  );

  // 6. Listar Fechamentos de Caixa com filtros e paginação
  const handleListClosures = async (
    req: FastifyRequest<{ Querystring: CashClosureFilters }>,
    reply: FastifyReply
  ) => {
    const result = blindCashClosureService.listClosures(req.query);
    return reply.status(200).send(result);
  };
  app.get<{ Querystring: CashClosureFilters }>('/api/financial/cash-closures', handleListClosures);

  // ===================== CONCILIAÇÃO FINANCEIRA TEF =====================

  // 7. Previsão de recebíveis futuros por adquirente e data
  const handleGetForecast = async (
    req: FastifyRequest<{ Querystring: ForecastFilters }>,
    reply: FastifyReply
  ) => {
    const forecast = tefReconciliationService.getReceivablesForecast(req.query);
    return reply.status(200).send(forecast);
  };
  app.get<{ Querystring: ForecastFilters }>('/api/financial/reconciliation/forecast', handleGetForecast);
  app.get<{ Querystring: ForecastFilters }>('/api/financial/tef/forecast', handleGetForecast);

  // 8. Baixa e conciliação bancária de transação TEF
  const handleSettleTransaction = async (
    req: FastifyRequest<{ Body: SettleTransactionParams & { nsu: string } }>,
    reply: FastifyReply
  ) => {
    const parseResult = settleTransactionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_PARAMETERS',
        message: parseResult.error.issues[0]?.message || 'Parâmetros inválidos para liquidação TEF',
        issues: parseResult.error.issues,
      });
    }

    try {
      const { nsu, ...settleParams } = parseResult.data;
      const settled = tefReconciliationService.settleTransaction(nsu, {
        settledAmount: settleParams.settledAmount,
        settledFee: settleParams.settledFee,
        bankAccount: settleParams.bankAccount ?? undefined,
        settledAt: settleParams.settledAt ?? undefined,
      });
      return reply.status(200).send(settled);
    } catch (err: any) {
      if (err.message === 'TRANSACTION_NOT_FOUND') {
        return reply.status(404).send({ error: 'TRANSACTION_NOT_FOUND', message: 'Transação TEF não encontrada' });
      }
      if (err.message === 'TRANSACTION_ALREADY_SETTLED') {
        return reply.status(409).send({ error: 'TRANSACTION_ALREADY_SETTLED', message: 'Transação já foi liquidada anteriormente' });
      }
      if (err.message === 'CANNOT_SETTLE_UNCONFIRMED_TRANSACTION') {
        return reply.status(400).send({ error: 'CANNOT_SETTLE_UNCONFIRMED_TRANSACTION', message: 'Apenas transações confirmadas podem ser liquidadas' });
      }
      return reply.status(400).send({
        error: 'SETTLEMENT_FAILED',
        message: err.message || 'Erro ao liquidar transação TEF',
      });
    }
  };
  app.post<{ Body: SettleTransactionParams & { nsu: string } }>(
    '/api/financial/reconciliation/settle',
    handleSettleTransaction
  );
  app.post<{ Body: SettleTransactionParams & { nsu: string } }>(
    '/api/financial/tef/settle',
    handleSettleTransaction
  );

  // 9. Listar transações para conciliação e sumário de liquidações
  const handleListReconciliation = async (
    req: FastifyRequest<{ Querystring: ReconciliationFilters }>,
    reply: FastifyReply
  ) => {
    const result = tefReconciliationService.listReconciliation(req.query);
    return reply.status(200).send(result);
  };
  app.get<{ Querystring: ReconciliationFilters }>(
    '/api/financial/reconciliation/transactions',
    handleListReconciliation
  );
  app.get<{ Querystring: ReconciliationFilters }>(
    '/api/financial/tef/transactions',
    handleListReconciliation
  );

  // ===================== RELATÓRIOS DRE & CURVA ABC =====================

  // 10. DRE Gerencial
  const handleGenerateDre = async (
    req: FastifyRequest<{ Querystring: { startDate?: string; endDate?: string } }>,
    reply: FastifyReply
  ) => {
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const startDate = req.query?.startDate || firstDay;
    const endDate = req.query?.endDate || today;

    const report = financialReportsService.generateDre(startDate, endDate);
    return reply.status(200).send(report);
  };
  app.get<{ Querystring: { startDate?: string; endDate?: string } }>(
    '/api/financial/reports/dre',
    handleGenerateDre
  );
  app.get<{ Querystring: { startDate?: string; endDate?: string } }>(
    '/api/financial/dre',
    handleGenerateDre
  );

  // 11. Curva ABC 80/20 & Categorias Farmacêuticas
  const handleGenerateAbcCurve = async (
    req: FastifyRequest<{ Querystring: { startDate?: string; endDate?: string; category?: string } }>,
    reply: FastifyReply
  ) => {
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const startDate = req.query?.startDate || firstDay;
    const endDate = req.query?.endDate || today;
    const category = req.query?.category;

    const report = financialReportsService.generateAbcCurve(startDate, endDate, category);
    return reply.status(200).send(report);
  };
  app.get<{ Querystring: { startDate?: string; endDate?: string; category?: string } }>(
    '/api/financial/reports/abc-curve',
    handleGenerateAbcCurve
  );
  app.get<{ Querystring: { startDate?: string; endDate?: string; category?: string } }>(
    '/api/financial/abc-curve',
    handleGenerateAbcCurve
  );

  // ===================== MULTI-STORE & TRANSFERS =====================
  registerStoreRoutes(app, db);
  registerTransferRoutes(app, db);
  registerInventoryRoutes(app, db);

  // ===================== CREDIÁRIO & CONVÊNIOS CORPORATIVOS =====================
  registerCreditRoutes(app, db);

  // ===================== CRM, FIDELIDADE & PROMOÇÕES =====================
  registerCrmRoutes(app, db);

  // ===================== DELIVERY, ENTREGADORES & ROMANEIOS =====================
  registerDeliveryRoutes(app, db);

  // ===================== VALIDADES, RECALL ANVISA & LAUDO VISA =====================
  registerSanitaryRoutes(app, db);

  // ===================== CONCILIAÇÃO DE CARTÕES, RECEBÍVEIS & TAXAS MDR =====================
  registerCardReconciliationRoutes(app, db);

  // ===================== CONCILIAÇÃO BANCÁRIA OFX & FLUXO DE CAIXA =====================
  registerBankReconciliationRoutes(app, db);

  // ===================== SPED FISCAL EFD ICMS/IPI, SINTEGRA & BLOCO H =====================
  registerSpedRoutes(app, db);

  // ===================== CONSULTÓRIO FARMACÊUTICO & SERVIÇOS CLÍNICOS (RDC 777/2023) =====================
  registerClinicalRoutes(app, db);

  // ===================== COTAÇÃO B2B, REPOSIÇÃO & EDI FARMA (DISTRIBUIDORAS) =====================
  registerB2bRoutes(app, db);

  // ===================== TABELA OFICIAL CMED / ANVISA & PRECIFICAÇÃO REGULATÓRIA =====================
  registerCmedRoutes(app, db);

  // ===================== OMNICHANNEL, WHATSAPP OPENWA & PICK-AND-PACK ASSISTIDO =====================
  registerOmnichannelRoutes(app, db);

  // ===================== FARMÁCIA MAGISTRAL & MANIPULAÇÃO (RDC 67/2007) =====================
  registerCompoundingRoutes(app, db);

  // ===================== CLUBE DE ASSINATURA & REPOSIÇÃO RECORRENTE =====================
  registerSubscriptionRoutes(app, db);

  // ===================== FRACIONAMENTO DE MEDICAMENTOS (RDC 80/2006) =====================
  registerFractionationRoutes(app, db);

  // ===================== COMISSÕES MULTINÍVEL & METAS DE BALCÃO =====================
  registerCommissionRoutes(app, db);

  // ===================== DRE GERENCIAL, CENTROS DE CUSTO & LUCRATIVIDADE =====================
  registerDreRoutes(app, db);

  // ===================== DESCARTE SANITÁRIO & PGRSS (RDC 222/2018 ANVISA) =====================
  registerPgrssRoutes(app, db);
}
