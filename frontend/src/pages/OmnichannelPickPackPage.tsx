import React, { useState, useEffect } from 'react';
import { omnichannelApi } from '../services/api';
import {
  OmnichannelOrder,
  OmnichannelChannel,
  OmnichannelConversation,
  OmnichannelMessage,
} from '../types/omnichannel';

export const OmnichannelPickPackPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pickpack' | 'chat' | 'config'>('pickpack');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estados da Esteira Pick-and-Pack
  const [orders, setOrders] = useState<OmnichannelOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [activeOrder, setActiveOrder] = useState<OmnichannelOrder | null>(null);
  const [scannerBarcode, setScannerBarcode] = useState('');

  // Estados do Chat WhatsApp
  const [conversations, setConversations] = useState<OmnichannelConversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<OmnichannelConversation | null>(null);
  const [chatMessages, setChatMessages] = useState<OmnichannelMessage[]>([]);
  const [replyText, setReplyText] = useState('');

  // Estados de Configuração OpenWA
  const [channels, setChannels] = useState<OmnichannelChannel[]>([]);
  const [configHost, setConfigHost] = useState('http://localhost:8080');
  const [configSession, setConfigSession] = useState('farmacia-matriz');
  const [configApiKey, setConfigApiKey] = useState('');
  const [configPhone, setConfigPhone] = useState('5511999998888');
  const [configBotEnabled, setConfigBotEnabled] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, [activeTab]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'pickpack') {
        const ords = await omnichannelApi.listOrders(1);
        setOrders(ords);
      } else if (activeTab === 'chat') {
        const convs = await omnichannelApi.listConversations(1);
        setConversations(convs);
        if (convs.length > 0 && !selectedConv) {
          handleSelectConversation(convs[0]);
        }
      } else if (activeTab === 'config') {
        const chans = await omnichannelApi.listChannels(1);
        setChannels(chans);
        if (chans.length > 0) {
          const ch = chans[0];
          setConfigHost(ch.base_url || 'http://localhost:8080');
          setConfigSession(ch.session_id || 'default');
          setConfigApiKey(ch.api_key || '');
          setConfigPhone(ch.phone_number || '');
          setConfigBotEnabled(Boolean(ch.bot_enabled));
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao carregar dados' });
    } finally {
      setLoading(false);
    }
  };

  // ===================== AÇÕES PICK-AND-PACK =====================
  const handleStartPicking = async (order: OmnichannelOrder) => {
    try {
      setLoading(true);
      setMessage(null);
      const updated = await omnichannelApi.startPicking(order.id, 1, 'OPERADOR_BALCAO');
      setActiveOrder(updated);
      await loadInitialData();
      setMessage({
        type: 'success',
        text: `Separação do pedido ${order.channel_order_code} iniciada. Realize a conferência dos itens via leitor de código de barras.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao iniciar separação' });
    } finally {
      setLoading(false);
    }
  };

  const handleScanBarcode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !scannerBarcode.trim()) return;

    try {
      setLoading(true);
      setMessage(null);
      const res = await omnichannelApi.scanBarcode(
        activeOrder.id,
        scannerBarcode.trim(),
        'OPERADOR_BALCAO'
      );
      setScannerBarcode('');

      // Recarrega pedido ativo
      const reloaded = await omnichannelApi.getOrder(activeOrder.id);
      setActiveOrder(reloaded);
      await loadInitialData();

      setMessage({
        type: 'success',
        text: res.allItemsPicked
          ? '🎉 100% dos itens conferidos com sucesso! Pedido liberado para despacho.'
          : res.message,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: `❌ ${err.message || 'Erro na conferência'}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDispatchOrder = async () => {
    if (!activeOrder) return;
    try {
      setLoading(true);
      setMessage(null);
      const dispatched = await omnichannelApi.dispatchOrder(activeOrder.id, 'OPERADOR_EXPEDICAO');
      setActiveOrder(dispatched);
      await loadInitialData();
      setMessage({
        type: 'success',
        text: `🚀 Pedido ${dispatched.channel_order_code} despachado com sucesso! Notificação enviada ao WhatsApp do cliente.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao despachar pedido' });
    } finally {
      setLoading(false);
    }
  };

  // ===================== AÇÕES CHAT WHATSAPP =====================
  const handleSelectConversation = async (conv: OmnichannelConversation) => {
    setSelectedConv(conv);
    try {
      const msgs = await omnichannelApi.getConversationMessages(conv.id);
      setChatMessages(msgs);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao carregar mensagens' });
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConv || !replyText.trim()) return;

    try {
      setLoading(true);
      await omnichannelApi.replyConversation(selectedConv.id, replyText.trim(), 'FARMACEUTICO');
      setReplyText('');
      const msgs = await omnichannelApi.getConversationMessages(selectedConv.id);
      setChatMessages(msgs);
      setMessage({ type: 'success', text: 'Mensagem enviada com sucesso!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao enviar mensagem' });
    } finally {
      setLoading(false);
    }
  };

  // ===================== AÇÕES CONFIGURAÇÃO =====================
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage(null);
      await omnichannelApi.saveChannel({
        id: channels[0]?.id,
        store_id: 1,
        channel_type: 'WHATSAPP_OPENWA',
        name: 'WhatsApp FarmaCore',
        base_url: configHost,
        session_id: configSession,
        api_key: configApiKey || null,
        phone_number: configPhone || null,
        is_active: 1,
        bot_enabled: configBotEnabled ? 1 : 0,
      });

      setMessage({ type: 'success', text: 'Configuração do Gateway OpenWA salva com sucesso!' });
      await loadInitialData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar configuração' });
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((o) =>
    statusFilter === 'TODOS' ? true : o.status === statusFilter
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">
              Hub Omnichannel & Atendimento WhatsApp
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-300">
              Gateway OpenWA Integrado
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Recepção de pedidos digitais 24/7, autoatendimento farmacêutico no WhatsApp e esteira de conferência cega (Pick-and-Pack) com leitor de código de barras.
          </p>
        </div>

        {/* Badges de Contagem */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded text-center">
            <div className="text-xs text-slate-500 font-medium">Novos</div>
            <div className="text-sm font-bold text-slate-700">
              {orders.filter((o) => o.status === 'NEW').length}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded text-center">
            <div className="text-xs text-amber-700 font-medium">Separando</div>
            <div className="text-sm font-bold text-amber-800">
              {orders.filter((o) => o.status === 'IN_SEPARATION').length}
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded text-center">
            <div className="text-xs text-blue-700 font-medium">Conferidos</div>
            <div className="text-sm font-bold text-blue-800">
              {orders.filter((o) => o.status === 'CHECKED').length}
            </div>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {message && (
        <div
          className={`p-4 rounded-md text-sm font-medium flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              : 'bg-red-50 text-red-800 border border-red-300'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="font-bold underline text-xs">
            Fechar
          </button>
        </div>
      )}

      {/* Navegação por Abas */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('pickpack');
            setActiveOrder(null);
          }}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'pickpack'
              ? 'border-emerald-600 text-emerald-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          1. Esteira de Pick-and-Pack (Separação & Bipagem)
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'chat'
              ? 'border-emerald-600 text-emerald-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          2. Central de Atendimento WhatsApp (Chat Farmacêutico)
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'config'
              ? 'border-emerald-600 text-emerald-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          3. Configuração do Gateway OpenWA & Bot
        </button>
      </div>

      {/* ===================== ABA 1: PICK-AND-PACK ===================== */}
      {activeTab === 'pickpack' && (
        <div className="space-y-6">
          {activeOrder ? (
            /* Painel de Separação do Pedido Ativo */
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-bold text-emerald-800">
                      {activeOrder.channel_order_code}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        activeOrder.status === 'CHECKED'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : activeOrder.status === 'IN_SEPARATION'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {activeOrder.status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    Cliente: <strong>{activeOrder.customer_name}</strong> | Tel: {activeOrder.customer_phone}
                  </div>
                  <div className="text-xs text-slate-500">
                    Endereço: {activeOrder.delivery_address || 'Retirada no Balcão'} | Pagamento: {activeOrder.payment_method}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveOrder(null)}
                    className="border border-slate-300 text-slate-700 px-4 py-2 rounded text-sm font-semibold hover:bg-slate-50"
                  >
                    Voltar à Lista
                  </button>

                  <button
                    onClick={handleDispatchOrder}
                    disabled={activeOrder.status !== 'CHECKED' || loading}
                    className={`px-5 py-2 rounded text-sm font-bold text-white shadow-sm transition-all ${
                      activeOrder.status === 'CHECKED'
                        ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                        : 'bg-slate-300 cursor-not-allowed'
                    }`}
                  >
                    Despachar com Notificação WhatsApp
                  </button>
                </div>
              </div>

              {/* Input de Bipagem com Leitor de Código de Barras */}
              {activeOrder.status === 'IN_SEPARATION' && (
                <form
                  onSubmit={handleScanBarcode}
                  className="bg-amber-50 p-4 rounded-lg border border-amber-200 flex flex-col md:flex-row gap-3 items-center"
                >
                  <label className="text-xs font-bold text-amber-900 uppercase whitespace-nowrap">
                    Bipagem de Item (Leitor EAN):
                  </label>
                  <input
                    type="text"
                    data-testid="barcode-scanner-input"
                    className="flex-1 bg-white border border-amber-300 rounded px-3 py-2 text-sm font-mono focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Posicione o leitor ou digite o código de barras EAN..."
                    value={scannerBarcode}
                    onChange={(e) => setScannerBarcode(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={loading || !scannerBarcode.trim()}
                    className="bg-amber-700 text-white font-semibold px-6 py-2 rounded text-sm hover:bg-amber-800"
                  >
                    Conferir Item
                  </button>
                </form>
              )}

              {/* Tabela de Itens para Conferência */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                      <th className="p-3">EAN</th>
                      <th className="p-3">Medicamento / Apresentação</th>
                      <th className="p-3 text-right">Qtd Pedida</th>
                      <th className="p-3 text-right">Qtd Conferida</th>
                      <th className="p-3 text-right">Preço Un.</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-center">Status Item</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeOrder.items?.map((item) => (
                      <tr
                        key={item.id || item.ean}
                        className={item.status === 'PICKED' ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}
                      >
                        <td className="p-3 font-mono text-slate-600">{item.ean}</td>
                        <td className="p-3 font-medium text-slate-800">{item.product_name}</td>
                        <td className="p-3 text-right font-bold text-slate-800">
                          {item.quantity_ordered}
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          <span
                            className={
                              item.quantity_picked === item.quantity_ordered
                                ? 'text-emerald-700 font-bold'
                                : 'text-amber-700 font-bold'
                            }
                          >
                            {item.quantity_picked} / {item.quantity_ordered}
                          </span>
                        </td>
                        <td className="p-3 text-right text-slate-600">
                          R$ {Number(item.unit_price).toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-800">
                          R$ {Number(item.total_price).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              item.status === 'PICKED'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Lista Geral de Pedidos Omnichannel */
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-base font-bold text-slate-800">
                  Fila de Pedidos Digitais & Tele-Entrega
                </h2>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Filtrar:</span>
                  {(['TODOS', 'NEW', 'IN_SEPARATION', 'CHECKED', 'DISPATCHED'] as const).map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                          statusFilter === st
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                      <th className="p-3">Código</th>
                      <th className="p-3">Cliente / Telefone</th>
                      <th className="p-3">Endereço de Entrega</th>
                      <th className="p-3 text-center">Itens</th>
                      <th className="p-3 text-right">Valor Total</th>
                      <th className="p-3">Pagamento</th>
                      <th className="p-3 text-center">Situação</th>
                      <th className="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-slate-800">
                          {ord.channel_order_code}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800">{ord.customer_name}</div>
                          <div className="text-[10px] text-slate-500">{ord.customer_phone}</div>
                        </td>
                        <td className="p-3 text-slate-600">
                          {ord.delivery_address || 'Retirada no Balcão'}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-700">
                          {ord.items?.length || 0}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-800">
                          R$ {Number(ord.total_amount).toFixed(2)}
                        </td>
                        <td className="p-3 text-slate-600">{ord.payment_method}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              ord.status === 'NEW'
                                ? 'bg-slate-100 text-slate-800 border border-slate-300'
                                : ord.status === 'IN_SEPARATION'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : ord.status === 'CHECKED'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="p-3 text-center space-x-1">
                          {ord.status === 'NEW' && (
                            <button
                              onClick={() => handleStartPicking(ord)}
                              className="bg-emerald-600 text-white font-semibold px-3 py-1 rounded text-[11px] hover:bg-emerald-700"
                            >
                              Iniciar Separação
                            </button>
                          )}
                          {(ord.status === 'IN_SEPARATION' || ord.status === 'CHECKED') && (
                            <button
                              onClick={() => setActiveOrder(ord)}
                              className="bg-amber-600 text-white font-semibold px-3 py-1 rounded text-[11px] hover:bg-amber-700"
                            >
                              Bipar / Conferir
                            </button>
                          )}
                          {ord.status === 'DISPATCHED' && (
                            <button
                              onClick={() => setActiveOrder(ord)}
                              className="border border-slate-300 text-slate-600 px-3 py-1 rounded text-[11px] hover:bg-slate-50"
                            >
                              Ver Detalhes
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          Nenhum pedido digital encontrado com o filtro selecionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== ABA 2: CHAT WHATSAPP ===================== */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white rounded-lg shadow-sm border border-slate-200 min-h-[500px]">
          {/* Coluna 1: Lista de Conversas */}
          <div className="border-r border-slate-200 p-4 space-y-3">
            <h2 className="text-sm font-bold text-slate-800">Contatos Ativos (WhatsApp)</h2>
            <div className="divide-y divide-slate-100 max-h-[450px] overflow-y-auto">
              {conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleSelectConversation(c)}
                  className={`p-3 rounded cursor-pointer transition-colors ${
                    selectedConv?.id === c.id ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-xs text-slate-800">
                    {c.contact_name || c.contact_phone}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">{c.contact_phone}</div>
                  <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                    Estado: {c.state}
                  </div>
                </div>
              ))}
              {conversations.length === 0 && (
                <div className="text-xs text-slate-400 p-4 text-center">
                  Nenhuma conversa registrada.
                </div>
              )}
            </div>
          </div>

          {/* Coluna 2 e 3: Área de Mensagens e Resposta */}
          <div className="md:col-span-2 p-4 flex flex-col justify-between">
            {selectedConv ? (
              <>
                <div className="border-b border-slate-200 pb-3 mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">
                      {selectedConv.contact_name || selectedConv.contact_phone}
                    </h3>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {selectedConv.contact_phone}
                    </span>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                    Estado: {selectedConv.state}
                  </span>
                </div>

                {/* Balões de Mensagem */}
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[350px] p-2 bg-slate-50/50 rounded border border-slate-100 mb-4">
                  {chatMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] p-3 rounded-lg text-xs ${
                          m.direction === 'OUTBOUND'
                            ? 'bg-emerald-600 text-white rounded-br-none'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                        <span
                          className={`text-[9px] block mt-1 text-right ${
                            m.direction === 'OUTBOUND' ? 'text-emerald-100' : 'text-slate-400'
                          }`}
                        >
                          {m.created_at ? new Date(m.created_at).toLocaleTimeString() : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                  {chatMessages.length === 0 && (
                    <div className="text-xs text-slate-400 text-center p-6">
                      Nenhuma mensagem trocada ainda.
                    </div>
                  )}
                </div>

                {/* Formulário de Resposta Manual */}
                <form onSubmit={handleSendReply} className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border border-slate-300 rounded px-3 py-2 text-xs focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Digite a resposta do farmacêutico..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={loading || !replyText.trim()}
                    className="bg-emerald-600 text-white font-semibold px-4 py-2 rounded text-xs hover:bg-emerald-700"
                  >
                    Enviar Mensagem
                  </button>
                </form>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                Selecione uma conversa ao lado para visualizar as mensagens.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== ABA 3: CONFIGURAÇÃO OPENWA ===================== */}
      {activeTab === 'config' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 max-w-2xl mx-auto space-y-6">
          <h2 className="text-base font-bold text-slate-800 border-b border-slate-200 pb-3">
            Parâmetros do Gateway WhatsApp (OpenWA / WPPConnect)
          </h2>

          <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Servidor Host OpenWA (REST Base URL):
              </label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded px-3 py-2 font-mono text-slate-800 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Ex: http://localhost:8080 ou http://192.168.1.100:8080"
                value={configHost}
                onChange={(e) => setConfigHost(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  ID da Sessão (Session ID):
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 font-mono text-slate-800"
                  placeholder="Ex: farmacia-matriz"
                  value={configSession}
                  onChange={(e) => setConfigSession(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Número WhatsApp da Farmácia:
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 font-mono text-slate-800"
                  placeholder="Ex: 5511999998888"
                  value={configPhone}
                  onChange={(e) => setConfigPhone(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                API Key / Bearer Token (Opcional):
              </label>
              <input
                type="password"
                className="w-full border border-slate-300 rounded px-3 py-2 font-mono text-slate-800"
                placeholder="Chave secreta configurada no servidor OpenWA"
                value={configApiKey}
                onChange={(e) => setConfigApiKey(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="botEnabled"
                checked={configBotEnabled}
                onChange={(e) => setConfigBotEnabled(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="botEnabled" className="font-semibold text-slate-700">
                Ativar Bot de Autoatendimento Farmacêutico 24/7 (Menu Interativo e Catálogo com CMED)
              </label>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 text-white font-bold px-6 py-2.5 rounded text-sm hover:bg-emerald-700 shadow-sm"
              >
                Salvar Configurações do Gateway
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
