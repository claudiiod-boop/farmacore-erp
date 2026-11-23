import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { getDatabase, Database } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';
import { registerRoutes } from '../../src/api/routes';

describe('Clinical Pharmaceutical Consulting REST API Routes (/api/clinical/*)', () => {
  let app: FastifyInstance;
  let db: Database;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    runMigrations(db);

    app = Fastify({ logger: false });
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('Pharmacists & Catalog', () => {
    it('POST & GET /api/clinical/pharmacists should register and list pharmacists', async () => {
      const resPost = await app.inject({
        method: 'POST',
        url: '/api/clinical/pharmacists',
        payload: {
          storeId: 1,
          name: 'Dra. Amanda Farmacêutica',
          cpf: '123.456.789-10',
          crfNumber: '88990',
          crfUf: 'SP'
        }
      });

      expect(resPost.statusCode).toBe(201);
      const pharm = JSON.parse(resPost.body);
      expect(pharm.id).toBeGreaterThan(0);
      expect(pharm.crfNumber).toBe('88990');

      const resGet = await app.inject({
        method: 'GET',
        url: '/api/clinical/pharmacists?storeId=1'
      });

      expect(resGet.statusCode).toBe(200);
      const list = JSON.parse(resGet.body);
      expect(list.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/clinical/catalog/seed should initialize standard clinical services', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/clinical/catalog/seed',
        payload: { storeId: 1 }
      });

      expect(res.statusCode).toBe(201);
      const catalog = JSON.parse(res.body);
      expect(catalog.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Attendances & DSF Workflow', () => {
    it('should run complete clinical attendance lifecycle with TLR, procedure and DSF generation', async () => {
      // 1. Cadastrar farmacêutico
      const pharmRes = await app.inject({
        method: 'POST',
        url: '/api/clinical/pharmacists',
        payload: {
          storeId: 1,
          name: 'Dr. Lucas Farmacêutico',
          cpf: '11122233344',
          crfNumber: '55443',
          crfUf: 'SP'
        }
      });
      const pharm = JSON.parse(pharmRes.body);

      // 2. Seed catálogo
      await app.inject({
        method: 'POST',
        url: '/api/clinical/catalog/seed',
        payload: { storeId: 1 }
      });

      // 3. Criar atendimento
      const attRes = await app.inject({
        method: 'POST',
        url: '/api/clinical/attendances',
        payload: {
          storeId: 1,
          pharmacistId: pharm.id,
          patientName: 'Paulo Henrique',
          patientCpf: '12345678900',
          bloodPressureSystolic: 125,
          bloodPressureDiastolic: 82,
          heartRate: 70,
          temperature: 36.4,
          anamnesisNotes: 'Check-up de rotina'
        }
      });

      expect(attRes.statusCode).toBe(201);
      const att = JSON.parse(attRes.body);
      expect(att.id).toBeGreaterThan(0);
      expect(att.status).toBe('IN_PROGRESS');

      // 4. Adicionar Teste Rápido TLR
      const testRes = await app.inject({
        method: 'POST',
        url: `/api/clinical/attendances/${att.id}/tests`,
        payload: {
          testType: 'GLUCOSE',
          reagentName: 'Accu-Chek Guide',
          reagentBatch: 'L-GLU-01',
          reagentExpiration: '2028-12-31',
          reagentMsRegistration: '10287410055',
          resultValue: '88 mg/dL',
          resultInterpretation: 'NORMAL'
        }
      });
      expect(testRes.statusCode).toBe(201);

      // 5. Adicionar Procedimento
      const procRes = await app.inject({
        method: 'POST',
        url: `/api/clinical/attendances/${att.id}/procedures`,
        payload: {
          procedureType: 'INJECTABLE',
          medicationName: 'Dipirona 500mg/ml',
          applicationSite: 'DELTOIDE_D'
        }
      });
      expect(procRes.statusCode).toBe(201);

      // 6. Concluir Atendimento e emitir DSF
      const compRes = await app.inject({
        method: 'POST',
        url: `/api/clinical/attendances/${att.id}/complete`
      });
      expect(compRes.statusCode).toBe(200);
      const completed = JSON.parse(compRes.body);
      expect(completed.status).toBe('COMPLETED');
      expect(completed.dsfNumber).toContain('DSF-1-');

      // 7. Obter vias da DSF
      const dsfRes = await app.inject({
        method: 'GET',
        url: `/api/clinical/attendances/${att.id}/dsf`
      });
      expect(dsfRes.statusCode).toBe(200);
      const dsf = JSON.parse(dsfRes.body);
      expect(dsf.slipPaciente).toContain('1a VIA: PACIENTE');
      expect(dsf.slipEstabelecimento).toContain('2a VIA: ESTABELECIMENTO');
    });
  });

  describe('Pharmacovigilance', () => {
    it('POST & PUT /api/clinical/pharmacovigilance should create report and update Notivisa protocol', async () => {
      // Cadastrar farmacêutico
      const pharmRes = await app.inject({
        method: 'POST',
        url: '/api/clinical/pharmacists',
        payload: {
          storeId: 1,
          name: 'Dra. Silvia Farmacêutica',
          cpf: '99988877711',
          crfNumber: '33221',
          crfUf: 'SP'
        }
      });
      const pharm = JSON.parse(pharmRes.body);

      // Criar reporte
      const repRes = await app.inject({
        method: 'POST',
        url: '/api/clinical/pharmacovigilance',
        payload: {
          storeId: 1,
          pharmacistId: pharm.id,
          patientName: 'Mariana Lima',
          suspectedMedication: 'Amoxicilina 500mg',
          adverseReactionDescription: 'Broncoespasmo agudo',
          reactionDate: '2026-11-21',
          severity: 'GRAVE'
        }
      });

      expect(repRes.statusCode).toBe(201);
      const rep = JSON.parse(repRes.body);
      expect(rep.id).toBeGreaterThan(0);
      expect(rep.status).toBe('PENDING_NOTIVISA');

      // Atualizar com protocolo Notivisa
      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/clinical/pharmacovigilance/${rep.id}/notivisa`,
        payload: {
          protocolNumber: 'NOTIVISA-2026-991122'
        }
      });

      expect(putRes.statusCode).toBe(200);
      const updated = JSON.parse(putRes.body);
      expect(updated.status).toBe('REPORTED');
      expect(updated.notivisaNotificationNumber).toBe('NOTIVISA-2026-991122');
    });
  });
});
