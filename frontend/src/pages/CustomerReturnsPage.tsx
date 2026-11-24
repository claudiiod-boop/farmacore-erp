import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  Search,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  CreditCard,
  Building2,
  Clock,
  Printer,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Plus,
  Trash2
} from 'lucide-react';
import { returnsApi } from '../services/api';
import type {
  EligibleSaleInfo,
  EligibleSaleItem,
  CustomerReturn,
  ReturnKpis,
  RefundMethod,
  ReturnType,
  ItemCondition,
  ItemDestination
} from '../types';

export const CustomerReturnsPage: React.FC = () => {
  const [storeId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'NEW_RETURN' | 'HISTORY' | 'STORE_CREDITS'>('NEW_RETURN');

  // KPIs
  const [kpis, setKpis] = useState<ReturnKpis>({
    total_returns_month: 0,
    total_amount_returned_month: 0,
    active_store_credits_balance: 0,
    quarantined_items_count: 0,
    disposal_pgrss_items_count: 0,
  });

  // Busca de Venda
  const [searchSaleId, setSearchSaleId] = useState('');
  const [isSearchingSale, setIsSearchingSale] = useState(false);
  const [eligibleSale, setEligibleSale] = useState<EligibleSaleInfo | null>(null);

  // Seleção de itens para devolução
  const [selectedItems, setSelectedItems] = useState<
    Array<{
      saleItemId: number;
      productId: number;
      batchId?: number | null;
      quantity: number;
      unitPrice: number;
      condition: ItemCondition;
      destination: ItemDestination;
      isThermolabile: boolean;
      requiresPharmacistAuth: boolean;
    }>
  >([]);

  // Parâmetros da devolução
  const [returnType, setReturnType] = useState<ReturnType>('RETURN');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('STORE_CREDIT');
  const [reason, setReason] = useState('WRONG_ITEM');
  const [notes, setNotes] = useState('');
  const [pharmacistCrf, setPharmacistCrf] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lista do Histórico
  const [returnsList, setReturnsList] = useState<CustomerReturn[]>([]);
  const [selectedReturn, setSelectedReturn] = useState<CustomerReturn | null>(null);
  const [fiscalModalSummary, setFiscalModalSummary] = useState<any | null>(null);

  // Consulta de Vales-Compra
  const [searchCreditCode, setSearchCreditCode] = useState('');
  const [creditResult, setCreditResult] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [kpisData, returnsData] = await Promise.all([
        returnsApi.getKpis(storeId),
        returnsApi.listReturns(storeId),
      ]);
      setKpis(kpisData);
      setReturnsList(returnsData);
    } catch (err) {
      console.error('Erro ao carregar dados de devoluções:', err);
    }
  }, [storeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Busca Venda
  const handleSearchSale = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchSaleId.trim()) return;

    setIsSearchingSale(true);
    try {
      const data = await returnsApi.getEligibleItems(Number(searchSaleId));
      setEligibleSale(data);
      setSelectedItems([]);
    } catch (err: any) {
      alert(`Erro ao buscar venda: ${err.message}`);
      setEligibleSale(null);
    } finally {
      setIsSearchingSale(false);
    }
  };

  // Alterna seleção de item da venda
  const toggleSelectItem = (item: EligibleSaleItem) => {
    const exists = selectedItems.find((i) => i.saleItemId === item.saleItemId);
    if (exists) {
      setSelectedItems((prev) => prev.filter((i) => i.saleItemId !== item.saleItemId));
    } else {
      // Regra RDC 44/2009: se for termolábil, destino padrão deve ser QUARENTENA
      const initialDest: ItemDestination = item.isThermolabile ? 'QUARANTINE' : 'RETURN_TO_STOCK';

      setSelectedItems((prev) => [
        ...prev,
        {
          saleItemId: item.saleItemId,
          productId: item.productId,
          batchId: item.batchId,
          quantity: 1,
          unitPrice: item.unitPrice,
          condition: 'INTACT',
          destination: initialDest,
          isThermolabile: item.isThermolabile,
          requiresPharmacistAuth: item.requiresPharmacistAuth,
        },
      ]);
    }
  };

  const updateSelectedItem = (saleItemId: number, patch: Partial<(typeof selectedItems)[0]>) => {
    setSelectedItems((prev) =>
      prev.map((i) => {
        if (i.saleItemId === saleItemId) {
          const updated = { ...i, ...patch };
          // Forçar regra RDC 44/2009: se termolábil, não permitir RETURN_TO_STOCK
          if (updated.isThermolabile && updated.destination === 'RETURN_TO_STOCK') {
            alert('Atenção Sanitária (RDC 44/2009 ANVISA): Medicamentos termolábeis não podem retornar ao estoque vendável.');
            updated.destination = 'QUARANTINE';
          }
          return updated;
        }
        return i;
      })
    );
  };

  // Submeter devolução
  const handleSubmitReturn = async () => {
    if (!eligibleSale || selectedItems.length === 0) return;

    // Verificar se há item controlado exigindo farmacêutico
    const hasControlled = selectedItems.some((i) => i.requiresPharmacistAuth);
    if (hasControlled && !pharmacistCrf.trim()) {
      alert('Exigência Sanitária (Portaria 344/98): Informe o CRF do Farmacêutico Responsável para itens controlados.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await returnsApi.createReturn({
        storeId,
        saleId: eligibleSale.saleId,
        customerId: eligibleSale.customerCpf ? undefined : undefined,
        returnType,
        refundMethod,
        reason,
        notes,
        createdBy: 'Operador Balcão',
        pharmacistCrf: pharmacistCrf.trim() || undefined,
        items: selectedItems.map((it) => ({
          saleItemId: it.saleItemId,
          productId: it.productId,
          batchId: it.batchId || undefined,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          condition: it.condition,
          destination: it.destination,
        })),
      });

      alert(`Solicitação de devolução ${res.code} gerada com sucesso!`);
      setEligibleSale(null);
      setSelectedItems([]);
      setSearchSaleId('');
      setActiveTab('HISTORY');
      await loadData();
    } catch (err: any) {
      alert(`Erro ao registrar devolução: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Aprovar devolução
  const handleApproveReturn = async (returnId: number) => {
    try {
      const approved = await returnsApi.approveReturn(returnId, {
        authorizedByPharmacist: pharmacistCrf.trim() || undefined,
      });
      alert(`Devolução #${approved.code} aprovada com sucesso! NF-e de entrada emitida.`);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao aprovar devolução: ${err.message}`);
    }
  };

  // Rejeitar devolução
  const handleRejectReturn = async (returnId: number) => {
    const reasonPrompt = prompt('Informe a justificativa técnica para rejeição da devolução:');
    if (!reasonPrompt) return;

    try {
      await returnsApi.rejectReturn(returnId, reasonPrompt);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao rejeitar devolução: ${err.message}`);
    }
  };

  // Exibir espelho fiscal
  const handleViewFiscal = async (returnId: number) => {
    try {
      const fiscal = await returnsApi.getFiscalSummary(returnId);
      setFiscalModalSummary(fiscal);
    } catch (err: any) {
      alert(`Erro ao consultar espelho fiscal: ${err.message}`);
    }
  };

  // Consultar vale-compras
  const handleValidateCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCreditCode.trim()) return;

    try {
      const result = await returnsApi.validateStoreCredit(searchCreditCode.trim());
      setCreditResult(result);
    } catch (err: any) {
      alert(`Erro ao validar vale-compras: ${err.message}`);
      setCreditResult(null);
    }
  };

  const selectedTotal = selectedItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Header Principal */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-900/30">
            <RotateCcw className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              Trocas, Devoluções & Estorno Fiscal
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                RDC 44/2009 ANVISA & SEFAZ CFOP 1.202
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Logística Reversa de Balcão, Validação Sanitária de Termolábeis e Emissão de Vales-Compra
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar Dados
        </button>
      </div>

      {/* Grid de KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-6 pb-2">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Devoluções / Mês</span>
          <div className="text-2xl font-black text-white mt-1" data-testid="kpi-returns-count">
            {kpis.total_returns_month}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-amber-400 font-medium">Total Devolvido</span>
          <div className="text-2xl font-black text-amber-400 mt-1 font-mono" data-testid="kpi-returns-amount">
            R$ {kpis.total_amount_returned_month.toFixed(2)}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-emerald-400 font-medium">Vales-Compra Ativos</span>
          <div className="text-2xl font-black text-emerald-400 mt-1 font-mono" data-testid="kpi-credits-balance">
            R$ {kpis.active_store_credits_balance.toFixed(2)}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-sky-400 font-medium flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            Em Quarentena
          </span>
          <div className="text-2xl font-black text-sky-400 mt-1" data-testid="kpi-quarantine-count">
            {kpis.quarantined_items_count} un
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" />
            Descarte PGRSS
          </span>
          <div className="text-2xl font-black text-rose-400 mt-1" data-testid="kpi-pgrss-count">
            {kpis.disposal_pgrss_items_count} un
          </div>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="px-6 pt-4 flex gap-2 border-b border-slate-800">
        <button
          data-testid="tab-new-return-button"
          onClick={() => setActiveTab('NEW_RETURN')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'NEW_RETURN'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          Nova Devolução / Troca
        </button>

        <button
          data-testid="tab-history-button"
          onClick={() => setActiveTab('HISTORY')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'HISTORY'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Histórico de Devoluções ({returnsList.length})
        </button>

        <button
          data-testid="tab-store-credits-button"
          onClick={() => setActiveTab('STORE_CREDITS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'STORE_CREDITS'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Validação de Vales-Compra
        </button>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* ===================== ABA 1: NOVA DEVOLUÇÃO / TROCA ===================== */}
        {activeTab === 'NEW_RETURN' && (
          <div className="space-y-6">
            {/* Card de Busca de Venda */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-400" />
                Localizar Venda Original (Cupom Fiscal / NFC-e)
              </h2>

              <form onSubmit={handleSearchSale} className="flex gap-3">
                <input
                  type="number"
                  data-testid="search-sale-input"
                  value={searchSaleId}
                  onChange={(e) => setSearchSaleId(e.target.value)}
                  placeholder="Informe o Nº da Venda (ex: 1, 2, 1045)"
                  className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none flex-1 font-mono focus:border-amber-500 transition-all"
                />
                <button
                  type="submit"
                  data-testid="search-sale-button"
                  disabled={isSearchingSale || !searchSaleId}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-900/30 flex items-center gap-2 disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                  {isSearchingSale ? 'Buscando...' : 'Localizar Venda'}
                </button>
              </form>
            </div>

            {/* Resultado da Venda e Seleção de Itens */}
            {eligibleSale && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-3">
                  <div>
                    <span className="text-xs text-slate-400">Venda Localizada:</span>
                    <h3 className="text-base font-black text-white font-mono">#VENDA-{eligibleSale.saleId}</h3>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Cliente:</span>
                    <div className="text-sm font-bold text-white">
                      {eligibleSale.customerName || 'Consumidor Final'} {eligibleSale.customerCpf && `(${eligibleSale.customerCpf})`}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Data da Venda:</span>
                    <div className="text-sm font-mono text-slate-300">{eligibleSale.createdAt.substring(0, 10)}</div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Total da Venda:</span>
                    <div className="text-base font-black text-emerald-400 font-mono">
                      R$ {eligibleSale.totalAmount.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
                        <th className="py-2.5 px-3 text-center w-10">Sel.</th>
                        <th className="py-2.5 px-3">Medicamento / Lote</th>
                        <th className="py-2.5 px-3 text-center">Sanitário</th>
                        <th className="py-2.5 px-3 text-right">Qtd Vendida</th>
                        <th className="py-2.5 px-3 text-right">Disponível</th>
                        <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                        <th className="py-2.5 px-3 text-center">Qtd Devolver</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                        <th className="py-2.5 px-3 text-center">Destino Físico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {eligibleSale.items.map((it) => {
                        const selected = selectedItems.find((s) => s.saleItemId === it.saleItemId);
                        const isSelected = Boolean(selected);

                        return (
                          <tr
                            key={it.saleItemId}
                            data-testid={`row-eligible-item-${it.saleItemId}`}
                            className={isSelected ? 'bg-amber-950/20' : 'hover:bg-slate-800/40'}
                          >
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectItem(it)}
                                disabled={it.availableQuantity <= 0}
                                className="cursor-pointer rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-white">{it.productName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                EAN: {it.ean} | Lote: {it.batchNumber || 'N/A'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {it.isThermolabile && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                  Termolábil (Frio)
                                </span>
                              )}
                              {it.requiresPharmacistAuth && (
                                <span className="ml-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  Portaria 344
                                </span>
                              )}
                              {!it.isThermolabile && !it.requiresPharmacistAuth && (
                                <span className="text-slate-500 text-[10px]">Normal</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">{it.soldQuantity}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                              {it.availableQuantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">R$ {it.unitPrice.toFixed(2)}</td>

                            {/* Qtd Devolver */}
                            <td className="py-2.5 px-3 text-center">
                              {isSelected ? (
                                <input
                                  type="number"
                                  min={1}
                                  max={it.availableQuantity}
                                  value={selected.quantity}
                                  onChange={(e) =>
                                    updateSelectedItem(it.saleItemId, {
                                      quantity: Math.min(
                                        it.availableQuantity,
                                        Math.max(1, Number(e.target.value))
                                      ),
                                    })
                                  }
                                  className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center text-white font-mono"
                                />
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>

                            {/* Estado do Produto */}
                            <td className="py-2.5 px-3 text-center">
                              {isSelected ? (
                                <select
                                  value={selected.condition}
                                  onChange={(e) =>
                                    updateSelectedItem(it.saleItemId, {
                                      condition: e.target.value as ItemCondition,
                                    })
                                  }
                                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-[11px]"
                                >
                                  <option value="INTACT">Lacrado / Íntegro</option>
                                  <option value="DEFECTIVE">Avariado / Danificado</option>
                                  <option value="UNSEALED">Violado / Aberto</option>
                                  <option value="EXPIRED">Vencido</option>
                                </select>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>

                            {/* Destino Físico */}
                            <td className="py-2.5 px-3 text-center">
                              {isSelected ? (
                                <select
                                  value={selected.destination}
                                  onChange={(e) =>
                                    updateSelectedItem(it.saleItemId, {
                                      destination: e.target.value as ItemDestination,
                                    })
                                  }
                                  className={`bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] ${
                                    selected.destination === 'RETURN_TO_STOCK'
                                      ? 'text-emerald-400 font-bold'
                                      : 'text-amber-400'
                                  }`}
                                >
                                  {!it.isThermolabile && <option value="RETURN_TO_STOCK">Retornar ao Estoque</option>}
                                  <option value="QUARANTINE">Quarentena / Inspeção RT</option>
                                  <option value="DISPOSAL_PGRSS">Descarte Sanitário PGRSS</option>
                                </select>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Parâmetros da Devolução */}
                {selectedItems.length > 0 && (
                  <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <label className="text-slate-400 font-semibold block mb-1">Tipo de Operação:</label>
                        <select
                          value={returnType}
                          onChange={(e) => setReturnType(e.target.value as ReturnType)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                        >
                          <option value="RETURN">Devolução com Reembolso</option>
                          <option value="EXCHANGE">Troca Direta no Balcão</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 font-semibold block mb-1">Forma de Reembolso:</label>
                        <select
                          data-testid="refund-method-select"
                          value={refundMethod}
                          onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                        >
                          <option value="STORE_CREDIT">Vale-Compras (Crédito de Loja)</option>
                          <option value="CASH_REFUND">Devolução em Dinheiro (Caixa)</option>
                          <option value="CARD_REVERSAL">Estorno no Cartão / TEF</option>
                          <option value="EXCHANGE">Troca por Outro Produto</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 font-semibold block mb-1">Motivo da Devolução:</label>
                        <select
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                        >
                          <option value="WRONG_ITEM">Comprado por Engano / Dosagem Errada</option>
                          <option value="DEFECT">Defeito de Fabricação / Avaria</option>
                          <option value="ADVERSE_REACTION">Reação Adversa / Intolerância</option>
                          <option value="CUSTOMER_DISSATISFACTION">Insatisfação do Cliente</option>
                          <option value="OTHER">Outros Motivos</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 font-semibold block mb-1">
                          Farmacêutico RT / CRF:
                        </label>
                        <input
                          type="text"
                          data-testid="pharmacist-crf-input"
                          value={pharmacistCrf}
                          onChange={(e) => setPharmacistCrf(e.target.value)}
                          placeholder="Ex: Dra. Ana - CRF/SP 12345"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-slate-800 gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">Total a Devolver/Trocar:</span>
                        <span className="text-xl font-black text-amber-400 font-mono">
                          R$ {selectedTotal.toFixed(2)}
                        </span>
                      </div>

                      <button
                        data-testid="submit-return-button"
                        onClick={handleSubmitReturn}
                        disabled={isSubmitting || selectedItems.length === 0}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isSubmitting ? 'Registrando...' : 'Emitir Solicitação de Devolução'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================== ABA 2: HISTÓRICO DE DEVOLUÇÕES ===================== */}
        {activeTab === 'HISTORY' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              Devoluções e Trocas Registradas
            </h2>

            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
                    <th className="py-2.5 px-4">Código / NF-e</th>
                    <th className="py-2.5 px-4">Venda Ref.</th>
                    <th className="py-2.5 px-4">Data</th>
                    <th className="py-2.5 px-4 text-center">Tipo</th>
                    <th className="py-2.5 px-4 text-center">Reembolso</th>
                    <th className="py-2.5 px-4 text-right">Valor Total</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {returnsList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhuma devolução registrada no período.
                      </td>
                    </tr>
                  ) : (
                    returnsList.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/40 font-mono">
                        <td className="py-3 px-4 font-bold text-white">
                          <div>{r.code}</div>
                          {r.fiscal_nfe_key && (
                            <div className="text-[10px] text-slate-500 font-sans truncate max-w-xs">
                              NF-e: {r.fiscal_nfe_key.substring(0, 18)}...
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-sans">#VENDA-{r.sale_id}</td>
                        <td className="py-3 px-4 text-slate-400">{r.created_at.substring(0, 10)}</td>
                        <td className="py-3 px-4 text-center font-sans">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-semibold">
                            {r.return_type === 'RETURN' ? 'Devolução' : 'Troca'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
                            {r.refund_method}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-bold">
                          R$ {r.total_amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.status === 'COMPLETED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : r.status === 'REJECTED'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-sans space-x-2">
                          {r.status === 'DRAFT' && (
                            <>
                              <button
                                data-testid={`approve-return-${r.id}`}
                                onClick={() => handleApproveReturn(r.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold transition-all"
                              >
                                Aprovar
                              </button>
                              <button
                                data-testid={`reject-return-${r.id}`}
                                onClick={() => handleRejectReturn(r.id)}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold transition-all"
                              >
                                Rejeitar
                              </button>
                            </>
                          )}
                          <button
                            data-testid={`fiscal-summary-${r.id}`}
                            onClick={() => handleViewFiscal(r.id)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-semibold transition-all border border-slate-700"
                          >
                            Espelho Fiscal
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================== ABA 3: VALIDAÇÃO DE VALES-COMPRA ===================== */}
        {activeTab === 'STORE_CREDITS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 max-w-2xl mx-auto">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              Consulta & Validação de Saldo de Vale-Compras
            </h2>

            <form onSubmit={handleValidateCredit} className="flex gap-3">
              <input
                type="text"
                data-testid="validate-credit-input"
                value={searchCreditCode}
                onChange={(e) => setSearchCreditCode(e.target.value.toUpperCase())}
                placeholder="Informe o Código do Vale (ex: CRED-ABC123XYZ)"
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none flex-1 font-mono uppercase focus:border-emerald-500"
              />
              <button
                type="submit"
                data-testid="validate-credit-button"
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/30"
              >
                Validar Saldo
              </button>
            </form>

            {creditResult && (
              <div
                data-testid="credit-result-card"
                className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-3"
              >
                <div className="text-xs text-slate-400">Situação do Vale-Compras</div>
                <div
                  className={`text-sm font-bold px-3 py-1 rounded-full inline-block ${
                    creditResult.valid
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {creditResult.valid ? 'VALE ATIVO & APTO PARA USO' : `INVÁLIDO (${creditResult.status})`}
                </div>

                <div className="text-3xl font-black text-emerald-400 font-mono mt-2" data-testid="credit-balance-display">
                  R$ {creditResult.balance.toFixed(2)}
                </div>

                {creditResult.expiresAt && (
                  <div className="text-xs text-slate-500 font-mono">
                    Válido até: {creditResult.expiresAt.substring(0, 10)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Espelho Fiscal */}
      {fiscalModalSummary && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                Espelho Fiscal — NF-e de Devolução (SEFAZ)
              </h3>
              <button
                onClick={() => setFiscalModalSummary(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-500">Chave NF-e:</span>{' '}
                <span className="text-white break-all">{fiscalModalSummary.returnNfeKey}</span>
              </div>
              <div>
                <span className="text-slate-500">CFOP da Operação:</span>{' '}
                <span className="text-amber-400 font-bold">{fiscalModalSummary.cfop}</span>
              </div>
              <div>
                <span className="text-slate-500">Natureza:</span>{' '}
                <span className="text-slate-300">{fiscalModalSummary.natureOfOperation}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-900 p-2 rounded">
                  <div className="text-slate-500 text-[10px]">Estorno ICMS (18%)</div>
                  <div className="text-emerald-400 font-bold">R$ {fiscalModalSummary.icmsReversal.toFixed(2)}</div>
                </div>
                <div className="bg-slate-900 p-2 rounded">
                  <div className="text-slate-500 text-[10px]">Estorno PIS (1.65%)</div>
                  <div className="text-sky-400 font-bold">R$ {fiscalModalSummary.pisReversal.toFixed(2)}</div>
                </div>
                <div className="bg-slate-900 p-2 rounded">
                  <div className="text-slate-500 text-[10px]">Estorno COFINS (7.6%)</div>
                  <div className="text-indigo-400 font-bold">R$ {fiscalModalSummary.cofinsReversal.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setFiscalModalSummary(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerReturnsPage;
