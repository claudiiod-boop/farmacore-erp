import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Clock,
  Trash2,
  RotateCcw,
  RefreshCw,
  Plus,
  CheckCircle2,
  XCircle,
  FileText,
  Building2,
  Calendar,
  Layers,
  Search
} from 'lucide-react';
import { quarantineApi } from '../services/api';
import type {
  QuarantineRecord,
  RecallAlert,
  QuarantineKpis,
  QuarantineReason,
  QuarantineStatus
} from '../types';

export const QuarantineRegulatoryPage: React.FC = () => {
  const [storeId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'QUARANTINE' | 'RECALLS' | 'TRANSFER'>('QUARANTINE');

  // KPIs
  const [kpis, setKpis] = useState<QuarantineKpis>({
    total_quarantined_items: 0,
    total_quarantined_value: 0,
    active_recalls_count: 0,
    expired_items_in_quarantine: 0,
    disposed_pgrss_items: 0,
  });

  // Lista de Quarentena
  const [quarantineList, setQuarantineList] = useState<QuarantineRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [reasonFilter, setReasonFilter] = useState<string>('ALL');
  const [isSweeping, setIsSweeping] = useState(false);

  // Lista de Alertas de Recall
  const [recallsList, setRecallsList] = useState<RecallAlert[]>([]);

  // Modal de Resolução
  const [resolvingRecord, setResolvingRecord] = useState<QuarantineRecord | null>(null);
  const [resolutionType, setResolutionType] = useState<'DISPOSED_PGRSS' | 'RETURNED_TO_SUPPLIER' | 'RELEASED'>('DISPOSED_PGRSS');
  const [resolvedBy, setResolvedBy] = useState('Dra. Amanda - Farmacêutica RT');
  const [pharmacistCrf, setPharmacistCrf] = useState('CRF/SP 55443');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);

  // Formulário de Novo Recall
  const [newReNumber, setNewReNumber] = useState('');
  const [newRecallProductId, setNewRecallProductId] = useState('');
  const [newRecallBatchNumber, setNewRecallBatchNumber] = useState('');
  const [newRecallReason, setNewRecallReason] = useState('');
  const [newRecallSeverity, setNewRecallSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM'>('CRITICAL');
  const [isSubmittingRecall, setIsSubmittingRecall] = useState(false);

  // Formulário de Transferência Manual
  const [transfProductId, setTransfProductId] = useState('');
  const [transfBatchId, setTransfBatchId] = useState('');
  const [transfQuantity, setTransfQuantity] = useState('1');
  const [transfReason, setTransfReason] = useState<QuarantineReason>('DAMAGED');
  const [transfNotes, setTransfNotes] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [kpisData, qData, recallsData] = await Promise.all([
        quarantineApi.getKpis(storeId),
        quarantineApi.listQuarantine(
          storeId,
          statusFilter === 'ALL' ? undefined : statusFilter,
          reasonFilter === 'ALL' ? undefined : reasonFilter
        ),
        quarantineApi.listRecalls(),
      ]);
      setKpis(kpisData);
      setQuarantineList(qData);
      setRecallsList(recallsData);
    } catch (err) {
      console.error('Erro ao carregar dados de quarentena:', err);
    }
  }, [storeId, statusFilter, reasonFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Executa Varredura de Lotes Vencidos
  const handleSweepExpired = async () => {
    setIsSweeping(true);
    try {
      const result = await quarantineApi.sweepExpired(storeId, 'Varredura Auditoria FEFO');
      alert(`Varredura concluída! ${result.sweptBatchesCount} lotes (${result.totalUnitsQuarantined} un) transferidos para a quarentena.`);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao executar varredura: ${err.message}`);
    } finally {
      setIsSweeping(false);
    }
  };

  // Submete Resolução
  const handleConfirmResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingRecord) return;

    if (resolutionType === 'RELEASED' && !pharmacistCrf.trim()) {
      alert('A desinterdição exige o CRF do Farmacêutico RT.');
      return;
    }

    setIsSubmittingResolve(true);
    try {
      await quarantineApi.resolveQuarantine(resolvingRecord.id, {
        resolution: resolutionType,
        resolvedBy: resolvedBy.trim(),
        pharmacistCrf: pharmacistCrf.trim(),
        resolutionNotes: resolutionNotes.trim(),
      });
      alert('Quarentena resolvida com sucesso!');
      setResolvingRecord(null);
      setResolutionNotes('');
      await loadData();
    } catch (err: any) {
      alert(`Erro ao resolver quarentena: ${err.message}`);
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  // Cadastra Alerta de Recall
  const handleCreateRecall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReNumber || !newRecallProductId || !newRecallBatchNumber) {
      alert('Informe o Número da RE, ID do Produto e Número do Lote.');
      return;
    }

    setIsSubmittingRecall(true);
    try {
      const res = await quarantineApi.registerRecall({
        anvisaReNumber: newReNumber.trim(),
        productId: Number(newRecallProductId),
        batchNumber: newRecallBatchNumber.trim(),
        reason: newRecallReason.trim() || 'Alerta Notivisa',
        severity: newRecallSeverity,
        createdBy: 'Farmacovigilância Drogaria',
        autoBlockStock: true,
      });

      alert(`Alerta de Recall cadastrado com sucesso! ${res.unitsBlocked} unidades bloqueadas imediatamente.`);
      setNewReNumber('');
      setNewRecallProductId('');
      setNewRecallBatchNumber('');
      setNewRecallReason('');
      setActiveTab('RECALLS');
      await loadData();
    } catch (err: any) {
      alert(`Erro ao cadastrar recall: ${err.message}`);
    } finally {
      setIsSubmittingRecall(false);
    }
  };

  // Cadastra Transferência Manual
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transfProductId || !transfBatchId || !transfQuantity) {
      alert('Informe o ID do Produto, ID do Lote e Quantidade.');
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      await quarantineApi.transfer({
        storeId,
        productId: Number(transfProductId),
        batchId: Number(transfBatchId),
        quantity: Number(transfQuantity),
        reason: transfReason,
        origin: 'MANUAL',
        notes: transfNotes.trim() || undefined,
        quarantinedBy: 'Farmacêutico RT',
      });

      alert('Lote transferido para quarentena sanitária com sucesso!');
      setTransfProductId('');
      setTransfBatchId('');
      setTransfQuantity('1');
      setTransfNotes('');
      setActiveTab('QUARANTINE');
      await loadData();
    } catch (err: any) {
      alert(`Erro ao transferir: ${err.message}`);
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Header Principal */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-600 flex items-center justify-center shadow-lg shadow-rose-900/30">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              Quarentena Sanitária & Alertas Notivisa
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                RDC 44/2009 & RDC 222/2018 ANVISA
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Segregação Física de Lotes Vencidos, Avariados e Interdições Cautelares de Farmacovigilância
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            data-testid="sweep-expired-button"
            onClick={handleSweepExpired}
            disabled={isSweeping}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-900/30 cursor-pointer disabled:opacity-50"
          >
            <Clock className="w-3.5 h-3.5" />
            {isSweeping ? 'Varrendo Estoque...' : 'Varredura de Validades (FEFO)'}
          </button>

          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Grid de Indicadores Regulatórios */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-6 pb-2">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            Em Quarentena
          </span>
          <div className="text-2xl font-black text-rose-400 mt-1" data-testid="kpi-quarantined-items">
            {kpis.total_quarantined_items} un
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-amber-400 font-medium">Valor em Risco</span>
          <div className="text-2xl font-black text-amber-400 mt-1 font-mono" data-testid="kpi-quarantined-value">
            R$ {kpis.total_quarantined_value.toFixed(2)}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-purple-400 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Recalls Notivisa
          </span>
          <div className="text-2xl font-black text-purple-400 mt-1" data-testid="kpi-active-recalls">
            {kpis.active_recalls_count}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-yellow-400 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Lotes Vencidos
          </span>
          <div className="text-2xl font-black text-yellow-400 mt-1" data-testid="kpi-expired-count">
            {kpis.expired_items_in_quarantine} un
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" />
            Descarte PGRSS
          </span>
          <div className="text-2xl font-black text-emerald-400 mt-1" data-testid="kpi-pgrss-disposed">
            {kpis.disposed_pgrss_items} un
          </div>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="px-6 pt-4 flex gap-2 border-b border-slate-800">
        <button
          data-testid="tab-quarantine-button"
          onClick={() => setActiveTab('QUARANTINE')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'QUARANTINE'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Estoque em Quarentena ({quarantineList.length})
        </button>

        <button
          data-testid="tab-recalls-button"
          onClick={() => setActiveTab('RECALLS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'RECALLS'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          Alertas Sanitários Notivisa ({recallsList.length})
        </button>

        <button
          data-testid="tab-transfer-button"
          onClick={() => setActiveTab('TRANSFER')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'TRANSFER'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Plus className="w-4 h-4" />
          Isolar Lote Manualmente
        </button>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* ===================== ABA 1: ESTOQUE EM QUARENTENA ===================== */}
        {activeTab === 'QUARANTINE' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Produtos Segregados da Venda
              </h2>

              <div className="flex items-center gap-3 text-xs">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white outline-none"
                >
                  <option value="ALL">Todos os Status</option>
                  <option value="QUARANTINED">Apenas Quarentena Ativa</option>
                  <option value="DISPOSED_PGRSS">Descartados (PGRSS)</option>
                  <option value="RETURNED_TO_SUPPLIER">Devolvidos a Fornecedor</option>
                  <option value="RELEASED">Liberados / Desinterditados</option>
                </select>

                <select
                  value={reasonFilter}
                  onChange={(e) => setReasonFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white outline-none"
                >
                  <option value="ALL">Todos os Motivos</option>
                  <option value="EXPIRED">Vencidos</option>
                  <option value="DAMAGED">Avariados</option>
                  <option value="RECALL_ANVISA">Recall Notivisa</option>
                  <option value="CUSTOMER_RETURN">Devolução de Cliente</option>
                  <option value="TEMPERATURE_EXCURSION">Excursão Térmica</option>
                </select>
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
                    <th className="py-2.5 px-4">Medicamento / EAN</th>
                    <th className="py-2.5 px-4">Lote / Validade</th>
                    <th className="py-2.5 px-4 text-center">Motivo</th>
                    <th className="py-2.5 px-4 text-right">Qtd</th>
                    <th className="py-2.5 px-4 text-right">Valor Risco</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {quarantineList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Nenhum item em quarentena para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    quarantineList.map((q) => (
                      <tr key={q.id} data-testid={`row-quarantine-${q.id}`} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{q.product_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">EAN: {q.ean}</div>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <div className="text-white">{q.batch_number}</div>
                          <div className="text-[10px] text-slate-400">Val: {q.expiration_date}</div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              q.reason === 'EXPIRED'
                                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                : q.reason === 'RECALL_ANVISA'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {q.reason}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">{q.quantity}</td>
                        <td className="py-3 px-4 text-right font-mono text-amber-400">
                          R$ {((q.quantity || 0) * (q.pmc || 0)).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              q.status === 'QUARANTINED'
                                ? 'bg-rose-500/20 text-rose-300'
                                : q.status === 'DISPOSED_PGRSS'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {q.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {q.status === 'QUARANTINED' ? (
                            <button
                              data-testid={`resolve-btn-${q.id}`}
                              onClick={() => setResolvingRecord(q)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-bold transition-all cursor-pointer"
                            >
                              Resolver Lote
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-mono">Resolvido</span>
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

        {/* ===================== ABA 2: ALERTAS NOTIVISA ===================== */}
        {activeTab === 'RECALLS' && (
          <div className="space-y-6">
            {/* Card para Cadastrar Novo Recall */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-purple-400" />
                Registrar Publicação de Recall / Interdição ANVISA
              </h2>

              <form onSubmit={handleCreateRecall} className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Nº Resolução RE:</label>
                  <input
                    type="text"
                    data-testid="recall-re-input"
                    value={newReNumber}
                    onChange={(e) => setNewReNumber(e.target.value)}
                    placeholder="Ex: RE 1.234/2026"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">ID do Produto:</label>
                  <input
                    type="number"
                    data-testid="recall-product-input"
                    value={newRecallProductId}
                    onChange={(e) => setNewRecallProductId(e.target.value)}
                    placeholder="Ex: 1"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Número do Lote:</label>
                  <input
                    type="text"
                    data-testid="recall-batch-input"
                    value={newRecallBatchNumber}
                    onChange={(e) => setNewRecallBatchNumber(e.target.value)}
                    placeholder="Ex: L-AMOX-99"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Gravidade Sanitária:</label>
                  <select
                    value={newRecallSeverity}
                    onChange={(e) => setNewRecallSeverity(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                  >
                    <option value="CRITICAL">Classe I - Risco Crítico à Saúde</option>
                    <option value="HIGH">Classe II - Risco Alto</option>
                    <option value="MEDIUM">Classe III - Risco Moderado</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-slate-400 font-semibold block mb-1">Motivo do Recolhimento:</label>
                  <input
                    type="text"
                    value={newRecallReason}
                    onChange={(e) => setNewRecallReason(e.target.value)}
                    placeholder="Descreva o motivo constante no DOU / Notivisa"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    data-testid="new-recall-button"
                    disabled={isSubmittingRecall}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-1.5"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {isSubmittingRecall ? 'Bloqueando...' : 'Cadastrar & Bloquear Lote'}
                  </button>
                </div>
              </form>
            </div>

            {/* Tabela de Recalls */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white">Histórico de Alertas Notivisa / ANVISA</h3>
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
                      <th className="py-2.5 px-4">Resolução RE</th>
                      <th className="py-2.5 px-4">Medicamento</th>
                      <th className="py-2.5 px-4">Lote</th>
                      <th className="py-2.5 px-4">Motivo</th>
                      <th className="py-2.5 px-4 text-center">Severidade</th>
                      <th className="py-2.5 px-4 text-right">Bloqueados</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {recallsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          Nenhum alerta sanitário ativo no momento.
                        </td>
                      </tr>
                    ) : (
                      recallsList.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-bold text-white">{r.anvisa_re_number}</td>
                          <td className="py-3 px-4 text-slate-300">{r.product_name || `Produto #${r.product_id}`}</td>
                          <td className="py-3 px-4 font-mono text-purple-300">{r.batch_number}</td>
                          <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{r.reason}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">
                              {r.severity}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                            {r.affected_units_blocked} un
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                              {r.is_active ? 'ATIVO' : 'ENCERRADO'}
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

        {/* ===================== ABA 3: TRANSFERÊNCIA MANUAL ===================== */}
        {activeTab === 'TRANSFER' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 max-w-xl mx-auto">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-rose-400" />
              Transferir Lote para Quarentena Sanitária
            </h2>
            <p className="text-xs text-slate-400">
              Isolamento preventivo de medicamentos avariados, frascos rompidos ou com desvio de qualidade
            </p>

            <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">ID do Produto:</label>
                <input
                  type="number"
                  value={transfProductId}
                  onChange={(e) => setTransfProductId(e.target.value)}
                  placeholder="Ex: 1"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">ID do Lote:</label>
                <input
                  type="number"
                  value={transfBatchId}
                  onChange={(e) => setTransfBatchId(e.target.value)}
                  placeholder="Ex: 1"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Quantidade a Isolar:</label>
                <input
                  type="number"
                  min="1"
                  value={transfQuantity}
                  onChange={(e) => setTransfQuantity(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Motivo do Isolamento:</label>
                <select
                  value={transfReason}
                  onChange={(e) => setTransfReason(e.target.value as QuarantineReason)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                >
                  <option value="DAMAGED">Avaria / Frasco Rompido</option>
                  <option value="EXPIRED">Prazo de Validade Vencido</option>
                  <option value="TEMPERATURE_EXCURSION">Excursão de Temperatura (Termolábil)</option>
                  <option value="SUSPECTED_ADULTERATION">Suspeita de Adulteração / Falsificação</option>
                  <option value="OTHER">Outros Motivos Regulatórios</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Observações Técnicas:</label>
                <textarea
                  value={transfNotes}
                  onChange={(e) => setTransfNotes(e.target.value)}
                  rows={3}
                  placeholder="Descreva o estado do produto e circunstâncias do isolamento"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingTransfer}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-rose-900/30 cursor-pointer"
              >
                {isSubmittingTransfer ? 'Transferindo...' : 'Confirmar Transferência para Quarentena'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Modal de Resolução de Lote em Quarentena */}
      {resolvingRecord && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Resolução de Quarentena Sanitária
              </h3>
              <button
                onClick={() => setResolvingRecord(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="font-bold text-white">{resolvingRecord.product_name}</div>
              <div className="text-slate-400 font-mono">
                Lote: {resolvingRecord.batch_number} | Qtd: {resolvingRecord.quantity} un
              </div>
              <div className="text-rose-400 font-semibold">Motivo: {resolvingRecord.reason}</div>
            </div>

            <form onSubmit={handleConfirmResolution} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Destinação Final:</label>
                <select
                  data-testid="resolution-type-select"
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                >
                  <option value="DISPOSED_PGRSS">Descarte Sanitário PGRSS (Resíduo Químico Grupo B)</option>
                  <option value="RETURNED_TO_SUPPLIER">Logística Reversa (Devolução / Reembolso Fornecedor)</option>
                  <option value="RELEASED">Desinterdição Técnica / Liberação para Venda</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Responsável pela Decisão:</label>
                <input
                  type="text"
                  value={resolvedBy}
                  onChange={(e) => setResolvedBy(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                />
              </div>

              {resolutionType === 'RELEASED' && (
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">CRF do Farmacêutico RT:</label>
                  <input
                    type="text"
                    value={pharmacistCrf}
                    onChange={(e) => setPharmacistCrf(e.target.value)}
                    placeholder="Obrigatório para desinterdição"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Parecer / Justificativa:</label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={2}
                  placeholder="Justificativa técnica ou número do laudo/NF-e"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setResolvingRecord(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-resolve-button"
                  disabled={isSubmittingResolve}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/30"
                >
                  {isSubmittingResolve ? 'Processando...' : 'Confirmar Resolução'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuarantineRegulatoryPage;
