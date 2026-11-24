import { Database } from '../../database/connection';
import {
  Subscription,
  SubscriptionItem,
  SubscriptionCycle,
  CreateSubscriptionInput,
  CreateSubscriptionItemInput,
  RenewPrescriptionInput,
  SubscriptionStatus,
  ProcessRefillsResult,
  SubscriptionKpis,
} from './subscription.types';

export class SubscriptionService {
  constructor(private db: Database) {}

  /**
   * Calcula a próxima data de faturamento baseada na data de início e no dia preferido do mês.
   */
  public calculateNextBillingDate(
    startDateStr: string,
    preferredDay: number
  ): string {
    const parts = startDateStr.split('-');
    let year = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1; // 0-indexed
    const day = parseInt(parts[2], 10);

    // Se o dia preferido já passou no mês atual, agenda para o próximo mês
    if (day > preferredDay) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }

    // Garante que o dia exista no mês alvo (ex: dia 31 em fevereiro vira o último dia do mês)
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const effectiveDay = Math.min(preferredDay, lastDayOfMonth);

    const targetDate = new Date(year, month, effectiveDay);
    const yStr = targetDate.getFullYear();
    const mStr = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(targetDate.getDate()).padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
  }

  /**
   * Adiciona N dias a uma data no formato YYYY-MM-DD
   */
  public addDaysToDate(dateStr: string, days: number): string {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const d = new Date(year, month, day);
    d.setDate(d.getDate() + days);

    const yStr = d.getFullYear();
    const mStr = String(d.getMonth() + 1).padStart(2, '0');
    const dStr = String(d.getDate()).padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
  }

  /**
   * Cadastra uma nova assinatura e seus itens de forma atômica
   */
  public createSubscription(input: CreateSubscriptionInput): Subscription {
    if (!input.plan_name?.trim()) {
      throw new Error('PLAN_NAME_REQUIRED');
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('SUBSCRIPTION_ITEMS_REQUIRED');
    }

    // Valida cliente
    const customer = this.db
      .prepare('SELECT id, name, cpf, phone FROM customers WHERE id = ?')
      .get(input.customer_id) as
      | { id: number; name: string; cpf: string; phone: string }
      | undefined;
    if (!customer) {
      throw new Error('CUSTOMER_NOT_FOUND');
    }

    // Valida loja
    const store = this.db
      .prepare('SELECT id FROM stores WHERE id = ?')
      .get(input.store_id);
    if (!store) {
      throw new Error('STORE_NOT_FOUND');
    }

    const interval = input.interval_days || 30;
    const preferredDay = input.preferred_delivery_day || 5;
    const deliveryMode = input.delivery_mode || 'DELIVERY';
    const paymentMethod = input.payment_method || 'PIX_RECURRING';
    const discountPercent = input.discount_percentage ?? 5.0;

    const todayStr =
      input.startDate || new Date().toISOString().split('T')[0];
    const nextBillingDate = this.calculateNextBillingDate(
      todayStr,
      preferredDay
    );

    const transaction = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO subscriptions (
          customer_id, store_id, plan_name, interval_days, preferred_delivery_day,
          delivery_mode, delivery_address, delivery_neighborhood, delivery_city,
          payment_method, payment_card_token, discount_percentage, status,
          next_billing_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
      `);

      const res = stmt.run(
        input.customer_id,
        input.store_id,
        input.plan_name.trim(),
        interval,
        preferredDay,
        deliveryMode,
        input.delivery_address || null,
        input.delivery_neighborhood || null,
        input.delivery_city || null,
        paymentMethod,
        input.payment_card_token || null,
        discountPercent,
        nextBillingDate,
        input.notes || null
      );

      const subscriptionId = Number(res.lastInsertRowid);

      const insertItemStmt = this.db.prepare(`
        INSERT INTO subscription_items (
          subscription_id, product_id, quantity, unit_price, discount_percentage,
          requires_prescription, prescription_doctor_crm, prescription_doctor_uf, prescription_expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of input.items) {
        let price = item.unit_price;
        if (price === undefined) {
          const prod = this.db
            .prepare('SELECT price FROM products WHERE id = ?')
            .get(item.product_id) as { price: number } | undefined;
          if (!prod) {
            throw new Error(`PRODUCT_NOT_FOUND_${item.product_id}`);
          }
          price = prod.price;
        }

        insertItemStmt.run(
          subscriptionId,
          item.product_id,
          item.quantity,
          price,
          item.discount_percentage ?? 0.0,
          item.requires_prescription ? 1 : 0,
          item.prescription_doctor_crm || null,
          item.prescription_doctor_uf || null,
          item.prescription_expiry_date || null
        );
      }

      return subscriptionId;
    });

    const createdId = transaction();
    return this.getSubscription(createdId);
  }

  /**
   * Obtém detalhes completos de uma assinatura (com itens e ciclos)
   */
  public getSubscription(id: number): Subscription & {
    items: SubscriptionItem[];
    cycles: SubscriptionCycle[];
    customer_name?: string;
    customer_cpf?: string;
  } {
    const row = this.db
      .prepare(`
        SELECT s.*, c.name as customer_name, c.cpf as customer_cpf
        FROM subscriptions s
        JOIN customers c ON c.id = s.customer_id
        WHERE s.id = ?
      `)
      .get(id) as (Subscription & { customer_name: string; customer_cpf: string }) | undefined;

    if (!row) {
      throw new Error('SUBSCRIPTION_NOT_FOUND');
    }

    const items = this.db
      .prepare(`
        SELECT si.*, p.name as product_name, p.ean as product_ean
        FROM subscription_items si
        JOIN products p ON p.id = si.product_id
        WHERE si.subscription_id = ?
      `)
      .all(id) as SubscriptionItem[];

    const cycles = this.db
      .prepare(`
        SELECT sc.*, ps.code as pre_sale_code
        FROM subscription_cycles sc
        LEFT JOIN pre_sales ps ON ps.id = sc.pre_sale_id
        WHERE sc.subscription_id = ?
        ORDER BY sc.cycle_number DESC
      `)
      .all(id) as SubscriptionCycle[];

    return {
      ...row,
      items,
      cycles,
    };
  }

  /**
   * Lista assinaturas cadastradas
   */
  public listSubscriptions(filters?: {
    status?: SubscriptionStatus;
    customer_id?: number;
    store_id?: number;
  }): Array<
    Subscription & {
      customer_name: string;
      customer_cpf: string;
      item_count: number;
      total_recurring_amount: number;
    }
  > {
    let sql = `
      SELECT 
        s.*, 
        c.name as customer_name, 
        c.cpf as customer_cpf,
        COUNT(si.id) as item_count,
        COALESCE(SUM(si.quantity * si.unit_price * (1 - (s.discount_percentage / 100.0))), 0) as total_recurring_amount
      FROM subscriptions s
      JOIN customers c ON c.id = s.customer_id
      LEFT JOIN subscription_items si ON si.subscription_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.status) {
      sql += ' AND s.status = ?';
      params.push(filters.status);
    }
    if (filters?.customer_id) {
      sql += ' AND s.customer_id = ?';
      params.push(filters.customer_id);
    }
    if (filters?.store_id) {
      sql += ' AND s.store_id = ?';
      params.push(filters.store_id);
    }

    sql += ' GROUP BY s.id ORDER BY s.next_billing_date ASC, s.id DESC';

    return this.db.prepare(sql).all(...params) as any[];
  }

  /**
   * Altera status da assinatura
   */
  public updateSubscriptionStatus(
    id: number,
    newStatus: SubscriptionStatus
  ): Subscription {
    const existing = this.db
      .prepare('SELECT id FROM subscriptions WHERE id = ?')
      .get(id);
    if (!existing) {
      throw new Error('SUBSCRIPTION_NOT_FOUND');
    }

    this.db
      .prepare(
        'UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      )
      .run(newStatus, id);

    return this.getSubscription(id);
  }

  /**
   * Adiciona um novo item à assinatura
   */
  public addSubscriptionItem(
    subscriptionId: number,
    item: CreateSubscriptionItemInput
  ): SubscriptionItem {
    const sub = this.db
      .prepare('SELECT id FROM subscriptions WHERE id = ?')
      .get(subscriptionId);
    if (!sub) {
      throw new Error('SUBSCRIPTION_NOT_FOUND');
    }

    let price = item.unit_price;
    if (price === undefined) {
      const prod = this.db
        .prepare('SELECT price FROM products WHERE id = ?')
        .get(item.product_id) as { price: number } | undefined;
      if (!prod) {
        throw new Error(`PRODUCT_NOT_FOUND_${item.product_id}`);
      }
      price = prod.price;
    }

    const res = this.db
      .prepare(`
        INSERT INTO subscription_items (
          subscription_id, product_id, quantity, unit_price, discount_percentage,
          requires_prescription, prescription_doctor_crm, prescription_doctor_uf, prescription_expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        subscriptionId,
        item.product_id,
        item.quantity,
        price,
        item.discount_percentage ?? 0.0,
        item.requires_prescription ? 1 : 0,
        item.prescription_doctor_crm || null,
        item.prescription_doctor_uf || null,
        item.prescription_expiry_date || null
      );

    return this.db
      .prepare(`
        SELECT si.*, p.name as product_name, p.ean as product_ean
        FROM subscription_items si
        JOIN products p ON p.id = si.product_id
        WHERE si.id = ?
      `)
      .get(Number(res.lastInsertRowid)) as SubscriptionItem;
  }

  /**
   * Remove item da assinatura
   */
  public removeSubscriptionItem(itemId: number): void {
    const existing = this.db
      .prepare('SELECT id FROM subscription_items WHERE id = ?')
      .get(itemId);
    if (!existing) {
      throw new Error('SUBSCRIPTION_ITEM_NOT_FOUND');
    }
    this.db.prepare('DELETE FROM subscription_items WHERE id = ?').run(itemId);
  }

  /**
   * Atualiza / Renova a receita médica de um medicamento de uso contínuo
   */
  public renewPrescription(
    itemId: number,
    input: RenewPrescriptionInput
  ): SubscriptionItem {
    const existing = this.db
      .prepare('SELECT id, requires_prescription FROM subscription_items WHERE id = ?')
      .get(itemId) as { id: number; requires_prescription: number } | undefined;

    if (!existing) {
      throw new Error('SUBSCRIPTION_ITEM_NOT_FOUND');
    }

    this.db
      .prepare(`
        UPDATE subscription_items
        SET 
          prescription_doctor_crm = ?,
          prescription_doctor_uf = ?,
          prescription_expiry_date = ?,
          requires_prescription = 1
        WHERE id = ?
      `)
      .run(
        input.prescription_doctor_crm,
        input.prescription_doctor_uf.toUpperCase(),
        input.prescription_expiry_date,
        itemId
      );

    return this.db
      .prepare(`
        SELECT si.*, p.name as product_name, p.ean as product_ean
        FROM subscription_items si
        JOIN products p ON p.id = si.product_id
        WHERE si.id = ?
      `)
      .get(itemId) as SubscriptionItem;
  }

  /**
   * Consulta receitas médicas que estão vencidas ou vencendo nos próximos N dias
   */
  public getExpiringPrescriptions(daysAhead = 15): Array<{
    item_id: number;
    subscription_id: number;
    customer_id: number;
    customer_name: string;
    customer_phone: string;
    product_id: number;
    product_name: string;
    prescription_doctor_crm: string | null;
    prescription_doctor_uf: string | null;
    prescription_expiry_date: string;
    days_until_expiry: number;
    is_expired: boolean;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const maxDate = this.addDaysToDate(today, daysAhead);

    const rows = this.db
      .prepare(`
        SELECT 
          si.id as item_id,
          s.id as subscription_id,
          c.id as customer_id,
          c.name as customer_name,
          c.phone as customer_phone,
          p.id as product_id,
          p.name as product_name,
          si.prescription_doctor_crm,
          si.prescription_doctor_uf,
          si.prescription_expiry_date
        FROM subscription_items si
        JOIN subscriptions s ON s.id = si.subscription_id
        JOIN customers c ON c.id = s.customer_id
        JOIN products p ON p.id = si.product_id
        WHERE s.status = 'ACTIVE'
          AND si.requires_prescription = 1
          AND si.prescription_expiry_date IS NOT NULL
          AND si.prescription_expiry_date <= ?
        ORDER BY si.prescription_expiry_date ASC
      `)
      .all(maxDate) as any[];

    return rows.map((r) => {
      const todayTime = new Date(today).getTime();
      const expTime = new Date(r.prescription_expiry_date).getTime();
      const diffDays = Math.ceil((expTime - todayTime) / (1000 * 3600 * 24));
      return {
        ...r,
        days_until_expiry: diffDays,
        is_expired: diffDays < 0,
      };
    });
  }

  /**
   * Motor de Processamento Diário:
   * Varre todas as assinaturas ACTIVE com next_billing_date <= currentDate,
   * valida receitas médicas, gera atômica a pré-venda e a ordem de entrega.
   */
  public processScheduledRefills(
    currentDate: string,
    storeId?: number
  ): ProcessRefillsResult {
    let sql = `
      SELECT s.*, c.name as customer_name, c.cpf as customer_cpf, c.phone as customer_phone
      FROM subscriptions s
      JOIN customers c ON c.id = s.customer_id
      WHERE s.status = 'ACTIVE' AND s.next_billing_date <= ?
    `;
    const params: any[] = [currentDate];
    if (storeId) {
      sql += ' AND s.store_id = ?';
      params.push(storeId);
    }

    const eligibleSubscriptions = this.db.prepare(sql).all(...params) as any[];

    const result: ProcessRefillsResult = {
      currentDate,
      totalProcessed: eligibleSubscriptions.length,
      successCount: 0,
      prescriptionPendingCount: 0,
      failedCount: 0,
      details: [],
    };

    for (const sub of eligibleSubscriptions) {
      const items = this.db
        .prepare(`
          SELECT si.*, p.name as product_name, p.control_type, p.stripe
          FROM subscription_items si
          JOIN products p ON p.id = si.product_id
          WHERE si.subscription_id = ?
        `)
        .all(sub.id) as any[];

      // Determina próximo número de ciclo
      const lastCycle = this.db
        .prepare(`
          SELECT MAX(cycle_number) as max_cycle
          FROM subscription_cycles
          WHERE subscription_id = ?
        `)
        .get(sub.id) as { max_cycle: number | null };
      const nextCycleNumber = (lastCycle?.max_cycle || 0) + 1;

      // 1. Validação de Receita Médica (RDC 44/2009 & Portaria 344/98)
      let prescriptionPending = false;
      let pendingProduct = '';

      for (const it of items) {
        if (it.requires_prescription === 1) {
          if (!it.prescription_expiry_date || it.prescription_expiry_date < currentDate) {
            prescriptionPending = true;
            pendingProduct = it.product_name;
            break;
          }
        }
      }

      if (prescriptionPending) {
        this.db
          .prepare(`
            INSERT INTO subscription_cycles (
              subscription_id, cycle_number, scheduled_date, processed_at,
              status, total_amount, failure_reason
            ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'PRESCRIPTION_PENDING', 0.0, ?)
          `)
          .run(
            sub.id,
            nextCycleNumber,
            currentDate,
            `Receita médica vencida ou não cadastrada para o medicamento: ${pendingProduct}`
          );

        result.prescriptionPendingCount++;
        result.details.push({
          subscriptionId: sub.id,
          customerName: sub.customer_name,
          status: 'PRESCRIPTION_PENDING',
          totalAmount: 0.0,
          message: `Pendência farmacêutica: Receita médica expirada (${pendingProduct})`,
        });
        continue;
      }

      // 2. Geração da Pré-Venda e Pedido de Entrega
      try {
        const processTx = this.db.transaction(() => {
          // Calcula totais
          let subtotal = 0.0;
          for (const it of items) {
            subtotal += it.quantity * it.unit_price;
          }
          const discountMultiplier = 1 - (sub.discount_percentage / 100.0);
          const totalAmount = parseFloat((subtotal * discountMultiplier).toFixed(2));

          const preSaleCode = `PV-SUB-${sub.id}-${Date.now().toString().slice(-6)}`;

          // Cria Pré-Venda
          const preSaleRes = this.db
            .prepare(`
              INSERT INTO pre_sales (
                code, status, customer_name, customer_cpf, total_amount
              ) VALUES (?, 'OPEN', ?, ?, ?)
            `)
            .run(preSaleCode, sub.customer_name, sub.customer_cpf, totalAmount);
          const preSaleId = Number(preSaleRes.lastInsertRowid);

          // Cria Itens da Pré-Venda
          const insertPsItemStmt = this.db.prepare(`
            INSERT INTO pre_sale_items (
              pre_sale_id, product_id, batch_id, quantity, unit_price, total_price
            ) VALUES (?, ?, ?, ?, ?, ?)
          `);

          for (const it of items) {
            // Busca lote disponível FEFO
            const batch = this.db
              .prepare(`
                SELECT id, batch_number, quantity, reserved_quantity
                FROM batches
                WHERE product_id = ?
                ORDER BY expiration_date ASC
                LIMIT 1
              `)
              .get(it.product_id) as
              | { id: number; batch_number: string; quantity: number; reserved_quantity: number }
              | undefined;

            let batchId = batch?.id;
            if (!batchId) {
              // Cria lote provisório se não houver cadastrado
              const newBatch = this.db
                .prepare(`
                  INSERT INTO batches (
                    product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity
                  ) VALUES (?, 'AUTOSHIP-PADRAO', '2024-01-01', '2028-12-31', 9999, 0)
                `)
                .run(it.product_id);
              batchId = Number(newBatch.lastInsertRowid);
            }

            const itemUnitPrice = it.unit_price * discountMultiplier;
            const itemTotalPrice = parseFloat((itemUnitPrice * it.quantity).toFixed(2));

            insertPsItemStmt.run(
              preSaleId,
              it.product_id,
              batchId,
              it.quantity,
              itemUnitPrice,
              itemTotalPrice
            );

            // Se exige receita, registra na tabela prescriptions
            if (it.requires_prescription === 1 && it.prescription_doctor_crm) {
              this.db
                .prepare(`
                  INSERT INTO prescriptions (
                    pre_sale_id, doctor_name, doctor_crm, doctor_uf, prescription_type,
                    prescription_date, patient_name
                  ) VALUES (?, 'Médico Responsável', ?, ?, 'RECEITA_BRANCA', ?, ?)
                `)
                .run(
                  preSaleId,
                  it.prescription_doctor_crm,
                  it.prescription_doctor_uf || 'SP',
                  currentDate,
                  sub.customer_name
                );
            }
          }

          // Se delivery_mode === 'DELIVERY', cria ordem de entrega
          let deliveryOrderId: number | null = null;
          if (sub.delivery_mode === 'DELIVERY') {
            const delOrderNumber = `DEL-SUB-${sub.id}-${nextCycleNumber}`;
            const address = sub.delivery_address || 'Endereço Cadastral FarmaCore';
            const neighborhood = sub.delivery_neighborhood || 'Centro';
            const city = sub.delivery_city || 'São Paulo';

            // Traduz método de pagamento para delivery_orders
            let delPaymentMethod = 'PIX';
            if (sub.payment_method === 'CREDIT_CARD_TOKEN') delPaymentMethod = 'CARTAO_CREDITO';
            if (sub.payment_method === 'CONVENIO_CREDIARIO') delPaymentMethod = 'CREDIARIO';
            if (sub.payment_method === 'CASH_ON_DELIVERY') delPaymentMethod = 'DINHEIRO';

            const delRes = this.db
              .prepare(`
                INSERT INTO delivery_orders (
                  order_number, store_id, customer_id, customer_name, customer_phone,
                  customer_cpf, street, number, neighborhood, city, state,
                  subtotal_amount, delivery_fee, discount_amount, total_amount,
                  payment_method, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'S/N', ?, ?, 'SP', ?, 0.0, 0.0, ?, ?, 'RECEIVED')
              `)
              .run(
                delOrderNumber,
                sub.store_id,
                sub.customer_id,
                sub.customer_name,
                sub.customer_phone || '(11) 99999-9999',
                sub.customer_cpf,
                address,
                neighborhood,
                city,
                totalAmount,
                totalAmount,
                delPaymentMethod
              );
            deliveryOrderId = Number(delRes.lastInsertRowid);
          }

          // Registra ciclo
          this.db
            .prepare(`
              INSERT INTO subscription_cycles (
                subscription_id, cycle_number, scheduled_date, processed_at,
                status, pre_sale_id, delivery_order_id, total_amount
              ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'PROCESSED', ?, ?, ?)
            `)
            .run(
              sub.id,
              nextCycleNumber,
              currentDate,
              preSaleId,
              deliveryOrderId,
              totalAmount
            );

          // Atualiza assinatura com last_billing_date e próxima cobrança
          const nextBilling = this.addDaysToDate(sub.next_billing_date, sub.interval_days);
          this.db
            .prepare(`
              UPDATE subscriptions
              SET 
                last_billing_date = ?,
                next_billing_date = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `)
            .run(currentDate, nextBilling, sub.id);

          return {
            preSaleId,
            preSaleCode,
            deliveryOrderId,
            totalAmount,
          };
        });

        const txResult = processTx();
        result.successCount++;
        result.details.push({
          subscriptionId: sub.id,
          customerName: sub.customer_name,
          status: 'PROCESSED',
          preSaleId: txResult.preSaleId,
          preSaleCode: txResult.preSaleCode,
          deliveryOrderId: txResult.deliveryOrderId || undefined,
          totalAmount: txResult.totalAmount,
        });
      } catch (err: any) {
        result.failedCount++;
        result.details.push({
          subscriptionId: sub.id,
          customerName: sub.customer_name,
          status: 'FAILED',
          totalAmount: 0.0,
          message: err.message || 'Erro inesperado na geração do ciclo',
        });
      }
    }

    return result;
  }

  /**
   * KPIs Gerenciais do Clube de Assinatura
   */
  public getSubscriptionKpis(): SubscriptionKpis {
    const counts = this.db
      .prepare(`
        SELECT 
          SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'PAUSED' THEN 1 ELSE 0 END) as paused,
          SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled
        FROM subscriptions
      `)
      .get() as { active: number | null; paused: number | null; cancelled: number | null };

    // MRR Estimado (Soma das assinaturas ativas normalizada para 30 dias)
    const mrrRow = this.db
      .prepare(`
        SELECT 
          COALESCE(SUM(
            si.quantity * si.unit_price * (1 - (s.discount_percentage / 100.0)) * (30.0 / s.interval_days)
          ), 0) as mrr
        FROM subscriptions s
        JOIN subscription_items si ON si.subscription_id = s.id
        WHERE s.status = 'ACTIVE'
      `)
      .get() as { mrr: number };

    // Ciclos processados com sucesso no mês corrente
    const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
    const cyclesRow = this.db
      .prepare(`
        SELECT COUNT(id) as total_processed
        FROM subscription_cycles
        WHERE status = 'PROCESSED' AND scheduled_date LIKE ?
      `)
      .get(`${currentMonthPrefix}%`) as { total_processed: number };

    const expiring = this.getExpiringPrescriptions(15);

    return {
      activeSubscriptions: counts?.active || 0,
      pausedSubscriptions: counts?.paused || 0,
      cancelledSubscriptions: counts?.cancelled || 0,
      totalMonthlyRecurringRevenue: parseFloat((mrrRow?.mrr || 0).toFixed(2)),
      refillsProcessedThisMonth: cyclesRow?.total_processed || 0,
      expiringPrescriptionsNext15Days: expiring.length,
    };
  }
}
