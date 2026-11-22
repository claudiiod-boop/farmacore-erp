import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { SpedFiscalService } from '../../../src/modules/fiscal/sped-fiscal.service';

describe('SpedFiscalService (EFD ICMS/IPI & Bloco H Farmacêutico)', () => {
  let db: Database;
  let service: SpedFiscalService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new SpedFiscalService(db);

    // Atualizar dados fiscais da loja padrão id = 1
    db.prepare(`
      UPDATE stores SET
        cnpj = '12345678000199',
        ie = '1122334455',
        company_name = 'DROGARIA CENTRAL LTDA',
        name = 'Drogaria Central',
        phone = '11988887777',
        email = 'fiscal@central.com.br'
      WHERE id = 1
    `).run();

    // Inserir produtos de teste
    db.prepare(`
      INSERT INTO products (
        id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, ncm, cest, cfop, csosn_icms, cst_pis, cst_cofins
      ) VALUES 
        (1, '789100000001', 'Paracetamol 500mg 20 comp', 'Paracetamol', '100000001', 'SEM_TARJA', 'LIBERADO', 18.00, 8.00, 15.00, '30049099', '1300100', '5405', '500', '04', '04'),
        (2, '789100000002', 'Amoxicilina 500mg 15 cap', 'Amoxicilina', '100000002', 'VERMELHA', 'ANTIBIOTICO', 40.00, 20.00, 35.00, '30041011', '1300200', '5405', '500', '04', '04')
    `).run();

    // Inserir lotes de estoque
    db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES 
        (1, 'LOTE-PAR-01', '2025-01-01', '2028-12-31', 100, 1),
        (2, 'LOTE-AMX-01', '2025-01-01', '2027-06-30', 50, 1)
    `).run();

    // Inserir fornecedor e nota de compra
    db.prepare(`
      INSERT INTO purchase_invoices (
        id, access_key, invoice_number, invoice_series, issue_date, supplier_cnpj, supplier_name, supplier_ie,
        total_invoice_amount, total_products_amount, xml_content, created_at
      ) VALUES (
        101, '35260598765432000111550010000012341000000010', 1234, 1, '2026-05-10', '98765432000111', 'DISTRIBUIDORA MED LTDA', '99887766',
        1800.00, 1800.00, '<nfeProc/>', '2026-05-10 10:00:00'
      )
    `).run();

    // Inserir itens de compra para custo médio
    db.prepare(`
      INSERT INTO purchase_invoice_items (
        purchase_invoice_id, product_id, item_index, supplier_product_code, ean, product_name,
        ncm, cfop, quantity, unit_cost, total_cost
      ) VALUES 
        (101, 1, 1, 'MED-01', '789100000001', 'Paracetamol 500mg 20 comp', '30049099', '1403', 100, 8.00, 800.00),
        (101, 2, 2, 'MED-02', '789100000002', 'Amoxicilina 500mg 15 cap', '30041011', '1403', 50, 20.00, 1000.00)
    `).run();

    // Inserir venda e NFC-e
    db.prepare(`
      INSERT INTO sales (id, pre_sale_id, status, total_amount, discount_amount, created_at)
      VALUES (1, NULL, 'COMPLETED', 50.00, 0.00, '2026-05-15 14:00:00')
    `).run();

    db.prepare(`
      INSERT INTO nfce_invoices (
        sale_id, ch_nfe, n_nf, serie, tp_amb, tp_emis, status, qr_code_url, xml_signed, created_at
      ) VALUES (
        1, '35260512345678000199650010000000011000000010', 1, 1, 2, 1, 'AUTORIZADA', 'https://sefaz.sp.gov.br/qrcode', '<xml/>', '2026-05-15 14:01:00'
      )
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('should set and retrieve accounting parameters', () => {
    const params = service.setAccountingParameters({
      storeId: 1,
      accountantName: 'Roberto Contador',
      accountantCpf: '111.222.333-44',
      accountantCrc: 'CRC-SP 123456/O',
      accountantCnpj: '11.222.333/0001-99',
      accountantEmail: 'roberto@contabilidade.com.br',
      accountantPhone: '1133334444',
      accountantCep: '01310-000',
      accountantAddress: 'Avenida Paulista, 1000',
      accountantCityCode: 3550308,
      spedProfile: 'A',
      spedVersion: '018'
    });

    expect(params.id).toBeDefined();

    const retrieved = service.getAccountingParameters(1);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.accountantName).toBe('Roberto Contador');
    expect(retrieved?.accountantCpf).toBe('11122233344');
    expect(retrieved?.accountantCrc).toBe('CRC-SP 123456/O');
  });

  it('should calculate Block H inventory items with quantities and average costs', () => {
    const inv = service.getInventoryBlockH(1);
    expect(inv).toHaveLength(2);

    const paracetamol = inv.find((i) => i.productId === 1);
    expect(paracetamol).toBeDefined();
    expect(paracetamol?.quantity).toBe(100);
    expect(paracetamol?.averageCost).toBe(8.0);
    expect(paracetamol?.totalValue).toBe(800.0);
    expect(paracetamol?.ncm).toBe('30049099');

    const amoxicilina = inv.find((i) => i.productId === 2);
    expect(amoxicilina).toBeDefined();
    expect(amoxicilina?.quantity).toBe(50);
    expect(amoxicilina?.totalValue).toBe(1000.0);
  });

  it('should generate official SPED EFD ICMS/IPI file with complete blocks 0, C, E, H and 9', async () => {
    service.setAccountingParameters({
      storeId: 1,
      accountantName: 'Roberto Contador',
      accountantCpf: '11122233344',
      accountantCrc: 'CRC-SP 123456/O',
      spedProfile: 'A',
      spedVersion: '018'
    });

    const record = await service.generateSpedFiscal({
      storeId: 1,
      generationType: 'SPED_EFD',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      purpose: 0,
      includeInventory: true,
      inventoryDate: '2026-05-31',
      notes: 'Competência Maio/2026 com Inventário'
    });

    expect(record.id).toBeGreaterThan(0);
    expect(record.fileName).toContain('SPED_EFD_');
    expect(record.totalDocuments).toBe(2); // 1 compra + 1 venda
    expect(record.totalInventoryValue).toBe(1800.0); // 800 + 1000

    const lines = record.fileContent.trim().split('\r\n');
    expect(lines.length).toBe(record.totalLines);

    // Registro 0000
    const r0000 = lines.find((l) => l.startsWith('|0000|'));
    expect(r0000).toBeDefined();
    expect(r0000).toContain('|018|0|01052026|31052026|');
    expect(r0000).toContain('|12345678000199|');

    // Registro 0100 (Contador)
    const r0100 = lines.find((l) => l.startsWith('|0100|'));
    expect(r0100).toBeDefined();
    expect(r0100).toContain('|ROBERTO CONTADOR|11122233344|CRC-SP 123456/O|');

    // Registro 0150 (Participantes - Fornecedor)
    const r0150 = lines.find((l) => l.startsWith('|0150|'));
    expect(r0150).toBeDefined();
    expect(r0150).toContain('DISTRIBUIDORA MED LTDA');

    // Registro 0200 (Produtos)
    const r0200 = lines.filter((l) => l.startsWith('|0200|'));
    expect(r0200.length).toBe(2);

    // Bloco C (Documentos Fiscais)
    const rC100 = lines.filter((l) => l.startsWith('|C100|'));
    expect(rC100.length).toBe(2); // 1 compra modelo 55 + 1 venda NFC-e modelo 65

    const rC190 = lines.filter((l) => l.startsWith('|C190|'));
    expect(rC190.length).toBe(2);

    // Bloco E (Apuração ICMS)
    expect(lines.some((l) => l.startsWith('|E100|01052026|31052026|'))).toBe(true);
    expect(lines.some((l) => l.startsWith('|E110|'))).toBe(true);

    // Bloco H (Inventário)
    expect(lines.some((l) => l.startsWith('|H005|31052026|1800.00|01|'))).toBe(true);
    const rH010 = lines.filter((l) => l.startsWith('|H010|'));
    expect(rH010.length).toBe(2);

    // Bloco 9 (Totalizadores e Encerramento)
    const r9999 = lines.find((l) => l.startsWith('|9999|'));
    expect(r9999).toBeDefined();
    expect(r9999).toBe(`|9999|${lines.length}|`);
  });
});
