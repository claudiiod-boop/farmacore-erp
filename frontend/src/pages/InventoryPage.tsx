import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  X,
  Ban,
} from 'lucide-react';
import { useStore } from '../contexts/StoreContext';
import type {
  InventorySessionWithItems,
  InventoryStatus,
  InventoryType,
  CreateInventorySessionInput,
  InventoryReportResult,
} from '../types';
import { api } from '../services/api';
import BlindCountingPanel from '../components/inventory/BlindCountingPanel';
import ReconciliationPanel from '../components/inventory/ReconciliationPanel';
import InventorySlipModal from '../components/inventory/InventorySlipModal';

export type InventorySubView = 'LIST' | 'COUNTING' | 'RECONCILIATION';

const formatBRL = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

export default function InventoryPage() {
  const { stores, currentStore } = useStore();

  const [subView, setSubView] = useState<InventorySubView>('LIST');
  const [sessions, setSessions] = useState<InventorySessionWithItems[]>([]);
  const [activeSession, setActiveSession] = useState<InventorySessionWithItems | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  // New Session Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [newStoreId, setNewStoreId] = useState<number>(currentStore?.id || 1);
  const [newType, setNewType] = useState<InventoryType>('GERAL');
  const [newCategory, setNewCategory] = useState<string>('');
  const [newOpenedBy, setNewOpenedBy] = useState<string>('Farmacêutico RT');
  const [newNotes, setNewNotes] = useState<string>('');
  const [submittingCreate, setSubmittingCreate] = useState<boolean>(false);

  // Cancel Session Modal State
  const [sessionToCancel, setSessionToCancel] = useState<InventorySessionWithItems | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [submittingCancel, setSubmittingCancel] = useState<boolean>(false);

  // Slip Report Modal State
  const [slipModalOpen, setSlipModalOpen] = useState<boolean>(false);
  const [slipReport, setSlipReport] = useState<InventoryReportResult | null>(null);
  const [loadingSlip, setLoadingSlip] = useState<boolean>(false);

  // Update newStoreId when currentStore changes
  useEffect(() => {
    if (currentStore?.id) {
      setNewStoreId(currentStore.id);
    } else if (stores.length > 0) {
      setNewStoreId(stores[0].id);
    }
  }, [currentStore, stores]);

  // Load Sessions
  const loadSessions = useCallback(async () => {
    setLoadingList(true);
    setAlertError(null);
    try {
      const filters = filterStatus !== 'TODOS' ? { status: filterStatus as InventoryStatus } : undefined;
      const res = await api.getInventorySessions(filters);
      setSessions(res.sessions || []);
    } catch (err: any) {
      setAlertError(err?.message || 'Falha ao listar sessões de inventário');
    } finally {
      setLoadingList(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    if (subView === 'LIST') {
      loadSessions();
    }
  }, [subView, loadSessions]);

  // Refresh Active Session
  const refreshActiveSession = async () => {
    if (!activeSession) return;
    try {
      const updated = await api.getInventorySessionById(activeSession.id);
      setActiveSession(updated);
    } catch (err: any) {
      setAlertError(err?.message || 'Falha ao atualizar dados da sessão');
    }
  };

  // Open Counting View
  const handleStartCounting = (session: InventorySessionWithItems) => {
    setActiveSession(session);
    setSubView('COUNTING');
  };

  // Open Reconciliation View
  const handleStartReconciliation = (session: InventorySessionWithItems) => {
    setActiveSession(session);
    setSubView('RECONCILIATION');
  };

  // Open Slip Modal
  const handleViewSlip = async (sessionId: number) => {
    setLoadingSlip(true);
    setSlipModalOpen(true);
    setAlertError(null);
    try {
      const report = await api.getInventoryReport(sessionId);
      setSlipReport(report);
    } catch (err: any) {
      setAlertError(err?.message || 'Falha ao obter extrato da sessão');
    } finally {
      setLoadingSlip(false);
    }
  };

  // Create Session Submit
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertError(null);
    setAlertSuccess(null);

    if (!newOpenedBy.trim()) {
      setAlertError('O campo "Aberto por" é obrigatório.');
      return;
    }

    setSubmittingCreate(true);
    try {
      const input: CreateInventorySessionInput = {
        storeId: Number(newStoreId),
        inventoryType: newType,
        categoryFilter: newType === 'ROTATIVO' ? newCategory.trim() || null : null,
        openedBy: newOpenedBy.trim(),
        notes: newNotes.trim() || null,
      };

      const created = await api.createInventorySession(input);
      setIsNewModalOpen(false);
      setAlertSuccess(`Sessão de inventário ${created.sessionCode} iniciada com sucesso!`);
      // Open counting panel directly
      setActiveSession(created);
      setSubView('COUNTING');
    } catch (err: any) {
      setAlertError(err?.message || 'Falha ao iniciar sessão de inventário.');
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Cancel Session Submit
  const handleConfirmCancel = async () => {
    if (!sessionToCancel) return;
    if (!cancelReason.trim()) {
      setAlertError('O motivo do cancelamento é obrigatório.');
      return;
    }

    setSubmittingCancel(true);
    try {
      await api.cancelInventorySession(sessionToCancel.id, cancelReason.trim());
      setAlertSuccess(`Sessão ${sessionToCancel.sessionCode} cancelada com sucesso.`);
      setSessionToCancel(null);
      setCancelReason('');
      loadSessions();
    } catch (err: any) {
      setAlertError(err?.message || 'Falha ao cancelar sessão.');
    } finally {
      setSubmittingCancel(false);
    }
  };

  // If sub-view is COUNTING
  if (subView === 'COUNTING' && activeSession) {
    return (
      <BlindCountingPanel
        session={activeSession}
        onBack={() => {
          setSubView('LIST');
          setActiveSession(null);
          loadSessions();
        }}
        refreshSession={refreshActiveSession}
        onFinishCounting={async () => {
          await refreshActiveSession();
          setSubView('RECONCILIATION');
        }}
      />
    );
  }

  // If sub-view is RECONCILIATION
  if (subView === 'RECONCILIATION' && activeSession) {
    return (
      <ReconciliationPanel
        session={activeSession}
        onBack={() => {
          setSubView('LIST');
          setActiveSession(null);
          loadSessions();
        }}
        refreshSession={refreshActiveSession}
        onApplied={() => {
          setSubView('LIST');
          setActiveSession(null);
          loadSessions();
          handleViewSlip(activeSession.id);
        }}
      />
    );
  }

  // Sub-view LIST
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 text-slate-100 overflow-y-auto">
      {/* Header bar */}
      <div className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-emerald-400">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Módulo de Auditoria & Inventário Físico
            </h1>
            <p className="text-xs text-slate-400">
              Contagem cega bip-a-bip, conciliação patrimonial e parecer regulatório SNGPC
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsNewModalOpen(true)}
          data-testid="new-inventory-button"
          className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Inventário / Balanço</span>
        </button>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Alerts */}
        {alertError && (
          <div
            data-testid="inventory-error-alert"
            className="bg-rose-950/60 border border-rose-600/70 p-4 rounded-xl flex items-center justify-between text-rose-300 text-xs shadow-md"
          >
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span className="font-semibold">{alertError}</span>
            </div>
            <button
              type="button"
              onClick={() => setAlertError(null)}
              className="text-rose-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {alertSuccess && (
          <div
            data-testid="inventory-success-alert"
            className="bg-emerald-950/60 border border-emerald-600/70 p-4 rounded-xl flex items-center justify-between text-emerald-300 text-xs shadow-md"
          >
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-semibold">{alertSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setAlertSuccess(null)}
              className="text-emerald-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filter Navigation Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {[
              { id: 'TODOS', label: 'Todos' },
              { id: 'OPEN', label: 'Em Aberto (Contagem Cega)' },
              { id: 'COUNTED', label: 'Aguardando Conciliação' },
              { id: 'APPLIED', label: 'Homologado / Aplicado' },
              { id: 'CANCELLED', label: 'Cancelados' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                data-testid={`filter-${tab.id.toLowerCase()}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border cursor-pointer ${
                  filterStatus === tab.id
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-850'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400">
            Total listado: <strong className="text-white font-mono">{sessions.length}</strong>
          </span>
        </div>

        {/* Table of Sessions */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Filial</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Acurácia</th>
                  <th className="px-4 py-3 text-right">Dif. Financeira</th>
                  <th className="px-4 py-3">Aberto por</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {loadingList ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-sans">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                        <span>Carregando sessões de inventário...</span>
                      </div>
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500 font-sans">
                      Nenhuma sessão de inventário encontrada para o filtro selecionado.
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => {
                    const isClosed = session.status === 'APPLIED' || session.status === 'COUNTED';
                    return (
                      <tr
                        key={session.id}
                        className="hover:bg-slate-900/50 transition-colors"
                        data-testid={`session-row-${session.id}`}
                      >
                        <td className="px-4 py-3 font-bold text-white">
                          {session.sessionCode}
                        </td>
                        <td className="px-4 py-3 font-sans text-slate-300">
                          {session.store?.name || `Loja #${session.storeId}`}
                        </td>
                        <td className="px-4 py-3 font-sans">
                          {session.inventoryType === 'CONTROLADOS_SNGPC' ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-950 text-purple-300 border border-purple-700">
                              SNGPC Controlados
                            </span>
                          ) : session.inventoryType === 'ROTATIVO' ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-700">
                              Rotativo: {session.categoryFilter || 'Geral'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                              Geral
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {session.status === 'OPEN' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-700">
                              EM ABERTO
                            </span>
                          )}
                          {session.status === 'COUNTED' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700">
                              CONCILIAÇÃO
                            </span>
                          )}
                          {session.status === 'APPLIED' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                              HOMOLOGADO
                            </span>
                          )}
                          {session.status === 'CANCELLED' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              CANCELADO
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          {isClosed ? (
                            <span className={session.accuracyRate >= 98 ? 'text-emerald-400' : 'text-amber-400'}>
                              {session.accuracyRate.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-500 font-sans italic">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isClosed ? (
                            <span
                              className={
                                session.netFinancialDifference > 0
                                  ? 'text-blue-400 font-bold'
                                  : session.netFinancialDifference < 0
                                  ? 'text-rose-400 font-bold'
                                  : 'text-emerald-400 font-bold'
                              }
                            >
                              {formatBRL(session.netFinancialDifference)}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-sans italic">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-sans text-slate-300">
                          {session.openedBy}
                        </td>
                        <td className="px-4 py-3 text-center font-sans">
                          <div className="flex items-center justify-center space-x-2">
                            {session.status === 'OPEN' && (
                              <button
                                type="button"
                                onClick={() => handleStartCounting(session)}
                                data-testid={`continue-count-${session.id}`}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition cursor-pointer"
                              >
                                Continuar Contagem
                              </button>
                            )}

                            {session.status === 'COUNTED' && (
                              <button
                                type="button"
                                onClick={() => handleStartReconciliation(session)}
                                data-testid={`reconcile-${session.id}`}
                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold transition cursor-pointer"
                              >
                                Conciliar & Homologar
                              </button>
                            )}

                            {session.status === 'APPLIED' && (
                              <button
                                type="button"
                                onClick={() => handleViewSlip(session.id)}
                                data-testid={`view-slip-${session.id}`}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                              >
                                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Ver Termo</span>
                              </button>
                            )}

                            {(session.status === 'OPEN' || session.status === 'COUNTED') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSessionToCancel(session);
                                  setCancelReason('');
                                }}
                                data-testid={`cancel-session-${session.id}`}
                                className="px-2 py-1 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 rounded text-xs font-semibold transition cursor-pointer"
                                title="Cancelar inventário"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Session Modal */}
      {isNewModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          data-testid="new-inventory-modal"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-950 border border-emerald-700 rounded-lg text-emerald-400">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-white">Nova Sessão de Inventário Físico</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Filial *</label>
                <select
                  value={newStoreId}
                  onChange={(e) => setNewStoreId(Number(e.target.value))}
                  data-testid="new-inventory-store-select"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name} ({s.city}/{s.state})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Modalidade do Inventário *
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as InventoryType)}
                  data-testid="new-inventory-type-select"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                >
                  <option value="GERAL">Inventário Geral (Todos os Produtos da Filial)</option>
                  <option value="ROTATIVO">Inventário Rotativo (Por Categoria / Curva)</option>
                  <option value="CONTROLADOS_SNGPC">Medicamentos Controlados & SNGPC (Portaria 344/98)</option>
                </select>
              </div>

              {newType === 'ROTATIVO' && (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Filtro de Categoria / Grupo
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Dermocosméticos, Antibióticos, Higiene..."
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    data-testid="new-inventory-category-input"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Auditor / Responsável pela Abertura *
                </label>
                <input
                  type="text"
                  value={newOpenedBy}
                  onChange={(e) => setNewOpenedBy(e.target.value)}
                  placeholder="Nome do Auditor ou Farmacêutico"
                  data-testid="new-inventory-opened-by-input"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Observações / Justificativa (opcional)
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ex: Auditoria mensal de rotina ou fechamento trimestral..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  data-testid="start-inventory-button"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-bold transition flex items-center space-x-2"
                >
                  {submittingCreate && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Iniciar Sessão de Inventário</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Session Modal */}
      {sessionToCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          data-testid="cancel-inventory-modal"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400 border-b border-slate-800 pb-3">
              <Ban className="w-5 h-5" />
              <h2 className="text-base font-bold text-white">Cancelar Sessão de Inventário</h2>
            </div>

            <p className="text-xs text-slate-300">
              Tem certeza que deseja cancelar a sessão{' '}
              <strong className="text-white font-mono">{sessionToCancel.sessionCode}</strong>? Todas as contagens físicas registradas serão anuladas e nenhum ajuste será aplicado ao estoque.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Motivo do Cancelamento *
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Informe o motivo do cancelamento para fins de auditoria..."
                data-testid="cancel-reason-input"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSessionToCancel(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={submittingCancel || !cancelReason.trim()}
                data-testid="confirm-cancel-button"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center space-x-2"
              >
                {submittingCancel && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Confirmar Cancelamento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slip Modal */}
      <InventorySlipModal
        isOpen={slipModalOpen}
        onClose={() => {
          setSlipModalOpen(false);
          setSlipReport(null);
        }}
        report={slipReport}
        loading={loadingSlip}
      />
    </div>
  );
}
