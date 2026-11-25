import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { PharmacovigilanceService } from './pharmacovigilance.service';
import type {
  CreateAdrInput,
  CreateComplaintInput,
} from './pharmacovigilance.types';

export async function registerPharmacovigilanceRoutes(app: FastifyInstance, db: Database) {
  const service = new PharmacovigilanceService(db);

  // 1. Notificação de Reação Adversa a Medicamentos (RAM)
  app.post('/api/pharmacovigilance/adrs', async (request, reply) => {
    try {
      const body = request.body as any;
      const input: CreateAdrInput = {
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        patientInitials: body.patientInitials || body.patient_initials,
        patientAge: body.patientAge || body.patient_age ? Number(body.patientAge || body.patient_age) : undefined,
        patientGender: body.patientGender || body.patient_gender,
        isPregnant: body.isPregnant ?? body.is_pregnant,
        suspectedDrugName: body.suspectedDrugName || body.suspected_drug_name,
        suspectedDrugBatch: body.suspectedDrugBatch || body.suspected_drug_batch,
        suspectedDrugManufacturer: body.suspectedDrugManufacturer || body.suspected_drug_manufacturer,
        dailyDose: body.dailyDose || body.daily_dose,
        treatmentStartDate: body.treatmentStartDate || body.treatment_start_date,
        treatmentEndDate: body.treatmentEndDate || body.treatment_end_date,
        therapeuticIndication: body.therapeuticIndication || body.therapeutic_indication,
        concomitantDrugs: body.concomitantDrugs || body.concomitant_drugs,
        reactionDescription: body.reactionDescription || body.reaction_description,
        reactionOnsetDate: body.reactionOnsetDate || body.reaction_onset_date,
        severityLevel: body.severityLevel || body.severity_level,
        seriousCriteria: body.seriousCriteria || body.serious_criteria,
        dechallengeStatus: body.dechallengeStatus || body.dechallenge_status,
        rechallengeStatus: body.rechallengeStatus || body.rechallenge_status,
        outcome: body.outcome,
        notifierPharmacistName: body.notifierPharmacistName || body.notifier_pharmacist_name,
        notifierPharmacistCrf: body.notifierPharmacistCrf || body.notifier_pharmacist_crf,
      };

      const result = service.recordAdr(input);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar notificação de RAM' });
    }
  });

  // 2. Listar Notificações de RAM
  app.get('/api/pharmacovigilance/adrs', async (request, reply) => {
    try {
      const query = request.query as any;
      const filter = {
        storeId: query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined,
        severityLevel: query.severityLevel || query.severity_level,
        status: query.status,
        startDate: query.startDate || query.start_date,
        endDate: query.endDate || query.end_date,
      };

      const list = service.listAdrs(filter);
      return reply.send(list);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao listar notificações de RAM' });
    }
  });

  // 3. Consultar RAM por Protocolo
  app.get('/api/pharmacovigilance/adrs/:protocolCode', async (request, reply) => {
    try {
      const { protocolCode } = request.params as { protocolCode: string };
      const adr = service.getAdrByProtocol(protocolCode);
      if (!adr) {
        return reply.status(404).send({ error: `Notificação '${protocolCode}' não encontrada` });
      }
      return reply.send(adr);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao consultar RAM' });
    }
  });

  // 4. Notificação de Queixa Técnica / Desvio de Qualidade (QT)
  app.post('/api/pharmacovigilance/complaints', async (request, reply) => {
    try {
      const body = request.body as any;
      const input: CreateComplaintInput = {
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        productName: body.productName || body.product_name,
        productEan: body.productEan || body.product_ean,
        batchNumber: body.batchNumber || body.batch_number,
        manufacturer: body.manufacturer,
        expirationDate: body.expirationDate || body.expiration_date,
        complaintType: body.complaintType || body.complaint_type,
        description: body.description,
        sampleAvailableForPickup: body.sampleAvailableForPickup ?? body.sample_available_for_pickup,
        quarantineAutoBlocked: body.quarantineAutoBlocked ?? body.quarantine_auto_blocked,
        reporterType: body.reporterType || body.reporter_type,
        reporterName: body.reporterName || body.reporter_name,
        notifierPharmacistCrf: body.notifierPharmacistCrf || body.notifier_pharmacist_crf,
      };

      const result = service.recordTechnicalComplaint(input);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar queixa técnica' });
    }
  });

  // 5. Listar Queixas Técnicas
  app.get('/api/pharmacovigilance/complaints', async (request, reply) => {
    try {
      const query = request.query as any;
      const filter = {
        storeId: query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined,
        complaintType: query.complaintType || query.complaint_type,
        status: query.status,
        startDate: query.startDate || query.start_date,
        endDate: query.endDate || query.end_date,
      };

      const list = service.listTechnicalComplaints(filter);
      return reply.send(list);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao listar queixas técnicas' });
    }
  });

  // 6. Consultar Queixa Técnica por Protocolo
  app.get('/api/pharmacovigilance/complaints/:protocolCode', async (request, reply) => {
    try {
      const { protocolCode } = request.params as { protocolCode: string };
      const complaint = service.getTechnicalComplaintByProtocol(protocolCode);
      if (!complaint) {
        return reply.status(404).send({ error: `Queixa técnica '${protocolCode}' não encontrada` });
      }
      return reply.send(complaint);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao consultar queixa técnica' });
    }
  });

  // 7. Submeter Notificação ao NOTIVISA (ANVISA)
  app.post('/api/pharmacovigilance/submit-notivisa', async (request, reply) => {
    try {
      const body = request.body as any;
      const type = body.type as 'RAM' | 'TECHNICAL_COMPLAINT';
      const id = Number(body.id);

      if (!type || !id) {
        return reply.status(400).send({ error: 'Tipo (RAM ou TECHNICAL_COMPLAINT) e ID são obrigatórios' });
      }

      const result = service.submitToNotivisa(type, id);
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao submeter ao NOTIVISA' });
    }
  });

  // 8. Resumo e Estatísticas de Farmacovigilância
  app.get('/api/pharmacovigilance/summary', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const summary = service.getSummary(storeId);
      return reply.send(summary);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao obter resumo de farmacovigilância' });
    }
  });
}
