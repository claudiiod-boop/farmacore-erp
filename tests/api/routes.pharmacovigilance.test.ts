import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Fastify REST Routes — Farmacovigilância & NOTIVISA (Fase 39)', () => {
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

  it('1. POST /api/pharmacovigilance/adrs deve registrar RAM e permitir consulta por protocolo', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/pharmacovigilance/adrs',
      payload: {
        storeId,
        patientInitials: 'J.C.P.',
        patientAge: 38,
        patientGender: 'M',
        suspectedDrugName: 'Ciprofloxacino 500mg',
        suspectedDrugBatch: 'L-CIPRO-2026',
        dailyDose: '1 comprimido a cada 12h',
        treatmentStartDate: '2026-11-20',
        reactionDescription: 'Tendinite em tendão de Aquiles direito com dor intensa e dificuldade de deambulação',
        reactionOnsetDate: '2026-11-23',
        severityLevel: 'MODERATE',
        dechallengeStatus: 'IMPROVED',
        rechallengeStatus: 'NOT_REEXPOSED',
        outcome: 'RECOVERING',
        notifierPharmacistName: 'Dr. Lucas Farmacêutico',
        notifierPharmacistCrf: 'CRF-SP 98765',
      },
    });

    expect(postRes.statusCode).toBe(201);
    const adr = JSON.parse(postRes.body);
    expect(adr.id).toBeGreaterThan(0);
    expect(adr.protocol_code).toMatch(/^RAM-/);

    // Consulta por protocolo
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/pharmacovigilance/adrs/${adr.protocol_code}`,
    });
    expect(getRes.statusCode).toBe(200);
    const fetched = JSON.parse(getRes.body);
    expect(fetched.patient_initials).toBe('J.C.P.');
  });

  it('2. POST /api/pharmacovigilance/complaints deve registrar queixa técnica com bloqueio em quarentena', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/pharmacovigilance/complaints',
      payload: {
        storeId,
        productName: 'Paracetamol Solução Gotas',
        batchNumber: 'L-PARA-99',
        manufacturer: 'Prati-Donaduzzi',
        expirationDate: '2027-11-30',
        complaintType: 'COLOR_OR_ODOR_CHANGE',
        description: 'Líquido com forte odor avinagrado e precipitado marrom no fundo do frasco',
        sampleAvailableForPickup: true,
        quarantineAutoBlocked: true,
        reporterType: 'CUSTOMER',
        reporterName: 'Maria Silva',
        notifierPharmacistCrf: 'CRF-SP 98765',
      },
    });

    expect(postRes.statusCode).toBe(201);
    const comp = JSON.parse(postRes.body);
    expect(comp.id).toBeGreaterThan(0);
    expect(comp.protocol_code).toMatch(/^QT-/);
    expect(comp.quarantine_auto_blocked).toBe(1);

    // Consulta por protocolo
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/pharmacovigilance/complaints/${comp.protocol_code}`,
    });
    expect(getRes.statusCode).toBe(200);
    const fetched = JSON.parse(getRes.body);
    expect(fetched.complaint_type).toBe('COLOR_OR_ODOR_CHANGE');
  });

  it('3. POST /api/pharmacovigilance/submit-notivisa deve sincronizar registro com NOTIVISA', async () => {
    // Insere RAM
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/pharmacovigilance/adrs',
      payload: {
        storeId,
        patientInitials: 'F.M.R.',
        patientGender: 'F',
        suspectedDrugName: 'Fluoxetina 20mg',
        suspectedDrugBatch: 'L-FLX-1',
        dailyDose: '1x ao dia',
        treatmentStartDate: '2026-11-01',
        reactionDescription: 'Insônia severa e tremores',
        reactionOnsetDate: '2026-11-05',
        severityLevel: 'MILD',
        dechallengeStatus: 'IMPROVED',
        rechallengeStatus: 'NOT_REEXPOSED',
        outcome: 'RECOVERED',
        notifierPharmacistName: 'Dr. Lucas',
        notifierPharmacistCrf: 'CRF-SP 98765',
      },
    });
    const adr = JSON.parse(postRes.body);

    // Submete ao NOTIVISA
    const submitRes = await app.inject({
      method: 'POST',
      url: '/api/pharmacovigilance/submit-notivisa',
      payload: {
        type: 'RAM',
        id: adr.id,
      },
    });

    expect(submitRes.statusCode).toBe(200);
    const result = JSON.parse(submitRes.body);
    expect(result.status).toBe('SUBMITTED');
    expect(result.notivisaProtocol).toMatch(/^NOTIVISA-/);
  });

  it('4. GET /api/pharmacovigilance/summary deve retornar indicadores consolidados', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/pharmacovigilance/summary?storeId=${storeId}`,
    });

    expect(res.statusCode).toBe(200);
    const summary = JSON.parse(res.body);
    expect(summary).toHaveProperty('totalRams');
    expect(summary).toHaveProperty('severeRams');
    expect(summary).toHaveProperty('totalComplaints');
    expect(summary).toHaveProperty('pendingSubmissionCount');
  });
});
