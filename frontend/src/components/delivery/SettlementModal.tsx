import React, { useState, useEffect } from 'react';
import {
  X,
  Receipt,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  DollarSign,
  Printer,
  Calculator,
  UserCheck,
} from 'lucide-react';
import { deliveryApi, api } from '../../services/api';
import type {
  DeliveryDispatchWithOrders,
  SettlementResult,
  SettleOrderItemParam,
} from '../../types';

export interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatch: DeliveryDispatchWithOrders | null;
  onSettled: (result: SettlementResult) => void;
}

interface OrderConferenceItem {
  orderId: number;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  paymentMethod: string;
  delivered: boolean;
  returnedReason: string;
}

export default function SettlementModal({
  isOpen,
  onClose,
  dispatch,
  onSettled,
}: SettlementModalProps) {
  const [conferenceOrders, setConferenceOrders] = useState<OrderConferenceItem[]>([]);
  const [collectedCash, setCollectedCash] = useState<number>(0);
  const [collectedCard, setCollectedCard] = useState<number>(0);
  const [collectedPix, setCollectedPix] = useState<number>(0);
  const [cashSessionId, setCashSessionId] = useState<number | null>(null);
  const [operatorName, setOperatorName] = useState('Operador Caixa');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null);

  // Initialize conference items when modal opens
  useEffect(() => {
    if (!isOpen || !dispatch) {
      setConferenceOrders([]);
      setSettlementResult(null);
      setErrorMessage(null);
      return;
    }

    const items: OrderConferenceItem[] = (dispatch.orders || []).map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber ?? o.order_number ?? String(o.id),
      customerName: o.customerName ?? o.customer_name ?? 'Cliente',
      totalAmount: o.totalAmount ?? o.total_amount ?? 0,
      paymentMethod: o.paymentMethod ?? o.payment_method ?? 'DINHEIRO',
      delivered: true,
      returnedReason: '',
    }));

    setConferenceOrders(items);

    // Initial sum for cash, card, pix assuming all delivered
    let expCash = 0;
    let expCard = 0;
    let expPix = 0;

    items.forEach((it) => {
      if (it.paymentMethod === 'DINHEIRO') expCash += it.totalAmount;
      else if (it.paymentMethod === 'CARTAO_CREDITO' || it.paymentMethod === 'CARTAO_DEBITO')
        expCard += it.totalAmount;
      else if (it.paymentMethod === 'PIX') expPix += it.totalAmount;
    });

    setCollectedCash(expCash);
    setCollectedCard(expCard);
    setCollectedPix(expPix);
    setNotes('');

    // Fetch current cash session if available
    api
      .getCurrentSession()
      .then((session) => {
        if (session && session.id) {
          setCashSessionId(session.id);
          if (session.operatorName) {
            setOperatorName(session.operatorName);
          }
        }
      })
      .catch(() => {
        // Fallback session 1
        setCashSessionId(1);
      });
  }, [isOpen, dispatch]);

  if (!isOpen || !dispatch) return null;

  // Recalculate expected totals based on delivered flag
  const deliveredItems = conferenceOrders.filter((it) => it.delivered);
  const returnedItems = conferenceOrders.filter((it) => !it.delivered);

  const expectedCash = deliveredItems
    .filter((it) => it.paymentMethod === 'DINHEIRO')
    .reduce((sum, it) => sum + it.totalAmount, 0);

  const expectedCard = deliveredItems
    .filter(
      (it) => it.paymentMethod === 'CARTAO_CREDITO' || it.paymentMethod === 'CARTAO_DEBITO'
    )
    .reduce((sum, it) => sum + it.totalAmount, 0);

  const expectedPix = deliveredItems
    .filter((it) => it.paymentMethod === 'PIX')
    .reduce((sum, it) => sum + it.totalAmount, 0);

  const commissionPerDelivery =
    dispatch.courier?.commissionPerDelivery ??
    dispatch.courier?.commission_per_delivery ??
    5.0;
  const estimatedCommission = deliveredItems.length * commissionPerDelivery;

  const handleToggleDelivered = (index: number) => {
    setConferenceOrders((prev) => {
      const updated = [...prev];
      const current = updated[index];
      const newDelivered = !current.delivered;
      updated[index] = {
        ...current,
        delivered: newDelivered,
        returnedReason: newDelivered ? '' : 'Cliente ausente',
      };
      return updated;
    });
  };

  const handleReasonChange = (index: number, reason: string) => {
    setConferenceOrders((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], returnedReason: reason };
      return updated;
    });
  };

  const handleApplyExpectedValues = () => {
    setCollectedCash(expectedCash);
    setCollectedCard(expectedCard);
    setCollectedPix(expectedPix);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that returned orders have reasons
    for (const item of returnedItems) {
      if (!item.returnedReason.trim()) {
        setErrorMessage(
          `Informe o motivo de devolução para o pedido #${item.orderNumber}.`
        );
        return;
      }
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const ordersPayload: SettleOrderItemParam[] = conferenceOrders.map((o) => ({
        orderId: o.orderId,
        delivered: o.delivered,
        returnedReason: o.delivered ? undefined : o.returnedReason.trim(),
      }));

      const res = await deliveryApi.settleDispatch(dispatch.id, {
        orders: ordersPayload,
        collectedCash: Number(collectedCash) || 0,
        collectedCard: Number(collectedCard) || 0,
        collectedPix: Number(collectedPix) || 0,
        cashSessionId: cashSessionId ?? 1,
        operatorName: operatorName.trim() || 'Operador Caixa',
        notes: notes.trim() || undefined,
      });

      setSettlementResult(res);
      onSettled(res);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao realizar acerto de contas do romaneio.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      data-testid="settlement-modal"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-white text-base">
                Acerto de Contas no Caixa PDV — Romaneio {dispatch.dispatchNumber}
              </h3>
              <p className="text-xs text-slate-400">
                Entregador: {dispatch.courier?.name || `ID #${dispatch.courierId}`} | Saída:{' '}
                {new Date(dispatch.dispatchedAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* If already settled, show receipt */}
        {settlementResult ? (
          <div className="p-5 flex flex-col flex-1 overflow-y-auto space-y-4">
            <div className="p-4 bg-emerald-950/60 border border-emerald-700/60 rounded-xl text-emerald-200 flex items-center space-x-3">
              <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold text-sm">
                  Acerto liquidado com sucesso no Caixa!
                </p>
                <p className="text-xs text-emerald-300">
                  {settlementResult.totalDelivered} entregues |{' '}
                  {settlementResult.totalReturned} devolvidos | Comissão:{' '}
                  R$ {(settlementResult.commissionEarned ?? 0).toFixed(2)}
                </p>
              </div>
            </div>

            {settlementResult.receiptText && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Recibo Térmico de Acerto de Contas:</span>
                  <span className="font-mono text-amber-400">48 colunas ESC/POS</span>
                </div>
                <pre
                  data-testid="settlement-receipt-text"
                  className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-emerald-400 border border-slate-800 overflow-x-auto whitespace-pre leading-relaxed select-all"
                >
                  {settlementResult.receiptText}
                </pre>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Recibo</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          /* Settlement Form */
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
            <div className="p-5 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-950/60 border border-red-700/60 rounded-lg text-red-200 flex items-center space-x-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. Conference List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200 uppercase tracking-wider">
                    1. Conferência de Entregas e Devoluções ({conferenceOrders.length})
                  </span>
                  <span className="text-slate-400">
                    <strong className="text-emerald-400">{deliveredItems.length}</strong> entregues |{' '}
                    <strong className="text-red-400">{returnedItems.length}</strong> devoluções
                  </span>
                </div>

                <div className="max-h-52 overflow-y-auto border border-slate-800 rounded-lg divide-y divide-slate-800 bg-slate-950/40">
                  {conferenceOrders.map((ord, idx) => (
                    <div key={ord.orderId} className="p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <button
                            type="button"
                            onClick={() => handleToggleDelivered(idx)}
                            data-testid={`toggle-delivered-${ord.orderId}`}
                            className={`flex items-center space-x-1 px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                              ord.delivered
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                : 'bg-red-950 text-red-300 border border-red-700'
                            }`}
                          >
                            {ord.delivered ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Entregue</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5 text-red-400" />
                                <span>Devolvido</span>
                              </>
                            )}
                          </button>

                          <div>
                            <span className="font-bold text-white">#{ord.orderNumber}</span>
                            <span className="text-slate-400 ml-2">{ord.customerName}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-bold text-amber-400">
                            R$ {ord.totalAmount.toFixed(2)}
                          </span>
                          <span className="text-slate-400 text-[11px] ml-2">
                            ({ord.paymentMethod})
                          </span>
                        </div>
                      </div>

                      {/* Return Reason input when not delivered */}
                      {!ord.delivered && (
                        <div className="pt-1 flex items-center space-x-2">
                          <label className="text-[11px] text-red-300 whitespace-nowrap">
                            Motivo Devolução *:
                          </label>
                          <input
                            type="text"
                            required
                            data-testid={`return-reason-${ord.orderId}`}
                            value={ord.returnedReason}
                            onChange={(e) => handleReasonChange(idx, e.target.value)}
                            placeholder="Ex: Cliente ausente / Endereço não localizado"
                            className="flex-1 bg-slate-800 border border-red-700/60 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-red-500"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Financial Reconciliation */}
              <div className="space-y-3 bg-slate-950/60 p-4 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                    <DollarSign className="w-4 h-4" />
                    <span>2. Apuração Financeira de Valores Recebidos</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyExpectedValues}
                    className="text-xs text-amber-400 hover:text-amber-300 underline cursor-pointer"
                  >
                    Copiar Valores Esperados
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Dinheiro */}
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Dinheiro Esperado:</span>
                      <strong className="text-white">R$ {expectedCash.toFixed(2)}</strong>
                    </div>
                    <label className="text-[11px] font-semibold text-slate-300 block">
                      Dinheiro Entregue (R$)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      data-testid="settle-cash-input"
                      value={collectedCash}
                      onChange={(e) => setCollectedCash(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-white font-bold focus:outline-hidden focus:border-amber-500"
                    />
                    {collectedCash !== expectedCash && (
                      <div className="text-[10px] text-amber-400">
                        Dif: R$ {(collectedCash - expectedCash).toFixed(2)}
                      </div>
                    )}
                  </div>

                  {/* Cartão */}
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Cartão Esperado:</span>
                      <strong className="text-white">R$ {expectedCard.toFixed(2)}</strong>
                    </div>
                    <label className="text-[11px] font-semibold text-slate-300 block">
                      Cartão Apurado (R$)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      data-testid="settle-card-input"
                      value={collectedCard}
                      onChange={(e) => setCollectedCard(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-white font-bold focus:outline-hidden focus:border-amber-500"
                    />
                    {collectedCard !== expectedCard && (
                      <div className="text-[10px] text-amber-400">
                        Dif: R$ {(collectedCard - expectedCard).toFixed(2)}
                      </div>
                    )}
                  </div>

                  {/* Pix */}
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>PIX Esperado:</span>
                      <strong className="text-white">R$ {expectedPix.toFixed(2)}</strong>
                    </div>
                    <label className="text-[11px] font-semibold text-slate-300 block">
                      PIX Confirmado (R$)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      data-testid="settle-pix-input"
                      value={collectedPix}
                      onChange={(e) => setCollectedPix(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-white font-bold focus:outline-hidden focus:border-amber-500"
                    />
                    {collectedPix !== expectedPix && (
                      <div className="text-[10px] text-amber-400">
                        Dif: R$ {(collectedPix - expectedPix).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Courier Commission & Session */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/60 p-4 rounded-lg border border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300">
                    <Calculator className="w-4 h-4 text-amber-400" />
                    <span>Comissão do Entregador</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {deliveredItems.length} entregas x R$ {commissionPerDelivery.toFixed(2)} =
                  </div>
                  <div
                    data-testid="courier-commission-display"
                    className="text-lg font-bold text-emerald-400"
                  >
                    R$ {estimatedCommission.toFixed(2)}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300">
                    <UserCheck className="w-4 h-4 text-amber-400" />
                    <span>Operador de Caixa</span>
                  </div>
                  <input
                    type="text"
                    data-testid="settle-operator-input"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                data-testid="confirm-settlement-button"
                className="flex items-center space-x-1.5 px-5 py-2.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Liquidando Acerto...</span>
                  </>
                ) : (
                  <>
                    <Receipt className="w-4 h-4" />
                    <span>Liquidar Acerto no Caixa</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
