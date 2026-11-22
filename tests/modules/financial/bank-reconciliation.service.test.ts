import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { BankReconciliationService } from '../../../src/modules/financial/bank-reconciliation.service';
import { CardReconciliationService } from '../../../src/modules/financial/card-reconciliation.service';

describe('BankReconciliationService', () => {
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    // Conta bancária de teste
    await BankReconciliationService.createBankAccount(db, {
      storeId: 1,
      bankCode: '341',
      bankName: 'Banco Itaú Unibanco',
      agencyNumber: '0057',
      accountNumber: '12345-6',
      initialBalance: 10000.00
    });

    // TEF Config & Transação TEF confirmada
    db.prepare(`
      INSERT INTO tef_configs (provider_id, provider_name, environment, terminal_id, is_active)
      VALUES ('SITEF', 'Software Express SiTef', 'MOCK', 'SE000001', 1)
    `).run();

    db.prepare(`
      INSERT INTO tef_transactions (
        id, transaction_uuid, provider_id, terminal_id, operation_type, status,
        amount, installments, brand_name, brand_code_sefaz, acquirer_name, acquirer_cnpj,
        authorization_code, nsu, host_nsu, created_at
      ) VALUES (
        1, 'uuid-tef-stone', 'SITEF', 'SE000001', 'DEBITO', 'CONFIRMED',
        2000.00, 1, 'VISA', '01', 'STONE', '16501555000157',
        'AUTH-STONE', 'NSU-STONE-01', 'HOST01', '2026-06-01 10:00:00'
      )
    `).run();

    // Cria contrato de cartões e importa liquidação de R$ 1.970,00 líquido (2000 bruto - 30 taxa)
    const stoneContract = await CardReconciliationService.createAcquirerContract(db, {
      storeId: 1,
      acquirerName: 'STONE',
      acquirerCnpj: '16501555000157',
      defaultBankName: 'Banco Itaú',
      defaultBankAgency: '0057',
      defaultBankAccount: '12345-6'
    });

    await CardReconciliationService.importStatement(db, {
      storeId: 1,
      acquirerContractId: stoneContract.id,
      fileName: 'EXTRATO_STONE.csv',
      fileType: 'EXTRATO_CSV',
      items: [
        {
          nsu: 'NSU-STONE-01',
          authorizationCode: 'AUTH-STONE',
          transactionDate: '2026-06-01 10:00:00',
          settlementDate: '2026-06-02',
          brandName: 'VISA',
          operationType: 'DEBIT',
          grossAmount: 2000.00,
          chargedMdrRate: 1.50,
          chargedFeeAmount: 30.00,
          netAmount: 1970.00
        }
      ]
    });

    // Registra sangria de caixa (fechamento em dinheiro) de R$ 850,00
    db.prepare(`
      INSERT INTO cash_sessions (id, operator_name, initial_cash, current_cash, status, opened_at)
      VALUES (1, 'Operador Balcão', 200.00, 200.00, 'CLOSED', '2026-06-01 08:00:00')
    `).run();

    db.prepare(`
      INSERT INTO cash_movements (id, cash_session_id, type, amount, reason, operator_name, created_at)
      VALUES (1, 1, 'SANGRIA', 850.00, 'Sangria fechamento de caixa para depósito bancário', 'Operador Balcão', '2026-06-01 18:00:00')
    `).run();

    // Registra nota fiscal de compra de distribuidor no valor de R$ 3.200,00
    db.prepare(`
      INSERT INTO purchase_invoices (
        id, access_key, invoice_number, invoice_series, issue_date,
        supplier_cnpj, supplier_name, total_invoice_amount, total_products_amount, xml_content
      ) VALUES (
        1, '35260600111222000133550010000012341000012345', 1234, 1, '2026-06-01',
        '00111222000133', 'PROFARMA DISTRIBUIDORA LTDA', 3200.00, 3200.00, '<nfeProc/>'
      )
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  describe('Bank Accounts Management', () => {
    it('should create and list bank accounts per store', async () => {
      const accounts = await BankReconciliationService.listBankAccounts(db, 1);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].bankCode).toBe('341');
      expect(accounts[0].accountNumber).toBe('12345-6');
      expect(accounts[0].currentBalance).toBe(10000.00);
    });
  });

  describe('importOfxStatement and Automated Multi-Source Reconciliation', () => {
    it('should parse OFX, reconcile TEF, Cash Drawer, Supplier Payment and Bank Fee automatically', async () => {
      const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKACCTFROM>
<BANKID>341
<ACCTID>0057-12345-6
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260601
<DTEND>20260605
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260602100000
<TRNAMT>1970.00
<FITID>OFX-STONE-LIQ-01
<MEMO>LIQUIDACAO STONE PAGAMENTOS
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260602110000
<TRNAMT>850.00
<FITID>OFX-DEP-SANGRIA-02
<MEMO>DEPOSITO DINHEIRO DINHEIRO TERMINAL
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260602140000
<TRNAMT>-3200.00
<FITID>OFX-PAG-BOLETO-03
<MEMO>PAGAMENTO BOLETO PROFARMA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260603090000
<TRNAMT>-45.90
<FITID>OFX-TARIFA-04
<MEMO>TARIFA MENSAL MANUTENCAO CONTA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260604150000
<TRNAMT>135.00
<FITID>OFX-DOC-DESCONHECIDO-05
<MEMO>TRANSFERENCIA PIX DESCONHECIDO
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>9709.10
<DTASOF>20260605
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

      const accounts = await BankReconciliationService.listBankAccounts(db, 1);
      const accountId = accounts[0].id;

      const batch = await BankReconciliationService.importOfxStatement(db, {
        bankAccountId: accountId,
        fileName: 'extrato_itau_junho.ofx',
        ofxContent
      });

      expect(batch.id).toBeGreaterThan(0);
      expect(batch.totalEntries).toBe(5);
      expect(batch.matchedEntries).toBe(4); // TEF (1970) + Sangria (850) + Fornecedor (3200) + Tarifa (45.90)
      expect(batch.unmatchedEntries).toBe(1); // Pix Desconhecido (135)

      const details = await BankReconciliationService.getBatchDetails(db, batch.id);
      expect(details.entries).toHaveLength(5);

      // 1. TEF Settlement
      const tefEntry = details.entries.find(e => e.fitid === 'OFX-STONE-LIQ-01');
      expect(tefEntry?.reconciliationStatus).toBe('MATCHED');
      expect(tefEntry?.reconciliationType).toBe('TEF_SETTLEMENT');
      expect(tefEntry?.matchedEntityId).toBeGreaterThan(0);

      // 2. Sangria Caixa PDV
      const cashEntry = details.entries.find(e => e.fitid === 'OFX-DEP-SANGRIA-02');
      expect(cashEntry?.reconciliationStatus).toBe('MATCHED');
      expect(cashEntry?.reconciliationType).toBe('CASH_DRAWER');
      expect(cashEntry?.matchedEntityId).toBe(1);

      // 3. Boleto de Fornecedor
      const supplierEntry = details.entries.find(e => e.fitid === 'OFX-PAG-BOLETO-03');
      expect(supplierEntry?.reconciliationStatus).toBe('MATCHED');
      expect(supplierEntry?.reconciliationType).toBe('PURCHASE_PAYMENT');
      expect(supplierEntry?.matchedEntityId).toBe(1);

      // 4. Tarifa Bancária
      const feeEntry = details.entries.find(e => e.fitid === 'OFX-TARIFA-04');
      expect(feeEntry?.reconciliationStatus).toBe('BANK_FEE');
      expect(feeEntry?.reconciliationType).toBe('BANK_FEE');

      // 5. Desconhecido (UNMATCHED)
      const unknownEntry = details.entries.find(e => e.fitid === 'OFX-DOC-DESCONHECIDO-05');
      expect(unknownEntry?.reconciliationStatus).toBe('UNMATCHED');

      // 6. Teste de Idempotência: reimportar o mesmo extrato não deve duplicar registros
      const batch2 = await BankReconciliationService.importOfxStatement(db, {
        bankAccountId: accountId,
        fileName: 'extrato_itau_junho_retry.ofx',
        ofxContent
      });
      expect(batch2.totalEntries).toBe(0); // Nenhuma entrada duplicada inserida
    });

    it('should allow manual match of an UNMATCHED bank entry', async () => {
      const accounts = await BankReconciliationService.listBankAccounts(db, 1);
      const accountId = accounts[0].id;

      const ofxContent = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260601100000
<TRNAMT>50.00
<FITID>OFX-AVULSO-99
<MEMO>PIX AVULSO CLIENTE JOAO
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

      const batch = await BankReconciliationService.importOfxStatement(db, {
        bankAccountId: accountId,
        fileName: 'extrato_avulso.ofx',
        ofxContent
      });

      const details = await BankReconciliationService.getBatchDetails(db, batch.id);
      const entryId = details.entries[0].id;

      const matched = await BankReconciliationService.manualMatchEntry(db, {
        entryId,
        reconciliationType: 'CUSTOMER_CREDIT',
        matchedEntityId: 10,
        notes: 'Identificado pagamento de crediário via PIX em conta'
      });

      expect(matched.reconciliationStatus).toBe('MANUAL_MATCH');
      expect(matched.reconciliationType).toBe('CUSTOMER_CREDIT');
      expect(matched.matchedNotes).toContain('crediário');
    });
  });
});
