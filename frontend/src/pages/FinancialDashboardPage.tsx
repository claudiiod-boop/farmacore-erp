import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  PieChart,
  Lock,
  Calendar,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { formatBrl } from '../components/ProductSearch';
import ClosureReviewModal from '../components/pos/ClosureReviewModal';
import { api } from '../services/api';
import type {
  BlindCashClosure,
  TefReceivablesForecastSummary,
  TefReceivablesForecastItem,
  TefReconciliationTransaction,
  TefReconciliationSummary,
  DreReport,
  AbcCurveReport,
  AbcCurveItem,
} from '../types';

type FinancialTab = 'CLOSURES' | 'TEF' | 'DRE' | 'ABC';

export default function FinancialDashboardPage() {
  const [activeTab, setActiveTab] = useState<FinancialTab>('CLOSURES');

  // Dates defaults (Current Month)
  const defaultDates = useMemo(() => {
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return { startDate: firstDay, endDate: today };
  }, []);

  const [startDate, setStartDate] = useState(defaultDates.startDate);
  const [endDate, setEndDate] = useState(defaultDates.endDate);

  // TAB 1: Closures state
  const [closures, setClosures] = useState<BlindCashClosure[]>([]);
  const [closureStatusFilter, setClosureStatusFilter] = useState<string>('ALL');
  const [closureDiffFilter, setClosureDiffFilter] = useState<string>('ALL');
  const [selectedClosure, setSelectedClosure] = useState<BlindCashClosure | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isLoadingClosures, setIsLoadingClosures] = useState(false);

  // TAB 2: TEF state
  const [tefForecast, setTefForecast] = useState<TefReceivablesForecastSummary | null>(null);
  const [tefTransactions, setTefTransactions] = useState<TefReconciliationTransaction[]>([]);
  const [tefSummary, setTefSummary] = useState<TefReconciliationSummary | null>(null);
  const [tefSettlementFilter, setTefSettlementFilter] = useState<string>('ALL');
  const [isLoadingTef, setIsLoadingTef] = useState(false);
  // Manual settlement inline state
  const [settlingNsu, setSettlingNsu] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleFee, setSettleFee] = useState<string>('');
  const [settleBank, setSettleBank] = useState<string>('');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  // TAB 3: DRE state
  const [dreReport, setDreReport] = useState<DreReport | null>(null);
  const [isLoadingDre, setIsLoadingDre] = useState(false);

  // TAB 4: ABC Curve state
  const [abcReport, setAbcReport] = useState<AbcCurveReport | null>(null);
  const [abcCategoryFilter, setAbcCategoryFilter] = useState<string>('TODAS');
  const [isLoadingAbc, setIsLoadingAbc] = useState(false);

  // Global notice & error
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load Closures
  const loadClosures = useCallback(async () => {
    setIsLoadingClosures(true);
    setErrorMessage(null);
    try {
      const filters: any = {};
      if (closureStatusFilter !== 'ALL') filters.status = closureStatusFilter;
      if (closureDiffFilter !== 'ALL') filters.differenceStatus = closureDiffFilter;
      const data = await api.listClosures(filters);
      setClosures(data.closures || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao carregar fechamentos de caixa.');
    } finally {
      setIsLoadingClosures(false);
    }
  }, [closureStatusFilter, closureDiffFilter]);

  // Load TEF
  const loadTefData = useCallback(async () => {
    setIsLoadingTef(true);
    setErrorMessage(null);
    try {
      const [forecastData, reconData] = await Promise.all([
        api.getTefForecast({ startDate, endDate }),
        api.listTefReconciliation({
          settlementStatus: tefSettlementFilter !== 'ALL' ? tefSettlementFilter : undefined,
          startDate,
          endDate,
        }),
      ]);
      setTefForecast(forecastData);
      setTefTransactions(reconData.transactions || []);
      setTefSummary(reconData.summary || null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao carregar conciliação TEF.');
    } finally {
      setIsLoadingTef(false);
    }
  }, [startDate, endDate, tefSettlementFilter]);

  // Load DRE
  const loadDreData = useCallback(async () => {
    setIsLoadingDre(true);
    setErrorMessage(null);
    try {
      const data = await api.getDreReport(startDate, endDate);
      setDreReport(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao gerar relatório DRE.');
    } finally {
      setIsLoadingDre(false);
    }
  }, [startDate, endDate]);

  // Load ABC
  const loadAbcData = useCallback(async () => {
    setIsLoadingAbc(true);
    setErrorMessage(null);
    try {
      const cat = abcCategoryFilter !== 'TODAS' ? abcCategoryFilter : undefined;
      const data = await api.getAbcCurveReport(startDate, endDate, cat);
      setAbcReport(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao gerar Curva ABC.');
    } finally {
      setIsLoadingAbc(false);
    }
  }, [startDate, endDate, abcCategoryFilter]);

  // Initial load according to active tab
  useEffect(() => {
    if (activeTab === 'CLOSURES') {
      loadClosures();
    } else if (activeTab === 'TEF') {
      loadTefData();
    } else if (activeTab === 'DRE') {
      loadDreData();
    } else if (activeTab === 'ABC') {
      loadAbcData();
    }
  }, [activeTab, loadClosures, loadTefData, loadDreData, loadAbcData]);

  // Handle Manual Settle Submit
  const handleConfirmSettle = async (nsu: string) => {
    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount < 0) {
      setErrorMessage('Informe um valor liquidado válido.');
      return;
    }

    setIsSubmittingSettle(true);
    setErrorMessage(null);
    try {
      await api.settleTefTransaction({
        nsu,
        settledAmount: amount,
        settledFee: settleFee ? parseFloat(settleFee) : undefined,
        bankAccount: settleBank.trim() || undefined,
      });

      setSuccessMessage(`Transação NSU ${nsu} baixada com sucesso no extrato bancário.`);
      setSettlingNsu(null);
      setSettleAmount('');
      setSettleFee('');
      setSettleBank('');
      loadTefData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao liquidar transação.');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 overflow-hidden select-none">
      {/* Top Header */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-600/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">
              Módulo Financeiro & Gestão
            </h1>
            <p className="text-xs text-slate-400">
              Fechamento Cego de Caixa &bull; Conciliação TEF &bull; DRE &bull; Curva ABC
            </p>
          </div>
        </div>

        {/* Global Period Selector */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-400 font-medium">Período:</span>
          <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              data-testid="input-start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-white focus:outline-hidden text-xs cursor-pointer"
            />
            <span className="text-slate-500">até</span>
            <input
              type="date"
              data-testid="input-end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-white focus:outline-hidden text-xs cursor-pointer"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'CLOSURES') loadClosures();
              if (activeTab === 'TEF') loadTefData();
              if (activeTab === 'DRE') loadDreData();
              if (activeTab === 'ABC') loadAbcData();
            }}
            title="Atualizar dados"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="bg-slate-950/70 border-b border-slate-800 px-6 flex items-center space-x-1">
        <button
          type="button"
          data-testid="tab-closures"
          onClick={() => setActiveTab('CLOSURES')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-bold text-xs transition cursor-pointer ${
            activeTab === 'CLOSURES'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Fechamento Cego de Caixa</span>
        </button>

        <button
          type="button"
          data-testid="tab-tef"
          onClick={() => setActiveTab('TEF')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-bold text-xs transition cursor-pointer ${
            activeTab === 'TEF'
              ? 'border-blue-500 text-blue-400 bg-blue-950/20'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Conciliação TEF & Previsão</span>
        </button>

        <button
          type="button"
          data-testid="tab-dre"
          onClick={() => setActiveTab('DRE')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-bold text-xs transition cursor-pointer ${
            activeTab === 'DRE'
              ? 'border-amber-500 text-amber-400 bg-amber-950/20'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>DRE Gerencial</span>
        </button>

        <button
          type="button"
          data-testid="tab-abc"
          onClick={() => setActiveTab('ABC')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-bold text-xs transition cursor-pointer ${
            activeTab === 'ABC'
              ? 'border-purple-500 text-purple-400 bg-purple-950/20'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span>Curva ABC (80/20)</span>
        </button>
      </div>

      {/* Global Alerts */}
      {errorMessage && (
        <div className="mx-6 mt-3 p-3 bg-rose-950/80 border border-rose-700/60 text-rose-200 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <XCircle className="w-4 h-4 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-white">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="mx-6 mt-3 p-3 bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-slate-400 hover:text-white">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ==================== TAB 1: FECHAMENTO CEGO DE CAIXA ==================== */}
        {activeTab === 'CLOSURES' && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400 font-semibold">Status:</span>
                  <select
                    data-testid="select-closure-status"
                    value={closureStatusFilter}
                    onChange={(e) => setClosureStatusFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-hidden"
                  >
                    <option value="ALL">Todos os Status</option>
                    <option value="PENDING_REVIEW">Pendente de Homologação</option>
                    <option value="APPROVED">Aprovado pelo Gerente</option>
                    <option value="REJECTED">Rejeitado</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-slate-400 font-semibold">Apuração:</span>
                  <select
                    data-testid="select-closure-diff"
                    value={closureDiffFilter}
                    onChange={(e) => setClosureDiffFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-hidden"
                  >
                    <option value="ALL">Todas as Apurações</option>
                    <option value="EXACT">Conferência Exata</option>
                    <option value="SURPLUS">Sobra de Caixa</option>
                    <option value="SHORTAGE">Quebra de Caixa</option>
                  </select>
                </div>
              </div>

              <div className="text-slate-400 font-medium">
                Total de fechamentos listados: <span className="text-white font-bold">{closures.length}</span>
              </div>
            </div>

            {/* Closures Table */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3"># Fechamento</th>
                      <th className="px-4 py-3">Sessão / Operador</th>
                      <th className="px-4 py-3">Data/Hora</th>
                      <th className="px-4 py-3 text-right">Calculado Sistema</th>
                      <th className="px-4 py-3 text-right">Declarado Físico</th>
                      <th className="px-4 py-3 text-right">Diferença</th>
                      <th className="px-4 py-3 text-center">Apuração</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {isLoadingClosures ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                          Carregando fechamentos de caixa...
                        </td>
                      </tr>
                    ) : closures.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                          Nenhum fechamento de caixa encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      closures.map((cl) => (
                        <tr key={cl.id} className="hover:bg-slate-900/60 transition">
                          <td className="px-4 py-3 font-mono font-bold text-white">#{cl.id}</td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-white block">{cl.operatorName}</span>
                            <span className="text-[11px] text-slate-500">Sessão #{cl.cashSessionId}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {new Date(cl.closedAt).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            {formatBrl(cl.systemTotal)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                            {formatBrl(cl.declaredTotal)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono font-bold ${
                              cl.totalDifference === 0
                                ? 'text-slate-400'
                                : cl.totalDifference > 0
                                ? 'text-blue-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {cl.totalDifference > 0 ? `+${formatBrl(cl.totalDifference)}` : formatBrl(cl.totalDifference)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                cl.differenceStatus === 'EXACT'
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                  : cl.differenceStatus === 'SURPLUS'
                                  ? 'bg-blue-950 text-blue-300 border-blue-600'
                                  : 'bg-rose-950 text-rose-300 border-rose-600'
                              }`}
                            >
                              {cl.differenceStatus === 'EXACT'
                                ? 'EXATA'
                                : cl.differenceStatus === 'SURPLUS'
                                ? 'SOBRA'
                                : 'QUEBRA'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                cl.status === 'APPROVED'
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                  : cl.status === 'REJECTED'
                                  ? 'bg-rose-950 text-rose-300 border-rose-600'
                                  : 'bg-amber-950 text-amber-300 border-amber-600'
                              }`}
                            >
                              {cl.status === 'APPROVED'
                                ? 'Aprovado'
                                : cl.status === 'REJECTED'
                                ? 'Rejeitado'
                                : 'Pendente'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              data-testid={`btn-review-closure-${cl.id}`}
                              onClick={() => {
                                setSelectedClosure(cl);
                                setIsReviewModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700 font-semibold text-[11px] transition cursor-pointer"
                            >
                              {cl.status === 'PENDING_REVIEW' ? 'Auditar' : 'Visualizar'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: CONCILIAÇÃO FINANCEIRA TEF ==================== */}
        {activeTab === 'TEF' && (
          <div className="space-y-6">
            {/* Forecast Summary Cards */}
            {tefForecast && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                    Recebíveis Previstos (Bruto)
                  </span>
                  <p className="text-xl font-bold text-white mt-1">{formatBrl(tefForecast.totalGross)}</p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    {tefForecast.totalTransactions} transações no período
                  </span>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                    Taxas MDR Estimadas
                  </span>
                  <p className="text-xl font-bold text-amber-400 mt-1">
                    {formatBrl(tefForecast.totalEstimatedFee)}
                  </p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Retenção de adquirentes</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                    Líquido Previsto a Receber
                  </span>
                  <p className="text-xl font-bold text-emerald-400 mt-1">{formatBrl(tefForecast.totalNet)}</p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">D+1 Débito / D+30 Crédito</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                    Status de Liquidação
                  </span>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs font-bold text-emerald-400">
                      {tefSummary?.settledCount || 0} Baixadas
                    </span>
                    <span className="text-slate-600">&bull;</span>
                    <span className="text-xs font-bold text-amber-400">
                      {tefSummary?.pendingCount || 0} Pendentes
                    </span>
                  </div>
                  {Boolean(tefSummary?.divergentCount) && (
                    <span className="text-[11px] text-rose-400 font-bold block mt-0.5">
                      {tefSummary?.divergentCount} com taxa divergente!
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Previsão Agrupada por Adquirente e Data */}
            {tefForecast && tefForecast.items.length > 0 && (
              <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span>Cronograma de Repasses Bancários (Previsão por Data & Adquirente)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tefForecast.items.map((item: TefReceivablesForecastItem, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-white">{item.acquirerName}</span>
                        <span className="text-blue-400 font-mono">{item.expectedSettlementDate}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 text-[11px]">
                        <span>Modalidade: {item.operationType}</span>
                        <span>{item.transactionCount} transações</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 font-mono">
                        <span className="text-slate-400">Bruto: {formatBrl(item.grossAmount)}</span>
                        <span className="text-emerald-400 font-bold">
                          Líq: {formatBrl(item.netAmount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TEF Transactions Table for Settlement */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-lg space-y-2">
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-400">Filtro de Baixa:</span>
                  <select
                    value={tefSettlementFilter}
                    onChange={(e) => setTefSettlementFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-medium focus:outline-hidden"
                  >
                    <option value="ALL">Todas as Transações</option>
                    <option value="PENDING">Pendentes de Liquidação</option>
                    <option value="SETTLED">Liquidadas em Banco</option>
                    <option value="DIVERGENT">Taxa MDR Divergente</option>
                  </select>
                </div>
                <div className="text-slate-400">
                  Total listado: <span className="text-white font-bold">{tefTransactions.length}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">NSU / Adquirente</th>
                      <th className="px-4 py-3">Bandeira / Tipo</th>
                      <th className="px-4 py-3">Data Venda</th>
                      <th className="px-4 py-3">Data Prevista</th>
                      <th className="px-4 py-3 text-right">Valor Bruto</th>
                      <th className="px-4 py-3 text-right">Taxa MDR</th>
                      <th className="px-4 py-3 text-right">Valor Líquido</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {isLoadingTef ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                          Carregando conciliação TEF...
                        </td>
                      </tr>
                    ) : tefTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                          Nenhuma transação TEF encontrada para os filtros.
                        </td>
                      </tr>
                    ) : (
                      tefTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-900/60 transition">
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-white block">{tx.nsu}</span>
                            <span className="text-[11px] text-slate-500">{tx.acquirerName || 'Adquirente'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-200 block">{tx.brandName || 'CARTÃO'}</span>
                            <span className="text-[11px] text-slate-500">{tx.operationType}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {new Date(tx.createdAt).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 font-mono text-blue-400">
                            {tx.expectedSettlementDate || '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-200 font-bold">
                            {formatBrl(tx.amount)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-400">
                            {tx.mdrRate ? `${tx.mdrRate.toFixed(2)}%` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-400 font-bold">
                            {tx.netAmount ? formatBrl(tx.netAmount) : formatBrl(tx.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                tx.settlementStatus === 'SETTLED'
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                  : tx.settlementStatus === 'DIVERGENT'
                                  ? 'bg-rose-950 text-rose-300 border-rose-600 animate-pulse'
                                  : 'bg-amber-950 text-amber-300 border-amber-600'
                              }`}
                            >
                              {tx.settlementStatus === 'SETTLED'
                                ? 'Liquidado'
                                : tx.settlementStatus === 'DIVERGENT'
                                ? 'Divergente'
                                : 'Pendente'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {tx.settlementStatus !== 'SETTLED' ? (
                              <button
                                type="button"
                                data-testid={`btn-settle-${tx.nsu}`}
                                onClick={() => {
                                  setSettlingNsu(tx.nsu);
                                  setSettleAmount(String(tx.netAmount || tx.amount));
                                  setSettleFee(
                                    tx.amount && tx.netAmount
                                      ? (tx.amount - tx.netAmount).toFixed(2)
                                      : '0.00'
                                  );
                                }}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                              >
                                Baixa Bancária
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-500 font-mono">
                                {tx.bankAccount || 'Conta Padrão'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inline Settlement Modal / Dialog */}
            {settlingNsu && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-base font-bold text-white flex items-center space-x-2">
                      <CreditCard className="w-5 h-5 text-blue-400" />
                      <span>Baixa e Conciliação Bancária TEF</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setSettlingNsu(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-400">
                    Transação NSU: <span className="font-mono font-bold text-white">{settlingNsu}</span>
                  </p>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">
                        Valor Efetivamente Creditado (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        data-testid="input-settle-amount"
                        value={settleAmount}
                        onChange={(e) => setSettleAmount(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-emerald-400 font-bold focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">
                        Taxa Retida pela Adquirente (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        data-testid="input-settle-fee"
                        value={settleFee}
                        onChange={(e) => setSettleFee(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">
                        Conta Bancária de Depósito
                      </label>
                      <input
                        type="text"
                        data-testid="input-settle-bank"
                        placeholder="Ex: BANCO DO BRASIL AG 1234 CC 5678"
                        value={settleBank}
                        onChange={(e) => setSettleBank(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSettlingNsu(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      data-testid="btn-confirm-settle"
                      disabled={isSubmittingSettle}
                      onClick={() => handleConfirmSettle(settlingNsu)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingSettle ? 'Baixando...' : 'Confirmar Baixa'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: DRE GERENCIAL ==================== */}
        {activeTab === 'DRE' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {isLoadingDre ? (
              <div className="text-center py-16 text-slate-500 text-xs">
                Calculando DRE Gerencial do período...
              </div>
            ) : dreReport ? (
              <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
                {/* DRE Header */}
                <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white">
                      Demonstração do Resultado do Exercício (DRE)
                    </h2>
                    <p className="text-xs text-slate-400">
                      Período de {dreReport.startDate} até {dreReport.endDate}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block uppercase">
                      Margem Operacional Líquida
                    </span>
                    <span
                      className={`text-lg font-black ${
                        dreReport.operatingResult >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {dreReport.operatingMarginPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* DRE Rows */}
                <div className="divide-y divide-slate-800 text-xs font-mono">
                  {/* Receita Bruta */}
                  <div className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-900/40">
                    <span className="font-bold text-white text-sm font-sans">
                      (+) RECEITA BRUTA DE VENDAS
                    </span>
                    <span className="text-sm font-bold text-white">
                      {formatBrl(dreReport.grossRevenue)}
                    </span>
                  </div>

                  {/* Deduções */}
                  <div className="px-6 py-2.5 flex items-center justify-between text-slate-400 pl-10">
                    <span>(-) Descontos Concedidos em Venda</span>
                    <span className="text-rose-400">-{formatBrl(dreReport.discounts)}</span>
                  </div>

                  <div className="px-6 py-2.5 flex items-center justify-between text-slate-400 pl-10">
                    <span>(-) Vendas Canceladas / Devoluções</span>
                    <span className="text-rose-400">-{formatBrl(dreReport.cancellations)}</span>
                  </div>

                  <div className="px-6 py-2.5 flex items-center justify-between text-slate-400 pl-10">
                    <span>(-) Taxas de Cartão / TEF (MDR Adquirentes)</span>
                    <span className="text-rose-400">-{formatBrl(dreReport.tefFees)}</span>
                  </div>

                  {/* Receita Líquida */}
                  <div className="px-6 py-3.5 bg-slate-900/60 flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-sm font-sans">
                      (=) RECEITA OPERACIONAL LÍQUIDA
                    </span>
                    <span className="text-sm font-bold text-slate-200">
                      {formatBrl(dreReport.netRevenue)}
                    </span>
                  </div>

                  {/* CMV */}
                  <div className="px-6 py-3 flex items-center justify-between pl-10 text-slate-300">
                    <span className="font-sans">
                      (-) Custo das Mercadorias Vendidas (CMV apurado por NF-e de Compra / PF)
                    </span>
                    <span className="text-rose-400 font-bold">-{formatBrl(dreReport.cmv)}</span>
                  </div>

                  {/* Lucro Bruto */}
                  <div className="px-6 py-3.5 bg-slate-900/60 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-200 text-sm font-sans">
                        (=) LUCRO BRUTO
                      </span>
                      <span className="text-[11px] text-slate-400 font-sans ml-2">
                        (Margem Bruta: {dreReport.grossMarginPercent.toFixed(2)}%)
                      </span>
                    </div>
                    <span className="text-sm font-bold text-emerald-400">
                      {formatBrl(dreReport.grossProfit)}
                    </span>
                  </div>

                  {/* Despesas Operacionais */}
                  <div className="px-6 py-3 flex items-center justify-between pl-10 text-slate-300">
                    <span className="font-sans">
                      (-) Despesas Operacionais (Sangrias e retiradas de caixa no período)
                    </span>
                    <span className="text-rose-400 font-bold">
                      -{formatBrl(dreReport.operatingExpenses)}
                    </span>
                  </div>

                  {/* Resultado Operacional Líquido */}
                  <div className="px-6 py-4 bg-slate-950 flex items-center justify-between border-t-2 border-slate-700">
                    <div>
                      <span className="font-black text-base text-white font-sans">
                        (=) RESULTADO OPERACIONAL LÍQUIDO
                      </span>
                      <span className="text-xs text-slate-400 font-sans ml-2">
                        {dreReport.operatingResult >= 0 ? '(Lucro Líquido)' : '(Prejuízo Operacional)'}
                      </span>
                    </div>
                    <span
                      className={`text-xl font-black ${
                        dreReport.operatingResult >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatBrl(dreReport.operatingResult)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ==================== TAB 4: CURVA ABC (80/20) ==================== */}
        {activeTab === 'ABC' && (
          <div className="space-y-6">
            {/* Category Filter and Summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-400">Categoria Farmacêutica:</span>
                <select
                  data-testid="select-abc-category"
                  value={abcCategoryFilter}
                  onChange={(e) => setAbcCategoryFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-hidden"
                >
                  <option value="TODAS">Todas as Categorias</option>
                  <option value="REFERENCIA">Medicamento de Referência</option>
                  <option value="GENERICO">Genérico</option>
                  <option value="SIMILAR">Similar</option>
                  <option value="PERFUMARIA">Perfumaria & Higiene</option>
                  <option value="CORRELATOS_OUTROS">Correlatos & Outros</option>
                </select>
              </div>

              {abcReport && (
                <div className="flex items-center space-x-4">
                  <div className="text-slate-400">
                    Faturamento Analisado:{' '}
                    <span className="text-emerald-400 font-bold font-mono">
                      {formatBrl(abcReport.totalRevenue)}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    Itens Vendidos:{' '}
                    <span className="text-white font-bold">{abcReport.totalItemsSold}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ABC Distribution Cards */}
            {abcReport && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Classe A */}
                <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/40">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-950 text-emerald-300 border border-emerald-600">
                      CLASSE A (80% Faturamento)
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {formatBrl(abcReport.classRevenues.A)}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-white mt-2">
                    {abcReport.classCounts.A}{' '}
                    <span className="text-xs text-slate-400 font-normal">produtos topo de faturamento</span>
                  </p>
                </div>

                {/* Classe B */}
                <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/40">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-950 text-blue-300 border border-blue-600">
                      CLASSE B (15% Faturamento)
                    </span>
                    <span className="text-xs font-mono font-bold text-blue-400">
                      {formatBrl(abcReport.classRevenues.B)}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-white mt-2">
                    {abcReport.classCounts.B}{' '}
                    <span className="text-xs text-slate-400 font-normal">produtos intermediários</span>
                  </p>
                </div>

                {/* Classe C */}
                <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/40">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-950 text-amber-300 border border-amber-600">
                      CLASSE C (5% Cauda Longa)
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {formatBrl(abcReport.classRevenues.C)}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-white mt-2">
                    {abcReport.classCounts.C}{' '}
                    <span className="text-xs text-slate-400 font-normal">produtos baixo giro</span>
                  </p>
                </div>
              </div>
            )}

            {/* ABC Ranking Table */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-center">Rank</th>
                      <th className="px-4 py-3">Produto / EAN</th>
                      <th className="px-4 py-3">Categoria</th>
                      <th className="px-4 py-3 text-right">Qtd Vendida</th>
                      <th className="px-4 py-3 text-right">Faturamento</th>
                      <th className="px-4 py-3 text-right">Part. %</th>
                      <th className="px-4 py-3 text-right">% Acumulado</th>
                      <th className="px-4 py-3 text-center">Classe ABC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                    {isLoadingAbc ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-sans">
                          Calculando Curva ABC 80/20...
                        </td>
                      </tr>
                    ) : !abcReport || abcReport.items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-sans">
                          Nenhuma venda registrada no período para cálculo da curva ABC.
                        </td>
                      </tr>
                    ) : (
                      abcReport.items.map((item: AbcCurveItem) => (
                        <tr key={item.productId} className="hover:bg-slate-900/60 transition font-sans">
                          <td className="px-4 py-3 text-center font-bold text-white">#{item.rank}</td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-white block">{item.productName}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{item.ean}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-[11px]">{item.category}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            {item.quantitySold}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-white">
                            {formatBrl(item.grossRevenue)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            {item.revenueSharePercent.toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-400">
                            {item.cumulativeSharePercent.toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-3 py-1 rounded-full text-[11px] font-black border ${
                                item.abcClass === 'A'
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                  : item.abcClass === 'B'
                                  ? 'bg-blue-950 text-blue-300 border-blue-600'
                                  : 'bg-amber-950 text-amber-300 border-amber-600'
                              }`}
                            >
                              Classe {item.abcClass}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Review & Print Modal */}
      <ClosureReviewModal
        isOpen={isReviewModalOpen}
        closure={selectedClosure}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedClosure(null);
        }}
        onReviewed={(updated) => {
          setSelectedClosure(updated);
          setSuccessMessage(`Fechamento #${updated.id} homologado com sucesso.`);
          loadClosures();
        }}
      />
    </div>
  );
}
