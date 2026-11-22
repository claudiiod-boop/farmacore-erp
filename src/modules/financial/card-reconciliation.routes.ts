import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Database } from '../../database/connection';
import { CardReconciliationService } from './card-reconciliation.service';
import { CardReconciliationFormatter } from './card-reconciliation-formatter';
import { StatementFileType, CardOperationType, ReconciliationStatus } from './card-reconciliation.types';

const createContractSchema = z.object({
  storeId: z.number().int().positive(),
  acquirerName: z.string().min(1, 'Nome da adquirente é obrigatório'),
  acquirerCnpj: z.string().min(11, 'CNPJ da adquirente é obrigatório'),
  merchantCode: z.string().optional(),
  defaultBankName: z.string().min(1, 'Banco padrão é obrigatório'),
  defaultBankAgency: z.string().min(1, 'Agência é obrigatória'),
  defaultBankAccount: z.string().min(1, 'Conta corrente é obrigatória'),
  debitSettlementDays: z.number().int().nonnegative().optional(),
  creditSettlementDays: z.number().int().nonnegative().optional(),
  pixSettlementDays: z.number().int().nonnegative().optional(),
  notes: z.string().optional()
});

const createFeeRuleSchema = z.object({
  brandName: z.string().min(1, 'Bandeira é obrigatória'),
  operationType: z.enum(['DEBIT', 'CREDIT', 'PIX', 'VOUCHER']),
  installmentMin: z.number().int().positive().optional(),
  installmentMax: z.number().int().positive().optional(),
  mdrRate: z.number().min(0).max(100, 'Taxa MDR deve estar entre 0% e 100%'),
  fixedFee: z.number().min(0).optional(),
  settlementDays: z.number().int().nonnegative().optional()
});

const importStatementItemSchema = z.object({
  nsu: z.string().min(1, 'NSU é obrigatório'),
  authorizationCode: z.string().optional(),
  transactionDate: z.string().min(1, 'Data da transação é obrigatória'),
  settlementDate: z.string().min(1, 'Data de liquidação é obrigatória'),
  brandName: z.string().min(1, 'Bandeira é obrigatória'),
  operationType: z.enum(['DEBIT', 'CREDIT', 'PIX', 'VOUCHER']),
  installmentNumber: z.number().int().positive().optional(),
  totalInstallments: z.number().int().positive().optional(),
  grossAmount: z.number(),
  chargedMdrRate: z.number(),
  chargedFeeAmount: z.number(),
  netAmount: z.number(),
  bankAccount: z.string().optional(),
  notes: z.string().optional()
});

const importStatementSchema = z.object({
  storeId: z.number().int().positive(),
  acquirerContractId: z.number().int().positive().optional(),
  fileName: z.string().min(1, 'Nome do arquivo é obrigatório'),
  fileType: z.enum(['EDI_CONCIL', 'EXTRATO_CSV', 'API_ONLINE']),
  items: z.array(importStatementItemSchema).min(1, 'Ao menos um registro de extrato é obrigatório')
});

export function registerCardReconciliationRoutes(app: FastifyInstance, db: Database): void {
  const getStoreInfo = (storeId = 1) => {
    const row = db.prepare('SELECT name, cnpj FROM stores WHERE id = ?').get(storeId) as any;
    return row || { name: 'Magnos Farma', cnpj: '00.000.000/0001-00' };
  };

  // 1. CONTRATOS & TAXAS MDR
  app.post('/api/card-reconciliation/contracts', async (req: FastifyRequest, rep: FastifyReply) => {
    const parseRes = createContractSchema.safeParse(req.body);
    if (!parseRes.success) {
      return rep.status(400).send({ error: 'Dados inválidos', details: parseRes.error.format() });
    }
    const contract = await CardReconciliationService.createAcquirerContract(db, parseRes.data);
    return rep.status(201).send(contract);
  });

  app.get('/api/card-reconciliation/contracts', async (req: FastifyRequest, rep: FastifyReply) => {
    const query = req.query as { storeId?: string };
    const storeId = query.storeId ? parseInt(query.storeId, 10) : 1;
    const contracts = await CardReconciliationService.listContracts(db, storeId);
    return rep.send(contracts);
  });

  app.get('/api/card-reconciliation/contracts/:id', async (req: FastifyRequest, rep: FastifyReply) => {
    const params = req.params as { id: string };
    const contractId = parseInt(params.id, 10);
    const contract = await CardReconciliationService.getContractById(db, contractId);
    if (!contract) {
      return rep.status(404).send({ error: 'Contrato não encontrado' });
    }
    return rep.send(contract);
  });

  app.post('/api/card-reconciliation/contracts/:id/rules', async (req: FastifyRequest, rep: FastifyReply) => {
    const params = req.params as { id: string };
    const contractId = parseInt(params.id, 10);
    const parseRes = createFeeRuleSchema.safeParse(req.body);
    if (!parseRes.success) {
      return rep.status(400).send({ error: 'Regra de taxa inválida', details: parseRes.error.format() });
    }

    const rule = await CardReconciliationService.addFeeRule(db, {
      contractId,
      ...parseRes.data,
      operationType: parseRes.data.operationType as CardOperationType
    });
    return rep.status(201).send(rule);
  });

  // 2. IMPORTAÇÃO E CONCILIAÇÃO DE EXTRATOS
  app.post('/api/card-reconciliation/import', async (req: FastifyRequest, rep: FastifyReply) => {
    const parseRes = importStatementSchema.safeParse(req.body);
    if (!parseRes.success) {
      return rep.status(400).send({ error: 'Lote de extrato inválido', details: parseRes.error.format() });
    }

    const batch = await CardReconciliationService.importStatement(db, {
      ...parseRes.data,
      fileType: parseRes.data.fileType as StatementFileType,
      items: parseRes.data.items.map(i => ({
        ...i,
        operationType: i.operationType as CardOperationType
      }))
    });
    return rep.status(201).send(batch);
  });

  app.get('/api/card-reconciliation/batches/:id', async (req: FastifyRequest, rep: FastifyReply) => {
    const params = req.params as { id: string };
    const batchId = parseInt(params.id, 10);
    try {
      const details = await CardReconciliationService.getBatchDetails(db, batchId);
      return rep.send(details);
    } catch (err: any) {
      return rep.status(404).send({ error: err.message || 'Lote não encontrado' });
    }
  });

  // 3. CALENDÁRIO FINANCEIRO DE RECEBÍVEIS
  app.get('/api/card-reconciliation/calendar', async (req: FastifyRequest, rep: FastifyReply) => {
    const query = req.query as { storeId?: string; startDate?: string; endDate?: string };
    const storeId = query.storeId ? parseInt(query.storeId, 10) : 1;
    const now = new Date();
    const startDate = query.startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const endDate = query.endDate || new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10);

    const calendar = await CardReconciliationService.getReceivablesCalendar(db, storeId, startDate, endDate);
    return rep.send(calendar);
  });

  app.get('/api/card-reconciliation/calendar/print', async (req: FastifyRequest, rep: FastifyReply) => {
    const query = req.query as { storeId?: string; date?: string };
    const storeId = query.storeId ? parseInt(query.storeId, 10) : 1;
    const date = query.date || new Date().toISOString().slice(0, 10);

    const calendar = await CardReconciliationService.getReceivablesCalendar(db, storeId, date, date);
    const day = calendar.find(d => d.date === date) || {
      date,
      totalGross: 0,
      totalFee: 0,
      totalNet: 0,
      transactionCount: 0,
      byAcquirer: {}
    };

    const store = getStoreInfo(storeId);
    const slipText = CardReconciliationFormatter.formatDailySettlementSlip(day, store);
    return rep.send({ slipText, date });
  });

  // 4. AUDITORIA DE DIVERGÊNCIAS
  app.get('/api/card-reconciliation/divergences', async (req: FastifyRequest, rep: FastifyReply) => {
    const query = req.query as { storeId?: string; startDate?: string; endDate?: string; status?: string };
    const storeId = query.storeId ? parseInt(query.storeId, 10) : 1;

    const report = await CardReconciliationService.getDivergenceReport(db, storeId, {
      startDate: query.startDate,
      endDate: query.endDate,
      status: query.status as ReconciliationStatus
    });
    return rep.send(report);
  });

  app.get('/api/card-reconciliation/divergences/print', async (req: FastifyRequest, rep: FastifyReply) => {
    const query = req.query as { storeId?: string; startDate?: string; endDate?: string };
    const storeId = query.storeId ? parseInt(query.storeId, 10) : 1;

    const report = await CardReconciliationService.getDivergenceReport(db, storeId, {
      startDate: query.startDate,
      endDate: query.endDate
    });

    const store = getStoreInfo(storeId);
    const slipText = CardReconciliationFormatter.formatDivergenceAuditSlip(report, store);
    return rep.send({ slipText, totalOvercharged: report.totalOverchargedAmount, totalItems: report.totalDivergentCount });
  });
}
