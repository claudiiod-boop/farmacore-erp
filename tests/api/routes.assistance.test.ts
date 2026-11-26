import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerPharmaceuticalAssistanceRoutes } from '../../src/modules/clinical/pharmaceutical-assistance.routes';

describe('Pharmaceutical Assistance Routes Integration (/api/assistance)', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT OR IGNORE INTO stores (id, name, cnpj)
      VALUES (1, 'FarmaCore Matriz Centro', '11.222.333/0001-44')
    `).run();

    app = Fastify();
    registerPharmaceuticalAssistanceRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    if (app) await app.close();
    if (db) db.close();
  });

  it('POST & GET /api/assistance/staff should register and list staff', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/assistance/staff',
      payload: {
        store_id: 1,
        name: 'Dra. Gabriela Souza',
        cpf: '123.456.789-99',
        crf_number: '54321',
        crf_uf: 'SP',
        role: 'RT_TITULAR',
        crt_certificate_number: 'CRT-SP-2026-101',
        crt_validity_date: '2026-12-31',
      },
    });

    expect(postRes.statusCode).toBe(201);
    const body = JSON.parse(postRes.payload);
    expect(body.name).toBe('Dra. Gabriela Souza');
    expect(body.role).toBe('RT_TITULAR');

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/assistance/staff?store_id=1',
    });
    expect(getRes.statusCode).toBe(200);
    const staffList = JSON.parse(getRes.payload);
    expect(staffList.length).toBe(1);
    expect(staffList[0].cpf).toBe('123.456.789-99');
  });

  it('POST & GET /api/assistance/shifts should manage weekly schedule', async () => {
    const staffRes = await app.inject({
      method: 'POST',
      url: '/api/assistance/staff',
      payload: {
        store_id: 1,
        name: 'Dr. Lucas Farmacêutico',
        cpf: '333.222.111-00',
        crf_number: '88776',
        crf_uf: 'SP',
        role: 'RT_TITULAR',
      },
    });
    const staff = JSON.parse(staffRes.payload);

    const shiftRes = await app.inject({
      method: 'POST',
      url: '/api/assistance/shifts',
      payload: {
        store_id: 1,
        staff_id: staff.id,
        shifts: [
          { day_of_week: 1, start_time: '08:00', end_time: '17:00' },
          { day_of_week: 2, start_time: '08:00', end_time: '17:00' },
        ],
      },
    });
    expect(shiftRes.statusCode).toBe(201);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/assistance/shifts?store_id=1',
    });
    expect(listRes.statusCode).toBe(200);
    const shifts = JSON.parse(listRes.payload);
    expect(shifts.length).toBe(2);
    expect(shifts[0].staff_name).toBe('Dr. Lucas Farmacêutico');
  });

  it('POST & GET /api/assistance/logbook & extract should handle sanitary occurrences', async () => {
    const staffRes = await app.inject({
      method: 'POST',
      url: '/api/assistance/staff',
      payload: {
        store_id: 1,
        name: 'Dra. Claudia Santos',
        cpf: '444.555.666-77',
        crf_number: '66554',
        crf_uf: 'SP',
        role: 'RT_TITULAR',
      },
    });
    const staff = JSON.parse(staffRes.payload);

    const logRes = await app.inject({
      method: 'POST',
      url: '/api/assistance/logbook',
      payload: {
        store_id: 1,
        staff_id: staff.id,
        entry_type: 'INSPECTION_CRF',
        title: 'Inspeção de Regularidade Técnica',
        description: 'Fiscalização presencial pelo CRF/SP sem inconformidades.',
        crf_inspector_name: 'Fiscal Marcos CRF 2099',
        crf_inspection_term_number: 'TERM-9988',
        action_taken: 'Cópia arquivada em pasta física.',
      },
    });
    expect(logRes.statusCode).toBe(201);
    const log = JSON.parse(logRes.payload);
    expect(log.sha256_hash).toBeDefined();

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/assistance/logbook?store_id=1',
    });
    expect(getRes.statusCode).toBe(200);
    const logs = JSON.parse(getRes.payload);
    expect(logs.length).toBe(1);

    const extractRes = await app.inject({
      method: 'GET',
      url: '/api/assistance/logbook/extract?store_id=1',
    });
    expect(extractRes.statusCode).toBe(200);
    const extract = JSON.parse(extractRes.payload);
    expect(extract.totalEntries).toBe(1);
    expect(extract.extractHash).toBeDefined();

    const kpiRes = await app.inject({
      method: 'GET',
      url: '/api/assistance/kpis?store_id=1',
    });
    expect(kpiRes.statusCode).toBe(200);
    const kpis = JSON.parse(kpiRes.payload);
    expect(kpis.hasActiveRT).toBe(true);
    expect(kpis.activeRtName).toBe('Dra. Claudia Santos');
  });
});
