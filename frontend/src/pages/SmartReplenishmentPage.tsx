import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  Package,
  ShoppingCart,
  CheckCircle2,
  Clock,
  Send,
  Plus,
  Filter,
  CheckSquare,
  Square,
  Building2,
  RefreshCw
} from 'lucide-react';
import { replenishmentApi } from '../services/api';
import type {
  ProductStockAnalysis,
  ReplenishmentOrder,
  ReplenishmentKpis,
  StockRuptureStatus
} from '../types';

export const SmartReplenishmentPage: React.FC = () => {
  const [storeId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'SUGGESTIONS' | 'ORDERS'>('SUGGESTIONS');
  const [analysisDays, setAnalysisDays] = useState<number>(30);
  const [statusFilter, setStatusFilter] = useState<StockRuptureStatus | 'ALL'>('ALL');

  const [kpis, setKpis] = useState<ReplenishmentKpis>({
    out_of_stock_count: 0,
    critical_count: 0,
    reorder_needed_count: 0,
    total_suggestions: 0,
    total_estimated_cost: 0,
    active_orders_count: 0,
  });

  const [suggestions, setSuggestions] = useState<ProductStockAnalysis[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [orders, setOrders] = useState<ReplenishmentOrder[]>([]);

  // Checkout do Pedido de Reposição
  const [distributorName, setDistributorName] = useState('Distribuidora Panpharma');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [kpiData, suggList, orderList] = await Promise.all([
        replenishmentApi.getKpis(storeId),
        replenishmentApi.getPurchaseSuggestions(
          storeId,
          analysisDays,
          statusFilter === 'ALL' ? undefined : statusFilter
        ),
        replenishmentApi.listOrders(storeId),
      ]);
      setKpis(kpiData);
      setSuggestions(suggList);
      setOrders(orderList);
    } catch (err) {
      console.error('Erro ao carregar dados de reposição:', err);
    }
  }, [storeId, analysisDays, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleSelectProduct = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === suggestions.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(suggestions.map((s) => s.productId));
    }
  };

  const handleCreateOrder = async () => {
    const selectedItems = suggestions.filter((s) => selectedProductIds.includes(s.productId));
    if (selectedItems.length === 0) {
      alert('Selecione ao menos um produto da lista para gerar o pedido.');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      await replenishmentApi.createOrder({
        storeId,
        distributorName,
        notes: orderNotes || undefined,
        items: selectedItems.map((it) => ({
          productId: it.productId,
          orderQuantity: it.suggestedQuantity,
          unitCost: it.unitCost,
          suggestedQuantity: it.suggestedQuantity,
          currentStock: it.currentStock,
          reorderPoint: it.reorderPoint,
        })),
      });

      alert(`Pedido de reposição criado com sucesso com ${selectedItems.length} itens!`);
      setSelectedProductIds([]);
      setActiveTab('ORDERS');
      await loadData();
    } catch (err: any) {
      alert(`Erro ao criar pedido: ${err.message}`);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      await replenishmentApi.updateOrderStatus(orderId, status);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao atualizar status do pedido: ${err.message}`);
    }
  };

  const selectedTotalCost = suggestions
    .filter((s) => selectedProductIds.includes(s.productId))
    .reduce((acc, curr) => acc + curr.estimatedCost, 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Header Reposição */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-900/30">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              Reposição Inteligente & Ponto de Pedido
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                Prevenção de Ruptura & Curva ABC
              </span>
            </h1>
            <p className="text-xs text-slate-400">Motor Preditivo de Demanda Diária, Estoque de Segurança e Lead Time</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recalcular Demanda
          </button>
        </div>
      </div>

      {/* Grid de KPIs de Ruptura */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-6 pb-2">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            Em Ruptura (Zerado)
          </span>
          <div className="text-2xl font-black text-rose-400 mt-1" data-testid="kpi-out-of-stock">
            {kpis.out_of_stock_count}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Nível Crítico
          </span>
          <div className="text-2xl font-black text-amber-400 mt-1" data-testid="kpi-critical">
            {kpis.critical_count}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-yellow-400 font-medium">Requer Pedido (PP)</span>
          <div className="text-2xl font-black text-yellow-400 mt-1" data-testid="kpi-reorder-needed">
            {kpis.reorder_needed_count}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Total Sugestões</span>
          <div className="text-2xl font-black text-white mt-1" data-testid="kpi-total-suggestions">
            {kpis.total_suggestions}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-emerald-400 font-medium">Valor Reposição</span>
          <div className="text-2xl font-black text-emerald-400 mt-1 font-mono" data-testid="kpi-estimated-cost">
            R$ {kpis.total_estimated_cost.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Botoeira de Abas */}
      <div className="px-6 pt-4 flex gap-2 border-b border-slate-800">
        <button
          data-testid="tab-suggestions-button"
          onClick={() => setActiveTab('SUGGESTIONS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'SUGGESTIONS'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Sugestões de Compra ({suggestions.length})
        </button>
        <button
          data-testid="tab-orders-button"
          onClick={() => setActiveTab('ORDERS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'ORDERS'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Pedidos de Reposição Gerados ({orders.length})
        </button>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* ===================== ABA 1: SUGESTÕES DE COMPRA ===================== */}
        {activeTab === 'SUGGESTIONS' && (
          <div className="space-y-4">
            {/* Barra de Filtros */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400 font-semibold">Status de Ruptura:</span>
                <select
                  data-testid="filter-status-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white outline-none"
                >
                  <option value="ALL">Todos os Níveis de Risco</option>
                  <option value="OUT_OF_STOCK">Apenas Ruptura (Zerado)</option>
                  <option value="CRITICAL">Apenas Nível Crítico</option>
                  <option value="REORDER_NEEDED">Abaixo do Ponto de Pedido</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold">Histórico de Análise:</span>
                <select
                  data-testid="filter-days-select"
                  value={analysisDays}
                  onChange={(e) => setAnalysisDays(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white outline-none"
                >
                  <option value={30}>Últimos 30 Dias</option>
                  <option value={60}>Últimos 60 Dias</option>
                  <option value={90}>Últimos 90 Dias</option>
                </select>
              </div>
            </div>

            {/* Tabela de Sugestões */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto max-h-[50vh]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-700 sticky top-0 z-10 backdrop-blur-md">
                      <th className="py-2.5 px-3 w-10 text-center">
                        <button onClick={toggleSelectAll} className="text-slate-300 hover:text-white">
                          {selectedProductIds.length === suggestions.length && suggestions.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                      </th>
                      <th className="py-2.5 px-3">Medicamento / EAN</th>
                      <th className="py-2.5 px-3 text-center">Curva ABC</th>
                      <th className="py-2.5 px-3 text-right">Demanda/Dia</th>
                      <th className="py-2.5 px-3 text-right">Estoque Atual</th>
                      <th className="py-2.5 px-3 text-right">Ponto Pedido</th>
                      <th className="py-2.5 px-3 text-right">Cobertura</th>
                      <th className="py-2.5 px-3 text-right text-emerald-400 font-bold">Qtd Sugerida</th>
                      <th className="py-2.5 px-3 text-right">Custo Est.</th>
                      <th className="py-2.5 px-3 text-center">Risco</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {suggestions.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-500">
                          Nenhum produto necessita de reposição no momento.
                        </td>
                      </tr>
                    ) : (
                      suggestions.map((s) => {
                        const isSelected = selectedProductIds.includes(s.productId);
                        return (
                          <tr
                            key={s.productId}
                            data-testid={`row-suggestion-${s.productId}`}
                            onClick={() => toggleSelectProduct(s.productId)}
                            className={`cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                                : 'hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400 inline" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600 inline" />
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-white line-clamp-1">{s.productName}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{s.ean}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  s.abcClass === 'A'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : s.abcClass === 'B'
                                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                Curva {s.abcClass}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">{s.dailyDemand} un</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                              {s.currentStock}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-400">{s.reorderPoint}</td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              <span
                                className={
                                  s.daysOfCover <= 2
                                    ? 'text-rose-400 font-bold'
                                    : s.daysOfCover <= 5
                                    ? 'text-amber-400'
                                    : 'text-slate-400'
                                }
                              >
                                {s.daysOfCover >= 900 ? '∞' : `${s.daysOfCover}d`}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                              {s.suggestedQuantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                              R$ {s.estimatedCost.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  s.status === 'OUT_OF_STOCK'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : s.status === 'CRITICAL'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                }`}
                              >
                                {s.status === 'OUT_OF_STOCK'
                                  ? 'Ruptura'
                                  : s.status === 'CRITICAL'
                                  ? 'Crítico'
                                  : 'Pedir'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Barra Flutuante de Geração de Pedido */}
              <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">
                    Selecionados:{' '}
                    <span className="text-white font-bold font-mono">{selectedProductIds.length} itens</span>
                  </span>
                  <span className="text-slate-400">
                    Total Estimado:{' '}
                    <span className="text-emerald-400 font-bold font-mono text-sm">
                      R$ {selectedTotalCost.toFixed(2)}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <input
                    type="text"
                    data-testid="distributor-name-input"
                    value={distributorName}
                    onChange={(e) => setDistributorName(e.target.value)}
                    placeholder="Nome da Distribuidora"
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none flex-1 sm:w-60"
                  />
                  <button
                    data-testid="generate-order-button"
                    onClick={handleCreateOrder}
                    disabled={selectedProductIds.length === 0 || isSubmittingOrder}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      selectedProductIds.length > 0 && !isSubmittingOrder
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-lg shadow-emerald-900/30'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    Gerar Pedido de Reposição
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== ABA 2: PEDIDOS GERADOS ===================== */}
        {activeTab === 'ORDERS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              Histórico de Pedidos de Compras
            </h2>

            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
                    <th className="py-2.5 px-4">Nº Pedido</th>
                    <th className="py-2.5 px-4">Distribuidora</th>
                    <th className="py-2.5 px-4">Data</th>
                    <th className="py-2.5 px-4 text-center">Itens</th>
                    <th className="py-2.5 px-4 text-right">Valor Estimado</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Nenhum pedido de compra gerado.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-800/40 font-mono">
                        <td className="py-3 px-4 font-bold text-white">#PED-{o.id}</td>
                        <td className="py-3 px-4 font-sans text-white">{o.distributor_name || 'Geral'}</td>
                        <td className="py-3 px-4 text-slate-400">{o.created_at.substring(0, 10)}</td>
                        <td className="py-3 px-4 text-center text-slate-300">{o.total_items}</td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-bold">
                          R$ {o.estimated_total.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              o.status === 'SUBMITTED'
                                ? 'bg-sky-500/20 text-sky-300'
                                : o.status === 'RECEIVED'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-sans space-x-2">
                          {o.status === 'DRAFT' && (
                            <button
                              data-testid={`submit-order-${o.id}`}
                              onClick={() => handleUpdateOrderStatus(o.id, 'SUBMITTED')}
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-bold transition-all"
                            >
                              Enviar
                            </button>
                          )}
                          {o.status === 'SUBMITTED' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(o.id, 'RECEIVED')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold transition-all"
                            >
                              Receber
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
      </div>
    </div>
  );
};

export default SmartReplenishmentPage;
