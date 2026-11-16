import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database, getDatabase } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { PbmService } from '../../../src/modules/pbm/pbm.service';
import { DatasusMockProvider } from '../../../src/modules/pbm/providers/datasus-mock-provider';
import { DatasusSoapProvider } from '../../../src/modules/pbm/providers/datasus-soap-provider';
import type { PbmAuthorizeParams, StoreInfo } from '../../../src/modules/pbm/types';

describe('PbmService Lifecycle', () => {
  let db: Database;
  let service: PbmService;
  let productId1: number;
  let productId2: number;
  let batchId1: number;
  let saleId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);

    // Cadastra produtos de teste compatíveis com a Portaria MS nº 184/2011
    const insertProd = db.prepare(`
      INSERT INTO products (
        ean, name, active_ingredient, ms_registration,
        stripe, control_type, pmc, pf, price, is_active,
        fp_eligible, fp_code, fp_reference_price, fp_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)
    `);

    const p1 = insertProd.run(
      '7896004701234',
      'Losartana Potássica 50mg com 30 comprimidos',
      'Losartana Potássica',
      '1.0043.0001.001-2',
      'SEM_TARJA',
      'COMUM',
      15.00,
      10.00,
      12.00,
      'FP-LOSARTANA-50',
      12.00,
      'GRATUITO'
    );
    productId1 = Number(p1.lastInsertRowid);

    const p2 = insertProd.run(
      '7896004705678',
      'Sinvastatina 20mg com 30 comprimidos',
      'Sinvastatina',
      '1.0043.0002.001-8',
      'VERMELHA',
      'COMUM',
      25.00,
      18.00,
      20.00,
      'FP-SINVASTATINA-20',
      20.00,
      'CO_PAGAMENTO'
    );
    productId2 = Number(p2.lastInsertRowid);

    // Cadastra lote de teste
    const insertBatch = db.prepare(`
      INSERT INTO batches (
        product_id, batch_number, manufacturing_date, expiration_date, quantity
      ) VALUES (?, ?, ?, ?, ?)
    `);
    const b1 = insertBatch.run(
      productId1,
      'LOTE2026A',
      '2026-01-01',
      '2028-01-01',
      500
    );
    batchId1 = Number(b1.lastInsertRowid);

    // Cadastra venda de teste no PDV
    const insertSale = db.prepare(`
      INSERT INTO sales (total_amount, discount_amount, change_amount)
      VALUES (32.00, 0, 0)
    `);
    saleId = Number(insertSale.run().lastInsertRowid);

    service = new PbmService(db);
  });

  afterEach(() => {
    db.close();
  });

  const validAuthorizeParams: PbmAuthorizeParams = {
    providerId: 'FARMACIA_POPULAR',
    patientCpf: '12345678909',
    patientName: 'CARLOS SILVA MENDES',
    patientBirthDate: '1975-06-15',
    doctorCrm: '123456',
    doctorUf: 'SP',
    doctorName: 'DR. ROBERTO CARDOSO',
    prescriptionDate: new Date().toISOString().slice(0, 10),
    items: [
      {
        productId: 1, // updated dynamically in tests
        ean: '7896004701234',
        msRegistration: '1.0043.0001.001-2',
        productName: 'Losartana Potássica 50mg com 30 comprimidos',
        quantity: 1,
        unitPrice: 12.00,
        dailyDose: 1.0,
      },
    ],
  };

  it('should authorize a Farmácia Popular transaction and persist to database with status AUTHORIZED', async () => {
    const params: PbmAuthorizeParams = {
      ...validAuthorizeParams,
      items: [
        {
          ...validAuthorizeParams.items[0],
          productId: productId1,
          batchId: batchId1,
        },
      ],
    };

    const result = await service.authorize(params);

    expect(result.success).toBe(true);
    expect(result.authorizationProtocol).toMatch(/^FP\d{8}\d{6}$/);
    expect(result.totalGrossAmount).toBe(12.00);
    expect(result.subsidyAmount).toBe(12.00);
    expect(result.patientCopayAmount).toBe(0.00);
    expect(result.items).toHaveLength(1);

    // Verifica persistência SQLite
    const txData = service.getTransactionByProtocol(result.authorizationProtocol);
    expect(txData).not.toBeNull();
    expect(txData?.transaction.status).toBe('AUTHORIZED');
    expect(txData?.transaction.patientCpf).toBe('12345678909');
    expect(txData?.transaction.patientName).toBe('CARLOS SILVA MENDES');
    expect(txData?.transaction.totalGrossAmount).toBe(12.00);
    expect(txData?.transaction.subsidyAmount).toBe(12.00);
    expect(txData?.transaction.patientCopayAmount).toBe(0.00);
    expect(txData?.items).toHaveLength(1);
    expect(txData?.items[0].productId).toBe(productId1);
    expect(txData?.items[0].batchId).toBe(batchId1);
    expect(txData?.items[0].ean).toBe('7896004701234');
    expect(txData?.items[0].programType).toBe('GRATUITO');
  });

  it('should confirm an authorized transaction linking it to saleId and fiscalKeyNfce', async () => {
    const params: PbmAuthorizeParams = {
      ...validAuthorizeParams,
      items: [{ ...validAuthorizeParams.items[0], productId: productId1 }],
    };
    const authResult = await service.authorize(params);

    const fiscalKey = '35261112345678000199650010000001231000001234';
    const nfceNumber = 123;

    const confirmResult = await service.confirm({
      authorizationProtocol: authResult.authorizationProtocol,
      saleId,
      fiscalKeyNfce: fiscalKey,
      nfceNumber,
    });

    expect(confirmResult.success).toBe(true);
    expect(confirmResult.authorizationProtocol).toBe(authResult.authorizationProtocol);
    expect(confirmResult.receiptNumber).toBeDefined();
    expect(confirmResult.confirmedAt).toBeDefined();

    const txData = service.getTransactionByProtocol(authResult.authorizationProtocol);
    expect(txData?.transaction.status).toBe('CONFIRMED');
    expect(txData?.transaction.saleId).toBe(saleId);
    expect(txData?.transaction.fiscalKeyNfce).toBe(fiscalKey);
    expect(txData?.transaction.nfceNumber).toBe(nfceNumber);
    expect(txData?.transaction.receiptNumber).toBe(confirmResult.receiptNumber);
    expect(txData?.transaction.confirmedAt).toBe(confirmResult.confirmedAt);
  });

  it('should cancel an authorized or confirmed transaction and update status to CANCELLED', async () => {
    // 1. Cancelamento a partir de AUTHORIZED
    const params1: PbmAuthorizeParams = {
      ...validAuthorizeParams,
      items: [{ ...validAuthorizeParams.items[0], productId: productId1 }],
    };
    const auth1 = await service.authorize(params1);

    const cancelResult1 = await service.cancel(auth1.authorizationProtocol, 'Desistência do cliente');
    expect(cancelResult1.success).toBe(true);
    expect(cancelResult1.cancellationProtocol).toBeDefined();

    const txData1 = service.getTransactionByProtocol(auth1.authorizationProtocol);
    expect(txData1?.transaction.status).toBe('CANCELLED');
    expect(txData1?.transaction.cancellationReason).toBe('Desistência do cliente');
    expect(txData1?.transaction.cancellationProtocol).toBe(cancelResult1.cancellationProtocol);
    expect(txData1?.transaction.cancelledAt).toBeDefined();

    // 2. Cancelamento a partir de CONFIRMED
    const params2: PbmAuthorizeParams = {
      ...validAuthorizeParams,
      items: [{ ...validAuthorizeParams.items[0], productId: productId1 }],
    };
    const auth2 = await service.authorize(params2);
    await service.confirm({
      authorizationProtocol: auth2.authorizationProtocol,
      saleId,
    });

    const cancelResult2 = await service.cancel(auth2.authorizationProtocol, 'Devolução no PDV');
    expect(cancelResult2.success).toBe(true);
    const txData2 = service.getTransactionByProtocol(auth2.authorizationProtocol);
    expect(txData2?.transaction.status).toBe('CANCELLED');
    expect(txData2?.transaction.cancellationReason).toBe('Devolução no PDV');
  });

  it('should reject confirming an already confirmed or cancelled transaction', async () => {
    const params: PbmAuthorizeParams = {
      ...validAuthorizeParams,
      items: [{ ...validAuthorizeParams.items[0], productId: productId1 }],
    };
    const auth = await service.authorize(params);

    await service.confirm({
      authorizationProtocol: auth.authorizationProtocol,
      saleId,
    });

    // Tentativa de confirmação dupla
    await expect(
      service.confirm({
        authorizationProtocol: auth.authorizationProtocol,
        saleId,
      })
    ).rejects.toThrow(/já foi confirmada/i);

    // Nova autorização para testar confirmação após cancelamento
    const authCancel = await service.authorize(params);
    await service.cancel(authCancel.authorizationProtocol, 'Cancelamento prévio');

    await expect(
      service.confirm({
        authorizationProtocol: authCancel.authorizationProtocol,
        saleId,
      })
    ).rejects.toThrow(/cancelada não pode ser confirmada/i);

    // Protocolo inexistente
    await expect(
      service.confirm({
        authorizationProtocol: 'FP99999999999999',
        saleId,
      })
    ).rejects.toThrow(/não encontrada/i);
  });

  it('should generate printable 48-column coupon for an existing transaction', async () => {
    const params: PbmAuthorizeParams = {
      ...validAuthorizeParams,
      items: [
        {
          ...validAuthorizeParams.items[0],
          productId: productId1,
          batchId: batchId1,
        },
      ],
    };
    const auth = await service.authorize(params);
    await service.confirm({
      authorizationProtocol: auth.authorizationProtocol,
      saleId,
      fiscalKeyNfce: '35261112345678000199650010000001231000001234',
      nfceNumber: 123,
    });

    const customStore: StoreInfo = {
      name: 'DROGARIA FARMACORE BRASIL',
      cnpj: '12.345.678/0001-99',
      address: 'Rua Principal, 500 - Centro, SP',
      pharmacistName: 'DR. MARCOS AURELIO',
      pharmacistCrf: '98765',
      pharmacistUf: 'SP',
    };

    const receipt = service.getReceiptText(auth.authorizationProtocol, customStore);

    expect(receipt.consumerCopy).toContain('1a VIA - CONSUMIDOR');
    expect(receipt.storeCopy).toContain('2a VIA - ESTABELECIMENTO');
    expect(receipt.storeCopy).toContain('LOTE2026A');
    expect(receipt.fullEscPos).toContain('\x1b\x69');

    // Teste com storeInfo omitido (deve utilizar getDefaultStoreInfo sem erros)
    const defaultReceipt = service.getReceiptText(auth.authorizationProtocol);
    expect(defaultReceipt.consumerCopy).toContain('1a VIA - CONSUMIDOR');
    expect(defaultReceipt.storeCopy).toContain('2a VIA - ESTABELECIMENTO');
    expect(defaultReceipt.fullEscPos).toContain('\x1b\x69');

    // Validação da largura limite de 48 colunas por linha
    const lines = receipt.fullEscPos.split('\n');
    for (const line of lines) {
      if (line !== '\x1b\x69') {
        expect(line.length).toBeLessThanOrEqual(48);
      }
    }
  });

  it('should list transactions with filters by date, status, and patient CPF', async () => {
    // Criação de múltiplas transações
    const auth1 = await service.authorize({
      ...validAuthorizeParams,
      patientCpf: '12345678909',
      items: [{ ...validAuthorizeParams.items[0], productId: productId1 }],
    });

    const auth2 = await service.authorize({
      ...validAuthorizeParams,
      patientCpf: '98765432100',
      patientName: 'MARIA APARECIDA',
      items: [{ ...validAuthorizeParams.items[0], productId: productId1 }],
    });

    await service.confirm({
      authorizationProtocol: auth2.authorizationProtocol,
      saleId,
    });

    // 1. Listar todas
    const listAll = service.listTransactions();
    expect(listAll.total).toBeGreaterThanOrEqual(2);
    expect(listAll.transactions.length).toBeGreaterThanOrEqual(2);

    // 2. Filtro por status CONFIRMED
    const listConfirmed = service.listTransactions({ status: 'CONFIRMED' });
    expect(listConfirmed.total).toBe(1);
    expect(listConfirmed.transactions[0].authorizationProtocol).toBe(auth2.authorizationProtocol);

    // 3. Filtro por CPF
    const listByCpf = service.listTransactions({ patientCpf: '123.456.789-09' });
    expect(listByCpf.total).toBe(1);
    expect(listByCpf.transactions[0].patientCpf).toBe('12345678909');

    // 4. Paginação limit & offset
    const listPaginated = service.listTransactions({ limit: 1, offset: 0 });
    expect(listPaginated.transactions.length).toBe(1);
  });

  it('should manage PBM configuration (getConfig and updateConfig)', () => {
    const defaultCfg = service.getConfig('FARMACIA_POPULAR');
    expect(defaultCfg).not.toBeNull();
    expect(defaultCfg?.providerId).toBe('FARMACIA_POPULAR');
    expect(defaultCfg?.environment).toBe('MOCK');
    expect(defaultCfg?.isActive).toBe(1);

    const updated = service.updateConfig('FARMACIA_POPULAR', {
      environment: 'HOMOLOGACAO',
      credentialsJson: JSON.stringify({
        usuarioFarmacia: 'user123',
        senhaFarmacia: 'secret456',
        coCnpj: '12345678000199',
      }),
    });

    expect(updated.environment).toBe('HOMOLOGACAO');
    expect(updated.credentialsJson).toContain('user123');

    const reFetched = service.getConfig('FARMACIA_POPULAR');
    expect(reFetched?.environment).toBe('HOMOLOGACAO');
  });

  it('should instantiate soap provider when environment is HOMOLOGACAO/PRODUCAO and mock when MOCK', () => {
    // Por padrão é MOCK -> DatasusMockProvider
    const providerMock = service.getProvider('FARMACIA_POPULAR');
    expect(providerMock).toBeInstanceOf(DatasusMockProvider);

    // Atualiza para HOMOLOGACAO
    service.updateConfig('FARMACIA_POPULAR', {
      environment: 'HOMOLOGACAO',
      credentialsJson: JSON.stringify({
        usuarioFarmacia: 'user123',
        senhaFarmacia: 'secret456',
        coCnpj: '12345678000199',
      }),
    });

    const providerSoap = service.getProvider('FARMACIA_POPULAR');
    expect(providerSoap).toBeInstanceOf(DatasusSoapProvider);
  });
});
