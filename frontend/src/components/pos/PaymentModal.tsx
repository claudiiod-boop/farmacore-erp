import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Banknote,
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  X,
  Copy,
  Check,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { PaymentItem, PaymentMethod } from '../../services/api';
import { formatBrl } from '../ProductSearch';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  onConfirmPayments: (payments: PaymentItem[]) => Promise<void> | void;
  isLoading?: boolean;
}

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
  { id: 'CARTAO_CREDITO', label: 'Cartão Crédito', icon: CreditCard },
  { id: 'CARTAO_DEBITO', label: 'Cartão Débito', icon: CreditCard },
  { id: 'PIX', label: 'Pix', icon: QrCode },
];

export default function PaymentModal({
  isOpen,
  onClose,
  totalAmount,
  onConfirmPayments,
  isLoading = false,
}: PaymentModalProps) {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [activeMethod, setActiveMethod] = useState<PaymentMethod>('DINHEIRO');
  const [amountInput, setAmountInput] = useState<string>('');
  const [copiedPix, setCopiedPix] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPayments([]);
      setActiveMethod('DINHEIRO');
      setAmountInput(totalAmount > 0 ? totalAmount.toFixed(2) : '');
      setCopiedPix(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, totalAmount]);

  // Calculations
  const totalPaid = useMemo(() => {
    return payments.reduce((acc, p) => acc + p.amount, 0);
  }, [payments]);

  const remaining = useMemo(() => {
    return Math.max(0, +(totalAmount - totalPaid).toFixed(2));
  }, [totalAmount, totalPaid]);

  const changeAmount = useMemo(() => {
    return Math.max(0, +(totalPaid - totalAmount).toFixed(2));
  }, [totalAmount, totalPaid]);

  const cashPaid = useMemo(() => {
    return payments
      .filter((p) => p.method === 'DINHEIRO')
      .reduce((acc, p) => acc + p.amount, 0);
  }, [payments]);

  // EXCESS_NON_CASH_PAYMENT invariant:
  // If totalPaid > totalAmount, cashPaid must be >= changeAmount.
  // Otherwise, non-cash payment is generating change, which is strictly prohibited.
  const isExcessNonCash = useMemo(() => {
    if (changeAmount > 0) {
      return cashPaid < changeAmount;
    }
    return false;
  }, [changeAmount, cashPaid]);

  const canFinalize = useMemo(() => {
    return (
      payments.length > 0 &&
      totalPaid >= totalAmount &&
      !isExcessNonCash &&
      !isLoading
    );
  }, [payments.length, totalPaid, totalAmount, isExcessNonCash, isLoading]);

  // Dynamic Pix payload simulation
  const pixCopyPasteKey = useMemo(() => {
    const amountStr = remaining > 0 ? remaining.toFixed(2) : totalAmount.toFixed(2);
    return `00020126580014br.gov.bcb.pix0136farmacore-pos-pix-key520400005303986540${amountStr}5802BR5918FARMACORE DROGARIA6009SAO PAULO62070503***6304`;
  }, [remaining, totalAmount]);

  // Switch method
  const handleSelectMethod = (method: PaymentMethod) => {
    setActiveMethod(method);
    if (!amountInput || parseFloat(amountInput) === 0) {
      setAmountInput(remaining > 0 ? remaining.toFixed(2) : '');
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Quick cash buttons
  const handleExactValue = () => {
    const val = remaining > 0 ? remaining : totalAmount;
    setAmountInput(val.toFixed(2));
  };

  const handleAddQuickCash = (increment: number) => {
    const current = parseFloat(amountInput) || 0;
    const nextVal = current + increment;
    setAmountInput(nextVal.toFixed(2));
  };

  // Add payment
  const handleAddPayment = () => {
    const parsed = parseFloat(amountInput);
    if (isNaN(parsed) || parsed <= 0) return;

    const roundedAmount = +(parsed.toFixed(2));
    const nextPayments = [...payments, { method: activeMethod, amount: roundedAmount }];
    setPayments(nextPayments);

    // Update remaining for next payment
    const newPaid = totalPaid + roundedAmount;
    const newRemaining = Math.max(0, +(totalAmount - newPaid).toFixed(2));
    setAmountInput(newRemaining > 0 ? newRemaining.toFixed(2) : '');

    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Remove payment
  const handleRemovePayment = (index: number) => {
    const nextPayments = payments.filter((_, i) => i !== index);
    setPayments(nextPayments);

    const newPaid = nextPayments.reduce((acc, p) => acc + p.amount, 0);
    const newRemaining = Math.max(0, +(totalAmount - newPaid).toFixed(2));
    setAmountInput(newRemaining > 0 ? newRemaining.toFixed(2) : '');
  };

  // Copy pix key
  const handleCopyPix = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(pixCopyPasteKey);
        setCopiedPix(true);
        setTimeout(() => setCopiedPix(false), 2500);
      }
    } catch {
      // fallback
    }
  };

  // Submit
  const handleConfirm = () => {
    if (!canFinalize) return;
    onConfirmPayments(payments);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Enter') {
        // If Enter is pressed and we can finalize and the active element is not an input that should just submit payment
        if (canFinalize) {
          e.preventDefault();
          onConfirmPayments(payments);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, canFinalize, onClose, onConfirmPayments, payments]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 id="payment-modal-title" className="text-lg font-bold tracking-tight">
              Recebimento / Pagamento PDV
            </h2>
            <p className="text-xs text-slate-400">
              Selecione as formas de pagamento e confira os valores
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-slate-400 hover:text-white p-1 rounded-md transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Totais de Resumo */}
        <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-200 p-4 gap-4 text-center">
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total a Pagar
            </span>
            <span className="text-xl font-black text-slate-900">
              {formatBrl(totalAmount)}
            </span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Pago
            </span>
            <span className="text-xl font-black text-blue-600">
              {formatBrl(totalPaid)}
            </span>
          </div>

          <div
            className={`p-3 rounded-lg border shadow-xs ${
              remaining > 0
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider block">
              {remaining > 0 ? 'Falta Pagar' : 'Troco'}
            </span>
            <span className="text-xl font-black">
              {remaining > 0 ? formatBrl(remaining) : formatBrl(changeAmount)}
            </span>
          </div>
        </div>

        {/* Alerta de Invariante Fiscal: EXCESS_NON_CASH_PAYMENT */}
        {isExcessNonCash && (
          <div
            role="alert"
            className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-300 rounded-lg flex items-start space-x-2 text-rose-900 text-xs"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">EXCESS_NON_CASH_PAYMENT: Troco não permitido em cartão ou Pix</p>
              <p className="text-rose-700 mt-0.5">
                O troco gerado de {formatBrl(changeAmount)} excede o valor pago em dinheiro ({formatBrl(cashPaid)}).
                Remova ou ajuste o pagamento em cartão/Pix para corresponder ao valor exato restante.
              </p>
            </div>
          </div>
        )}

        {/* Corpo: Abas de Métodos e Entrada de Valores */}
        <div className="p-6 space-y-5">
          {/* Abas das Formas de Pagamento */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Forma de Pagamento
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((pm) => {
                const Icon = pm.icon;
                const isSelected = activeMethod === pm.id;
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => handleSelectMethod(pm.id)}
                    className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-lg border text-xs font-bold transition ${
                      isSelected
                        ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs ring-1 ring-blue-600'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-1 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`} />
                    <span>{pm.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Área de Configuração do Método Selecionado */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
            {/* Atalhos Rápidos de Dinheiro */}
            {activeMethod === 'DINHEIRO' && (
              <div>
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Atalhos de Cédulas
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleExactValue}
                    className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-semibold text-xs transition"
                  >
                    Valor Exato
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddQuickCash(10)}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded font-semibold text-xs transition"
                  >
                    +R$ 10
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddQuickCash(20)}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded font-semibold text-xs transition"
                  >
                    +R$ 20
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddQuickCash(50)}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded font-semibold text-xs transition"
                  >
                    +R$ 50
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddQuickCash(100)}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded font-semibold text-xs transition"
                  >
                    +R$ 100
                  </button>
                </div>
              </div>
            )}

            {/* Simulação Dinâmica Pix */}
            {activeMethod === 'PIX' && (
              <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col items-center space-y-3">
                <div className="flex items-center space-x-2 text-emerald-700 font-bold text-xs uppercase">
                  <QrCode className="w-4 h-4" />
                  <span>QR Code Dinâmico Pix FarmaCore</span>
                </div>

                {/* SVG QR Code */}
                <div className="bg-slate-950 p-3 rounded-lg shadow-sm">
                  <svg
                    data-testid="pix-qrcode"
                    viewBox="0 0 100 100"
                    className="w-32 h-32 bg-white p-1 rounded"
                  >
                    {/* Corner squares (Finder patterns) */}
                    <rect x="5" y="5" width="25" height="25" fill="#020617" />
                    <rect x="8" y="8" width="19" height="19" fill="#ffffff" />
                    <rect x="11" y="11" width="13" height="13" fill="#020617" />

                    <rect x="70" y="5" width="25" height="25" fill="#020617" />
                    <rect x="73" y="8" width="19" height="19" fill="#ffffff" />
                    <rect x="76" y="11" width="13" height="13" fill="#020617" />

                    <rect x="5" y="70" width="25" height="25" fill="#020617" />
                    <rect x="8" y="73" width="19" height="19" fill="#ffffff" />
                    <rect x="11" y="76" width="13" height="13" fill="#020617" />

                    {/* Matrix patterns */}
                    <rect x="35" y="10" width="8" height="8" fill="#020617" />
                    <rect x="50" y="15" width="12" height="6" fill="#020617" />
                    <rect x="15" y="40" width="10" height="10" fill="#020617" />
                    <rect x="35" y="35" width="30" height="30" fill="#059669" rx="4" />
                    <circle cx="50" cy="50" r="8" fill="#ffffff" />
                    <rect x="75" y="40" width="12" height="15" fill="#020617" />
                    <rect x="40" y="75" width="15" height="15" fill="#020617" />
                    <rect x="65" y="70" width="10" height="10" fill="#020617" />
                    <rect x="80" y="85" width="10" height="10" fill="#020617" />
                  </svg>
                </div>

                <div className="flex items-center space-x-1.5 text-xs text-slate-600 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  <span>Aguardando confirmação do pagamento Pix...</span>
                </div>

                {/* Copia e Cola */}
                <div className="w-full flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={pixCopyPasteKey}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-[11px] font-mono text-slate-600 truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold flex items-center transition shrink-0"
                  >
                    {copiedPix ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        Copiar Pix
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Campo de Entrada de Valor e Botão Adicionar */}
            <div className="flex items-end space-x-3">
              <div className="flex-1">
                <label
                  htmlFor="payment-amount-input"
                  className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1"
                >
                  Valor a Pagar (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                    R$
                  </span>
                  <input
                    id="payment-amount-input"
                    ref={inputRef}
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (amountInput && parseFloat(amountInput) > 0) {
                          handleAddPayment();
                        } else if (canFinalize) {
                          handleConfirm();
                        }
                      }
                    }}
                    placeholder="0,00"
                    className="w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddPayment}
                disabled={!amountInput || parseFloat(amountInput) <= 0}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg transition flex items-center shadow-sm"
              >
                <span>Adicionar Pagamento</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>
            </div>
          </div>

          {/* Lista de Pagamentos Lançados */}
          <div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Pagamentos Lançados ({payments.length})
            </span>

            {payments.length === 0 ? (
              <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                Nenhum pagamento registrado ainda. Selecione um método e adicione o valor.
              </div>
            ) : (
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {payments.map((p, idx) => {
                  const methodLabel =
                    PAYMENT_METHODS.find((m) => m.id === p.method)?.label || p.method;
                  return (
                    <div
                      key={idx}
                      data-testid="payment-item"
                      className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg shadow-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800 text-xs">
                          {methodLabel}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          ({p.method})
                        </span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="font-black text-slate-900 text-sm">
                          {formatBrl(p.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemovePayment(idx)}
                          aria-label="Remover pagamento"
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé: Ações */}
        <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition"
          >
            Cancelar (Esc)
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canFinalize}
            className={`px-6 py-2.5 font-bold text-sm rounded-lg transition flex items-center shadow-md ${
              canFinalize
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando Venda...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Finalizar Venda (Enter)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
