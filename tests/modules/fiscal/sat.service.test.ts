import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { SatFiscalService } from '../../../src/modules/fiscal/sat.service';

describe('SatFiscalService (Emissor CF-e-SAT & Contingência Off-line)', () => {
  let db: Database;
  let service: SatFiscalService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new SatFiscalService(db);

    // Loja SP
    db.prepare(`
      INSERT OR IGNORE INTO stores (
        id, name, cnpj, ie, street, number, neighborhood, city, state, zip_code
      ) VALUES (
        1, 'Drogarias FarmaCore SP', '12.345.678/0001-99', '123.456.789.111',
        'Av. Paulista', '1500', 'Bela Vista', 'São Paulo', 'SP', '01310-100'
      )
    `).run();

    // Produtos
    db.prepare(`
      INSERT INTO products (
        id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price
      ) VALUES (
        1, '7891111222333', 'Paracetamol 750mg 20 comp', 'Paracetamol', '1.0001.0001', 'SEM_TARJA', 'NONE', 20.0, 10.0, 15.0
      )
    `).run();

    db.prepare(`
      INSERT INTO batches (
        id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
      ) VALUES (
        1, 1, 'LOTE-PAR-01', '2026-01-01', '2027-01-01', 100, 0
      )
    `).run();

    // Venda PDV
    db.prepare(`
      INSERT INTO sales (
        id, total_amount, discount_amount, created_at
      ) VALUES (
        1, 30.0, 0.0, '2026-11-25 10:00:00'
      )
    `).run();

    db.prepare(`
      INSERT INTO sale_items (
        id, sale_id, product_id, batch_id, quantity, unit_price, total_price
      ) VALUES (
        1, 1, 1, 1, 2, 15.0, 30.0
      )
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('1. Cadastra e vincula dispositivo SAT ao caixa', async () => {
    const dev = await service.registerSatDevice({
      store_id: 1,
      pos_station_id: 'CAIXA_01',
      serial_number: '900001234',
      model: 'BEMATECH_RB2000',
      sign_code: 'SIGNAUTH12345'
    });

    expect(dev.id).toBeDefined();
    expect(dev.serial_number).toBe('900001234');
    expect(dev.status).toBe('ACTIVE');

    // Tentar vincular o mesmo serial em outro caixa deve falhar
    await expect(
      service.registerSatDevice({
        store_id: 1,
        pos_station_id: 'CAIXA_02',
        serial_number: '900001234',
        sign_code: 'OUTRO_CODIGO'
      })
    ).rejects.toThrow('SERIAL_NUMBER_ALREADY_LINKED');
  });

  it('2. Consulta status operacional do aparelho SAT via driver', async () => {
    const dev = await service.registerSatDevice({
      store_id: 1,
      pos_station_id: 'CAIXA_01',
      serial_number: '900001234',
      sign_code: 'SIGNAUTH12345'
    });

    const status = await service.checkSatStatus(dev.id);
    expect(status.status).toBe('OPERACIONAL');
    expect(status.serial_number).toBe('900001234');
    expect(status.sefaz_transmission_status).toBe('CONECTADO');
  });

  it('3. Emite Cupom Fiscal Eletrônico CF-e-SAT com chave de 44 dígitos e QR Code', async () => {
    const dev = await service.registerSatDevice({
      store_id: 1,
      pos_station_id: 'CAIXA_01',
      serial_number: '900001234',
      sign_code: 'SIGNAUTH12345'
    });

    const cfe = await service.issueCfeSat({
      sale_id: 1,
      sat_device_id: dev.id,
      customer_cpf: '123.456.789-00'
    });

    expect(cfe.id).toBeDefined();
    expect(cfe.access_key).toHaveLength(44);
    expect(cfe.access_key.startsWith('35')).toBe(true); // SP
    expect(cfe.cfe_number).toBe(1);
    expect(cfe.status).toBe('AUTHORIZED');
    expect(cfe.qr_code_payload).toContain(cfe.access_key);
    expect(cfe.qr_code_payload).toContain('12345678900');

    // Tentativa de reemitir CF-e para a mesma venda deve ser bloqueada
    await expect(
      service.issueCfeSat({
        sale_id: 1,
        sat_device_id: dev.id
      })
    ).rejects.toThrow('CFE_ALREADY_ISSUED');
  });

  it('4. Emite em contingência off-line e sincroniza lote pendente à SEFAZ', async () => {
    const dev = await service.registerSatDevice({
      store_id: 1,
      pos_station_id: 'CAIXA_01',
      serial_number: '900001234',
      sign_code: 'SIGNAUTH12345'
    });

    // Emissão forçando contingência off-line
    const cfe = await service.issueCfeSat({
      sale_id: 1,
      sat_device_id: dev.id,
      force_offline_contingency: true
    });

    expect(cfe.status).toBe('SYNC_PENDING');
    expect(cfe.sefaz_status_code).toBe('06001');

    // Fila deve conter 1 registro pendente
    const kpis = await service.getSatKpis(1);
    expect(kpis.pending_contingency_count).toBe(1);

    // Sincroniza lote
    const syncRes = await service.syncContingencyBatch(dev.id);
    expect(syncRes.transmitted_count).toBe(1);

    // Documento agora deve estar AUTHORIZED
    const updated = db.prepare('SELECT status, sefaz_status_code FROM cfe_sat_documents WHERE id = ?').get(cfe.id) as any;
    expect(updated.status).toBe('AUTHORIZED');
    expect(updated.sefaz_status_code).toBe('06000');
  });

  it('5. Cancela CF-e no prazo de 30 minutos e bloqueia cancelamento fora do prazo', async () => {
    const dev = await service.registerSatDevice({
      store_id: 1,
      pos_station_id: 'CAIXA_01',
      serial_number: '900001234',
      sign_code: 'SIGNAUTH12345'
    });

    const cfe = await service.issueCfeSat({
      sale_id: 1,
      sat_device_id: dev.id
    });

    const cancelled = await service.cancelLastCfe(cfe.id, 'Cliente desistiu da compra no caixa');
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.sefaz_status_code).toBe('07000');
    expect(cancelled.cancel_xml).toContain('Cliente desistiu');

    // Simula venda antiga emitida há mais de 31 minutos
    db.prepare(`
      INSERT INTO sales (id, total_amount, created_at) VALUES (2, 50.0, '2026-11-25 08:00:00')
    `).run();
    db.prepare(`
      INSERT INTO cfe_sat_documents (
        id, sale_id, store_id, sat_device_id, access_key, cfe_number,
        session_random_number, total_amount, net_amount, xml_sent, xml_signed,
        qr_code_payload, status, issued_at
      ) VALUES (
        99, 2, 1, ?, '35261111111111000111599000012340000991234567', 99,
        123456, 50.0, 50.0, '<xml/>', '<xml/>', 'qr', 'AUTHORIZED', '2026-11-25 08:00:00'
      )
    `).run(dev.id);

    await expect(service.cancelLastCfe(99, 'Tentativa fora do prazo')).rejects.toThrow('CANCELLATION_DEADLINE_EXCEEDED');
  });

  it('6. Gera Extrato Térmico 80mm com dados fiscais e QR Code', async () => {
    const dev = await service.registerSatDevice({
      store_id: 1,
      pos_station_id: 'CAIXA_01',
      serial_number: '900001234',
      sign_code: 'SIGNAUTH12345'
    });

    const cfe = await service.issueCfeSat({
      sale_id: 1,
      sat_device_id: dev.id
    });

    const extrato = await service.getExtratoThermalLayout(cfe.id);
    expect(extrato).toContain('CUPOM FISCAL ELETRONICO - SAT');
    expect(extrato).toContain('CNPJ:');
    expect(extrato).toContain('Paracetamol 750mg');
    expect(extrato).toContain('TOTAL LIQUIDO R$');
    expect(extrato).toContain(cfe.access_key.slice(0, 4));
    expect(extrato).toContain('[QR CODE SEFAZ CONSULTA PUBLICA]');
  });
});
