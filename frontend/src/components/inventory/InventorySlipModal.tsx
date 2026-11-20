import { useState } from 'react';
import {
  X,
  Printer,
  Copy,
  Check,
  FileText,
  Loader2,
} from 'lucide-react';
import type { InventoryReportResult } from '../../types';

export interface InventorySlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: InventoryReportResult | null;
  loading?: boolean;
}

export default function InventorySlipModal({
  isOpen,
  onClose,
  report,
  loading = false,
}: InventorySlipModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!report?.textSlip) return;
    try {
      await navigator.clipboard.writeText(report.textSlip);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      data-testid="inventory-slip-modal"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-950/80 border border-emerald-700 rounded-lg text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Termo de Encerramento e Conciliação de Balanço
              </h2>
              <p className="text-xs text-slate-400">
                Extrato oficial 80 colunas para arquivamento e fiscalização Anvisa/SNGPC
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-slip-modal-button"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-sm">Carregando parecer regulatório e extrato...</p>
            </div>
          ) : report ? (
            <>
              {/* Quick Info bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-slate-500 block">Sessão:</span>
                  <span className="font-mono font-bold text-white">
                    {report.session.sessionCode}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Filial:</span>
                  <span className="font-semibold text-slate-200">
                    {report.store.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tipo:</span>
                  <span className="font-semibold text-emerald-400">
                    {report.session.inventoryType}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Acurácia:</span>
                  <span className="font-bold text-emerald-400">
                    {report.session.accuracyRate.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Monospaced slip */}
              <div className="relative">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg font-mono text-xs text-emerald-400 leading-relaxed overflow-x-auto whitespace-pre shadow-inner max-h-[50vh]">
                  {report.textSlip}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">
              Nenhum dado do termo disponível.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950">
          <div className="text-xs text-slate-400">
            Formato padrão ESC/POS e 80 colunas
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!report?.textSlip || loading}
              data-testid="copy-slip-button"
              className="flex items-center space-x-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-semibold transition border border-slate-700 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-300" />
                  <span>Copiar Termo</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={!report?.textSlip || loading}
              data-testid="print-slip-button"
              className="flex items-center space-x-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              data-testid="close-slip-modal-btn"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition border border-slate-700 cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
