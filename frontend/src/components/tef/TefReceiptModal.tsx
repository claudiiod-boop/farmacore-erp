import React, { useState, useEffect, useCallback } from 'react';
import { Printer, X, FileText, AlertCircle, Copy, Check, CreditCard } from 'lucide-react';
import { api } from '../../services/api';
import type { TefReceiptResult } from '../../types/tef';

export interface TefReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  nsu?: string;
  receiptData?: TefReceiptResult | null;
}

export default function TefReceiptModal({
  isOpen,
  onClose,
  nsu,
  receiptData: initialReceiptData,
}: TefReceiptModalProps) {
  const [activeTab, setActiveTab] = useState<'CUSTOMER' | 'MERCHANT' | 'FULL'>('CUSTOMER');
  const [receipt, setReceipt] = useState<TefReceiptResult | null>(initialReceiptData || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load receipt if not passed directly but NSU is available
  useEffect(() => {
    if (!isOpen) return;

    if (initialReceiptData) {
      setReceipt(initialReceiptData);
      setError(null);
      return;
    }

    if (nsu) {
      setIsLoading(true);
      setError(null);
      api.tef
        .getReceipt(nsu)
        .then((res) => {
          setReceipt(res);
        })
        .catch((err: any) => {
          setError(err.message || 'Erro ao carregar comprovante TEF');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, nsu, initialReceiptData]);

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
    activeTab === 'CUSTOMER'
      ? receipt?.customerReceipt || ''
      : activeTab === 'MERCHANT'
      ? receipt?.merchantReceipt || ''
      : receipt?.fullEscPos ||
        `${receipt?.customerReceipt || ''}\n\n================================================\n\n${receipt?.merchantReceipt || ''}`;

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Comprovante TEF - ${nsu ? `NSU ${nsu}` : 'Cartão'}</title>
            <style>
              body {
                font-family: monospace, Courier, sans-serif;
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
    }
  }, [currentText, nsu]);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(currentText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tef-receipt-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="tef-receipt-modal-title"
                className="text-base font-bold tracking-tight flex items-center gap-2"
              >
                Comprovante de Pagamento TEF (PinPad)
                {nsu && (
                  <span className="text-xs font-mono font-semibold text-blue-300 bg-blue-950 px-2 py-0.5 rounded border border-blue-700">
                    NSU: {nsu}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Formatação em 48 colunas monoespaçadas (Padrão Térmico ESC/POS)
              </p>
            </div>
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

        {/* Abas de Vias do TEF */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 pt-3 flex space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('CUSTOMER')}
            className={`py-2 px-4 font-bold text-xs rounded-t-lg transition border-t border-l border-r ${
              activeTab === 'CUSTOMER'
                ? 'bg-white border-slate-200 text-blue-700 shadow-xs'
                : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            1ª Via — Cliente
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MERCHANT')}
            className={`py-2 px-4 font-bold text-xs rounded-t-lg transition border-t border-l border-r ${
              activeTab === 'MERCHANT'
                ? 'bg-white border-slate-200 text-blue-700 shadow-xs'
                : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            2ª Via — Estabelecimento (Loja)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('FULL')}
            className={`py-2 px-4 font-bold text-xs rounded-t-lg transition border-t border-l border-r ${
              activeTab === 'FULL'
                ? 'bg-white border-slate-200 text-blue-700 shadow-xs'
                : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Ambas as Vias (ESC/POS)
          </button>
        </div>

        {/* Conteúdo do Comprovante */}
        <div className="p-6 flex-1 overflow-y-auto bg-slate-50 flex flex-col items-center">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-semibold">Carregando comprovante TEF...</p>
            </div>
          )}

          {error && (
            <div className="w-full p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && currentText && (
            <div className="w-full max-w-md bg-white border border-slate-300 rounded-md p-4 shadow-sm">
              <pre
                data-testid="tef-receipt-text"
                className="font-mono text-xs text-slate-800 leading-relaxed whitespace-pre overflow-x-auto selection:bg-blue-100"
              >
                {currentText}
              </pre>
            </div>
          )}

          {!isLoading && !error && !currentText && (
            <div className="py-12 text-center text-slate-400 text-xs font-medium">
              Nenhum texto de comprovante disponível para este NSU.
            </div>
          )}
        </div>

        {/* Footer com Ações */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition"
          >
            Fechar (Esc)
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!currentText}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition flex items-center space-x-1.5 shadow-sm"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Texto</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="print-tef-receipt-button"
              onClick={handlePrint}
              disabled={!currentText}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition flex items-center space-x-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Comprovante</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
