import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Database } from '../../database/connection';
import { PharmaceuticalAssistanceService } from './pharmaceutical-assistance.service';

export function registerPharmaceuticalAssistanceRoutes(app: FastifyInstance, db: Database) {
  const service = new PharmaceuticalAssistanceService(db);

  // POST /api/assistance/staff - Cadastrar farmacêutico (Protegido contra Escalada de Privilégio)
  app.post('/api/assistance/staff', async (request: FastifyRequest, reply: FastifyReply) => {
    const operatorRole = (request.headers['x-operator-role'] as string)?.toUpperCase();
    if (operatorRole && !['ADMIN', 'GERENTE', 'RT'].includes(operatorRole)) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Apenas Administradores, Gerentes ou RTs podem gerenciar o quadro farmacêutico.',
      });
    }

    const schema = z.object({
      store_id: z.number().int().positive(),
      name: z.string().min(2),
      cpf: z.string().min(11),
      crf_number: z.string().min(1),
      crf_uf: z.string().length(2),
      role: z.enum(['RT_TITULAR', 'RT_SUBSTITUTO', 'FARMACEUTICO_ASSISTENTE']),
      phone: z.string().optional(),
      email: z.string().optional(),
      crt_certificate_number: z.string().optional(),
      crt_validity_date: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.format() });
    }

    try {
      const staff = service.registerStaff(parsed.data);
      return reply.status(201).send(staff);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/assistance/staff - Listar farmacêuticos da loja
  app.get('/api/assistance/staff', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const storeId = Number(query.store_id || 1);

    const staffList = service.listStaff(storeId);
    return reply.send(staffList);
  });

  // POST /api/assistance/shifts - Definir escalas semanais de trabalho
  app.post('/api/assistance/shifts', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      store_id: z.number().int().positive(),
      staff_id: z.number().int().positive(),
      shifts: z.array(
        z.object({
          day_of_week: z.number().int().min(0).max(6),
          start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        })
      ),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.format() });
    }

    try {
      const savedShifts = service.setShifts(parsed.data.store_id, parsed.data.staff_id, parsed.data.shifts);
      return reply.status(201).send(savedShifts);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/assistance/shifts - Listar escalas da loja
  app.get('/api/assistance/shifts', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const storeId = Number(query.store_id || 1);

    const shifts = service.listShifts(storeId);
    return reply.send(shifts);
  });

  // POST /api/assistance/logbook - Registrar ocorrência sanitária no livro eletrônico
  app.post('/api/assistance/logbook', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      store_id: z.number().int().positive(),
      staff_id: z.number().int().positive(),
      entry_type: z.enum([
        'INSPECTION_CRF',
        'INSPECTION_VISA',
        'TEMPERATURE_EXCURSION',
        'RECALL_ALERT',
        'TECHNICAL_COMPLAINT',
        'DISPENSATION_INCIDENT',
        'GENERAL_OCCURRENCE',
      ]),
      title: z.string().min(3),
      description: z.string().min(5),
      crf_inspector_name: z.string().optional(),
      crf_inspection_term_number: z.string().optional(),
      action_taken: z.string().optional(),
      entry_date: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.format() });
    }

    try {
      const entry = service.recordLogbookEntry(parsed.data);
      return reply.status(201).send(entry);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/assistance/logbook - Listar ocorrências do livro eletrônico
  app.get('/api/assistance/logbook', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const storeId = Number(query.store_id || 1);
    const limit = query.limit ? Number(query.limit) : 50;

    const entries = service.listLogbookEntries(storeId, limit);
    return reply.send(entries);
  });

  // GET /api/assistance/logbook/extract - Extrato oficial de fiscalização CRF/VISA
  app.get('/api/assistance/logbook/extract', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const storeId = Number(query.store_id || 1);
    const startDate = query.start_date as string | undefined;
    const endDate = query.end_date as string | undefined;

    const extract = service.generateLogbookExtract(storeId, startDate, endDate);
    return reply.send(extract);
  });

  // GET /api/assistance/kpis - Indicadores e Conformidade Lei 13.021/2014
  app.get('/api/assistance/kpis', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const storeId = Number(query.store_id || 1);

    const kpis = service.getAssistanceKpis(storeId);
    return reply.send(kpis);
  });
}
