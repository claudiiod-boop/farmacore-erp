// FarmaCore ERP — Serviço de Adesão a Tratamento Contínuo e Alerta de Recompra Preditiva (Fase 12)
import { getDatabase, Database } from '../../database/connection';
import type {
  PatientTreatment,
  TreatmentItemInput,
  UpcomingRefillItem,
  UpcomingRefillsFilter,
  MarkContactedInput,
  RecordRefillInput,
  RegisterTreatmentInput,
  DiscontinueTreatmentInput,
} from './types';

export class TreatmentError extends Error {
  constructor(public code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'TreatmentError';
  }
}

/**
 * Adiciona N dias a uma data em formato YYYY-MM-DD mantendo precisão UTC
 */
function addDays(dateStr: string, days: number): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const d = new Date(Date.UTC(year, month, day));
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Calcula a diferença em dias entre duas datas (toDate - fromDate)
 */
function daysDifference(fromDateStr: string, toDateStr: string): number {
  const fromMatch = fromDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const toMatch = toDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (fromMatch && toMatch) {
    const d1 = Date.UTC(parseInt(fromMatch[1], 10), parseInt(fromMatch[2], 10) - 1, parseInt(fromMatch[3], 10));
    const d2 = Date.UTC(parseInt(toMatch[1], 10), parseInt(toMatch[2], 10) - 1, parseInt(toMatch[3], 10));
    return Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
  }
  const d1 = new Date(fromDateStr).getTime();
  const d2 = new Date(toDateStr).getTime();
  return Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
}

export class TreatmentAdherenceService {
  constructor(private db: Database = getDatabase()) {}

  /**
   * Mapeia linha do banco de dados para a interface de domínio PatientTreatment
   */
  private mapTreatment(row: any): PatientTreatment {
    return {
      id: row.id,
      customerId: row.customer_id,
      productId: row.product_id,
      saleId: row.sale_id ?? null,
      dailyDose: Number(row.daily_dose),
      unitsPerBox: Number(row.units_per_box),
      boxesPurchased: Number(row.boxes_purchased),
      totalDaysSupply: Number(row.total_days_supply),
      startDate: row.start_date,
      expectedRefillDate: row.expected_refill_date,
      status: row.status,
      lastContactedAt: row.last_contacted_at ?? null,
      notes: row.notes ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,

      // DB compatibility aliases
      customer_id: row.customer_id,
      product_id: row.product_id,
      sale_id: row.sale_id ?? null,
      daily_dose: Number(row.daily_dose),
      units_per_box: Number(row.units_per_box),
      boxes_purchased: Number(row.boxes_purchased),
      total_days_supply: Number(row.total_days_supply),
      start_date: row.start_date,
      expected_refill_date: row.expected_refill_date,
      last_contacted_at: row.last_contacted_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Obtém um tratamento pelo ID
   */
  getTreatmentById(id: number): PatientTreatment | null {
    const row = this.db.prepare('SELECT * FROM patient_treatments WHERE id = ?').get(id);
    return row ? this.mapTreatment(row) : null;
  }

  /**
   * Registra adesão a tratamento(s) a partir de uma venda concluída
   * Suporta sobrecarga por objeto ou argumentos posicionais.
   */
  registerTreatmentFromSale(
    inputOrSaleId: RegisterTreatmentInput | number | null,
    maybeCustomerId?: number,
    maybeItems?: TreatmentItemInput[]
  ): PatientTreatment[] {
    let saleId: number | null = null;
    let customerId: number;
    let items: TreatmentItemInput[] = [];

    if (typeof inputOrSaleId === 'object' && inputOrSaleId !== null) {
      saleId = inputOrSaleId.saleId ?? null;
      customerId = inputOrSaleId.customerId;
      items = inputOrSaleId.items ?? [];
    } else {
      saleId = inputOrSaleId;
      customerId = maybeCustomerId!;
      items = maybeItems ?? [];
    }

    if (!customerId) {
      throw new TreatmentError('INVALID_INPUT', 'O ID do cliente é obrigatório');
    }

    // Valida se o cliente existe
    const customer = this.db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      throw new TreatmentError('CUSTOMER_NOT_FOUND', `Cliente com ID ${customerId} não foi encontrado`);
    }

    const registered: PatientTreatment[] = [];

    // Executa em transação para garantir atomicidade
    const transaction = this.db.transaction(() => {
      for (const item of items) {
        const productId = item.productId ?? item.product_id;
        if (!productId) continue;

        // Valida se o produto existe
        const product = this.db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
        if (!product) continue;

        const dailyDose = item.dailyDose ?? item.daily_dose ?? 1.0;
        const unitsPerBox = item.unitsPerBox ?? item.units_per_box ?? 30;
        const boxesPurchased = item.boxesPurchased ?? item.boxes_purchased ?? 1;

        // Ignora itens sem dados válidos de posologia
        if (
          dailyDose <= 0 ||
          unitsPerBox <= 0 ||
          boxesPurchased <= 0 ||
          isNaN(dailyDose) ||
          isNaN(unitsPerBox) ||
          isNaN(boxesPurchased)
        ) {
          continue;
        }

        const totalDaysSupply = Math.floor((unitsPerBox * boxesPurchased) / dailyDose);
        if (totalDaysSupply <= 0) {
          continue;
        }

        // Verifica se o paciente já possui um tratamento ativo para este produto
        const existingActive = this.db
          .prepare(
            `SELECT id FROM patient_treatments 
             WHERE customer_id = ? AND product_id = ? AND status = 'ACTIVE'
             ORDER BY id DESC LIMIT 1`
          )
          .get(customerId, productId) as { id: number } | undefined;

        if (existingActive) {
          // Atualiza o tratamento anterior para REFILLED
          this.db
            .prepare(
              `UPDATE patient_treatments 
               SET status = 'REFILLED', 
                   updated_at = CURRENT_TIMESTAMP 
               WHERE id = ?`
            )
            .run(existingActive.id);
        }

        const startDate = item.startDate ?? item.start_date ?? new Date().toISOString().slice(0, 10);
        const expectedRefillDate = addDays(startDate, totalDaysSupply);
        const notes = item.notes ?? null;

        const res = this.db
          .prepare(
            `INSERT INTO patient_treatments (
               customer_id, product_id, sale_id, daily_dose, units_per_box, 
               boxes_purchased, total_days_supply, start_date, expected_refill_date, 
               status, notes, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          )
          .run(
            customerId,
            productId,
            saleId,
            dailyDose,
            unitsPerBox,
            boxesPurchased,
            totalDaysSupply,
            startDate,
            expectedRefillDate,
            notes
          );

        const inserted = this.db
          .prepare('SELECT * FROM patient_treatments WHERE id = ?')
          .get(res.lastInsertRowid);

        if (inserted) {
          registered.push(this.mapTreatment(inserted));
        }
      }
    });

    transaction();
    return registered;
  }

  /**
   * Lista próximos alertas de recompra preditiva dentro do horizonte configurado
   */
  listUpcomingRefills(filter: UpcomingRefillsFilter = {}): UpcomingRefillItem[] {
    const refDateStr = filter.referenceDate
      ? typeof filter.referenceDate === 'string'
        ? filter.referenceDate.slice(0, 10)
        : filter.referenceDate.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const daysAhead = filter.daysAhead ?? 7;
    const targetDateStr = addDays(refDateStr, daysAhead);

    let query = `
      SELECT 
        pt.id AS treatment_id,
        pt.customer_id,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        c.store_id,
        pt.product_id,
        p.name AS product_name,
        p.active_ingredient AS product_dosage,
        pt.daily_dose,
        pt.units_per_box,
        pt.boxes_purchased,
        pt.total_days_supply,
        pt.start_date,
        pt.expected_refill_date,
        pt.status,
        pt.last_contacted_at,
        pt.notes
      FROM patient_treatments pt
      JOIN customers c ON c.id = pt.customer_id
      JOIN products p ON p.id = pt.product_id
      WHERE pt.status NOT IN ('REFILLED', 'DISCONTINUED')
        AND pt.expected_refill_date <= ?
    `;

    const params: any[] = [targetDateStr];

    if (filter.status) {
      query += ` AND pt.status = ?`;
      params.push(filter.status);
    }

    if (filter.storeId) {
      query += ` AND c.store_id = ?`;
      params.push(filter.storeId);
    }

    query += ` ORDER BY pt.expected_refill_date ASC, pt.id ASC`;

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map((row) => ({
      treatmentId: row.treatment_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone ?? null,
      customerEmail: row.customer_email ?? null,
      productId: row.product_id,
      productName: row.product_name,
      dosage: row.product_dosage ?? null,
      productDosage: row.product_dosage ?? null,
      dailyDose: Number(row.daily_dose),
      unitsPerBox: Number(row.units_per_box),
      boxesPurchased: Number(row.boxes_purchased),
      totalDaysSupply: Number(row.total_days_supply),
      startDate: row.start_date,
      expectedRefillDate: row.expected_refill_date,
      daysUntilRefill: daysDifference(refDateStr, row.expected_refill_date),
      status: row.status,
      lastContactedAt: row.last_contacted_at ?? null,
      notes: row.notes ?? null,
    }));
  }

  /**
   * Registra intervenção farmacêutica / contato de adesão com o paciente
   */
  markAsContacted(
    treatmentIdOrInput: number | MarkContactedInput,
    maybeNotes?: string
  ): PatientTreatment {
    let treatmentId: number;
    let notes: string | undefined;

    if (typeof treatmentIdOrInput === 'object') {
      treatmentId = treatmentIdOrInput.treatmentId;
      notes = treatmentIdOrInput.notes;
    } else {
      treatmentId = treatmentIdOrInput;
      notes = maybeNotes;
    }

    const existing = this.db
      .prepare('SELECT * FROM patient_treatments WHERE id = ?')
      .get(treatmentId) as any;

    if (!existing) {
      throw new TreatmentError('TREATMENT_NOT_FOUND', `Tratamento com ID ${treatmentId} não foi encontrado`);
    }

    const currentNotes = existing.notes;
    let newNotes = currentNotes;
    if (notes && notes.trim().length > 0) {
      newNotes = currentNotes ? `${currentNotes} | ${notes.trim()}` : notes.trim();
    }

    this.db
      .prepare(
        `UPDATE patient_treatments 
         SET status = 'CONTACTED',
             last_contacted_at = CURRENT_TIMESTAMP,
             notes = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(newNotes, treatmentId);

    const updated = this.db.prepare('SELECT * FROM patient_treatments WHERE id = ?').get(treatmentId);
    return this.mapTreatment(updated);
  }

  /**
   * Marca o tratamento anterior como REFILLED (renovado)
   */
  recordRefill(
    inputOrId: number | RecordRefillInput,
    maybeSaleId?: number | null
  ): PatientTreatment {
    let treatmentId: number;
    let newSaleId: number | null = null;

    if (typeof inputOrId === 'object') {
      treatmentId = inputOrId.treatmentId;
      newSaleId = inputOrId.newSaleId;
    } else {
      treatmentId = inputOrId;
      newSaleId = maybeSaleId ?? null;
    }

    const existing = this.db
      .prepare('SELECT * FROM patient_treatments WHERE id = ?')
      .get(treatmentId) as any;

    if (!existing) {
      throw new TreatmentError('TREATMENT_NOT_FOUND', `Tratamento com ID ${treatmentId} não foi encontrado`);
    }

    this.db
      .prepare(
        `UPDATE patient_treatments 
         SET status = 'REFILLED', 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`
      )
      .run(treatmentId);

    const updated = this.db.prepare('SELECT * FROM patient_treatments WHERE id = ?').get(treatmentId);
    return this.mapTreatment(updated);
  }

  /**
   * Descontinua o tratamento do paciente com registro de justificativa
   */
  discontinueTreatment(
    inputOrId: number | DiscontinueTreatmentInput,
    maybeReason?: string
  ): PatientTreatment {
    let treatmentId: number;
    let reason: string | undefined;

    if (typeof inputOrId === 'object') {
      treatmentId = inputOrId.treatmentId;
      reason = inputOrId.reason;
    } else {
      treatmentId = inputOrId;
      reason = maybeReason;
    }

    const existing = this.db
      .prepare('SELECT * FROM patient_treatments WHERE id = ?')
      .get(treatmentId) as any;

    if (!existing) {
      throw new TreatmentError('TREATMENT_NOT_FOUND', `Tratamento com ID ${treatmentId} não foi encontrado`);
    }

    const currentNotes = existing.notes;
    let newNotes = currentNotes;
    if (reason && reason.trim().length > 0) {
      const formattedReason = `Motivo descontinuação: ${reason.trim()}`;
      newNotes = currentNotes ? `${currentNotes} | ${formattedReason}` : formattedReason;
    }

    this.db
      .prepare(
        `UPDATE patient_treatments 
         SET status = 'DISCONTINUED',
             notes = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(newNotes, treatmentId);

    const updated = this.db.prepare('SELECT * FROM patient_treatments WHERE id = ?').get(treatmentId);
    return this.mapTreatment(updated);
  }

  /**
   * Retorna histórico completo de tratamentos de um paciente ordenado por data de início decrescente
   */
  getCustomerTreatments(customerId: number): PatientTreatment[] {
    const customer = this.db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      throw new TreatmentError('CUSTOMER_NOT_FOUND', `Cliente com ID ${customerId} não foi encontrado`);
    }

    const rows = this.db
      .prepare(
        `SELECT * FROM patient_treatments 
         WHERE customer_id = ? 
         ORDER BY start_date DESC, id DESC`
      )
      .all(customerId);

    return rows.map((r) => this.mapTreatment(r));
  }
}
