import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Percent,
  Layers,
  FileCheck2,
  Loader2,
  Scale,
} from 'lucide-react';
import type {
  InventorySessionWithItems,
  InventoryItem,
  AdjustmentReason,
  ApplyAdjustmentsParams,
} from '../../types';
import { api } from '../../services/api';

export interface ReconciliationPanelProps {
  session: InventorySessionWithItems;
  onApplied: () => void;
  onBack: () => void;
  refreshSession: () => Promise<void> | void;
}

const formatBRL = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

export default function ReconciliationPanel({
  session,
  onApplied,
  onBack,
  refreshSession,
}: ReconciliationPanelProps) {
  // Local state for reasons assigned to divergent items
  const [itemReasons, setItemReasons] = useState<Record<number, { reason: AdjustmentReason; notes?: string }>>(() => {
    const initial: Record<number, { reason: AdjustmentReason; notes?: string }> = {};
    for (const item of session.items || []) {
      if (item.differenceStatus !== 'EXACT') {
        initial[item.id] = {
          reason: (item.adjustmentReason as AdjustmentReason) ||
            (item.differenceStatus === 'SURPLUS' ? 'SOBRA_NAO_IDENTIFICADA' : 'AJUSTE_INVENTARIO'),
          notes: item.notes || '',
        };
      }
    }
    return initial;
  });

  const [appliedBy, setAppliedBy] = useState<string>(session.openedBy || 'Farmacêutico Responsável');
  const [responsiblePharmacistCrf, setResponsiblePharmacistCrf] = useState<string>(
    session.responsiblePharmacistCrf || ''
  );
  const [responsiblePharmacistUf, setResponsiblePharmacistUf] = useState<string>(
    session.responsiblePharmacistUf || 'SP'
  );

  const [recountingItemId, setRecountingItemId] = useState<number | null>(null);
  const [recountQtyInput, setRecountQtyInput] = useState<number>(0);
  const [recountingLoading, setRecountingLoading] = useState<boolean>(false);

  const [submittingApply, setSubmittingApply] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if any divergent items are controlled or if session is SNGPC
  const items = session.items || [];
  const hasControlledDivergence = items.some(
    (item) =>
      Boolean(item.sngpcAdjusted || session.inventoryType === 'CONTROLADOS_SNGPC') &&
      item.differenceStatus !== 'EXACT'
  );

  const handleReasonChange = (itemId: number, reason: AdjustmentReason) => {
    setItemReasons((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { notes: '' }),
        reason,
      },
    }));
  };

  const handleNotesChange = (itemId: number, notes: string) => {
    setItemReasons((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { reason: 'AJUSTE_INVENTARIO' }),
        notes,
      },
    }));
  };

  // Recount handler
  const openRecount = (item: InventoryItem) => {
    setRecountingItemId(item.id);
    setRecountQtyInput(item.recountQuantity ?? item.countedQuantity);
  };

  const handleConfirmRecount = async () => {
    if (recountingItemId === null) return;
    setRecountingLoading(true);
    setErrorMessage(null);
    try {
      await api.recountInventoryItem(session.id, recountingItemId, Number(recountQtyInput));
      setSuccessMessage(`Item recontado com sucesso.`);
      setRecountingItemId(null);
      await refreshSession();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao recontar item.');
    } finally {
      setRecountingLoading(false);
    }
  };

  // Apply Adjustments handler
  const handleApply = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!appliedBy.trim()) {
      setErrorMessage('Por favor, informe o responsável pela homologação (appliedBy).');
      return;
    }

    if (hasControlledDivergence) {
      if (!responsiblePharmacistCrf.trim()) {
        setErrorMessage(
          'Divergência detectada em medicamentos controlados: o CRF do Farmacêutico RT é obrigatório para conformidade Anvisa SNGPC.'
        );
        return;
      }
      if (!responsiblePharmacistUf.trim()) {
        setErrorMessage('A UF do CRF do Farmacêutico RT é obrigatória.');
        return;
      }
    }

    const confirm = window.confirm(
      'Confirma a homologação deste inventário?\n\nOs saldos físicos serão atualizados no estoque e as movimentações regulatórias serão registradas no SNGPC.'
    );
    if (!confirm) return;

    setSubmittingApply(true);
    try {
      const payload: ApplyAdjustmentsParams = {
        appliedBy: appliedBy.trim(),
        responsiblePharmacistCrf: responsiblePharmacistCrf.trim() || undefined,
        responsiblePharmacistUf: responsiblePharmacistUf.trim().toUpperCase() || undefined,
        itemReasons,
      };

      await api.applyInventoryAdjustments(session.id, payload);
      setSuccessMessage('Ajustes de inventário homologados e aplicados com sucesso!');
      await onApplied();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao homologar inventário.');
    } finally {
      setSubmittingApply(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 text-slate-100 overflow-y-auto">
      {/* Top Header Bar */}
      <div className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={onBack}
            data-testid="back-button"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Sessões</span>
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-white">Conciliação & Homologação de Inventário</h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-700">
                {session.sessionCode}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-700">
                Aguardando Conciliação
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Filial: <strong className="text-slate-200">{session.store?.name || `Loja #${session.storeId}`}</strong> | Auditor: <strong className="text-slate-200">{session.openedBy}</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleApply}
          disabled={submittingApply}
          data-testid="apply-adjustments-button"
          className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-md cursor-pointer"
        >
          {submittingApply ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileCheck2 className="w-4 h-4" />
          )}
          <span>Homologar & Aplicar Ajustes no Estoque (e SNGPC)</span>
        </button>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Feedback Messages */}
        {errorMessage && (
          <div
            data-testid="reconciliation-error-alert"
            className="bg-rose-950/60 border border-rose-600/70 p-4 rounded-xl flex items-center space-x-3 text-rose-300 text-xs shadow-md"
          >
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            data-testid="reconciliation-success-alert"
            className="bg-emerald-950/60 border border-emerald-600/70 p-4 rounded-xl flex items-center space-x-3 text-emerald-300 text-xs shadow-md"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold">Lotes Auditados</span>
              <Layers className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-xl font-bold text-white font-mono">
              {session.totalBatchesCounted || items.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {session.totalProductsCounted} produtos verificados
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold">Acurácia Patrimonial</span>
              <Percent className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400 font-mono">
              {session.accuracyRate.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Meta operacional: &gt;= 98.0%
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold">Custo Sobras (+)</span>
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-blue-400 font-mono">
              {formatBRL(session.totalSurplusCost)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Entrada patrimonial
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold">Custo Faltas (-)</span>
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xl font-bold text-rose-400 font-mono">
              {formatBRL(session.totalShortageCost)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Quebras e perdas
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold">Diferença Líquida</span>
              <Scale className="w-4 h-4 text-amber-400" />
            </div>
            <div
              className={`text-xl font-bold font-mono ${
                session.netFinancialDifference > 0
                  ? 'text-blue-400'
                  : session.netFinancialDifference < 0
                  ? 'text-rose-400'
                  : 'text-emerald-400'
              }`}
            >
              {formatBRL(session.netFinancialDifference)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Impacto no resultado (CMV)
            </div>
          </div>
        </div>

        {/* Regulatory Alert Banner for SNGPC / Controlled Drugs */}
        {hasControlledDivergence && (
          <div
            data-testid="sngpc-divergence-warning"
            className="bg-purple-950/40 border-2 border-purple-600 rounded-xl p-5 shadow-lg space-y-4"
          >
            <div className="flex items-start space-x-3">
              <ShieldAlert className="w-6 h-6 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-purple-200">
                  Parecer Regulatório Obrigatório — Anvisa (Portaria 344/98 & RDC 22/2014)
                </h3>
                <p className="text-xs text-purple-300/90 mt-1 leading-relaxed">
                  Foram identificadas divergências quantitativas em medicamentos sob controle especial. Toda alteração física exige movimentação compulsória de ajuste no SNGPC e parecer assinado pelo Farmacêutico Responsável Técnico.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-purple-800/60">
              <div>
                <label className="block text-xs font-semibold text-purple-300 mb-1">
                  CRF do Farmacêutico RT *
                </label>
                <input
                  type="text"
                  value={responsiblePharmacistCrf}
                  onChange={(e) => setResponsiblePharmacistCrf(e.target.value)}
                  placeholder="Ex: 12345"
                  data-testid="pharmacist-crf-input"
                  className="w-full bg-slate-900 border border-purple-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-300 mb-1">
                  UF do CRF *
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={responsiblePharmacistUf}
                  onChange={(e) => setResponsiblePharmacistUf(e.target.value.toUpperCase())}
                  placeholder="SP"
                  data-testid="pharmacist-uf-input"
                  className="w-full bg-slate-900 border border-purple-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 uppercase font-mono text-center focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-300 mb-1">
                  Homologado por (Operador) *
                </label>
                <input
                  type="text"
                  value={appliedBy}
                  onChange={(e) => setAppliedBy(e.target.value)}
                  placeholder="Nome do Auditor / Farmacêutico"
                  data-testid="applied-by-input"
                  className="w-full bg-slate-900 border border-purple-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Comparative Batches Table */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Análise Comparativa de Lotes e Divergências</h2>
            </div>
            <span className="text-xs font-bold text-slate-400">
              Total de itens: {items.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-3 py-3">Lote</th>
                  <th className="px-3 py-3">Validade</th>
                  <th className="px-3 py-3 text-right">Qtd Esperada</th>
                  <th className="px-3 py-3 text-right">Qtd Contada</th>
                  <th className="px-3 py-3 text-right">Diferença</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Motivo da Divergência</th>
                  <th className="px-3 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-500 font-sans">
                      Nenhum item encontrado nesta sessão.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isControlled = Boolean(item.sngpcAdjusted || session.inventoryType === 'CONTROLADOS_SNGPC');
                    const isDivergent = item.differenceStatus !== 'EXACT';
                    const activeReason = itemReasons[item.id]?.reason || 'AJUSTE_INVENTARIO';

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-900/50 transition-colors ${
                          isDivergent ? 'bg-slate-900/20' : ''
                        }`}
                        data-testid={`recon-item-row-${item.id}`}
                      >
                        <td className="px-4 py-3 font-sans font-medium text-white max-w-xs">
                          <div className="flex items-center space-x-2">
                            <span className="truncate">{item.productName || `Produto #${item.productId}`}</span>
                            {isControlled && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-700 shrink-0">
                                SNGPC
                              </span>
                            )}
                          </div>
                          {item.productEan && (
                            <span className="text-[10px] text-slate-500 block font-mono">{item.productEan}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-blue-300 font-bold">{item.batchNumber}</td>
                        <td className="px-3 py-3 text-slate-300">{item.expirationDate}</td>
                        <td className="px-3 py-3 text-right text-slate-400">{item.expectedQuantity}</td>
                        <td className="px-3 py-3 text-right font-bold text-white">
                          {item.recountQuantity ?? item.countedQuantity}
                          {item.recountQuantity !== null && item.recountQuantity !== undefined && (
                            <span className="text-[10px] text-amber-400 ml-1 block font-sans">(Recontado)</span>
                          )}
                        </td>
                        <td
                          className={`px-3 py-3 text-right font-bold ${
                            item.differenceQuantity > 0
                              ? 'text-blue-400'
                              : item.differenceQuantity < 0
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {item.differenceQuantity > 0 ? `+${item.differenceQuantity}` : item.differenceQuantity}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {item.differenceStatus === 'EXACT' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-700">
                              EXACT
                            </span>
                          ) : item.differenceStatus === 'SURPLUS' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-400 border border-blue-700">
                              SOBRA
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-700">
                              FALTA
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-sans">
                          {isDivergent ? (
                            <div className="space-y-1">
                              <select
                                value={activeReason}
                                onChange={(e) => handleReasonChange(item.id, e.target.value as AdjustmentReason)}
                                data-testid={`select-reason-${item.id}`}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                              >
                                <option value="AVARIA">Avaria de Embalagem / Produto</option>
                                <option value="VENCIMENTO">Produto Vencido</option>
                                <option value="FURTO_EXTRAVIO">Furto / Extravio</option>
                                <option value="ERRO_OPERACIONAL">Erro Operacional de Caixa</option>
                                <option value="QUEBRA_ARMAZENAMENTO">Quebra no Armazenamento</option>
                                <option value="AJUSTE_INVENTARIO">Ajuste Geral de Inventário</option>
                                <option value="SOBRA_NAO_IDENTIFICADA">Sobra Não Identificada</option>
                              </select>
                              <input
                                type="text"
                                placeholder="Observações (opcional)"
                                value={itemReasons[item.id]?.notes || ''}
                                onChange={(e) => handleNotesChange(item.id, e.target.value)}
                                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2 py-0.5 text-[11px] text-slate-400 placeholder-slate-600 outline-none focus:border-slate-600"
                              />
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs italic">Sem divergência</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => openRecount(item)}
                            data-testid={`recount-button-${item.id}`}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs rounded border border-slate-700 transition cursor-pointer"
                          >
                            Recontar
                          </button>
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

      {/* Recount Modal */}
      {recountingItemId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          data-testid="recount-modal"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-sm font-bold text-white border-b border-slate-800 pb-3">
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <span>Recontagem Física de Item</span>
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Informe a nova quantidade física auditada. Esta quantidade substituirá a contagem anterior para cálculo da acurácia e divergências.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nova Quantidade Contada:
              </label>
              <input
                type="number"
                min="0"
                value={recountQtyInput}
                onChange={(e) => setRecountQtyInput(Math.max(0, parseInt(e.target.value) || 0))}
                data-testid="recount-quantity-input"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono text-center focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRecountingItemId(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRecount}
                disabled={recountingLoading}
                data-testid="confirm-recount-button"
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5"
              >
                {recountingLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirmar Recontagem</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
