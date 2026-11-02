import { useEffect } from 'react';
import CounterPage from './pages/CounterPage';
import PosPage from './pages/PosPage';
import { useStationMode } from './hooks/useStationMode';
import { ArrowLeftRight, Monitor, Store } from 'lucide-react';

export default function App() {
  const { mode, setMode, isCounter } = useStationMode();

  // Listen to Ctrl+Shift+S shortcut to toggle station mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      {/* Station Mode Switcher Pill Bar */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between text-xs select-none">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-400">Posto de Trabalho:</span>
          <button
            type="button"
            onClick={toggleStationMode}
            title="Alternar posto fixo de trabalho (Ctrl+Shift+S)"
            className="flex items-center space-x-1.5 px-3 py-1 rounded-full font-bold transition shadow-xs border bg-slate-800 hover:bg-slate-700 text-white border-slate-700 cursor-pointer"
          >
            {isCounter ? (
              <>
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                <span>Posto: Balcão [F1]</span>
              </>
            ) : (
              <>
                <Monitor className="w-3.5 h-3.5 text-blue-400" />
                <span>Posto: Caixa PDV [F2]</span>
              </>
            )}
            <ArrowLeftRight className="w-3 h-3 ml-1 text-slate-400" />
          </button>
        </div>

        <div className="hidden sm:flex items-center space-x-3 text-slate-400 text-[11px]">
          <span>
            Alternar Posto:{' '}
            <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono font-bold">
              Ctrl+Shift+S
            </kbd>
          </span>
        </div>
      </div>

      {/* Main Page Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isCounter ? <CounterPage /> : <PosPage />}
      </div>
    </div>
  );
}
