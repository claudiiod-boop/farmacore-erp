import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Building2,
  Package,
  Calendar,
  Phone,
  MapPin,
  Loader2,
  AlertCircle,
  ArrowRightLeft,
  RefreshCw,
} from 'lucide-react';
import { api, Product, NetworkStockItem } from '../services/api';

export interface NetworkStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  productId?: number | null;
  onInitiateTransfer?: (sourceStoreId: number, product?: Product | null) => void;
}

export default function NetworkStockModal({
  isOpen,
  onClose,
  product,
  productId,
  onInitiateTransfer,
}: NetworkStockModalProps) {
  const [stockItems, setStockItems] = useState<NetworkStockItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const effectiveProductId = product?.id ?? productId ?? null;

  const loadNetworkStock = useCallback(async () => {
    if (!effectiveProductId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const items = await api.getNetworkProductStock(effectiveProductId);
      setStockItems(items);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao buscar estoque em rede das filiais');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveProductId]);

  useEffect(() => {
    if (isOpen && effectiveProductId) {
      loadNetworkStock();
    } else {
      setStockItems([]);
      setErrorMessage(null);
    }
  }, [isOpen, effectiveProductId, loadNetworkStock]);

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

  const totalNetworkAvailable = stockItems.reduce((acc, it) => acc + (it.availableQuantity ?? (it as any).available_quantity ?? 0), 0);
  const storesWithStock = stockItems.filter((it) => (it.availableQuantity ?? (it as any).available_quantity ?? 0) > 0).length;

  return (
    <div
      data-testid="network-stock-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-fade-in text-slate-800">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-800 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-950/80 rounded-lg border border-emerald-600/50 text-emerald-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Consulta de Estoque em Rede</span>
                <span className="text-xs font-normal text-slate-400">Multi-Loja & Filiais</span>
              </h2>
              {product && (
                <p className="text-xs text-slate-300 font-medium truncate max-w-lg">
                  {product.name}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={loadNetworkStock}
              disabled={isLoading}
              title="Atualizar estoque em rede"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              data-testid="close-network-stock-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Product Summary Header Banner */}
        {product && (
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-4 flex-wrap gap-y-1">
              <span>
                <strong className="text-slate-600">EAN:</strong>{' '}
                <span className="font-mono text-slate-800 font-bold">{product.ean}</span>
              </span>
              <span>
                <strong className="text-slate-600">Registro MS:</strong>{' '}
                <span className="font-mono text-slate-800">{product.msRegistration}</span>
              </span>
              <span>
                <strong className="text-slate-600">Princípio Ativo:</strong>{' '}
                <span className="text-slate-800">{product.activeIngredient}</span>
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded font-bold text-xs bg-emerald-100 text-emerald-800 border border-emerald-300">
                Total Rede: {totalNetworkAvailable} un ({storesWithStock} lojas c/ estoque)
              </span>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-sm font-medium">Buscando saldos em tempo real em todas as filiais...</p>
            </div>
          ) : errorMessage ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center space-x-3 text-sm">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-bold">Não foi possível consultar os saldos da rede</p>
                <p className="text-xs text-red-700 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          ) : stockItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p>Nenhuma loja ou registro de estoque encontrado para este produto na rede.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <th className="py-3 px-4">Loja / Filial</th>
                    <th className="py-3 px-3">Localização & Contato</th>
                    <th className="py-3 px-3 text-center">Físico</th>
                    <th className="py-3 px-3 text-center">Reservado</th>
                    <th className="py-3 px-3 text-center">Disponível</th>
                    <th className="py-3 px-3">Validade Próxima</th>
                    <th className="py-3 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {stockItems.map((item) => {
                    const storeId = item.storeId ?? (item as any).store_id;
                    const storeName = item.storeName ?? (item as any).store_name;
                    const storeCode = item.storeCode ?? (item as any).store_code;
                    const isHq = Boolean(item.isHeadquarters || (item as any).is_headquarters);
                    const city = item.storeCity ?? (item as any).store_city;
                    const state = item.storeState ?? (item as any).store_state;
                    const phone = item.storePhone ?? (item as any).store_phone;
                    const totalQty = item.totalQuantity ?? (item as any).total_quantity ?? 0;
                    const reservedQty = item.reservedQuantity ?? (item as any).reserved_quantity ?? 0;
                    const availableQty = item.availableQuantity ?? (item as any).available_quantity ?? 0;
                    const earliestExpiry = item.earliestExpiry ?? (item as any).earliest_expiry;

                    return (
                      <tr key={storeId} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                isHq
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-blue-100 text-blue-800 border border-blue-300'
                              }`}
                            >
                              {isHq ? 'Matriz' : 'Filial'}
                            </span>
                            <div>
                              <p className="font-bold text-slate-900">
                                {storeCode ? `[${storeCode}] ` : ''}
                                {storeName}
                              </p>
                              <p className="text-[11px] text-slate-500">ID #{storeId}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="space-y-0.5 text-slate-600">
                            {city && (
                              <p className="flex items-center gap-1 text-[11px]">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                <span>{city}{state ? `/${state}` : ''}</span>
                              </p>
                            )}
                            {phone && (
                              <p className="flex items-center gap-1 text-[11px]">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{phone}</span>
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center text-slate-700 font-semibold font-mono">
                          {totalQty}
                        </td>

                        <td className="py-3 px-3 text-center text-amber-700 font-mono">
                          {reservedQty > 0 ? reservedQty : '-'}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-bold font-mono text-xs ${
                              availableQty > 0
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {availableQty}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          {earliestExpiry ? (
                            <span className="flex items-center gap-1 font-mono text-slate-700">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {earliestExpiry}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            disabled={availableQty <= 0}
                            onClick={() => {
                              if (onInitiateTransfer) {
                                onInitiateTransfer(storeId, product);
                              }
                            }}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-xs ${
                              availableQty > 0
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            }`}
                          >
                            <ArrowRightLeft className="w-3 h-3 mr-1" />
                            <span>Transferir</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Estoque em tempo real sincronizado entre todas as lojas do FarmaCore ERP</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition"
          >
            Fechar (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
