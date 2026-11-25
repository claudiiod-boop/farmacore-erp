import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { DdaService } from '../../../src/modules/financial/dda.service';

describe('DdaService (Conciliação DDA & Boletos de Medicamentos)', () => {
  let db: Database;
  let service: DdaService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new DdaService(db);

    // Inserir loja padrão
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj)
      VALUES (1, 'Farmácia Matriz', '98.765.432/0001-88')
    `).run();

    // Inserir notas de compra de distribuidoras (purchase_invoices)
    db.prepare(`
      INSERT INTO purchase_invoices (
        id, access_key, invoice_number, invoice_series, issue_date,
        supplier_cnpj, supplier_name, total_invoice_amount, total_products_amount, xml_content
      ) VALUES (
        1, '35261111111111111111550010000012341001234567', 1234, 1, '2026-11-20',
        '12.345.678/0001-99', 'Distribuidora Panpharma Medicamentos', 2500.50, 2500.50, '<xml></xml>'
      ), (
        2, '35261122222222222222550010000056781009876543', 5678, 1, '2026-11-22',
        '22.333.444/0001-11', 'Profarma Distribuidora', 1800.00, 1800.00, '<xml></xml>'
      )
    `).run();

    // Inserir plano de contas / centro de custo e despesa operacional
    db.prepare(`
      INSERT OR IGNORE INTO cost_centers (id, store_id, code, name, department_type, is_active)
      VALUES (1, 1, 'ADM-01', 'Administrativo', 'ADMINISTRATIVO', 1)
    `).run();

    db.prepare(`
      INSERT INTO operational_expenses (
        id, store_id, cost_center_id, expense_type, description, amount, due_date, status
      ) VALUES (
        1, 1, 1, 'ADMINISTRATIVA', 'Internet Fibra Farmácia Matriz', 199.90, '2026-12-10', 'PENDING'
      )
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('1. Importa lote de boletos bancários DDA com cálculo correto de final_amount', async () => {
    const imported = await service.importDdaInvoices('1', [
      {
        bank_code: '001',
        bank_name: 'Banco do Brasil',
        barcode: '00191234567890123456789012345678901234567890',
        digitable_line: '00190.00009 01234.567890 12345.678901 2 89012345678901',
        beneficiary_cnpj: '12.345.678/0001-99',
        beneficiary_name: 'Distribuidora Panpharma Medicamentos',
        payer_cnpj: '98.765.432/0001-88',
        due_date: '2026-12-20',
        issue_date: '2026-11-20',
        nominal_amount: 2550.50,
        discount_amount: 50.00, // final = 2500.50
        interest_amount: 0.00
      }
    ]);

    expect(imported).toHaveLength(1);
    expect(imported[0].beneficiary_cnpj).toBe('12345678000199');
    expect(imported[0].final_amount).toBe(2500.50);
    expect(imported[0].status).toBe('PENDING');
  });

  it('2. Concilia automaticamente com purchase_invoices por CNPJ e valor exato', async () => {
    await service.importDdaInvoices('1', [
      {
        bank_code: '001',
        bank_name: 'Banco do Brasil',
        barcode: '00191234567890123456789012345678901234567890',
        digitable_line: '00190.00009 01234.567890 12345.678901 2 89012345678901',
        beneficiary_cnpj: '12.345.678/0001-99',
        beneficiary_name: 'Distribuidora Panpharma Medicamentos',
        payer_cnpj: '98765432000188',
        due_date: '2026-12-20',
        issue_date: '2026-11-20',
        nominal_amount: 2500.50
      }
    ]);

    const result = await service.reconcileInvoicesAuto('1');

    expect(result.totalProcessed).toBe(1);
    expect(result.matchedCount).toBe(1);
    expect(result.invoices[0].status).toBe('MATCHED');
    expect(result.invoices[0].matched_purchase_invoice_id).toBe(1);
  });

  it('3. Marca MISMATCH_VALUE quando CNPJ bate mas valor difere', async () => {
    await service.importDdaInvoices('1', [
      {
        bank_code: '237',
        bank_name: 'Bradesco',
        barcode: '23791234567890123456789012345678901234567890',
        digitable_line: '23790.00009 01234.567890 12345.678901 2 89012345678901',
        beneficiary_cnpj: '22.333.444/0001-11',
        beneficiary_name: 'Profarma Distribuidora',
        payer_cnpj: '98765432000188',
        due_date: '2026-12-22',
        issue_date: '2026-11-22',
        nominal_amount: 1950.00 // Na NF era 1800.00
      }
    ]);

    const result = await service.reconcileInvoicesAuto('1');

    expect(result.mismatchValueCount).toBe(1);
    expect(result.invoices[0].status).toBe('MISMATCH_VALUE');
    expect(result.invoices[0].discrepancyNote).toContain('Valor do boleto DDA');
  });

  it('4. Marca UNMATCHED para boletos não reconhecidos (alerta anti-fraude)', async () => {
    await service.importDdaInvoices('1', [
      {
        bank_code: '341',
        bank_name: 'Itaú',
        barcode: '34191234567890123456789012345678901234567890',
        digitable_line: '34190.00009 01234.567890 12345.678901 2 89012345678901',
        beneficiary_cnpj: '99.888.777/0001-66',
        beneficiary_name: 'Distribuidora Fantasma LTDA',
        payer_cnpj: '98765432000188',
        due_date: '2026-12-25',
        issue_date: '2026-11-25',
        nominal_amount: 850.00
      }
    ]);

    const result = await service.reconcileInvoicesAuto('1');

    expect(result.unmatchedCount).toBe(1);
    expect(result.invoices[0].status).toBe('UNMATCHED');
    expect(result.invoices[0].discrepancyNote).toContain('Atenção a possível fraude');
  });

  it('5. Concilia com despesas operacionais (ex: conta de internet)', async () => {
    await service.importDdaInvoices('1', [
      {
        bank_code: '033',
        bank_name: 'Santander',
        barcode: '03391234567890123456789012345678901234567890',
        digitable_line: '03390.00009 01234.567890 12345.678901 2 89012345678901',
        beneficiary_cnpj: '00.000.000/0001-00',
        beneficiary_name: 'Internet Fibra Farmácia Matriz',
        payer_cnpj: '98765432000188',
        due_date: '2026-12-10',
        issue_date: '2026-11-25',
        nominal_amount: 199.90
      }
    ]);

    const result = await service.reconcileInvoicesAuto('1');

    expect(result.matchedCount).toBe(1);
    expect(result.invoices[0].status).toBe('MATCHED');
    expect(String(result.invoices[0].matched_expense_id)).toBe('1');
  });

  it('6. Vinculação manual de boleto e quitação com baixa em despesa', async () => {
    const [inv] = await service.importDdaInvoices('1', [
      {
        bank_code: '001',
        bank_name: 'Banco do Brasil',
        barcode: '00191234567890123456789012345678901234567890',
        digitable_line: '00190.00009 01234.567890 12345.678901 2 89012345678901',
        beneficiary_cnpj: '00.000.000/0001-00',
        beneficiary_name: 'Provedor Telecom',
        payer_cnpj: '98765432000188',
        due_date: '2026-12-10',
        issue_date: '2026-11-25',
        nominal_amount: 199.90
      }
    ]);

    const matched = await service.manualMatch(inv.id, 'EXPENSE', '1', 'COORD_FINANCEIRO');
    expect(matched.status).toBe('MATCHED');
    expect(String(matched.matched_expense_id)).toBe('1');

    // Quitação
    const settled = await service.settleDdaInvoice(inv.id, 199.90, '2026-12-08');
    expect(settled.status).toBe('PAID');

    // Despesa deve estar paga
    const exp = db.prepare(`SELECT * FROM operational_expenses WHERE id = 1`).get() as any;
    expect(exp.status).toBe('PAID');
    expect(exp.payment_date).toBe('2026-12-08');
  });

  it('7. Calcula KPIs de conciliação DDA com precisão', async () => {
    await service.importDdaInvoices('1', [
      {
        bank_code: '001',
        bank_name: 'Banco do Brasil',
        barcode: '00191234567890123456789012345678901234567890',
        digitable_line: '00190.00009 01234.567890 12345.678901 2 89012345678901',
        beneficiary_cnpj: '12.345.678/0001-99',
        beneficiary_name: 'Panpharma',
        payer_cnpj: '98765432000188',
        due_date: '2026-12-20',
        issue_date: '2026-11-20',
        nominal_amount: 2500.50
      },
      {
        bank_code: '341',
        bank_name: 'Itaú',
        barcode: '34191234567890123456789012345678901234567890',
        digitable_line: '34190.00009 01234.567890 12345.678901 2 89012345678901',
        beneficiary_cnpj: '99.888.777/0001-66',
        beneficiary_name: 'Desconhecido',
        payer_cnpj: '98765432000188',
        due_date: '2026-12-25',
        issue_date: '2026-11-25',
        nominal_amount: 500.00
      }
    ]);

    await service.reconcileInvoicesAuto('1');
    const kpis = await service.getDdaKpis('1');

    expect(kpis.total_invoices).toBe(2);
    expect(kpis.matched_invoices).toBe(1);
    expect(kpis.unmatched_invoices).toBe(1);
    expect(kpis.reconciliation_rate_percent).toBe(50);
  });
});
