import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Database } from '../../database/connection';
import { BankReconciliationService } from './bank-reconciliation.service';
import { CashFlowService } from './cash-flow.service';
import { BankReconciliationFormatter } from './bank-reconciliation-formatter';
import { BankReconciliationType } from './bank-reconciliation.types';

const createBankAccountSchema = z.object({
  storeId: z.number().int().positive(),
  bankCode: z.string().min(1, 'Código do banco é obrigatório'),
  bankName: z.string().min(1, 'Nome do banco é obrigatório'),
  agencyNumber: z.string().min(1, 'Agência é obrigatória'),
  accountNumber: z.string().min(1, 'Número da conta é obrigatório'),
  accountType: z.enum(['CHECKING', 'SAVINGS', 'PAYMENT']).optional(),
  initialBalance: z.number().optional(),
  notes: z.string().optional()
});

const importOfxSchema = z.object({
  bankAccountId: z.number().int().positive(),
  fileName: z.string().min(1, 'Nome do arquivo é obrigatório'),
  ofxContent: z.string().min(10, 'Conteúdo OFX inválido')
});

const manualMatchSchema = z.object({
  reconciliationType: z.enum([
    'TEF_SETTLEMENT',
    'CASH_DRAWER',
    'PURCHASE_PAYMENT',
    'CUSTOMER_CREDIT',
    'MANUAL',
    'BANK_FEE'
  ]),
  matchedEntityId: z.number().optional(),
  notes: z.string().min(1, 'Justificativa do batimento manual é obrigatória')
});

export function registerBankReconciliationRoutes(app: FastifyInstance, db: Database): void {
  const getStoreInfo = (storeId = 1) => {
    const row = db.prepare('SELECT name, cnpj FROM stores WHERE id = ?').get(storeId) as any;
    return row || { name: 'Magnos Farma Matriz', cnpj: '12.345.678/0001-95' };
  };

  // 1. CONTAS BANCÁRIAS
  app.post('/api/bank-reconciliation/accounts', async (req: FastifyRequest, rep: FastifyReply) => {
    const parseRes = createBankAccountSchema.safeParse(req.body);
    if (!parseRes.success) {
      return rep.status(400).send({ error: 'Dados inválidos', details: parseRes.error.format() });
    }
    const account = await BankReconciliationService.createBankAccount(db, parseRes.data);
    return rep.status(201).send(account);
  });

  app.get('/api/bank-reconciliation/accounts', async (req: FastifyRequest, rep: FastifyReply) => {
    const query = req.query as { storeId?: string };
    const storeId = query.storeId ? parseInt(query.storeId, 10) : 1;
    const accounts = await BankReconciliationService.listBankAccounts(db, storeId);
    return rep.send(accounts);
  });

  app.get('/api/bank-reconciliation/accounts/:id', async (req: FastifyRequest, rep: FastifyReply) => {
    const params = req.params as { id: string };
    const id = parseInt(params.id, 10);
    const account = await BankReconciliationService.getBankAccountById(db, id);
    if (!account) {
      return rep.status(404).send({ error: 'Conta bancária não encontrada' });
    }
    return rep.send(account);
  });

  // 2. IMPORTAÇÃO E LOTES DE EXTRATOS OFX
  app.post('/api/bank-reconciliation/upload-ofx', async (req: FastifyRequest, rep: FastifyReply) => {
    const parseRes = importOfxSchema.safeParse(req.body);
    if (!parseRes.success) {
      return rep.status(400).send({ error: 'Arquivo OFX inválido', details: parseRes.error.format() });
    }
    try {
      const batch = await BankReconciliationService.importOfxStatement(db, parseRes.data);
      return rep.status(201).send(batch);
    } catch (err: any) {
      return rep.status(400).send({ error: err.message || 'Falha ao processar arquivo OFX' });
    }
  });

  app.get('/api/bank-reconciliation/batches/:id', async (req: FastifyRequest, rep: FastifyReply) => {
    const params = req.params as { id: string };
    const id = parseInt(params.id, 10);
    try {
      const details = await BankReconciliationService.getBatchDetails(db, id);
      return rep.send(details);
    } catch (err: any) {
      return rep.status(404).send({ error: err.message || 'Lote não encontrado' });
    }
  });

  app.post('/api/bank-reconciliation/entries/:id/manual-match', async (req: FastifyRequest, rep: FastifyReply) => {
    const params = req.params as { id: string };
    const entryId = parseInt(params.id, 10);
    const parseRes = manualMatchSchema.safeParse(req.body);
    if (!parseRes.success) {
      return rep.status(400).send({ error: 'Dados inválidos', details: parseRes.error.format() });
    }

    try {
      const entry = await BankReconciliationService.manualMatchEntry(db, {
        entryId,
        reconciliationType: parseRes.data.reconciliationType as BankReconciliationType,
        matchedEntityId: parseRes.data.matchedEntityId,
        notes: parseRes.data.notes
      });
      return rep.send(entry);
    } catch (err: any) {
      return rep.status(400).send({ error: err.message || 'Erro ao conciliar entrada' });
    }
  });

  app.get('/api/bank-reconciliation/batches/:id/print', async (req: FastifyRequest, rep: FastifyReply) => {
    const params = req.params as { id: string };
    const batchId = parseInt(params.id, 10);
    try {
      const details = await BankReconciliationService.getBatchDetails(db, batchId);
      const account = await BankReconciliationService.getBankAccountById(db, details.batch.bankAccountId);
      if (account) details.batch.account = account;

      const store = getStoreInfo(account?.storeId || 1);
      const slipText = BankReconciliationFormatter.formatBankStatementSlip(
        details.batch,
        details.entries,
        store
      );
      return rep.send({ slipText, batchCode: details.batch.batchCode });
    } catch (err: any) {
      return rep.status(404).send({ error: err.message || 'Lote não encontrado' });
    }
  });

  // 3. FLUXO DE CAIXA REALIZADO VS PROJETADO
  app.get('/api/cash-flow/overview', async (req: FastifyRequest, rep: FastifyReply) => {
    const query = req.query as { storeId?: string; daysAhead?: string };
    const storeId = query.storeId ? parseInt(query.storeId, 10) : 1;
    const daysAhead = query.daysAhead ? parseInt(query.daysAhead, 10) : 30;

    const overview = await CashFlowService.getCashFlowOverview(db, storeId, daysAhead);
    return rep.send(overview);
  });

  app.get('/api/cash-flow/print', async (req: FastifyRequest, rep: FastifyReply) => {
    const query = req.query as { storeId?: string };
    const storeId = query.storeId ? parseInt(query.storeId, 10) : 1;

    const overview = await CashFlowService.getCashFlowOverview(db, storeId, 7);
    const store = getStoreInfo(storeId);
    const slipText = BankReconciliationFormatter.formatCashFlowDailySlip(overview, store);
    return rep.send({ slipText });
  });
}
