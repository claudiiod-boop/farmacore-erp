import { useState, useRef, useEffect } from 'react';
import {
  Barcode,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
  Zap,
  Layers,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import type { InventorySessionWithItems, AddCountInput } from '../../types';
import { api } from '../../services/api';

export interface BlindCountingPanelProps {
  session: InventorySessionWithItems;
  onFinishCounting: () => Promise<void> | void;
  onBack: () => void;
  refreshSession?: () => Promise<void> | void;
}

export default function BlindCountingPanel({
  session,
  onFinishCounting,
  onBack,
  refreshSession,
}: BlindCountingPanelProps) {
  const [ean, setEan] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isIncremental, setIsIncremental] = useState<boolean>(true);

  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loadingFinish, setLoadingFinish] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const eanInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus EAN input on mount and after successful additions
  useEffect(() => {
    eanInputRef.current?.focus();
  }, []);

  // Quick product lookup preview when EAN has 13 chars
  const [productPreviewName, setProductPreviewName] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = ean.trim();
    if (trimmed.length >= 7) {
      let active = true;
      api.getProductByEan(trimmed)
        .then((prod) => {
          if (active && prod) {
            setProductPreviewName(prod.name);
          } else if (active) {
            setProductPreviewName(null);
          }
        })
        .catch(() => {
          if (active) setProductPreviewName(null);
        });
      return () => {
        active = false;
      };
    } else {
      setProductPreviewName(null);
    }
  }, [ean]);

  const handleSubmitCount = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEan = ean.trim();
    const cleanBatch = batchNumber.trim();
    const cleanExp = expirationDate.trim();

    if (!cleanEan) {
      setErrorMessage('Por favor, informe ou bipe o código de barras (EAN).');
      eanInputRef.current?.focus();
      return;
    }
    if (!cleanBatch) {
      setErrorMessage('Por favor, informe o número do lote.');
      return;
    }
    if (!cleanExp) {
      setErrorMessage('Por favor, informe a data de validade (AAAA-MM-DD).');
      return;
    }
    if (quantity <= 0) {
      setErrorMessage('A quantidade deve ser maior que zero.');
      return;
    }

    setLoadingAdd(true);
    try {
      const input: AddCountInput = {
        ean: cleanEan,
        batchNumber: cleanBatch,
        expirationDate: cleanExp,
        quantity: Number(quantity),
        isIncremental,
      };

      const countedItem = await api.addInventoryCount(session.id, input);

      setSuccessMessage(
        `Leitura registrada: ${countedItem.productName || cleanEan} | Lote: ${cleanBatch} | Contado: ${countedItem.countedQuantity} un`
      );

      // Reset fields according to quick mode
      if (isIncremental) {
        setEan('');
        setQuantity(1);
      } else {
        setEan('');
        setBatchNumber('');
        setExpirationDate('');
        setQuantity(1);
      }

      if (refreshSession) {
        await refreshSession();
      }

      eanInputRef.current?.focus();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao registrar contagem.');
    } finally {
      setLoadingAdd(false);
    }
  };

  const handleFinish = async () => {
    const confirm = window.confirm(
      'Deseja encerrar as contagens físicas desta sessão?\n\nApós finalizar, o sistema apurará as divergências para conciliação e não permitirá novos bips.'
    );
    if (!confirm) return;

    setLoadingFinish(true);
    setErrorMessage(null);
    try {
      await api.finishInventoryCount(session.id);
      await onFinishCounting();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao finalizar contagens.');
      setLoadingFinish(false);
    }
  };

  // Items counted so far in this session
  const countedItems = session.items || [];
  const totalCountedUnits = countedItems.reduce((acc, it) => acc + (it.countedQuantity || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 text-slate-100 overflow-y-auto">
      {/* Top Header Bar */}
      <div className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={onBack}
            data-testid="back-button"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Sessões</span>
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-white">Contagem Cega Bip-a-Bip</h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-700">
                {session.sessionCode}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                  session.inventoryType === 'CONTROLADOS_SNGPC'
                    ? 'bg-purple-950 text-purple-300 border-purple-700'
                    : session.inventoryType === 'ROTATIVO'
                    ? 'bg-amber-950 text-amber-300 border-amber-700'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                }`}
              >
                {session.inventoryType === 'CONTROLADOS_SNGPC'
                  ? 'SNGPC Controlados'
                  : session.inventoryType === 'ROTATIVO'
                  ? `Rotativo: ${session.categoryFilter || 'Geral'}`
                  : 'Inventário Geral'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Filial: <strong className="text-slate-200">{session.store?.name || `Loja #${session.storeId}`}</strong> | Aberto por: <strong className="text-slate-200">{session.openedBy}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-slate-400 block">Lotes Auditados:</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {countedItems.length} lotes ({totalCountedUnits} un)
            </span>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            disabled={loadingFinish}
            data-testid="finish-counting-button"
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
          >
            {loadingFinish ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Finalizar Contagens Físicas (Avançar para Conciliação)</span>
          </button>
        </div>
      </div>

      {/* Main Counting Workspace */}
      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Banner Alert if SNGPC */}
        {session.inventoryType === 'CONTROLADOS_SNGPC' && (
          <div className="bg-purple-950/40 border border-purple-800/80 p-4 rounded-xl flex items-start space-x-3 text-purple-200 text-xs">
            <ShieldAlert className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-purple-300">
                Auditoria de Medicamentos Controlados & Antimicrobianos (Portaria 344/98)
              </p>
              <p className="mt-0.5 text-purple-200/90 leading-relaxed">
                A contagem é rigorosamente cega por lote e validade. As divergências apuradas na conciliação exigirão parecer do Farmacêutico RT e gerarão ajustes compulsórios no SNGPC.
              </p>
            </div>
          </div>
        )}

        {/* Feedback Alerts */}
        {successMessage && (
          <div
            data-testid="count-success-alert"
            className="bg-emerald-950/60 border border-emerald-600/70 p-3.5 rounded-lg flex items-center space-x-3 text-emerald-300 text-xs shadow-xs"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div
            data-testid="count-error-alert"
            className="bg-rose-950/60 border border-rose-600/70 p-3.5 rounded-lg flex items-center space-x-3 text-rose-300 text-xs shadow-xs"
          >
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        {/* Barcode Scanner & Entry Form */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-200">
              <Barcode className="w-5 h-5 text-emerald-400" />
              <span>Terminal de Entrada de Contagem</span>
            </div>

            <label className="flex items-center space-x-2 text-xs font-semibold cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={isIncremental}
                onChange={(e) => setIsIncremental(e.target.checked)}
                data-testid="count-incremental-toggle"
                className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500 cursor-pointer"
              />
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Modo Bip Rápido (+1 por leitura sequencial)</span>
            </label>
          </div>

          <form onSubmit={handleSubmitCount} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* EAN Input */}
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Código de Barras (EAN / GTIN) *
              </label>
              <div className="relative">
                <input
                  ref={eanInputRef}
                  type="text"
                  value={ean}
                  onChange={(e) => setEan(e.target.value)}
                  placeholder="Bipe ou digite o EAN (ex: 7891058001234)"
                  autoFocus
                  data-testid="count-ean-input"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
              {productPreviewName && (
                <span className="text-[11px] text-emerald-400 truncate block mt-1 font-semibold">
                  Produto: {productPreviewName}
                </span>
              )}
            </div>

            {/* Batch Input */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Número do Lote *
              </label>
              <input
                type="text"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="Ex: LOTE2026A"
                data-testid="count-batch-input"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 uppercase font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>

            {/* Expiry Input */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Validade (AAAA-MM-DD) *
              </label>
              <input
                type="text"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                placeholder="2027-12-31"
                data-testid="count-expiry-input"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>

            {/* Quantity Input */}
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Qtd *
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                data-testid="count-quantity-input"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-sm text-white font-mono text-center focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>

            {/* Submit Button */}
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={loadingAdd}
                data-testid="submit-count-button"
                className="w-full flex items-center justify-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-sm h-[38px] cursor-pointer"
              >
                {loadingAdd ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Registrar Bip</span>
              </button>
            </div>
          </form>
        </div>

        {/* Scanned Items Table — CRUCIALLY BLIND: NO EXPECTED SYSTEM QUANTITY SHOWN */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Lotes Contados nesta Sessão</h2>
              <span className="text-xs text-slate-500">
                (Aferição cega: os saldos teóricos permanecem ocultos até a conciliação)
              </span>
            </div>
            <span className="text-xs font-bold text-slate-400">
              Total de itens: {countedItems.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">EAN</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Validade</th>
                  <th className="px-4 py-3 text-right">Qtd Contada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {countedItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-500 font-sans">
                      Nenhum item bipado ainda nesta sessão. Utilize o terminal acima para iniciar as contagens físicas.
                    </td>
                  </tr>
                ) : (
                  countedItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-900/50 transition-colors"
                      data-testid={`counted-item-row-${item.id}`}
                    >
                      <td className="px-4 py-3 font-sans font-medium text-white max-w-xs truncate">
                        {item.productName || `Produto #${item.productId}`}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{item.productEan || '-'}</td>
                      <td className="px-4 py-3 text-blue-300 font-bold">{item.batchNumber}</td>
                      <td className="px-4 py-3 text-slate-300">{item.expirationDate}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400 text-sm">
                        {item.countedQuantity}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
