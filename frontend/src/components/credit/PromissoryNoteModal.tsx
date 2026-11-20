import { useState, useEffect, useCallback } from 'react';
import { Printer, X, FileText, AlertCircle, Copy, Check, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { PromissoryNoteResponse } from '../../types';

export interface PromissoryNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleId?: number;
  promissoryData?: PromissoryNoteResponse | null;
}

export default function PromissoryNoteModal({
  isOpen,
  onClose,
  saleId,
  promissoryData: initialData,
}: PromissoryNoteModalProps) {
  const [data, setData] = useState<PromissoryNoteResponse | null>(initialData || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setData(initialData);
      setError(null);
      return;
    }

    if (saleId) {
      setIsLoading(true);
      setError(null);
      api.credit
        .getPromissoryNote(saleId)
        .then((res) => {
          setData(res);
        })
        .catch((err: any) => {
          setError(err.message || `Erro ao carregar nota promissória da venda #${saleId}`);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, saleId, initialData]);

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

  const rawText = data?.textReceipt || data?.promissoryNote || '';

  const handleCopy = useCallback(async () => {
    if (!rawText) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(rawText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // fallback
    }
  }, [rawText]);

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Nota Promissória / Carnê - Venda #${saleId || data?.saleId || ''}</title>
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
          <body>${rawText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  }, [rawText, saleId, data?.saleId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promissory-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-950 border border-indigo-700 text-indigo-400 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 id="promissory-modal-title" className="text-base font-bold tracking-tight">
                Nota Promissória & Termo de Confissão de Dívida
              </h2>
              <p className="text-xs text-slate-400">
                {saleId || data?.saleId ? `Venda #${saleId || data?.saleId}` : 'Documento Financeiro'} • Via Térmica de Crediário
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="text-slate-400 hover:text-white p-1 rounded-md transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 overflow-y-auto bg-slate-100 flex flex-col items-center">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <span className="text-sm font-semibold">Carregando nota promissória térmica...</span>
            </div>
          )}

          {error && (
            <div className="w-full bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg flex items-center space-x-3 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && data && (
            <div className="w-full max-w-lg bg-white p-5 rounded-lg border border-slate-300 shadow-md">
              {/* Thermal Paper Simulation */}
              <div
                data-testid="promissory-receipt-content"
                className="font-mono text-xs text-slate-800 whitespace-pre leading-relaxed select-text bg-amber-50/40 p-4 rounded border border-dashed border-slate-300"
              >
                {rawText}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
          >
            Fechar [Esc]
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={isLoading || !data}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Copiado!</span>
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
              data-testid="print-promissory-btn"
              onClick={handlePrint}
              disabled={isLoading || !data}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Promissória (80mm)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
