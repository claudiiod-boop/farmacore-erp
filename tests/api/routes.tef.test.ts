import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { Database, getDatabase } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify TEF Routes (/api/tef/*)', () => {
  let app: FastifyInstance;
  let db: Database;
  let saleId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);
    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();

    // Perfil fiscal da farmácia para dados do comprovante
    db.prepare(`
      INSERT INTO fiscal_profiles (
        cnpj, ie, razao_social, nome_fantasia, crt, c_uf, municipio, c_mun,
        logradouro, numero, bairro, cep, csc_token, environment
      ) VALUES (
        '12345678000190', '123456789111', 'FARMACORE DROGARIAS LTDA', 'FARMACORE BRASIL',
        1, 41, 'Curitiba', 4106902, 'RUA DAS FARMACIAS', '123', 'CENTRO',
        '80000000', 'CSC123456', 'HOMOLOGACAO'
      )
    `).run();

    // Venda associada no PDV
    const saleRes = db.prepare(`
      INSERT INTO sales (total_amount, discount_amount, change_amount)
      VALUES (48.50, 0, 0)
    `).run();
    saleId = Number(saleRes.lastInsertRowid);
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  // =========================================================================
  // 1. GET /api/tef/providers
  // =========================================================================
  describe('GET /api/tef/providers', () => {
    it('deve listar todos os provedores TEF cadastrados com status 200', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tef/providers',
      });

      expect(res.statusCode).toBe(200);
      const providers = res.json();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThanOrEqual(3);

      const mockProv = providers.find((p: any) => p.providerId === 'MOCK');
      expect(mockProv).toBeDefined();
      expect(mockProv.providerName).toContain('Simulador');
      expect(mockProv.isActive).toBe(1);

      const sitefProv = providers.find((p: any) => p.providerId === 'SITEF');
      expect(sitefProv).toBeDefined();
    });

    it('deve filtrar provedores ativos quando query onlyActive=true', async () => {
      // Desativa o provedor SITEF
      db.prepare("UPDATE tef_configs SET is_active = 0 WHERE provider_id = 'SITEF'").run();

      const res = await app.inject({
        method: 'GET',
        url: '/api/tef/providers?onlyActive=true',
      });

      expect(res.statusCode).toBe(200);
      const activeProviders = res.json();
      expect(activeProviders.some((p: any) => p.providerId === 'SITEF')).toBe(false);
      expect(activeProviders.some((p: any) => p.providerId === 'MOCK')).toBe(true);
    });
  });

  // =========================================================================
  // 2. POST /api/tef/pay
  // =========================================================================
  describe('POST /api/tef/pay', () => {
    it('deve autorizar pagamento de débito e retornar NSU, autorização e comprovante', async () => {
      const payload = {
        amount: 48.50,
        operationType: 'DEBITO',
        providerId: 'MOCK',
        saleId,
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/pay',
        payload,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.nsu).toBeDefined();
      expect(body.authorizationCode).toBeDefined();
      expect(body.brandName).toBeDefined();
      expect(body.brandCodeSefaz).toBeDefined();
      expect(body.acquirerName).toBeDefined();
      expect(body.acquirerCnpj).toHaveLength(14);
      expect(body.customerReceipt).toContain('COMPROVANTE');
      expect(body.merchantReceipt).toContain('ESTABELECIMENTO');

      // Verifica persistência na tabela tef_transactions
      const tx = db.prepare('SELECT * FROM tef_transactions WHERE nsu = ?').get(body.nsu) as any;
      expect(tx).toBeDefined();
      expect(tx.status).toBe('AUTHORIZED');
      expect(tx.operation_type).toBe('DEBITO');
      expect(Number(tx.amount)).toBe(48.50);
      expect(Number(tx.sale_id)).toBe(saleId);
    });

    it('deve autorizar pagamento parcelado no crédito com parcelas informadas', async () => {
      const payload = {
        amount: 150.00,
        operationType: 'CREDITO',
        installments: 3,
        installmentType: 'PARCELADO_LOJA',
        providerId: 'MOCK',
        saleId,
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/pay',
        payload,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.installments).toBe(3);

      const tx = db.prepare('SELECT * FROM tef_transactions WHERE nsu = ?').get(body.nsu) as any;
      expect(tx.installments).toBe(3);
      expect(tx.installment_type).toBe('PARCELADO_LOJA');
    });

    it('deve recusar pagamento quando amount <= 0 e retornar 400', async () => {
      const payload = {
        amount: 0,
        operationType: 'DEBITO',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/pay',
        payload,
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBe('INVALID_PARAMETERS');
    });

    it('deve recusar pagamento quando operationType for inválido e retornar 400', async () => {
      const payload = {
        amount: 50.0,
        operationType: 'INVALIDO',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/pay',
        payload,
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBe('INVALID_PARAMETERS');
    });

    it('deve retornar 400 quando o PinPad recusar a transação (ex: WRONG_PIN ou .02)', async () => {
      const payload = {
        amount: 48.02, // Gatilho de senha incorreta no TefMockProvider
        operationType: 'DEBITO',
        providerId: 'MOCK',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/pay',
        payload,
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBe('TEF_PAYMENT_REJECTED');
      expect(body.message).toContain('Senha incorreta');
      expect(body.details.success).toBe(false);

      // Transação FAILED deve estar persistida
      const tx = db.prepare('SELECT * FROM tef_transactions WHERE status = ? ORDER BY id DESC LIMIT 1').get('FAILED') as any;
      expect(tx).toBeDefined();
      expect(tx.failure_reason).toContain('Senha incorreta');
    });

    it('deve retornar 400 quando mockScenario for INSUFFICIENT_FUNDS', async () => {
      const payload = {
        amount: 100.0,
        operationType: 'CREDITO',
        mockScenario: 'INSUFFICIENT_FUNDS',
        providerId: 'MOCK',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/pay',
        payload,
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBe('TEF_PAYMENT_REJECTED');
      expect(body.message).toContain('Saldo insuficiente');
    });
  });

  // =========================================================================
  // 3. POST /api/tef/confirm
  // =========================================================================
  describe('POST /api/tef/confirm', () => {
    let authNsu: string;

    beforeEach(async () => {
      const payRes = await app.inject({
        method: 'POST',
        url: '/api/tef/pay',
        payload: {
          amount: 60.00,
          operationType: 'CREDITO',
          providerId: 'MOCK',
        },
      });
      authNsu = payRes.json().nsu;
    });

    it('deve confirmar a transação TEF vinculando saleId e dados da NFC-e', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/confirm',
        payload: {
          nsu: authNsu,
          saleId,
          fiscalKeyNfce: '41261112345678000190650010000000011000000015',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.nsu).toBe(authNsu);
      expect(body.confirmedAt).toBeDefined();

      const tx = db.prepare('SELECT * FROM tef_transactions WHERE nsu = ?').get(authNsu) as any;
      expect(tx.status).toBe('CONFIRMED');
      expect(Number(tx.sale_id)).toBe(saleId);
      expect(tx.confirmed_at).toBeDefined();
    });

    it('deve retornar 400 se faltar nsu ou saleId no payload', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/confirm',
        payload: {
          nsu: '',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBe('INVALID_PARAMETERS');
    });

    it('deve retornar 404 se o NSU não existir', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/confirm',
        payload: {
          nsu: 'NSU_INEXISTENTE_999999',
          saleId: 1,
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.error).toBe('TEF_TRANSACTION_NOT_FOUND');
    });

    it('deve retornar 400 se tentar confirmar transação já confirmada', async () => {
      // 1ª confirmação
      await app.inject({
        method: 'POST',
        url: '/api/tef/confirm',
        payload: { nsu: authNsu, saleId },
      });

      // 2ª confirmação (deve falhar)
      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/confirm',
        payload: { nsu: authNsu, saleId },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBe('TEF_CONFIRMATION_ERROR');
      expect(body.message).toContain('já foi confirmada');
    });
  });

  // =========================================================================
  // 4. POST /api/tef/undo
  // =========================================================================
  describe('POST /api/tef/undo', () => {
    let authNsu: string;

    beforeEach(async () => {
      const payRes = await app.inject({
        method: 'POST',
        url: '/api/tef/pay',
        payload: {
          amount: 35.50,
          operationType: 'DEBITO',
          providerId: 'MOCK',
        },
      });
      authNsu = payRes.json().nsu;
    });

    it('deve realizar desfazimento imediato de transação pré-autorizada', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/undo',
        payload: {
          nsu: authNsu,
          reason: 'Falha na impressora do caixa',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.nsu).toBe(authNsu);
      expect(body.reversedAt).toBeDefined();

      const tx = db.prepare('SELECT * FROM tef_transactions WHERE nsu = ?').get(authNsu) as any;
      expect(tx.status).toBe('REVERSED');
      expect(tx.reversal_reason).toBe('Falha na impressora do caixa');
      expect(tx.reversed_at).toBeDefined();
    });

    it('deve retornar 400 se faltar o motivo do desfazimento', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/undo',
        payload: {
          nsu: authNsu,
          reason: '',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBe('INVALID_PARAMETERS');
    });

    it('deve retornar 404 para NSU inexistente', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/undo',
        payload: {
          nsu: '999999999',
          reason: 'Cancelamento',
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('TEF_TRANSACTION_NOT_FOUND');
    });

    it('deve retornar 400 se tentar desfazimento em transação confirmada', async () => {
      // Confirma primeiro
      await app.inject({
        method: 'POST',
        url: '/api/tef/confirm',
        payload: { nsu: authNsu, saleId },
      });

      // Tenta undo
      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/undo',
        payload: { nsu: authNsu, reason: 'Erro' },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBe('TEF_UNDO_ERROR');
      expect(body.message).toContain('confirmada não pode ser desfeita via undo');
    });
  });

  // =========================================================================
  // 5. POST /api/tef/cancel
  // =========================================================================
  describe('POST /api/tef/cancel', () => {
    let confirmedNsu: string;

    beforeEach(async () => {
      const payRes = await app.inject({
        method: 'POST',
        url: '/api/tef/pay',
        payload: {
          amount: 85.00,
          operationType: 'CREDITO',
          providerId: 'MOCK',
        },
      });
      confirmedNsu = payRes.json().nsu;

      await app.inject({
        method: 'POST',
        url: '/api/tef/confirm',
        payload: { nsu: confirmedNsu, saleId },
      });
    });

    it('deve cancelar/estornar transação confirmada e retornar comprovante de cancelamento', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/cancel',
        payload: {
          nsu: confirmedNsu,
          reason: 'Devolução de mercadoria pelo cliente',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.nsu).toBe(confirmedNsu);
      expect(body.cancellationNsu).toBeDefined();
      expect(body.cancelledAt).toBeDefined();
      expect(body.cancellationReceipt).toContain('CANCELAMENTO');

      const tx = db.prepare('SELECT * FROM tef_transactions WHERE nsu = ?').get(confirmedNsu) as any;
      expect(tx.status).toBe('CANCELLED');
      expect(tx.cancellation_reason).toBe('Devolução de mercadoria pelo cliente');
      expect(tx.cancellation_receipt).toBeDefined();
    });

    it('deve retornar 400 se tentar cancelar transação que ainda está AUTHORIZED (não confirmada)', async () => {
      const payRes = await app.inject({
        method: 'POST',
        url: '/api/tef/pay',
        payload: { amount: 20.0, operationType: 'DEBITO' },
      });
      const unconfirmedNsu = payRes.json().nsu;

      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/cancel',
        payload: { nsu: unconfirmedNsu, reason: 'Desistência' },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBe('TEF_CANCELLATION_ERROR');
      expect(body.message).toContain('Apenas transações TEF confirmadas podem ser canceladas');
    });

    it('deve retornar 404 se o NSU não for encontrado', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tef/cancel',
        payload: { nsu: '000000000', reason: 'Devolução' },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('TEF_TRANSACTION_NOT_FOUND');
    });
  });

  // =========================================================================
  // 6. GET /api/tef/transactions
  // =========================================================================
  describe('GET /api/tef/transactions', () => {
    beforeEach(async () => {
      // Cria 2 transações para teste de listagem e filtros
      await app.inject({
        method: 'POST',
        url: '/api/tef/pay',
        payload: { amount: 25.00, operationType: 'DEBITO', providerId: 'MOCK', saleId },
      });
      await app.inject({
        method: 'POST',
        url: '/api/tef/pay',
        payload: { amount: 75.00, operationType: 'CREDITO', providerId: 'MOCK' },
      });
    });

    it('deve listar transações com total e paginação', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tef/transactions?limit=10&offset=0',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.transactions).toBeDefined();
      expect(Array.isArray(body.transactions)).toBe(true);
      expect(body.total).toBeGreaterThanOrEqual(2);
      expect(body.transactions.length).toBeGreaterThanOrEqual(2);
    });

    it('deve filtrar transações por operationType', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tef/transactions?operationType=DEBITO',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.transactions.every((t: any) => t.operationType === 'DEBITO')).toBe(true);
    });

    it('deve filtrar transações por status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tef/transactions?status=AUTHORIZED',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.transactions.every((t: any) => t.status === 'AUTHORIZED')).toBe(true);
    });
  });

  // =========================================================================
  // 7. GET /api/tef/transactions/:nsu/receipt
  // =========================================================================
  describe('GET /api/tef/transactions/:nsu/receipt', () => {
    let authNsu: string;

    beforeEach(async () => {
      const payRes = await app.inject({
        method: 'POST',
        url: '/api/tef/pay',
        payload: { amount: 48.50, operationType: 'DEBITO', providerId: 'MOCK', saleId },
      });
      authNsu = payRes.json().nsu;
    });

    it('deve retornar vias formatadas em 48 colunas ESC/POS para transação autorizada', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/tef/transactions/${authNsu}/receipt`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.customerReceipt).toContain('1a VIA - CLIENTE');
      expect(body.customerReceipt).toContain('R$ 48,50');
      expect(body.merchantReceipt).toContain('2a VIA - ESTABELECIMENTO');
      expect(body.fullEscPos).toContain('\x1b\x69'); // Código de corte ESC/POS
    });

    it('deve retornar 404 para transação inexistente', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tef/transactions/NAO_EXISTE/receipt',
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('TEF_TRANSACTION_NOT_FOUND');
    });

    it('deve retornar comprovante de cancelamento quando a transação estiver CANCELLED', async () => {
      // Confirma e cancela
      await app.inject({
        method: 'POST',
        url: '/api/tef/confirm',
        payload: { nsu: authNsu, saleId },
      });
      await app.inject({
        method: 'POST',
        url: '/api/tef/cancel',
        payload: { nsu: authNsu, reason: 'Devolução de produto' },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/tef/transactions/${authNsu}/receipt`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.customerReceipt).toContain('COMPROVANTE DE CANCELAMENTO / ESTORNO');
      expect(body.merchantReceipt).toContain('COMPROVANTE DE CANCELAMENTO / ESTORNO');
    });
  });

  // =========================================================================
  // 8. Configurações TEF: GET e PUT /api/tef/config
  // =========================================================================
  describe('Configurações TEF: GET e PUT /api/tef/config', () => {
    it('GET /api/tef/config deve listar todas as configurações cadastradas', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tef/config',
      });

      expect(res.statusCode).toBe(200);
      const configs = res.json();
      expect(Array.isArray(configs)).toBe(true);
      expect(configs.length).toBeGreaterThanOrEqual(3);
    });

    it('GET /api/tef/config/:providerId deve retornar configuração de provedor existente', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tef/config/MOCK',
      });

      expect(res.statusCode).toBe(200);
      const config = res.json();
      expect(config.providerId).toBe('MOCK');
      expect(config.terminalId).toBe('SE000001');
      expect(config.environment).toBe('MOCK');
    });

    it('GET /api/tef/config/:providerId deve retornar 404 para provedor não cadastrado', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tef/config/INEXISTENTE',
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('TEF_CONFIG_NOT_FOUND');
    });

    it('PUT /api/tef/config/:providerId deve atualizar parâmetros do provedor com sucesso', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/tef/config/SITEF',
        payload: {
          terminalId: 'SW000123',
          ipAddress: '192.168.1.200',
          port: 4097,
          environment: 'HOMOLOGACAO',
          isActive: 1,
        },
      });

      expect(res.statusCode).toBe(200);
      const updated = res.json();
      expect(updated.terminalId).toBe('SW000123');
      expect(updated.ipAddress).toBe('192.168.1.200');
      expect(updated.port).toBe(4097);
      expect(updated.environment).toBe('HOMOLOGACAO');
    });

    it('PUT /api/tef/config/:providerId deve retornar 400 para ambiente inválido', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/tef/config/SITEF',
        payload: {
          environment: 'INVALIDO_ENV',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('INVALID_PARAMETERS');
    });

    it('PUT /api/tef/config/:providerId deve retornar 404 para provedor inexistente', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/tef/config/PROVEDOR_FANTASMA',
        payload: {
          terminalId: 'TERMX',
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('TEF_CONFIG_NOT_FOUND');
    });

    it('PUT /api/tef/config (sem providerId na URL mas no corpo) deve atualizar com sucesso', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/tef/config',
        payload: {
          providerId: 'PAYGO',
          terminalId: 'PG998877',
        },
      });

      expect(res.statusCode).toBe(200);
      const updated = res.json();
      expect(updated.providerId).toBe('PAYGO');
      expect(updated.terminalId).toBe('PG998877');
    });
  });
});
