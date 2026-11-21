import React, { useState, useEffect } from 'react';
import {
  X,
  Truck,
  Bike,
  CheckCircle,
  AlertCircle,
  Loader2,
  Printer,
} from 'lucide-react';
import { deliveryApi } from '../../services/api';
import type {
  DeliveryOrder,
  Courier,
  DeliveryDispatchWithOrders,
} from '../../types';

export interface DispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  readyOrders: DeliveryOrder[];
  couriers: Courier[];
  onDispatched: (dispatch: DeliveryDispatchWithOrders) => void;
  storeId?: number;
}

export default function DispatchModal({
  isOpen,
  onClose,
  readyOrders,
  couriers,
  onDispatched,
  storeId = 1,
}: DispatchModalProps) {
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result state after dispatch (to view slip)
  const [dispatchedResult, setDispatchedResult] =
    useState<DeliveryDispatchWithOrders | null>(null);
  const [slipText, setSlipText] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // By default select all ready orders passed
      setSelectedOrderIds(readyOrders.map((o) => o.id));
      // Pick first available courier if any
      const availableCourier = couriers.find((c) => c.status === 'AVAILABLE' && c.isActive);
      setSelectedCourierId(availableCourier ? availableCourier.id : (couriers[0]?.id ?? ''));
      setNotes('');
      setErrorMessage(null);
      setDispatchedResult(null);
      setSlipText(null);
    }
  }, [isOpen, readyOrders, couriers]);

  if (!isOpen) return null;

  const ordersToDispatch = readyOrders.filter((o) =>
    selectedOrderIds.includes(o.id)
  );

  const totalAmount = ordersToDispatch.reduce(
    (sum, o) => sum + (o.totalAmount ?? o.total_amount ?? 0),
    0
  );

  // Calculate total change to provide to courier
  const totalChangeProvided = ordersToDispatch.reduce((sum, o) => {
    const isCash = (o.paymentMethod ?? o.payment_method) === 'DINHEIRO';
    const changeFor = o.changeFor ?? o.change_for;
    const orderTotal = o.totalAmount ?? o.total_amount ?? 0;
    if (isCash && changeFor && changeFor > orderTotal) {
      return sum + (changeFor - orderTotal);
    }
    return sum;
  }, 0);

  const handleToggleOrder = (orderId: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSelectAll = () => {
    if (selectedOrderIds.length === readyOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(readyOrders.map((o) => o.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourierId) {
      setErrorMessage('Selecione um entregador para o despacho.');
      return;
    }
    if (selectedOrderIds.length === 0) {
      setErrorMessage('Selecione ao menos 1 pedido para despachar no romaneio.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const created = await deliveryApi.createDispatch({
        storeId,
        courierId: Number(selectedCourierId),
        orderIds: selectedOrderIds,
        notes: notes.trim() || null,
      });

      setDispatchedResult(created);
      onDispatched(created);

      // Attempt to load dispatch thermal slip automatically
      try {
        const slipRes = await deliveryApi.getDispatchSlip(created.id);
        setSlipText(slipRes.textReceipt);
      } catch {
        // Fallback
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao gerar romaneio de despacho.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      data-testid="dispatch-modal"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-white text-base">
                Roteirização e Romaneio de Despacho
              </h3>
              <p className="text-xs text-slate-400">
                Agrupamento de pedidos prontos para saída de motoboy
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

        {/* If already dispatched, show success + slip viewer */}
        {dispatchedResult ? (
          <div className="p-5 flex flex-col flex-1 overflow-y-auto space-y-4">
            <div className="p-4 bg-emerald-950/60 border border-emerald-700/60 rounded-xl text-emerald-200 flex items-center space-x-3">
              <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold text-sm">
                  Romaneio {dispatchedResult.dispatchNumber} gerado com sucesso!
                </p>
                <p className="text-xs text-emerald-300">
                  {dispatchedResult.totalOrders} pedidos despachados para o motoboy.
                </p>
              </div>
            </div>

            {slipText && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Comprovante de Saída de Rota (Romaneio Térmico):</span>
                  <span className="font-mono text-amber-400">48 colunas ESC/POS</span>
                </div>
                <pre
                  data-testid="dispatch-slip-text"
                  className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-emerald-400 border border-slate-800 overflow-x-auto whitespace-pre leading-relaxed select-all"
                >
                  {slipText}
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
                <span>Imprimir Romaneio</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          /* Dispatch Form */
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
            <div className="p-5 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-950/60 border border-red-700/60 rounded-lg text-red-200 flex items-center space-x-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Courier Selection */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                  <Bike className="w-4 h-4 text-amber-400" />
                  <span>Selecione o Entregador / Motoboy *</span>
                </label>
                <select
                  data-testid="dispatch-courier-select"
                  required
                  value={selectedCourierId}
                  onChange={(e) =>
                    setSelectedCourierId(e.target.value ? Number(e.target.value) : '')
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 cursor-pointer"
                >
                  <option value="">-- Escolha o entregador disponível --</option>
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.vehicleType || 'MOTO'}) - Status:{' '}
                      {c.status === 'AVAILABLE'
                        ? 'Disponível'
                        : c.status === 'ON_DELIVERY'
                        ? 'Em Rota'
                        : 'Inativo'}{' '}
                      | Comissão: R$ {(c.commissionPerDelivery ?? 5).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Orders Selection List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">
                    Pedidos Prontos para Despacho ({readyOrders.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                  >
                    {selectedOrderIds.length === readyOrders.length
                      ? 'Desmarcar Todos'
                      : 'Selecionar Todos'}
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-lg divide-y divide-slate-800 bg-slate-950/40">
                  {readyOrders.map((ord) => {
                    const isSelected = selectedOrderIds.includes(ord.id);
                    const total = ord.totalAmount ?? ord.total_amount ?? 0;
                    const change =
                      (ord.paymentMethod ?? ord.payment_method) === 'DINHEIRO' &&
                      (ord.changeFor ?? ord.change_for) &&
                      (ord.changeFor ?? ord.change_for)! > total
                        ? (ord.changeFor ?? ord.change_for)! - total
                        : 0;

                    return (
                      <div
                        key={ord.id}
                        onClick={() => handleToggleOrder(ord.id)}
                        className={`p-3 flex items-center justify-between text-xs cursor-pointer transition ${
                          isSelected ? 'bg-amber-950/20 text-white' : 'hover:bg-slate-800/40 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent div
                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500"
                          />
                          <div>
                            <div className="font-bold text-white flex items-center space-x-2">
                              <span>#{ord.orderNumber ?? ord.order_number}</span>
                              <span className="text-slate-400 font-normal">
                                {ord.customerName ?? ord.customer_name}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {ord.neighborhood} - {ord.street}, {ord.number}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-amber-400">
                            R$ {total.toFixed(2)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {ord.paymentMethod ?? ord.payment_method}
                            {change > 0 && (
                              <span className="text-amber-300 ml-1">
                                (Troco: R$ {change.toFixed(2)})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {readyOrders.length === 0 && (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      Nenhum pedido com status 'Pronto p/ Despacho' no momento.
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                <div>
                  <div className="text-[11px] text-slate-400">Qtd Pedidos</div>
                  <div className="text-base font-bold text-white">
                    {selectedOrderIds.length}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Total a Cobrar</div>
                  <div className="text-base font-bold text-amber-400">
                    R$ {totalAmount.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Troco a Fornecer</div>
                  <div className="text-base font-bold text-emerald-400">
                    R$ {totalChangeProvided.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Observações do Despacho (Opcional)
                </label>
                <input
                  type="text"
                  data-testid="dispatch-notes-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Levar máquina de cartão extra e troco trocado..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                />
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
                disabled={loading || selectedOrderIds.length === 0 || !selectedCourierId}
                data-testid="confirm-dispatch-button"
                className="flex items-center space-x-1.5 px-5 py-2.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Despachando...</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    <span>Despachar e Imprimir Romaneio</span>
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
