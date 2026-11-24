import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { InjectableVaccinationService } from './injectables.service';
import type {
  CreateInjectableLogInput,
  CreateVaccinationInput,
} from './injectables.types';

export async function registerInjectableVaccinationRoutes(app: FastifyInstance, db: Database) {
  const service = new InjectableVaccinationService(db);

  // 1. Registrar Administração de Medicamento Injetável
  app.post('/api/injectables', async (request, reply) => {
    try {
      const body = request.body as any;
      const input: CreateInjectableLogInput = {
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        patientName: body.patientName || body.patient_name,
        patientCpf: body.patientCpf || body.patient_cpf,
        patientBirthDate: body.patientBirthDate || body.patient_birth_date,
        patientPhone: body.patientPhone || body.patient_phone,
        medicationName: body.medicationName || body.medication_name,
        medicationDosage: body.medicationDosage || body.medication_dosage,
        medicationBatch: body.medicationBatch || body.medication_batch,
        medicationExpirationDate: body.medicationExpirationDate || body.medication_expiration_date,
        syringeNeedleBatch: body.syringeNeedleBatch || body.syringe_needle_batch,
        administrationRoute: body.administrationRoute || body.administration_route,
        anatomicalSite: body.anatomicalSite || body.anatomical_site,
        prescriberName: body.prescriberName || body.prescriber_name,
        prescriberCrm: body.prescriberCrm || body.prescriber_crm,
        prescriberUf: body.prescriberUf || body.prescriber_uf,
        pharmacistName: body.pharmacistName || body.pharmacist_name,
        pharmacistCrf: body.pharmacistCrf || body.pharmacist_crf,
        adverseReactionObserved: body.adverseReactionObserved ?? body.adverse_reaction_observed,
        notes: body.notes,
        administeredAt: body.administeredAt || body.administered_at,
      };

      const result = service.recordInjectableAdministration(input);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar aplicação de injetável' });
    }
  });

  // 2. Listar Administrações de Injetáveis
  app.get('/api/injectables', async (request, reply) => {
    try {
      const query = request.query as any;
      const filter = {
        storeId: query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined,
        patientCpf: query.patientCpf || query.patient_cpf,
        startDate: query.startDate || query.start_date,
        endDate: query.endDate || query.end_date,
      };

      const list = service.listInjectableLogs(filter);
      return reply.send(list);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao listar aplicações de injetáveis' });
    }
  });

  // 3. Consultar DSF por Declaração
  app.get('/api/injectables/declaration/:declarationNumber', async (request, reply) => {
    try {
      const { declarationNumber } = request.params as { declarationNumber: string };
      const log = service.getInjectableLogByDeclaration(declarationNumber);
      if (!log) {
        return reply.status(404).send({ error: `Declaração '${declarationNumber}' não encontrada` });
      }
      return reply.send(log);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao consultar declaração DSF' });
    }
  });

  // 4. Registrar Vacinação
  app.post('/api/vaccines', async (request, reply) => {
    try {
      const body = request.body as any;
      const input: CreateVaccinationInput = {
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        patientName: body.patientName || body.patient_name,
        patientCpf: body.patientCpf || body.patient_cpf,
        patientBirthDate: body.patientBirthDate || body.patient_birth_date,
        patientPhone: body.patientPhone || body.patient_phone,
        vaccineName: body.vaccineName || body.vaccine_name,
        manufacturer: body.manufacturer,
        vaccineBatch: body.vaccineBatch || body.vaccine_batch,
        diluentBatch: body.diluentBatch || body.diluent_batch,
        vaccineExpirationDate: body.vaccineExpirationDate || body.vaccine_expiration_date,
        doseType: body.doseType || body.dose_type,
        administrationRoute: body.administrationRoute || body.administration_route,
        anatomicalSite: body.anatomicalSite || body.anatomical_site,
        preTriageFever: body.preTriageFever ?? body.pre_triage_fever,
        preTriageAllergies: body.preTriageAllergies || body.pre_triage_allergies,
        pharmacistName: body.pharmacistName || body.pharmacist_name,
        pharmacistCrf: body.pharmacistCrf || body.pharmacist_crf,
        administeredAt: body.administeredAt || body.administered_at,
      };

      const result = service.recordVaccination(input);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar vacinação' });
    }
  });

  // 5. Listar Vacinações
  app.get('/api/vaccines', async (request, reply) => {
    try {
      const query = request.query as any;
      const filter = {
        storeId: query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined,
        patientCpf: query.patientCpf || query.patient_cpf,
        sipniStatus: query.sipniStatus || query.sipni_status,
        startDate: query.startDate || query.start_date,
        endDate: query.endDate || query.end_date,
      };

      const list = service.listVaccinations(filter);
      return reply.send(list);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao listar vacinações' });
    }
  });

  // 6. Consultar Certificado de Vacinação
  app.get('/api/vaccines/certificate/:code', async (request, reply) => {
    try {
      const { code } = request.params as { code: string };
      const vac = service.getVaccinationByCertificate(code);
      if (!vac) {
        return reply.status(404).send({ error: `Certificado de vacinação '${code}' não encontrado` });
      }
      return reply.send(vac);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao consultar certificado de vacinação' });
    }
  });

  // 7. Exportar Lote para SI-PNI
  app.post('/api/vaccines/export-sipni', async (request, reply) => {
    try {
      const body = (request.body as any) || {};
      const storeId = body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1;
      const result = service.exportBatchToSipni(storeId);
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao exportar lote para SI-PNI' });
    }
  });

  // 8. Registrar Evento Adverso Pós-Vacinação (EAPV)
  app.post('/api/vaccines/:id/eapv', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const description = body.description || body.eapvDescription;
      if (!description) {
        return reply.status(400).send({ error: 'Descrição do evento adverso é obrigatória' });
      }

      const updated = service.recordEapv(Number(id), description);
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar EAPV' });
    }
  });

  // 9. Resumo do Consultório & Sala de Injetáveis
  app.get('/api/injectables/summary', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const summary = service.getSummary(storeId);
      return reply.send(summary);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao obter resumo de injetáveis/vacinas' });
    }
  });
}
