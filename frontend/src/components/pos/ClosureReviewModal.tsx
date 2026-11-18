import { useState } from 'react';
import { X, CheckCircle2, XCircle, Printer, AlertTriangle, ShieldCheck, FileText, ChevronRight } from 'lucide-react';
import { formatBrl } from '../ProductSearch';
import { api, BlindCashClosure } from '../../services/api';

interface ClosureReviewModalProps {
  isOpen: boolean;
  closure: BlindCashClosure | null;
  onClose: () => void;
  onReviewed: (updatedClosure: BlindCashClosure) => void;
}

export default function ClosureReviewModal({
  isOpen,
  closure,
  onClose,
  onReviewed,
}: ClosureReviewModalProps) {
  const [managerName, setManagerName] = useState<string>('Gerente de Loja');
  const [managerNotes, setManagerNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Thermal Receipt state
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptText, setReceiptText] = useState<string>('');
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);

  if (!isOpen || !closure) return null;

  const isPending = closure.status === 'PENDING_REVIEW';
  const isApproved = closure.status === 'APPROVED';
  const isRejected = closure.status === 'REJECTED';

  const handleReview = async (approved: boolean) => {
    if (!managerName.trim()) {
      setErrorMessage('Nome do gerente homologador é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updated = await api.reviewClosure(closure.id, {
        managerName: managerName.trim(),
        approved,
        managerNotes: managerNotes.trim() || undefined,
      });
      onReviewed(updated);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao homologar fechamento de caixa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFetchReceipt = async () => {
    setIsLoadingReceipt(true);
    setErrorMessage(null);
    try {
      const data = await api.getClosureReceipt(closure.id);
      setReceiptText(data.textReceipt);
      setShowReceipt(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao emitir comprovante térmico.');
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  const diffBadgeColor =
    closure.differenceStatus === 'EXACT'
      ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
      : closure.differenceStatus === 'SURPLUS'
      ? 'bg-blue-950 text-blue-300 border-blue-600'
      : 'bg-rose-950 text-rose-300 border-rose-600';

  const diffLabel =
    closure.differenceStatus === 'EXACT'
      ? 'Conferência Exata (0,00)'
      : closure.differenceStatus === 'SURPLUS'
      ? `Sobra de Caixa (+${formatBrl(closure.totalDifference)})`
      : `Quebra de Caixa (${formatBrl(closure.totalDifference)})`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="closure-review-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-500/20 text-blue-400 p-2 rounded-lg border border-blue-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="closure-review-title" className="text-lg font-bold text-white tracking-wide">
                Auditoria & Homologação de Fechamento de Caixa
              </h2>
              <p className="text-xs text-slate-400">
                Fechamento #{closure.id} &bull; Sessão #{closure.cashSessionId} &bull; Operador:{' '}
                <span className="font-semibold text-slate-200">{closure.operatorName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-700/60 text-rose-200 text-xs rounded-lg flex items-center space-x-2">
              <span className="font-bold">Erro:</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Status and Difference Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-950/80 rounded-xl border border-slate-800">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Status da Homologação
              </span>
              <div className="flex items-center space-x-2 mt-0.5">
                {isPending && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-600">
                    Pendente de Homologação
                  </span>
                )}
                {isApproved && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-600">
                    Aprovado pelo Gerente
                  </span>
                )}
                {isRejected && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-600">
                    Rejeitado com Divergência
                  </span>
                )}
                {closure.reviewedAt && (
                  <span className="text-[11px] text-slate-500">
                    em {new Date(closure.reviewedAt).toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Resultado da Apuração
              </span>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold border mt-0.5 ${diffBadgeColor}`}>
                {diffLabel}
              </span>
            </div>
          </div>

          {/* Confrontation Table: Sistema vs Declarado */}
          <div className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-300">
              <span>Forma de Pagamento</span>
              <div className="flex items-center space-x-12 pr-2">
                <span>Calculado (Sistema)</span>
                <span>Declarado (Físico)</span>
                <span className="w-20 text-right">Diferença</span>
              </div>
            </div>

            <div className="divide-y divide-slate-800/80 text-xs">
              {/* Dinheiro */}
              <div className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-800/20">
                <span className="font-semibold text-slate-200">Dinheiro em Espécie (Gaveta)</span>
                <div className="flex items-center space-x-12 font-mono">
                  <span className="text-slate-300">{formatBrl(closure.systemCash)}</span>
                  <span className="text-emerald-400 font-bold">{formatBrl(closure.declaredCash)}</span>
                  <span
                    className={`w-20 text-right font-bold ${
                      closure.cashDifference === 0
                        ? 'text-slate-400'
                        : closure.cashDifference > 0
                        ? 'text-blue-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {closure.cashDifference > 0 ? `+${formatBrl(closure.cashDifference)}` : formatBrl(closure.cashDifference)}
                  </span>
                </div>
              </div>

              {/* Cartão Crédito */}
              <div className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-800/20">
                <span className="font-semibold text-slate-200">Cartão de Crédito</span>
                <div className="flex items-center space-x-12 font-mono">
                  <span className="text-slate-300">{formatBrl(closure.systemCredit)}</span>
                  <span className="text-blue-400 font-bold">{formatBrl(closure.declaredCredit)}</span>
                  <span
                    className={`w-20 text-right font-bold ${
                      closure.declaredCredit - closure.systemCredit === 0
                        ? 'text-slate-400'
                        : closure.declaredCredit - closure.systemCredit > 0
                        ? 'text-blue-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {formatBrl(closure.declaredCredit - closure.systemCredit)}
                  </span>
                </div>
              </div>

              {/* Cartão Débito */}
              <div className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-800/20">
                <span className="font-semibold text-slate-200">Cartão de Débito</span>
                <div className="flex items-center space-x-12 font-mono">
                  <span className="text-slate-300">{formatBrl(closure.systemDebit)}</span>
                  <span className="text-cyan-400 font-bold">{formatBrl(closure.declaredDebit)}</span>
                  <span
                    className={`w-20 text-right font-bold ${
                      closure.declaredDebit - closure.systemDebit === 0
                        ? 'text-slate-400'
                        : closure.declaredDebit - closure.systemDebit > 0
                        ? 'text-blue-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {formatBrl(closure.declaredDebit - closure.systemDebit)}
                  </span>
                </div>
              </div>

              {/* PIX */}
              <div className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-800/20">
                <span className="font-semibold text-slate-200">PIX</span>
                <div className="flex items-center space-x-12 font-mono">
                  <span className="text-slate-300">{formatBrl(closure.systemPix)}</span>
                  <span className="text-teal-400 font-bold">{formatBrl(closure.declaredPix)}</span>
                  <span
                    className={`w-20 text-right font-bold ${
                      closure.declaredPix - closure.systemPix === 0
                        ? 'text-slate-400'
                        : closure.declaredPix - closure.systemPix > 0
                        ? 'text-blue-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {formatBrl(closure.declaredPix - closure.systemPix)}
                  </span>
                </div>
              </div>

              {/* Convênio / PBM */}
              <div className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-800/20">
                <span className="font-semibold text-slate-200">Convênio / PBM</span>
                <div className="flex items-center space-x-12 font-mono">
                  <span className="text-slate-300">{formatBrl(closure.systemPbm)}</span>
                  <span className="text-purple-400 font-bold">{formatBrl(closure.declaredPbm)}</span>
                  <span
                    className={`w-20 text-right font-bold ${
                      closure.declaredPbm - closure.systemPbm === 0
                        ? 'text-slate-400'
                        : closure.declaredPbm - closure.systemPbm > 0
                        ? 'text-blue-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {formatBrl(closure.declaredPbm - closure.systemPbm)}
                  </span>
                </div>
              </div>

              {/* Totais Gerais */}
              <div className="px-4 py-3 bg-slate-950 font-bold flex items-center justify-between text-sm">
                <span className="text-white">TOTAL GERAL</span>
                <div className="flex items-center space-x-12 font-mono">
                  <span className="text-slate-200">{formatBrl(closure.systemTotal)}</span>
                  <span className="text-amber-400">{formatBrl(closure.declaredTotal)}</span>
                  <span
                    className={`w-20 text-right ${
                      closure.totalDifference === 0
                        ? 'text-emerald-400'
                        : closure.totalDifference > 0
                        ? 'text-blue-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {closure.totalDifference > 0 ? `+${formatBrl(closure.totalDifference)}` : formatBrl(closure.totalDifference)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Observações do Operador registradas */}
          {closure.operatorNotes && (
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 text-xs">
              <span className="font-semibold text-slate-300 block mb-0.5">Observação do Operador:</span>
              <p className="text-slate-400 italic">"{closure.operatorNotes}"</p>
            </div>
          )}

          {/* Seção do Gerente (Homologação) */}
          <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/70 space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Parecer da Auditoria Gerencial</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Gerente Responsável
                </label>
                <input
                  type="text"
                  data-testid="input-manager-name"
                  value={managerName}
                  disabled={!isPending || isSubmitting}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="Nome do gerente"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Parecer / Justificativa
                </label>
                <input
                  type="text"
                  data-testid="input-manager-notes"
                  value={managerNotes}
                  disabled={!isPending || isSubmitting}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="Ex: Quebra de centavos tolerável / comprovante conferido"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* Thermal Receipt Preview View */}
          {showReceipt && (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <span>Comprovante Térmico ESC/POS (48 Colunas)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowReceipt(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Ocultar
                </button>
              </div>
              <pre
                data-testid="receipt-text-preview"
                className="bg-black/90 p-3 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800"
              >
                {receiptText}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            data-testid="btn-print-closure-receipt"
            onClick={handleFetchReceipt}
            disabled={isLoadingReceipt}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>{isLoadingReceipt ? 'Carregando...' : 'Imprimir Comprovante (ESC/POS)'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              Fechar
            </button>

            {isPending && (
              <>
                <button
                  type="button"
                  data-testid="btn-reject-closure"
                  onClick={() => handleReview(false)}
                  disabled={isSubmitting}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-700 cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span>Rejeitar</span>
                </button>

                <button
                  type="button"
                  data-testid="btn-approve-closure"
                  onClick={() => handleReview(true)}
                  disabled={isSubmitting}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Aprovar Fechamento</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
