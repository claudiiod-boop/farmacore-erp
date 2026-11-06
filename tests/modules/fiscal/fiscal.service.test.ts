import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { FiscalService } from '../../../src/modules/fiscal/fiscal.service';
import { SefazMockProvider } from '../../../src/modules/fiscal/transmission/sefaz-mock.provider';
import type { FiscalProfile } from '../../../src/modules/fiscal/types';

describe('FiscalService & Transmission Providers', () => {
  let db: Database;
  let fiscalService: FiscalService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    fiscalService = new FiscalService(db, new SefazMockProvider());
  });

  afterEach(() => {
    db.close();
  });

  const testProfile: Omit<FiscalProfile, 'id'> = {
    cnpj: '12.345.678/0001-90',
    ie: '123.456.789.111',
    razaoSocial: 'DROGARIA POPULAR FARMACORE LTDA',
    nomeFantasia: 'DROGARIA POPULAR',
    crt: 1,
    cUf: 35,
    municipio: 'São Paulo',
    cMun: 3550308,
    logradouro: 'Av. Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    cep: '01310-100',
    serie: 1,
    nextNnf: 1,
    cscToken: 'TEST-TOKEN-123456',
    cscId: '000001',
    environment: 'HOMOLOGACAO',
  };

  function seedSale(options?: { customerCpf?: string | null }): number {
    // 1. Insert product
    const productResult = db
      .prepare(
        `INSERT INTO products (
          ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price,
          ncm, cest, cfop, csosn_icms, cst_pis, cst_cofins, origin
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        '7891234567890',
        'Dipirona 500mg 10 comprimidos',
        'Dipirona',
        '100000001',
        'SEM_TARJA',
        'LIBERADO',
        15.0,
        7.0,
        10.0,
        '30049099',
        '1300100',
        '5405',
        '500',
        '04',
        '04',
        0
      );
    const productId = Number(productResult.lastInsertRowid);

    // 2. Insert batch
    const batchResult = db
      .prepare(
        `INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(productId, 'LOTE123', '2026-01-01', '2027-12-31', 100);
    const batchId = Number(batchResult.lastInsertRowid);

    // 3. Insert pre_sale (for customer CPF)
    const preSaleResult = db
      .prepare(
        `INSERT INTO pre_sales (code, status, customer_name, customer_cpf, total_amount)
         VALUES (?, 'CLOSED', ?, ?, ?)`
      )
      .run('PV-001-' + Date.now(), 'Cliente Teste', options?.customerCpf ?? '123.456.789-00', 20.0);
    const preSaleId = Number(preSaleResult.lastInsertRowid);

    // 4. Insert sale
    const saleResult = db
      .prepare(
        `INSERT INTO sales (pre_sale_id, status, total_amount, discount_amount, change_amount)
         VALUES (?, 'COMPLETED', ?, ?, ?)`
      )
      .run(preSaleId, 20.0, 0, 5.0);
    const saleId = Number(saleResult.lastInsertRowid);

    // 5. Insert sale_items
    db.prepare(
      `INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, total_price)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(saleId, productId, batchId, 2, 10.0, 20.0);

    // 6. Insert sale_payments
    db.prepare(
      `INSERT INTO sale_payments (sale_id, method, amount)
       VALUES (?, ?, ?)`
    ).run(saleId, 'DINHEIRO', 25.0);

    return saleId;
  }

  describe('Fiscal Profile Management', () => {
    it('should return null when fiscal profile is not configured', () => {
      const profile = fiscalService.getFiscalProfile();
      expect(profile).toBeNull();
    });

    it('should configure and retrieve fiscal profile', () => {
      const saved = fiscalService.updateFiscalProfile(testProfile);
      expect(saved.id).toBeDefined();
      expect(saved.cnpj).toBe(testProfile.cnpj);
      expect(saved.nextNnf).toBe(1);

      const retrieved = fiscalService.getFiscalProfile();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.cnpj).toBe(testProfile.cnpj);
      expect(retrieved?.nomeFantasia).toBe(testProfile.nomeFantasia);
    });

    it('should update existing fiscal profile without creating duplicate records', () => {
      fiscalService.updateFiscalProfile(testProfile);
      const updated = fiscalService.updateFiscalProfile({
        nomeFantasia: 'DROGARIA POPULAR NOVA',
        nextNnf: 50,
      });

      expect(updated.nomeFantasia).toBe('DROGARIA POPULAR NOVA');
      expect(updated.nextNnf).toBe(50);

      const count = db
        .prepare<{ total: number }>('SELECT count(*) as total FROM fiscal_profiles')
        .get();
      expect(count?.total).toBe(1);
    });
  });

  describe('NFC-e Normal Issuance', () => {
    beforeEach(() => {
      fiscalService.updateFiscalProfile(testProfile);
    });

    it('should issue and authorize an NFC-e for a completed sale', async () => {
      const saleId = seedSale({ customerCpf: '123.456.789-00' });

      const details = await fiscalService.issueNfce(saleId);

      expect(details).toBeDefined();
      expect(details.invoice).toBeDefined();
      expect(details.invoice.saleId).toBe(saleId);
      expect(details.invoice.status).toBe('AUTORIZADA');
      expect(details.invoice.tpEmis).toBe(1);
      expect(details.invoice.nNF).toBe(1);
      expect(details.invoice.serie).toBe(1);
      expect(details.invoice.chNFe).toHaveLength(44);
      expect(details.invoice.protocolNumber).toMatch(/^135/);
      expect(details.invoice.protocolDate).toBeDefined();
      expect(details.invoice.xmlSigned).toContain('<Signature');
      expect(details.invoice.xmlAuthorized).toContain('<protNFe');
      expect(details.invoice.qrCodeUrl).toContain('https://');
      expect(details.customerCpf).toBe('123.456.789-00');
      expect(details.danfeText).toContain('DANFE NFC-e');
      expect(details.danfeText).toContain(details.invoice.protocolNumber!);

      // Check DB persistence
      const row = db
        .prepare<any>('SELECT * FROM nfce_invoices WHERE sale_id = ?')
        .get(saleId);
      expect(row).toBeDefined();
      expect(row.status).toBe('AUTORIZADA');
      expect(row.ch_nfe).toBe(details.invoice.chNFe);

      // Check next_nnf increment
      const profile = fiscalService.getFiscalProfile();
      expect(profile?.nextNnf).toBe(2);
    });

    it('should throw NFCE_ALREADY_ISSUED when attempting to issue twice for same sale', async () => {
      const saleId = seedSale();

      await fiscalService.issueNfce(saleId);

      await expect(fiscalService.issueNfce(saleId)).rejects.toThrow('NFCE_ALREADY_ISSUED');
    });

    it('should throw SALE_NOT_FOUND if sale does not exist', async () => {
      await expect(fiscalService.issueNfce(999999)).rejects.toThrow('SALE_NOT_FOUND');
    });

    it('should throw FISCAL_PROFILE_NOT_CONFIGURED if profile is missing', async () => {
      db.prepare('DELETE FROM fiscal_profiles').run();
      const saleId = seedSale();

      await expect(fiscalService.issueNfce(saleId)).rejects.toThrow('FISCAL_PROFILE_NOT_CONFIGURED');
    });
  });

  describe('NFC-e Offline Contingency Issuance', () => {
    beforeEach(() => {
      fiscalService.updateFiscalProfile(testProfile);
    });

    it('should issue NFC-e in offline contingency (tpEmis = 9)', async () => {
      const saleId = seedSale();

      const details = await fiscalService.issueNfce(saleId, { offlineContingency: true });

      expect(details.invoice.status).toBe('CONTINGENCIA');
      expect(details.invoice.tpEmis).toBe(9);
      expect(details.invoice.protocolNumber).toBeNull();
      expect(details.invoice.protocolDate).toBeNull();
      expect(details.invoice.xmlAuthorized).toBeNull();
      expect(details.invoice.xmlSigned).toContain('<tpEmis>9</tpEmis>');
      expect(details.danfeText).toContain('EMITIDA EM CONTINGÊNCIA - PENDENTE DE');
      expect(details.danfeText).toContain('AUTORIZAÇÃO');
    });
  });

  describe('NFC-e Cancellation', () => {
    beforeEach(() => {
      fiscalService.updateFiscalProfile(testProfile);
    });

    it('should cancel an authorized NFC-e with a valid reason (>= 15 chars)', async () => {
      const saleId = seedSale();
      await fiscalService.issueNfce(saleId);

      const cancelReason = 'Cancelamento por desistência do consumidor no caixa';
      const result = await fiscalService.cancelNfce(saleId, cancelReason);

      expect(result.success).toBe(true);
      expect(result.cStat).toBe(135);

      const invoice = fiscalService.getNfceBySaleId(saleId);
      expect(invoice?.invoice.status).toBe('CANCELADA');
      expect(invoice?.invoice.cancellationReason).toBe(cancelReason);
    });

    it('should reject cancellation if reason is shorter than 15 characters', async () => {
      const saleId = seedSale();
      await fiscalService.issueNfce(saleId);

      await expect(fiscalService.cancelNfce(saleId, 'Curto')).rejects.toThrow(
        'INVALID_CANCELLATION_REASON'
      );
    });

    it('should reject cancellation if invoice does not exist or is not authorized', async () => {
      const saleId = seedSale();
      // Sale exists, but no invoice issued yet
      await expect(
        fiscalService.cancelNfce(saleId, 'Cancelamento por desistência do consumidor no caixa')
      ).rejects.toThrow('INVOICE_NOT_CANCELLABLE');
    });
  });

  describe('getNfceBySaleId', () => {
    beforeEach(() => {
      fiscalService.updateFiscalProfile(testProfile);
    });

    it('should return null when no NFC-e exists for sale', () => {
      const saleId = seedSale();
      const res = fiscalService.getNfceBySaleId(saleId);
      expect(res).toBeNull();
    });

    it('should retrieve existing NFC-e details and formatted DANFE', async () => {
      const saleId = seedSale();
      const issued = await fiscalService.issueNfce(saleId);

      const fetched = fiscalService.getNfceBySaleId(saleId);
      expect(fetched).not.toBeNull();
      expect(fetched?.invoice.chNFe).toBe(issued.invoice.chNFe);
      expect(fetched?.danfeText).toContain('DANFE NFC-e');
      expect(fetched?.items).toHaveLength(1);
      expect(fetched?.payments).toHaveLength(1);
    });
  });
});
