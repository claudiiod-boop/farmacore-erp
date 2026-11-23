import React, { useState, useEffect } from 'react';
import {
  b2bApi,
  type B2bSupplier,
  type ReplenishmentSuggestion,
  type B2bQuotationCampaign,
  type QuotationOptimizationResult,
  type EdiExportResponse,
} from '../services/api';

type Tab = 'replenishment' | 'campaigns' | 'optimizer' | 'edi' | 'suppliers';

export const B2bQuotationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('replenishment');
  const [suggestions, setSuggestions] = useState<ReplenishmentSuggestion[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [campaigns, setCampaigns] = useState<B2bQuotationCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<B2bQuotationCampaign | null>(null);
  const [suppliers, setSuppliers] = useState<B2bSupplier[]>([]);
  const [optimizationResult, setOptimizationResult] = useState<QuotationOptimizationResult | null>(null);
  const [ediModal, setEdiModal] = useState<EdiExportResponse | null>(null);

  // Loading & Feedback
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State: Nova Campanha
  const [newCampaignTitle, setNewCampaignTitle] = useState('Cotação Semanal de Reposição');

  // Form State: Importação EDI
  const [importCampaignId, setImportCampaignId] = useState<number>(0);
  const [importSupplierId, setImportSupplierId] = useState<number>(0);
  const [ediInputText, setEdiInputText] = useState('');

  // Form State: Novo Fornecedor
  const [suppCode, setSuppCode] = useState('');
  const [suppName, setSuppName] = useState('');
  const [suppTradeName, setSuppTradeName] = useState('');
  const [suppCnpj, setSuppCnpj] = useState('');
  const [suppMinOrder, setSuppMinOrder] = useState('300.00');
  const [suppLeadTime, setSuppLeadTime] = useState('1');
  const [suppPaymentTerms, setSuppPaymentTerms] = useState('28 DDL');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const sugg = await b2bApi.getReplenishmentSuggestions(1);
      setSuggestions(sugg);
      const camps = await b2bApi.listCampaigns(1);
      setCampaigns(camps);
      if (camps.length > 0) {
        setImportCampaignId(camps[0].id || 0);
      }
      const supps = await b2bApi.getSuppliers();
      setSuppliers(supps);
      if (supps.length > 0) {
        setImportSupplierId(supps[0].id || 0);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = (productId: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleSelectAllCritical = () => {
    const critical = suggestions
      .filter((s) => s.ruptureRisk === 'HIGH' || s.ruptureRisk === 'MEDIUM')
      .map((s) => s.productId);
    setSelectedProductIds(critical);
  };

  // Criar Campanha a partir das sugestões selecionadas
  const handleCreateCampaignFromSelected = async () => {
    if (selectedProductIds.length === 0) {
      setMessage({ type: 'error', text: 'Selecione ao menos um produto para cotar.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      const selectedItems = suggestions
        .filter((s) => selectedProductIds.includes(s.productId))
        .map((s) => ({
          productId: s.productId,
          currentStock: s.currentStock,
          suggestedQuantity: s.suggestedQuantity,
          requestedQuantity: s.suggestedQuantity,
          targetPrice: s.currentCost,
        }));

      const created = await b2bApi.createCampaign({
        storeId: 1,
        title: newCampaignTitle || 'Cotação de Reposição',
        items: selectedItems,
      });

      setMessage({
        type: 'success',
        text: `Campanha ${created.campaignCode} criada com ${created.items?.length || 0} itens!`,
      });
      setSelectedProductIds([]);
      await loadData();
      setSelectedCampaign(created);
      setActiveTab('campaigns');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao criar campanha de cotação' });
    } finally {
      setLoading(false);
    }
  };

  // Abrir detalhes de uma campanha
  const handleOpenCampaignDetails = async (id: number) => {
    try {
      setLoading(true);
      const camp = await b2bApi.getCampaign(id);
      setSelectedCampaign(camp);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao carregar detalhes da campanha' });
    } finally {
      setLoading(false);
    }
  };

  // Exportar Espelho de Cotação EDI Farma
  const handleExportEdi = async (campaignId: number) => {
    try {
      setLoading(true);
      const ediRes = await b2bApi.exportEdiQuotation(campaignId);
      setEdiModal(ediRes);
      setMessage({
        type: 'success',
        text: `Arquivo EDI de cotação gerado com sucesso: ${ediRes.fileName}`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao exportar arquivo EDI' });
    } finally {
      setLoading(false);
    }
  };

  // Otimizar Cotação (Split Order vs Pedido Fechado)
  const handleOptimize = async (mode: 'SPLIT_ORDER' | 'SINGLE_SUPPLIER_BEST_TOTAL') => {
    if (!selectedCampaign?.id) return;
    try {
      setLoading(true);
      setMessage(null);
      const res = await b2bApi.optimizeCampaign(selectedCampaign.id, mode);
      setOptimizationResult(res);
      const updated = await b2bApi.getCampaign(selectedCampaign.id);
      setSelectedCampaign(updated);
      setActiveTab('optimizer');
      setMessage({
        type: 'success',
        text: `Otimização concluída (${mode === 'SPLIT_ORDER' ? 'Split Order' : 'Melhor Total'}). Economia: R$ ${res.totalCampaignSavings.toFixed(2)}`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao otimizar cotação' });
    } finally {
      setLoading(false);
    }
  };

  // Importar Resposta EDI
  const handleImportEdi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ediInputText.trim()) {
      setMessage({ type: 'error', text: 'Cole o conteúdo do arquivo EDI retornado pela distribuidora.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      await b2bApi.importEdiProposals(importCampaignId, {
        ediContent: ediInputText,
        supplierId: importSupplierId || undefined,
      });

      setMessage({ type: 'success', text: 'Proposta comercial EDI importada e vinculada com sucesso!' });
      setEdiInputText('');
      await loadData();
      if (selectedCampaign?.id === importCampaignId) {
        handleOpenCampaignDetails(importCampaignId);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao importar proposta EDI' });
    } finally {
      setLoading(false);
    }
  };

  // Gerar Pedidos de Compra Oficiais
  const handleGenerateOrders = async () => {
    if (!selectedCampaign?.id) return;
    try {
      setLoading(true);
      setMessage(null);
      const res = await b2bApi.generatePurchaseOrders(selectedCampaign.id);
      setMessage({ type: 'success', text: res.message });
      await loadData();
      handleOpenCampaignDetails(selectedCampaign.id);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao gerar pedidos de compra' });
    } finally {
      setLoading(false);
    }
  };

  // Cadastrar Distribuidora
  const handleRegisterSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppCode.trim() || !suppName.trim() || !suppCnpj.trim()) {
      setMessage({ type: 'error', text: 'Preencha código, nome e CNPJ da distribuidora.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      await b2bApi.registerSupplier({
        code: suppCode,
        name: suppName,
        tradeName: suppTradeName || undefined,
        cnpj: suppCnpj,
        minOrderValue: suppMinOrder ? Number(suppMinOrder) : 0,
        leadTimeDays: suppLeadTime ? Number(suppLeadTime) : 1,
        paymentTerms: suppPaymentTerms || '28 DDL',
      });

      setMessage({ type: 'success', text: `Distribuidora ${suppName} cadastrada com sucesso!` });
      setSuppCode('');
      setSuppName('');
      setSuppTradeName('');
      setSuppCnpj('');
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao cadastrar distribuidora' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header do Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Cotação B2B & Reposição Inteligente</h1>
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-300">
              EDI Farma & Split Order
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Ponto de Pedido por giro (CMD), integração com distribuidoras farmacêuticas (Santa Cruz, Panpharma, Profarma, GAM) e otimizador de menor preço item a item.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded border border-slate-300"
          >
            Atualizar Dados
          </button>
        </div>
      </div>

      {/* Alerta de Mensagem */}
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

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('replenishment')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'replenishment'
              ? 'border-blue-600 text-blue-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          1. Sugestões de Reposição (Ponto de Pedido)
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'campaigns'
              ? 'border-blue-600 text-blue-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          2. Campanhas de Cotação Ativas
        </button>
        <button
          onClick={() => setActiveTab('optimizer')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'optimizer'
              ? 'border-blue-600 text-blue-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          3. Comparador Split Order
        </button>
        <button
          onClick={() => setActiveTab('edi')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'edi'
              ? 'border-blue-600 text-blue-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          4. Central EDI Farma (Retorno)
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'suppliers'
              ? 'border-blue-600 text-blue-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          5. Cadastro de Distribuidoras
        </button>
      </div>

      {/* Conteúdo Aba 1: Sugestões de Reposição */}
      {activeTab === 'replenishment' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Produtos Abaixo do Ponto de Pedido (PP)</h2>
              <p className="text-xs text-slate-500">
                Calculado com base no giro médio diário dos últimos 30 dias, lead time da distribuidora e estoque de segurança.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                className="text-xs border border-slate-300 rounded px-2.5 py-1.5 w-60"
                placeholder="Título da cotação..."
                value={newCampaignTitle}
                onChange={(e) => setNewCampaignTitle(e.target.value)}
              />
              <button
                onClick={handleSelectAllCritical}
                className="text-xs bg-slate-100 text-slate-700 font-semibold px-3 py-1.5 rounded hover:bg-slate-200 border border-slate-300"
              >
                Selecionar Ruptura Imediata
              </button>
              <button
                onClick={handleCreateCampaignFromSelected}
                disabled={selectedProductIds.length === 0 || loading}
                className="text-xs bg-blue-600 text-white font-bold px-4 py-2 rounded hover:bg-blue-700 shadow-sm disabled:opacity-50"
              >
                Criar Cotação com {selectedProductIds.length} Itens
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                  <th className="p-3 w-10">Sel.</th>
                  <th className="p-3">EAN</th>
                  <th className="p-3">Medicamento / Produto</th>
                  <th className="p-3">Curva</th>
                  <th className="p-3 text-right">Estoque</th>
                  <th className="p-3 text-right">CMD (un/dia)</th>
                  <th className="p-3 text-right">Ponto Pedido</th>
                  <th className="p-3 text-center">Risco Ruptura</th>
                  <th className="p-3 text-right">Qtd Sugerida</th>
                  <th className="p-3 text-right">Custo Estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suggestions.map((item) => (
                  <tr key={item.productId} className="hover:bg-slate-50">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(item.productId)}
                        onChange={() => handleSelectProduct(item.productId)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-3 font-mono text-slate-600">{item.ean}</td>
                    <td className="p-3 font-medium text-slate-800">{item.productName}</td>
                    <td className="p-3">
                      <span className="font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                        {item.abcClass}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-slate-800">{item.currentStock}</td>
                    <td className="p-3 text-right text-slate-600">{item.averageDailySales}</td>
                    <td className="p-3 text-right font-medium text-slate-700">{item.reorderPoint}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          item.ruptureRisk === 'HIGH'
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : item.ruptureRisk === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.ruptureRisk}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-blue-700">{item.suggestedQuantity}</td>
                    <td className="p-3 text-right text-slate-700 font-mono">
                      R$ {((item.suggestedQuantity * (item.currentCost || 0))).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {suggestions.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-4 text-center text-slate-400">
                      Nenhum item abaixo do ponto de pedido no momento. Estoque balanceado!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conteúdo Aba 2: Campanhas de Cotação Ativas */}
      {activeTab === 'campaigns' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Lista de Campanhas */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-base font-bold text-slate-800">Campanhas de Cotação</h2>
            <div className="space-y-2">
              {campaigns.map((camp) => (
                <div
                  key={camp.id}
                  onClick={() => handleOpenCampaignDetails(camp.id!)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedCampaign?.id === camp.id
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-xs text-blue-700">{camp.campaignCode}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        camp.status === 'CLOSED'
                          ? 'bg-slate-100 text-slate-600'
                          : camp.status === 'ANALYZED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {camp.status}
                    </span>
                  </div>
                  <div className="font-medium text-sm text-slate-800 mt-1">{camp.title}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{camp.createdAt?.substring(0, 16)}</div>
                </div>
              ))}
              {campaigns.length === 0 && (
                <div className="text-xs text-slate-400 text-center py-6">
                  Nenhuma campanha de cotação criada ainda.
                </div>
              )}
            </div>
          </div>

          {/* Detalhes da Campanha Selecionada */}
          <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
            {selectedCampaign ? (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">{selectedCampaign.title}</h3>
                    <div className="text-xs text-slate-500 font-mono">
                      Código: {selectedCampaign.campaignCode} | Itens: {selectedCampaign.items?.length || 0} | Propostas:{' '}
                      {selectedCampaign.proposals?.length || 0}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExportEdi(selectedCampaign.id!)}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded border border-slate-300"
                    >
                      Exportar Espelho EDI (.txt)
                    </button>
                    <button
                      onClick={() => handleOptimize('SPLIT_ORDER')}
                      disabled={loading || (selectedCampaign.proposals?.length || 0) === 0}
                      className="text-xs bg-blue-600 text-white font-bold px-3 py-1.5 rounded hover:bg-blue-700 shadow-sm disabled:opacity-50"
                    >
                      Otimizar Split Order
                    </button>
                    <button
                      onClick={handleGenerateOrders}
                      disabled={loading || selectedCampaign.status !== 'ANALYZED'}
                      className="text-xs bg-emerald-600 text-white font-bold px-3 py-1.5 rounded hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                    >
                      Gerar Pedidos
                    </button>
                  </div>
                </div>

                {/* Itens da Campanha */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Itens Solicitados na Cotação</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                          <th className="p-2.5">EAN</th>
                          <th className="p-2.5">Medicamento</th>
                          <th className="p-2.5 text-right">Estoque</th>
                          <th className="p-2.5 text-right">Qtd Cotada</th>
                          <th className="p-2.5 text-right">Preço Alvo (R$)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedCampaign.items?.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono text-slate-600">{item.ean}</td>
                            <td className="p-2.5 font-medium text-slate-800">{item.productName}</td>
                            <td className="p-2.5 text-right text-slate-600">{item.currentStock}</td>
                            <td className="p-2.5 text-right font-bold text-blue-700">{item.requestedQuantity}</td>
                            <td className="p-2.5 text-right text-slate-700">
                              {item.targetPrice ? `R$ ${item.targetPrice.toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Propostas Recebidas */}
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Propostas das Distribuidoras</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedCampaign.proposals?.map((prop) => (
                      <div key={prop.id} className="border border-slate-200 rounded p-3 bg-slate-50">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-xs text-slate-800">{prop.supplierName}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                            {prop.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Total Ofertado: <span className="font-bold text-slate-800">R$ {prop.netAmount.toFixed(2)}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Prazo: {prop.paymentTerms} | Entrega: {prop.deliveryDays} dia(s)
                        </div>
                      </div>
                    ))}
                    {(selectedCampaign.proposals?.length || 0) === 0 && (
                      <div className="col-span-2 text-xs text-slate-400 p-4 border border-dashed border-slate-200 rounded text-center">
                        Nenhuma proposta recebida para esta cotação ainda. Use a aba "Central EDI Farma" para importar a resposta da distribuidora.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400 text-center py-16">
                Selecione uma campanha à esquerda para visualizar itens e propostas.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo Aba 3: Comparador Split Order */}
      {activeTab === 'optimizer' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-800">Resultado da Otimização de Compras</h2>
            <p className="text-xs text-slate-500">
              Divisão inteligente do pedido (Split Order) pelo menor preço unitário por produto, checando o pedido mínimo de cada distribuidora.
            </p>
          </div>

          {optimizationResult ? (
            <div className="space-y-6">
              {/* Card de Economia */}
              <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-800 uppercase">Economia Total Gerada na Cotação</span>
                  <div className="text-2xl font-bold text-emerald-700 mt-0.5">
                    R$ {optimizationResult.totalCampaignSavings.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Modo: {optimizationResult.optimizationMode === 'SPLIT_ORDER' ? 'Split Order (Item a Item)' : 'Melhor Total Fechado'}
                  </div>
                </div>
                <button
                  onClick={handleGenerateOrders}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded shadow-sm"
                >
                  Confirmar & Gerar Pedidos de Compra
                </button>
              </div>

              {/* Pedidos Vencedores por Distribuidora */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800">Pedidos Vencedores por Distribuidora</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {optimizationResult.awardedOrders.map((ord) => (
                    <div key={ord.supplierId} className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
                      <div className="flex justify-between items-start border-b border-slate-200 pb-2">
                        <div>
                          <h4 className="font-bold text-sm text-slate-800">{ord.supplierName}</h4>
                          <span className="text-xs text-slate-500 font-mono">CNPJ: {ord.supplierCnpj}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-500">Total do Pedido:</span>
                          <div className="text-base font-bold text-blue-700">R$ {ord.totalOrderAmount.toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600">
                          Itens Vencidos: <span className="font-bold text-slate-800">{ord.itemsCount}</span>
                        </span>
                        <span
                          className={`font-semibold px-2 py-0.5 rounded ${
                            ord.meetsMinOrder ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {ord.meetsMinOrder
                            ? 'Atinge Pedido Mínimo'
                            : `Abaixo do Mínimo (R$ ${ord.minOrderValue.toFixed(2)})`}
                        </span>
                      </div>

                      {/* Itens do Pedido */}
                      <div className="max-h-48 overflow-y-auto space-y-1 bg-white p-2 rounded border border-slate-200 text-xs">
                        {ord.items.map((itm, idx) => (
                          <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                            <div>
                              <div className="font-medium text-slate-800">{itm.productName}</div>
                              <div className="text-[10px] text-slate-500 font-mono">EAN: {itm.ean}</div>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-slate-700">
                                {itm.quantity} un x R$ {itm.unitPrice.toFixed(2)}
                              </span>
                              <div className="text-blue-700 font-semibold">R$ {itm.totalAmount.toFixed(2)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400 text-center py-16">
              Nenhuma otimização gerada ainda. Abra uma campanha na aba "Campanhas de Cotação Ativas" e clique em "Otimizar Split Order".
            </div>
          )}
        </div>
      )}

      {/* Conteúdo Aba 4: Central EDI Farma */}
      {activeTab === 'edi' && (
        <form onSubmit={handleImportEdi} className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-800">Processamento de Arquivo de Retorno EDI Farma</h2>
            <p className="text-xs text-slate-500">
              Cole abaixo o conteúdo do arquivo de resposta gerado pelo portal da distribuidora (Santa Cruz, Panpharma, Profarma, GAM).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Campanha de Cotação *</label>
              <select
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                value={importCampaignId}
                onChange={(e) => setImportCampaignId(Number(e.target.value))}
                required
              >
                <option value={0}>Selecione a campanha...</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.campaignCode} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Distribuidora Fornecedora</label>
              <select
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                value={importSupplierId}
                onChange={(e) => setImportSupplierId(Number(e.target.value))}
              >
                <option value={0}>Identificar automaticamente pelo CNPJ no arquivo</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Conteúdo do Arquivo EDI de Resposta *</label>
            <textarea
              rows={8}
              className="w-full border border-slate-300 rounded p-2.5 font-mono text-xs focus:ring-blue-500 focus:border-blue-500"
              placeholder={`Exemplo:\nHDR|COT-2026-0001|12345678000199|SANTA CRUZ\nITM|7891234567890|4.50|5.0|50|1\nITM|7899876543210|17.50|0.0|20|1\nTRL|2`}
              value={ediInputText}
              onChange={(e) => setEdiInputText(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded hover:bg-blue-700 shadow-sm transition-colors text-sm"
            >
              Processar e Vincular Proposta EDI
            </button>
          </div>
        </form>
      )}

      {/* Conteúdo Aba 5: Cadastro de Distribuidoras */}
      {activeTab === 'suppliers' && (
        <div className="space-y-6">
          <form onSubmit={handleRegisterSupplier} className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-800">Cadastrar Nova Distribuidora Farmacêutica</h2>
              <p className="text-xs text-slate-500">Configuração de pedido mínimo, lead time e parâmetros comerciais.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Código Interno *</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  placeholder="Ex: SUPP-SC"
                  value={suppCode}
                  onChange={(e) => setSuppCode(e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Razão Social *</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  placeholder="Ex: Santa Cruz Distribuidora de Medicamentos Ltda"
                  value={suppName}
                  onChange={(e) => setSuppName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nome Fantasia</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  placeholder="Ex: Santa Cruz"
                  value={suppTradeName}
                  onChange={(e) => setSuppTradeName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">CNPJ *</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  placeholder="00.000.000/0000-00"
                  value={suppCnpj}
                  onChange={(e) => setSuppCnpj(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Pedido Mínimo (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={suppMinOrder}
                  onChange={(e) => setSuppMinOrder(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Lead Time (Dias)</label>
                <input
                  type="number"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={suppLeadTime}
                  onChange={(e) => setSuppLeadTime(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Prazo Padrão</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={suppPaymentTerms}
                  onChange={(e) => setSuppPaymentTerms(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded hover:bg-blue-700 shadow-sm transition-colors text-sm"
              >
                Cadastrar Distribuidora
              </button>
            </div>
          </form>

          {/* Listagem de Distribuidoras */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 mb-3">Distribuidoras Cadastradas</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                    <th className="p-3">Código</th>
                    <th className="p-3">Distribuidora</th>
                    <th className="p-3">CNPJ</th>
                    <th className="p-3 text-right">Pedido Mínimo</th>
                    <th className="p-3 text-right">Lead Time</th>
                    <th className="p-3">Prazo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-blue-700">{s.code}</td>
                      <td className="p-3 font-medium text-slate-800">{s.name}</td>
                      <td className="p-3 text-slate-600">{s.cnpj}</td>
                      <td className="p-3 text-right font-bold text-slate-700">
                        R$ {((s.minOrderValue || 0)).toFixed(2)}
                      </td>
                      <td className="p-3 text-right">{s.leadTimeDays} dia(s)</td>
                      <td className="p-3 text-slate-600">{s.paymentTerms}</td>
                    </tr>
                  ))}
                  {suppliers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">
                        Nenhuma distribuidora cadastrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Visualizador do Arquivo EDI Exportado */}
      {ediModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Espelho de Cotação EDI Farma</h3>
                <p className="text-xs text-slate-500">Arquivo formatado para envio às distribuidoras</p>
              </div>
              <button
                onClick={() => setEdiModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto bg-slate-100 flex-1">
              <pre className="font-mono text-xs bg-white p-4 rounded border border-slate-300 shadow-inner whitespace-pre leading-relaxed text-slate-800">
                {ediModal.content}
              </pre>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
              <span className="text-xs text-slate-500 font-mono">{ediModal.fileName}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const blob = new Blob([ediModal.content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = ediModal.fileName;
                    a.click();
                  }}
                  className="bg-blue-600 text-white font-semibold text-xs px-4 py-2 rounded hover:bg-blue-700"
                >
                  Baixar Arquivo .TXT
                </button>
                <button
                  onClick={() => setEdiModal(null)}
                  className="bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2 rounded hover:bg-slate-300"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default B2bQuotationsPage;
