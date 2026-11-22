import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { SpedAuditService } from '../../../src/modules/fiscal/sped-audit.service';

describe('SpedAuditService (Auditoria Pré-Validação PVA SPED & Sintegra)', () => {
  let db: Database;
  let service: SpedAuditService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new SpedAuditService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should detect missing accounting parameters as an ERROR', () => {
    const res = service.auditStoreFiscalData(1);
    expect(res.isValid).toBe(false);
    expect(res.totalErrors).toBeGreaterThan(0);
    expect(res.divergences.some(d => d.entityType === 'ACCOUNTING')).toBe(true);
  });

  it('should detect invalid NCM, missing CEST and zero-cost inventory items', () => {
    // Cadastrar contador válido
    db.prepare(`
      INSERT INTO accounting_parameters (
        store_id, accountant_name, accountant_cpf, accountant_crc, sped_profile, sped_version
      ) VALUES (1, 'Contador Silva', '12345678901', 'CRC-SP 123456/O', 'A', '018')
    `).run();

    // Inserir produto com NCM com 4 dígitos (inválido) e sem CEST
    db.prepare(`
      INSERT INTO products (
        id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, ncm, cest, cfop, csosn_icms, cst_pis, cst_cofins
      ) VALUES 
        (1, '7890001', 'Produto Invalido NCM', 'Substancia', '1001', 'SEM_TARJA', 'LIBERADO', 10.00, 5.00, 10.00, '3004', '', '5405', '500', '04', '04'),
        (2, '7890002', 'Produto Estoque Sem Custo', 'Substancia', '1002', 'SEM_TARJA', 'LIBERADO', 20.00, 0.00, 0.00, '30049099', '1300100', '5405', '500', '04', '04')
    `).run();

    // Lote para o produto 2 com custo 0
    db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (2, 'LOTE-ZERO', '2025-01-01', '2028-12-31', 40, 1)
    `).run();

    const res = service.auditStoreFiscalData(1);

    expect(res.isValid).toBe(false);
    expect(res.divergences.some(d => d.entityType === 'PRODUCT' && d.fieldName === 'ncm')).toBe(true);
    expect(res.divergences.some(d => d.entityType === 'PRODUCT' && d.fieldName === 'cest')).toBe(true);
    expect(res.divergences.some(d => d.entityType === 'INVENTORY' && d.fieldName === 'unit_cost')).toBe(true);
  });

  it('should return isValid true when all fiscal records and inventory are consistent', () => {
    // Contador válido
    db.prepare(`
      INSERT INTO accounting_parameters (
        store_id, accountant_name, accountant_cpf, accountant_crc, sped_profile, sped_version
      ) VALUES (1, 'Contador Silva', '12345678901', 'CRC-SP 123456/O', 'A', '018')
    `).run();

    // Produto 100% regular
    db.prepare(`
      INSERT INTO products (
        id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, ncm, cest, cfop, csosn_icms, cst_pis, cst_cofins
      ) VALUES 
        (1, '7891234567890', 'Dipirona 500mg 10 comp', 'Dipirona', '1001', 'SEM_TARJA', 'LIBERADO', 12.00, 6.00, 10.00, '30049099', '1300100', '5405', '500', '04', '04')
    `).run();

    db.prepare(`
      INSERT INTO batches (product_id, batch_number, manufacturing_date, expiration_date, quantity, store_id)
      VALUES (1, 'LOTE-DIP-01', '2025-01-01', '2028-12-31', 100, 1)
    `).run();

    const res = service.auditStoreFiscalData(1);
    expect(res.isValid).toBe(true);
    expect(res.totalErrors).toBe(0);
  });
});
