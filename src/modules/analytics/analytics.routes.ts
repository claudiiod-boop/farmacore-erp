import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Database } from '../../database/connection';
import { AnalyticsService } from './analytics.service';

export function registerAnalyticsRoutes(app: FastifyInstance, db: Database) {
  const service = new AnalyticsService(db);

  // GET /api/analytics/live - KPIs Executivos & Operacionais em Tempo Real
  app.get('/api/analytics/live', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const storeId = Number(query.store_id || 1);

    try {
      const summary = service.getLiveAnalytics(storeId);
      return reply.send(summary);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/analytics/target - Definir Meta Mensal de Vendas
  app.post('/api/analytics/target', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      store_id: z.number().int().positive(),
      year_month: z.string().regex(/^\d{4}-\d{2}$/),
      target_amount: z.number().positive(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.format() });
    }

    try {
      service.setStoreTarget(parsed.data.store_id, parsed.data.year_month, parsed.data.target_amount);
      return reply.status(200).send({ success: true, message: 'Meta definida com sucesso' });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/analytics/whatsapp/quotations - Gerar Orçamento via WhatsApp
  app.post('/api/analytics/whatsapp/quotations', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      store_id: z.number().int().positive(),
      customer_name: z.string().min(2),
      customer_phone: z.string().min(8),
      attendant_name: z.string().min(2),
      items: z.array(
        z.object({
          product_id: z.number().int().positive(),
          product_name: z.string().min(1),
          quantity: z.number().positive(),
          unit_price_brl: z.number().positive(),
        })
      ).min(1),
      discount_brl: z.number().min(0).optional(),
      valid_days: z.number().int().positive().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.format() });
    }

    try {
      const quotation = service.createWhatsAppQuotation({
        storeId: parsed.data.store_id,
        customerName: parsed.data.customer_name,
        customerPhone: parsed.data.customer_phone,
        attendantName: parsed.data.attendant_name,
        items: parsed.data.items.map((it) => ({
          productId: it.product_id,
          productName: it.product_name,
          quantity: it.quantity,
          unitPriceBrl: it.unit_price_brl,
        })),
        discountBrl: parsed.data.discount_brl,
        validDays: parsed.data.valid_days,
      });

      return reply.status(201).send(quotation);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/analytics/whatsapp/quotations - Listar Orçamentos
  app.get('/api/analytics/whatsapp/quotations', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const storeId = Number(query.store_id || 1);
    const limit = query.limit ? Number(query.limit) : 50;

    const quotations = service.listWhatsAppQuotations(storeId, limit);
    return reply.send(quotations);
  });

  // GET /api/analytics/whatsapp/quotations/:id - Obter Orçamento por ID
  app.get('/api/analytics/whatsapp/quotations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const quotation = service.getWhatsAppQuotationById(Number(id));
    if (!quotation) {
      return reply.status(404).send({ error: 'Orçamento não encontrado' });
    }
    return reply.send(quotation);
  });

  // PATCH /api/analytics/whatsapp/quotations/:id/status - Atualizar Status
  app.patch('/api/analytics/whatsapp/quotations/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      status: z.enum(['OPEN', 'SENT', 'CONVERTED', 'EXPIRED', 'CANCELLED']),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Status inválido' });
    }

    const updated = service.updateQuotationStatus(Number(id), parsed.data.status);
    if (!updated) {
      return reply.status(404).send({ error: 'Orçamento não encontrado' });
    }
    return reply.send(updated);
  });
}
