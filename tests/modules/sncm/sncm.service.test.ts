import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { SncmService } from '../../../src/modules/sncm/sncm.service';

describe('SncmService (Rastreabilidade SNCM & DataMatrix Lei 13.410/2016)', () => {
  let db: Database;
  let service: SncmService;
  let prodId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new SncmService(db);

    const res = db.prepare(`
      INSERT INTO products (ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price)
      VALUES ('7891234567890', 'Amoxicilina 500mg 21 cápsulas', 'Amoxicilina Tri-hidratada', '1004300050011', 'VERMELHA', 'ANTIBIOTICO', 45.0, 20.0, 32.5)
    `).run();
    prodId = Number(res.lastInsertRowid);
  });

  afterEach(() => {
    db.close();
  });

  it('1. Deve realizar parse de código GS1 DataMatrix formatado com Application Identifiers (AIs)', () => {
    const raw = '(01)07891234567890(21)SER99887766(17)280531(10)LOTEX123';
    const parsed = service.parseDataMatrix(raw);

    expect(parsed.gtin).toBe('07891234567890');
    expect(parsed.serialNumber).toBe('SER99887766');
    expect(parsed.expirationDate).toBe('2028-05-31');
    expect(parsed.batchNumber).toBe('LOTEX123');
  });

  it('2. Deve registrar recebimento de carga serializada e registrar evento RECEBIMENTO', () => {
    const result = service.registerReceipt({
      storeId: 1,
      nfeAccessKey: '35261100000000000000550010000000011000000010',
      operatorName: 'Carlos Conferente',
      items: [
        {
          rawDataMatrix: '(01)07891234567890(21)SER-BOX-001(17)281231(10)L-AMOX-99',
        },
        {
          rawDataMatrix: '(01)07891234567890(21)SER-BOX-002(17)281231(10)L-AMOX-99',
        },
      ],
    });

    expect(result.registeredCount).toBe(2);
    expect(result.items[0].serial_number).toBe('SER-BOX-001');
    expect(result.items[0].status).toBe('IN_STOCK');

    const itemQuery = service.queryItem('SER-BOX-001');
    expect(itemQuery).not.toBeNull();
    expect(itemQuery?.events.length).toBe(1);
    expect(itemQuery?.events[0].event_type).toBe('RECEBIMENTO');
  });

  it('3. Deve dispensar unidade no PDV com sucesso e atualizar status para DISPENSED', () => {
    service.registerReceipt({
      items: [
        {
          gtin: '07891234567890',
          serialNumber: 'SER-BOX-DISP-01',
          expirationDate: '2028-01-01',
          batchNumber: 'L-01',
        },
      ],
    });

    const disp = service.dispenseItem({
      storeId: 1,
      serialNumber: 'SER-BOX-DISP-01',
      fiscalDocNumber: 'NFCe-998877',
      operatorName: 'Balconista João',
    });

    expect(disp.item.status).toBe('DISPENSED');
    expect(disp.event.event_type).toBe('DISPENSACAO');
    expect(disp.event.fiscal_doc_number).toBe('NFCe-998877');

    const queried = service.queryItem('SER-BOX-DISP-01');
    expect(queried?.status).toBe('DISPENSED');
    expect(queried?.events.length).toBe(2); // RECEBIMENTO + DISPENSACAO
  });

  it('4. Deve bloquear dispensação de item já dispensado (anti-duplicidade sanitária)', () => {
    service.registerReceipt({
      items: [
        {
          gtin: '07891234567890',
          serialNumber: 'SER-DUPLICADO',
          expirationDate: '2028-01-01',
          batchNumber: 'L-01',
        },
      ],
    });

    service.dispenseItem({ serialNumber: 'SER-DUPLICADO' });

    expect(() => {
      service.dispenseItem({ serialNumber: 'SER-DUPLICADO' });
    }).toThrowError(/ITEM_ALREADY_DISPENSED/);
  });

  it('5. Deve bloquear dispensação de item VENCIDO com erro ITEM_EXPIRED_BLOCK', () => {
    service.registerReceipt({
      items: [
        {
          gtin: '07891234567890',
          serialNumber: 'SER-VENCIDO',
          expirationDate: '2020-01-01', // Data passada
          batchNumber: 'L-OLD',
        },
      ],
    });

    expect(() => {
      service.dispenseItem({ serialNumber: 'SER-VENCIDO' });
    }).toThrowError(/ITEM_EXPIRED_BLOCK/);
  });

  it('6. Deve reter item em quarentena e bloquear sua dispensação', () => {
    service.registerReceipt({
      items: [
        {
          gtin: '07891234567890',
          serialNumber: 'SER-SUSPEITO',
          expirationDate: '2028-01-01',
          batchNumber: 'L-01',
        },
      ],
    });

    service.quarantineItem('SER-SUSPEITO', 'Embalagem violada ou suspeita de desvio', undefined, 'Dra. Camila');

    const queried = service.queryItem('SER-SUSPEITO');
    expect(queried?.status).toBe('QUARANTINE');

    expect(() => {
      service.dispenseItem({ serialNumber: 'SER-SUSPEITO' });
    }).toThrowError(/ITEM_IN_QUARANTINE/);
  });

  it('7. Deve transmitir eventos pendentes ao webservice ANVISA e atualizar KPIs', () => {
    service.registerReceipt({
      items: [
        {
          gtin: '07891234567890',
          serialNumber: 'SER-TRANSMIT-01',
          expirationDate: '2028-01-01',
          batchNumber: 'L-01',
        },
      ],
    });

    const kpisInitial = service.getSncmKpis(1);
    expect(kpisInitial.total_in_stock).toBe(1);
    expect(kpisInitial.pending_transmission).toBe(1);

    const tx = service.transmitEvents(1);
    expect(tx.transmittedCount).toBe(1);
    expect(tx.protocol).toContain('SNCM-BR-2026-');

    const kpisAfter = service.getSncmKpis(1);
    expect(kpisAfter.pending_transmission).toBe(0);
  });
});
