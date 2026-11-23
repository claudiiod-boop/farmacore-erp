import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Database } from '../../database/connection';
import { ClinicalServicesService } from './clinical-services.service';
import { PharmacovigilanceService } from './pharmacovigilance.service';
import { DsfFormatter } from './dsf-formatter';
import type {
  ClinicalPharmacist,
  ClinicalServiceItem,
  CreateAttendanceDTO,
  ClinicalProcedureRecord,
  ClinicalRapidTestRecord,
  PharmacovigilanceReport
} from './clinical.types';

export function registerClinicalRoutes(app: FastifyInstance, db: Database): void {
  const clinicalService = new ClinicalServicesService(db);
  const pharmacovigilanceService = new PharmacovigilanceService(db);

  // 1. Farmacêuticos
  app.get<{ Querystring: { storeId?: string } }>('/api/clinical/pharmacists', async (req, reply) => {
    const storeId = Number(req.query.storeId) || 1;
    const list = clinicalService.listPharmacists(storeId);
    return reply.send(list);
  });

  app.post<{ Body: ClinicalPharmacist }>('/api/clinical/pharmacists', async (req, reply) => {
    const body = req.body;
    if (!body.storeId || !body.name || !body.cpf || !body.crfNumber || !body.crfUf) {
      return reply.status(400).send({ error: 'Dados obrigatórios do farmacêutico não preenchidos' });
    }
    const created = clinicalService.registerPharmacist(body);
    return reply.status(201).send(created);
  });

  // 2. Catálogo de Serviços
  app.get<{ Querystring: { storeId?: string } }>('/api/clinical/catalog', async (req, reply) => {
    const storeId = Number(req.query.storeId) || 1;
    const list = clinicalService.listServiceCatalog(storeId);
    return reply.send(list);
  });

  app.post<{ Body: ClinicalServiceItem }>('/api/clinical/catalog', async (req, reply) => {
    const body = req.body;
    if (!body.storeId || !body.code || !body.name || !body.category) {
      return reply.status(400).send({ error: 'Dados obrigatórios do serviço não preenchidos' });
    }
    const created = clinicalService.addServiceCatalogItem(body);
    return reply.status(201).send(created);
  });

  app.post<{ Body: { storeId: number } }>('/api/clinical/catalog/seed', async (req, reply) => {
    const storeId = Number(req.body.storeId) || 1;
    clinicalService.seedDefaultServices(storeId);
    const list = clinicalService.listServiceCatalog(storeId);
    return reply.status(201).send(list);
  });

  // 3. Atendimentos
  app.post<{ Body: CreateAttendanceDTO }>('/api/clinical/attendances', async (req, reply) => {
    const body = req.body;
    if (!body.storeId || !body.pharmacistId || !body.patientName) {
      return reply.status(400).send({ error: 'Dados obrigatórios do atendimento não preenchidos' });
    }
    const attendance = clinicalService.createAttendance(body);
    return reply.status(201).send(attendance);
  });

  app.get<{ Querystring: { storeId?: string; status?: string; patientName?: string } }>('/api/clinical/attendances', async (req, reply) => {
    const storeId = Number(req.query.storeId) || 1;
    const list = clinicalService.listAttendances(storeId, {
      status: req.query.status,
      patientName: req.query.patientName
    });
    return reply.send(list);
  });

  app.get<{ Params: { id: string } }>('/api/clinical/attendances/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const attendance = clinicalService.getAttendanceById(id);
    if (!attendance) {
      return reply.status(404).send({ error: 'Atendimento não encontrado' });
    }
    return reply.send(attendance);
  });

  // 4. Testes Rápidos e Procedimentos
  app.post<{ Params: { id: string }; Body: ClinicalRapidTestRecord }>('/api/clinical/attendances/:id/tests', async (req, reply) => {
    const attendanceId = Number(req.params.id);
    const body = req.body;
    if (!body.testType || !body.reagentName || !body.resultValue || !body.resultInterpretation) {
      return reply.status(400).send({ error: 'Dados obrigatórios do teste rápido não preenchidos' });
    }
    const test = clinicalService.addRapidTest(attendanceId, body);
    return reply.status(201).send(test);
  });

  app.post<{ Params: { id: string }; Body: ClinicalProcedureRecord }>('/api/clinical/attendances/:id/procedures', async (req, reply) => {
    const attendanceId = Number(req.params.id);
    const body = req.body;
    if (!body.procedureType) {
      return reply.status(400).send({ error: 'Tipo de procedimento obrigatório' });
    }
    const proc = clinicalService.addProcedure(attendanceId, body);
    return reply.status(201).send(proc);
  });

  // 5. Finalizar Atendimento e Emitir DSF
  app.post<{ Params: { id: string } }>('/api/clinical/attendances/:id/complete', async (req, reply) => {
    const id = Number(req.params.id);
    try {
      const completed = clinicalService.completeAttendance(id);
      return reply.send(completed);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Falha ao concluir atendimento' });
    }
  });

  app.get<{ Params: { id: string } }>('/api/clinical/attendances/:id/dsf', async (req, reply) => {
    const id = Number(req.params.id);
    const attendance = clinicalService.getAttendanceById(id);
    if (!attendance) {
      return reply.status(404).send({ error: 'Atendimento não encontrado' });
    }

    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(attendance.storeId) as any;
    const slipPaciente = DsfFormatter.formatDsfSlip(attendance, store, 'PACIENTE');
    const slipEstabelecimento = DsfFormatter.formatDsfSlip(attendance, store, 'ESTABELECIMENTO');

    return reply.send({
      dsfNumber: attendance.dsfNumber,
      attendanceCode: attendance.attendanceCode,
      patientName: attendance.patientName,
      slipPaciente,
      slipEstabelecimento
    });
  });

  // 6. Farmacovigilância
  app.post<{ Body: PharmacovigilanceReport }>('/api/clinical/pharmacovigilance', async (req, reply) => {
    const body = req.body;
    if (!body.storeId || !body.pharmacistId || !body.patientName || !body.suspectedMedication || !body.adverseReactionDescription) {
      return reply.status(400).send({ error: 'Dados obrigatórios da notificação de farmacovigilância não preenchidos' });
    }
    const created = pharmacovigilanceService.reportAdverseReaction(body);
    return reply.status(201).send(created);
  });

  app.get<{ Querystring: { storeId?: string; severity?: string; status?: string } }>('/api/clinical/pharmacovigilance', async (req, reply) => {
    const storeId = Number(req.query.storeId) || 1;
    const list = pharmacovigilanceService.listReports(storeId, {
      severity: req.query.severity,
      status: req.query.status
    });
    return reply.send(list);
  });

  app.put<{ Params: { id: string }; Body: { protocolNumber: string } }>('/api/clinical/pharmacovigilance/:id/notivisa', async (req, reply) => {
    const id = Number(req.params.id);
    const protocol = req.body?.protocolNumber;
    if (!protocol) {
      return reply.status(400).send({ error: 'Número de protocolo Notivisa obrigatório' });
    }
    const updated = pharmacovigilanceService.updateNotivisaProtocol(id, protocol);
    return reply.send(updated);
  });
}
