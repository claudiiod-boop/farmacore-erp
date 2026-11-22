import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Bank Reconciliation & Cash Flow REST API Routes (/api/bank-reconciliation/*, /api/cash-flow/*)', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('Bank Accounts Endpoints', () => {
    it('POST /api/bank-reconciliation/accounts should register a new bank account', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/bank-reconciliation/accounts',
        payload: {
          storeId: 1,
          bankCode: '341',
          bankName: 'Banco Itaú Unibanco',
          agencyNumber: '0057',
          accountNumber: '12345-6',
          initialBalance: 5000.00
        }
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.id).toBeGreaterThan(0);
      expect(data.bankName).toBe('Banco Itaú Unibanco');
      expect(data.currentBalance).toBe(5000.00);
    });

    it('GET /api/bank-reconciliation/accounts should return accounts list for store', async () => {
      // 1. Cria conta
      await app.inject({
        method: 'POST',
        url: '/api/bank-reconciliation/accounts',
        payload: {
          storeId: 1,
          bankCode: '001',
          bankName: 'Banco do Brasil',
          agencyNumber: '1234',
          accountNumber: '99999-0',
          initialBalance: 2500.00
        }
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/bank-reconciliation/accounts?storeId=1'
      });

      expect(res.statusCode).toBe(200);
      const list = JSON.parse(res.body);
      expect(list).toHaveLength(1);
      expect(list[0].bankCode).toBe('001');
    });
  });

  describe('OFX Statement Upload & Cash Flow Endpoints', () => {
    it('should upload OFX, get batch details, test manual match and print slips', async () => {
      // 1. Cria conta Itaú
      const accRes = await app.inject({
        method: 'POST',
        url: '/api/bank-reconciliation/accounts',
        payload: {
          storeId: 1,
          bankCode: '341',
          bankName: 'Banco Itaú',
          agencyNumber: '0057',
          accountNumber: '12345-6',
          initialBalance: 10000.00
        }
      });
      const account = JSON.parse(accRes.body);

      // 2. Upload OFX
      const ofxContent = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260601120000
<TRNAMT>-29.90
<FITID>OFX-TAR-01
<MEMO>TARIFA MENSALIDADE CONTA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260601130000
<TRNAMT>500.00
<FITID>OFX-PIX-02
<MEMO>PIX RECEBIDO JOAO DA SILVA
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>10470.10</BALAMT></LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/bank-reconciliation/upload-ofx',
        payload: {
          bankAccountId: account.id,
          fileName: 'extrato.ofx',
          ofxContent
        }
      });

      expect(uploadRes.statusCode).toBe(201);
      const batch = JSON.parse(uploadRes.body);
      expect(batch.id).toBeGreaterThan(0);
      expect(batch.totalEntries).toBe(2);

      // 3. Consulta detalhes do lote
      const detailsRes = await app.inject({
        method: 'GET',
        url: `/api/bank-reconciliation/batches/${batch.id}`
      });
      expect(detailsRes.statusCode).toBe(200);
      const details = JSON.parse(detailsRes.body);
      expect(details.entries).toHaveLength(2);

      // 4. Conciliação manual da entrada 2
      const entryToMatch = details.entries.find((e: any) => e.fitid === 'OFX-PIX-02');
      const matchRes = await app.inject({
        method: 'POST',
        url: `/api/bank-reconciliation/entries/${entryToMatch.id}/manual-match`,
        payload: {
          reconciliationType: 'CUSTOMER_CREDIT',
          matchedEntityId: 99,
          notes: 'Pagamento de fatura de convênio identificado'
        }
      });
      expect(matchRes.statusCode).toBe(200);
      const matchedEntry = JSON.parse(matchRes.body);
      expect(matchedEntry.reconciliationStatus).toBe('MANUAL_MATCH');

      // 5. Impressão térmica do extrato
      const printBatchRes = await app.inject({
        method: 'GET',
        url: `/api/bank-reconciliation/batches/${batch.id}/print`
      });
      expect(printBatchRes.statusCode).toBe(200);
      const printBatch = JSON.parse(printBatchRes.body);
      expect(printBatch.slipText).toContain('EXTRATO DE CONCILIACAO BANCARIA OFX');

      // 6. Consulta visão consolidada de fluxo de caixa
      const cashFlowRes = await app.inject({
        method: 'GET',
        url: '/api/cash-flow/overview?storeId=1&daysAhead=10'
      });
      expect(cashFlowRes.statusCode).toBe(200);
      const cashFlow = JSON.parse(cashFlowRes.body);
      expect(cashFlow.totalLiquidBankBalance).toBeGreaterThan(0);
      expect(cashFlow.projections30Days).toHaveLength(10);

      // 7. Impressão térmica de fluxo de caixa
      const printCashFlowRes = await app.inject({
        method: 'GET',
        url: '/api/cash-flow/print?storeId=1'
      });
      expect(printCashFlowRes.statusCode).toBe(200);
      const printCashFlow = JSON.parse(printCashFlowRes.body);
      expect(printCashFlow.slipText).toContain('POSICAO CONSOLIDADA DE CAIXA E LIQUIDEZ');
    });
  });
});
