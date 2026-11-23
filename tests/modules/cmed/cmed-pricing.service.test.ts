import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CmedPricingService } from '../../../src/modules/cmed/cmed-pricing.service';

describe('CmedPricingService (Trava Regulatória Sanitária de Preço Máximo e Auditoria)', () => {
  let db: Database;
  let service: CmedPricingService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new CmedPricingService(db);

    // Cria versão e insere produtos na CMED
    db.prepare(`
      INSERT INTO cmed_table_versions (id, version_code, release_date, is_active)
      VALUES (1, 'CMED-2026-11', '2026-11-01', 1)
    `).run();

    db.prepare(`
      INSERT INTO cmed_products (
        version_id, ean, ms_registration, product_name, substance_name, laboratory_name,
        product_type, list_type, pf_18, pmc_18, pf_20, pmc_20
      ) VALUES 
        (1, '7891234567890', '1000000000001', 'Amoxicilina 500mg 21 caps', 'Amoxicilina', 'EMS S/A', 'GENERICO', 'NEGATIVA', 20.0, 32.00, 21.0, 33.50),
        (1, '7899876543210', '1000000000002', 'Dipirona 500mg Gotas', 'Dipirona', 'Medley', 'GENERICO', 'POSITIVA', 6.0, 10.00, 6.5, 10.50)
    `).run();

    // Insere produtos na loja (um em conformidade e outro acima do teto PMC!)
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES 
        (1, '7891234567890', 'Amoxicilina 500mg 21 caps', 'Amoxicilina', '1000000000001', 'VERMELHA', 'ANTIMICROBIANO', 32.0, 20.0, 35.00), -- ACIMA DO PMC (35 > 32)!
        (2, '7899876543210', 'Dipirona 500mg Gotas', 'Dipirona', '1000000000002', 'SEM_TARJA', 'ISENTO', 10.0, 6.0, 8.50) -- OK (8.50 <= 10.00)
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('should validate PMC cap blocking sales with prices exceeding CMED maximum', () => {
    // Tentativa de vender Amoxicilina a R$ 35,00 em SP (ICMS 18%, PMC = R$ 32,00)
    const invalidResult = service.validatePmcCap('7891234567890', 35.00, 18.0);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.maxAllowedPmc).toBe(32.00);
    expect(invalidResult.infractionWarning).toContain('Infração Sanitária e Legal (Lei 10.742/2003)');

    // Venda a R$ 30,00 (dentro do limite de R$ 32,00)
    const validResult = service.validatePmcCap('7891234567890', 30.00, 18.0);
    expect(validResult.isValid).toBe(true);
    expect(validResult.maxAllowedPmc).toBe(32.00);
  });

  it('should run store pricing audit identifying products above PMC and calculating correct margin', () => {
    const report = service.runPricingAudit(1, 18.0);

    expect(report.totalProductsAudited).toBe(2);
    expect(report.nonCompliantAbovePmcCount).toBe(1);

    const amoxAudit = report.items.find(i => i.productId === 1);
    expect(amoxAudit).toBeDefined();
    expect(amoxAudit?.status).toBe('ABOVE_PMC');
    expect(amoxAudit?.currentSalePrice).toBe(35.00);
    expect(amoxAudit?.pmcAllowed).toBe(32.00);
    expect(amoxAudit?.priceExcessAmount).toBe(3.00);

    const dipAudit = report.items.find(i => i.productId === 2);
    expect(dipAudit).toBeDefined();
    expect(dipAudit?.status).toBe('COMPLIANT');
  });

  it('should apply batch price updates adjusting prices to compliant limits and logging audit trail', () => {
    const updates = [
      { productId: 1, newPrice: 28.50, reason: 'Ajuste regulatório teto CMED' }
    ];

    service.applyBatchPriceUpdates(1, updates, 'FARMACEUTICO_RESP');

    const updatedProd = db.prepare<any>('SELECT price FROM products WHERE id = 1').get();
    expect(updatedProd.price).toBe(28.50);

    const log = db.prepare<any>('SELECT * FROM cmed_price_audit_logs WHERE product_id = 1').get();
    expect(log).toBeDefined();
    expect(log.old_price).toBe(35.00);
    expect(log.new_price).toBe(28.50);
    expect(log.auditor_user).toBe('FARMACEUTICO_RESP');
  });
});
