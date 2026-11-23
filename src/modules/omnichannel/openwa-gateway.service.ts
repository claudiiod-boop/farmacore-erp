import { Database } from '../../database/connection';
import {
  OmnichannelChannel,
  OmnichannelConversation,
  OmnichannelMessage,
  OpenWaWebhookPayload,
} from './omnichannel.types';

export class OpenWaGatewayService {
  constructor(private db: Database) {}

  /**
   * Salva ou atualiza a configuração de um canal
   */
  public saveChannel(channel: Partial<OmnichannelChannel>): OmnichannelChannel {
    if (channel.id) {
      this.db
        .prepare(`
          UPDATE omnichannel_channels
          SET name = ?, base_url = ?, api_key = ?, session_id = ?, phone_number = ?,
              is_active = ?, bot_enabled = ?, auto_reply_message = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(
          channel.name,
          channel.base_url,
          channel.api_key || null,
          channel.session_id || 'default',
          channel.phone_number || null,
          channel.is_active ? 1 : 0,
          channel.bot_enabled ? 1 : 0,
          channel.auto_reply_message || null,
          channel.id
        );

      return this.getChannelById(channel.id)!;
    }

    const result = this.db
      .prepare(`
        INSERT INTO omnichannel_channels (
          store_id, channel_type, name, base_url, api_key, session_id, phone_number, is_active, bot_enabled, auto_reply_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        channel.store_id || 1,
        channel.channel_type || 'WHATSAPP_OPENWA',
        channel.name || 'WhatsApp FarmaCore',
        channel.base_url || 'http://localhost:8080',
        channel.api_key || null,
        channel.session_id || 'default',
        channel.phone_number || null,
        channel.is_active !== undefined ? (channel.is_active ? 1 : 0) : 1,
        channel.bot_enabled !== undefined ? (channel.bot_enabled ? 1 : 0) : 1,
        channel.auto_reply_message || null
      );

    return this.getChannelById(Number(result.lastInsertRowid))!;
  }

  public getChannelById(id: number): OmnichannelChannel | undefined {
    return this.db
      .prepare<OmnichannelChannel>('SELECT * FROM omnichannel_channels WHERE id = ?')
      .get(id);
  }

  public getChannelBySession(sessionId: string): OmnichannelChannel | undefined {
    return this.db
      .prepare<OmnichannelChannel>(
        'SELECT * FROM omnichannel_channels WHERE session_id = ? AND is_active = 1'
      )
      .get(sessionId);
  }

  public listChannels(storeId: number = 1): OmnichannelChannel[] {
    return this.db
      .prepare<OmnichannelChannel>(
        'SELECT * FROM omnichannel_channels WHERE store_id = ? ORDER BY id ASC'
      )
      .all(storeId);
  }

  /**
   * Envia mensagem de texto via HTTP REST para a instância do OpenWA
   */
  public async sendTextMessage(
    channelId: number,
    to: string,
    content: string
  ): Promise<{ success: boolean; messageId: string }> {
    const channel = this.getChannelById(channelId);
    if (!channel) {
      throw new Error(`Canal ID ${channelId} não encontrado.`);
    }

    // Normaliza número de telefone (garante formato internacional e sufixo @c.us do WhatsApp)
    const cleanTo = to.replace(/\D/g, '');
    const chatId = cleanTo.includes('@') ? cleanTo : `${cleanTo}@c.us`;

    let externalId = `WPP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    try {
      const url = `${channel.base_url.replace(/\/$/, '')}/api/sendText`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(channel.api_key ? { Authorization: `Bearer ${channel.api_key}` } : {}),
        },
        body: JSON.stringify({
          session: channel.session_id,
          chatId,
          text: content,
        }),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.id) externalId = data.id;
      }
    } catch (err: any) {
      // Continua e grava no banco local mesmo se o server externo estiver offline em mock/dev
    }

    // Registra mensagem outbound na conversa correspondente
    this.recordOutboundMessage(channelId, cleanTo, content, externalId);

    return { success: true, messageId: externalId };
  }

  /**
   * Obtém ou cria conversa ativa para o telefone
   */
  public getOrCreateConversation(
    channelId: number,
    phone: string,
    contactName?: string
  ): OmnichannelConversation {
    const cleanPhone = phone.replace(/\D/g, '');
    let conv = this.db
      .prepare<OmnichannelConversation>(
        'SELECT * FROM omnichannel_conversations WHERE channel_id = ? AND contact_phone = ? AND is_open = 1'
      )
      .get(channelId, cleanPhone);

    if (!conv) {
      const res = this.db
        .prepare(`
          INSERT INTO omnichannel_conversations (
            channel_id, contact_phone, contact_name, state, is_open
          ) VALUES (?, ?, ?, 'IDLE', 1)
        `)
        .run(channelId, cleanPhone, contactName || null);

      conv = this.db
        .prepare<OmnichannelConversation>('SELECT * FROM omnichannel_conversations WHERE id = ?')
        .get(Number(res.lastInsertRowid))!;
    } else if (contactName && !conv.contact_name) {
      this.db
        .prepare('UPDATE omnichannel_conversations SET contact_name = ? WHERE id = ?')
        .run(contactName, conv.id);
      conv.contact_name = contactName;
    }

    return conv;
  }

  /**
   * Registra mensagem de saída no banco
   */
  public recordOutboundMessage(
    channelId: number,
    phone: string,
    content: string,
    externalId?: string
  ): OmnichannelMessage {
    const conv = this.getOrCreateConversation(channelId, phone);

    const res = this.db
      .prepare(`
        INSERT INTO omnichannel_messages (
          conversation_id, external_message_id, direction, message_type, content, status
        ) VALUES (?, ?, 'OUTBOUND', 'TEXT', ?, 'SENT')
      `)
      .run(conv.id, externalId || null, content);

    this.db
      .prepare(
        'UPDATE omnichannel_conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?'
      )
      .run(conv.id);

    return this.db
      .prepare<OmnichannelMessage>('SELECT * FROM omnichannel_messages WHERE id = ?')
      .get(Number(res.lastInsertRowid))!;
  }

  /**
   * Registra mensagem recebida (inbound)
   */
  public recordInboundMessage(
    channelId: number,
    phone: string,
    content: string,
    contactName?: string,
    externalId?: string
  ): { conversation: OmnichannelConversation; message: OmnichannelMessage } {
    const conv = this.getOrCreateConversation(channelId, phone, contactName);

    const res = this.db
      .prepare(`
        INSERT INTO omnichannel_messages (
          conversation_id, external_message_id, direction, message_type, content, status
        ) VALUES (?, ?, 'INBOUND', 'TEXT', ?, 'RECEIVED')
      `)
      .run(conv.id, externalId || null, content);

    this.db
      .prepare(
        'UPDATE omnichannel_conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?'
      )
      .run(conv.id);

    const message = this.db
      .prepare<OmnichannelMessage>('SELECT * FROM omnichannel_messages WHERE id = ?')
      .get(Number(res.lastInsertRowid))!;

    return { conversation: conv, message };
  }

  /**
   * Lista mensagens de uma conversa
   */
  public getConversationMessages(conversationId: number): OmnichannelMessage[] {
    return this.db
      .prepare<OmnichannelMessage>(
        'SELECT * FROM omnichannel_messages WHERE conversation_id = ? ORDER BY created_at ASC'
      )
      .all(conversationId);
  }

  /**
   * Lista conversas da loja
   */
  public listConversations(storeId: number = 1): OmnichannelConversation[] {
    return this.db
      .prepare<OmnichannelConversation>(`
        SELECT c.*
        FROM omnichannel_conversations c
        JOIN omnichannel_channels ch ON ch.id = c.channel_id
        WHERE ch.store_id = ?
        ORDER BY c.last_message_at DESC
      `)
      .all(storeId);
  }
}
