import { useState, useMemo, useEffect } from 'react';
import { X, Lock, AlertTriangle, DollarSign, CreditCard, QrCode, FileText, CheckCircle2 } from 'lucide-react';
import { formatBrl } from '../ProductSearch';
import { api, BlindCashClosure } from '../../services/api';

interface BlindClosureModalProps {
  isOpen: boolean;
  sessionId: number;
  operatorName: string;
  onClose: () => void;
  onSuccess: (closure: BlindCashClosure) => void;
}

export default function BlindClosureModal({
  isOpen,
  sessionId,
  operatorName,
  onClose,
  onSuccess,
}: BlindClosureModalProps) {
  const [cash, setCash] = useState<string>('');
  const [credit, setCredit] = useState<string>('');
  const [debit, setDebit] = useState<string>('');
  const [pix, setPix] = useState<string>('');
  const [pbm, setPbm] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset inputs when modal opens
  useEffect(() => {
    if (isOpen) {
      setCash('');
      setCredit('');
      setDebit('');
      setPix('');
      setPbm('');
      setNotes('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  const numCash = parseFloat(cash) || 0;
  const numCredit = parseFloat(credit) || 0;
  const numDebit = parseFloat(debit) || 0;
  const numPix = parseFloat(pix) || 0;
  const numPbm = parseFloat(pbm) || 0;

  const totalDeclared = useMemo(() => {
    return +(numCash + numCredit + numDebit + numPix + numPbm).toFixed(2);
  }, [numCash, numCredit, numDebit, numPix, numPbm]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (numCash < 0 || numCredit < 0 || numDebit < 0 || numPix < 0 || numPbm < 0) {
      setErrorMessage('Nenhum valor declarado pode ser negativo.');
      return;
    }

    setIsSubmitting(true);
    try {
      const closure = await api.declareBlindClosure({
        sessionId,
        operatorName,
        declaredCash: numCash,
        declaredCredit: numCredit,
        declaredDebit: numDebit,
        declaredPix: numPix,
        declaredPbm: numPbm,
        operatorNotes: notes.trim() || undefined,
      });

      onSuccess(closure);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao processar fechamento cego de caixa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="blind-closure-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-amber-500/20 text-amber-400 p-2 rounded-lg border border-amber-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 id="blind-closure-title" className="text-lg font-bold text-white tracking-wide">
                Fechamento Cego de Caixa
              </h2>
              <p className="text-xs text-slate-400">
                Sessão #{sessionId} &bull; Operador: <span className="font-semibold text-slate-200">{operatorName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white transition p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer disabled:opacity-50"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Badge */}
        <div className="bg-amber-950/40 border-b border-amber-900/50 px-6 py-2.5 flex items-center space-x-2 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Fechamento auditado às cegas: informe a contagem física real dos valores em gaveta. Os totais do sistema não são exibidos nesta etapa.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-700/60 text-rose-200 text-xs rounded-lg flex items-center space-x-2">
              <span className="font-bold">Erro:</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Dinheiro em Gaveta */}
            <div className="sm:col-span-2 bg-slate-800/60 p-3 rounded-xl border border-slate-700/80 focus-within:border-emerald-500 transition">
              <label htmlFor="input-declared-cash" className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                <span className="flex items-center space-x-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Dinheiro em Espécie (Físico em Gaveta)</span>
                </span>
                <span className="text-[11px] text-slate-400">Moedas + Cédulas</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
                <input
                  id="input-declared-cash"
                  data-testid="input-declared-cash"
                  type="number"
                  step="0.01"
                  min="0"
                  autoFocus
                  placeholder="0,00"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-base font-bold text-emerald-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Cartão de Crédito */}
            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/60 focus-within:border-blue-500 transition">
              <label htmlFor="input-declared-credit" className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 mb-1">
                <CreditCard className="w-4 h-4 text-blue-400" />
                <span>Cartão de Crédito</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                <input
                  id="input-declared-credit"
                  data-testid="input-declared-credit"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={credit}
                  onChange={(e) => setCredit(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm font-semibold text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Cartão de Débito */}
            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/60 focus-within:border-cyan-500 transition">
              <label htmlFor="input-declared-debit" className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 mb-1">
                <CreditCard className="w-4 h-4 text-cyan-400" />
                <span>Cartão de Débito</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                <input
                  id="input-declared-debit"
                  data-testid="input-declared-debit"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={debit}
                  onChange={(e) => setDebit(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm font-semibold text-white focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* PIX */}
            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/60 focus-within:border-teal-500 transition">
              <label htmlFor="input-declared-pix" className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 mb-1">
                <QrCode className="w-4 h-4 text-teal-400" />
                <span>PIX Estático / Dinâmico</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                <input
                  id="input-declared-pix"
                  data-testid="input-declared-pix"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={pix}
                  onChange={(e) => setPix(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm font-semibold text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Convênio / PBM */}
            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/60 focus-within:border-purple-500 transition">
              <label htmlFor="input-declared-pbm" className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 mb-1">
                <FileText className="w-4 h-4 text-purple-400" />
                <span>Convênio / PBM</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                <input
                  id="input-declared-pbm"
                  data-testid="input-declared-pbm"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={pbm}
                  onChange={(e) => setPbm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm font-semibold text-white focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Observações do Operador */}
          <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/60">
            <label htmlFor="input-operator-notes" className="block text-xs font-semibold text-slate-300 mb-1">
              Observações do Operador (Opcional)
            </label>
            <textarea
              id="input-operator-notes"
              data-testid="input-operator-notes"
              rows={2}
              placeholder="Ex: Sangria realizada às 16h; comprovante de POS anexado..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-slate-500 resize-none"
            />
          </div>

          {/* Card Total Declarado */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium">Total Físico Declarado:</span>
              <p className="text-2xl font-black text-white">{formatBrl(totalDeclared)}</p>
            </div>
            <div className="text-right text-[11px] text-slate-400">
              <span>Sessão será fechada</span>
              <br />
              <span className="text-amber-400 font-semibold">Submetida à gerência</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="btn-submit-blind-closure"
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Encerrando Caixa...' : 'Encerrar Caixa (Fechamento Cego)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
