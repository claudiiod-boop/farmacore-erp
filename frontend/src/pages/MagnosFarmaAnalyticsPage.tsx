import React, { useState, useEffect, useCallback } from 'react';
import { analyticsApi } from '../services/api';
import type {
  LiveAnalyticsSummary,
  WhatsAppQuotation,
  WhatsAppQuotationItemDTO,
} from '../types/analytics';

export const MagnosFarmaAnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'WHATSAPP'>('DASHBOARD');
  const [summary, setSummary] = useState<LiveAnalyticsSummary | null>(null);
  const [quotations, setQuotations] = useState<WhatsAppQuotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal Novo Orçamento WhatsApp
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [attendantName, setAttendantName] = useState('Balconista');
  const [discountBrl, setDiscountBrl] = useState('0.00');
  const [items, setItems] = useState<WhatsAppQuotationItemDTO[]>([
    { product_id: 1, product_name: 'Dipirona 500mg 10cp', quantity: 2, unit_price_brl: 8.5 },
  ]);

  // Modal Visualizar / Compartilhar WhatsApp
  const [activeQuotation, setActiveQuotation] = useState<WhatsAppQuotation | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, quotesRes] = await Promise.all([
        analyticsApi.getLive(1),
        analyticsApi.listWhatsAppQuotations(1, 50),
      ]);
      setSummary(analyticsRes);
      setQuotations(quotesRes);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar dados do Analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { product_id: Date.now(), product_name: '', quantity: 1, unit_price_brl: 0 },
    ]);
  };

  const handleUpdateItem = (index: number, field: keyof WhatsAppQuotationItemDTO, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await analyticsApi.createWhatsAppQuotation({
        store_id: 1,
        customer_name: customerName,
        customer_phone: customerPhone,
        attendant_name: attendantName,
        items,
        discount_brl: Number(discountBrl) || 0,
      });

      setSuccessMsg('Orçamento gerado com sucesso para WhatsApp!');
      setIsQuotationModalOpen(false);
      setActiveQuotation(res);
      setCustomerName('');
      setCustomerPhone('');
      setDiscountBrl('0.00');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar orçamento');
    }
  };

  const handleConvertQuotation = async (id: number) => {
    try {
      await analyticsApi.updateQuotationStatus(id, 'CONVERTED');
      setSuccessMsg('Orçamento marcado como CONVERTIDO / VENDA REALIZADA! 🎉');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar status');
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6" data-testid="magnos-farma-analytics-page">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 text-white p-6 rounded-lg shadow border-l-4 border-emerald-500">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="p-2 bg-emerald-500 text-slate-950 rounded-md font-black">📊</span>
            Magnos Farma Analytics & Inteligência Operacional
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            Dashboard Executivo em Tempo Real integrado ao <strong>InovaFarma</strong> & Motor de <strong>Orçamentos via WhatsApp</strong>.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <button
            onClick={() => setIsQuotationModalOpen(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg shadow flex items-center gap-1.5 text-sm"
            data-testid="btn-open-quote-modal"
          >
            💬 Novo Orçamento WhatsApp
          </button>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm font-semibold flex items-center gap-1"
            data-testid="btn-refresh-analytics"
          >
            🔄 Atualizar Dados
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex justify-between items-center" data-testid="alert-error">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex justify-between items-center" data-testid="alert-success">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold">×</button>
        </div>
      )}

      {/* KPIs Executivos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Caixa Positivo Dia */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-150">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Caixa Positivo Hoje</p>
          <p className="text-2xl font-black text-emerald-600 mt-1" data-testid="kpi-today-sales">
            R$ {summary?.todaySalesBrl?.toFixed(2) || '0.00'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {summary?.todayReceiptsCount || 0} cupons emitidos | Ticket: R$ {summary?.todayAverageTicketBrl?.toFixed(2) || '0.00'}
          </p>
        </div>

        {/* Faturamento Acumulado Mês */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-150">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Faturamento Mês Atual</p>
          <p className="text-2xl font-black text-blue-600 mt-1" data-testid="kpi-month-sales">
            R$ {summary?.monthSalesBrl?.toFixed(2) || '0.00'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {summary?.monthReceiptsCount || 0} cupons | Ticket: R$ {summary?.monthAverageTicketBrl?.toFixed(2) || '0.00'}
          </p>
        </div>

        {/* Meta & Projeção */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-150">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Meta Mensal & Projeção</p>
          <p className="text-2xl font-black text-purple-600 mt-1" data-testid="kpi-month-projection">
            R$ {summary?.monthProjectedSalesBrl?.toFixed(2) || '0.00'}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-purple-600 h-2 rounded-full"
              style={{ width: `${Math.min(100, summary?.monthTargetAchievementPct || 0)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {summary?.monthTargetAchievementPct || 0}% da meta de R$ {summary?.monthTargetBrl?.toFixed(2)}
          </p>
        </div>

        {/* Descontos Concedidos */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-150">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Descontos no Mês</p>
          <p className="text-2xl font-black text-amber-600 mt-1" data-testid="kpi-month-discount">
            R$ {summary?.monthTotalDiscountBrl?.toFixed(2) || '0.00'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Média de {summary?.monthAverageDiscountPct || 0}% de desconto sobre vendas brutas
          </p>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('DASHBOARD')}
          className={`py-3 px-6 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'DASHBOARD'
              ? 'border-emerald-600 text-emerald-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          data-testid="tab-dashboard"
        >
          Visão Executiva & Balcão
        </button>
        <button
          onClick={() => setActiveTab('WHATSAPP')}
          className={`py-3 px-6 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'WHATSAPP'
              ? 'border-emerald-600 text-emerald-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          data-testid="tab-whatsapp"
        >
          Orçamentos WhatsApp ({quotations.length})
        </button>
      </div>

      {/* Aba 1: Dashboard Executivo */}
      {activeTab === 'DASHBOARD' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Vendas por Hora Hoje */}
            <div className="bg-white p-5 rounded-lg shadow">
              <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                <span>⏱️</span> Vendas por Hora Hoje (Fluxo no Balcão)
              </h2>
              <div className="h-44 flex items-end gap-1.5 border-b border-gray-200 pb-2">
                {summary?.hourlyDistribution?.map((h) => {
                  const maxAmount = Math.max(...(summary?.hourlyDistribution?.map((x) => x.totalAmountBrl) || [1]), 100);
                  const heightPct = Math.min(100, Math.max(8, (h.totalAmountBrl / maxAmount) * 100));
                  return (
                    <div key={h.hour} className="flex-1 flex flex-col items-center group relative">
                      <div
                        className="w-full bg-emerald-500 rounded-t group-hover:bg-emerald-600 transition-all cursor-pointer"
                        style={{ height: `${heightPct}%` }}
                        title={`${h.hour}h: R$ ${h.totalAmountBrl.toFixed(2)} (${h.customersCount} atendimentos)`}
                      />
                      <span className="text-[10px] text-gray-500 mt-1">{h.hour}h</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mix de Categorias */}
            <div className="bg-white p-5 rounded-lg shadow">
              <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                <span>🏷️</span> Mix de Vendas por Categoria (Mês)
              </h2>
              <div className="space-y-3">
                {summary?.categoryDistribution?.length === 0 ? (
                  <p className="text-gray-500 text-sm py-8 text-center">Nenhuma venda categorizada no mês.</p>
                ) : (
                  summary?.categoryDistribution?.map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-gray-700">
                        <span>{cat.category}</span>
                        <span>R$ {cat.totalBrl.toFixed(2)} ({cat.percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min(100, cat.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ranking de Balconistas */}
            <div className="bg-white p-5 rounded-lg shadow">
              <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                <span>🏆</span> Ranking de Balconistas (Mês)
              </h2>
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="text-left py-2">Balconista</th>
                    <th className="text-center py-2">Atend.</th>
                    <th className="text-right py-2">Total (R$)</th>
                    <th className="text-right py-2">Ticket Médio</th>
                    <th className="text-right py-2">Meta (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary?.employeePerformance?.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-gray-50" data-testid={`employee-row-${emp.employeeId}`}>
                      <td className="py-2.5 font-bold text-gray-800">{emp.employeeName}</td>
                      <td className="py-2.5 text-center text-gray-600">{emp.customersServed}</td>
                      <td className="py-2.5 text-right font-black text-emerald-600">R$ {emp.totalSalesBrl.toFixed(2)}</td>
                      <td className="py-2.5 text-right text-gray-600">R$ {emp.averageTicketBrl.toFixed(2)}</td>
                      <td className="py-2.5 text-right font-bold text-purple-600">{emp.targetAchievementPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Top 10 Produtos Mais Vendidos */}
            <div className="bg-white p-5 rounded-lg shadow">
              <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                <span>📦</span> Top 10 Produtos Mais Vendidos (Mês)
              </h2>
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="text-left py-2">Produto</th>
                    <th className="text-center py-2">Categoria</th>
                    <th className="text-center py-2">Qtd</th>
                    <th className="text-right py-2">Faturamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary?.topProducts?.map((tp) => (
                    <tr key={tp.productId} className="hover:bg-gray-50">
                      <td className="py-2.5 font-semibold text-gray-800">{tp.productName}</td>
                      <td className="py-2.5 text-center text-gray-500">{tp.category}</td>
                      <td className="py-2.5 text-center font-bold text-blue-600">{tp.quantitySold} un</td>
                      <td className="py-2.5 text-right font-black text-emerald-600">R$ {tp.totalBrl.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Aba 2: Orçamentos WhatsApp */}
      {activeTab === 'WHATSAPP' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Cliente</th>
                <th className="px-6 py-3 text-left">Telefone</th>
                <th className="px-6 py-3 text-left">Atendente</th>
                <th className="px-6 py-3 text-right">Valor Total</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-center">Validade</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Nenhum orçamento para WhatsApp cadastrado ainda.
                  </td>
                </tr>
              ) : (
                quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50" data-testid={`quotation-row-${q.id}`}>
                    <td className="px-6 py-4 font-bold text-gray-900">{q.customer_name}</td>
                    <td className="px-6 py-4 text-gray-600">{q.customer_phone}</td>
                    <td className="px-6 py-4 text-gray-600">{q.attendant_name}</td>
                    <td className="px-6 py-4 text-right font-black text-emerald-600">R$ {q.total_brl.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                        q.status === 'CONVERTED'
                          ? 'bg-green-100 text-green-800'
                          : q.status === 'OPEN'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-xs text-gray-500">{q.valid_until}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setActiveQuotation(q)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded"
                        data-testid={`btn-view-quote-${q.id}`}
                      >
                        📱 Enviar / Ver
                      </button>
                      {q.status !== 'CONVERTED' && (
                        <button
                          onClick={() => handleConvertQuotation(q.id)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded"
                          data-testid={`btn-convert-quote-${q.id}`}
                        >
                          ✅ Converter Venda
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Criar Orçamento WhatsApp */}
      {isQuotationModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800">Criar Novo Orçamento via WhatsApp</h2>
            <form onSubmit={handleCreateQuotation} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Nome do Cliente</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full border rounded p-2 text-sm"
                    placeholder="ex: Dona Maria"
                    data-testid="input-quote-name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600">WhatsApp / Celular</label>
                  <input
                    type="text"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full border rounded p-2 text-sm"
                    placeholder="11988887777"
                    data-testid="input-quote-phone"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Atendente</label>
                  <input
                    type="text"
                    required
                    value={attendantName}
                    onChange={(e) => setAttendantName(e.target.value)}
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Desconto Especial (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={discountBrl}
                    onChange={(e) => setDiscountBrl(e.target.value)}
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
              </div>

              {/* Itens do Orçamento */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-gray-700">Produtos a Orçar</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                  >
                    + Adicionar Item
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        required
                        value={it.product_name}
                        onChange={(e) => handleUpdateItem(idx, 'product_name', e.target.value)}
                        placeholder="Nome do produto / dosagem"
                        className="flex-1 border rounded p-1.5 text-xs"
                        data-testid={`input-quote-item-name-${idx}`}
                      />
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                        className="w-16 border rounded p-1.5 text-xs text-center"
                        title="Quantidade"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.unit_price_brl}
                        onChange={(e) => handleUpdateItem(idx, 'unit_price_brl', Number(e.target.value))}
                        className="w-20 border rounded p-1.5 text-xs text-right"
                        title="Preço unitário"
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-500 font-bold px-2"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsQuotationModalOpen(false)}
                  className="px-4 py-2 border rounded text-gray-600 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-bold"
                  data-testid="btn-submit-quotation"
                >
                  Gerar Mensagem WhatsApp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pré-visualização & Disparo WhatsApp */}
      {activeQuotation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4" data-testid="active-quote-modal">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="p-1.5 bg-green-500 text-white rounded text-sm">💬</span>
              Orçamento WhatsApp Formatado
            </h2>
            <div className="bg-emerald-50 border border-emerald-200 rounded p-4 text-xs font-mono text-gray-800 whitespace-pre-wrap max-h-72 overflow-y-auto">
              {activeQuotation.whatsapp_message_payload}
            </div>
            <div className="flex justify-between items-center pt-3 border-t">
              <button
                type="button"
                onClick={() => setActiveQuotation(null)}
                className="px-4 py-2 border rounded text-gray-600 text-sm"
              >
                Fechar
              </button>
              {activeQuotation.whatsapp_url && (
                <a
                  href={activeQuotation.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-bold flex items-center gap-1.5"
                  data-testid="btn-open-wa-link"
                >
                  🚀 Abrir WhatsApp Agora
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MagnosFarmaAnalyticsPage;
