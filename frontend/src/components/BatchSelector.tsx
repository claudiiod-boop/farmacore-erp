import { Calendar, PackageCheck, AlertCircle, Loader2, Award, Check } from 'lucide-react';
import { Batch } from '../services/api';

export interface BatchSelectorProps {
  batches: Batch[];
  selectedBatchId?: number;
  onSelectBatch: (batch: Batch) => void;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export default function BatchSelector({
  batches,
  selectedBatchId,
  onSelectBatch,
  isLoading = false,
  error = null,
  className = '',
}: BatchSelectorProps) {
  if (isLoading) {
    return (
      <div className={`p-6 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center space-x-2 text-slate-600 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
        <span className="text-sm font-medium">Carregando lotes disponíveis...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start space-x-2.5 text-sm ${className}`}>
        <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
        <div>
          <strong className="font-semibold block">Erro ao consultar estoque de lotes</strong>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!batches || batches.length === 0) {
    return (
      <div className={`p-6 bg-slate-50 border border-slate-200 rounded-lg text-center text-slate-500 ${className}`}>
        <PackageCheck className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-60" />
        <p className="text-sm font-medium">Nenhum lote disponível para este produto no estoque.</p>
      </div>
    );
  }

  // Ordena os lotes cronologicamente por validade ascendente
  const sortedBatches = [...batches].sort(
    (a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()
  );

  // Lote FEFO (First-Expired, First-Out): primeiro lote cronológico com estoque disponível > 0
  const fefoBatch = sortedBatches.find((b) => b.availableQuantity > 0);
  const fefoBatchId = fefoBatch?.id;

  return (
    <div className={`bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden ${className}`}>
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Grade de Seleção de Lotes (FEFO)
          </h3>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {batches.length} {batches.length === 1 ? 'lote encontrado' : 'lotes encontrados'}
        </span>
      </div>

      <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
        {sortedBatches.map((batch) => {
          const isFefo = batch.id === fefoBatchId;
          const isSelected = batch.id === selectedBatchId;
          const isAvailable = batch.availableQuantity > 0;

          return (
            <div
              key={batch.id}
              data-testid={`batch-item-${batch.id}`}
              data-selected={isSelected ? 'true' : 'false'}
              className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                !isAvailable
                  ? 'bg-slate-50/70 opacity-60 cursor-not-allowed'
                  : isSelected
                  ? 'bg-emerald-50/80 border-l-4 border-l-emerald-600 pl-2.5'
                  : 'hover:bg-slate-50'
              }`}
            >
              {/* Informações do Lote */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {batch.batchNumber}
                  </span>

                  {isFefo && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-sm animate-pulse">
                      <Award className="w-3 h-3 mr-1 text-amber-600" />
                      FEFO (Recomendado)
                    </span>
                  )}

                  {!isAvailable && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 border border-red-200">
                      Esgotado
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-center space-x-4 text-xs text-slate-600 flex-wrap">
                  <span className="flex items-center gap-1">
                    <strong className="text-slate-500 font-medium">Validade:</strong>
                    <span className={`font-semibold ${isFefo ? 'text-amber-900' : 'text-slate-800'}`}>
                      {formatDate(batch.expirationDate)}
                    </span>
                  </span>

                  <span className="flex items-center gap-1">
                    <strong className="text-slate-500 font-medium">Disponível:</strong>
                    <span
                      className={`font-bold ${
                        isAvailable ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {batch.availableQuantity} un
                    </span>
                    <span className="text-slate-400">
                      (Total: {batch.quantity} un)
                    </span>
                  </span>
                </div>
              </div>

              {/* Ação de Selecionar Lote */}
              <div className="flex items-center sm:self-center">
                <button
                  type="button"
                  data-testid={`select-batch-${batch.id}`}
                  disabled={!isAvailable}
                  onClick={() => {
                    if (isAvailable) {
                      onSelectBatch(batch);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                      : isAvailable
                      ? isFefo
                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                      : 'bg-slate-200 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                  <span>{isSelected ? 'Selecionado' : isFefo ? 'Usar FEFO' : 'Selecionar'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
