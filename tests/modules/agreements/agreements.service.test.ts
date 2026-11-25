import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CorporateAgreementService } from '../../../src/modules/agreements/agreements.service';

describe('CorporateAgreementService (Faturamento de Convênio & Desconto em Folha)', () => {
  let db: Database;
  let service: CorporateAgreementService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new CorporateAgreementService(db);

    // 0. Loja Matriz
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj) VALUES (1, 'Matriz Farma', '11.111.111/0001-11')
    `).run();

    // 1. Cadastrar empresa conveniada
    db.prepare(`
      INSERT INTO corporate_agreements (
        id, code, company_name, trade_name, cnpj, street, number, neighborhood, city, state, zip_code, closing_day, due_day, credit_limit, is_active
      ) VALUES (
        1, 'CONV-IND-01', 'Indústria Metalúrgica Paulista LTDA', 'MetalPaulista', '12.345.678/0001-99',
        'Av. Industrial', '500', 'Distrito', 'São Paulo', 'SP', '01000-000', 20, 5, 50000.0, 1
      )
    `).run();

    // 2. Cadastrar colaboradores conveniados
    db.prepare(`
      INSERT INTO customers (
        id, store_id, name, cpf, agreement_id, registration_number, credit_limit, current_debt, status
      ) VALUES
        (1, 1, 'Carlos Eduardo Souza', '111.222.333-44', 1, 'MATR-1001', 500.0, 0.0, 'ACTIVE'),
        (2, 1, 'Fernanda Lima Rocha', '222.333.444-55', 1, 'MATR-1002', 800.0, 0.0, 'ACTIVE')
    `).run();

    // 3. Cadastrar vendas e contas a receber a convênio no período
    db.prepare(`
      INSERT INTO sales (
        id, total_amount, created_at
      ) VALUES
        (1, 150.0, '2026-11-10 14:30:00'),
        (2, 80.0, '2026-11-15 10:15:00'),
        (3, 220.0, '2026-11-18 16:45:00')
    `).run();

    db.prepare(`
      INSERT INTO customer_receivables (
        id, customer_id, sale_id, agreement_id, installment_number, total_installments, due_date, original_amount, paid_amount, status, created_at
      ) VALUES
        (1, 1, 1, 1, 1, 1, '2026-12-05', 150.0, 0.0, 'OPEN', '2026-11-10 14:30:00'),
        (2, 1, 2, 1, 1, 1, '2026-12-05', 80.0, 0.0, 'OPEN', '2026-11-15 10:15:00'),
        (3, 2, 3, 1, 1, 1, '2026-12-05', 220.0, 0.0, 'OPEN', '2026-11-18 16:45:00')
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('1. Gera fatura consolidada de convênio com itens e número sequencial', async () => {
    const invoice = await service.generateInvoiceForAgreement(1, '2026-11-01', '2026-11-20', '2026-12-05');

    expect(invoice.id).toBeDefined();
    expect(invoice.invoice_number).toMatch(/^FAT-202611-\d{4}$/);
    expect(invoice.total_amount).toBe(450.0); // 150 + 80 + 220
    expect(invoice.total_sales_count).toBe(3);
    expect(invoice.total_employees_count).toBe(2);
    expect(invoice.status).toBe('OPEN');
    expect(invoice.items).toHaveLength(3);
  });

  it('2. Fatura em lote múltiplos convênios ativos', async () => {
    // Cadastrar segunda empresa sem vendas
    db.prepare(`
      INSERT INTO corporate_agreements (
        id, code, company_name, trade_name, cnpj, street, number, neighborhood, city, state, zip_code, closing_day, due_day, is_active
      ) VALUES (
        2, 'CONV-COM-02', 'Prefeitura Municipal', 'Prefeitura', '33.444.555/0001-66',
        'Praça Central', '1', 'Centro', 'São Paulo', 'SP', '01000-000', 25, 10, 1
      )
    `).run();

    const batch = await service.generateBatchBilling('2026-11-01', '2026-11-20', '2026-12-05');

    expect(batch).toHaveLength(1);
    expect(batch[0].agreement_id).toBe(1);
  });

  it('3. Exporta arquivo CSV de desconto em folha para o RH da empresa parceira', async () => {
    const invoice = await service.generateInvoiceForAgreement(1, '2026-11-01', '2026-11-20', '2026-12-05');
    const exported = await service.exportPayrollDiscountFile(invoice.id);

    expect(exported.totalEmployees).toBe(2);
    expect(exported.totalAmount).toBe(450.0);
    expect(exported.csvContent).toContain('MATRICULA;CPF;NOME_COLABORADOR;QTD_COMPRAS;VALOR_DESCONTO_FOLHA');
    expect(exported.csvContent).toContain('MATR-1001;111.222.333-44;Carlos Eduardo Souza;2;230,00');
    expect(exported.csvContent).toContain('MATR-1002;222.333.444-55;Fernanda Lima Rocha;1;220,00');
  });

  it('4. Quita fatura corporativa com registro de pagamento', async () => {
    const invoice = await service.generateInvoiceForAgreement(1, '2026-11-01', '2026-11-20', '2026-12-05');
    const settled = await service.settleAgreementInvoice(invoice.id, '2026-12-04', 'Pago via TED Corporativa');

    expect(settled.status).toBe('PAID');
    expect(settled.paid_at).toBe('2026-12-04');
    expect(settled.notes).toBe('Pago via TED Corporativa');
  });

  it('5. Valida elegibilidade do colaborador com checagem de limite e trava de inadimplência', async () => {
    // Colaborador 1 tem limite 500.0 e dívida 0
    const checkOk = await service.checkCustomerAgreementEligibility(1, 200.0);
    expect(checkOk.eligible).toBe(true);
    expect(checkOk.agreementName).toBe('Indústria Metalúrgica Paulista LTDA');
    expect(checkOk.remainingCreditLimit).toBe(500.0);

    // Tentativa acima do limite (550.0)
    const checkExceeded = await service.checkCustomerAgreementEligibility(1, 550.0);
    expect(checkExceeded.eligible).toBe(false);
    expect(checkExceeded.reason).toBe('LIMITE_CREDITO_EXCEDIDO');

    // Inadimplência da empresa: insere fatura vencida há mais de 15 dias
    db.prepare(`
      INSERT INTO agreement_invoices (
        id, invoice_number, agreement_id, period_start, period_end, due_date, total_amount, status
      ) VALUES (
        99, 'FAT-OLD-0001', 1, '2026-09-01', '2026-09-20', '2026-10-05', 1200.0, 'OPEN'
      )
    `).run();

    const checkBlocked = await service.checkCustomerAgreementEligibility(1, 50.0);
    expect(checkBlocked.eligible).toBe(false);
    expect(checkBlocked.reason).toBe('EMPRESA_CONVENIADA_INADIMPLENTE');
  });

  it('6. Calcula KPIs de convênios empresariais', async () => {
    await service.generateInvoiceForAgreement(1, '2026-11-01', '2026-11-20', '2026-12-05');
    const kpis = await service.getAgreementKpis();

    expect(kpis.total_agreements_active).toBe(1);
    expect(kpis.open_invoices_count).toBe(1);
    expect(kpis.total_open_amount).toBe(450.0);
    expect(kpis.active_employees_count).toBe(2);
  });
});
