import { useState, useEffect } from 'react';
import { X, Printer, Copy, Check, FileText, Loader2, AlertCircle } from 'lucide-react';
import { deliveryApi } from '../../services/api';
import type { DeliveryOrder, OrderSlipResponse } from '../../types';

export interface OrderSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: DeliveryOrder | null;
  orderId?: number | null;
  initialSlipText?: string | null;
}

export default function OrderSlipModal({
  isOpen,
  onClose,
  order,
  orderId,
  initialSlipText,
}: OrderSlipModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slipData, setSlipData] = useState<OrderSlipResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const targetOrderId = order?.id ?? orderId;

  useEffect(() => {
    if (!isOpen) {
      setSlipData(null);
      setError(null);
      setCopied(false);
      return;
    }

    if (initialSlipText && order) {
      setSlipData({
        orderId: order.id,
        orderNumber: order.orderNumber,
        order,
        textReceipt: initialSlipText,
        fullEscPos: initialSlipText,
      });
      return;
    }

    if (targetOrderId) {
      setLoading(true);
      setError(null);
      deliveryApi
        .getOrderSlip(targetOrderId)
        .then((res) => {
          setSlipData(res);
        })
        .catch((err: any) => {
          setError(err?.message || 'Erro ao carregar etiqueta do pedido.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, targetOrderId, initialSlipText, order]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!slipData?.textReceipt) return;
    try {
      await navigator.clipboard.writeText(slipData.textReceipt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      data-testid="order-slip-modal"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-white text-base">
                Etiqueta Térmica de Pacote (48 Colunas)
              </h3>
              <p className="text-xs text-slate-400">
                {slipData?.orderNumber ? `Pedido ${slipData.orderNumber}` : 'Tele-Entrega Farmacêutica'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-sm">Formatando etiqueta térmica ESC/POS...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-950/60 border border-red-700/60 rounded-lg text-red-200 flex items-center space-x-3 text-sm">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && slipData && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Layout 48 colunas ESC/POS para impressora térmica</span>
                <span className="font-mono text-amber-400">#Etiqueta Pacote</span>
              </div>
              <pre
                data-testid="order-slip-text"
                className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-emerald-400 border border-slate-800 overflow-x-auto whitespace-pre leading-relaxed select-all"
              >
                {slipData.textReceipt}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!slipData?.textReceipt}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Copiar Texto</span>
              </>
            )}
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!slipData?.textReceipt}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Etiqueta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
