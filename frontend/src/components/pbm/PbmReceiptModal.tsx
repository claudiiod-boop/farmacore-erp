import { useState, useEffect, useCallback } from 'react';
import { Printer, X, FileText, AlertCircle, Copy, Check } from 'lucide-react';
import { api } from '../../services/api';
import type { PbmReceiptResult } from '../../types';

export interface PbmReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  protocol?: string;
  receiptData?: PbmReceiptResult | null;
}

export default function PbmReceiptModal({
  isOpen,
  onClose,
  protocol,
  receiptData: initialReceiptData,
}: PbmReceiptModalProps) {
  const [activeTab, setActiveTab] = useState<'CONSUMER' | 'STORE' | 'FULL'>('CONSUMER');
  const [receipt, setReceipt] = useState<PbmReceiptResult | null>(initialReceiptData || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load receipt if not passed directly but protocol is available
  useEffect(() => {
    if (!isOpen) return;

    if (initialReceiptData) {
      setReceipt(initialReceiptData);
      setError(null);
      return;
    }

    if (protocol) {
      setIsLoading(true);
      setError(null);
      api.pbm
        .getCoupon(protocol)
        .then((res) => {
          setReceipt(res);
        })
        .catch((err: any) => {
          setError(err.message || 'Erro ao carregar cupom vinculado PBM');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, protocol, initialReceiptData]);

  // Handle ESC key
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

  const currentText =
    activeTab === 'CONSUMER'
      ? receipt?.consumerCopy || ''
      : activeTab === 'STORE'
      ? receipt?.storeCopy || ''
      : receipt?.fullEscPos || `${receipt?.consumerCopy || ''}\n\n================================================\n\n${receipt?.storeCopy || ''}`;

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cupom Vinculado PBM - ${protocol || 'Farmácia Popular'}</title>
            <style>
              body {
                font-family: monospace;
                white-space: pre;
                font-size: 11px;
                padding: 10px;
                margin: 0;
              }
              @media print {
                @page { margin: 0; size: 80mm auto; }
                body { margin: 0; }
              }
            </style>
          </head>
          <body>${currentText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } else {
      window.print();
    }
  }, [currentText, protocol]);

  const handleCopy = useCallback(() => {
    if (!currentText) return;
    navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentText]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pbm-receipt-title"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 id="pbm-receipt-title" className="text-base font-bold text-white flex items-center gap-2">
                Cupom Vinculado — Farmácia Popular / PBM
                {protocol && (
                  <span className="text-xs font-mono font-normal text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    Prot: {protocol}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Auditoria Denasus (Portaria MS nº 184/2011) — Guarda obrigatória de 5 anos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            title="Fechar (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-slate-950/50 px-6 py-2 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('CONSUMER')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'CONSUMER'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              1ª Via (Consumidor)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('STORE')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'STORE'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              2ª Via (Estabelecimento — 5 Anos)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('FULL')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'FULL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Ambas as Vias (ESC/POS)
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1.5 text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Texto</span>
              </>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-900/90 flex flex-col items-center">
          {isLoading && (
            <div className="py-12 flex flex-col items-center space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Carregando cupom vinculado...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="w-full bg-red-950/60 border border-red-800/80 rounded-lg p-4 text-red-200 text-xs flex items-center space-x-3 mb-4">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && currentText && (
            <div className="w-full max-w-[480px] bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-[11px] leading-relaxed text-slate-200 overflow-x-auto shadow-inner whitespace-pre select-text">
              {currentText}
            </div>
          )}

          {!isLoading && !error && !currentText && (
            <div className="py-12 text-slate-500 text-xs">
              Nenhum dado de cupom disponível para exibição.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Formato: <span className="font-mono text-slate-400">ESC/POS 48 Colunas</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition"
            >
              Fechar (ESC)
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || !currentText}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center space-x-2 transition shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Cupom Vinculado</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
