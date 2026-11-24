import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Validador de Receitas Digitais ICP-Brasil (Fase 36)', () => {
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

  it('1. POST /api/digital-prescriptions/mock-create deve cadastrar receita digital para testes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/digital-prescriptions/mock-create',
      payload: {
        prescriptionCode: 'MEM-2026-TEST',
        prescriberName: 'Dr. Lucas Silveira',
        prescriberCrm: '112233',
        prescriberUf: 'SP',
        patientName: 'Fernanda Lima',
        patientCpf: '333.444.555-66',
        prescriptionType: 'CONTROLLED_C1',
        items: [
          {
            medicationName: 'Zolpidem 10mg',
            dosage: '10mg',
            quantityPrescribed: 1,
            instructions: '1 comprimido antes de dormir',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.body);
    expect(data.id).toBeDefined();
    expect(data.prescription_code).toBe('MEM-2026-TEST');
    expect(data.status).toBe('VALID');
    expect(data.items?.length).toBe(1);
  });

  it('2. POST /api/digital-prescriptions/validate deve validar receita digital autêntica', async () => {
    // 1. Criar
    await app.inject({
      method: 'POST',
      url: '/api/digital-prescriptions/mock-create',
      payload: {
        prescriptionCode: 'CFM-1001-VAL',
        prescriberName: 'Dra. Gabriela Souza',
        prescriberCrm: '445566',
        prescriberUf: 'MG',
        patientName: 'Marcos Vinicius',
        prescriptionType: 'ANTIMICROBIAL',
        items: [{ medicationName: 'Cefalexina 500mg', quantityPrescribed: 2 }],
      },
    });

    // 2. Validar
    const res = await app.inject({
      method: 'POST',
      url: '/api/digital-prescriptions/validate',
      payload: { code: 'CFM-1001-VAL' },
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.isValid).toBe(true);
    expect(data.canDispense).toBe(true);
    expect(data.prescription.prescriber_crm).toBe('445566');
  });

  it('3. POST /api/digital-prescriptions/dispense deve dispensar com carimbo e bloquear dupla dispensação', async () => {
    // 1. Criar
    await app.inject({
      method: 'POST',
      url: '/api/digital-prescriptions/mock-create',
      payload: {
        prescriptionCode: 'MEM-DISP-API',
        prescriberName: 'Dr. Renato',
        prescriberCrm: '998877',
        prescriberUf: 'SP',
        patientName: 'Bruna Marquez',
        prescriptionType: 'CONTROLLED_B1',
        items: [{ medicationName: 'Clonazepam 2.5mg/ml', quantityPrescribed: 1 }],
      },
    });

    // 2. Dispensar sem CRF deve falhar 400
    const failRes = await app.inject({
      method: 'POST',
      url: '/api/digital-prescriptions/dispense',
      payload: {
        code: 'MEM-DISP-API',
        storeId,
        pharmacistCrf: '',
      },
    });
    expect(failRes.statusCode).toBe(400);

    // 3. Dispensar com CRF
    const okRes = await app.inject({
      method: 'POST',
      url: '/api/digital-prescriptions/dispense',
      payload: {
        code: 'MEM-DISP-API',
        storeId,
        pharmacistName: 'Dr. Farmacêutico RT',
        pharmacistCrf: 'CRF-SP 55443',
      },
    });
    expect(okRes.statusCode).toBe(200);
    const data = JSON.parse(okRes.body);
    expect(data.status).toBe('DISPENSED');
    expect(data.dispensed_pharmacist_crf).toBe('CRF-SP 55443');

    // 4. Tentativa de segunda dispensação deve falhar 400 (Bloqueio antifraude)
    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/digital-prescriptions/dispense',
      payload: {
        code: 'MEM-DISP-API',
        storeId,
        pharmacistCrf: 'CRF-SP 55443',
      },
    });
    expect(secondRes.statusCode).toBe(400);
    const errData = JSON.parse(secondRes.body);
    expect(errData.error).toContain('já dispensada');
  });

  it('4. GET /api/digital-prescriptions/:code deve retornar detalhes completos da receita', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/digital-prescriptions/mock-create',
      payload: {
        prescriptionCode: 'MEM-GET-01',
        prescriberName: 'Dr. Teste',
        prescriberCrm: '111',
        prescriberUf: 'SP',
        patientName: 'Paciente Teste',
        prescriptionType: 'REGULAR',
        items: [{ medicationName: 'Dipirona 500mg', quantityPrescribed: 1 }],
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/digital-prescriptions/MEM-GET-01',
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.prescription_code).toBe('MEM-GET-01');
    expect(data.items.length).toBe(1);
  });
});
