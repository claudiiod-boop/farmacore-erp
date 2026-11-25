import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { ScaleWeighingService } from '../../../src/modules/scales/scale.service';

describe('ScaleWeighingService (Balanças de Precisão & Código de Barras Pesável)', () => {
  let db: Database;
  let service: ScaleWeighingService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new ScaleWeighingService(db);

    // Loja
    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj) VALUES (1, 'Farma Matriz Central', '11.111.111/0001-11')
    `).run();

    // Produto pesável: Castanha do Pará / Chá a Granel (R$ 80,00 por kg)
    db.prepare(`
      INSERT INTO products (
        id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price
      ) VALUES (
        42, '7890000000042', 'Chá de Camomila Granel 1kg', 'Camomila', 'ISENTO', 'SEM_TARJA', 'NONE', 100.0, 50.0, 80.0
      )
    `).run();

    db.prepare(`
      INSERT INTO batches (
        id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
      ) VALUES (
        1, 42, 'LOTE-CHA-01', '2026-01-01', '2027-01-01', 50, 0
      )
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('1. Cadastra balança de precisão homologada pelo INMETRO', async () => {
    const scale = await service.registerScaleDevice({
      store_id: 1,
      name: 'Toledo Prix 3 Fit - Balcão 1',
      serial_port: 'COM1',
      baud_rate: 9600,
      protocol: 'TOLEDO_PR4',
      inmetro_seal_number: 'INM-SP-2026-00441',
      capacity_kg: 15.0,
      precision_grams: 5.0
    });

    expect(scale.id).toBeDefined();
    expect(scale.name).toBe('Toledo Prix 3 Fit - Balcão 1');
    expect(scale.protocol).toBe('TOLEDO_PR4');
    expect(scale.is_active).toBe(1);
  });

  it('2. Lê peso de balança serial aplicando desconto de tara e estabilidade metrológica', async () => {
    const scale = await service.registerScaleDevice({
      store_id: 1,
      name: 'Toledo Prix 3 Fit',
      serial_port: 'COM1',
      inmetro_seal_number: 'INM-001'
    });

    const reading = await service.readWeightFromScale(scale.id, 520.0, 20.0);
    expect(reading.gross_weight_grams).toBe(520.0);
    expect(reading.tare_grams).toBe(20.0);
    expect(reading.net_weight_grams).toBe(500.0);
    expect(reading.is_stable).toBe(true);
  });

  it('3. Decodifica código de barras EAN-13 pesável (padrão 2XXXXX) e calcula quantidade vendida', async () => {
    // Produto ID 42 (Preço R$ 80,00/kg)
    // Código: 2 + 0042 (prod) + 001600 (R$ 16,00) + DV
    // R$ 16,00 / R$ 80,00/kg = 0.200 kg (200g)
    const label = await service.generateWeighingLabel({
      product_id: 42,
      gross_weight_grams: 215.0,
      tare_grams: 15.0, // Líquido = 200g -> 0.200 * 80.0 = R$ 16.00
      operator_name: 'Farmacêutico RT'
    });

    expect(label.barcode).toHaveLength(13);
    expect(label.barcode.startsWith('200042')).toBe(true);
    expect(label.total_price).toBe(16.00);

    const decoded = await service.decodeWeightedBarcode({ barcode: label.barcode, store_id: 1 });
    expect(decoded.is_weighted).toBe(true);
    expect(decoded.product_id).toBe(42);
    expect(decoded.total_price).toBe(16.00);
    expect(decoded.calculated_quantity).toBe(0.2); // 200g em kg
    expect(decoded.net_weight_grams).toBe(200);
  });

  it('4. Retorna is_weighted: false para códigos de barras industriais normais', async () => {
    const decoded = await service.decodeWeightedBarcode({ barcode: '7891234567890', store_id: 1 });
    expect(decoded.is_weighted).toBe(false);
    expect(decoded.product_id).toBe(0);
  });

  it('5. Emite etiqueta térmica ZPL para impressora de balança com lote e validade', async () => {
    const label = await service.generateWeighingLabel({
      product_id: 42,
      batch_id: 1,
      gross_weight_grams: 520.0,
      tare_grams: 20.0
    });

    expect(label.thermal_label_zpl).toContain('Chá de Camomila Granel');
    expect(label.thermal_label_zpl).toContain('Peso Liq: 0.500kg');
    expect(label.thermal_label_zpl).toContain('TOTAL R$: 40.00');
    expect(label.expiration_date).toBe('2027-01-01');
  });

  it('6. Retorna KPIs operacionais de balanças e pesagens', async () => {
    await service.registerScaleDevice({
      store_id: 1,
      name: 'Balança Checkout',
      serial_port: 'COM1',
      inmetro_seal_number: 'INM-001'
    });

    await service.generateWeighingLabel({
      product_id: 42,
      gross_weight_grams: 500.0,
      tare_grams: 0.0
    });

    const kpis = await service.getScaleKpis(1);
    expect(kpis.total_scales).toBe(1);
    expect(kpis.active_scales).toBe(1);
    expect(kpis.total_weighings_today).toBe(1);
    expect(kpis.total_weight_kg_today).toBe(0.5);
    expect(kpis.total_weighted_sales_amount_today).toBe(40.0);
  });
});
