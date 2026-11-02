import { useEffect } from 'react';
import {
  ShoppingCart,
  Trash2,
  Package,
  Calendar,
  Lock,
} from 'lucide-react';
import { Stripe } from '../../services/api';
import { renderStripeBadge, formatBrl } from '../ProductSearch';
import { formatDate } from '../BatchSelector';

export type PosItemSource = 'PRE_SALE' | 'DIRECT';

export interface PosGridItem {
  id: string; // unique item id in grid
  source: PosItemSource;
  productId: number;
  productName: string;
  stripe: Stripe;
  controlType: string;
  batchId: number;
  batchNumber: string;
  expirationDate?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PosItemGridProps {
  items: PosGridItem[];
  selectedItemIndex?: number;
  onSelectItemIndex?: (idx: number) => void;
  onRemoveDirectItem?: (item: PosGridItem) => void;
  className?: string;
}

export default function PosItemGrid({
  items,
  selectedItemIndex,
  onSelectItemIndex,
  onRemoveDirectItem,
  className = '',
}: PosItemGridProps) {
  // Shortcut F7 to remove selected DIRECT item & Arrow keys for grid navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F7') {
        e.preventDefault();
        if (
          selectedItemIndex !== undefined &&
          items[selectedItemIndex] &&
          items[selectedItemIndex].source === 'DIRECT'
        ) {
          onRemoveDirectItem?.(items[selectedItemIndex]);
        }
      } else if (e.key === 'ArrowDown') {
        if (onSelectItemIndex && items.length > 0) {
          e.preventDefault();
          const nextIdx =
            selectedItemIndex === undefined || selectedItemIndex >= items.length - 1
              ? 0
              : selectedItemIndex + 1;
          onSelectItemIndex(nextIdx);
        }
      } else if (e.key === 'ArrowUp') {
        if (onSelectItemIndex && items.length > 0) {
          e.preventDefault();
          const prevIdx =
            selectedItemIndex === undefined || selectedItemIndex <= 0
              ? items.length - 1
              : selectedItemIndex - 1;
          onSelectItemIndex(prevIdx);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedItemIndex, onRemoveDirectItem, onSelectItemIndex]);

  if (!items || items.length === 0) {
    return (
      <div
        className={`bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm flex flex-col items-center justify-center ${className}`}
      >
        <div className="w-16 h-16 mb-4 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
          <ShoppingCart className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800">
          Nenhum item registrado no caixa
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Resgate uma pré-venda gerada no balcão com <kbd className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-300 font-mono text-xs font-bold">F1</kbd> ou bipe produtos de conveniência com <kbd className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-300 font-mono text-xs font-bold">F2</kbd>.
        </p>
      </div>
    );
  }

  const totalQuantity = items.reduce((acc, it) => acc + it.quantity, 0);
  const totalAmount = items.reduce((acc, it) => acc + it.totalPrice, 0);

  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col ${className}`}
    >
      {/* Tabela de Itens */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm divide-y divide-slate-200">
          <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
            <tr>
              <th scope="col" className="px-3 py-3 w-10 text-center">#</th>
              <th scope="col" className="px-3 py-3">Origem</th>
              <th scope="col" className="px-4 py-3">Medicamento / Item</th>
              <th scope="col" className="px-4 py-3">Lote / Validade</th>
              <th scope="col" className="px-4 py-3 text-center">Qtd</th>
              <th scope="col" className="px-4 py-3 text-right">Preço Unit.</th>
              <th scope="col" className="px-4 py-3 text-right">Subtotal</th>
              <th scope="col" className="px-3 py-3 text-center w-12">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {items.map((item, idx) => {
              const isSelected = selectedItemIndex === idx;
              const isDirect = item.source === 'DIRECT';

              return (
                <tr
                  key={item.id || `${item.productId}-${item.batchId}-${idx}`}
                  onClick={() => onSelectItemIndex?.(idx)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50/80 ring-1 ring-inset ring-blue-300'
                      : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Número de linha */}
                  <td className="px-3 py-3.5 text-center text-xs font-mono font-semibold text-slate-400">
                    {idx + 1}
                  </td>

                  {/* Origem */}
                  <td className="px-3 py-3.5 whitespace-nowrap">
                    {item.source === 'PRE_SALE' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        #PV
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Conveniência
                      </span>
                    )}
                  </td>

                  {/* Nome do Produto & Tarja */}
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col space-y-1">
                      <span className="font-semibold text-slate-900 text-sm">
                        {item.productName}
                      </span>
                      <div className="flex items-center space-x-2">
                        {renderStripeBadge(item.stripe, item.controlType)}
                      </div>
                    </div>
                  </td>

                  {/* Lote e Validade */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="flex flex-col space-y-0.5 text-xs">
                      <div className="flex items-center text-slate-700 font-mono font-bold">
                        <Package className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {item.batchNumber}
                      </div>
                      <div className="flex items-center text-slate-500">
                        <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        <span>Val: {formatDate(item.expirationDate || '')}</span>
                      </div>
                    </div>
                  </td>

                  {/* Quantidade */}
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-block px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-800 font-mono">
                      {item.quantity}
                    </span>
                  </td>

                  {/* Preço Unitário */}
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-600">
                    {formatBrl(item.unitPrice)}
                  </td>

                  {/* Subtotal */}
                  <td className="px-4 py-3.5 text-right font-mono font-bold text-sm text-slate-900">
                    {formatBrl(item.totalPrice)}
                  </td>

                  {/* Ação (Remover item direto) */}
                  <td className="px-3 py-3.5 text-center">
                    {isDirect ? (
                      <button
                        type="button"
                        aria-label={`Remover item de conveniência ${item.productName}`}
                        title="Remover item de conveniência (F7)"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveDirectItem?.(item);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        aria-label="Itens de pré-venda não podem ser removidos individualmente"
                        title="Itens da pré-venda não podem ser alterados no caixa"
                        className="p-1.5 text-slate-300 cursor-not-allowed opacity-40 rounded-lg"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Rodapé Consolidado */}
      <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-3 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">
            {totalQuantity} {totalQuantity === 1 ? 'item' : 'itens'}
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center">
            <kbd className="px-1 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px] font-mono mr-1">
              F7
            </kbd>
            Remover item avulso
          </span>
        </div>

        <div className="flex items-baseline space-x-2">
          <span className="text-xs uppercase font-semibold text-slate-500">
            Total:
          </span>
          <span className="text-lg font-black text-slate-900 font-mono">
            {formatBrl(totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}
