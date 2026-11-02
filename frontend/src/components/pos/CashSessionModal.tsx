import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  X,
  User,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  QrCode,
  Banknote,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { CashSession, CashSessionSummary } from '../../services/api';

export interface CashSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'OPEN' | 'CLOSE';
  currentSession?: CashSession | null;
  sessionSummary?: CashSessionSummary | null;
  onConfirmOpen?: (operatorName: string, initialCash: number) => Promise<void> | void;
  onConfirmClose?: () => Promise<void> | void;
  isLoading?: boolean;
}

function formatBrl(amount: number): string {
  return `R$ ${amount.toFixed(2).replace('.', ',')}`;
}

export default function CashSessionModal({
  isOpen,
  onClose,
  mode,
  currentSession,
  sessionSummary,
  onConfirmOpen,
  onConfirmClose,
  isLoading = false,
}: CashSessionModalProps) {
  const [operatorName, setOperatorName] = useState('');
  const [initialCash, setInitialCash] = useState('100.00');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (mode === 'OPEN') {
        setOperatorName('');
        setInitialCash('100.00');
        setErrors({});
      }
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmitOpen = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!operatorName.trim()) {
      newErrors.operatorName = 'Nome do operador é obrigatório';
    }

    const cashValue = parseFloat(initialCash.replace(',', '.'));
    if (isNaN(cashValue) || cashValue < 0) {
      newErrors.initialCash = 'Fundo de troco não pode ser negativo';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    if (onConfirmOpen) {
      onConfirmOpen(operatorName.trim(), cashValue);
    }
  };

  const handleConfirmClose = () => {
    if (onConfirmClose) {
      onConfirmClose();
    }
  };

  const totalsByMethod = sessionSummary?.totalsByMethod || {
    DINHEIRO: 0,
    CARTAO_CREDITO: 0,
    CARTAO_DEBITO: 0,
    PIX: 0,
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-session-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div
          className={`px-6 py-4 text-white flex items-center justify-between shadow-sm ${
            mode === 'OPEN'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700'
              : 'bg-gradient-to-r from-indigo-700 to-slate-800'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              {mode === 'OPEN' ? (
                <Unlock className="w-6 h-6 text-white" />
              ) : (
                <Lock className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h2 id="cash-session-modal-title" className="text-lg font-bold">
                {mode === 'OPEN' ? 'Abertura de Caixa' : 'Fechamento de Caixa'}
              </h2>
              <p className="text-xs text-white/80">
                {mode === 'OPEN'
                  ? 'Informe o operador e o fundo de troco inicial para abrir o turno'
                  : 'Conferência cega e resumo consolidado financeiro do turno'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            data-testid="close-modal-btn"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {mode === 'OPEN' ? (
            <form noValidate onSubmit={handleSubmitOpen} className="space-y-4">
              <div>
                <label
                  htmlFor="operator-name-input"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Nome do Operador
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    id="operator-name-input"
                    aria-label="Nome do Operador"
                    type="text"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    placeholder="Ex: Carlos Operador"
                    autoFocus
                    className={`block w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border ${
                      errors.operatorName
                        ? 'border-red-400 focus:ring-red-500 focus:border-red-500 bg-red-50/50'
                        : 'border-slate-300 focus:ring-emerald-500 focus:border-emerald-500'
                    } focus:outline-none focus:ring-2`}
                  />
                </div>
                {errors.operatorName && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.operatorName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="initial-cash-input"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Fundo de Troco (R$)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <input
                    id="initial-cash-input"
                    aria-label="Fundo de Troco"
                    type="number"
                    step="0.01"
                    min="0"
                    value={initialCash}
                    onChange={(e) => setInitialCash(e.target.value)}
                    placeholder="100.00"
                    className={`block w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border font-mono font-bold ${
                      errors.initialCash
                        ? 'border-red-400 focus:ring-red-500 focus:border-red-500 bg-red-50/50'
                        : 'border-slate-300 focus:ring-emerald-500 focus:border-emerald-500'
                    } focus:outline-none focus:ring-2`}
                  />
                </div>
                {errors.initialCash && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.initialCash}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Valor em cédulas e moedas disponível na gaveta física para troco.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition flex items-center space-x-2 disabled:opacity-50"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isLoading ? 'Abrindo...' : 'Abrir Caixa'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              {/* Informações da Sessão */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Operador Atual</span>
                  <p className="text-base font-bold text-slate-800">
                    {currentSession?.operatorName || 'Não identificado'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 uppercase font-semibold">Abertura</span>
                  <p className="text-xs text-slate-600 font-mono">
                    {currentSession?.openedAt
                      ? new Date(currentSession.openedAt.replace(' ', 'T')).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '--:--'}
                  </p>
                </div>
              </div>

              {/* Resumo Consolidado de Vendas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
                  <span className="text-xs font-semibold text-blue-700 uppercase">Vendas Realizadas</span>
                  <p className="text-2xl font-black text-blue-900 mt-1">
                    {sessionSummary?.totalSalesCount ?? 0}
                  </p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                  <span className="text-xs font-semibold text-emerald-700 uppercase">Total Bruto Faturado</span>
                  <p className="text-2xl font-black text-emerald-900 mt-1">
                    {formatBrl(sessionSummary?.totalSalesAmount ?? 0)}
                  </p>
                </div>
              </div>

              {/* Totais por Forma de Pagamento */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Faturamento por Forma de Pagamento
                </div>
                <div className="p-4 space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center text-slate-600 gap-2">
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      Dinheiro:
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatBrl(totalsByMethod.DINHEIRO ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center text-slate-600 gap-2">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      Cartão de Crédito:
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatBrl(totalsByMethod.CARTAO_CREDITO ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center text-slate-600 gap-2">
                      <CreditCard className="w-4 h-4 text-sky-600" />
                      Cartão de Débito:
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatBrl(totalsByMethod.CARTAO_DEBITO ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center text-slate-600 gap-2">
                      <QrCode className="w-4 h-4 text-purple-600" />
                      Pix:
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatBrl(totalsByMethod.PIX ?? 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Movimentações de Caixa & Saldo em Gaveta */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                  Movimentações & Conferência de Gaveta
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-600 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                      Suprimentos:
                    </span>
                    <span className="font-mono font-bold text-blue-700">
                      {formatBrl(sessionSummary?.totalSupplies ?? 0)}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-600 flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                      Sangrias:
                    </span>
                    <span className="font-mono font-bold text-red-700">
                      {formatBrl(sessionSummary?.totalSangrias ?? 0)}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-lg border-2 border-amber-300 flex items-center justify-between mt-2">
                  <div>
                    <span className="text-xs font-bold text-slate-700 uppercase">
                      Dinheiro Esperado na Gaveta
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Fundo Inicial + Suprimentos - Sangrias + Vendas em Dinheiro
                    </p>
                  </div>
                  <span className="text-xl font-black font-mono text-emerald-700">
                    {formatBrl(sessionSummary?.expectedCash ?? 0)}
                  </span>
                </div>
              </div>

              {/* Botões do Fechamento */}
              <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClose}
                  disabled={isLoading}
                  className="px-5 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-sm shadow-sm transition flex items-center space-x-2 disabled:opacity-50"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isLoading ? 'Fechando...' : 'Confirmar Fechamento'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
