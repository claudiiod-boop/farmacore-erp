import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { BlindInventoryService } from '../../../src/modules/inventory-audit/blind-inventory.service';

describe('BlindInventoryService (Inventário Rotativo Cego & Balanço Patrimonial)', () => {
  let db: Database;
  let service: BlindInventoryService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new BlindInventoryService(db);

    // Loja e produtos base
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj) VALUES (1, 'Farma Matriz', '11.111.111/0001-11')
    `).run();

    // Produto 1: Isento / OTC (Dipirona 500mg)
    db.prepare(`
      INSERT INTO products (
        id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price
      ) VALUES (
        1, '7891000111222', 'Dipirona Monoidratada 500mg 10 comp', 'Dipirona', '1.0001.0001', 'SEM_TARJA', 'NONE', 15.0, 8.0, 10.0
      )
    `).run();

    db.prepare(`
      INSERT INTO batches (
        id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
      ) VALUES (
        1, 1, 'LOTE-DIP-01', '2026-01-01', '2027-01-01', 50, 0
      )
    `).run();

    // Produto 2: Controlado Portaria 344/98 (Diazepam 10mg)
    db.prepare(`
      INSERT INTO products (
        id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price
      ) VALUES (
        2, '7892000333444', 'Diazepam 10mg 30 comp', 'Diazepam', '1.0002.0002', 'PRETA', 'PORTARIA_344', 35.0, 20.0, 25.0
      )
    `).run();

    db.prepare(`
      INSERT INTO batches (
        id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
      ) VALUES (
        2, 2, 'LOTE-DIAZ-01', '2026-01-01', '2027-01-01', 20, 0
      )
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('1. Cria sessão de inventário e protege quantidades reais no modo contagem cega', async () => {
    const inv = await service.createInventorySession({
      store_id: 1,
      type: 'GERAL_PATRIMONIAL',
      notes: 'Balanço Mensal Novembro'
    });

    expect(inv.id).toBeDefined();
    expect(inv.code).toMatch(/^INV-202611-\d{4}$/);
    expect(inv.status).toBe('COUNTING');

    // Visão cega do conferente (operador): system_quantity deve vir ocultado/zerado
    const blindView = await service.getInventoryById(inv.id, false);
    expect(blindView?.items).toHaveLength(2);
    expect(blindView?.items?.[0].system_quantity).toBe(0);

    // Visão do gestor: system_quantity é visível para auditoria
    const managerView = await service.getInventoryById(inv.id, true);
    expect(managerView?.items?.[0].system_quantity).toBe(50);
    expect(managerView?.items?.[1].system_quantity).toBe(20);
  });

  it('2. Registra contagens cegas e apura divergências com trava sanitária em controlados', async () => {
    const inv = await service.createInventorySession({
      store_id: 1,
      type: 'GERAL_PATRIMONIAL'
    });

    // Conferente conta: Dipirona (achou 45 em vez de 50) e Diazepam (achou 18 em vez de 20)
    await service.registerItemCount({
      inventory_id: inv.id,
      product_id: 1,
      batch_id: 1,
      counted_quantity: 45
    });

    await service.registerItemCount({
      inventory_id: inv.id,
      product_id: 2,
      batch_id: 2,
      counted_quantity: 18
    });

    const reconciled = await service.reconcileDivergences(inv.id);
    expect(reconciled.status).toBe('AUDITING');
    expect(reconciled.total_divergences_count).toBe(2);

    const diazItem = reconciled.items?.find((i) => i.product_id === 2);
    expect(diazItem?.divergence_quantity).toBe(-2);
    // Divergência em controlado deve exigir aprovação do RT
    expect(diazItem?.requires_pharmacist_approval).toBe(1);
    expect(diazItem?.pharmacist_approved).toBe(0);

    const dipItem = reconciled.items?.find((i) => i.product_id === 1);
    expect(dipItem?.divergence_quantity).toBe(-5);
    expect(dipItem?.requires_pharmacist_approval).toBe(0);
  });

  it('3. Bloqueia finalização se houver divergência em controlado sem aprovação formal do RT', async () => {
    const inv = await service.createInventorySession({
      store_id: 1,
      type: 'CONTROLADOS_SNGPC'
    });

    // Diazepam (sistema tem 20, contagem achou 19)
    await service.registerItemCount({
      inventory_id: inv.id,
      product_id: 2,
      batch_id: 2,
      counted_quantity: 19
    });

    await service.reconcileDivergences(inv.id);

    // Tentativa de finalizar sem assinatura do RT deve falhar
    await expect(service.finalizeInventory(inv.id, 1)).rejects.toThrow('PENDING_CONTROLLED_APPROVAL');
  });

  it('4. Aprova divergência de controlado com CRF do Farmacêutico RT e finaliza regularizando estoque', async () => {
    const inv = await service.createInventorySession({
      store_id: 1,
      type: 'CONTROLADOS_SNGPC'
    });

    await service.registerItemCount({
      inventory_id: inv.id,
      product_id: 2,
      batch_id: 2,
      counted_quantity: 19
    });

    const reconciled = await service.reconcileDivergences(inv.id);
    const diazItem = reconciled.items?.find((i) => i.product_id === 2)!;

    // Farmacêutico RT assina com justificativa formal
    const approved = await service.approveControlledDivergence({
      item_id: diazItem.id,
      pharmacist_crf: 'CRF-SP 54.321',
      justification: 'Quebra acidental de 1 frasco de vidro no manuseio do armário de controlados (BO Sanitário interno nº 42).'
    });

    expect(approved.pharmacist_approved).toBe(1);
    expect(approved.justification).toContain('Quebra acidental');

    // Agora a finalização deve ocorrer com sucesso
    const result = await service.finalizeInventory(inv.id, 1);
    expect(result.inventory.status).toBe('FINALIZED');
    expect(result.adjustments).toHaveLength(1);
    expect(result.adjustments[0].adjustment_type).toBe('FALTA');
    expect(result.adjustments[0].quantity).toBe(1);
    expect(result.adjustments[0].dre_reason).toBe('QUEBRA');

    // Quantidade física do lote deve ter sido decrementada de 20 para 19
    const batchRow = db.prepare('SELECT quantity FROM batches WHERE id = 2').get() as any;
    expect(batchRow.quantity).toBe(19);
  });

  it('5. Retorna KPIs de acurácia de inventário', async () => {
    const inv = await service.createInventorySession({
      store_id: 1,
      type: 'GERAL_PATRIMONIAL'
    });

    await service.registerItemCount({
      inventory_id: inv.id,
      product_id: 1,
      batch_id: 1,
      counted_quantity: 50 // Exato (sem divergência)
    });

    await service.registerItemCount({
      inventory_id: inv.id,
      product_id: 2,
      batch_id: 2,
      counted_quantity: 20 // Exato (sem divergência)
    });

    await service.reconcileDivergences(inv.id);
    await service.finalizeInventory(inv.id, 1);

    const kpis = await service.getInventoryKpis(1);
    expect(kpis.total_sessions).toBe(1);
    expect(kpis.open_sessions).toBe(0);
    expect(kpis.accuracy_rate_percent).toBe(100.0);
    expect(kpis.pending_controlled_approvals).toBe(0);
  });
});
