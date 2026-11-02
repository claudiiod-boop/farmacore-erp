import React, { useState, useRef, useEffect } from 'react';
import {
  Barcode,
  Plus,
  Loader2,
  ShieldAlert,
  PackageX,
} from 'lucide-react';
import { api, Product, Batch } from '../../services/api';

export interface DirectItemInputProps {
  onAddDirectItem: (product: Product, batch: Batch) => void;
  disabled?: boolean;
  className?: string;
}

export default function DirectItemInput({
  onAddDirectItem,
  disabled = false,
  className = '',
}: DirectItemInputProps) {
  const [ean, setEan] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regulatoryAlert, setRegulatoryAlert] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut F2 focuses the input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEan = ean.trim();

    if (!cleanEan || disabled || isLoading) return;

    setIsLoading(true);
    setError(null);
    setRegulatoryAlert(null);

    try {
      const product = await api.getProductByEan(cleanEan);

      if (!product) {
        setError('Produto não encontrado para o código de barras informado.');
        return;
      }

      // Barreira Regulatória Sanitária (Portaria 344/98 / Antimicrobianos)
      if (product.controlType !== 'ISENTO') {
        setRegulatoryAlert(
          `Venda direta não permitida: medicamentos controlados (${product.controlType}) exigem atendimento no balcão e retenção de receita médica (Portaria 344/98 / RDC 20/2011).`
        );
        return;
      }

      // Busca lotes disponíveis e aplica regra FEFO automática
      const batches = await api.getAvailableBatches(product.id);
      const availableBatches = (batches || []).filter((b) => b.availableQuantity > 0);

      if (availableBatches.length === 0) {
        setError('Produto sem estoque disponível em lotes válidos.');
        return;
      }

      // FEFO: Ordena por menor data de validade (First Expired, First Out)
      const sortedBatches = [...availableBatches].sort((a, b) => {
        const timeA = new Date(a.expirationDate).getTime();
        const timeB = new Date(b.expirationDate).getTime();
        return timeA - timeB;
      });

      const fefoBatch = sortedBatches[0];

      // Emite evento de adição e limpa o scanner
      onAddDirectItem(product, fefoBatch);
      setEan('');
      setError(null);
      setRegulatoryAlert(null);
      inputRef.current?.focus();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('404') || msg.toLowerCase().includes('não encontrado')) {
        setError('Produto não encontrado para o código de barras informado.');
      } else {
        setError(msg || 'Falha ao buscar produto por código de barras.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            ) : (
              <Barcode className="w-5 h-5 text-slate-500" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            disabled={disabled || isLoading}
            value={ean}
            onChange={(e) => {
              setEan(e.target.value);
              setError(null);
              setRegulatoryAlert(null);
            }}
            placeholder="Bipar código de barras (EAN-13) de conveniência... [F2]"
            className="w-full pl-11 pr-20 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition shadow-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold font-mono text-slate-500 bg-slate-100 border border-slate-200 rounded">
              F2
            </kbd>
          </div>
        </div>

        <button
          type="submit"
          disabled={disabled || isLoading || !ean.trim()}
          className="ml-2.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold flex items-center space-x-1.5 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span>Bipar Item</span>
        </button>
      </form>

      {/* Alerta de Barreira Regulatória Sanitária */}
      {regulatoryAlert && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl flex items-start space-x-2.5 text-red-900 text-xs animate-shake shadow-sm">
          <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider block text-red-700">
              Barreira Sanitária Regulatória
            </span>
            <p className="mt-0.5 leading-relaxed">{regulatoryAlert}</p>
          </div>
        </div>
      )}

      {/* Mensagem de Erro Geral ou Estoque */}
      {error && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center space-x-2 text-amber-800 text-xs">
          <PackageX className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
