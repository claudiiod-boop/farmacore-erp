import React from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useStore, isHeadquartersStore } from '../contexts/StoreContext';

export interface StoreSelectorProps {
  className?: string;
}

export default function StoreSelector({ className = '' }: StoreSelectorProps) {
  const { currentStore, setCurrentStore, stores } = useStore();

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = Number(e.target.value);
    const store = stores.find((s) => s.id === selectedId);
    if (store) {
      setCurrentStore(store);
    }
  };

  const isHq = currentStore ? isHeadquartersStore(currentStore) : true;

  return (
    <div
      data-testid="store-selector-container"
      className={`relative inline-flex items-center space-x-2 bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-lg px-2.5 py-1 text-xs shadow-xs transition ${className}`}
    >
      <Building2 className={`w-3.5 h-3.5 flex-shrink-0 ${isHq ? 'text-amber-400' : 'text-blue-400'}`} />

      <div className="flex items-center space-x-1.5">
        <span
          className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
            isHq
              ? 'bg-amber-950 text-amber-300 border border-amber-600/60'
              : 'bg-blue-950 text-blue-300 border border-blue-600/60'
          }`}
        >
          {isHq ? 'Matriz' : 'Filial'}
        </span>

        <span className="font-semibold text-slate-200 max-w-[140px] sm:max-w-[180px] md:max-w-[220px] truncate" title={currentStore?.name}>
          {currentStore ? currentStore.name : 'Loja Matriz'}
        </span>
      </div>

      <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none" />

      {/* Hidden native select positioned absolutely over the button for clean UI and instant accessible interaction */}
      <select
        data-testid="store-selector-dropdown"
        aria-label="Selecionar Loja Ativa"
        value={currentStore?.id ?? ''}
        onChange={handleSelectChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-slate-900 bg-white"
      >
        {stores.map((s) => {
          const sHq = isHeadquartersStore(s);
          return (
            <option key={s.id} value={s.id} className="text-slate-900">
              {sHq ? '[Matriz]' : '[Filial]'} {s.code} - {s.name} ({s.city}/{s.state})
            </option>
          );
        })}
      </select>
    </div>
  );
}
