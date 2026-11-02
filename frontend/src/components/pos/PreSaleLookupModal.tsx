import React, { useState, useEffect, useRef } from 'react';
import {
  Ticket,
  Search,
  X,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Barcode,
} from 'lucide-react';
import { api, PreSaleDetails } from '../../services/api';

export interface PreSaleLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadPreSale: (details: PreSaleDetails) => void;
}

export default function PreSaleLookupModal({
  isOpen,
  onClose,
  onLoadPreSale,
}: PreSaleLookupModalProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input and reset errors on open
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isOpen) {
      setCode('');
      setError(null);
      setWarning(null);
      setIsLoading(false);
      timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen]);

  // Handle ESC key to close
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = code.trim();

    if (!raw) {
      setError('Por favor, informe o código da pré-venda.');
      return;
    }

    // Normaliza o código: remove '#' inicial, converte para maiúsculas e adiciona prefixo se numérico
    let normalized = raw.replace(/^#/, '').trim().toUpperCase();
    if (/^\d+$/.test(normalized)) {
      normalized = `PV-${normalized.padStart(4, '0')}`;
    }

    setIsLoading(true);
    setError(null);
    setWarning(null);

    try {
      const details = await api.getPreSaleByCode(normalized);

      if (!details || !details.preSale) {
        setError('Pré-venda não encontrada para o código informado.');
        return;
      }

      if (details.preSale.status === 'CONVERTED_TO_SALE') {
        setWarning('Esta pré-venda já foi finalizada em caixa.');
        return;
      }

      if (details.preSale.status === 'CANCELLED') {
        setWarning('Esta pré-venda está cancelada e não pode ser resgatada.');
        return;
      }

      if (details.preSale.status !== 'OPEN') {
        setWarning(`Esta pré-venda não está aberta (Status: ${details.preSale.status}).`);
        return;
      }

      // Pré-venda aberta válida
      onLoadPreSale(details);
      onClose();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('404') || msg.toLowerCase().includes('não encontrada')) {
        setError('Pré-venda não encontrada para o código informado.');
      } else {
        setError(msg || 'Falha ao buscar pré-venda no servidor.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Cabeçalho */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-title" className="text-lg font-bold text-slate-800">
                Resgatar Pré-Venda
              </h2>
              <p className="text-xs text-slate-500">
                Digite ou bipe o código do ticket emitido no balcão
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label
              htmlFor="presale-code-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2"
            >
              Código da Pré-Venda / Código de Barras
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Barcode className="w-5 h-5" />
              </div>
              <input
                ref={inputRef}
                id="presale-code-input"
                type="text"
                autoFocus
                disabled={isLoading}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                  setWarning(null);
                }}
                placeholder="Digite ou bipe o código (#PV-XXXX)..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-mono font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm uppercase"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center">
              <span>Exemplos aceitos:</span>
              <code className="ml-1 px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[11px]">
                #PV-1001
              </code>
              <code className="ml-1 px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[11px]">
                PV-1001
              </code>
            </p>
          </div>

          {/* Alertas */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-800 text-sm animate-shake">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Erro ao localizar pré-venda</p>
                <p className="text-xs text-red-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {warning && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3 text-amber-800 text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Atenção</p>
                <p className="text-xs text-amber-700 mt-0.5">{warning}</p>
              </div>
            </div>
          )}

          {/* Rodapé / Ações */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancelar (Esc)
            </button>
            <button
              type="submit"
              disabled={isLoading || !code.trim()}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold flex items-center space-x-2 shadow-md shadow-blue-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Buscar Pré-Venda</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
