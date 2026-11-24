import { Database } from '../../database/connection';
import {
  KioskTerminal,
  CreateKioskTerminalDTO,
  QueueTicket,
  IssueQueueTicketDTO,
  PriceCheckResult,
  CreateExpressPreSaleDTO,
  ExpressPreSaleResult,
  KioskKpis,
} from './kiosk.types';

export class KioskService {
  constructor(private db: Database) {}

  /**
   * Lista terminais de autoatendimento cadastrados
   */
  listTerminals(storeId?: number): KioskTerminal[] {
    let sql = `
      SELECT t.*, s.name as store_name
      FROM kiosk_terminals t
      JOIN stores s ON s.id = t.store_id
      WHERE t.is_active = 1
    `;
    const params: any[] = [];

    if (storeId) {
      sql += ' AND t.store_id = ?';
      params.push(storeId);
    }

    sql += ' ORDER BY t.terminal_code ASC';
    return this.db.prepare(sql).all(...params) as KioskTerminal[];
  }

  /**
   * Cadastra novo terminal de autoatendimento
   */
  createTerminal(input: CreateKioskTerminalDTO): KioskTerminal {
    const stmt = this.db.prepare(`
      INSERT INTO kiosk_terminals (store_id, terminal_code, name, ip_address, mode, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    const result = stmt.run(
      input.store_id,
      input.terminal_code.trim().toUpperCase(),
      input.name.trim(),
      input.ip_address?.trim() || null,
      input.mode || 'HYBRID'
    );

    return this.db.prepare('SELECT * FROM kiosk_terminals WHERE id = ?').get(result.lastInsertRowid) as KioskTerminal;
  }

  /**
   * Consulta de Preços Rápida para o Totem / Busca-Preço
   */
  queryProductPrice(
    eanOrTerm: string,
    customerCpf?: string,
    storeId: number = 1,
    kioskId?: number
  ): PriceCheckResult {
    const term = eanOrTerm.trim();
    if (!term) {
      throw new Error('Informe o código de barras (EAN) ou nome do produto.');
    }

    const product = this.db.prepare(`
      SELECT * FROM products 
      WHERE (ean = ? OR name LIKE ?) AND is_active = 1
      LIMIT 1
    `).get(term, `%${term}%`) as any;

    if (!product) {
      throw new Error(`Produto não encontrado com o termo ou código informado: ${term}`);
    }

    const originalPrice = product.price;
    let discountPercent = 0;
    let isClubMember = false;

    // Desconto de Clube Fidelidade / Convênio se CPF for informado
    if (customerCpf && customerCpf.trim().length >= 11) {
      isClubMember = true;
      discountPercent = product.category === 'GENERICO' ? 20 : 12; // 20% em genéricos, 12% nos demais
    }

    const discountAmount = Number(((originalPrice * discountPercent) / 100).toFixed(2));
    const finalPrice = Number((originalPrice - discountAmount).toFixed(2));

    // Registro de telemetria da consulta
    try {
      this.db.prepare(`
        INSERT INTO kiosk_price_queries (store_id, kiosk_id, product_id, customer_cpf, queried_price, discount_applied)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(storeId, kioskId || null, product.id, customerCpf || null, finalPrice, discountAmount);
    } catch {
      // telemetria não bloqueia a resposta
    }

    // Regra sanitária de retenção
    const requiresPrescription =
      product.stripe === 'PRETA' ||
      (product.control_type && product.control_type !== 'NONE' && product.control_type !== 'ISENTO');

    // Busca medicamentos genéricos alternativos com o mesmo princípio ativo
    let genericAlternatives: PriceCheckResult['generic_alternatives'] = [];
    if (product.active_ingredient && product.active_ingredient !== 'ISENTO') {
      const alternatives = this.db.prepare(`
        SELECT id, name, ean, price
        FROM products
        WHERE active_ingredient = ?
          AND id <> ?
          AND is_active = 1
        ORDER BY price ASC
        LIMIT 3
      `).all(product.active_ingredient, product.id) as Array<{
        id: number;
        name: string;
        ean: string;
        price: number;
      }>;

      genericAlternatives = alternatives.map((alt) => {
        const savings = Math.max(0, originalPrice - alt.price);
        const savingsPct = originalPrice > 0 ? (savings / originalPrice) * 100 : 0;
        return {
          id: alt.id,
          name: alt.name,
          ean: alt.ean,
          price: alt.price,
          savings_amount: Number(savings.toFixed(2)),
          savings_percentage: Number(savingsPct.toFixed(1)),
        };
      });
    }

    return {
      product_id: product.id,
      name: product.name,
      ean: product.ean,
      active_ingredient: product.active_ingredient,
      category: product.category || 'OUTROS',
      stripe: product.stripe,
      control_type: product.control_type,
      original_price: originalPrice,
      final_price: finalPrice,
      discount_amount: discountAmount,
      discount_percentage: discountPercent,
      pmc: product.pmc,
      club_member: isClubMember,
      requires_prescription: requiresPrescription,
      generic_alternatives: genericAlternatives,
    };
  }

  /**
   * Emite senha sequencial de atendimento para fila inteligente do totem
   */
  issueQueueTicket(input: IssueQueueTicketDTO): { ticket: QueueTicket; receipt: string } {
    const prefixes: Record<string, string> = {
      NORMAL: 'N',
      PREFERENCIAL: 'P',
      RAPIDO: 'R',
      CONSULTORIO: 'C',
    };

    const prefix = prefixes[input.service_type] || 'N';

    // Contagem de senhas emitidas hoje para este tipo
    const countRow = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM queue_tickets 
      WHERE store_id = ? 
        AND service_type = ? 
        AND date(created_at) = date('now')
    `).get(input.store_id, input.service_type) as { count: number };

    const seq = countRow.count + 1;
    const ticketNumber = `${prefix}-${String(seq).padStart(3, '0')}`;

    const stmt = this.db.prepare(`
      INSERT INTO queue_tickets (
        store_id, kiosk_id, ticket_number, service_type, customer_name, customer_cpf, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'WAITING')
    `);

    const result = stmt.run(
      input.store_id,
      input.kiosk_id || null,
      ticketNumber,
      input.service_type,
      input.customer_name?.trim() || null,
      input.customer_cpf?.trim() || null
    );

    const ticket = this.db.prepare(`
      SELECT q.*, k.name as kiosk_name
      FROM queue_tickets q
      LEFT JOIN kiosk_terminals k ON k.id = q.kiosk_id
      WHERE q.id = ?
    `).get(result.lastInsertRowid) as QueueTicket;

    const receipt = this.formatQueueReceipt(ticket);
    return { ticket, receipt };
  }

  /**
   * Lista senhas de fila da loja
   */
  listQueueTickets(storeId: number, status?: string): QueueTicket[] {
    let sql = `
      SELECT q.*, k.name as kiosk_name
      FROM queue_tickets q
      LEFT JOIN kiosk_terminals k ON k.id = q.kiosk_id
      WHERE q.store_id = ?
        AND date(q.created_at) = date('now')
    `;
    const params: any[] = [storeId];

    if (status) {
      sql += ' AND q.status = ?';
      params.push(status);
    }

    // Ordenação: PREFERENCIAL tem prioridade se status for WAITING
    sql += `
      ORDER BY 
        CASE WHEN q.service_type = 'PREFERENCIAL' THEN 0 ELSE 1 END,
        q.created_at ASC
    `;

    return this.db.prepare(sql).all(...params) as QueueTicket[];
  }

  /**
   * Balconista chama a senha no painel
   */
  callQueueTicket(ticketId: number, operatorName: string): QueueTicket {
    this.db.prepare(`
      UPDATE queue_tickets
      SET status = 'CALLED', counter_operator = ?, called_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(operatorName.trim(), ticketId);

    return this.db.prepare('SELECT * FROM queue_tickets WHERE id = ?').get(ticketId) as QueueTicket;
  }

  /**
   * Conclui o atendimento da senha
   */
  completeQueueTicket(ticketId: number): QueueTicket {
    this.db.prepare(`
      UPDATE queue_tickets
      SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(ticketId);

    return this.db.prepare('SELECT * FROM queue_tickets WHERE id = ?').get(ticketId) as QueueTicket;
  }

  /**
   * Cria pré-venda expressa no totem (self-checkout assistido)
   */
  createExpressPreSale(input: CreateExpressPreSaleDTO): ExpressPreSaleResult {
    if (!input.items || input.items.length === 0) {
      throw new Error('A cesta de compras expressa está vazia.');
    }

    // 1. Validação sanitária de cada item
    let subtotal = 0;
    const validatedItems: Array<{
      product: any;
      batch: any;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    for (const item of input.items) {
      if (item.quantity <= 0) {
        throw new Error('A quantidade do item deve ser maior que zero.');
      }

      const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id) as any;
      if (!product) {
        throw new Error(`Produto ${item.product_id} não encontrado.`);
      }

      // Regra Sanitária: produtos controlados exigem balcão
      if (
        product.stripe === 'PRETA' ||
        (product.control_type && product.control_type !== 'NONE' && product.control_type !== 'ISENTO')
      ) {
        throw new Error(
          `O produto '${product.name}' é de controle especial/receituário obrigatório e não pode ser comprado no totem de autoatendimento. Por favor, retire uma senha e dirija-se ao Balcão Farmacêutico.`
        );
      }

      // Localiza lote disponível
      const batch = this.db.prepare(`
        SELECT id, batch_number, quantity 
        FROM batches 
        WHERE product_id = ? AND store_id = ? AND quantity >= ?
        ORDER BY expiration_date ASC
        LIMIT 1
      `).get(product.id, input.store_id, item.quantity) as any;

      if (!batch) {
        throw new Error(`Estoque insuficiente na loja para o produto: ${product.name}`);
      }

      const itemTotal = Number((product.price * item.quantity).toFixed(2));
      subtotal += itemTotal;

      validatedItems.push({
        product,
        batch,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal,
      });
    }

    // Desconto se CPF for informado
    let discountAmount = 0;
    if (input.customer_cpf && input.customer_cpf.trim().length >= 11) {
      discountAmount = Number((subtotal * 0.10).toFixed(2)); // 10% desconto de autoatendimento
    }

    const finalAmount = Number(Math.max(0, subtotal - discountAmount).toFixed(2));

    // Código da pré-venda expressa
    const randCode = Math.floor(1000 + Math.random() * 9000);
    const preSaleCode = `PV-EXP-${randCode}`;

    const preSaleStmt = this.db.prepare(`
      INSERT INTO pre_sales (store_id, code, status, customer_name, customer_cpf, total_amount)
      VALUES (?, ?, 'OPEN', ?, ?, ?)
    `);

    const preSaleRes = preSaleStmt.run(
      input.store_id,
      preSaleCode,
      input.customer_name?.trim() || 'Cliente Totem Express',
      input.customer_cpf?.trim() || null,
      finalAmount
    );
    const preSaleId = Number(preSaleRes.lastInsertRowid);

    // Inserir itens
    const itemStmt = this.db.prepare(`
      INSERT INTO pre_sale_items (pre_sale_id, product_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const vItem of validatedItems) {
      itemStmt.run(
        preSaleId,
        vItem.product.id,
        vItem.batch.id,
        vItem.quantity,
        vItem.unitPrice,
        vItem.totalPrice
      );
    }

    const receipt = this.formatExpressPreSaleTicket(preSaleCode, finalAmount, discountAmount, validatedItems);

    return {
      pre_sale_id: preSaleId,
      code: preSaleCode,
      total_amount: subtotal,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      items_count: validatedItems.length,
      ticket_receipt: receipt,
    };
  }

  /**
   * Retorna KPIs e métricas dos totens
   */
  getKioskKpis(storeId?: number): KioskKpis {
    let whereStore = '';
    const params: any[] = [];
    if (storeId) {
      whereStore = 'WHERE store_id = ?';
      params.push(storeId);
    }

    const queriesToday = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM kiosk_price_queries 
      ${whereStore ? whereStore + ' AND' : 'WHERE'} date(created_at) = date('now')
    `).get(...params) as { count: number };

    const ticketsToday = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM queue_tickets 
      ${whereStore ? whereStore + ' AND' : 'WHERE'} date(created_at) = date('now')
    `).get(...params) as { count: number };

    const waitingTickets = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM queue_tickets 
      ${whereStore ? whereStore + ' AND' : 'WHERE'} status = 'WAITING' AND date(created_at) = date('now')
    `).get(...params) as { count: number };

    const completedTickets = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM queue_tickets 
      ${whereStore ? whereStore + ' AND' : 'WHERE'} status = 'COMPLETED' AND date(created_at) = date('now')
    `).get(...params) as { count: number };

    const preSalesToday = this.db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
      FROM pre_sales
      ${whereStore ? whereStore + ' AND' : 'WHERE'} code LIKE 'PV-EXP-%' AND date(created_at) = date('now')
    `).get(...params) as { count: number; revenue: number };

    return {
      total_price_queries_today: queriesToday.count,
      total_queue_tickets_today: ticketsToday.count,
      waiting_tickets_count: waitingTickets.count,
      completed_tickets_count: completedTickets.count,
      total_express_presales_today: preSalesToday.count,
      express_presales_revenue_today: Number(preSalesToday.revenue.toFixed(2)),
    };
  }

  private formatQueueReceipt(ticket: QueueTicket): string {
    let r = '';
    r += '========================================\n';
    r += '           FARMACORE DROGARIAS          \n';
    r += '          SENHA DE ATENDIMENTO          \n';
    r += '========================================\n';
    r += `\n`;
    r += `              ${ticket.ticket_number}   \n`;
    r += `\n`;
    r += `Fila:       ${ticket.service_type}\n`;
    if (ticket.customer_name) {
      r += `Cliente:    ${ticket.customer_name}\n`;
    }
    r += `Emitido em: ${new Date().toLocaleTimeString('pt-BR')}\n`;
    r += '----------------------------------------\n';
    r += '   Acompanhe sua chamada nos painéis    \n';
    r += '     Obrigado pela sua preferência!     \n';
    r += '========================================\n';
    return r;
  }

  private formatExpressPreSaleTicket(
    code: string,
    finalAmount: number,
    discount: number,
    items: any[]
  ): string {
    let t = '';
    t += '========================================\n';
    t += '           FARMACORE DROGARIAS          \n';
    t += '        PRÉ-VENDA EXPRESS (TOTEM)       \n';
    t += '========================================\n';
    t += `CÓDIGO: #${code}\n`;
    t += `DATA:   ${new Date().toLocaleString('pt-BR')}\n`;
    t += '----------------------------------------\n';
    t += 'ITEM                        QTD    TOTAL\n';
    t += '----------------------------------------\n';
    for (const it of items) {
      const name = it.product.name.substring(0, 24).padEnd(24, ' ');
      const q = String(it.quantity).padStart(3, ' ');
      const tot = `R$ ${it.totalPrice.toFixed(2)}`.padStart(10, ' ');
      t += `${name} ${q} ${tot}\n`;
    }
    t += '----------------------------------------\n';
    if (discount > 0) {
      t += `DESCONTO CLUBE:         (R$ ${discount.toFixed(2)})\n`;
    }
    t += `TOTAL A PAGAR:           R$ ${finalAmount.toFixed(2)}\n`;
    t += '========================================\n';
    t += ' Apresente este bilhete em qualquer dos \n';
    t += ' nossos caixas PDV para pagamento rápido\n';
    t += '========================================\n';
    return t;
  }
}
