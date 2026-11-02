import { ShoppingCart, Trash2, Plus, Minus, Package, Calendar } from 'lucide-react';
import { Product, Batch } from '../services/api';
import { renderStripeBadge, formatBrl } from './ProductSearch';
import { formatDate } from './BatchSelector';

export interface CartItem {
  product: Product;
  batch: Batch;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CartTableProps {
  items: CartItem[];
  onUpdateQuantity: (productId: number, batchId: number, newQty: number) => void;
  onRemoveItem: (productId: number, batchId: number) => void;
  className?: string;
}

export default function CartTable({
  items,
  onUpdateQuantity,
  onRemoveItem,
  className = '',
}: CartTableProps) {
  if (!items || items.length === 0) {
    return (
      <div
        className={`bg-white border-2 border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-sm ${className}`}
      >
        <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
          <ShoppingCart className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-800">Carrinho Vazio</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          Nenhum item no carrinho. Pressione <kbd className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-300 font-mono text-xs font-bold">F2</kbd> para buscar e adicionar medicamentos ao balcão.
        </p>
      </div>
    );
  }

  const totalItemsCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalAmount = items.reduce((acc, item) => acc + item.totalPrice, 0);

  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col ${className}`}>
      {/* Cabeçalho da Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm divide-y divide-slate-200">
          <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
            <tr>
              <th scope="col" className="px-4 py-3.5">Medicamento</th>
              <th scope="col" className="px-4 py-3.5">Lote / Validade</th>
              <th scope="col" className="px-4 py-3.5 text-center">Quantidade</th>
              <th scope="col" className="px-4 py-3.5 text-right">Preço Unit.</th>
              <th scope="col" className="px-4 py-3.5 text-right">Subtotal</th>
              <th scope="col" className="px-3 py-3.5 text-center w-12">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {items.map((item) => {
              const maxAvailable = item.batch.availableQuantity;
              const isMaxReached = item.quantity >= maxAvailable;
              const isMinReached = item.quantity <= 1;

              return (
                <tr
                  key={`${item.product.id}-${item.batch.id}`}
                  className="hover:bg-slate-50/70 transition"
                >
                  {/* Nome e Tarja */}
                  <td className="px-4 py-4">
                    <div className="flex flex-col space-y-1">
                      <span className="font-semibold text-slate-900 text-base">
                        {item.product.name}
                      </span>
                      <div className="flex items-center space-x-2">
                        {renderStripeBadge(item.product.stripe, item.product.controlType)}
                        <span className="text-xs text-slate-400 font-mono">
                          EAN: {item.product.ean}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Lote e Validade */}
                  <td className="px-4 py-4">
                    <div className="flex flex-col space-y-0.5 text-xs">
                      <div className="flex items-center text-slate-700 font-mono font-bold">
                        <Package className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {item.batch.batchNumber}
                      </div>
                      <div className="flex items-center text-slate-500">
                        <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        <span>Val: {formatDate(item.batch.expirationDate)}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Estoque do Lote: {maxAvailable} un
                      </span>
                    </div>
                  </td>

                  {/* Controle de Quantidade (+ / - / input) */}
                  <td className="px-4 py-4">
                    <div className="flex flex-col items-center">
                      <div className="inline-flex items-center border border-slate-300 rounded-lg bg-white shadow-sm overflow-hidden">
                        <button
                          type="button"
                          data-testid={`qty-dec-${item.product.id}-${item.batch.id}`}
                          disabled={isMinReached}
                          onClick={() => {
                            if (!isMinReached) {
                              onUpdateQuantity(item.product.id, item.batch.id, item.quantity - 1);
                            }
                          }}
                          className={`p-1.5 transition ${
                            isMinReached
                              ? 'text-slate-300 bg-slate-50 cursor-not-allowed'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                          aria-label="Diminuir quantidade"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <input
                          type="number"
                          data-testid={`qty-input-${item.product.id}-${item.batch.id}`}
                          min={1}
                          max={maxAvailable}
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (isNaN(val) || val < 1) {
                              onUpdateQuantity(item.product.id, item.batch.id, 1);
                            } else if (val > maxAvailable) {
                              onUpdateQuantity(item.product.id, item.batch.id, maxAvailable);
                            } else {
                              onUpdateQuantity(item.product.id, item.batch.id, val);
                            }
                          }}
                          className="w-12 text-center text-sm font-bold text-slate-800 border-x border-slate-200 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />

                        <button
                          type="button"
                          data-testid={`qty-inc-${item.product.id}-${item.batch.id}`}
                          disabled={isMaxReached}
                          onClick={() => {
                            if (!isMaxReached) {
                              onUpdateQuantity(item.product.id, item.batch.id, item.quantity + 1);
                            }
                          }}
                          className={`p-1.5 transition ${
                            isMaxReached
                              ? 'text-slate-300 bg-slate-50 cursor-not-allowed'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                          aria-label="Aumentar quantidade"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {isMaxReached && (
                        <span className="text-[10px] text-amber-600 font-semibold mt-1">
                          Limite do estoque
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Preço Unitário */}
                  <td className="px-4 py-4 text-right">
                    <span className="text-slate-600 font-medium">
                      {formatBrl(item.unitPrice)}
                    </span>
                  </td>

                  {/* Subtotal */}
                  <td className="px-4 py-4 text-right">
                    <span className="text-slate-900 font-bold text-base">
                      {formatBrl(item.totalPrice)}
                    </span>
                  </td>

                  {/* Ação de Remover */}
                  <td className="px-3 py-4 text-center">
                    <button
                      type="button"
                      data-testid={`remove-item-${item.product.id}-${item.batch.id}`}
                      onClick={() => onRemoveItem(item.product.id, item.batch.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                      title="Remover item da pré-venda"
                      aria-label="Remover item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Rodapé com Totalizadores Gerais */}
      <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-6 text-sm">
          <div>
            <span className="text-slate-500 block text-xs uppercase font-medium">Linhas de Itens</span>
            <span className="font-bold text-slate-800">{items.length} {items.length === 1 ? 'produto' : 'produtos'}</span>
          </div>
          <div className="border-l border-slate-200 pl-6">
            <span className="text-slate-500 block text-xs uppercase font-medium">Total de Unidades</span>
            <span data-testid="cart-total-items" className="font-bold text-slate-900 text-base">
              {totalItemsCount} {totalItemsCount === 1 ? 'unidade' : 'unidades'}
            </span>
          </div>
        </div>

        <div className="flex items-center sm:text-right space-x-3 sm:space-x-4">
          <span className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
            Total da Pré-Venda:
          </span>
          <span
            data-testid="cart-total-amount"
            className="text-2xl font-extrabold text-emerald-700 tracking-tight"
          >
            {formatBrl(totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}
