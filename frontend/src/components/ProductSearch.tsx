import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, AlertCircle, ShieldCheck, Tag } from 'lucide-react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { searchProducts, Product, Stripe } from '../services/api';

export interface ProductSearchProps {
  onSelectProduct: (product: Product) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function formatBrl(amount: number): string {
  return `R$ ${amount.toFixed(2).replace('.', ',')}`;
}

export function renderStripeBadge(stripe: Stripe, controlType?: string) {
  switch (stripe) {
    case 'PRETA':
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-zinc-900 text-amber-400 border border-amber-500 shadow-sm"
          title="Medicamento de Controle Especial (Portaria 344/98 - Tarja Preta)"
        >
          Tarja Preta
          {controlType && controlType !== 'ISENTO' && (
            <span className="ml-1 text-[10px] text-amber-300 font-mono">({controlType})</span>
          )}
        </span>
      );
    case 'VERMELHA':
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-300"
          title="Medicamento Sob Prescrição Médica (Tarja Vermelha)"
        >
          Tarja Vermelha
          {controlType && controlType !== 'ISENTO' && (
            <span className="ml-1 text-[10px] text-red-700 font-mono">({controlType})</span>
          )}
        </span>
      );
    case 'SEM_TARJA':
    default:
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"
          title="Medicamento Isento de Prescrição (MIP / Livre Venda)"
        >
          Sem Tarja (Isento)
        </span>
      );
  }
}

export default function ProductSearch({
  onSelectProduct,
  placeholder = 'Buscar medicamento por Nome, EAN ou Princípio Ativo... (F2)',
  autoFocus = false,
  className = '',
}: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [searchError, setSearchError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Foco global imediato com a tecla F2
  useKeyboardShortcuts({
    F2: () => {
      inputRef.current?.focus();
      inputRef.current?.select();
      if (results.length > 0) {
        setIsOpen(true);
      }
    },
    Escape: () => {
      setIsOpen(false);
      setSelectedIndex(-1);
    },
  });

  const handleSelect = useCallback(
    (product: Product) => {
      onSelectProduct(product);
      setIsOpen(false);
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
    },
    [onSelectProduct]
  );

  // Executa a busca no backend após debounce
  const executeSearch = useCallback(async (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setSearchError(null);

    try {
      const data = await searchProducts(trimmed);
      setResults(data);
      setIsOpen(data.length > 0);
      setSelectedIndex(-1);
    } catch (err: any) {
      setSearchError(err.message || 'Erro ao consultar catálogo');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!value.trim()) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    // Debounce de 250ms
    debounceTimerRef.current = setTimeout(() => {
      executeSearch(value);
    }, 250);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        setIsOpen(true);
        setSelectedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        } else if (results.length === 1) {
          handleSelect(results[0]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;

      default:
        break;
    }
  };

  // Garante que o item navegado via teclado fique visível
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const activeItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeItem && typeof activeItem.scrollIntoView === 'function') {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        listRef.current &&
        !listRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={`relative w-full ${className}`}>
      {/* Campo de Input com Tecla de Atalho F2 */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          ) : (
            <Search className="w-5 h-5" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-11 pr-14 py-3 bg-white border-2 border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 transition shadow-sm text-base font-medium"
        />

        <div className="absolute right-3 flex items-center pointer-events-none">
          <kbd className="bg-slate-100 text-slate-600 border border-slate-300 px-2 py-0.5 rounded font-mono font-bold text-xs shadow-inner">
            F2
          </kbd>
        </div>
      </div>

      {/* Alerta de Erro de Comunicação */}
      {searchError && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-center space-x-1.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{searchError}</span>
        </div>
      )}

      {/* Dropdown com Lista de Medicamentos Encontrados */}
      {isOpen && results.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1.5 max-h-96 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl divide-y divide-slate-100 text-slate-800"
        >
          {results.map((product, index) => {
            const isSelected = index === selectedIndex;
            const isPmcCompliant = product.price <= product.pmc;

            return (
              <li
                key={product.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(product)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`p-3.5 cursor-pointer transition flex flex-col md:flex-row md:items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-emerald-50 border-l-4 border-l-emerald-600 pl-2.5'
                    : 'hover:bg-slate-50'
                }`}
              >
                {/* Detalhes do Medicamento */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="font-semibold text-slate-900 text-base truncate">
                      {product.name}
                    </span>
                    {renderStripeBadge(product.stripe, product.controlType)}
                  </div>

                  <div className="text-xs text-slate-500 mt-0.5 flex items-center space-x-3 flex-wrap">
                    <span>
                      <strong className="text-slate-600">Princípio Ativo:</strong>{' '}
                      {product.activeIngredient}
                    </span>
                    <span>
                      <strong className="text-slate-600">EAN:</strong> {product.ean}
                    </span>
                    <span>
                      <strong className="text-slate-600">Registro MS:</strong>{' '}
                      {product.msRegistration}
                    </span>
                  </div>
                </div>

                {/* Preços e Teto CMED (PMC) */}
                <div className="flex items-center space-x-3 md:text-right flex-shrink-0">
                  <div className="flex flex-col md:items-end">
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-400" />
                      Preço de Venda
                    </span>
                    <span className="text-lg font-bold text-emerald-700">
                      {formatBrl(product.price)}
                    </span>
                  </div>

                  <div className="flex flex-col md:items-end border-l pl-3 border-slate-200">
                    <span className="text-xs text-slate-500 font-medium" title="Preço Máximo ao Consumidor (CMED)">
                      PMC: {formatBrl(product.pmc)}
                    </span>
                    {isPmcCompliant ? (
                      <span className="inline-flex items-center text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium mt-0.5">
                        <ShieldCheck className="w-3 h-3 mr-0.5" />
                        Conforme CMED
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded font-medium mt-0.5">
                        <AlertCircle className="w-3 h-3 mr-0.5" />
                        Acima do Teto
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
