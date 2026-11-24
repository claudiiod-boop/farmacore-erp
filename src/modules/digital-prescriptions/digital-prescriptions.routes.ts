import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { DigitalPrescriptionService } from './digital-prescriptions.service';
import type {
  RegisterDigitalPrescriptionInput,
  DispensePrescriptionInput,
} from './digital-prescriptions.types';

export async function registerDigitalPrescriptionRoutes(app: FastifyInstance, db: Database) {
  const service = new DigitalPrescriptionService(db);

  // 1. Validar Receita Digital por Código / QR Code
  app.post('/api/digital-prescriptions/validate', async (request, reply) => {
    try {
      const body = request.body as any;
      const code = body.code || body.prescriptionCode || body.prescription_code;
      if (!code) {
        return reply.status(400).send({ error: 'Código da receita digital é obrigatório' });
      }

      const result = service.validatePrescription(String(code));
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao validar receita digital' });
    }
  });

  // 2. Realizar Dispensação / Baixa da Receita com Carimbo Digital
  app.post('/api/digital-prescriptions/dispense', async (request, reply) => {
    try {
      const body = request.body as any;
      const code = body.code || body.prescriptionCode || body.prescription_code;
      if (!code) {
        return reply.status(400).send({ error: 'Código da receita é obrigatório' });
      }
      if (!body.pharmacistCrf && !body.pharmacist_crf) {
        return reply.status(400).send({ error: 'CRF do farmacêutico é obrigatório para dispensação' });
      }

      const input: DispensePrescriptionInput = {
        storeId: body.storeId || body.store_id ? Number(body.storeId || body.store_id) : 1,
        pharmacistName: body.pharmacistName || body.pharmacist_name || 'Farmacêutico Responsável Técnico',
        pharmacistCrf: body.pharmacistCrf || body.pharmacist_crf,
        preSaleId: body.preSaleId || body.pre_sale_id ? Number(body.preSaleId || body.pre_sale_id) : undefined,
      };

      const result = service.dispensePrescription(String(code), input);
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao dispensar receita digital' });
    }
  });

  // 3. Consultar Receita por Código
  app.get('/api/digital-prescriptions/:code', async (request, reply) => {
    try {
      const { code } = request.params as { code: string };
      const prescription = service.getPrescriptionByCode(code);
      if (!prescription) {
        return reply.status(404).send({ error: `Receita digital '${code}' não encontrada` });
      }
      return reply.send(prescription);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao consultar receita' });
    }
  });

  // 4. Cadastrar / Mockar Receita Digital para Testes e Homologação
  app.post('/api/digital-prescriptions/mock-create', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body.prescriptionCode || !body.prescriberName || !body.patientName) {
        return reply.status(400).send({ error: 'prescriptionCode, prescriberName e patientName são obrigatórios' });
      }

      const input: RegisterDigitalPrescriptionInput = {
        prescriptionCode: body.prescriptionCode || body.prescription_code,
        accessToken: body.accessToken || body.access_token,
        prescriberName: body.prescriberName || body.prescriber_name,
        prescriberCrm: body.prescriberCrm || body.prescriber_crm,
        prescriberUf: body.prescriberUf || body.prescriber_uf || 'SP',
        prescriberCpf: body.prescriberCpf || body.prescriber_cpf,
        patientName: body.patientName || body.patient_name,
        patientCpf: body.patientCpf || body.patient_cpf,
        patientBirthDate: body.patientBirthDate || body.patient_birth_date,
        prescriptionType: body.prescriptionType || body.prescription_type || 'CONTROLLED_C1',
        icpSignatureValid: body.icpSignatureValid !== undefined ? Boolean(body.icpSignatureValid) : true,
        icpCertIssuer: body.icpCertIssuer || 'AC Syngular / ITI ICP-Brasil',
        expiresInDays: body.expiresInDays ? Number(body.expiresInDays) : undefined,
        items: Array.isArray(body.items)
          ? body.items.map((i: any) => ({
              medicationName: i.medicationName || i.medication_name,
              productId: i.productId || i.product_id ? Number(i.productId || i.product_id) : undefined,
              dosage: i.dosage,
              quantityPrescribed: Number(i.quantityPrescribed || i.quantity_prescribed || 1),
              instructions: i.instructions,
            }))
          : [],
      };

      const result = service.registerPrescription(input);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao registrar receita digital' });
    }
  });

  // 5. Listar Receitas Digitais
  app.get('/api/digital-prescriptions', async (request, reply) => {
    try {
      const query = request.query as any;
      const prescriptions = service.listPrescriptions({
        status: query.status,
        limit: query.limit ? Number(query.limit) : 50,
      });
      return reply.send(prescriptions);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao listar receitas digitais' });
    }
  });
}
