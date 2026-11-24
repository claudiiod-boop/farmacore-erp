import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Rastreabilidade SNCM & DataMatrix (Fase 30)', () => {
  let app: FastifyInstance;
  let db: Database;
  let storeId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    // Criar produto de teste
    db.prepare(`
      INSERT INTO products (name, ean, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, category)
      VALUES ('Azitromicina 500mg 3 comp', '7891234999888', 'Azitromicina', '1004300099', 'VERMELHA', 'ANTIBIOTICO', 35.0, 15.0, 25.0, 'GENERICO')
    `).run();

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. POST /api/sncm/parse-datamatrix deve decodificar código GS1 DataMatrix', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sncm/parse-datamatrix',
      payload: {
        raw: '(01)07891234999888(21)SER-AZIT-001(17)280630(10)L-AZIT-99',
      },
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.gtin).toBe('07891234999888');
    expect(data.serialNumber).toBe('SER-AZIT-001');
    expect(data.expirationDate).toBe('2028-06-30');
    expect(data.batchNumber).toBe('L-AZIT-99');
  });

  it('2. POST /api/sncm/receipt, GET /api/sncm/items e POST /api/sncm/dispense', async () => {
    // 1. Receber carga serializada
    const receiptRes = await app.inject({
      method: 'POST',
      url: '/api/sncm/receipt',
      payload: {
        storeId,
        nfeAccessKey: '35261100000000000000550010000000011000000010',
        items: [
          {
            gtin: '07891234999888',
            serialNumber: 'SER-AZIT-002',
            expirationDate: '2028-06-30',
            batchNumber: 'L-AZIT-99',
          },
        ],
      },
    });

    expect(receiptRes.statusCode).toBe(201);
    const receiptData = JSON.parse(receiptRes.body);
    expect(receiptData.registeredCount).toBe(1);

    // 2. Listar itens
    const itemsRes = await app.inject({
      method: 'GET',
      url: `/api/sncm/items?storeId=${storeId}&status=IN_STOCK`,
    });
    expect(itemsRes.statusCode).toBe(200);
    const items = JSON.parse(itemsRes.body);
    expect(items.length).toBeGreaterThanOrEqual(1);

    // 3. Dispensar no PDV
    const dispRes = await app.inject({
      method: 'POST',
      url: '/api/sncm/dispense',
      payload: {
        storeId,
        serialNumber: 'SER-AZIT-002',
        fiscalDocNumber: 'NFC-e 12345',
      },
    });
    expect(dispRes.statusCode).toBe(200);
    const dispData = JSON.parse(dispRes.body);
    expect(dispData.item.status).toBe('DISPENSED');

    // 4. Consultar histórico por serial
    const queryRes = await app.inject({
      method: 'GET',
      url: '/api/sncm/items/SER-AZIT-002',
    });
    expect(queryRes.statusCode).toBe(200);
    const queried = JSON.parse(queryRes.body);
    expect(queried.status).toBe('DISPENSED');
    expect(queried.events.length).toBe(2);
  });

  it('3. POST /api/sncm/items/:serial/quarantine, POST /api/sncm/transmit e GET /api/sncm/kpis', async () => {
    // 1. Cadastrar item
    await app.inject({
      method: 'POST',
      url: '/api/sncm/receipt',
      payload: {
        storeId,
        items: [
          {
            gtin: '07891234999888',
            serialNumber: 'SER-QUARANTINE-01',
            expirationDate: '2028-06-30',
            batchNumber: 'L-AZIT-99',
          },
        ],
      },
    });

    // 2. Colocar em quarentena
    const quarRes = await app.inject({
      method: 'POST',
      url: '/api/sncm/items/SER-QUARANTINE-01/quarantine',
      payload: {
        reason: 'Lacre rompido no transporte',
      },
    });
    expect(quarRes.statusCode).toBe(200);
    const quarData = JSON.parse(quarRes.body);
    expect(quarData.status).toBe('QUARANTINE');

    // 3. Transmitir eventos
    const txRes = await app.inject({
      method: 'POST',
      url: '/api/sncm/transmit',
      payload: { storeId },
    });
    expect(txRes.statusCode).toBe(200);
    const txData = JSON.parse(txRes.body);
    expect(txData.transmittedCount).toBeGreaterThanOrEqual(1);

    // 4. KPIs
    const kpiRes = await app.inject({
      method: 'GET',
      url: `/api/sncm/kpis?storeId=${storeId}`,
    });
    expect(kpiRes.statusCode).toBe(200);
    const kpis = JSON.parse(kpiRes.body);
    expect(kpis.quarantined_items).toBeGreaterThanOrEqual(1);
    expect(kpis.pending_transmission).toBe(0);
  });
});
