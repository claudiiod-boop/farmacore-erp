import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { SanitizationService } from './sanitization.service';
import type {
  CreateSanitizationLogInput,
  CreatePestControlInput,
  CreateWaterTankCleaningInput,
  CreateSopInput,
} from './sanitization.types';

export async function registerSanitizationRoutes(app: FastifyInstance, db: Database) {
  const service = new SanitizationService(db);

  // 1. Registrar Higienização de Ambiente
  app.post('/api/sanitization/logs', async (request, reply) => {
    try {
      const body = request.body as any;
      const input: CreateSanitizationLogInput = {
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        sectorName: body.sectorName || body.sector_name,
        cleaningType: body.cleaningType || body.cleaning_type,
        scheduledDate: body.scheduledDate || body.scheduled_date || new Date().toISOString().split('T')[0],
        executionTimestamp: body.executionTimestamp || body.execution_timestamp,
        chemicalProduct: body.chemicalProduct || body.chemical_product,
        dilutionOrBatch: body.dilutionOrBatch || body.dilution_or_batch,
        performedBy: body.performedBy || body.performed_by,
        verifiedByPharmacist: body.verifiedByPharmacist || body.verified_by_pharmacist,
        status: body.status,
        notes: body.notes,
      };

      const result = service.createSanitizationLog(input);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar higienização' });
    }
  });

  // 2. Listar Higienizações
  app.get('/api/sanitization/logs', async (request, reply) => {
    try {
      const query = request.query as any;
      const filter = {
        storeId: query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined,
        sectorName: query.sectorName || query.sector_name,
        startDate: query.startDate || query.start_date,
        endDate: query.endDate || query.end_date,
        status: query.status,
      };

      const logs = service.listSanitizationLogs(filter);
      return reply.send(logs);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao listar higienizações' });
    }
  });

  // 3. Farmacêutico RT homologa registro de limpeza
  app.post('/api/sanitization/logs/:id/verify', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const pharmacistCrf = body.pharmacistCrf || body.pharmacist_crf;

      if (!pharmacistCrf) {
        return reply.status(400).send({ error: 'CRF do Farmacêutico é obrigatório' });
      }

      const updated = service.verifySanitizationLog(Number(id), pharmacistCrf);
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao verificar higienização' });
    }
  });

  // 4. Cadastrar Laudo de Dedetização / Controle de Pragas
  app.post('/api/sanitization/pest-control', async (request, reply) => {
    try {
      const body = request.body as any;
      const input: CreatePestControlInput = {
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        serviceProviderName: body.serviceProviderName || body.service_provider_name,
        serviceProviderCnpj: body.serviceProviderCnpj || body.service_provider_cnpj,
        sanitaryLicenseNumber: body.sanitaryLicenseNumber || body.sanitary_license_number,
        certificateNumber: body.certificateNumber || body.certificate_number,
        applicationDate: body.applicationDate || body.application_date,
        expirationDate: body.expirationDate || body.expiration_date,
        targetPests: body.targetPests || body.target_pests,
        chemicalAgentsUsed: body.chemicalAgentsUsed || body.chemical_agents_used,
        antidoteInformation: body.antidoteInformation || body.antidote_information,
        technicalResponsiblePest: body.technicalResponsiblePest || body.technical_responsible_pest,
        pharmacistApprovalCrf: body.pharmacistApprovalCrf || body.pharmacist_approval_crf,
        notes: body.notes,
      };

      const cert = service.registerPestControlCertificate(input);
      return reply.status(201).send(cert);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao cadastrar certificado de dedetização' });
    }
  });

  // 5. Listar e Consultar Laudos de Dedetização
  app.get('/api/sanitization/pest-control', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const list = service.listPestControlCertificates(storeId);
      return reply.send(list);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao listar laudos de dedetização' });
    }
  });

  app.get('/api/sanitization/pest-control/active', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const active = service.getActivePestControlCertificate(storeId);
      return reply.send(active);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao buscar laudo de dedetização ativo' });
    }
  });

  // 6. Cadastrar Limpeza de Reservatório d'Água (Caixa d'Água)
  app.post('/api/sanitization/water-tank', async (request, reply) => {
    try {
      const body = request.body as any;
      const input: CreateWaterTankCleaningInput = {
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        serviceProvider: body.serviceProvider || body.service_provider,
        cleaningDate: body.cleaningDate || body.cleaning_date,
        expirationDate: body.expirationDate || body.expiration_date,
        potabilityReportNumber: body.potabilityReportNumber || body.potability_report_number,
        potabilityStatus: body.potabilityStatus || body.potability_status,
        responsibleCleaner: body.responsibleCleaner || body.responsible_cleaner,
        pharmacistCrf: body.pharmacistCrf || body.pharmacist_crf,
        notes: body.notes,
      };

      const result = service.registerWaterTankCleaning(input);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar higienização de reservatório' });
    }
  });

  // 7. Listar e Consultar Limpezas de Caixa d'Água
  app.get('/api/sanitization/water-tank', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const list = service.listWaterTankCleanings(storeId);
      return reply.send(list);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao listar laudos de caixa d água' });
    }
  });

  app.get('/api/sanitization/water-tank/active', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const active = service.getActiveWaterTankCleaning(storeId);
      return reply.send(active);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao buscar laudo ativo de caixa d água' });
    }
  });

  // 8. Cadastrar ou Atualizar POP (Procedimento Operacional Padrão)
  app.post('/api/sanitization/sops', async (request, reply) => {
    try {
      const body = request.body as any;
      const input: CreateSopInput = {
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        sopCode: body.sopCode || body.sop_code,
        title: body.title,
        category: body.category,
        version: body.version,
        effectiveDate: body.effectiveDate || body.effective_date,
        nextReviewDate: body.nextReviewDate || body.next_review_date,
        authorName: body.authorName || body.author_name,
        reviewerPharmacistCrf: body.reviewerPharmacistCrf || body.reviewer_pharmacist_crf,
        contentSummary: body.contentSummary || body.content_summary,
        notes: body.notes,
      };

      const sop = service.createOrUpdateSop(input);
      return reply.status(201).send(sop);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar Procedimento Operacional Padrão' });
    }
  });

  // 9. Listar POPs
  app.get('/api/sanitization/sops', async (request, reply) => {
    try {
      const query = request.query as any;
      const filter = {
        storeId: query.storeId || query.store_id ? Number(query.storeId || query.store_id) : undefined,
        category: query.category,
        status: query.status,
      };

      const sops = service.listSops(filter);
      return reply.send(sops);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao listar POPs' });
    }
  });

  // 10. Dashboard de Conformidade Sanitária (Auditoria VISA / CRF)
  app.get('/api/sanitization/compliance-overview', async (request, reply) => {
    try {
      const query = request.query as any;
      const storeId = query.storeId || query.store_id ? Number(query.storeId || query.store_id) : 1;
      const overview = service.getComplianceOverview(storeId);
      return reply.send(overview);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Erro ao obter conformidade sanitária' });
    }
  });
}
