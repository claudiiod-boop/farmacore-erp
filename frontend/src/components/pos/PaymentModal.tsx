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
  ShieldCheck,
  Building2,
  Receipt,
  User,
  Search,
  UserCheck,
  UserX,
} from 'lucide-react';
import { api, PaymentItem, PaymentMethod } from '../../services/api';
import { formatBrl } from '../ProductSearch';
import TefPinpadModal from '../tef/TefPinpadModal';
import type { TefPayResult } from '../../types/tef';
import type { Customer, CreditEligibilityResult } from '../../types/credit';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  onConfirmPayments: (
    payments: PaymentItem[],
    options?: { emitNfce?: boolean; customerId?: number; installments?: number }
  ) => Promise<void> | void;
  isLoading?: boolean;
  pbmSubsidyAmount?: number;
  pbmProtocol?: string;
}

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
  { id: 'CARTAO_CREDITO', label: 'Cartão Crédito', icon: CreditCard },
  { id: 'CARTAO_DEBITO', label: 'Cartão Débito', icon: CreditCard },
  { id: 'PIX', label: 'Pix', icon: QrCode },
  { id: 'CONVENIO_PBM', label: 'Convênio PBM', icon: ShieldCheck },
  { id: 'CONVENIO', label: 'Convênio Empresa', icon: Building2 },
  { id: 'CREDIARIO', label: 'Crediário Próprio', icon: Receipt },
];

export default function PaymentModal({
  isOpen,
  onClose,
  totalAmount,
  onConfirmPayments,
  isLoading = false,
  pbmSubsidyAmount,
  pbmProtocol,
}: PaymentModalProps) {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [activeMethod, setActiveMethod] = useState<PaymentMethod>('DINHEIRO');
  const [amountInput, setAmountInput] = useState<string>('');
  const [copiedPix, setCopiedPix] = useState(false);
  const [emitNfce, setEmitNfce] = useState(true);
  const [isTefModalOpen, setIsTefModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Credit / Convênio state
  const [creditCpf, setCreditCpf] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [eligibilityResult, setEligibilityResult] = useState<CreditEligibilityResult | null>(null);
  const [isCheckingCredit, setIsCheckingCredit] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);
  const [installments, setInstallments] = useState<number>(1);

  // Initialize or reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (pbmSubsidyAmount && pbmSubsidyAmount > 0) {
        const pbmPayAmount = Math.min(totalAmount, Number(pbmSubsidyAmount.toFixed(2)));
        setPayments([{ method: 'CONVENIO_PBM', amount: pbmPayAmount }]);
        const rem = Math.max(0, +(totalAmount - pbmPayAmount).toFixed(2));
        setAmountInput(rem > 0 ? rem.toFixed(2) : '');
      } else {
        setPayments([]);
        setAmountInput(totalAmount > 0 ? totalAmount.toFixed(2) : '');
      }
      setActiveMethod('DINHEIRO');
      setCopiedPix(false);
      setEmitNfce(true);
      setCreditCpf('');
      setSelectedCustomer(null);
      setEligibilityResult(null);
      setIsCheckingCredit(false);
      setCreditError(null);
      setInstallments(1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, totalAmount, pbmSubsidyAmount]);

  // Calculations
  const totalPaid = useMemo(() => {
    return Number(payments.reduce((acc, p) => acc + p.amount, 0).toFixed(2));
  }, [payments]);

  const remaining = useMemo(() => {
    return Math.max(0, +(totalAmount - totalPaid).toFixed(2));
  }, [totalAmount, totalPaid]);

  const changeAmount = useMemo(() => {
    return Math.max(0, +(totalPaid - totalAmount).toFixed(2));
  }, [totalAmount, totalPaid]);

  const cashPaid = useMemo(() => {
    return Number(
      payments
        .filter((p) => p.method === 'DINHEIRO')
        .reduce((acc, p) => acc + p.amount, 0)
        .toFixed(2)
    );
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

  const isCreditMethod = activeMethod === 'CONVENIO' || activeMethod === 'CREDIARIO';

  const handleCheckCredit = async (cpfToSearch?: string) => {
    const raw = (cpfToSearch || creditCpf).replace(/\D/g, '');
    if (!raw) {
      setCreditError('Informe um CPF válido para consulta.');
      return;
    }
    setIsCheckingCredit(true);
    setCreditError(null);
    try {
      const customer = await api.credit.getCustomerByCpf(raw);
      setSelectedCustomer(customer);
      const parsedAmount = parseFloat(amountInput) || remaining || totalAmount;
      const elig = await api.credit.checkCreditEligibility(customer.id, parsedAmount);
      setEligibilityResult(elig);
      if (!elig.isEligible) {
        setCreditError(elig.reason || 'Cliente com restrição de crédito.');
      }
    } catch (err: any) {
      setSelectedCustomer(null);
      setEligibilityResult(null);
      setCreditError(err.message || 'Cliente não encontrado pelo CPF informado');
    } finally {
      setIsCheckingCredit(false);
    }
  };

  const isCreditBlocked = useMemo(() => {
    if (!isCreditMethod) return false;
    if (!selectedCustomer) return true;
    if (selectedCustomer.status === 'BLOCKED_OVERDUE') return true;
    if (eligibilityResult && !eligibilityResult.isEligible) return true;
    const parsedAmount = parseFloat(amountInput) || 0;
    const available =
      eligibilityResult?.availableLimit ??
      ((selectedCustomer.creditLimit ?? selectedCustomer.credit_limit ?? 0) -
        (selectedCustomer.currentDebt ?? selectedCustomer.current_debt ?? 0));
    if (parsedAmount > available) return true;
    return false;
  }, [isCreditMethod, selectedCustomer, eligibilityResult, amountInput]);

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
    if (isCreditMethod && isCreditBlocked) return;

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

  // Callback when TEF PinPad transaction is approved
  const handleTefApproved = (result: TefPayResult) => {
    setIsTefModalOpen(false);
    const isCredit = result.operationType === 'CREDITO';
    const method: PaymentMethod = isCredit ? 'CARTAO_CREDITO' : 'CARTAO_DEBITO';

    const newItem: PaymentItem = {
      method,
      amount: result.amount,
      tefTransactionUuid: result.transactionUuid,
      tefNsu: result.nsu,
      cardFiscalData: {
        tpIntegra: 1,
        cnpjCredenciadora: result.acquirerCnpj,
        tBand: result.brandCodeSefaz,
        cAut: result.authorizationCode,
      },
    };

    const nextPayments = [...payments, newItem];
    setPayments(nextPayments);

    const newPaid = +(totalPaid + result.amount).toFixed(2);
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
    const hasCreditPayment = payments.some(
      (p) => p.method === 'CONVENIO' || p.method === 'CREDIARIO'
    );
    onConfirmPayments(payments, {
      emitNfce,
      customerId: hasCreditPayment ? selectedCustomer?.id : undefined,
      installments: hasCreditPayment ? (installments || 1) : undefined,
    });
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTefModalOpen) return;

      if (e.key === 'F8') {
        e.preventDefault();
        setIsTefModalOpen(true);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }
        if (canFinalize) {
          e.preventDefault();
          onConfirmPayments(payments, { emitNfce });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isTefModalOpen, canFinalize, onClose, onConfirmPayments, payments, emitNfce]);

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
            <h2 id="payment-modal-title" className="text-lg font-bold tracking-tight flex items-center gap-2">
              Recebimento / Pagamento PDV
              {pbmProtocol && (
                <span className="text-xs font-mono font-semibold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700">
                  PBM Prot: {pbmProtocol}
                </span>
              )}
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
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Forma de Pagamento
              </label>
              <button
                type="button"
                data-testid="pay-with-tef-btn"
                onClick={() => setIsTefModalOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>[F8] Pagar com TEF (PinPad)</span>
              </button>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {PAYMENT_METHODS.map((pm) => {
                const Icon = pm.icon;
                const isSelected = activeMethod === pm.id;
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => handleSelectMethod(pm.id)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-[11px] font-bold transition cursor-pointer text-center ${
                      isSelected
                        ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs ring-1 ring-blue-600'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`} />
                    <span className="leading-tight">{pm.label}</span>
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

            {/* Configuração de Convênio e Crediário Próprio */}
            {isCreditMethod && (
              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>Validação de Crédito & Limite do Cliente</span>
                  </span>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {activeMethod === 'CONVENIO' ? 'Convênio Empresa' : 'Crediário Próprio'}
                  </span>
                </div>

                {/* Input de CPF e Busca */}
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      data-testid="credit-cpf-input"
                      value={creditCpf}
                      onChange={(e) => setCreditCpf(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCheckCredit();
                        }
                      }}
                      placeholder="CPF do cliente titular (somente números)..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    data-testid="check-credit-btn"
                    onClick={() => handleCheckCredit()}
                    disabled={isCheckingCredit}
                    className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    {isCheckingCredit ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>Consultar Elegibilidade</span>
                  </button>
                </div>

                {creditError && (
                  <div
                    data-testid="credit-error-banner"
                    className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs flex items-start space-x-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Restrição de Crédito:</p>
                      <p className="text-rose-700 mt-0.5">{creditError}</p>
                    </div>
                  </div>
                )}

                {/* Detalhes do Cliente e Limites */}
                {selectedCustomer && (
                  <div
                    data-testid="customer-credit-info"
                    className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 block">{selectedCustomer.name}</span>
                        <span className="text-slate-500 font-mono text-[11px]">CPF: {selectedCustomer.cpf}</span>
                      </div>
                      <div>
                        {selectedCustomer.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <UserCheck className="w-3 h-3" />
                            <span>ATIVO</span>
                          </span>
                        ) : (
                          <span
                            data-testid="blocked-customer-badge"
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300"
                          >
                            <UserX className="w-3 h-3" />
                            <span>BLOQUEADO POR ATRASO</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                      <div>
                        <span className="text-[11px] text-slate-500 font-semibold block">Limite Disponível:</span>
                        <span
                          data-testid="available-limit-display"
                          className="font-black text-sm text-emerald-600"
                        >
                          {formatBrl(
                            eligibilityResult?.availableLimit ??
                              Math.max(
                                0,
                                (selectedCustomer.creditLimit ?? selectedCustomer.credit_limit ?? 0) -
                                  (selectedCustomer.currentDebt ?? selectedCustomer.current_debt ?? 0)
                              )
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 font-semibold block">Dívida Atual:</span>
                        <span
                          data-testid="current-debt-display"
                          className="font-black text-sm text-rose-600"
                        >
                          {formatBrl(selectedCustomer.currentDebt ?? selectedCustomer.current_debt ?? 0)}
                        </span>
                      </div>
                    </div>

                    {/* Parcelamento 1x a 6x */}
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Parcelamento no Carnê:</label>
                      <select
                        data-testid="installments-select"
                        value={installments}
                        onChange={(e) => setInstallments(Number(e.target.value))}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white outline-hidden focus:ring-1 focus:ring-indigo-500"
                      >
                        {[1, 2, 3, 4, 5, 6].map((n) => {
                          const amt = parseFloat(amountInput) || remaining || totalAmount;
                          const perInstallment = amt > 0 ? (amt / n).toFixed(2) : '0,00';
                          return (
                            <option key={n} value={n}>
                              {n}x de R$ {perInstallment} {n === 1 ? '(À vista no carnê)' : 'mensais'}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                )}
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
                        e.stopPropagation();
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
                data-testid="add-payment-btn"
                onClick={handleAddPayment}
                disabled={!amountInput || parseFloat(amountInput) <= 0 || (isCreditMethod && isCreditBlocked)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg transition flex items-center shadow-sm cursor-pointer"
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
                        {p.tefNsu && (
                          <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                            TEF NSU: {p.tefNsu}
                          </span>
                        )}
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
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition"
            >
              Cancelar (Esc)
            </button>

            <label htmlFor="emitNfce" className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                id="emitNfce"
                checked={emitNfce}
                onChange={(e) => setEmitNfce(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <span>Emitir NFC-e Fiscal (Modelo 65)</span>
            </label>
          </div>

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

      <TefPinpadModal
        isOpen={isTefModalOpen}
        onClose={() => setIsTefModalOpen(false)}
        amount={remaining > 0 ? remaining : totalAmount}
        onPaymentApproved={handleTefApproved}
        initialOperationType={activeMethod === 'CARTAO_CREDITO' ? 'CREDITO' : 'DEBITO'}
      />
    </div>
  );
}
