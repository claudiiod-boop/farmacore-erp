import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { SintegraService } from '../../../src/modules/fiscal/sintegra.service';

describe('SintegraService (Convênio ICMS 57/95 Farmacêutico)', () => {
  let db: Database;
  let service: SintegraService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new SintegraService(db);

    // Atualizar dados fiscais da loja 1
    db.prepare(`
      UPDATE stores SET
        cnpj = '12345678000199',
        ie = '1122334455',
        company_name = 'DROGARIA CENTRAL LTDA',
        name = 'Drogaria Central',
        phone = '11988887777',
        street = 'Rua das Farmacias',
        number = '500',
        neighborhood = 'Centro',
        city = 'São Paulo',
        state = 'SP',
        zip_code = '01310000',
        email = 'fiscal@central.com.br'
      WHERE id = 1
    `).run();

    // Produtos
    db.prepare(`
      INSERT INTO products (
        id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, ncm, cest, cfop, csosn_icms, cst_pis, cst_cofins
      ) VALUES 
        (1, '789100000001', 'Paracetamol 500mg 20 comp', 'Paracetamol', '100000001', 'SEM_TARJA', 'LIBERADO', 18.00, 8.00, 15.00, '30049099', '1300100', '5405', '500', '04', '04'),
        (2, '789100000002', 'Amoxicilina 500mg 15 cap', 'Amoxicilina', '100000002', 'VERMELHA', 'ANTIBIOTICO', 40.00, 20.00, 35.00, '30041011', '1300200', '5405', '500', '04', '04')
    `).run();

    // Lotes
    db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES 
        (1, 'LOTE-PAR-01', '2025-01-01', '2028-12-31', 100, 1),
        (2, 'LOTE-AMX-01', '2025-01-01', '2027-06-30', 50, 1)
    `).run();

    // Compra NF-e 55
    db.prepare(`
      INSERT INTO purchase_invoices (
        id, access_key, invoice_number, invoice_series, issue_date, supplier_cnpj, supplier_name, supplier_ie,
        total_invoice_amount, total_products_amount, xml_content, created_at
      ) VALUES (
        101, '35260598765432000111550010000012341000000010', 1234, 1, '2026-05-10', '98765432000111', 'DISTRIBUIDORA MED LTDA', '99887766',
        1800.00, 1800.00, '<nfeProc/>', '2026-05-10 10:00:00'
      )
    `).run();

    db.prepare(`
      INSERT INTO purchase_invoice_items (
        purchase_invoice_id, product_id, item_index, supplier_product_code, ean, product_name,
        ncm, cfop, quantity, unit_cost, total_cost
      ) VALUES 
        (101, 1, 1, 'MED-01', '789100000001', 'Paracetamol 500mg 20 comp', '30049099', '1403', 100, 8.00, 800.00),
        (101, 2, 2, 'MED-02', '789100000002', 'Amoxicilina 500mg 15 cap', '30041011', '1403', 50, 20.00, 1000.00)
    `).run();

    // Venda NFC-e 65
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

  it('should generate official Sintegra file with 126 characters per line', async () => {
    const record = await service.generateSintegra({
      storeId: 1,
      generationType: 'SINTEGRA',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      purpose: 0,
      includeInventory: true,
      inventoryDate: '2026-05-31',
      notes: 'Competência Maio/2026 Sintegra'
    });

    expect(record.id).toBeGreaterThan(0);
    expect(record.fileName).toContain('SINTEGRA_');
    expect(record.generationType).toBe('SINTEGRA');
    expect(record.totalInventoryValue).toBe(1800.0);

    const lines = record.fileContent.split('\r\n').filter((l) => l.length > 0);
    expect(lines.length).toBeGreaterThan(0);

    // Cada linha deve ter RIGOROSAMENTE 126 caracteres
    for (const line of lines) {
      expect(line.length).toBe(126);
    }

    // Registro 10 (Mestre)
    const r10 = lines.find((l) => l.startsWith('10'));
    expect(r10).toBeDefined();
    expect(r10?.substring(2, 16)).toBe('12345678000199');
    expect(r10?.substring(107, 115)).toBe('20260501');
    expect(r10?.substring(115, 123)).toBe('20260531');

    // Registro 11 (Complementar)
    const r11 = lines.find((l) => l.startsWith('11'));
    expect(r11).toBeDefined();

    // Registro 50 (Nota de Compra)
    const r50 = lines.find((l) => l.startsWith('50'));
    expect(r50).toBeDefined();
    expect(r50?.substring(2, 16)).toBe('98765432000111');
    expect(r50?.substring(40, 42)).toBe('55'); // Modelo 55

    // Registro 54 (Itens da Compra)
    const r54List = lines.filter((l) => l.startsWith('54'));
    expect(r54List.length).toBe(2);

    // Registro 60M & 60A (Venda Diária NFC-e)
    const r60M = lines.find((l) => l.startsWith('60M'));
    expect(r60M).toBeDefined();
    expect(r60M?.substring(3, 11)).toBe('20260515');

    const r60A = lines.find((l) => l.startsWith('60A'));
    expect(r60A).toBeDefined();
    expect(r60A?.substring(31, 35)).toBe('F1  '); // ICMS-ST Farmácia

    // Registro 74 (Inventário de Estoque)
    const r74List = lines.filter((l) => l.startsWith('74'));
    expect(r74List.length).toBe(2);

    // Registro 90 (Totalização)
    const r90 = lines.find((l) => l.startsWith('90'));
    expect(r90).toBeDefined();
    expect(r90?.substring(2, 16)).toBe('12345678000199');
  });
});
