import { useState, useEffect } from 'react';
import CounterPage from './pages/CounterPage';
import PosPage from './pages/PosPage';
import PurchasesPage from './pages/PurchasesPage';
import SngpcPage from './pages/SngpcPage';
import FinancialDashboardPage from './pages/FinancialDashboardPage';
import PbmModal from './components/pbm/PbmModal';
import { useStationMode } from './hooks/useStationMode';
import { ArrowLeftRight, Monitor, Store, Package, ShieldAlert, ShieldCheck, DollarSign } from 'lucide-react';

export default function App() {
  const { mode, setMode, isCounter, isPos, isPurchases, isSngpc, isFinancial } = useStationMode();
  const [isPbmModalOpen, setIsPbmModalOpen] = useState(false);

  // Listen to keyboard shortcuts (F1-F4, F6, and Ctrl+Shift+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Station hotkeys F1-F4
      if (e.key === 'F1') {
        e.preventDefault();
        setMode('COUNTER');
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        setMode('POS');
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        setMode('PURCHASES');
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        setMode('SNGPC');
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        setMode('FINANCIAL');
        return;
      }

      // PBM / Farmácia Popular shortcut F6
      if (e.key === 'F6') {
        e.preventDefault();
        setIsPbmModalOpen((prev) => !prev);
        return;
      }

      // Legacy toggle shortcut Ctrl+Shift+S
      if (
        (e.key === 's' || e.key === 'S') &&
        e.ctrlKey &&
        e.shiftKey
      ) {
        e.preventDefault();
        setMode(mode === 'COUNTER' ? 'POS' : 'COUNTER');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mode, setMode]);

  const toggleStationMode = () => {
    setMode(mode === 'COUNTER' ? 'POS' : 'COUNTER');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      {/* Station Mode Switcher Topbar */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs select-none">
        <div className="flex items-center space-x-4">
          {/* Quick toggle pill for backwards compatibility & current mode badge */}
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-400">Posto de Trabalho:</span>
            <button
              type="button"
              onClick={toggleStationMode}
              title="Alternar posto fixo de trabalho (Ctrl+Shift+S)"
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full font-bold transition shadow-xs border bg-slate-800 hover:bg-slate-700 text-white border-slate-700 cursor-pointer"
            >
              {isCounter ? (
                <>
                  <Store className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Posto: Balcão</span>
                </>
              ) : isPos ? (
                <>
                  <Monitor className="w-3.5 h-3.5 text-blue-400" />
                  <span>Posto: Caixa PDV</span>
                </>
              ) : isPurchases ? (
                <>
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <span>Posto: Compras</span>
                </>
              ) : isSngpc ? (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                  <span>Posto: SNGPC</span>
                </>
              ) : (
                <>
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Posto: Financeiro</span>
                </>
              )}
              <ArrowLeftRight className="w-3 h-3 ml-1 text-slate-400" />
            </button>
          </div>

          {/* Navigation Station Selector Buttons [F1]..[F5] */}
          <nav className="flex items-center space-x-1.5" aria-label="Estações de Trabalho">
            <button
              type="button"
              onClick={() => setMode('COUNTER')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isCounter
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              <span>[F1] Balcão</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('POS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isPos
                  ? 'bg-blue-950 text-blue-300 border-blue-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Monitor className="w-3.5 h-3.5 text-blue-400" />
              <span>[F2] Caixa</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('PURCHASES')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isPurchases
                  ? 'bg-amber-950 text-amber-300 border-amber-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-amber-400" />
              <span>[F3] Compras</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('SNGPC')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isSngpc
                  ? 'bg-purple-950 text-purple-300 border-purple-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
              <span>[F4] SNGPC</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('FINANCIAL')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition border text-xs cursor-pointer ${
                isFinancial
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>[F5] Financeiro</span>
            </button>
          </nav>
        </div>

        {/* Global Action [F6] Convênio & Shortcuts Hint */}
        <div className="flex items-center space-x-3 text-xs">
          <button
            type="button"
            data-testid="topbar-pbm-button"
            onClick={() => setIsPbmModalOpen(true)}
            title="Gateway de Convênios Farmacêuticos & Farmácia Popular (F6)"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition border text-xs cursor-pointer bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-600 shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>[F6] Convênio</span>
          </button>

          <div className="hidden lg:flex items-center space-x-3 text-slate-400 text-[11px]">
            <span>
              Atalhos:{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F1</kbd>{' '}
              Balcão |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F2</kbd>{' '}
              Caixa |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F3</kbd>{' '}
              Compras |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F4</kbd>{' '}
              SNGPC |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F5</kbd>{' '}
              Financeiro |{' '}
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">F6</kbd>{' '}
              Convênio
            </span>
          </div>
        </div>
      </div>

      {/* Main Page Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isCounter && <CounterPage />}
        {isPos && <PosPage />}
        {isPurchases && <PurchasesPage />}
        {isSngpc && <SngpcPage />}
        {isFinancial && <FinancialDashboardPage />}
      </div>

      {/* Global PBM Modal */}
      <PbmModal
        isOpen={isPbmModalOpen}
        onClose={() => setIsPbmModalOpen(false)}
      />
    </div>
  );
}
