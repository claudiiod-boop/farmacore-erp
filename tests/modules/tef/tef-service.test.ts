import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database, getDatabase } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { TefService } from '../../../src/modules/tef/tef.service';
import { TefMockProvider } from '../../../src/modules/tef/providers/tef-mock-provider';
import type { TefPayParams, StoreInfo } from '../../../src/modules/tef/types';

describe('TefService Lifecycle & Orchestration', () => {
  let db: Database;
  let service: TefService;
  let saleId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);

    // Cadastra uma venda no PDV para testes de vínculo
    const insertSale = db.prepare(`
      INSERT INTO sales (total_amount, discount_amount, change_amount)
      VALUES (100.00, 0, 0)
    `);
    saleId = Number(insertSale.run().lastInsertRowid);

    service = new TefService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Initialization & Configs', () => {
    it('should initialize default configs for SITEF, PAYGO, and MOCK', () => {
      const mockConfig = service.getConfig('MOCK');
      expect(mockConfig).toBeDefined();
      expect(mockConfig?.providerId).toBe('MOCK');
      expect(mockConfig?.environment).toBe('MOCK');
      expect(mockConfig?.isActive).toBe(1);

      const sitefConfig = service.getConfig('SITEF');
      expect(sitefConfig).toBeDefined();
      expect(sitefConfig?.providerId).toBe('SITEF');
      expect(sitefConfig?.port).toBe(4096);

      const paygoConfig = service.getConfig('PAYGO');
      expect(paygoConfig).toBeDefined();
      expect(paygoConfig?.providerId).toBe('PAYGO');
    });

    it('should update config and reflect changes', () => {
      const updated = service.updateConfig('MOCK', {
        terminalId: 'PDV-CAIXA-02',
        merchantId: 'MERCHANT-999',
        environment: 'HOMOLOGACAO',
      });

      expect(updated.terminalId).toBe('PDV-CAIXA-02');
      expect(updated.merchantId).toBe('MERCHANT-999');
      expect(updated.environment).toBe('HOMOLOGACAO');

      const retrieved = service.getConfig('MOCK');
      expect(retrieved?.terminalId).toBe('PDV-CAIXA-02');
      expect(retrieved?.environment).toBe('HOMOLOGACAO');
    });

    it('should throw when updating nonexistent provider config', () => {
      expect(() => {
        service.updateConfig('INEXISTENTE', { terminalId: 'TEST' });
      }).toThrow(/não encontrada/i);
    });

    it('should allow custom providers via constructor and registerProvider', () => {
      const customMock = new TefMockProvider();
      const customService = new TefService(db, {
        CUSTOM: customMock,
      });

      expect(customService.getProvider('CUSTOM')).toBe(customMock);

      const anotherProvider = new TefMockProvider();
      customService.registerProvider(anotherProvider);
      expect(customService.getProvider('MOCK')).toBeDefined();
    });
  });

  describe('Payment (pay)', () => {
    it('should authorize debit payment and persist transaction with status AUTHORIZED', async () => {
      const payParams: TefPayParams = {
        providerId: 'MOCK',
        amount: 50.00,
        operationType: 'DEBITO',
        saleId,
      };

      const result = await service.pay(payParams);

      expect(result.success).toBe(true);
      expect(result.nsu).toBeTruthy();
      expect(result.authorizationCode).toBeTruthy();
      expect(result.brandName).toBe('VISA');
      expect(result.brandCodeSefaz).toBe('01');
      expect(result.acquirerName).toBe('CIELO');
      expect(result.acquirerCnpj).toBe('01027058000191');

      // Verifica persistência no banco
      const tx = service.getTransactionByNsu(result.nsu);
      expect(tx).toBeDefined();
      expect(tx?.status).toBe('AUTHORIZED');
      expect(tx?.amount).toBe(50.00);
      expect(tx?.operationType).toBe('DEBITO');
      expect(tx?.installments).toBe(1);
      expect(tx?.saleId).toBe(saleId);
      expect(tx?.brandName).toBe('VISA');
      expect(tx?.customerReceipt).toContain('COMPROVANTE DE PAGAMENTO TEF');
      expect(tx?.merchantReceipt).toContain('2a VIA - ESTABELECIMENTO');
    });

    it('should authorize credit payment with installments and specific brand', async () => {
      const payParams: TefPayParams = {
        providerId: 'MOCK',
        amount: 300.00,
        operationType: 'CREDITO',
        installments: 3,
        installmentType: 'PARCELADO_LOJA',
        brandName: 'ELO',
      };

      const result = await service.pay(payParams);

      expect(result.success).toBe(true);
      expect(result.brandName).toBe('ELO');
      expect(result.brandCodeSefaz).toBe('06');
      expect(result.acquirerName).toBe('STONE');
      expect(result.acquirerCnpj).toBe('16501555000157');
      expect(result.installments).toBe(3);

      const tx = service.getTransactionByUuid(result.transactionUuid);
      expect(tx).toBeDefined();
      expect(tx?.status).toBe('AUTHORIZED');
      expect(tx?.installmentType).toBe('PARCELADO_LOJA');
      expect(tx?.installments).toBe(3);
    });

    it('should persist FAILED transaction when payment is rejected (WRONG_PIN)', async () => {
      const payParams: TefPayParams = {
        providerId: 'MOCK',
        amount: 10.02, // Centavos .02 ativa WRONG_PIN no TefMockProvider
        operationType: 'DEBITO',
      };

      const result = await service.pay(payParams);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Senha incorreta');

      const tx = service.getTransactionByUuid(result.transactionUuid);
      expect(tx).toBeDefined();
      expect(tx?.status).toBe('FAILED');
      expect(tx?.failureReason).toContain('Senha incorreta');
    });

    it('should throw error when amount is zero or negative', async () => {
      await expect(
        service.pay({
          amount: 0,
          operationType: 'DEBITO',
        })
      ).rejects.toThrow(/inválido/i);

      await expect(
        service.pay({
          amount: -10,
          operationType: 'DEBITO',
        })
      ).rejects.toThrow(/inválido/i);
    });
  });

  describe('Confirmation (confirm)', () => {
    it('should confirm authorized transaction and link saleId', async () => {
      const payResult = await service.pay({
        amount: 80.00,
        operationType: 'DEBITO',
      });

      expect(payResult.success).toBe(true);

      const confirmResult = await service.confirm({
        nsu: payResult.nsu,
        saleId,
      });

      expect(confirmResult.success).toBe(true);
      expect(confirmResult.nsu).toBe(payResult.nsu);
      expect(confirmResult.confirmedAt).toBeTruthy();

      const tx = service.getTransactionByNsu(payResult.nsu);
      expect(tx?.status).toBe('CONFIRMED');
      expect(tx?.saleId).toBe(saleId);
      expect(tx?.confirmedAt).toBeTruthy();
    });

    it('should reject confirming an already confirmed transaction (double confirmation protection)', async () => {
      const payResult = await service.pay({
        amount: 45.00,
        operationType: 'DEBITO',
      });

      await service.confirm({
        nsu: payResult.nsu,
        saleId,
      });

      await expect(
        service.confirm({
          nsu: payResult.nsu,
          saleId,
        })
      ).rejects.toThrow(/já foi confirmada/i);
    });

    it('should reject confirming a reversed transaction', async () => {
      const payResult = await service.pay({
        amount: 60.00,
        operationType: 'DEBITO',
      });

      await service.undo({
        nsu: payResult.nsu,
        reason: 'Teste de desfazimento',
      });

      await expect(
        service.confirm({
          nsu: payResult.nsu,
          saleId,
        })
      ).rejects.toThrow(/desfeita não pode ser confirmada/i);
    });

    it('should reject confirming a cancelled transaction', async () => {
      const payResult = await service.pay({
        amount: 70.00,
        operationType: 'DEBITO',
      });

      await service.confirm({
        nsu: payResult.nsu,
        saleId,
      });

      await service.cancel({
        nsu: payResult.nsu,
        reason: 'Cancelamento pelo operador',
      });

      await expect(
        service.confirm({
          nsu: payResult.nsu,
          saleId,
        })
      ).rejects.toThrow(/cancelada não pode ser confirmada/i);
    });

    it('should throw error when confirming non-existent NSU', async () => {
      await expect(
        service.confirm({
          nsu: '999999',
          saleId,
        })
      ).rejects.toThrow(/não encontrada/i);
    });
  });

  describe('Technical Undo (undo)', () => {
    it('should undo authorized transaction updating status to REVERSED', async () => {
      const payResult = await service.pay({
        amount: 95.00,
        operationType: 'CREDITO',
      });

      const undoResult = await service.undo({
        nsu: payResult.nsu,
        reason: 'Falha na emissão da NFC-e',
      });

      expect(undoResult.success).toBe(true);
      expect(undoResult.nsu).toBe(payResult.nsu);
      expect(undoResult.reversedAt).toBeTruthy();

      const tx = service.getTransactionByNsu(payResult.nsu);
      expect(tx?.status).toBe('REVERSED');
      expect(tx?.reversalReason).toBe('Falha na emissão da NFC-e');
      expect(tx?.reversedAt).toBeTruthy();
    });

    it('should reject undo on an already reversed transaction', async () => {
      const payResult = await service.pay({
        amount: 25.00,
        operationType: 'DEBITO',
      });

      await service.undo({
        nsu: payResult.nsu,
        reason: 'Cancelamento no checkout',
      });

      await expect(
        service.undo({
          nsu: payResult.nsu,
          reason: 'Tentativa redundante',
        })
      ).rejects.toThrow(/já foi desfeita/i);
    });

    it('should reject undo on a confirmed transaction (must use cancel)', async () => {
      const payResult = await service.pay({
        amount: 55.00,
        operationType: 'DEBITO',
      });

      await service.confirm({
        nsu: payResult.nsu,
        saleId,
      });

      await expect(
        service.undo({
          nsu: payResult.nsu,
          reason: 'Tentativa inválida de undo em confirmada',
        })
      ).rejects.toThrow(/confirmada não pode ser desfeita/i);
    });

    it('should throw error when undoing non-existent NSU', async () => {
      await expect(
        service.undo({
          nsu: '888888',
          reason: 'Inexistente',
        })
      ).rejects.toThrow(/não encontrada/i);
    });
  });

  describe('Administrative Cancellation (cancel)', () => {
    it('should cancel confirmed transaction and generate cancellation NSU and receipt', async () => {
      const payResult = await service.pay({
        amount: 120.00,
        operationType: 'CREDITO',
        saleId,
      });

      await service.confirm({
        nsu: payResult.nsu,
        saleId,
      });

      const cancelResult = await service.cancel({
        nsu: payResult.nsu,
        reason: 'Devolução de mercadoria pelo cliente',
      });

      expect(cancelResult.success).toBe(true);
      expect(cancelResult.nsu).toBe(payResult.nsu);
      expect(cancelResult.cancellationNsu).toBeTruthy();
      expect(cancelResult.cancellationReceipt).toContain('COMPROVANTE DE CANCELAMENTO / ESTORNO');
      expect(cancelResult.cancelledAt).toBeTruthy();

      const tx = service.getTransactionByNsu(payResult.nsu);
      expect(tx?.status).toBe('CANCELLED');
      expect(tx?.cancellationNsu).toBe(cancelResult.cancellationNsu);
      expect(tx?.cancellationReason).toBe('Devolução de mercadoria pelo cliente');
      expect(tx?.cancellationReceipt).toBeTruthy();
      expect(tx?.cancelledAt).toBeTruthy();
    });

    it('should reject cancelling an unconfirmed transaction (must be CONFIRMED)', async () => {
      const payResult = await service.pay({
        amount: 40.00,
        operationType: 'DEBITO',
      });

      // Status está AUTHORIZED, não CONFIRMED
      await expect(
        service.cancel({
          nsu: payResult.nsu,
          reason: 'Cancelamento prematuro',
        })
      ).rejects.toThrow(/Apenas transações TEF confirmadas podem ser canceladas/i);
    });

    it('should reject cancelling an already cancelled transaction', async () => {
      const payResult = await service.pay({
        amount: 65.00,
        operationType: 'DEBITO',
        saleId,
      });

      await service.confirm({
        nsu: payResult.nsu,
        saleId,
      });

      await service.cancel({
        nsu: payResult.nsu,
        reason: 'Primeiro cancelamento',
      });

      await expect(
        service.cancel({
          nsu: payResult.nsu,
          reason: 'Segundo cancelamento',
        })
      ).rejects.toThrow(/já foi cancelada/i);
    });

    it('should throw error when cancelling non-existent NSU', async () => {
      await expect(
        service.cancel({
          nsu: '000111',
          reason: 'Não existe',
        })
      ).rejects.toThrow(/não encontrada/i);
    });
  });

  describe('Receipt Formatting (getReceiptText)', () => {
    it('should generate printable 48-column receipts for authorized/confirmed transaction with fallback storeInfo', async () => {
      const payResult = await service.pay({
        amount: 88.50,
        operationType: 'CREDITO',
        brandName: 'MASTERCARD',
        installments: 2,
        saleId,
      });

      await service.confirm({
        nsu: payResult.nsu,
        saleId,
      });

      const receipt = service.getReceiptText(payResult.nsu);

      expect(receipt.customerReceipt).toContain('1a VIA - CLIENTE');
      expect(receipt.customerReceipt).toContain('R$ 88,50');
      expect(receipt.customerReceipt).toContain('MASTERCARD');
      expect(receipt.merchantReceipt).toContain('2a VIA - ESTABELECIMENTO');
      expect(receipt.fullEscPos).toContain('\x1b\x69'); // Comando ESC/POS de corte de papel
    });

    it('should generate receipt using customStoreInfo when provided', async () => {
      const payResult = await service.pay({
        amount: 35.00,
        operationType: 'DEBITO',
      });

      const customStore: StoreInfo = {
        name: 'DROGARIA POPULAR MATRIZ',
        cnpj: '99.888.777/0001-66',
        address: 'AVENIDA CENTRAL, 500 - CENTRO',
      };

      const receipt = service.getReceiptText(payResult.nsu, customStore);

      expect(receipt.customerReceipt).toContain('DROGARIA POPULAR MATRIZ');
      expect(receipt.customerReceipt).toContain('99.888.777/0001-66');
      expect(receipt.merchantReceipt).toContain('DROGARIA POPULAR MATRIZ');
    });

    it('should generate cancellation receipt when transaction is CANCELLED', async () => {
      const payResult = await service.pay({
        amount: 72.00,
        operationType: 'DEBITO',
        saleId,
      });

      await service.confirm({
        nsu: payResult.nsu,
        saleId,
      });

      await service.cancel({
        nsu: payResult.nsu,
        reason: 'Erro de cobrança',
      });

      const receipt = service.getReceiptText(payResult.nsu);

      expect(receipt.customerReceipt).toContain('CANCELAMENTO');
      expect(receipt.merchantReceipt).toContain('CANCELAMENTO');
      expect(receipt.fullEscPos).toContain('\x1b\x69');
    });

    it('should throw error when generating receipt for non-existent NSU', () => {
      expect(() => {
        service.getReceiptText('999888');
      }).toThrow(/não encontrada/i);
    });
  });

  describe('Listing & Filtering (listTransactions)', () => {
    beforeEach(async () => {
      // Cria múltiplas transações com estados diferentes
      const p1 = await service.pay({
        amount: 10.00,
        operationType: 'DEBITO',
        brandName: 'VISA',
      });
      await service.confirm({ nsu: p1.nsu, saleId });

      const p2 = await service.pay({
        amount: 20.00,
        operationType: 'CREDITO',
        brandName: 'MASTERCARD',
      });
      await service.confirm({ nsu: p2.nsu, saleId });
      await service.cancel({ nsu: p2.nsu, reason: 'Estorno teste' });

      const p3 = await service.pay({
        amount: 30.00,
        operationType: 'VOUCHER',
        brandName: 'ALELO',
      });
      await service.undo({ nsu: p3.nsu, reason: 'Desfazimento teste' });

      await service.pay({
        amount: 40.00,
        operationType: 'DEBITO',
        brandName: 'ELO',
      }); // Fica AUTHORIZED
    });

    it('should list all transactions with pagination count', () => {
      const result = service.listTransactions();
      expect(result.total).toBe(4);
      expect(result.transactions.length).toBe(4);
    });

    it('should filter transactions by status', () => {
      const confirmed = service.listTransactions({ status: 'CONFIRMED' });
      expect(confirmed.total).toBe(1);
      expect(confirmed.transactions[0].amount).toBe(10.00);

      const cancelled = service.listTransactions({ status: 'CANCELLED' });
      expect(cancelled.total).toBe(1);
      expect(cancelled.transactions[0].amount).toBe(20.00);

      const reversed = service.listTransactions({ status: 'REVERSED' });
      expect(reversed.total).toBe(1);
      expect(reversed.transactions[0].amount).toBe(30.00);

      const authorized = service.listTransactions({ status: 'AUTHORIZED' });
      expect(authorized.total).toBe(1);
      expect(authorized.transactions[0].amount).toBe(40.00);
    });

    it('should filter transactions by operationType', () => {
      const debitos = service.listTransactions({ operationType: 'DEBITO' });
      expect(debitos.total).toBe(2);

      const vouchers = service.listTransactions({ operationType: 'VOUCHER' });
      expect(vouchers.total).toBe(1);
    });

    it('should apply limit and offset pagination', () => {
      const page1 = service.listTransactions({ limit: 2, offset: 0 });
      expect(page1.total).toBe(4);
      expect(page1.transactions.length).toBe(2);

      const page2 = service.listTransactions({ limit: 2, offset: 2 });
      expect(page2.total).toBe(4);
      expect(page2.transactions.length).toBe(2);
      expect(page1.transactions[0].id).not.toBe(page2.transactions[0].id);
    });
  });
});
