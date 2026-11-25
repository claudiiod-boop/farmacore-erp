import React, { useState, useEffect } from 'react';
import {
  MarketplaceChannel,
  MarketplaceCatalogMapping,
  MarketplaceOrder,
  MarketplaceKpis,
  MarketplaceOrderStatus,
  MarketplaceChannelName,
} from '../types/marketplace';
import { marketplaceApi } from '../services/api';

export const MarketplaceHubPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'CATALOG' | 'CHANNELS' | 'SIMULATOR'>('ORDERS');
  const [kpis, setKpis] = useState<MarketplaceKpis | null>(null);
  const [channels, setChannels] = useState<MarketplaceChannel[]>([]);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [catalog, setCatalog] = useState<MarketplaceCatalogMapping[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modais
  const [viewOrder, setViewOrder] = useState<MarketplaceOrder | null>(null);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [newMapping, setNewMapping] = useState({
    productId: '',
    externalSku: '',
    markupPercent: 0,
    customPrice: '',
  });

  // Simulador de Webhook
  const [simChannel, setSimChannel] = useState<MarketplaceChannelName>('IFOOD');
  const [simCustomer, setSimCustomer] = useState('Mariana Albuquerque');
  const [simAddress, setSimAddress] = useState('Av. Paulista, 1500 - Ap 42');
  const [simTotal, setSimTotal] = useState('45.90');

  const loadData = async () => {
    setLoading(true);
    try {
      const [kpiRes, chanRes, ordRes] = await Promise.all([
        marketplaceApi.getKpis(),
        marketplaceApi.getChannels(),
        marketplaceApi.getOrders(1, selectedStatus === 'ALL' ? undefined : selectedStatus, selectedChannelId || undefined),
      ]);
      setKpis(kpiRes);
      setChannels(chanRes || []);
      setOrders(ordRes || []);

      if (chanRes && chanRes.length > 0 && !selectedChannelId) {
        setSelectedChannelId(chanRes[0].id);
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao carregar dados do marketplace' });
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = async (channelId: number) => {
    try {
      const cat = await marketplaceApi.getCatalog(channelId);
      setCatalog(cat || []);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao carregar catálogo' });
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus, selectedChannelId]);

  useEffect(() => {
    if (selectedChannelId && activeTab === 'CATALOG') {
      loadCatalog(selectedChannelId);
    }
  }, [selectedChannelId, activeTab]);

  const handleUpdateStatus = async (orderId: number, newStatus: MarketplaceOrderStatus) => {
    try {
      await marketplaceApi.updateOrderStatus(orderId, newStatus);
      setFeedbackMsg({ type: 'success', text: `Status do pedido atualizado para ${newStatus}` });
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao atualizar status' });
    }
  };

  const handleSyncStock = async () => {
    if (!selectedChannelId) return;
    try {
      const res = await marketplaceApi.syncStock(selectedChannelId);
      setFeedbackMsg({
        type: 'success',
        text: `Estoque sincronizado com sucesso! ${res.syncedCount} itens atualizados com buffer de segurança.`,
      });
      loadCatalog(selectedChannelId);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao sincronizar estoque' });
    }
  };

  const handleMapProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannelId) return;
    try {
      await marketplaceApi.mapCatalog({
        channelId: selectedChannelId,
        productId: Number(newMapping.productId),
        externalSku: newMapping.externalSku,
        markupPercent: Number(newMapping.markupPercent),
        customPrice: newMapping.customPrice ? Number(newMapping.customPrice) : undefined,
      });
      setFeedbackMsg({ type: 'success', text: 'Produto mapeado no catálogo com sucesso!' });
      setIsMapModalOpen(false);
      setNewMapping({ productId: '', externalSku: '', markupPercent: 0, customPrice: '' });
      loadCatalog(selectedChannelId);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao mapear produto' });
    }
  };

  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    const ch = channels.find((c) => c.channel_name === simChannel) || channels[0];
    if (!ch) {
      setFeedbackMsg({ type: 'error', text: 'Nenhum canal ativo cadastrado para este parceiro.' });
      return;
    }

    try {
      const order = await marketplaceApi.simulateWebhook(simChannel, {
        storeId: 1,
        channelId: ch.id,
        externalOrderId: `SIM-${simChannel}-${Date.now().toString().slice(-6)}`,
        displayOrderId: `#${Date.now().toString().slice(-4)}`,
        customerName: simCustomer,
        deliveryAddress: simAddress,
        subtotal: Number(simTotal),
        totalAmount: Number(simTotal),
        items: [
          {
            productId: 1,
            productName: 'Dipirona 500mg Gotas',
            quantity: 1,
            unitPrice: Number(simTotal),
            totalPrice: Number(simTotal),
          },
        ],
      });
      setFeedbackMsg({
        type: 'success',
        text: `Pedido simulado de ${simChannel} recebido com sucesso! ID: ${order.external_order_id}`,
      });
      setActiveTab('ORDERS');
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao disparar webhook simulado' });
    }
  };

  const getChannelBadge = (name: MarketplaceChannelName) => {
    switch (name) {
      case 'IFOOD':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">iFood Farmácias</span>;
      case 'RAPPI':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-800">Rappi</span>;
      case 'FARMACIAS_APP':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">Farmácias APP</span>;
      case 'CONSULTA_REMEDIOS':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">Consulta Remédios</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800">Mercado Livre</span>;
    }
  };

  const getStatusBadge = (status: MarketplaceOrderStatus) => {
    switch (status) {
      case 'PENDING_CONFIRMATION':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800">Aguardando Confirmação</span>;
      case 'CONFIRMED':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">Confirmado</span>;
      case 'PREPARING':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800">Em Separação</span>;
      case 'READY_FOR_PICKUP':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800">Pronto p/ Coleta</span>;
      case 'DISPATCHED':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-cyan-100 text-cyan-800">Despachado / A Caminho</span>;
      case 'DELIVERED':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">Entregue</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-700">Cancelado</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🌐</span> Hub Omnichannel de Marketplaces & Delivery Externo
          </h1>
          <p className="text-sm text-gray-500">
            Integração nativa com iFood Farmácias, Rappi, Farmácias APP & Consulta Remédios com estoque espelhado e buffer anti-ruptura.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('SIMULATOR')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium shadow-sm flex items-center gap-1 text-sm"
          >
            <span>⚡</span> Simular Pedido Webhook
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded text-sm flex justify-between items-center ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs font-bold underline">
            Fechar
          </button>
        </div>
      )}

      {/* KPIS */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Pedidos Totais</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-gray-900">{kpis.totalOrders}</span>
              <span className="text-xs font-medium text-gray-500">pedidos</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Canais integrados</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Em Aberto / Preparo</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-amber-600">{kpis.pendingOrders}</span>
              <span className="text-xs font-medium text-gray-500">pendentes</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Exigem atenção imediata no balcão</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Despachados / Entregues</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-emerald-600">{kpis.dispatchedOrders}</span>
              <span className="text-xs font-medium text-gray-500">concluídos</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Fluxo completo de entrega</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Faturamento Omnichannel</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-extrabold text-blue-600">
                R$ {kpis.totalRevenue.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{kpis.activeChannelsCount} canais conectados</p>
          </div>
        </div>
      )}

      {/* ABAS */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'ORDERS' ? 'border-amber-600 text-amber-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📦 Pedidos em Tempo Real ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('CATALOG')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'CATALOG' ? 'border-amber-600 text-amber-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📑 De-Para de Catálogo & Estoque
          </button>
          <button
            onClick={() => setActiveTab('CHANNELS')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'CHANNELS' ? 'border-amber-600 text-amber-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ⚙️ Canais & Taxas ({channels.length})
          </button>
          <button
            onClick={() => setActiveTab('SIMULATOR')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'SIMULATOR' ? 'border-amber-600 text-amber-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ⚡ Testador de Webhook
          </button>
        </nav>
      </div>

      {/* CONTEÚDO: ABA PEDIDOS */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">Filtrar por Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs border rounded p-1.5 bg-white"
              >
                <option value="ALL">Todos os Status</option>
                <option value="PENDING_CONFIRMATION">Aguardando Confirmação</option>
                <option value="CONFIRMED">Confirmados</option>
                <option value="PREPARING">Em Separação</option>
                <option value="READY_FOR_PICKUP">Prontos p/ Coleta</option>
                <option value="DISPATCHED">Despachados</option>
                <option value="DELIVERED">Entregues</option>
                <option value="CANCELLED">Cancelados</option>
              </select>
            </div>
            <span className="text-xs text-gray-500">Exibindo {orders.length} pedidos</span>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">Canal</th>
                  <th className="px-4 py-3 text-left">Pedido Externo</th>
                  <th className="px-4 py-3 text-left">Cliente / Endereço</th>
                  <th className="px-4 py-3 text-left">Valor Total</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                      Nenhum pedido de marketplace recebido no momento.
                    </td>
                  </tr>
                ) : (
                  orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{ord.channel_name && getChannelBadge(ord.channel_name)}</td>
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-gray-900">{ord.external_order_id}</div>
                        <div className="text-xs text-gray-400">{ord.display_order_id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{ord.customer_name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-xs">{ord.delivery_address}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        R$ {ord.total_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(ord.status)}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={() => setViewOrder(ord)}
                          className="px-2 py-1 text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100 rounded border"
                        >
                          Ver
                        </button>
                        {ord.status === 'PENDING_CONFIRMATION' && (
                          <button
                            onClick={() => handleUpdateStatus(ord.id, 'CONFIRMED')}
                            className="px-2 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                          >
                            Confirmar
                          </button>
                        )}
                        {ord.status === 'CONFIRMED' && (
                          <button
                            onClick={() => handleUpdateStatus(ord.id, 'PREPARING')}
                            className="px-2 py-1 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded"
                          >
                            Separar
                          </button>
                        )}
                        {ord.status === 'PREPARING' && (
                          <button
                            onClick={() => handleUpdateStatus(ord.id, 'READY_FOR_PICKUP')}
                            className="px-2 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded"
                          >
                            Pronto
                          </button>
                        )}
                        {['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(ord.status) && (
                          <button
                            onClick={() => handleUpdateStatus(ord.id, 'DISPATCHED')}
                            className="px-2 py-1 text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 text-white rounded"
                          >
                            Despachar
                          </button>
                        )}
                        {ord.status === 'DISPATCHED' && (
                          <button
                            onClick={() => handleUpdateStatus(ord.id, 'DELIVERED')}
                            className="px-2 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                          >
                            Entregue
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTEÚDO: ABA CATÁLOGO */}
      {activeTab === 'CATALOG' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50 p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-gray-700">Selecione o Canal:</label>
              <select
                value={selectedChannelId || ''}
                onChange={(e) => setSelectedChannelId(Number(e.target.value))}
                className="text-xs border rounded p-2 bg-white"
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.channel_name} (Buffer: {c.stock_buffer_percent}%)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsMapModalOpen(true)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-black text-white text-xs font-semibold rounded"
              >
                + Mapear Produto
              </button>
              <button
                onClick={handleSyncStock}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded flex items-center gap-1"
              >
                <span>🔄</span> Sincronizar Estoque Agora
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">Produto ERP</th>
                  <th className="px-4 py-3 text-left">EAN</th>
                  <th className="px-4 py-3 text-left">SKU Externo</th>
                  <th className="px-4 py-3 text-left">Preço Original</th>
                  <th className="px-4 py-3 text-left">Markup %</th>
                  <th className="px-4 py-3 text-left">Preço no Canal</th>
                  <th className="px-4 py-3 text-left">Estoque Espelhado</th>
                  <th className="px-4 py-3 text-left">Última Sincronia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {catalog.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                      Nenhum produto mapeado para este canal ainda.
                    </td>
                  </tr>
                ) : (
                  catalog.map((cat) => (
                    <tr key={cat.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{cat.product_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{cat.ean}</td>
                      <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold">{cat.external_sku}</td>
                      <td className="px-4 py-3 text-gray-600">R$ {cat.current_price?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-emerald-600 font-bold">+{cat.markup_percent}%</td>
                      <td className="px-4 py-3 font-bold text-gray-900">R$ {cat.calculated_price?.toFixed(2)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">
                        {cat.last_stock_synced} un
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {cat.last_sync_at ? cat.last_sync_at.slice(0, 16) : 'Nunca'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTEÚDO: ABA CANAIS */}
      {activeTab === 'CHANNELS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((ch) => (
            <div key={ch.id} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {getChannelBadge(ch.channel_name)}
                  <span className="font-mono text-xs text-gray-500">ID Loja: {ch.merchant_id || 'Não configurado'}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${ch.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {ch.is_active ? 'Ativo' : 'Pausado'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 bg-gray-50 p-3 rounded">
                <div>
                  <span className="font-semibold block">Comissão da Plataforma:</span>
                  <span className="text-amber-700 font-bold text-sm">{ch.commission_rate}%</span>
                </div>
                <div>
                  <span className="font-semibold block">Estoque de Segurança (Buffer):</span>
                  <span className="text-blue-700 font-bold text-sm">-{ch.stock_buffer_percent}%</span>
                </div>
                <div>
                  <span className="font-semibold block">Confirmação Automática:</span>
                  <span>{ch.auto_confirm_orders ? 'Sim (Imediata)' : 'Manual no Balcão'}</span>
                </div>
                <div>
                  <span className="font-semibold block">Webhook Integrado:</span>
                  <span className="text-emerald-700 font-medium">/api/marketplaces/webhook/{ch.channel_name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CONTEÚDO: ABA SIMULADOR */}
      {activeTab === 'SIMULATOR' && (
        <div className="max-w-xl mx-auto bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>⚡</span> Simulador de Webhook de Ingestão de Pedidos
          </h2>
          <p className="text-xs text-gray-500">
            Dispare um evento simulado de novo pedido externo para testar o fluxo de notificação, reserva e despacho.
          </p>

          <form onSubmit={handleSimulateWebhook} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Canal de Origem</label>
              <select
                value={simChannel}
                onChange={(e) => setSimChannel(e.target.value as MarketplaceChannelName)}
                className="w-full border rounded p-2 text-sm mt-1"
              >
                <option value="IFOOD">iFood Farmácias</option>
                <option value="RAPPI">Rappi</option>
                <option value="FARMACIAS_APP">Farmácias APP</option>
                <option value="CONSULTA_REMEDIOS">Consulta Remédios</option>
                <option value="MERCADO_LIVRE">Mercado Livre</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">Nome do Cliente</label>
              <input
                type="text"
                value={simCustomer}
                onChange={(e) => setSimCustomer(e.target.value)}
                className="w-full border rounded p-2 text-sm mt-1"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">Endereço de Entrega</label>
              <input
                type="text"
                value={simAddress}
                onChange={(e) => setSimAddress(e.target.value)}
                className="w-full border rounded p-2 text-sm mt-1"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">Valor Total (R$)</label>
              <input
                type="number"
                step="0.01"
                value={simTotal}
                onChange={(e) => setSimTotal(e.target.value)}
                className="w-full border rounded p-2 text-sm mt-1"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-sm shadow"
            >
              Disparar Webhook do Marketplace
            </button>
          </form>
        </div>
      )}

      {/* MODAL DETALHES DO PEDIDO */}
      {viewOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="border-b pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-gray-900">DETALHES DO PEDIDO DE MARKETPLACE</h2>
                <p className="text-xs text-gray-500">Origem: {viewOrder.channel_name}</p>
              </div>
              <span className="font-mono font-bold text-sm text-amber-700">{viewOrder.external_order_id}</span>
            </div>

            <div className="text-xs space-y-2 text-gray-700 bg-gray-50 p-3 rounded border">
              <div><strong>Cliente:</strong> {viewOrder.customer_name}</div>
              <div><strong>Telefone:</strong> {viewOrder.customer_phone || 'Não informado'}</div>
              <div><strong>Endereço de Entrega:</strong> {viewOrder.delivery_address}</div>
              <div><strong>Status Atual:</strong> {viewOrder.status}</div>
              <div><strong>Total do Pedido:</strong> R$ {viewOrder.total_amount.toFixed(2)}</div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-bold text-gray-700 uppercase">Itens do Pedido:</h3>
              <div className="max-h-40 overflow-y-auto divide-y border rounded bg-white">
                {viewOrder.items?.map((it, idx) => (
                  <div key={idx} className="p-2 text-xs flex justify-between">
                    <span>{it.quantity}x {it.product_name}</span>
                    <span className="font-semibold">R$ {it.total_price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewOrder(null)}
                className="px-4 py-2 border rounded text-xs text-gray-600 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MAPEAMENTO DE PRODUTO */}
      {isMapModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900">Mapear Produto no Catálogo Externo</h2>
            <form onSubmit={handleMapProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700">ID do Produto no ERP</label>
                <input
                  type="number"
                  data-testid="map-product-id-input"
                  value={newMapping.productId}
                  onChange={(e) => setNewMapping({ ...newMapping, productId: e.target.value })}
                  placeholder="Ex: 1"
                  className="w-full border rounded p-2 text-sm mt-1"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">SKU no Marketplace</label>
                <input
                  type="text"
                  data-testid="map-external-sku-input"
                  value={newMapping.externalSku}
                  onChange={(e) => setNewMapping({ ...newMapping, externalSku: e.target.value })}
                  placeholder="Ex: SKU-IF-1001"
                  className="w-full border rounded p-2 text-sm mt-1"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Markup % (Acréscimo de Margem)</label>
                <input
                  type="number"
                  step="0.1"
                  data-testid="map-markup-input"
                  value={newMapping.markupPercent}
                  onChange={(e) => setNewMapping({ ...newMapping, markupPercent: Number(e.target.value) })}
                  className="w-full border rounded p-2 text-sm mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMapModalOpen(false)}
                  className="px-4 py-2 border rounded text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold"
                >
                  Salvar Mapeamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceHubPage;
