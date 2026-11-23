import { Database } from '../../database/connection';
import { OpenWaGatewayService } from './openwa-gateway.service';
import {
  OmnichannelConversation,
  OmnichannelOrder,
  OmnichannelOrderItem,
  OpenWaWebhookPayload,
} from './omnichannel.types';

export class OmnichannelBotService {
  constructor(
    private db: Database,
    private gateway: OpenWaGatewayService
  ) {}

  /**
   * Processa webhook recebido da instância do OpenWA
   */
  public async handleOpenWaWebhook(
    payload: OpenWaWebhookPayload
  ): Promise<{ handled: boolean; replyText?: string }> {
    if (payload.event !== 'onMessage' || !payload.data) {
      return { handled: false };
    }

    const { data, session } = payload;
    const from = data.from || '';
    const body = (data.body || '').trim();
    const contactName = data.sender?.pushname || data.sender?.formattedName;
    const cleanPhone = from.replace(/\D/g, '');

    if (!cleanPhone || !body) {
      return { handled: false };
    }

    // Busca canal ativo correspondente à sessão
    const channel = session
      ? this.gateway.getChannelBySession(session)
      : this.gateway.listChannels()[0];

    if (!channel || !channel.is_active) {
      return { handled: false };
    }

    // Registra mensagem recebida
    const { conversation } = this.gateway.recordInboundMessage(
      channel.id!,
      cleanPhone,
      body,
      contactName,
      data.id
    );

    // Se bot estiver desativado para o canal, apenas registra para atendimento humano
    if (!channel.bot_enabled) {
      return { handled: true };
    }

    // Processa máquina de estados da conversa
    const replyText = await this.processConversationState(channel.id!, conversation, body);

    if (replyText) {
      await this.gateway.sendTextMessage(channel.id!, cleanPhone, replyText);
    }

    return { handled: true, replyText };
  }

  /**
   * Processa a transição de estado da conversa e gera a resposta
   */
  public async processConversationState(
    channelId: number,
    conversation: OmnichannelConversation,
    messageText: string
  ): Promise<string> {
    const text = messageText.trim().toLowerCase();

    // Comando universal para reiniciar atendimento
    if (text === 'menu' || text === 'inicio' || text === '0' || text === 'ola' || text === 'olá') {
      this.updateState(conversation.id!, 'IDLE');
      return this.getMainMenuText(conversation.contact_name);
    }

    switch (conversation.state) {
      case 'IDLE':
        return this.handleIdleState(conversation, text);

      case 'SEARCHING_PRODUCT':
        return this.handleProductSearchState(conversation, messageText);

      case 'SENDING_PRESCRIPTION':
        return this.handlePrescriptionState(conversation, messageText);

      case 'TRACKING_DELIVERY':
        return this.handleTrackingState(conversation, messageText);

      case 'HUMAN_ESCALATION':
        return '🧑‍⚕️ Seu atendimento já foi encaminhado para a nossa equipe de farmacêuticos no balcão. Um atendente responderá em instantes. (Digite *0* para voltar ao menu automático)';

      default:
        this.updateState(conversation.id!, 'IDLE');
        return this.getMainMenuText(conversation.contact_name);
    }
  }

  private handleIdleState(conversation: OmnichannelConversation, text: string): string {
    if (text === '1' || text.includes('preco') || text.includes('preço') || text.includes('remedio') || text.includes('remédio')) {
      this.updateState(conversation.id!, 'SEARCHING_PRODUCT');
      return '🔍 *Consulta de Medicamentos & Preços*\n\nPor favor, digite o *nome do medicamento* ou *princípio ativo* que você procura:';
    }

    if (text === '2' || text.includes('receita')) {
      this.updateState(conversation.id!, 'SENDING_PRESCRIPTION');
      return '📄 *Envio de Receita Médica*\n\nPor favor, envie uma foto nítida ou PDF da sua receita médica. Nosso farmacêutico de plantão irá validar a dosagem e verificar os lotes disponíveis.';
    }

    if (text === '3' || text.includes('entrega') || text.includes('rastrear') || text.includes('pedido')) {
      this.updateState(conversation.id!, 'TRACKING_DELIVERY');
      return '🛵 *Rastreamento de Entrega*\n\nPor favor, digite o *número do seu pedido* (Ex: DEL-202611-0001 ou WPP-0001):';
    }

    if (text === '4' || text.includes('farmaceutico') || text.includes('farmacêutico') || text.includes('atendente')) {
      this.updateState(conversation.id!, 'HUMAN_ESCALATION');
      return '🧑‍⚕️ *Encaminhado para o Balcão Farmacêutico*\n\nUm de nossos farmacêuticos foi notificado e responderá aqui em instantes. Aguarde um momento.';
    }

    return this.getMainMenuText(conversation.contact_name);
  }

  private handleProductSearchState(
    conversation: OmnichannelConversation,
    searchTerm: string
  ): string {
    const term = searchTerm.trim();
    if (!term) {
      return 'Por favor, digite o nome do medicamento ou princípio ativo (ou digite *0* para voltar ao menu).';
    }

    // Consulta produtos no estoque local e preço com PMC
    const products = this.db
      .prepare(`
        SELECT p.id, p.name, p.ean, p.price, p.stripe,
               COALESCE(SUM(b.quantity - b.reserved_quantity), 0) as stock_qty
        FROM products p
        LEFT JOIN batches b ON b.product_id = p.id
        WHERE p.name LIKE ? OR p.ean LIKE ?
        GROUP BY p.id
        LIMIT 5
      `)
      .all(`%${term}%`, `%${term}%`) as any[];

    if (products.length === 0) {
      return `❌ Não encontramos nenhum medicamento com "${term}".\n\nVerifique a grafia ou envie uma foto da embalagem/receita (ou digite *0* para voltar ao menu).`;
    }

    let response = `💊 *Medicamentos Localizados para "${term}":*\n\n`;

    products.forEach((prod, index) => {
      const stockInfo = prod.stock_qty > 0 ? `✅ Disponível (${prod.stock_qty} un)` : `⚠️ Sob Encomenda`;
      response += `*${index + 1}. ${prod.name}*\n`;
      response += `   💰 Preço: R$ ${Number(prod.price).toFixed(2)}\n`;
      response += `   📦 Estoque: ${stockInfo}\n`;
      response += `   🔖 Cód: ${prod.ean}\n\n`;
    });

    response += 'Deseja fazer o pedido? Digite *4* para falar com o atendente ou *0* para voltar ao menu.';
    return response;
  }

  private handlePrescriptionState(
    conversation: OmnichannelConversation,
    messageText: string
  ): string {
    this.updateState(conversation.id!, 'HUMAN_ESCALATION');
    return '✅ Receita recebida com sucesso! Nossa equipe técnica farmacêutica está conferindo as dosagens e disponibilidade. Em alguns instantes retornaremos com o orçamento completo.';
  }

  private handleTrackingState(
    conversation: OmnichannelConversation,
    query: string
  ): string {
    const cleanQuery = query.trim().toUpperCase();

    // Consulta na tabela de tele-entrega da Fase 15
    const order = this.db
      .prepare(`
        SELECT d.order_number, d.customer_name, d.status, d.total_amount,
               (d.street || ', ' || d.number || ' - ' || d.neighborhood) as delivery_address,
               c.name as courier_name
        FROM delivery_orders d
        LEFT JOIN couriers c ON c.id = d.courier_id
        WHERE UPPER(d.order_number) = ? OR d.customer_phone LIKE ?
        ORDER BY d.id DESC
        LIMIT 1
      `)
      .get(cleanQuery, `%${conversation.contact_phone}%`) as any;

    if (!order) {
      return `❌ Não encontramos nenhum pedido recente de tele-entrega com "${cleanQuery}".\n\nVerifique o número do pedido ou digite *4* para falar com o atendente.`;
    }

    const statusMap: Record<string, string> = {
      RECEIVED: '📥 Pedido Recebido na Farmácia',
      PREPARING: '📦 Em Separação no Estoque (Pick-and-Pack)',
      READY_FOR_PICKUP: '⏳ Pronto para Envio / Aguardando Motoboy',
      DISPATCHED: `🛵 Em Rota de Entrega ${order.courier_name ? `com ${order.courier_name}` : ''}`,
      DELIVERED: '✅ Pedido Entregue com Sucesso',
      RETURNED: '⚠️ Pedido Devolvido ao Balcão',
      CANCELLED: '❌ Pedido Cancelado',
    };

    const statusDesc = statusMap[order.status] || order.status;

    return `🛵 *Status do Pedido: ${order.order_number}*\n\n` +
           `👤 Cliente: ${order.customer_name}\n` +
           `📍 Endereço: ${order.delivery_address || 'Entrega Balcão'}\n` +
           `📊 Situação Atual: *${statusDesc}*\n` +
           `💰 Valor Total: R$ ${Number(order.total_amount).toFixed(2)}\n\n` +
           `Digite *0* para voltar ao menu.`;
  }

  private updateState(conversationId: number, newState: OmnichannelConversation['state']) {
    this.db
      .prepare('UPDATE omnichannel_conversations SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newState, conversationId);
  }

  private getMainMenuText(name?: string | null): string {
    const greeting = name ? `Olá, *${name}*!` : 'Olá!';
    return `${greeting} Bem-vindo ao autoatendimento da *FarmaCore Farmácia*! 🏥\n\n` +
           `Como podemos cuidar de você hoje?\n\n` +
           `1️⃣ *Consultar Preço & Estoque de Remédios*\n` +
           `2️⃣ *Enviar Foto da Receita Médica*\n` +
           `3️⃣ *Rastrear Meu Pedido de Tele-Entrega*\n` +
           `4️⃣ *Falar com um Farmacêutico / Atendente*\n\n` +
           `_Responda com o número da opção desejada._`;
  }
}
