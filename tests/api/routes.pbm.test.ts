import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { Database, getDatabase } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify PBM & Farmácia Popular Routes (/api/pbm/*)', () => {
  let app: FastifyInstance;
  let db: Database;
  let productId: number;
  let batchId: number;
  let saleId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);
    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();

    // Perfil fiscal da farmácia para dados do cupom
    db.prepare(`
      INSERT INTO fiscal_profiles (
        cnpj, ie, razao_social, nome_fantasia, crt, c_uf, municipio, c_mun,
        logradouro, numero, bairro, cep, csc_token, environment
      ) VALUES (
        '12345678000195', '123456789', 'FARMACORE DROGARIAS LTDA', 'FARMACORE CENTRAL',
        1, 41, 'Curitiba', 4106902, 'RUA DAS FARMACIAS', '123', 'CENTRO',
        '80000000', 'CSC123456', 'HOMOLOGACAO'
      )
    `).run();

    // Produto elegível Farmácia Popular (Losartana 50mg - 100% gratuito)
    const prodRes = db.prepare(`
      INSERT INTO products (
        ean, name, active_ingredient, ms_registration, stripe, control_type,
        pmc, pf, price, is_active, fp_eligible, fp_code, fp_reference_price, fp_type
      ) VALUES (
        '7896004701234', 'Losartana Potássica 50mg CX 30 CP', 'Losartana Potássica',
        '1.0043.0001.001-2', 'SEM_TARJA', 'COMUM', 15.0, 10.0, 12.0, 1,
        1, 'FP-LOSARTANA-50', 12.0, 'GRATUITO'
      )
    `).run();
    productId = Number(prodRes.lastInsertRowid);

    // Lote do produto
    const batchRes = db.prepare(`
      INSERT INTO batches (
        product_id, batch_number, manufacturing_date, expiration_date, quantity
      ) VALUES (?, 'LOT12345', '2026-01-01', '2028-01-01', 200)
    `).run(productId);
    batchId = Number(batchRes.lastInsertRowid);

    // Venda associada no PDV
    const saleRes = db.prepare(`
      INSERT INTO sales (total_amount, discount_amount, change_amount)
      VALUES (12.0, 0, 0)
    `).run();
    saleId = Number(saleRes.lastInsertRowid);
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  const getValidAuthorizePayload = () => ({
    providerId: 'FARMACIA_POPULAR',
    patientCpf: '12345678909',
    patientName: 'CARLOS SILVA MENDES',
    patientBirthDate: '1975-06-15',
    doctorCrm: '12345',
    doctorUf: 'PR',
    doctorName: 'DR. ROBERTO CARDOSO',
    prescriptionDate: new Date().toISOString().slice(0, 10),
    items: [
      {
        productId,
        ean: '7896004701234',
        msRegistration: '1.0043.0001.001-2',
        productName: 'Losartana Potássica 50mg CX 30 CP',
        quantity: 1,
        unitPrice: 12.0,
        dailyDose: 1.0,
        batchId,
      },
    ],
  });

  // =========================================================================
  // 1. GET /api/pbm/providers
  // =========================================================================
  describe('GET /api/pbm/providers', () => {
    it('deve listar todos os provedores PBM cadastrados com status 200', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/pbm/providers',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(4);

      const fp = data.find((p: any) => p.providerId === 'FARMACIA_POPULAR');
      expect(fp).toBeDefined();
      expect(fp.providerName).toContain('Farmácia Popular');
      expect(fp.environment).toBe('MOCK');
      expect(fp.isActive).toBe(1);
    });

    it('deve filtrar provedores ativos quando informado ?onlyActive=true', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/pbm/providers?onlyActive=true',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(Array.isArray(data)).toBe(true);
      expect(data.every((p: any) => p.isActive === 1)).toBe(true);
    });
  });

  // =========================================================================
  // 2. POST /api/pbm/authorize
  // =========================================================================
  describe('POST /api/pbm/authorize', () => {
    it('deve autorizar com sucesso e retornar protocolo e breakdown financeiro', async () => {
      const payload = getValidAuthorizePayload();

      const res = await app.inject({
        method: 'POST',
        url: '/api/pbm/authorize',
        payload,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.authorizationProtocol).toMatch(/^FP/);
      expect(data.providerId).toBe('FARMACIA_POPULAR');
      expect(data.patientCpf).toBe('12345678909');
      expect(data.totalGrossAmount).toBe(12.0);
      expect(data.subsidyAmount).toBe(12.0);
      expect(data.patientCopayAmount).toBe(0.0);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].programType).toBe('GRATUITO');
      expect(data.items[0].status).toBe('APROVADO');
    });

    it('deve retornar 400 quando campos obrigatórios estiverem ausentes', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pbm/authorize',
        payload: {
          patientName: 'CARLOS SILVA',
          // CPF, doctorCrm, doctorUf e items ausentes
        },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toBe('INVALID_PARAMETERS');
      expect(data.message).toBeDefined();
    });

    it('deve retornar 400 quando a lista de itens estiver vazia', async () => {
      const payload = {
        ...getValidAuthorizePayload(),
        items: [],
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/pbm/authorize',
        payload,
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toBe('INVALID_PARAMETERS');
    });

    it('deve retornar 400 com motivo da rejeição regulatória pelo Datasus (ex: CPF com dígitos inválidos)', async () => {
      const payload = {
        ...getValidAuthorizePayload(),
        patientCpf: '11111111111', // CPF com todos os dígitos iguais rejeitado pelo algoritmo oficial
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/pbm/authorize',
        payload,
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toBe('PBM_AUTHORIZATION_FAILED');
      expect(data.message).toContain('CPF');
    });

    it('deve retornar 400 quando a receita médica estiver vencida (> 180 dias)', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);

      const payload = {
        ...getValidAuthorizePayload(),
        prescriptionDate: oldDate.toISOString().slice(0, 10),
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/pbm/authorize',
        payload,
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toBe('PBM_AUTHORIZATION_FAILED');
      expect(data.message).toMatch(/VENCIDA|limite legal|validade/i);
    });
  });

  // =========================================================================
  // 3. POST /api/pbm/confirm
  // =========================================================================
  describe('POST /api/pbm/confirm', () => {
    let authProtocol: string;

    beforeEach(async () => {
      const authRes = await app.inject({
        method: 'POST',
        url: '/api/pbm/authorize',
        payload: getValidAuthorizePayload(),
      });
      authProtocol = JSON.parse(authRes.body).authorizationProtocol;
    });

    it('deve confirmar a autorização vinculando a venda e dados da NFC-e', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pbm/confirm',
        payload: {
          authorizationProtocol: authProtocol,
          saleId,
          fiscalKeyNfce: '41261112345678000195650010000000011000000014',
          nfceNumber: 1,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.authorizationProtocol).toBe(authProtocol);
      expect(data.receiptNumber).toBeDefined();

      // Confere status persistido no banco
      const tx = db.prepare('SELECT * FROM pbm_transactions WHERE authorization_protocol = ?').get(authProtocol) as any;
      expect(tx.status).toBe('CONFIRMED');
      expect(tx.sale_id).toBe(saleId);
      expect(tx.nfce_number).toBe(1);
    });

    it('deve retornar 400 se o payload for inválido (sem saleId ou protocol)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pbm/confirm',
        payload: {
          authorizationProtocol: authProtocol,
          // saleId ausente
        },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toBe('INVALID_PARAMETERS');
    });

    it('deve retornar 404 se a transação PBM não for encontrada', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pbm/confirm',
        payload: {
          authorizationProtocol: 'FP-PROTOCOLO-INEXISTENTE',
          saleId,
        },
      });

      expect(res.statusCode).toBe(404);
      const data = JSON.parse(res.body);
      expect(data.error).toBe('PBM_TRANSACTION_NOT_FOUND');
    });

    it('deve retornar 400 se tentar confirmar uma transação já confirmada', async () => {
      // 1ª confirmação
      await app.inject({
        method: 'POST',
        url: '/api/pbm/confirm',
        payload: { authorizationProtocol: authProtocol, saleId },
      });

      // 2ª confirmação
      const res = await app.inject({
        method: 'POST',
        url: '/api/pbm/confirm',
        payload: { authorizationProtocol: authProtocol, saleId },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toBe('PBM_CONFIRMATION_ERROR');
      expect(data.message).toContain('já foi confirmada');
    });
  });

  // =========================================================================
  // 4. POST /api/pbm/cancel
  // =========================================================================
  describe('POST /api/pbm/cancel', () => {
    let authProtocol: string;

    beforeEach(async () => {
      const authRes = await app.inject({
        method: 'POST',
        url: '/api/pbm/authorize',
        payload: getValidAuthorizePayload(),
      });
      authProtocol = JSON.parse(authRes.body).authorizationProtocol;
    });

    it('deve cancelar com sucesso uma autorização fornecendo justificativa', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pbm/cancel',
        payload: {
          protocol: authProtocol,
          reason: 'Paciente desistiu da compra de medicamentos subsidiados',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.cancellationProtocol).toBeDefined();

      // Confere persistência
      const tx = db.prepare('SELECT * FROM pbm_transactions WHERE authorization_protocol = ?').get(authProtocol) as any;
      expect(tx.status).toBe('CANCELLED');
      expect(tx.cancellation_reason).toBe('Paciente desistiu da compra de medicamentos subsidiados');
      expect(tx.cancelled_at).toBeDefined();
    });

    it('deve retornar 400 se faltar motivo ou protocolo', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pbm/cancel',
        payload: {
          protocol: authProtocol,
          // reason ausente
        },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toBe('INVALID_PARAMETERS');
    });

    it('deve retornar 404 se o protocolo não existir', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pbm/cancel',
        payload: {
          protocol: 'PROTOCOLO-NAO-EXISTE',
          reason: 'Cancelamento teste',
        },
      });

      expect(res.statusCode).toBe(404);
      const data = JSON.parse(res.body);
      expect(data.error).toBe('PBM_TRANSACTION_NOT_FOUND');
    });

    it('deve retornar 400 ao tentar cancelar transação já cancelada', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/pbm/cancel',
        payload: { protocol: authProtocol, reason: 'Motivo 1' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/pbm/cancel',
        payload: { protocol: authProtocol, reason: 'Motivo 2' },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toBe('PBM_CANCELLATION_ERROR');
      expect(data.message).toContain('já se encontra cancelada');
    });
  });

  // =========================================================================
  // 5. GET /api/pbm/transactions
  // =========================================================================
  describe('GET /api/pbm/transactions', () => {
    let protocol1: string;

    beforeEach(async () => {
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/pbm/authorize',
        payload: getValidAuthorizePayload(),
      });
      protocol1 = JSON.parse(res1.body).authorizationProtocol;

      // Confirma a primeira venda
      await app.inject({
        method: 'POST',
        url: '/api/pbm/confirm',
        payload: { authorizationProtocol: protocol1, saleId },
      });
    });

    it('deve listar transações PBM e contagem total', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/pbm/transactions',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.transactions).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(data.transactions[0].authorizationProtocol).toBe(protocol1);
      expect(data.transactions[0].status).toBe('CONFIRMED');
    });

    it('deve filtrar por CPF do paciente', async () => {
      const resMatch = await app.inject({
        method: 'GET',
        url: '/api/pbm/transactions?patientCpf=12345678909',
      });
      const dataMatch = JSON.parse(resMatch.body);
      expect(dataMatch.transactions).toHaveLength(1);

      const resNone = await app.inject({
        method: 'GET',
        url: '/api/pbm/transactions?patientCpf=99999999999',
      });
      const dataNone = JSON.parse(resNone.body);
      expect(dataNone.transactions).toHaveLength(0);
      expect(dataNone.total).toBe(0);
    });

    it('deve filtrar por status (ex: CONFIRMED vs CANCELLED)', async () => {
      const resConfirmed = await app.inject({
        method: 'GET',
        url: '/api/pbm/transactions?status=CONFIRMED',
      });
      expect(JSON.parse(resConfirmed.body).transactions).toHaveLength(1);

      const resCancelled = await app.inject({
        method: 'GET',
        url: '/api/pbm/transactions?status=CANCELLED',
      });
      expect(JSON.parse(resCancelled.body).transactions).toHaveLength(0);
    });
  });

  // =========================================================================
  // 6. GET /api/pbm/transactions/:protocol/coupon
  // =========================================================================
  describe('GET /api/pbm/transactions/:protocol/coupon', () => {
    let protocol: string;
    let txId: number;

    beforeEach(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pbm/authorize',
        payload: getValidAuthorizePayload(),
      });
      protocol = JSON.parse(res.body).authorizationProtocol;

      await app.inject({
        method: 'POST',
        url: '/api/pbm/confirm',
        payload: {
          authorizationProtocol: protocol,
          saleId,
          nfceNumber: 12345,
        },
      });

      const txRow = db.prepare('SELECT id FROM pbm_transactions WHERE authorization_protocol = ?').get(protocol) as any;
      txId = txRow.id;
    });

    it('deve retornar o cupom vinculado ESC/POS formatado pelo protocolo de autorização', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/pbm/transactions/${protocol}/coupon`,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.consumerCopy).toBeDefined();
      expect(data.storeCopy).toBeDefined();
      expect(data.fullEscPos).toBeDefined();

      // Valida cabeçalhos oficiais Denasus
      expect(data.consumerCopy).toContain('AQUI TEM FARMÁCIA POPULAR');
      expect(data.consumerCopy).toContain('1a VIA - CONSUMIDOR');
      expect(data.storeCopy).toContain('2a VIA - ESTABELECIMENTO');
      expect(data.storeCopy).toContain('GUARDA OBRIGATORIA: 5 ANOS');
      expect(data.storeCopy).toContain('ASSINATURA DO BENEFICIARIO OU PROCURADOR');
    });

    it('deve resolver o cupom caso seja passado o ID numérico da transação', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/pbm/transactions/${txId}/coupon`,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.consumerCopy).toContain('AQUI TEM FARMÁCIA POPULAR');
    });

    it('deve retornar 404 para protocolo inexistente', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/pbm/transactions/PROTOCOLO-NAO-EXISTE/coupon',
      });

      expect(res.statusCode).toBe(404);
      const data = JSON.parse(res.body);
      expect(data.error).toBe('PBM_TRANSACTION_NOT_FOUND');
    });
  });

  // =========================================================================
  // 7. GET & PUT /api/pbm/config/:providerId
  // =========================================================================
  describe('Configurações PBM: GET e PUT /api/pbm/config/:providerId', () => {
    it('GET /api/pbm/config/:providerId deve retornar configuração de um provedor cadastrado', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/pbm/config/FARMACIA_POPULAR',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.providerId).toBe('FARMACIA_POPULAR');
      expect(data.providerName).toBe('Farmácia Popular do Brasil');
      expect(data.environment).toBe('MOCK');
      expect(data.isActive).toBe(1);
    });

    it('GET /api/pbm/config/:providerId deve retornar 404 para provedor inexistente', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/pbm/config/PROVEDOR_INEXISTENTE',
      });

      expect(res.statusCode).toBe(404);
      const data = JSON.parse(res.body);
      expect(data.error).toBe('PBM_CONFIG_NOT_FOUND');
    });

    it('GET /api/pbm/config deve listar todas as configurações', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/pbm/config',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(4);
    });

    it('PUT /api/pbm/config/:providerId deve atualizar credenciais e ambiente', async () => {
      const creds = JSON.stringify({
        cnpjMatriz: '12345678000195',
        usuarioWs: 'ws_usuario',
        senhaWs: 'senha123',
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/pbm/config/FARMACIA_POPULAR',
        payload: {
          environment: 'HOMOLOGACAO',
          credentialsJson: creds,
          isActive: 1,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.environment).toBe('HOMOLOGACAO');
      expect(data.credentialsJson).toBe(creds);

      // Confere persistência no banco
      const row = db.prepare('SELECT environment, credentials_json FROM pbm_configs WHERE provider_id = ?').get('FARMACIA_POPULAR') as any;
      expect(row.environment).toBe('HOMOLOGACAO');
      expect(row.credentials_json).toBe(creds);
    });

    it('PUT /api/pbm/config/:providerId deve retornar 400 para ambiente inválido', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/pbm/config/FARMACIA_POPULAR',
        payload: {
          environment: 'AMBIENTE_INVALIDO',
        },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toBe('INVALID_PARAMETERS');
    });

    it('PUT /api/pbm/config/:providerId deve retornar 404 para provedor inexistente', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/pbm/config/INEXISTENTE',
        payload: {
          environment: 'HOMOLOGACAO',
        },
      });

      expect(res.statusCode).toBe(404);
      const data = JSON.parse(res.body);
      expect(data.error).toBe('PBM_CONFIG_NOT_FOUND');
    });

    it('PUT /api/pbm/config (com providerId no body) deve atualizar com sucesso', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/pbm/config',
        payload: {
          providerId: 'VIDALINK',
          providerName: 'Vidalink Nova Denominação',
          environment: 'PRODUCAO',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.providerId).toBe('VIDALINK');
      expect(data.providerName).toBe('Vidalink Nova Denominação');
      expect(data.environment).toBe('PRODUCAO');
    });
  });
});
