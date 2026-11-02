import React, { useState, useEffect } from 'react';
import {
  TrendingDown,
  TrendingUp,
  X,
  AlertTriangle,
  User,
  DollarSign,
  FileText,
  Loader2,
  Wallet,
} from 'lucide-react';
import { CashMovementType } from '../../services/api';

export interface CashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCash: number;
  operatorName: string;
  onConfirmMovement: (type: CashMovementType, amount: number, reason: string) => Promise<void> | void;
  isLoading?: boolean;
}

function formatBrl(amount: number): string {
  return `R$ ${amount.toFixed(2).replace('.', ',')}`;
}

export default function CashMovementModal({
  isOpen,
  onClose,
  currentCash,
  operatorName,
  onConfirmMovement,
  isLoading = false,
}: CashMovementModalProps) {
  const [type, setType] = useState<CashMovementType>('SANGRIA');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setType('SANGRIA');
      setAmount('');
      setReason('');
      setErrors({});
    }
  }, [isOpen]);

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

  const parsedAmount = parseFloat(amount.replace(',', '.'));
  const isSangria = type === 'SANGRIA';
  const isInsufficientDrawerCash = isSangria && !isNaN(parsedAmount) && parsedAmount > currentCash;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = 'O valor deve ser maior que zero';
    } else if (isSangria && parsedAmount > currentCash) {
      newErrors.amount = 'Saldo em dinheiro na gaveta insuficiente para realizar a sangria';
    }

    if (!reason.trim()) {
      newErrors.reason = 'Motivo da movimentação é obrigatório';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    const cleanAmount = Number(parsedAmount.toFixed(2));
    onConfirmMovement(type, cleanAmount, reason.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-movement-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div
          className={`px-6 py-4 text-white flex items-center justify-between shadow-sm ${
            isSangria
              ? 'bg-gradient-to-r from-red-600 to-rose-700'
              : 'bg-gradient-to-r from-blue-600 to-indigo-700'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              {isSangria ? (
                <TrendingDown className="w-6 h-6 text-white" />
              ) : (
                <TrendingUp className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h2 id="cash-movement-modal-title" className="text-lg font-bold">
                Movimentação de Caixa
              </h2>
              <p className="text-xs text-white/80">
                {isSangria
                  ? 'Retirada / Recolhimento de Segurança'
                  : 'Aporte / Entrada de Fundo de Troco'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            data-testid="close-movement-modal"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form noValidate onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Status da Gaveta e Operador */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-slate-200/70 rounded-lg text-slate-600">
                <User className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Operador</span>
                <p className="text-sm font-bold text-slate-800 truncate">{operatorName}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Saldo em Gaveta</span>
                <p className="text-sm font-black font-mono text-emerald-700">
                  {formatBrl(currentCash)}
                </p>
              </div>
            </div>
          </div>

          {/* Seleção do Tipo de Movimentação */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
              Tipo de Movimentação
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('SANGRIA')}
                className={`py-3 px-4 rounded-xl border flex items-center justify-center space-x-2 font-bold text-sm transition ${
                  isSangria
                    ? 'border-red-500 bg-red-50 text-red-700 shadow-sm ring-2 ring-red-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span>Sangria (Retirada)</span>
              </button>
              <button
                type="button"
                onClick={() => setType('SUPPLY')}
                className={`py-3 px-4 rounded-xl border flex items-center justify-center space-x-2 font-bold text-sm transition ${
                  !isSangria
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm ring-2 ring-blue-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>Suprimento (Aporte)</span>
              </button>
            </div>
          </div>

          {/* Campo Valor */}
          <div>
            <label
              htmlFor="movement-amount-input"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Valor da Movimentação (R$)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <DollarSign className="w-5 h-5" />
              </div>
              <input
                id="movement-amount-input"
                aria-label="Valor da Movimentação"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                className={`block w-full pl-10 pr-4 py-2.5 text-base rounded-lg border font-mono font-bold ${
                  errors.amount || isInsufficientDrawerCash
                    ? 'border-red-400 focus:ring-red-500 focus:border-red-500 bg-red-50/50'
                    : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'
                } focus:outline-none focus:ring-2`}
              />
            </div>
            {isInsufficientDrawerCash && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Saldo em dinheiro na gaveta insuficiente ({formatBrl(currentCash)})
              </p>
            )}
            {errors.amount && !isInsufficientDrawerCash && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {errors.amount}
              </p>
            )}
          </div>

          {/* Campo Motivo */}
          <div>
            <label
              htmlFor="movement-reason-input"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Motivo / Justificativa
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 pt-3 flex items-start pointer-events-none text-slate-400">
                <FileText className="w-5 h-5" />
              </div>
              <textarea
                id="movement-reason-input"
                aria-label="Motivo"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  isSangria
                    ? 'Ex: Recolhimento de excesso de numerário para cofre central'
                    : 'Ex: Aporte emergencial de moedas de troco'
                }
                className={`block w-full pl-10 pr-4 py-2 text-sm rounded-lg border ${
                  errors.reason
                    ? 'border-red-400 focus:ring-red-500 focus:border-red-500 bg-red-50/50'
                    : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'
                } focus:outline-none focus:ring-2`}
              />
            </div>
            {errors.reason && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {errors.reason}
              </p>
            )}
          </div>

          {/* Rodapé / Ações */}
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
              disabled={isLoading || isInsufficientDrawerCash}
              className={`px-5 py-2 rounded-lg text-white font-semibold text-sm shadow-sm transition flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isSangria
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isLoading ? 'Registrando...' : 'Confirmar Movimentação'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
