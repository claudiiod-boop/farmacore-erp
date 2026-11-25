import React, { useState, useEffect, useCallback } from 'react';
import { blindInventoryApi } from '../services/api';
import type {
  StockInventory,
  StockInventoryItem,
  InventoryKpis,
  InventoryType,
  InventoryStatus
} from '../types/blind-inventory';

export const BlindInventoryPage: React.FC = () => {
  const [inventories, setInventories] = useState<StockInventory[]>([]);
  const [selectedInventory, setSelectedInventory] = useState<StockInventory | null>(null);
  const [kpis, setKpis] = useState<InventoryKpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isManagerView, setIsManagerView] = useState(false);

  // Modal Novo Inventário
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newType, setNewType] = useState<InventoryType>('GERAL_PATRIMONIAL');
  const [newNotes, setNewNotes] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Modal Registrar Contagem Cega
  const [isCountModalOpen, setIsCountModalOpen] = useState(false);
  const [countProductId, setCountProductId] = useState<number>(0);
  const [countBatchId, setCountBatchId] = useState<number | undefined>(undefined);
  const [countQuantity, setCountQuantity] = useState<number>(0);
  const [countSubmitting, setCountSubmitting] = useState(false);

  // Modal Aprovação RT (Medicamentos Controlados Portaria 344/98)
  const [approveItemTarget, setApproveItemTarget] = useState<StockInventoryItem | null>(null);
  const [pharmacistCrf, setPharmacistCrf] = useState('');
  const [pharmacistJustification, setPharmacistJustification] = useState('');
  const [approveSubmitting, setApproveSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, kpisRes] = await Promise.all([
        blindInventoryApi.listSessions({ store_id: 1 }),
        blindInventoryApi.getKpis(1)
      ]);

      if (listRes.success) {
        setInventories(listRes.data || []);
      }
      if (kpisRes.success) {
        setKpis(kpisRes.data || null);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar sessões de inventário');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadSessionDetails = async (id: number, managerView = isManagerView) => {
    setLoading(true);
    setError(null);
    try {
      const res = await blindInventoryApi.getSessionById(id, managerView);
      if (res.success) {
        setSelectedInventory(res.data);
      } else {
        setError(res.error || 'Erro ao carregar detalhes');
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao buscar inventário');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await blindInventoryApi.createSession({
        store_id: 1,
        type: newType,
        notes: newNotes
      });
      if (res.success) {
        setSuccessMsg(`Inventário ${res.data.code} iniciado com sucesso! Modo contagem cega ativado.`);
        setIsCreateModalOpen(false);
        setNewNotes('');
        await loadData();
        setSelectedInventory(res.data);
      } else {
        setError(res.error || 'Erro ao iniciar inventário');
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleRegisterCount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventory) return;
    setCountSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await blindInventoryApi.countItem(selectedInventory.id, {
        product_id: Number(countProductId),
        batch_id: countBatchId ? Number(countBatchId) : undefined,
        counted_quantity: Number(countQuantity)
      });
      if (res.success) {
        setSuccessMsg('Contagem cega registrada com sucesso!');
        setIsCountModalOpen(false);
        setCountQuantity(0);
        await loadSessionDetails(selectedInventory.id);
      } else {
        setError(res.error || 'Falha ao registrar contagem');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar contagem');
    } finally {
      setCountSubmitting(false);
    }
  };

  const handleReconcile = async (invId: number) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await blindInventoryApi.reconcileSession(invId);
      if (res.success) {
        setSuccessMsg('Reconciliação e auditoria de divergências concluída!');
        setSelectedInventory(res.data);
        await loadData();
      } else {
        setError(res.error || 'Erro ao reconciliar divergências');
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao reconciliar');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveControlled = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveItemTarget || !selectedInventory) return;
    setApproveSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await blindInventoryApi.approveControlled(approveItemTarget.id, {
        pharmacist_crf: pharmacistCrf,
        justification: pharmacistJustification
      });
      if (res.success) {
        setSuccessMsg('Justificativa sanitária do Farmacêutico RT registrada com sucesso!');
        setApproveItemTarget(null);
        setPharmacistCrf('');
        setPharmacistJustification('');
        await loadSessionDetails(selectedInventory.id, true);
        await loadData();
      } else {
        setError(res.error || 'Erro ao aprovar divergência');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar assinatura do RT');
    } finally {
      setApproveSubmitting(false);
    }
  };

  const handleFinalize = async (invId: number) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await blindInventoryApi.finalizeSession(invId, { user_id: 1 });
      if (res.success) {
        setSuccessMsg(`Inventário finalizado com sucesso! ${res.data.adjustments?.length || 0} ajuste(s) de estoque efetuados.`);
        setSelectedInventory(res.data.inventory);
        await loadData();
      } else {
        setError(res.error || 'Falha na finalização do inventário');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao finalizar inventário');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen" data-testid="blind-inventory-page">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-gray-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded uppercase">
              Contagem Cega & Balanço
            </span>
            <span className="text-gray-400 text-xs">Portaria 344/98 e RDC 44/2009</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Balanço Patrimonial & Inventário Rotativo Cego
          </h1>
          <p className="text-sm text-gray-600">
            Contagem sem contaminação visual do estoque, trava sanitária de controlados SNGPC e regularização patrimonial.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            data-testid="refresh-inventory-button"
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
          <button
            data-testid="create-inventory-button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-sm transition"
          >
            + Iniciar Inventário Cego
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div data-testid="error-alert" className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded">
          {error}
        </div>
      )}
      {successMsg && (
        <div data-testid="success-alert" className="mt-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm rounded">
          {successMsg}
        </div>
      )}

      {/* KPIs Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Sessões Realizadas</span>
          <p className="text-2xl font-bold text-gray-900 mt-1" data-testid="kpi-total-sessions">
            {kpis?.total_sessions ?? 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Sessões em Andamento</span>
          <p className="text-2xl font-bold text-amber-600 mt-1" data-testid="kpi-open-sessions">
            {kpis?.open_sessions ?? 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Acurácia de Estoque</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1" data-testid="kpi-accuracy-rate">
            {(kpis?.accuracy_rate_percent ?? 100.0).toFixed(1)}%
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Divergências no Mês</span>
          <p className="text-2xl font-bold text-gray-900 mt-1" data-testid="kpi-divergence-value">
            R$ {(kpis?.total_divergence_value_month ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Controlados Pendentes RT</span>
          <p className="text-2xl font-bold text-red-600 mt-1" data-testid="kpi-pending-controlled">
            {kpis?.pending_controlled_approvals ?? 0}
          </p>
        </div>
      </div>

      {/* Tabela de Sessões de Inventário */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="text-base font-bold text-gray-900 mb-3">Sessões de Balanço & Inventário</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Código</th>
                <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold">Início</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-center font-semibold">Itens Contados</th>
                <th className="px-4 py-3 text-center font-semibold">Divergências</th>
                <th className="px-4 py-3 text-right font-semibold">Valor Divergência</th>
                <th className="px-4 py-3 text-center font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800">
              {inventories.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500" data-testid="empty-inventories-row">
                    Nenhuma sessão de inventário registrada.
                  </td>
                </tr>
              ) : (
                inventories.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50" data-testid={`inventory-row-${inv.id}`}>
                    <td className="px-4 py-3 font-semibold text-amber-600">{inv.code}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-700">{inv.type}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{inv.started_at?.slice(0, 16).replace('T', ' ')}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          inv.status === 'FINALIZED'
                            ? 'bg-green-100 text-green-800'
                            : inv.status === 'AUDITING'
                            ? 'bg-blue-100 text-blue-800'
                            : inv.status === 'COUNTING'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {inv.status === 'COUNTING'
                          ? 'CONTAGEM CEGA'
                          : inv.status === 'AUDITING'
                          ? 'AUDITORIA'
                          : inv.status === 'FINALIZED'
                          ? 'FINALIZADO'
                          : inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{inv.total_items_counted}</td>
                    <td className="px-4 py-3 text-center">{inv.total_divergences_count}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      R$ {inv.total_divergence_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          data-testid={`select-inventory-button-${inv.id}`}
                          onClick={() => loadSessionDetails(inv.id)}
                          className="px-2.5 py-1 text-xs bg-gray-100 text-gray-800 hover:bg-gray-200 rounded font-medium"
                        >
                          Ver Detalhes
                        </button>
                        {inv.status === 'COUNTING' && (
                          <button
                            data-testid={`reconcile-button-${inv.id}`}
                            onClick={() => handleReconcile(inv.id)}
                            className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-medium"
                          >
                            Reconciliar
                          </button>
                        )}
                        {inv.status === 'AUDITING' && (
                          <button
                            data-testid={`finalize-button-${inv.id}`}
                            onClick={() => handleFinalize(inv.id)}
                            className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-medium"
                          >
                            Finalizar & Ajustar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Painel do Inventário Selecionado */}
      {selectedInventory && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6" data-testid="selected-inventory-panel">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-gray-200 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-gray-900">{selectedInventory.code}</span>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">
                  {selectedInventory.type}
                </span>
                <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-semibold">
                  Status: {selectedInventory.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {selectedInventory.notes ? `Observações: ${selectedInventory.notes} | ` : ''}
                Iniciado em: {selectedInventory.started_at?.slice(0, 16).replace('T', ' ')}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="toggle-manager-view-checkbox"
                  checked={isManagerView}
                  onChange={(e) => {
                    setIsManagerView(e.target.checked);
                    loadSessionDetails(selectedInventory.id, e.target.checked);
                  }}
                  className="rounded border-gray-300 text-amber-600"
                />
                <span>Visão de Gestor (Exibir Estoque Sistema)</span>
              </label>

              {selectedInventory.status === 'COUNTING' && (
                <button
                  data-testid="open-count-modal-button"
                  onClick={() => setIsCountModalOpen(true)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold"
                >
                  + Lançar Contagem Cega
                </button>
              )}

              {selectedInventory.status === 'AUDITING' && (
                <button
                  data-testid="finalize-inventory-button"
                  onClick={() => handleFinalize(selectedInventory.id)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                >
                  Finalizar Balanço
                </button>
              )}
            </div>
          </div>

          {/* Tabela de Itens do Inventário */}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Produto</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Lote</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Tipo</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Contado (Físico)</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Sistema</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Divergência</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Impacto (R$)</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Status Sanitário</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-800">
                {(selectedInventory.items || []).map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50" data-testid={`item-row-${item.id}`}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900">{item.product_name || `Produto #${item.product_id}`}</div>
                      <div className="text-xs text-gray-500">{item.product_ean || '-'}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-700">{item.batch_number || 'S/L'}</td>
                    <td className="px-4 py-2.5 text-center">
                      {item.is_controlled === 1 ? (
                        <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 font-bold rounded">
                          CONTROLADO 344
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">ISENTO</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-gray-900">{item.counted_quantity}</td>
                    <td className="px-4 py-2.5 text-center text-gray-500">
                      {isManagerView || selectedInventory.status !== 'COUNTING' ? item.system_quantity : '🔒 CEGO'}
                    </td>
                    <td className="px-4 py-2.5 text-center font-semibold">
                      {isManagerView || selectedInventory.status !== 'COUNTING' ? (
                        <span className={item.divergence_quantity === 0 ? 'text-gray-600' : item.divergence_quantity > 0 ? 'text-blue-600' : 'text-red-600'}>
                          {item.divergence_quantity > 0 ? `+${item.divergence_quantity}` : item.divergence_quantity}
                        </span>
                      ) : (
                        '🔒'
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {isManagerView || selectedInventory.status !== 'COUNTING' ? (
                        `R$ ${item.divergence_value.toFixed(2)}`
                      ) : (
                        '🔒'
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {item.requires_pharmacist_approval === 1 ? (
                        item.pharmacist_approved === 1 ? (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 font-semibold rounded">
                            Aprovado RT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 font-bold rounded animate-pulse">
                            Pendente RT
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {item.requires_pharmacist_approval === 1 && item.pharmacist_approved === 0 && (
                        <button
                          data-testid={`approve-controlled-button-${item.id}`}
                          onClick={() => {
                            setApproveItemTarget(item);
                            setPharmacistJustification('');
                          }}
                          className="px-2.5 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded font-medium"
                        >
                          Justificar RT
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Criar Inventário Cego */}
      {isCreateModalOpen && (
        <div
          data-testid="create-inventory-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Iniciar Sessão de Inventário Cego</h3>
            <p className="text-xs text-gray-500 mb-4">
              Congela o estoque atual para auditoria. Durante a contagem, as quantidades reais ficam ocultas para os conferentes.
            </p>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Inventário</label>
                <select
                  data-testid="inventory-type-select"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as InventoryType)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white"
                >
                  <option value="GERAL_PATRIMONIAL">Geral Patrimonial (Todos os Produtos)</option>
                  <option value="CONTROLADOS_SNGPC">Medicamentos Controlados (Portaria 344/98)</option>
                  <option value="ROTATIVO">Inventário Rotativo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Observações da Auditoria</label>
                <input
                  type="text"
                  data-testid="inventory-notes-input"
                  placeholder="Ex: Auditoria Trimestral Balcão"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-create-inventory-button"
                  disabled={createSubmitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold"
                >
                  {createSubmitting ? 'Iniciando...' : 'Iniciar Inventário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lançar Contagem Cega */}
      {isCountModalOpen && selectedInventory && (
        <div
          data-testid="count-item-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Terminal de Contagem Cega</h3>
            <p className="text-xs text-gray-500 mb-4">
              Informe o produto e a quantidade contada fisicamente. Não é exibido o estoque do sistema.
            </p>
            <form onSubmit={handleRegisterCount} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Selecione o Produto</label>
                <select
                  data-testid="count-product-select"
                  value={countProductId}
                  onChange={(e) => {
                    const pid = Number(e.target.value);
                    setCountProductId(pid);
                    const it = selectedInventory.items?.find((i) => i.product_id === pid);
                    setCountBatchId(it?.batch_id || undefined);
                  }}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white"
                >
                  <option value={0}>Selecione um produto...</option>
                  {(selectedInventory.items || []).map((i) => (
                    <option key={i.id} value={i.product_id}>
                      {i.product_name || `Produto #${i.product_id}`} (Lote: {i.batch_number || 'S/L'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Quantidade Contada Fisicamente</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  data-testid="count-quantity-input"
                  value={countQuantity}
                  onChange={(e) => setCountQuantity(Number(e.target.value))}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm text-center font-bold text-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCountModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-count-button"
                  disabled={countSubmitting || countProductId === 0}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold"
                >
                  {countSubmitting ? 'Salvando...' : 'Gravar Contagem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Justificativa Sanitária RT (Medicamentos Controlados) */}
      {approveItemTarget && (
        <div
          data-testid="approve-controlled-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Justificativa Sanitária RT (Portaria 344/98)
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Item: <span className="font-semibold text-gray-800">{approveItemTarget.product_name}</span> |{' '}
              Divergência apurada:{' '}
              <span className="font-bold text-red-600">{approveItemTarget.divergence_quantity} un</span>
            </p>
            <form onSubmit={handleApproveControlled} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  CRF do Farmacêutico RT Responsável
                </label>
                <input
                  type="text"
                  data-testid="pharmacist-crf-input"
                  placeholder="Ex: CRF-SP 12.345"
                  value={pharmacistCrf}
                  onChange={(e) => setPharmacistCrf(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Justificativa Técnica Sanitária / Boletim de Ocorrência Interno
                </label>
                <textarea
                  data-testid="pharmacist-justification-input"
                  rows={4}
                  placeholder="Descreva a causa da divergência (ex: quebra de frasco, avaria física no armário, perda no transporte)..."
                  value={pharmacistJustification}
                  onChange={(e) => setPharmacistJustification(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setApproveItemTarget(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-approve-controlled-button"
                  disabled={approveSubmitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold"
                >
                  {approveSubmitting ? 'Assinando...' : 'Assinar & Aprovar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlindInventoryPage;
