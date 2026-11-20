import { useState, useMemo, useEffect } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Printer,
  Copy,
  Check,
  Loader2,
  Receipt,
  User,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatBrl } from '../ProductSearch';
import type { Customer, CustomerReceivable, PaymentReceiptResult } from '../../types';

export interface DebtPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  receivables: CustomerReceivable[];
  currentCashSessionId?: number;
  onSettlementSuccess?: (result: PaymentReceiptResult) => void;
}

const PAYMENT_METHODS = [
  { id: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
  { id: 'CARTAO_CREDITO', label: 'Cartão Crédito', icon: CreditCard },
  { id: 'CARTAO_DEBITO', label: 'Cartão Débito', icon: CreditCard },
  { id: 'PIX', label: 'Pix', icon: QrCode },
];

export default function DebtPaymentModal({
  isOpen,
  onClose,
  customer,
  receivables,
  currentCashSessionId,
  onSettlementSuccess,
}: DebtPaymentModalProps) {
  // Selection of receivable IDs
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('DINHEIRO');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settlementResult, setSettlementResult] = useState<PaymentReceiptResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Initialize selected IDs with open receivables on modal open
  useEffect(() => {
    if (isOpen) {
      const openOnes = receivables
        .filter((r) => r.status === 'OPEN')
        .map((r) => r.id);
      setSelectedIds(openOnes);
      setPaymentMethod('DINHEIRO');
      setNotes('');
      setErrorMessage(null);
      setSettlementResult(null);
      setCopied(false);
    }
  }, [isOpen, receivables]);

  // Handle ESC
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

  const openReceivables = useMemo(() => {
    return receivables.filter((r) => r.status === 'OPEN');
  }, [receivables]);

  const totalSelectedAmount = useMemo(() => {
    return openReceivables
      .filter((r) => selectedIds.includes(r.id))
      .reduce((acc, r) => acc + (r.originalAmount - (r.paidAmount || 0)), 0);
  }, [openReceivables, selectedIds]);

  const toggleSelect = (id: number) => {
    if (settlementResult) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (settlementResult) return;
    setSelectedIds(openReceivables.map((r) => r.id));
  };

  const deselectAll = () => {
    if (settlementResult) return;
    setSelectedIds([]);
  };

  const handleSettle = async () => {
    if (selectedIds.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await api.credit.settleReceivables({
        receivableIds: selectedIds,
        cashSessionId: currentCashSessionId || null,
        paymentMethod,
        notes: notes || undefined,
        operatorName: 'Operador Caixa',
      });

      setSettlementResult(result);
      if (onSettlementSuccess) {
        onSettlementSuccess(result);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar quitação de parcelas');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyReceipt = async () => {
    if (!settlementResult?.receiptText) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(settlementResult.receiptText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // fallback
    }
  };

  const handlePrintReceipt = () => {
    if (!settlementResult?.receiptText) return;
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Comprovante de Quitação - ${customer.name}</title>
            <style>
              body {
                font-family: 'Courier New', Courier, monospace;
                white-space: pre;
                font-size: 11px;
                padding: 10px;
                margin: 0;
                line-height: 1.25;
              }
              @media print {
                @page { margin: 0; size: 80mm auto; }
                body { padding: 5mm; }
              }
            </style>
          </head>
          <body>${settlementResult.receiptText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settlement-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-950 border border-emerald-700 text-emerald-400 rounded-lg">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 id="settlement-modal-title" className="text-base font-bold tracking-tight">
                Recebimento & Quitação de Carnê de Crediário
              </h2>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>
                  {customer.name} • CPF: {customer.cpf}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-slate-400 hover:text-white p-1 rounded-md transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg flex items-center space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {settlementResult ? (
            /* Result Screen with Receipt */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-3 text-emerald-900">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm">Quitação Realizada com Sucesso!</h3>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Valor total quitado: <strong>{formatBrl(settlementResult.totalPaid)}</strong> • Novo limite disponível:{' '}
                    <strong>{formatBrl(settlementResult.availableLimit)}</strong>
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Recibo Térmico de Quitação
                </label>
                <div
                  data-testid="settlement-receipt-content"
                  className="bg-amber-50/40 p-4 rounded-lg border border-dashed border-slate-300 font-mono text-xs whitespace-pre select-text leading-relaxed text-slate-800"
                >
                  {settlementResult.receiptText}
                </div>
              </div>
            </div>
          ) : (
            /* Selection & Payment Screen */
            <>
              {/* Parcel selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Selecione as Parcelas em Aberto ({openReceivables.length})
                  </span>
                  <div className="space-x-2 text-xs">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      Marcar Todas
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {openReceivables.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Nenhuma parcela em aberto encontrada para este cliente.
                    </div>
                  ) : (
                    openReceivables.map((rec) => {
                      const isSelected = selectedIds.includes(rec.id);
                      const isOverdue = new Date(rec.dueDate) < new Date();
                      const pendingAmount = rec.originalAmount - (rec.paidAmount || 0);

                      return (
                        <label
                          key={rec.id}
                          className={`flex items-center justify-between p-3 cursor-pointer text-xs transition ${
                            isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(rec.id)}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <div>
                              <span className="font-bold text-slate-800 block">
                                Parcela {rec.installmentNumber}/{rec.totalInstallments}
                                {rec.saleId && ` (Venda #${rec.saleId})`}
                              </span>
                              <span
                                className={`text-[11px] font-semibold ${
                                  isOverdue ? 'text-rose-600' : 'text-slate-500'
                                }`}
                              >
                                Vencimento: {new Date(rec.dueDate).toLocaleDateString('pt-BR')}
                                {isOverdue && ' • VENCIDA'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-sm text-slate-900 block">
                              {formatBrl(pendingAmount)}
                            </span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Total Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-semibold block">Total Selecionado para Baixa:</span>
                  <span className="text-xs text-slate-400">
                    {selectedIds.length} {selectedIds.length === 1 ? 'parcela' : 'parcelas'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-600">
                    {formatBrl(totalSelectedAmount)}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Forma de Recebimento no Caixa
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PAYMENT_METHODS.map((pm) => {
                    const Icon = pm.icon;
                    const isSelected = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs ring-1 ring-blue-600'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`} />
                        <span>{pm.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Observações de Quitação (Opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Quitado pelo titular no caixa 01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-white transition cursor-pointer"
          >
            {settlementResult ? 'Concluir & Fechar' : 'Cancelar [Esc]'}
          </button>

          {settlementResult ? (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleCopyReceipt}
                className="flex items-center space-x-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Recibo</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="print-settlement-btn"
                onClick={handlePrintReceipt}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Recibo Térmico</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-testid="confirm-settlement-btn"
              onClick={handleSettle}
              disabled={selectedIds.length === 0 || isSubmitting}
              className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processando Baixa...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Quitar {formatBrl(totalSelectedAmount)}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
