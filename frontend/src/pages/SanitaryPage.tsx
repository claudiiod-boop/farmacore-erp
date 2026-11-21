import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../contexts/StoreContext';
import {
  Calendar,
  ShieldAlert,
  FileCheck2,
  AlertTriangle,
  Search,
  Printer,
  Plus,
  CheckCircle2,
  RefreshCw,
  X,
  Phone,
  FileText,
  Building,
  UserCheck,
  Check,
} from 'lucide-react';
import { sanitaryApi } from '../services/api';
import type {
  ExpiryRiskCategory,
  ExpiryRiskMatrix,
  ExpiringBatchItem,
  AnvisaRecallWithItems,
  AffectedPatientItem,
  InventoryLossWithItems,
  InventoryLossReason,
  AnvisaRecallActionTaken,
} from '../types/sanitary';

interface SanitaryPageProps {
  currentStoreId?: number;
}

export const SanitaryPage: React.FC<SanitaryPageProps> = ({ currentStoreId: propStoreId }) => {
  let contextStoreId = 1;
  try {
    const storeCtx = useStore();
    if (storeCtx && storeCtx.currentStore && storeCtx.currentStore.id) {
      contextStoreId = storeCtx.currentStore.id;
    }
  } catch {
    // context not available, fallback
  }

  const currentStoreId = propStoreId ?? contextStoreId;
  // Tabs: 'EXPIRY' | 'RECALL' | 'LOSSES'
  const [activeTab, setActiveTab] = useState<'EXPIRY' | 'RECALL' | 'LOSSES'>('EXPIRY');

  // Loading & notification states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tab 1: Expiry states
  const [matrix, setMatrix] = useState<ExpiryRiskMatrix | null>(null);
  const [batches, setBatches] = useState<ExpiringBatchItem[]>([]);
  const [totalBatches, setTotalBatches] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<ExpiryRiskCategory | ''>('');
  const [batchSearch, setBatchSearch] = useState('');

  // Tab 2: Recall states
  const [recalls, setRecalls] = useState<AnvisaRecallWithItems[]>([]);
  const [selectedRecall, setSelectedRecall] = useState<AnvisaRecallWithItems | null>(null);
  const [affectedPatients, setAffectedPatients] = useState<AffectedPatientItem[]>([]);
  const [isNewRecallModalOpen, setIsNewRecallModalOpen] = useState(false);
  const [isPatientsModalOpen, setIsPatientsModalOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  // Tab 3: Losses states
  const [losses, setLosses] = useState<InventoryLossWithItems[]>([]);
  const [isNewLossModalOpen, setIsNewLossModalOpen] = useState(false);
  const [isDisposalModalOpen, setIsDisposalModalOpen] = useState(false);
  const [selectedLossForDisposal, setSelectedLossForDisposal] = useState<InventoryLossWithItems | null>(null);

  // Print modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printModalTitle, setPrintModalTitle] = useState('');
  const [printText, setPrintText] = useState('');

  // Auto-dismiss alerts
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Load Expiry Data
  const loadExpiryData = useCallback(async () => {
    try {
      setLoading(true);
      const [matrixData, batchData] = await Promise.all([
        sanitaryApi.getExpiryMatrix(currentStoreId),
        sanitaryApi.getExpiringBatches({
          storeId: currentStoreId,
          category: selectedCategory || undefined,
          search: batchSearch.trim() || undefined,
          limit: 100,
        }),
      ]);
      setMatrix(matrixData);
      setBatches(batchData.batches);
      setTotalBatches(batchData.total);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar matriz de validades');
    } finally {
      setLoading(false);
    }
  }, [currentStoreId, selectedCategory, batchSearch]);

  // Load Recalls
  const loadRecalls = useCallback(async () => {
    try {
      setLoading(true);
      const data = await sanitaryApi.getRecalls();
      setRecalls(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar recalls sanitários');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Losses
  const loadLosses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await sanitaryApi.getLosses({ storeId: currentStoreId });
      setLosses(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar histórico de perdas');
    } finally {
      setLoading(false);
    }
  }, [currentStoreId]);

  // Initial load based on tab
  useEffect(() => {
    if (activeTab === 'EXPIRY') {
      loadExpiryData();
    } else if (activeTab === 'RECALL') {
      loadRecalls();
    } else if (activeTab === 'LOSSES') {
      loadLosses();
    }
  }, [activeTab, loadExpiryData, loadRecalls, loadLosses]);

  // Handlers for Expiry Tab
  const handlePrintAuditSlip = async (category?: ExpiryRiskCategory) => {
    try {
      setLoading(true);
      const res = await sanitaryApi.getExpiryAuditSlip(currentStoreId, category);
      setPrintModalTitle('Lista de Conferência Física de Validades');
      setPrintText(res.text);
      setIsPrintModalOpen(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao gerar filipeta de conferência');
    } finally {
      setLoading(false);
    }
  };

  // Handlers for Recall Tab
  const handleViewPatients = async (recall: AnvisaRecallWithItems) => {
    try {
      setLoading(true);
      setSelectedRecall(recall);
      const patients = await sanitaryApi.getAffectedPatients(recall.id);
      setAffectedPatients(patients);
      setIsPatientsModalOpen(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao consultar pacientes afetados');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPatientReport = async (recall: AnvisaRecallWithItems) => {
    try {
      setLoading(true);
      const res = await sanitaryApi.getRecallPatientReport(recall.id);
      setPrintModalTitle(`Relatório de Pacientes — Resolução ${recall.resolutionNumber}`);
      setPrintText(res.text);
      setIsPrintModalOpen(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao emitir relatório de pacientes');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveRecallSubmit = async (actionTaken: AnvisaRecallActionTaken, notes?: string) => {
    if (!selectedRecall) return;
    try {
      setLoading(true);
      await sanitaryApi.resolveRecall(selectedRecall.id, { actionTaken, notes });
      setSuccessMessage(`Recall ${selectedRecall.resolutionNumber} concluído com sucesso!`);
      setIsResolveModalOpen(false);
      setSelectedRecall(null);
      loadRecalls();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao concluir recall');
    } finally {
      setLoading(false);
    }
  };

  // Handlers for Losses Tab
  const handleApproveLoss = async (lossId: number) => {
    try {
      setLoading(true);
      await sanitaryApi.approveLoss(lossId, {
        notes: 'Aprovação pelo responsável técnico',
      });
      setSuccessMessage('Baixa aprovada com sucesso! Estoque físico e contábil deduzido.');
      loadLosses();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao aprovar baixa de perda');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDisposalModal = (loss: InventoryLossWithItems) => {
    setSelectedLossForDisposal(loss);
    setIsDisposalModalOpen(true);
  };

  const handleDisposalSubmit = async (formData: {
    disposalCompanyName: string;
    disposalCertificateNumber: string;
    mtrNumber?: string;
    laudoNumber?: string;
  }) => {
    if (!selectedLossForDisposal) return;
    try {
      setLoading(true);
      await sanitaryApi.recordDisposalCertificate(selectedLossForDisposal.id, formData);
      setSuccessMessage('Certificado de descarte e MTR registrados com sucesso!');
      setIsDisposalModalOpen(false);
      setSelectedLossForDisposal(null);
      loadLosses();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao registrar certificado de descarte');
    } finally {
      setLoading(false);
    }
  };

  const handleViewLaudo = async (loss: InventoryLossWithItems) => {
    try {
      setLoading(true);
      const res = await sanitaryApi.getLossLaudo(loss.id);
      setPrintModalTitle(`Laudo Oficial VISA — ${loss.lossNumber}`);
      setPrintText(res.text);
      setIsPrintModalOpen(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao emitir Laudo VISA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 overflow-hidden" data-testid="sanitary-page">
      {/* Header */}
      <div className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-rose-950/80 border border-rose-600/40 rounded-xl text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Central de Validades & Vigilância Sanitária
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-700/50">
                F12
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Painel 30/60/90 Dias, Recall Compulsório Anvisa (RDC 658) e Baixas de Perdas com Laudo VISA (RDC 306)
              {totalBatches > 0 && <span className="ml-2 text-slate-300 font-medium">({totalBatches} lotes monitorados)</span>}
            </p>
          </div>
          {loading && (
            <div className="flex items-center text-xs text-rose-400 gap-1.5 ml-4 font-semibold animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Carregando...</span>
            </div>
          )}
        </div>

        {/* Global Tab Navigation */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            data-testid="tab-expiry"
            onClick={() => setActiveTab('EXPIRY')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
              activeTab === 'EXPIRY'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Painel de Validades</span>
          </button>

          <button
            type="button"
            data-testid="tab-recall"
            onClick={() => setActiveTab('RECALL')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
              activeTab === 'RECALL'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Recall Anvisa</span>
          </button>

          <button
            type="button"
            data-testid="tab-losses"
            onClick={() => setActiveTab('LOSSES')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
              activeTab === 'LOSSES'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Baixas & Laudo VISA</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="bg-red-950/80 border-b border-red-800 text-red-200 px-6 py-2.5 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-950/80 border-b border-emerald-800 text-emerald-200 px-6 py-2.5 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab 1: Validades Preditivas */}
      {activeTab === 'EXPIRY' && (
        <div className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto" data-testid="expiry-tab-content">
          {/* 5 Risk Cards */}
          {matrix && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Vencidos */}
              <div
                onClick={() => setSelectedCategory(selectedCategory === 'EXPIRED' ? '' : 'EXPIRED')}
                className={`p-4 rounded-xl border transition cursor-pointer ${
                  selectedCategory === 'EXPIRED'
                    ? 'bg-red-950/90 border-red-500 shadow-md ring-1 ring-red-500'
                    : 'bg-red-950/30 border-red-900/60 hover:bg-red-950/50'
                }`}
                data-testid="card-risk-expired"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Vencidos (&lt; 0 dias)</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-900/60 text-red-300 border border-red-700/50">
                    {matrix.tiers.EXPIRED.batchCount} lotes
                  </span>
                </div>
                <div className="text-2xl font-black text-white">{matrix.tiers.EXPIRED.unitCount} un</div>
                <div className="mt-2 text-[11px] text-slate-300 flex justify-between">
                  <span>Custo: R$ {matrix.tiers.EXPIRED.totalCost.toFixed(2)}</span>
                  <span>Venda: R$ {matrix.tiers.EXPIRED.totalSale.toFixed(2)}</span>
                </div>
              </div>

              {/* Risco 30 Dias */}
              <div
                onClick={() => setSelectedCategory(selectedCategory === 'RISK_30_DAYS' ? '' : 'RISK_30_DAYS')}
                className={`p-4 rounded-xl border transition cursor-pointer ${
                  selectedCategory === 'RISK_30_DAYS'
                    ? 'bg-orange-950/90 border-orange-500 shadow-md ring-1 ring-orange-500'
                    : 'bg-orange-950/30 border-orange-900/60 hover:bg-orange-950/50'
                }`}
                data-testid="card-risk-30"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Crítico (&le; 30 dias)</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-900/60 text-orange-300 border border-orange-700/50">
                    {matrix.tiers.RISK_30_DAYS.batchCount} lotes
                  </span>
                </div>
                <div className="text-2xl font-black text-white">{matrix.tiers.RISK_30_DAYS.unitCount} un</div>
                <div className="mt-2 text-[11px] text-slate-300 flex justify-between">
                  <span>Custo: R$ {matrix.tiers.RISK_30_DAYS.totalCost.toFixed(2)}</span>
                  <span>Venda: R$ {matrix.tiers.RISK_30_DAYS.totalSale.toFixed(2)}</span>
                </div>
              </div>

              {/* Risco 60 Dias */}
              <div
                onClick={() => setSelectedCategory(selectedCategory === 'RISK_60_DAYS' ? '' : 'RISK_60_DAYS')}
                className={`p-4 rounded-xl border transition cursor-pointer ${
                  selectedCategory === 'RISK_60_DAYS'
                    ? 'bg-amber-950/90 border-amber-500 shadow-md ring-1 ring-amber-500'
                    : 'bg-amber-950/30 border-amber-900/60 hover:bg-amber-950/50'
                }`}
                data-testid="card-risk-60"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Alerta (31 a 60 dias)</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-900/60 text-amber-300 border border-amber-700/50">
                    {matrix.tiers.RISK_60_DAYS.batchCount} lotes
                  </span>
                </div>
                <div className="text-2xl font-black text-white">{matrix.tiers.RISK_60_DAYS.unitCount} un</div>
                <div className="mt-2 text-[11px] text-slate-300 flex justify-between">
                  <span>Custo: R$ {matrix.tiers.RISK_60_DAYS.totalCost.toFixed(2)}</span>
                  <span>Venda: R$ {matrix.tiers.RISK_60_DAYS.totalSale.toFixed(2)}</span>
                </div>
              </div>

              {/* Risco 90 Dias */}
              <div
                onClick={() => setSelectedCategory(selectedCategory === 'RISK_90_DAYS' ? '' : 'RISK_90_DAYS')}
                className={`p-4 rounded-xl border transition cursor-pointer ${
                  selectedCategory === 'RISK_90_DAYS'
                    ? 'bg-blue-950/90 border-blue-500 shadow-md ring-1 ring-blue-500'
                    : 'bg-blue-950/30 border-blue-900/60 hover:bg-blue-950/50'
                }`}
                data-testid="card-risk-90"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Atenção (61 a 90 dias)</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-900/60 text-blue-300 border border-blue-700/50">
                    {matrix.tiers.RISK_90_DAYS.batchCount} lotes
                  </span>
                </div>
                <div className="text-2xl font-black text-white">{matrix.tiers.RISK_90_DAYS.unitCount} un</div>
                <div className="mt-2 text-[11px] text-slate-300 flex justify-between">
                  <span>Custo: R$ {matrix.tiers.RISK_90_DAYS.totalCost.toFixed(2)}</span>
                  <span>Venda: R$ {matrix.tiers.RISK_90_DAYS.totalSale.toFixed(2)}</span>
                </div>
              </div>

              {/* Seguro */}
              <div
                onClick={() => setSelectedCategory(selectedCategory === 'SAFE' ? '' : 'SAFE')}
                className={`p-4 rounded-xl border transition cursor-pointer ${
                  selectedCategory === 'SAFE'
                    ? 'bg-emerald-950/90 border-emerald-500 shadow-md ring-1 ring-emerald-500'
                    : 'bg-emerald-950/30 border-emerald-900/60 hover:bg-emerald-950/50'
                }`}
                data-testid="card-risk-safe"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Seguro (&gt; 90 dias)</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
                    {matrix.tiers.SAFE.batchCount} lotes
                  </span>
                </div>
                <div className="text-2xl font-black text-white">{matrix.tiers.SAFE.unitCount} un</div>
                <div className="mt-2 text-[11px] text-slate-300 flex justify-between">
                  <span>Custo: R$ {matrix.tiers.SAFE.totalCost.toFixed(2)}</span>
                  <span>Venda: R$ {matrix.tiers.SAFE.totalSale.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action and Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-3 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar por produto, EAN ou número do lote..."
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs border border-slate-700 flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpar filtro</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                data-testid="print-audit-slip-button"
                onClick={() => handlePrintAuditSlip(selectedCategory || undefined)}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg font-bold text-xs bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition cursor-pointer"
              >
                <Printer className="w-4 h-4 text-rose-400" />
                <span>Imprimir Lista de Conferência Física</span>
              </button>

              <button
                type="button"
                data-testid="quick-loss-button"
                onClick={() => {
                  setActiveTab('LOSSES');
                  setIsNewLossModalOpen(true);
                }}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Baixa por Vencimento</span>
              </button>
            </div>
          </div>

          {/* Batches Table */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Produto</th>
                    <th className="px-4 py-3 font-semibold">EAN</th>
                    <th className="px-4 py-3 font-semibold">Lote</th>
                    <th className="px-4 py-3 font-semibold">Validade</th>
                    <th className="px-4 py-3 font-semibold text-center">Dias Restantes</th>
                    <th className="px-4 py-3 font-semibold text-right">Saldo</th>
                    <th className="px-4 py-3 font-semibold text-right">Custo Unit</th>
                    <th className="px-4 py-3 font-semibold text-right">Preço Venda</th>
                    <th className="px-4 py-3 font-semibold text-center">Ação Sugerida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        Nenhum lote encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    batches.map((b) => (
                      <tr key={b.batchId} className="hover:bg-slate-900/50 transition">
                        <td className="px-4 py-3 font-medium text-white">{b.productName}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{b.ean}</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-200">
                          {b.batchNumber}
                          {b.isBlocked && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-red-900/80 text-red-200 border border-red-700">
                              BLOQUEADO
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono">{b.expirationDate}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold font-mono text-[11px] ${
                              b.daysUntilExpiration < 0
                                ? 'bg-red-950 text-red-400 border border-red-800'
                                : b.daysUntilExpiration <= 30
                                ? 'bg-orange-950 text-orange-400 border border-orange-800'
                                : b.daysUntilExpiration <= 60
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : b.daysUntilExpiration <= 90
                                ? 'bg-blue-950 text-blue-400 border border-blue-800'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}
                          >
                            {b.daysUntilExpiration} dias
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-white">{b.quantity} un</td>
                        <td className="px-4 py-3 text-right font-mono">R$ {b.unitCost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">
                          R$ {b.unitSalePrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase tracking-wider ${
                              b.suggestedAction === 'DISPOSE'
                                ? 'bg-red-900/60 text-red-300 border border-red-700/60'
                                : b.suggestedAction === 'PROMOTION'
                                ? 'bg-orange-900/60 text-orange-300 border border-orange-700/60'
                                : b.suggestedAction === 'RETURN_TO_SUPPLIER'
                                ? 'bg-blue-900/60 text-blue-300 border border-blue-700/60'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {b.suggestedAction === 'DISPOSE'
                              ? 'Segregar / Baixar'
                              : b.suggestedAction === 'PROMOTION'
                              ? 'Queima Promocional'
                              : b.suggestedAction === 'RETURN_TO_SUPPLIER'
                              ? 'Devolução Distribuidor'
                              : 'Normal'}
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

      {/* Tab 2: Recall Anvisa */}
      {activeTab === 'RECALL' && (
        <div className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto" data-testid="recall-tab-content">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Resoluções Sanitárias de Recolhimento (Anvisa)</h2>
              <p className="text-xs text-slate-400">
                Lotes com bloqueio automático de vendas e rastreabilidade reversa de compradores (RDC 658/2022).
              </p>
            </div>
            <button
              type="button"
              data-testid="new-recall-button"
              onClick={() => setIsNewRecallModalOpen(true)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Resolução Anvisa</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {recalls.length === 0 ? (
              <div className="bg-slate-950 p-8 rounded-xl border border-slate-800 text-center text-slate-500">
                Nenhuma resolução de recall sanitário registrada.
              </div>
            ) : (
              recalls.map((recall) => (
                <div
                  key={recall.id}
                  className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col gap-4"
                  data-testid={`recall-item-${recall.id}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-bold text-rose-400 font-mono">{recall.resolutionNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          recall.status === 'ACTIVE'
                            ? 'bg-rose-950 text-rose-300 border border-rose-700'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        }`}
                      >
                        {recall.status === 'ACTIVE' ? 'Interdição Ativa' : 'Recolhimento Concluído'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center space-x-4">
                      <span>Data Resolução: {recall.resolutionDate}</span>
                      <span>Publicação DOU: {recall.publicationDate}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-400">Motivo Sanitário:</div>
                    <div className="text-sm text-slate-200 mt-0.5">{recall.reason}</div>
                  </div>

                  {/* Items Affected */}
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <div className="text-xs font-bold text-slate-300 mb-2">Lotes Interditados / Bloqueados:</div>
                    <div className="space-y-1.5">
                      {recall.items.map((it) => (
                        <div key={it.id} className="text-xs flex justify-between items-center text-slate-400">
                          <span>
                            <strong className="text-slate-200">{it.productName ?? `Produto #${it.productId}`}</strong>{' '}
                            | Lote: <code className="text-rose-300 font-bold">{it.batchNumber}</code>
                          </span>
                          <span className="text-slate-300">
                            Estoque Bloqueado: <strong>{it.totalStockBlocked} un</strong> | Ação:{' '}
                            <span className="text-amber-400">{it.actionTaken}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      data-testid={`btn-patients-${recall.id}`}
                      onClick={() => handleViewPatients(recall)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                      <span>Pacientes Afetados (Rastreabilidade)</span>
                    </button>

                    <button
                      type="button"
                      data-testid={`btn-print-report-${recall.id}`}
                      onClick={() => handlePrintPatientReport(recall)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-400" />
                      <span>Imprimir Relatório</span>
                    </button>

                    {recall.status === 'ACTIVE' && (
                      <button
                        type="button"
                        data-testid={`btn-resolve-${recall.id}`}
                        onClick={() => {
                          setSelectedRecall(recall);
                          setIsResolveModalOpen(true);
                        }}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Concluir Recolhimento</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Baixas & Laudo VISA */}
      {activeTab === 'LOSSES' && (
        <div className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto" data-testid="losses-tab-content">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Baixas Regulamentares de Perdas e Descarte Sanitário</h2>
              <p className="text-xs text-slate-400">
                Laudos para fiscalização da Vigilância Sanitária (VISA) e manifesto de resíduos de saúde (MTR).
              </p>
            </div>
            <button
              type="button"
              data-testid="new-loss-button"
              onClick={() => setIsNewLossModalOpen(true)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Baixa de Estoque</span>
            </button>
          </div>

          {/* Losses Table */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Número</th>
                    <th className="px-4 py-3 font-semibold">Motivo</th>
                    <th className="px-4 py-3 font-semibold">Farmacêutico RT</th>
                    <th className="px-4 py-3 font-semibold">Itens</th>
                    <th className="px-4 py-3 font-semibold text-right">Custo Total</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                    <th className="px-4 py-3 font-semibold">Data</th>
                    <th className="px-4 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {losses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Nenhuma baixa regulatória de perda cadastrada.
                      </td>
                    </tr>
                  ) : (
                    losses.map((loss) => (
                      <tr key={loss.id} className="hover:bg-slate-900/50 transition" data-testid={`loss-row-${loss.id}`}>
                        <td className="px-4 py-3 font-mono font-bold text-white">{loss.lossNumber}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-200">{loss.reason}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-200">{loss.responsiblePharmacistName}</div>
                          <div className="text-[11px] text-slate-400">
                            CRF/{loss.pharmacistCrfUf} {loss.pharmacistCrf}
                          </div>
                        </td>
                        <td className="px-4 py-3">{loss.items.length} itens</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-rose-400">
                          R$ {loss.totalCostAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              loss.status === 'DRAFT'
                                ? 'bg-amber-950 text-amber-300 border border-amber-700'
                                : loss.status === 'APPROVED'
                                ? 'bg-blue-950 text-blue-300 border border-blue-700'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            }`}
                          >
                            {loss.status === 'DRAFT'
                              ? 'Rascunho'
                              : loss.status === 'APPROVED'
                              ? 'Aprovado'
                              : 'Descartado / Incinerado'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-400">{loss.createdAt.split(' ')[0]}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {loss.status === 'DRAFT' && (
                              <button
                                type="button"
                                data-testid={`btn-approve-loss-${loss.id}`}
                                onClick={() => handleApproveLoss(loss.id)}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition"
                              >
                                Aprovar Baixa
                              </button>
                            )}

                            {loss.status === 'APPROVED' && (
                              <button
                                type="button"
                                data-testid={`btn-disposal-${loss.id}`}
                                onClick={() => handleOpenDisposalModal(loss)}
                                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition"
                              >
                                Registrar Descarte / MTR
                              </button>
                            )}

                            <button
                              type="button"
                              data-testid={`btn-laudo-${loss.id}`}
                              onClick={() => handleViewLaudo(loss)}
                              title="Visualizar Laudo Oficial VISA"
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 transition"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* MODAL 1: Pacientes Afetados por Recall */}
      {isPatientsModalOpen && selectedRecall && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            data-testid="modal-affected-patients"
          >
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-rose-400" />
                  Rastreabilidade Reversa de Pacientes
                </h3>
                <p className="text-xs text-slate-400">Resolução {selectedRecall.resolutionNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPatientsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {affectedPatients.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Nenhum registro de compra localizado para os lotes interditados nesta filial.
                </div>
              ) : (
                <div className="space-y-3">
                  {affectedPatients.map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="text-sm font-bold text-white">{p.customerName}</div>
                        <div className="text-slate-400 flex items-center gap-3 mt-1">
                          {p.cpf && <span>CPF: {p.cpf}</span>}
                          {p.phone && <span>Tel: {p.phone}</span>}
                        </div>
                        <div className="text-slate-400 mt-1">
                          Venda #{p.saleId} em {p.saleDate} | Qtd Adquirida:{' '}
                          <strong className="text-rose-400">{p.quantity} un</strong>
                        </div>
                        {p.hasPrescription && p.prescriptionDoctor && (
                          <div className="text-blue-400 text-[11px] mt-0.5">Prescritor: {p.prescriptionDoctor}</div>
                        )}
                      </div>

                      {p.phone && (
                        <a
                          href={`https://wa.me/55${p.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Olá ${p.customerName}, informamos um aviso sanitário urgente referente ao produto adquirido na FarmaCore.`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Avisar WhatsApp</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPatientsModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Cadastrar Recall Anvisa */}
      {isNewRecallModalOpen && (
        <NewRecallModal
          onClose={() => setIsNewRecallModalOpen(false)}
          onSuccess={() => {
            setIsNewRecallModalOpen(false);
            setSuccessMessage('Recall Sanitário cadastrado e lotes bloqueados com sucesso!');
            loadRecalls();
          }}
        />
      )}

      {/* MODAL 3: Concluir Recall */}
      {isResolveModalOpen && selectedRecall && (
        <ResolveRecallModal
          recall={selectedRecall}
          onClose={() => setIsResolveModalOpen(false)}
          onSubmit={handleResolveRecallSubmit}
        />
      )}

      {/* MODAL 4: Nova Baixa de Perda */}
      {isNewLossModalOpen && (
        <NewLossModal
          storeId={currentStoreId}
          onClose={() => setIsNewLossModalOpen(false)}
          onSuccess={() => {
            setIsNewLossModalOpen(false);
            setSuccessMessage('Rascunho de baixa de perda criado com sucesso!');
            loadLosses();
          }}
        />
      )}

      {/* MODAL 5: Registrar Descarte / MTR */}
      {isDisposalModalOpen && selectedLossForDisposal && (
        <DisposalModal
          loss={selectedLossForDisposal}
          onClose={() => setIsDisposalModalOpen(false)}
          onSubmit={handleDisposalSubmit}
        />
      )}

      {/* MODAL 6: Preview de Impressão ESC/POS */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            data-testid="modal-print-preview"
          >
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Printer className="w-5 h-5 text-rose-400" />
                {printModalTitle}
              </h3>
              <button type="button" onClick={() => setIsPrintModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-tight select-all">
                {printText}
              </pre>
            </div>

            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 text-xs font-semibold"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                Imprimir na Térmica
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Subcomponent: New Recall Modal
interface NewRecallModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const NewRecallModal: React.FC<NewRecallModalProps> = ({ onClose, onSuccess }) => {
  const [resolutionNumber, setResolutionNumber] = useState('');
  const [resolutionDate, setResolutionDate] = useState(new Date().toISOString().split('T')[0]);
  const [publicationDate, setPublicationDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [productId, setProductId] = useState<number>(101);
  const [batchNumber, setBatchNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionNumber.trim() || !reason.trim() || !batchNumber.trim()) {
      setError('Preencha os campos obrigatórios da Resolução Anvisa e do lote');
      return;
    }

    try {
      setSubmitting(true);
      await sanitaryApi.registerRecall({
        resolutionNumber: resolutionNumber.trim(),
        resolutionDate,
        publicationDate,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        items: [
          {
            productId: Number(productId),
            batchNumber: batchNumber.trim(),
          },
        ],
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar recall');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <form onSubmit={handleSubmit} data-testid="form-new-recall">
          <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              Cadastrar Resolução de Recall Anvisa
            </h3>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4 text-xs">
            {error && <div className="p-3 bg-red-950 text-red-300 rounded-lg border border-red-800">{error}</div>}

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Número da Resolução RE *</label>
              <input
                type="text"
                placeholder="Ex: RE 1.234/2026"
                value={resolutionNumber}
                onChange={(e) => setResolutionNumber(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Data da Resolução</label>
                <input
                  type="date"
                  value={resolutionDate}
                  onChange={(e) => setResolutionDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Publicação no DOU</label>
                <input
                  type="date"
                  value={publicationDate}
                  onChange={(e) => setPublicationDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Motivo Sanitário do Recolhimento *</label>
              <textarea
                rows={2}
                placeholder="Ex: Desvio de qualidade teor de princípio ativo / contaminação microbiológica..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Observações Adicionais</label>
              <input
                type="text"
                placeholder="Ex: Publicado no DOU Seção 1..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>

            <div className="border-t border-slate-800 pt-3">
              <label className="block font-bold text-slate-300 mb-2">Lote a Interditar *</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">ID do Produto</label>
                  <input
                    type="number"
                    value={productId}
                    onChange={(e) => setProductId(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Número do Lote</label>
                  <input
                    type="text"
                    placeholder="Ex: LOTE-1234"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50"
            >
              {submitting ? 'Bloqueando Lotes...' : 'Registrar & Bloquear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Subcomponent: Resolve Recall Modal
interface ResolveRecallModalProps {
  recall: AnvisaRecallWithItems;
  onClose: () => void;
  onSubmit: (actionTaken: AnvisaRecallActionTaken, notes?: string) => Promise<void>;
}

const ResolveRecallModal: React.FC<ResolveRecallModalProps> = ({ recall, onClose, onSubmit }) => {
  const [actionTaken, setActionTaken] = useState<AnvisaRecallActionTaken>('RETURNED_TO_SUPPLIER');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(actionTaken, notes);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <form onSubmit={handleFormSubmit}>
          <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Concluir Recall {recall.resolutionNumber}</h3>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Destinação Final dos Lotes *</label>
              <select
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value as AnvisaRecallActionTaken)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              >
                <option value="RETURNED_TO_SUPPLIER">Devolução ao Fabricante / Distribuidora</option>
                <option value="DESTROYED">Descarte e Incineração Sanitária RSS</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Notas de Fechamento / NF de Devolução</label>
              <textarea
                rows={2}
                placeholder="Ex: Devolvido com NF 1234 / Coletado para incineração..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
            >
              {submitting ? 'Concluindo...' : 'Confirmar Conclusão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Subcomponent: New Loss Modal
interface NewLossModalProps {
  storeId: number;
  onClose: () => void;
  onSuccess: () => void;
}

const NewLossModal: React.FC<NewLossModalProps> = ({ storeId, onClose, onSuccess }) => {
  const [reason, setReason] = useState<InventoryLossReason>('EXPIRED');
  const [responsiblePharmacistName, setResponsiblePharmacistName] = useState('Dra. Farmacêutica Responsável');
  const [pharmacistCrf, setPharmacistCrf] = useState('12345');
  const [pharmacistCrfUf, setPharmacistCrfUf] = useState('SP');
  const [notes, setNotes] = useState('');
  const [productId, setProductId] = useState<number>(101);
  const [batchNumber, setBatchNumber] = useState('LOTE-01');
  const [expirationDate, setExpirationDate] = useState('2026-10-31');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(15.0);
  const [unitSalePrice, setUnitSalePrice] = useState<number>(30.0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      setError('A quantidade deve ser maior que zero');
      return;
    }

    try {
      setSubmitting(true);
      await sanitaryApi.createLossDraft({
        storeId,
        reason,
        responsiblePharmacistName,
        pharmacistCrf,
        pharmacistCrfUf,
        notes: notes.trim() || undefined,
        items: [
          {
            productId: Number(productId),
            batchNumber,
            expirationDate,
            quantity: Number(quantity),
            unitCost: Number(unitCost),
            unitSalePrice: Number(unitSalePrice),
          },
        ],
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar baixa');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <form onSubmit={handleSubmit} data-testid="form-new-loss">
          <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-rose-500" />
              Registrar Baixa Regulatória de Perda
            </h3>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4 text-xs">
            {error && <div className="p-3 bg-red-950 text-red-300 rounded-lg border border-red-800">{error}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Motivo da Baixa *</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as InventoryLossReason)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                >
                  <option value="EXPIRED">Vencimento (Medicamento Vencido)</option>
                  <option value="BROKEN_DAMAGED">Quebra / Avaria Física</option>
                  <option value="RECALL_ANVISA">Recall Sanitário Anvisa</option>
                  <option value="TEMPERATURE_EXCURSION">Excursão de Temperatura (Termolábeis)</option>
                  <option value="THEFT_STOLEN">Furto / Sinistro</option>
                  <option value="OTHER">Outras Avarias Justificadas</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Farmacêutico RT *</label>
                <input
                  type="text"
                  value={responsiblePharmacistName}
                  onChange={(e) => setResponsiblePharmacistName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">CRF *</label>
                <input
                  type="text"
                  value={pharmacistCrf}
                  onChange={(e) => setPharmacistCrf(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">UF do CRF *</label>
                <input
                  type="text"
                  value={pharmacistCrfUf}
                  onChange={(e) => setPharmacistCrfUf(e.target.value.toUpperCase())}
                  maxLength={2}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono uppercase"
                />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <label className="block font-bold text-slate-300 mb-2">Item a Baixar</label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">ID Produto</label>
                  <input
                    type="number"
                    value={productId}
                    onChange={(e) => setProductId(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Lote</label>
                  <input
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Quantidade</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    min={1}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="block text-slate-400 mb-1">Validade</label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Custo Unit (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={unitCost}
                    onChange={(e) => setUnitCost(Number(e.target.value))}
                    min={0}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Preço Venda (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={unitSalePrice}
                    onChange={(e) => setUnitSalePrice(Number(e.target.value))}
                    min={0}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-slate-400 mb-1">Observações da Ocorrência</label>
                <input
                  type="text"
                  placeholder="Ex: Segregado na gaveta de avarias..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Salvar Rascunho'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Subcomponent: Disposal Certificate Modal
interface DisposalModalProps {
  loss: InventoryLossWithItems;
  onClose: () => void;
  onSubmit: (formData: {
    disposalCompanyName: string;
    disposalCertificateNumber: string;
    mtrNumber?: string;
    laudoNumber?: string;
  }) => Promise<void>;
}

const DisposalModal: React.FC<DisposalModalProps> = ({ loss, onClose, onSubmit }) => {
  const [disposalCompanyName, setDisposalCompanyName] = useState('EcoMed Soluções Ambientais Ltda');
  const [disposalCertificateNumber, setDisposalCertificateNumber] = useState('CDF-2026/001');
  const [mtrNumber, setMtrNumber] = useState('MTR-SP-2026-999');
  const [laudoNumber, setLaudoNumber] = useState(`LAUDO-${loss.lossNumber}`);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({
      disposalCompanyName,
      disposalCertificateNumber,
      mtrNumber: mtrNumber.trim() || undefined,
      laudoNumber: laudoNumber.trim() || undefined,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <form onSubmit={handleSubmit} data-testid="form-disposal-cert">
          <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-400" />
              Certificado de Descarte & MTR
            </h3>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Empresa de Destinação / Incineração RSS *</label>
              <input
                type="text"
                value={disposalCompanyName}
                onChange={(e) => setDisposalCompanyName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Número do Certificado CDF *</label>
              <input
                type="text"
                value={disposalCertificateNumber}
                onChange={(e) => setDisposalCertificateNumber(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Manifesto MTR</label>
                <input
                  type="text"
                  value={mtrNumber}
                  onChange={(e) => setMtrNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Número do Laudo</label>
                <input
                  type="text"
                  value={laudoNumber}
                  onChange={(e) => setLaudoNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Confirmar Descarte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
