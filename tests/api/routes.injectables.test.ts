import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Livro de Injetáveis & Sala de Vacinas (Fase 38)', () => {
  let app: FastifyInstance;
  let db: Database;
  let storeId: number;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    const store = db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: number };
    storeId = store.id;

    app = fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. POST /api/injectables deve registrar aplicação de injetável e emitir DSF', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/injectables',
      payload: {
        storeId,
        patientName: 'Eduardo Guimarães',
        patientCpf: '111.222.333-44',
        patientBirthDate: '1982-04-10',
        patientPhone: '(11) 98888-7777',
        medicationName: 'Deca Durabolin (Nandrolona)',
        medicationDosage: '50mg/mL',
        medicationBatch: 'LOTE-DECA-99',
        medicationExpirationDate: '2028-06-30',
        syringeNeedleBatch: 'SER-BD-123',
        administrationRoute: 'INTRAMUSCULAR',
        anatomicalSite: 'Glúteo Ventro-glúteo',
        prescriberName: 'Dr. Fernando Médico',
        prescriberCrm: '99887',
        prescriberUf: 'SP',
        pharmacistName: 'Dra. Camila',
        pharmacistCrf: 'CRF-SP 45678',
        notes: 'Sem queixas após administração',
      },
    });

    expect(postRes.statusCode).toBe(201);
    const log = JSON.parse(postRes.body);
    expect(log.id).toBeGreaterThan(0);
    expect(log.declaration_number).toMatch(/^DSF-INJ-/);

    // Consulta por declaração DSF
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/injectables/declaration/${log.declaration_number}`,
    });
    expect(getRes.statusCode).toBe(200);
    const fetched = JSON.parse(getRes.body);
    expect(fetched.patient_name).toBe('Eduardo Guimarães');
  });

  it('2. GET /api/injectables deve listar aplicações com filtro por CPF', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/injectables',
      payload: {
        storeId,
        patientName: 'Ana Clara',
        patientCpf: '999.888.777-66',
        medicationName: 'Complexo B Injetável',
        medicationDosage: '2mL',
        medicationBatch: 'L-B-1',
        medicationExpirationDate: '2028-01-01',
        syringeNeedleBatch: 'S-1',
        administrationRoute: 'INTRAMUSCULAR',
        anatomicalSite: 'Deltoide',
        prescriberName: 'Dr. Teste',
        prescriberCrm: '111',
        prescriberUf: 'SP',
        pharmacistName: 'Farm',
        pharmacistCrf: 'CRF-1',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/injectables?patientCpf=999.888.777-66',
    });
    expect(res.statusCode).toBe(200);
    const list = JSON.parse(res.body);
    expect(list.length).toBe(1);
    expect(list[0].patient_name).toBe('Ana Clara');
  });

  it('3. POST /api/vaccines deve registrar vacinação e consultar por certificado', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/vaccines',
      payload: {
        storeId,
        patientName: 'Beatriz Martins',
        patientCpf: '555.666.777-88',
        patientBirthDate: '1998-12-05',
        vaccineName: 'Herpes Zoster Recombinante',
        manufacturer: 'GSK',
        vaccineBatch: 'VAC-HZ-001',
        vaccineExpirationDate: '2027-10-31',
        doseType: 'DOSE_1',
        anatomicalSite: 'Deltoide Esquerdo',
        preTriageFever: false,
        pharmacistName: 'Dra. Camila',
        pharmacistCrf: 'CRF-SP 45678',
      },
    });

    expect(postRes.statusCode).toBe(201);
    const vac = JSON.parse(postRes.body);
    expect(vac.certificate_code).toMatch(/^VAC-/);
    expect(vac.sipni_status).toBe('PENDING');

    // Consulta certificado
    const certRes = await app.inject({
      method: 'GET',
      url: `/api/vaccines/certificate/${vac.certificate_code}`,
    });
    expect(certRes.statusCode).toBe(200);
    const cert = JSON.parse(certRes.body);
    expect(cert.vaccine_name).toContain('Herpes Zoster');
  });

  it('4. POST /api/vaccines/export-sipni deve exportar lote pendente', async () => {
    // Insere vacina
    await app.inject({
      method: 'POST',
      url: '/api/vaccines',
      payload: {
        storeId,
        patientName: 'Thiago Pereira',
        patientCpf: '333.222.111-00',
        patientBirthDate: '1990-03-15',
        vaccineName: 'Febre Amarela',
        manufacturer: 'Bio-Manguinhos',
        vaccineBatch: 'FA-2026',
        vaccineExpirationDate: '2028-01-01',
        doseType: 'SINGLE_DOSE',
        anatomicalSite: 'Deltoide',
        pharmacistName: 'Dra. Camila',
        pharmacistCrf: 'CRF-SP 45678',
      },
    });

    const exportRes = await app.inject({
      method: 'POST',
      url: '/api/vaccines/export-sipni',
      payload: { storeId },
    });

    expect(exportRes.statusCode).toBe(200);
    const result = JSON.parse(exportRes.body);
    expect(result.exportedCount).toBeGreaterThanOrEqual(1);
    expect(result.records[0].sipni_status).toBe('EXPORTED');
  });

  it('5. GET /api/injectables/summary deve retornar resumo gerencial do consultório', async () => {
    const summaryRes = await app.inject({
      method: 'GET',
      url: `/api/injectables/summary?storeId=${storeId}`,
    });

    expect(summaryRes.statusCode).toBe(200);
    const summary = JSON.parse(summaryRes.body);
    expect(summary).toHaveProperty('totalInjectablesMonth');
    expect(summary).toHaveProperty('totalVaccinesMonth');
    expect(summary).toHaveProperty('sipniPendingCount');
  });
});
